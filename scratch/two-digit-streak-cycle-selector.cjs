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

function gapSinceDigit(rows, side, end, digit, present) {
  for (let gap = 1; gap <= Math.min(240, end); gap++) {
    const mask = maskFor(panelFor(rows[end - gap], side));
    if (((mask & (1 << digit)) !== 0) === present) return gap;
  }
  return 240;
}

function gapSincePair(rows, side, end, pair, absent) {
  for (let gap = 1; gap <= Math.min(300, end); gap++) {
    const mask = maskFor(panelFor(rows[end - gap], side));
    if (isAbsentPair(pair, mask) === absent) return gap;
  }
  return 300;
}

function pairScore(rows, side, index, pair, mode) {
  if (mode === "pair_long_absent") return gapSincePair(rows, side, index, pair, true);
  if (mode === "pair_recently_absent") return -gapSincePair(rows, side, index, pair, true);
  if (mode === "pair_recently_failed") return -gapSincePair(rows, side, index, pair, false);
  if (mode === "digits_long_present_gap") return pair.digits.reduce((sum, digit) => sum + gapSinceDigit(rows, side, index, digit, true), 0);
  if (mode === "digits_recently_present") return -pair.digits.reduce((sum, digit) => sum + gapSinceDigit(rows, side, index, digit, true), 0);
  if (mode === "digits_recently_absent") return -pair.digits.reduce((sum, digit) => sum + gapSinceDigit(rows, side, index, digit, false), 0);
  if (mode === "mixed_gap_balance") {
    return pair.digits.reduce((sum, digit) => {
      return sum + gapSinceDigit(rows, side, index, digit, true) - gapSinceDigit(rows, side, index, digit, false) * 0.5;
    }, 0);
  }
  return 0;
}

function pickPair(rows, side, index, mode) {
  let best = null;
  for (const pair of PAIRS) {
    const score = pairScore(rows, side, index, pair, mode);
    if (!best || score > best.score) best = { pair, score };
  }
  return best.pair;
}

function evalMode(rows, side, start, end, mode) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  for (let index = start; index < end; index++) {
    const pair = pickPair(rows, side, index, mode);
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
  const modes = [
    "pair_long_absent",
    "pair_recently_absent",
    "pair_recently_failed",
    "digits_long_present_gap",
    "digits_recently_present",
    "digits_recently_absent",
    "mixed_gap_balance",
  ];
  const configs = [];
  for (const valLookback of [30, 60, 90, 180]) {
    for (const minValAccuracy of [0.55, 0.6, 0.65, 0.7, 0.75, 0.8]) configs.push({ valLookback, minValAccuracy });
  }

  const results = [];
  for (const config of configs) {
    const folds = [];
    for (const market of MARKETS) {
      for (const side of ["open", "close"]) {
        const rows = rowsByMarket[market];
        let foldCount = 0;
        for (let testStart = rows.length - 30; testStart >= 240 && testStart >= rows.length - 180; testStart -= 30) {
          if (foldCount >= 2) break;
          foldCount++;
          const testEnd = testStart + 30;
          const valEnd = testStart;
          const valStart = Math.max(30, valEnd - config.valLookback);
          let best = null;
          for (const mode of modes) {
            const val = evalMode(rows, side, valStart, valEnd, mode);
            if (val.accuracy < config.minValAccuracy) continue;
            const score = val.accuracy * 1000 + val.avgCorrectDigits * 25 + val.total / 100;
            if (!best || score > best.score) best = { mode, val, score };
          }
          if (!best) continue;
          const test = evalMode(rows, side, testStart, testEnd, best.mode);
          folds.push({ market, side, mode: best.mode, testWindow: `${rows[testStart].isoDate}..${rows[testEnd - 1].isoDate}`, val: best.val, test });
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
  const output = { generatedAt: new Date().toISOString(), modesTested: modes.length, configsTested: configs.length, viable80Count: viable80.length, viable85Count: viable85.length, bestMin30, bestMin120, bestMin720, results };
  fs.writeFileSync(path.join(__dirname, "two-digit-streak-cycle-selector-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Streak/Cycle Selector", "", `Generated: ${output.generatedAt}`, `Modes tested: ${output.modesTested}`, `Gate configs tested: ${output.configsTested}`, `Viable >=80% configs with >=30 calls: ${output.viable80Count}`, `Viable >=85% configs with >=30 calls: ${output.viable85Count}`, "", "## Best Gates", "", "| Gate | Calls | Strict Accuracy | Avg Digits |", "|---|---:|---:|---:|");
  for (const [name, item] of [["Best min 30 calls", bestMin30], ["Best min 120 calls", bestMin120], ["Best min 720 calls", bestMin720]]) {
    if (!item) lines.push(`| ${name} | n/a | n/a | n/a |`);
    else {
      const c = item.config;
      lines.push(`| ${name}: lookback=${c.valLookback}, val>=${pct(c.minValAccuracy)} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} |`);
    }
  }
  lines.push("", "## Interpretation", "", "- This tests missing-streak, recent-absence, recent-failure, and digit-gap cycle theories.", "- Strategy choice is selected only from validation windows before each forward test window.", "- If these fail, streak/cycle behavior is not strong enough for safe two-digit avoid calls.");
  fs.writeFileSync(path.join(__dirname, "two-digit-streak-cycle-selector.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
