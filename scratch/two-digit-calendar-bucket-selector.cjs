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

function bucketFor(row, mode) {
  const dom = row.date.getUTCDate();
  const month = row.date.getUTCMonth() + 1;
  if (mode === "dom") return `dom:${dom}`;
  if (mode === "dom_mod3") return `mod3:${dom % 3}`;
  if (mode === "dom_mod5") return `mod5:${dom % 5}`;
  if (mode === "month_phase") return dom <= 10 ? "early" : dom <= 20 ? "mid" : "late";
  if (mode === "payday_phase") return dom <= 5 ? "payday" : dom >= 25 ? "month_end" : "normal";
  if (mode === "month_parity_phase") return `${month % 2 ? "oddm" : "evenm"}:${dom <= 15 ? "front" : "back"}`;
  return "all";
}

function evalPair(rows, side, start, end, pair, predicate = null) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  for (let index = start; index < end; index++) {
    if (predicate && !predicate(rows[index], index)) continue;
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
  for (const mode of ["dom_mod3", "dom_mod5", "month_phase", "payday_phase"]) {
    for (const valLookback of [180, 365]) {
      for (const minSupport of [5, 8]) {
        for (const minValAccuracy of [0.7, 0.8]) {
          configs.push({ mode, valLookback, minSupport, minValAccuracy });
        }
      }
    }
  }

  const results = [];
  for (const config of configs) {
    const folds = [];
    for (const market of MARKETS) {
      for (const side of ["open", "close"]) {
        const rows = rowsByMarket[market];
        for (let testStart = rows.length - 30; testStart >= 240 && testStart >= rows.length - 180; testStart -= 30) {
          const testEnd = testStart + 30;
          const valEnd = testStart;
          const valStart = Math.max(0, valEnd - config.valLookback);
          const bucketPairs = new Map();
          const buckets = [...new Set(rows.slice(testStart, testEnd).map((row) => bucketFor(row, config.mode)))];
          for (const bucket of buckets) {
            let best = null;
            for (const pair of PAIRS) {
              const val = evalPair(rows, side, valStart, valEnd, pair, (row) => bucketFor(row, config.mode) === bucket);
              if (val.total < config.minSupport || val.accuracy < config.minValAccuracy) continue;
              const score = val.accuracy * 1000 + val.avgCorrectDigits * 20 + val.total / 100;
              if (!best || score > best.score) best = { pair, val, score };
            }
            if (best) bucketPairs.set(bucket, best);
          }
          if (!bucketPairs.size) continue;
          const test = { correct: 0, digitCorrect: 0, total: 0 };
          const val = { correct: 0, digitCorrect: 0, total: 0 };
          for (const [bucket, best] of bucketPairs.entries()) {
            val.correct += best.val.correct;
            val.digitCorrect += best.val.digitCorrect;
            val.total += best.val.total;
            const part = evalPair(rows, side, testStart, testEnd, best.pair, (row) => bucketFor(row, config.mode) === bucket);
            test.correct += part.correct;
            test.digitCorrect += part.digitCorrect;
            test.total += part.total;
          }
          if (!test.total) continue;
          val.accuracy = val.total ? val.correct / val.total : 0;
          val.avgCorrectDigits = val.total ? val.digitCorrect / val.total : 0;
          test.accuracy = test.total ? test.correct / test.total : 0;
          test.avgCorrectDigits = test.total ? test.digitCorrect / test.total : 0;
          folds.push({
            market,
            side,
            testWindow: `${rows[testStart].isoDate}..${rows[testEnd - 1].isoDate}`,
            selectedBuckets: bucketPairs.size,
            val,
            test,
          });
        }
      }
    }
    results.push({ config, folds, summary: summarize(folds) });
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
    bestMin30: bestMin30 ? { config: bestMin30.config, summary: bestMin30.summary } : null,
    bestMin120: bestMin120 ? { config: bestMin120.config, summary: bestMin120.summary } : null,
    bestMin720: bestMin720 ? { config: bestMin720.config, summary: bestMin720.summary } : null,
    results: results.map((item) => ({ config: item.config, selectedFolds: item.folds.length, summary: item.summary })),
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-calendar-bucket-selector-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Calendar Bucket Selector");
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
  for (const [name, item] of [["Best min 30 calls", output.bestMin30], ["Best min 120 calls", output.bestMin120], ["Best min 720 calls", output.bestMin720]]) {
    if (!item) lines.push(`| ${name} | n/a | n/a | n/a |`);
    else {
      const c = item.config;
      lines.push(`| ${name}: ${c.mode}, lookback=${c.valLookback}, support>=${c.minSupport}, val>=${pct(c.minValAccuracy)} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} |`);
    }
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This tests calendar-date bucket theories: exact date, date modulo cycles, month phase, payday/month-end phase, and month parity.");
  lines.push("- Pair choice is selected only from matching historical calendar buckets before each test window.");
  lines.push("- If these buckets fail forward, calendar timing is not strong enough for safe two-digit avoid calls.");
  fs.writeFileSync(path.join(__dirname, "two-digit-calendar-bucket-selector.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
