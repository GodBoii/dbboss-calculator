/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const {
  MARKETS,
  PAIRS,
  dated,
  panelFor,
  maskFor,
  isAbsentPair,
  absentDigitCount,
  pct,
} = require("./two-digit-deep-research-runner.cjs");

function evalPair(rows, side, start, end, pair) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  for (let index = start; index < end; index++) {
    const mask = maskFor(panelFor(rows[index], side));
    correct += isAbsentPair(pair, mask) ? 1 : 0;
    digitCorrect += absentDigitCount(pair, mask);
    total++;
  }
  return {
    correct,
    digitCorrect,
    total,
    accuracy: total ? correct / total : 0,
    avgCorrectDigits: total ? digitCorrect / total : 0,
  };
}

function summarize(folds) {
  const correct = folds.reduce((sum, fold) => sum + fold.test.correct, 0);
  const digitCorrect = folds.reduce((sum, fold) => sum + fold.test.digitCorrect, 0);
  const total = folds.reduce((sum, fold) => sum + fold.test.total, 0);
  return {
    correct,
    digitCorrect,
    total,
    accuracy: total ? correct / total : 0,
    avgCorrectDigits: total ? digitCorrect / total : 0,
    folds: folds.length,
  };
}

function run() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const gateConfigs = [];
  for (const valLookback of [30, 60, 90, 180, 365]) {
    for (const minValAccuracy of [0.6, 0.65, 0.7, 0.75, 0.8]) {
      for (const minValN of [20, 30, 60, 90]) {
        gateConfigs.push({ valLookback, minValAccuracy, minValN });
      }
    }
  }

  const results = [];
  for (const gate of gateConfigs) {
    const folds = [];
    for (const market of MARKETS) {
      for (const side of ["open", "close"]) {
        const rows = rowsByMarket[market];
        for (let testStart = rows.length - 30; testStart >= 240 && testStart >= rows.length - 180; testStart -= 30) {
          const testEnd = testStart + 30;
          const valEnd = testStart;
          const valStart = Math.max(0, valEnd - gate.valLookback);
          if (valEnd - valStart < gate.minValN) continue;
          let best = null;
          for (const pair of PAIRS) {
            const val = evalPair(rows, side, valStart, valEnd, pair);
            if (val.total < gate.minValN || val.accuracy < gate.minValAccuracy) continue;
            const score = val.accuracy * 1000 + val.avgCorrectDigits * 20 + val.total / 100;
            if (!best || score > best.score) best = { pair, val, score };
          }
          if (!best) continue;
          const test = evalPair(rows, side, testStart, testEnd, best.pair);
          folds.push({
            market,
            side,
            testWindow: `${rows[testStart].isoDate}..${rows[testEnd - 1].isoDate}`,
            pair: best.pair.key,
            val: best.val,
            test,
          });
        }
      }
    }
    results.push({ gate, folds, summary: summarize(folds) });
  }

  const bestMin30 = results
    .filter((item) => item.summary.total >= 30)
    .sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin120 = results
    .filter((item) => item.summary.total >= 120)
    .sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin720 = results
    .filter((item) => item.summary.total >= 720)
    .sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);

  const output = {
    generatedAt: new Date().toISOString(),
    gateConfigs: gateConfigs.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30: bestMin30 ? { gate: bestMin30.gate, summary: bestMin30.summary, folds: bestMin30.folds } : null,
    bestMin120: bestMin120 ? { gate: bestMin120.gate, summary: bestMin120.summary } : null,
    bestMin720: bestMin720 ? { gate: bestMin720.gate, summary: bestMin720.summary } : null,
    results: results.map((item) => ({ gate: item.gate, selectedFolds: item.folds.length, summary: item.summary })),
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-fixed-pair-rolling-selector-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Fixed-Pair Rolling Selector");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Gate configs tested: ${output.gateConfigs}`);
  lines.push(`Viable >=80% configs with >=30 calls: ${output.viable80Count}`);
  lines.push(`Viable >=85% configs with >=30 calls: ${output.viable85Count}`);
  lines.push("");
  lines.push("## Best Gates");
  lines.push("");
  lines.push("| Gate | Calls | Strict Accuracy | Avg Digits |");
  lines.push("|---|---:|---:|---:|");
  for (const [name, item] of [
    ["Best min 30 calls", output.bestMin30],
    ["Best min 120 calls", output.bestMin120],
    ["Best min 720 calls", output.bestMin720],
  ]) {
    if (!item) {
      lines.push(`| ${name} | n/a | n/a | n/a |`);
    } else {
      const g = item.gate;
      lines.push(`| ${name}: lookback=${g.valLookback}, val>=${pct(g.minValAccuracy)}, valN>=${g.minValN} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} |`);
    }
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This tests whether each market/side has a durable fixed two-digit avoid pair.");
  lines.push("- Pair choice is selected only from validation history before each test window.");
  lines.push("- If this cannot clear 80%, stable market-specific fixed pairs are not enough for live calls.");
  fs.writeFileSync(path.join(__dirname, "two-digit-fixed-pair-rolling-selector.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
