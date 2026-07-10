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

const GROUPS = {
  low: [0, 1, 2, 3, 4],
  high: [5, 6, 7, 8, 9],
  odd: [1, 3, 5, 7, 9],
  even: [0, 2, 4, 6, 8],
  prime: [2, 3, 5, 7],
  compositeish: [0, 1, 4, 6, 8, 9],
  corners: [0, 4, 5, 9],
  middle: [2, 3, 6, 7],
};
const OPPOSITES = [[0, 5], [1, 6], [2, 7], [3, 8], [4, 9]];

function pairByDigits(a, b) {
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  return PAIRS.find((pair) => pair.digits[0] === x && pair.digits[1] === y);
}

function candidatePairs(mode) {
  if (mode === "opposite_pairs") return OPPOSITES.map(([a, b]) => pairByDigits(a, b));
  if (mode === "same_house_low") return PAIRS.filter((pair) => pair.digits.every((digit) => GROUPS.low.includes(digit)));
  if (mode === "same_house_high") return PAIRS.filter((pair) => pair.digits.every((digit) => GROUPS.high.includes(digit)));
  if (mode === "mixed_low_high") return PAIRS.filter((pair) => pair.digits.some((digit) => GROUPS.low.includes(digit)) && pair.digits.some((digit) => GROUPS.high.includes(digit)));
  if (mode === "same_parity") return PAIRS.filter((pair) => pair.digits[0] % 2 === pair.digits[1] % 2);
  if (mode === "mixed_parity") return PAIRS.filter((pair) => pair.digits[0] % 2 !== pair.digits[1] % 2);
  if (mode === "group_pairs") {
    const out = [];
    for (const group of Object.values(GROUPS)) {
      for (const pair of PAIRS) if (pair.digits.every((digit) => group.includes(digit))) out.push(pair);
    }
    return [...new Map(out.map((pair) => [pair.key, pair])).values()];
  }
  return PAIRS;
}

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
  const configs = [];
  for (const mode of ["opposite_pairs", "same_house_low", "same_house_high", "mixed_low_high", "same_parity", "mixed_parity", "group_pairs"]) {
    for (const valLookback of [30, 60, 90, 180]) {
      for (const minValAccuracy of [0.6, 0.65, 0.7, 0.75, 0.8]) {
        configs.push({ mode, valLookback, minValAccuracy });
      }
    }
  }

  const results = [];
  for (const config of configs) {
    const folds = [];
    const candidates = candidatePairs(config.mode).filter(Boolean);
    for (const market of MARKETS) {
      for (const side of ["open", "close"]) {
        const rows = rowsByMarket[market];
        for (let testStart = rows.length - 30; testStart >= 240 && testStart >= rows.length - 180; testStart -= 30) {
          const testEnd = testStart + 30;
          const valEnd = testStart;
          const valStart = Math.max(0, valEnd - config.valLookback);
          let best = null;
          for (const pair of candidates) {
            const val = evalPair(rows, side, valStart, valEnd, pair);
            if (val.accuracy < config.minValAccuracy) continue;
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
    results.push({ config, selectedFolds: folds.length, summary: summarize(folds) });
  }

  const bestMin30 = results.filter((item) => item.summary.total >= 30).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin120 = results.filter((item) => item.summary.total >= 120).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin720 = results.filter((item) => item.summary.total >= 720).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);
  const output = {
    generatedAt: new Date().toISOString(),
    configsTested: configs.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30,
    bestMin120,
    bestMin720,
    results,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-house-opposite-selector-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit House/Opposite Selector");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Gate configs tested: ${output.configsTested}`);
  lines.push(`Viable >=80% configs with >=30 calls: ${output.viable80Count}`);
  lines.push(`Viable >=85% configs with >=30 calls: ${output.viable85Count}`);
  lines.push("");
  lines.push("## Best Gates");
  lines.push("");
  lines.push("| Gate | Calls | Strict Accuracy | Avg Digits |");
  lines.push("|---|---:|---:|---:|");
  for (const [name, item] of [["Best min 30 calls", bestMin30], ["Best min 120 calls", bestMin120], ["Best min 720 calls", bestMin720]]) {
    if (!item) lines.push(`| ${name} | n/a | n/a | n/a |`);
    else {
      const c = item.config;
      lines.push(`| ${name}: ${c.mode}, lookback=${c.valLookback}, val>=${pct(c.minValAccuracy)} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} |`);
    }
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This tests house, parity, group, and opposite-number theories as constrained pair families.");
  lines.push("- Pair choice is selected only from validation windows before each forward test window.");
  lines.push("- If these constrained families fail, house/opposite theory is not strong enough for live avoid calls.");
  fs.writeFileSync(path.join(__dirname, "two-digit-house-opposite-selector.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
