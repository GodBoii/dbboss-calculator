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

const EVENT_TIME = {
  "Sridevi|open": 685,
  "Sridevi|close": 745,
  "Time Bazar|open": 775,
  "Time Bazar|close": 835,
  "Madhur Day|open": 805,
  "Madhur Day|close": 865,
  "Milan Day|open": 895,
  "Rajdhani Day|open": 895,
  "Kalyan|open": 945,
  "Milan Day|close": 1015,
  "Rajdhani Day|close": 1015,
  "Kalyan|close": 1065,
  "Sridevi Night|open": 1140,
  "Sridevi Night|close": 1200,
  "Madhur Night|open": 1225,
  "Milan Night|open": 1250,
  "Kalyan Night|open": 1280,
  "Rajdhani Night|open": 1280,
  "Main Bazar|open": 1295,
  "Madhur Night|close": 1345,
  "Milan Night|close": 1370,
  "Kalyan Night|close": 1400,
  "Rajdhani Night|close": 1405,
  "Main Bazar|close": 1430,
};

const EVENTS = Object.entries(EVENT_TIME)
  .map(([key, time]) => {
    const [market, side] = key.split("|");
    return { key, market, side, time };
  })
  .sort((a, b) => a.time - b.time || a.key.localeCompare(b.key));

const FEATURE_MODES = ["mask", "sutta", "kind", "root", "sum_band", "first", "middle", "last", "house_shape", "parity_shape", "opposite_mask", "shift_mask"];
const OPPOSITE = { 0: 5, 1: 6, 2: 7, 3: 8, 4: 9, 5: 0, 6: 1, 7: 2, 8: 3, 9: 4 };

function popcount(mask) {
  let count = 0;
  for (let digit = 0; digit <= 9; digit++) count += mask & (1 << digit) ? 1 : 0;
  return count;
}

function eventPanel(row, side) {
  return String(panelFor(row, side) || "");
}

function eventFeature(row, side, mode) {
  const panel = eventPanel(row, side);
  if (!/^\d{3}$/.test(panel)) return null;
  const digits = [...panel].map(Number);
  const mask = maskFor(panel);
  const sum = digits.reduce((total, digit) => total + digit, 0);
  if (mode === "mask") return String(mask);
  if (mode === "sutta" || mode === "root") return String(sum % 10);
  if (mode === "kind") return popcount(mask) === 3 ? "SP" : popcount(mask) === 2 ? "DP" : "TP";
  if (mode === "sum_band") return sum <= 10 ? "low" : sum >= 17 ? "high" : "mid";
  if (mode === "first") return String(digits[0]);
  if (mode === "middle") return String(digits[1]);
  if (mode === "last") return String(digits[2]);
  if (mode === "house_shape") return digits.map((digit) => digit <= 4 ? "L" : "H").join("");
  if (mode === "parity_shape") return digits.map((digit) => digit % 2 ? "O" : "E").join("");
  if (mode === "opposite_mask") return String(maskFor(digits.map((digit) => OPPOSITE[digit]).join("")));
  if (mode === "shift_mask") return String(maskFor(digits.map((digit) => (digit + 1) % 10).join("")));
  return null;
}

function availableEvents(market, side) {
  const targetTime = EVENT_TIME[`${market}|${side}`];
  return EVENTS.filter((event) => event.time < targetTime);
}

function rowForDate(dateMaps, event, isoDate) {
  return dateMaps[event.market]?.get(isoDate) || null;
}

function aggregateFeature(dateMaps, events, isoDate, mode) {
  const values = [];
  for (const event of events) {
    const row = rowForDate(dateMaps, event, isoDate);
    if (!row) continue;
    const panel = eventPanel(row, event.side);
    if (!/^\d{3}$/.test(panel)) continue;
    values.push({ event, panel, mask: maskFor(panel), kind: popcount(maskFor(panel)) });
  }
  if (!values.length) return null;
  const tail2 = values.slice(-2);
  const tail3 = values.slice(-3);
  if (mode === "union_last2") return String(tail2.reduce((mask, value) => mask | value.mask, 0));
  if (mode === "union_last3") return String(tail3.reduce((mask, value) => mask | value.mask, 0));
  if (mode === "kind_last2") return tail2.map((value) => value.kind).join("-");
  if (mode === "root_last2") return tail2.map((value) => [...value.panel].reduce((sum, digit) => sum + Number(digit), 0) % 10).join("-");
  if (mode === "latest_digit_overlap") return tail2.length === 2 ? String(popcount(tail2[0].mask & tail2[1].mask)) : null;
  if (mode === "dp_count") return String(values.filter((value) => value.kind <= 2).length >= 2 ? "many" : values.filter((value) => value.kind <= 2).length);
  return null;
}

function featureForModel(model, dateMaps, isoDate) {
  if (model.type === "event") {
    const row = rowForDate(dateMaps, model.event, isoDate);
    return row ? eventFeature(row, model.event.side, model.mode) : null;
  }
  return aggregateFeature(dateMaps, model.events, isoDate, model.mode);
}

function trainBuckets(targetRows, side, start, end, model, dateMaps) {
  const buckets = new Map();
  for (let index = start; index < end; index++) {
    const feature = featureForModel(model, dateMaps, targetRows[index].isoDate);
    if (feature == null) continue;
    if (!buckets.has(feature)) {
      buckets.set(feature, {
        total: 0,
        digitPresent: Array(10).fill(0),
        pairCorrect: Array(PAIRS.length).fill(0),
      });
    }
    const bucket = buckets.get(feature);
    const mask = maskFor(panelFor(targetRows[index], side));
    bucket.total++;
    for (let digit = 0; digit <= 9; digit++) if (mask & (1 << digit)) bucket.digitPresent[digit]++;
    for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) if (isAbsentPair(PAIRS[pairIndex], mask)) bucket.pairCorrect[pairIndex]++;
  }
  return buckets;
}

function selectPair(bucket, scoreMode) {
  let best = null;
  for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) {
    const pair = PAIRS[pairIndex];
    const joint = (bucket.pairCorrect[pairIndex] + 2) / (bucket.total + 4);
    const riskA = bucket.digitPresent[pair.digits[0]] / bucket.total;
    const riskB = bucket.digitPresent[pair.digits[1]] / bucket.total;
    const marginal = (1 - riskA) * (1 - riskB);
    let score = joint;
    if (scoreMode === "marginal") score = marginal;
    if (scoreMode === "minimax") score = -Math.max(riskA, riskB) - (riskA + riskB) / 100;
    if (scoreMode === "blend") score = joint * 0.6 + marginal * 0.4;
    if (!best || score > best.score) best = { pairIndex, score };
  }
  return best.pairIndex;
}

function evaluate(targetRows, side, start, end, model, buckets, variant, dateMaps) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  for (let index = start; index < end; index++) {
    const feature = featureForModel(model, dateMaps, targetRows[index].isoDate);
    const bucket = feature == null ? null : buckets.get(feature);
    if (!bucket || bucket.total < variant.minSupport) continue;
    const pair = PAIRS[selectPair(bucket, variant.scoreMode)];
    const mask = maskFor(panelFor(targetRows[index], side));
    correct += isAbsentPair(pair, mask) ? 1 : 0;
    digitCorrect += absentDigitCount(pair, mask);
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
  const dateMaps = Object.fromEntries(MARKETS.map((market) => [market, new Map(rowsByMarket[market].map((row) => [row.isoDate, row]))]));
  const variants = [];
  for (const minSupport of [5, 10]) for (const scoreMode of ["joint", "marginal", "minimax", "blend"]) variants.push({ minSupport, scoreMode });
  const gates = [];
  for (const minValCalls of [20, 60]) for (const minValAccuracy of [0.6, 0.7, 0.8]) gates.push({ minValCalls, minValAccuracy });
  const foldData = [];
  let totalBaseModels = 0;

  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const targetRows = rowsByMarket[market];
      const events = availableEvents(market, side);
      if (!events.length) continue;
      const models = [];
      for (const event of events) for (const mode of FEATURE_MODES) models.push({ type: "event", event, mode, name: `${event.key}:${mode}` });
      for (const mode of ["union_last2", "union_last3", "kind_last2", "root_last2", "latest_digit_overlap", "dp_count"]) {
        models.push({ type: "aggregate", events, mode, name: `all_prior:${mode}` });
      }
      totalBaseModels += models.length;
      let foldCount = 0;
      for (let testStart = targetRows.length - 30; testStart >= 360 && foldCount < 3; testStart -= 30, foldCount++) {
        const valStart = testStart - 90;
        const trainStart = Math.max(0, valStart - 365);
        const candidates = [];
        for (const model of models) {
          const trainBucketsMap = trainBuckets(targetRows, side, trainStart, valStart, model, dateMaps);
          for (const variant of variants) {
            const validation = evaluate(targetRows, side, valStart, testStart, model, trainBucketsMap, variant, dateMaps);
            candidates.push({ model, variant, validation });
          }
        }
        foldData.push({ market, side, targetRows, testStart, trainStart, models, events, candidates, testWindow: `${targetRows[testStart].isoDate}..${targetRows[testStart + 29].isoDate}` });
      }
    }
  }

  const results = gates.map((gate) => {
    const folds = [];
    for (const fold of foldData) {
      const best = fold.candidates
        .filter((candidate) => candidate.validation.total >= gate.minValCalls && candidate.validation.accuracy >= gate.minValAccuracy)
        .sort((a, b) => b.validation.accuracy - a.validation.accuracy || b.validation.total - a.validation.total)[0];
      if (!best) continue;
      const refitBuckets = trainBuckets(fold.targetRows, fold.side, fold.trainStart, fold.testStart, best.model, dateMaps);
      const test = evaluate(fold.targetRows, fold.side, fold.testStart, fold.testStart + 30, best.model, refitBuckets, best.variant, dateMaps);
      if (!test.total) continue;
      folds.push({ market: fold.market, side: fold.side, testWindow: fold.testWindow, model: best.model.name, variant: best.variant, validation: best.validation, test });
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
    timingPolicy: "Only source events with conservative event time strictly earlier than target event time.",
    featureModes: FEATURE_MODES.length + 6,
    baseModelsAcrossTargets: totalBaseModels,
    pairVariantsPerModel: variants.length,
    selectorGates: gates.length,
    forwardFolds: foldData.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30,
    bestMin120,
    bestMin720,
    results,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-time-ordered-market-graph-output.json"), JSON.stringify(output, null, 2));
  const lines = [
    "# Two-Digit Time-Ordered Market Graph",
    "",
    `Generated: ${output.generatedAt}`,
    `Feature modes: ${output.featureModes}`,
    `Base source/feature models across targets: ${output.baseModelsAcrossTargets}`,
    `Pair variants per model: ${output.pairVariantsPerModel}`,
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
    "- Same-day source panels are used only when their conservative publication event precedes the target event.",
    "- Near-simultaneous Milan/Rajdhani events are not allowed to predict one another; the same restriction applies to Kalyan Night/Rajdhani Night opens.",
    "- Source feature and pair formula are selected on an earlier validation period, then refit through that cutoff and scored later.",
  );
  fs.writeFileSync(path.join(__dirname, "two-digit-time-ordered-market-graph.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

module.exports = { EVENT_TIME, EVENTS, availableEvents, eventPanel };

if (require.main === module) run();
