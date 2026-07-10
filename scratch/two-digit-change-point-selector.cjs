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

function buildPrefix(rows, side) {
  const digits = Array.from({ length: 10 }, () => Array(rows.length + 1).fill(0));
  const pairs = Array.from({ length: PAIRS.length }, () => Array(rows.length + 1).fill(0));
  const repeats = Array(rows.length + 1).fill(0);
  const sums = Array(rows.length + 1).fill(0);
  for (let index = 0; index < rows.length; index++) {
    const panel = String(panelFor(rows[index], side) || "");
    const mask = maskFor(panel);
    for (let digit = 0; digit <= 9; digit++) digits[digit][index + 1] = digits[digit][index] + (mask & (1 << digit) ? 1 : 0);
    for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) pairs[pairIndex][index + 1] = pairs[pairIndex][index] + (isAbsentPair(PAIRS[pairIndex], mask) ? 1 : 0);
    repeats[index + 1] = repeats[index] + (popcount(mask) <= 2 ? 1 : 0);
    sums[index + 1] = sums[index] + [...panel].reduce((sum, digit) => sum + Number(digit), 0);
  }
  return { digits, pairs, repeats, sums };
}

function range(prefix, start, end) {
  return prefix[end] - prefix[start];
}

function segmentStats(prefix, start, end) {
  const total = end - start;
  if (!total) return null;
  return {
    total,
    digitRates: prefix.digits.map((values) => range(values, start, end) / total),
    pairRates: prefix.pairs.map((values) => range(values, start, end) / total),
    repeatRate: range(prefix.repeats, start, end) / total,
    meanSum: range(prefix.sums, start, end) / (total * 27),
  };
}

function divergence(prefix, index, shortWindow, longWindow, detector) {
  const shortStart = Math.max(0, index - shortWindow);
  const priorEnd = shortStart;
  const priorStart = Math.max(0, priorEnd - longWindow);
  const recent = segmentStats(prefix, shortStart, index);
  const prior = segmentStats(prefix, priorStart, priorEnd);
  if (!recent || !prior || prior.total < Math.min(10, longWindow)) return 0;
  const digitShift = recent.digitRates.reduce((sum, rate, digit) => sum + Math.abs(rate - prior.digitRates[digit]), 0) / 10;
  const shapeShift = (Math.abs(recent.repeatRate - prior.repeatRate) + Math.abs(recent.meanSum - prior.meanSum)) / 2;
  if (detector === "digit") return digitShift;
  if (detector === "shape") return shapeShift;
  return (digitShift + shapeShift) / 2;
}

function chooseFromStats(stats, scoreMode) {
  let best = null;
  for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) {
    const pair = PAIRS[pairIndex];
    const riskA = stats.digitRates[pair.digits[0]];
    const riskB = stats.digitRates[pair.digits[1]];
    const joint = stats.pairRates[pairIndex];
    const marginal = (1 - riskA) * (1 - riskB);
    let score = joint;
    if (scoreMode === "marginal_product") score = marginal;
    if (scoreMode === "minimax_digit_risk") score = -Math.max(riskA, riskB) - (riskA + riskB) / 100;
    if (scoreMode === "joint_marginal_blend") score = joint * 0.6 + marginal * 0.4;
    if (!best || score > best.score) best = { pairIndex, score };
  }
  return best.pairIndex;
}

function chooseEwma(rows, side, index, config) {
  const start = Math.max(0, index - config.maxLookback);
  const digitWeight = Array(10).fill(0);
  const pairWeight = Array(PAIRS.length).fill(0);
  let totalWeight = 0;
  for (let i = start; i < index; i++) {
    const age = index - 1 - i;
    const weight = config.alpha * ((1 - config.alpha) ** age);
    const mask = maskFor(panelFor(rows[i], side));
    totalWeight += weight;
    for (let digit = 0; digit <= 9; digit++) if (mask & (1 << digit)) digitWeight[digit] += weight;
    for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) if (isAbsentPair(PAIRS[pairIndex], mask)) pairWeight[pairIndex] += weight;
  }
  if (!totalWeight) return -1;
  return chooseFromStats({
    digitRates: digitWeight.map((value) => value / totalWeight),
    pairRates: pairWeight.map((value) => value / totalWeight),
  }, config.scoreMode);
}

function choosePair(rows, side, index, prefix, config) {
  if (config.family === "ewma") return chooseEwma(rows, side, index, config);
  let window = config.window;
  if (config.family === "change_point") {
    const shift = divergence(prefix, index, config.shortWindow, config.longWindow, config.detector);
    window = shift >= config.threshold ? config.shortWindow : config.longWindow;
  }
  const stats = segmentStats(prefix, Math.max(0, index - window), index);
  return stats ? chooseFromStats(stats, config.scoreMode) : -1;
}

function evaluate(predictions, masks, start, end) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  for (let offset = start; offset < end; offset++) {
    const pairIndex = predictions[offset];
    if (pairIndex < 0) continue;
    correct += isAbsentPair(PAIRS[pairIndex], masks[offset]) ? 1 : 0;
    digitCorrect += absentDigitCount(PAIRS[pairIndex], masks[offset]);
    total++;
  }
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0 };
}

function summarize(folds) {
  const correct = folds.reduce((sum, fold) => sum + fold.test.correct, 0);
  const digitCorrect = folds.reduce((sum, fold) => sum + fold.test.digitCorrect, 0);
  const total = folds.reduce((sum, fold) => sum + fold.test.total, 0);
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0, folds: folds.length };
}

function run() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const scoreModes = ["joint_rate", "marginal_product", "minimax_digit_risk", "joint_marginal_blend"];
  const configs = [];
  for (const scoreMode of scoreModes) {
    for (const window of [5, 10, 15, 20, 30, 45, 60, 90, 120, 180]) configs.push({ family: "fixed", window, scoreMode });
    for (const alpha of [0.02, 0.05, 0.1, 0.2, 0.4]) {
      for (const maxLookback of [60, 180]) configs.push({ family: "ewma", alpha, maxLookback, scoreMode });
    }
    for (const shortWindow of [5, 10, 15]) {
      for (const longWindow of [30, 60, 90]) {
        for (const detector of ["digit", "shape", "combined"]) {
          for (const threshold of [0.08, 0.15, 0.25]) configs.push({ family: "change_point", shortWindow, longWindow, detector, threshold, scoreMode });
        }
      }
    }
  }
  const selectorGates = [0.55, 0.6, 0.65, 0.7, 0.8].map((minValAccuracy) => ({ minValCalls: 60, minValAccuracy }));
  const foldData = [];
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const rows = rowsByMarket[market];
      const prefix = buildPrefix(rows, side);
      const historyStart = Math.max(180, rows.length - 210);
      const predictions = configs.map((config) => {
        const values = [];
        for (let index = historyStart; index < rows.length; index++) values.push(choosePair(rows, side, index, prefix, config));
        return values;
      });
      const masks = rows.slice(historyStart).map((row) => maskFor(panelFor(row, side)));
      let foldCount = 0;
      for (let testStart = rows.length - 30; testStart >= historyStart + 90 && foldCount < 3; testStart -= 30, foldCount++) {
        const valOffsetStart = testStart - 90 - historyStart;
        const testOffsetStart = testStart - historyStart;
        const candidates = configs.map((config, configIndex) => ({
          config,
          validation: evaluate(predictions[configIndex], masks, valOffsetStart, testOffsetStart),
          test: evaluate(predictions[configIndex], masks, testOffsetStart, testOffsetStart + 30),
        }));
        foldData.push({ market, side, testWindow: `${rows[testStart].isoDate}..${rows[testStart + 29].isoDate}`, candidates });
      }
    }
  }
  const results = selectorGates.map((gate) => {
    const folds = [];
    for (const fold of foldData) {
      const best = fold.candidates
        .filter((candidate) => candidate.validation.total >= gate.minValCalls && candidate.validation.accuracy >= gate.minValAccuracy)
        .sort((a, b) => b.validation.accuracy - a.validation.accuracy || b.validation.avgCorrectDigits - a.validation.avgCorrectDigits)[0];
      if (best) folds.push({ market: fold.market, side: fold.side, testWindow: fold.testWindow, config: best.config, validation: best.validation, test: best.test });
    }
    return { gate, summary: summarize(folds), folds };
  });
  const bestFor = (minimum) => results.filter((item) => item.summary.total >= minimum).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin30 = bestFor(30);
  const bestMin120 = bestFor(120);
  const bestMin720 = bestFor(720);
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);
  const output = {
    generatedAt: new Date().toISOString(),
    predictionConfigs: configs.length,
    selectorGates: selectorGates.length,
    forwardFolds: foldData.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30,
    bestMin120,
    bestMin720,
    results,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-change-point-selector-output.json"), JSON.stringify(output, null, 2));
  const lines = [
    "# Two-Digit Change-Point Selector",
    "",
    `Generated: ${output.generatedAt}`,
    `Prediction configurations: ${output.predictionConfigs}`,
    `Validation selector gates: ${output.selectorGates}`,
    `Forward folds: ${output.forwardFolds}`,
    `Viable >=80% gates with >=30 calls: ${output.viable80Count}`,
    `Viable >=85% gates with >=30 calls: ${output.viable85Count}`,
    "",
    "## Best Gates",
    "",
    "| Gate | Calls | Strict Accuracy | Avg Digits | Folds |",
    "|---|---:|---:|---:|---:|",
  ];
  for (const [name, item] of [["Best min 30 calls", bestMin30], ["Best min 120 calls", bestMin120], ["Best min 720 calls", bestMin720]]) {
    if (!item) lines.push(`| ${name} | n/a | n/a | n/a | n/a |`);
    else lines.push(`| ${name}: validation calls>=${item.gate.minValCalls}, validation>=${pct(item.gate.minValAccuracy)} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} | ${item.summary.folds} |`);
  }
  lines.push(
    "",
    "## Interpretation",
    "",
    "- Fixed windows, exponentially decayed memory, and distribution-shift window switching are evaluated under the same forward protocol.",
    "- Shift detectors compare recent versus prior digit rates, repeat pressure, and normalized panel sums without seeing the target result.",
    "- Pair scoring tests joint historical absence, marginal digit risk, minimax risk, and a joint/marginal blend.",
  );
  fs.writeFileSync(path.join(__dirname, "two-digit-change-point-selector.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
