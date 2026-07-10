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

function popcount(mask) {
  let count = 0;
  for (let digit = 0; digit <= 9; digit++) count += mask & (1 << digit) ? 1 : 0;
  return count;
}

function regimeFor(rows, side, index, mode, lookback) {
  const start = Math.max(0, index - lookback);
  if (index - start < Math.min(5, lookback)) return null;
  const masks = [];
  const sums = [];
  const counts = Array(10).fill(0);
  let repeated = 0;
  for (let i = start; i < index; i++) {
    const panel = String(panelFor(rows[i], side) || "");
    const mask = maskFor(panel);
    masks.push(mask);
    sums.push([...panel].reduce((sum, digit) => sum + Number(digit), 0));
    if (popcount(mask) <= 2) repeated++;
    for (let digit = 0; digit <= 9; digit++) if (mask & (1 << digit)) counts[digit]++;
  }

  if (mode === "entropy") {
    const total = counts.reduce((sum, count) => sum + count, 0);
    let entropy = 0;
    for (const count of counts) {
      if (!count) continue;
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }
    const normalized = entropy / Math.log2(10);
    return normalized < 0.86 ? "concentrated" : normalized < 0.94 ? "normal" : "diffuse";
  }

  if (mode === "coverage") {
    const unique = counts.filter(Boolean).length;
    return unique <= 6 ? "narrow" : unique <= 8 ? "medium" : "wide";
  }

  if (mode === "repeat_pressure") {
    const rate = repeated / masks.length;
    return rate <= 0.18 ? "sp_heavy" : rate >= 0.42 ? "repeat_heavy" : "mixed";
  }

  if (mode === "sum_level") {
    const average = sums.reduce((sum, value) => sum + value, 0) / sums.length;
    return average < 11 ? "low" : average > 16 ? "high" : "middle";
  }

  if (mode === "persistence") {
    let overlap = 0;
    let comparisons = 0;
    for (let i = 1; i < masks.length; i++) {
      const union = popcount(masks[i] | masks[i - 1]);
      if (!union) continue;
      overlap += popcount(masks[i] & masks[i - 1]) / union;
      comparisons++;
    }
    const average = comparisons ? overlap / comparisons : 0;
    return average < 0.13 ? "volatile" : average > 0.31 ? "persistent" : "normal";
  }

  return "all";
}

function summarize(calls) {
  const correct = calls.reduce((sum, call) => sum + call.correct, 0);
  const digitCorrect = calls.reduce((sum, call) => sum + call.digitCorrect, 0);
  return {
    correct,
    digitCorrect,
    total: calls.length,
    accuracy: calls.length ? correct / calls.length : 0,
    avgCorrectDigits: calls.length ? digitCorrect / calls.length : 0,
    folds: new Set(calls.map((call) => call.foldKey)).size,
  };
}

function buildFold(rows, market, side, labels, testStart, testEnd, valLookback) {
  const valStart = Math.max(0, testStart - valLookback);
  const bucketStats = new Map();
  for (let index = valStart; index < testStart; index++) {
    const bucket = labels[index];
    if (!bucket) continue;
    if (!bucketStats.has(bucket)) {
      bucketStats.set(bucket, PAIRS.map((pair) => ({ pair, correct: 0, digitCorrect: 0, total: 0 })));
    }
    const mask = maskFor(panelFor(rows[index], side));
    for (const stat of bucketStats.get(bucket)) {
      stat.correct += isAbsentPair(stat.pair, mask) ? 1 : 0;
      stat.digitCorrect += absentDigitCount(stat.pair, mask);
      stat.total++;
    }
  }

  const selectedByBucket = new Map();
  for (const [bucket, stats] of bucketStats.entries()) {
    stats.sort((a, b) => {
      const accuracyA = a.total ? a.correct / a.total : 0;
      const accuracyB = b.total ? b.correct / b.total : 0;
      return accuracyB - accuracyA || b.digitCorrect - a.digitCorrect || a.pair.key.localeCompare(b.pair.key);
    });
    selectedByBucket.set(bucket, stats[0]);
  }

  const foldKey = `${market}|${side}|${rows[testStart].isoDate}`;
  const candidates = [];
  for (let index = testStart; index < testEnd; index++) {
    const bucket = labels[index];
    const selected = selectedByBucket.get(bucket);
    if (!selected) continue;
    const mask = maskFor(panelFor(rows[index], side));
    candidates.push({
      foldKey,
      market,
      side,
      date: rows[index].isoDate,
      bucket,
      pair: selected.pair.key,
      valTotal: selected.total,
      valAccuracy: selected.total ? selected.correct / selected.total : 0,
      correct: isAbsentPair(selected.pair, mask) ? 1 : 0,
      digitCorrect: absentDigitCount(selected.pair, mask),
    });
  }
  return candidates;
}

function run() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const modes = ["entropy", "coverage", "repeat_pressure", "sum_level", "persistence"];
  const regimeLookbacks = [5, 15, 30];
  const valLookbacks = [180, 365];
  const supports = [5, 10];
  const thresholds = [0.7, 0.8];
  const baseRuns = [];

  for (const mode of modes) {
    for (const regimeLookback of regimeLookbacks) {
      for (const valLookback of valLookbacks) {
        const candidates = [];
        for (const market of MARKETS) {
          for (const side of ["open", "close"]) {
            const rows = rowsByMarket[market];
            const labels = rows.map((_, index) => regimeFor(rows, side, index, mode, regimeLookback));
            for (let testStart = rows.length - 30; testStart >= 240 && testStart >= rows.length - 180; testStart -= 30) {
              candidates.push(...buildFold(rows, market, side, labels, testStart, testStart + 30, valLookback));
            }
          }
        }
        baseRuns.push({ mode, regimeLookback, valLookback, candidates });
      }
    }
  }

  const results = [];
  for (const base of baseRuns) {
    for (const minSupport of supports) {
      for (const minValAccuracy of thresholds) {
        const calls = base.candidates.filter((call) => call.valTotal >= minSupport && call.valAccuracy >= minValAccuracy);
        results.push({
          config: {
            mode: base.mode,
            regimeLookback: base.regimeLookback,
            valLookback: base.valLookback,
            minSupport,
            minValAccuracy,
          },
          summary: summarize(calls),
        });
      }
    }
  }

  const bestFor = (minimum) => results
    .filter((item) => item.summary.total >= minimum)
    .sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin30 = bestFor(30);
  const bestMin120 = bestFor(120);
  const bestMin720 = bestFor(720);
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);
  const output = {
    generatedAt: new Date().toISOString(),
    modesTested: modes.length,
    configsTested: results.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30,
    bestMin120,
    bestMin720,
    results,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-regime-volatility-selector-output.json"), JSON.stringify(output, null, 2));

  const lines = [
    "# Two-Digit Regime/Volatility Selector",
    "",
    `Generated: ${output.generatedAt}`,
    `Regime modes tested: ${output.modesTested}`,
    `Gate configs tested: ${output.configsTested}`,
    `Viable >=80% configs with >=30 calls: ${output.viable80Count}`,
    `Viable >=85% configs with >=30 calls: ${output.viable85Count}`,
    "",
    "## Best Gates",
    "",
    "| Gate | Calls | Strict Accuracy | Avg Digits | Folds |",
    "|---|---:|---:|---:|---:|",
  ];
  for (const [name, item] of [["Best min 30 calls", bestMin30], ["Best min 120 calls", bestMin120], ["Best min 720 calls", bestMin720]]) {
    if (!item) lines.push(`| ${name} | n/a | n/a | n/a | n/a |`);
    else {
      const c = item.config;
      lines.push(`| ${name}: ${c.mode}, regime=${c.regimeLookback}, validation=${c.valLookback}, support>=${c.minSupport}, val>=${pct(c.minValAccuracy)} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} | ${item.summary.folds} |`);
    }
  }
  lines.push(
    "",
    "## Interpretation",
    "",
    "- Every regime label uses only panels before the predicted date.",
    "- The pair for a regime is selected only from the preceding validation window, then scored on later rolling windows.",
    "- Entropy, recent digit coverage, DP/TP pressure, panel-sum level, and consecutive-panel persistence are tested separately to limit overfitting.",
  );
  fs.writeFileSync(path.join(__dirname, "two-digit-regime-volatility-selector.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
