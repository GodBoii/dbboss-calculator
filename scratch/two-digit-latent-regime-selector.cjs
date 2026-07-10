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

function baseFeatures(rows, side, index, lookback) {
  const start = Math.max(0, index - lookback);
  const n = index - start;
  if (n < Math.min(5, lookback)) return null;
  const digitRates = Array(10).fill(0);
  let repeatCount = 0;
  let tripleCount = 0;
  let sumTotal = 0;
  let uniqueTotal = 0;
  let overlapTotal = 0;
  let overlapN = 0;
  let previousMask = null;
  for (let i = start; i < index; i++) {
    const panel = String(panelFor(rows[i], side) || "");
    const mask = maskFor(panel);
    const unique = popcount(mask);
    for (let digit = 0; digit <= 9; digit++) if (mask & (1 << digit)) digitRates[digit]++;
    repeatCount += unique === 2 ? 1 : 0;
    tripleCount += unique === 1 ? 1 : 0;
    sumTotal += [...panel].reduce((sum, digit) => sum + Number(digit), 0);
    uniqueTotal += unique;
    if (previousMask != null) {
      const union = popcount(mask | previousMask);
      overlapTotal += union ? popcount(mask & previousMask) / union : 0;
      overlapN++;
    }
    previousMask = mask;
  }
  for (let digit = 0; digit <= 9; digit++) digitRates[digit] /= n;
  let entropy = 0;
  const appearances = digitRates.reduce((sum, value) => sum + value, 0);
  for (const rate of digitRates) {
    if (!rate || !appearances) continue;
    const probability = rate / appearances;
    entropy -= probability * Math.log2(probability);
  }
  return {
    digits: digitRates,
    shape: [
      repeatCount / n,
      tripleCount / n,
      sumTotal / (n * 27),
      uniqueTotal / (n * 3),
      overlapN ? overlapTotal / overlapN : 0,
      entropy / Math.log2(10),
    ],
  };
}

function featureFor(rows, side, index, featureSet, lookback) {
  const short = baseFeatures(rows, side, index, lookback);
  if (!short) return null;
  if (featureSet === "digits") return short.digits;
  if (featureSet === "shape") return short.shape;
  if (featureSet === "combined") return [...short.digits, ...short.shape];
  const long = baseFeatures(rows, side, index, Math.min(90, lookback * 3));
  return long ? [...short.digits, ...long.digits, ...short.shape] : null;
}

function distanceSquared(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += (a[i] - b[i]) ** 2;
  return total;
}

function nearest(vector, centroids) {
  let best = 0;
  let bestDistance = distanceSquared(vector, centroids[0]);
  for (let i = 1; i < centroids.length; i++) {
    const distance = distanceSquared(vector, centroids[i]);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  }
  return best;
}

function fitKmeans(vectors, k) {
  if (vectors.length < k) return null;
  const centroids = [vectors[0].slice()];
  while (centroids.length < k) {
    let farthest = null;
    for (const vector of vectors) {
      const distance = Math.min(...centroids.map((centroid) => distanceSquared(vector, centroid)));
      if (!farthest || distance > farthest.distance) farthest = { vector, distance };
    }
    centroids.push(farthest.vector.slice());
  }
  for (let iteration = 0; iteration < 12; iteration++) {
    const sums = centroids.map(() => Array(vectors[0].length).fill(0));
    const counts = Array(k).fill(0);
    for (const vector of vectors) {
      const cluster = nearest(vector, centroids);
      counts[cluster]++;
      for (let j = 0; j < vector.length; j++) sums[cluster][j] += vector[j];
    }
    let changed = false;
    for (let cluster = 0; cluster < k; cluster++) {
      if (!counts[cluster]) continue;
      const next = sums[cluster].map((sum) => sum / counts[cluster]);
      if (distanceSquared(next, centroids[cluster]) > 1e-12) changed = true;
      centroids[cluster] = next;
    }
    if (!changed) break;
  }
  return centroids;
}

function trainModel(rows, side, start, end, config, featureCache) {
  const examples = [];
  for (let index = start; index < end; index++) {
    const vector = featureCache[index];
    if (vector) examples.push({ vector, mask: maskFor(panelFor(rows[index], side)) });
  }
  const centroids = fitKmeans(examples.map((example) => example.vector), config.clusters);
  if (!centroids) return null;
  const stats = centroids.map(() => PAIRS.map((pair) => ({ pair, correct: 0, digitCorrect: 0, total: 0 })));
  for (const example of examples) {
    const cluster = nearest(example.vector, centroids);
    for (const stat of stats[cluster]) {
      stat.correct += isAbsentPair(stat.pair, example.mask) ? 1 : 0;
      stat.digitCorrect += absentDigitCount(stat.pair, example.mask);
      stat.total++;
    }
  }
  const selected = stats.map((clusterStats) => {
    if (!clusterStats.length || clusterStats[0].total < config.minClusterSupport) return null;
    return clusterStats.sort((a, b) => {
      const scoreA = (a.correct + 2) / (a.total + 4);
      const scoreB = (b.correct + 2) / (b.total + 4);
      return scoreB - scoreA || b.digitCorrect - a.digitCorrect || a.pair.key.localeCompare(b.pair.key);
    })[0].pair;
  });
  return { centroids, selected };
}

function evaluate(rows, side, start, end, model, featureCache) {
  const score = { correct: 0, digitCorrect: 0, total: 0 };
  if (!model) return { ...score, accuracy: 0, avgCorrectDigits: 0 };
  for (let index = start; index < end; index++) {
    const vector = featureCache[index];
    if (!vector) continue;
    const pair = model.selected[nearest(vector, model.centroids)];
    if (!pair) continue;
    const mask = maskFor(panelFor(rows[index], side));
    score.correct += isAbsentPair(pair, mask) ? 1 : 0;
    score.digitCorrect += absentDigitCount(pair, mask);
    score.total++;
  }
  return {
    ...score,
    accuracy: score.total ? score.correct / score.total : 0,
    avgCorrectDigits: score.total ? score.digitCorrect / score.total : 0,
  };
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
  const configs = [];
  for (const featureSet of ["digits", "shape", "combined", "multiscale"]) {
    for (const lookback of [5, 10, 20, 30]) {
      for (const clusters of [2, 3, 4, 5]) {
        for (const minClusterSupport of [10, 20]) configs.push({ featureSet, lookback, clusters, minClusterSupport });
      }
    }
  }
  const selectorGates = [];
  for (const minValCalls of [30, 60]) {
    for (const minValAccuracy of [0.6, 0.7, 0.8]) selectorGates.push({ minValCalls, minValAccuracy });
  }
  const folds = [];
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const rows = rowsByMarket[market];
      const caches = new Map();
      for (const config of configs) {
        const key = `${config.featureSet}|${config.lookback}`;
        if (!caches.has(key)) caches.set(key, rows.map((_, index) => featureFor(rows, side, index, config.featureSet, config.lookback)));
      }
      let foldCount = 0;
      for (let testStart = rows.length - 30; testStart >= 360 && foldCount < 3; testStart -= 30, foldCount++) {
        const valStart = testStart - 90;
        const trainStart = Math.max(0, valStart - 365);
        const candidates = [];
        for (const config of configs) {
          const cache = caches.get(`${config.featureSet}|${config.lookback}`);
          const model = trainModel(rows, side, trainStart, valStart, config, cache);
          const validation = evaluate(rows, side, valStart, testStart, model, cache);
          candidates.push({ config, validation });
        }
        folds.push({ market, side, rows, testStart, trainStart, candidates, caches, testWindow: `${rows[testStart].isoDate}..${rows[testStart + 29].isoDate}` });
      }
    }
  }

  const results = selectorGates.map((gate) => {
    const selectedFolds = [];
    for (const fold of folds) {
      const best = fold.candidates
        .filter((candidate) => candidate.validation.total >= gate.minValCalls && candidate.validation.accuracy >= gate.minValAccuracy)
        .sort((a, b) => b.validation.accuracy - a.validation.accuracy || b.validation.total - a.validation.total)[0];
      if (!best) continue;
      const cache = fold.caches.get(`${best.config.featureSet}|${best.config.lookback}`);
      const refit = trainModel(fold.rows, fold.side, fold.trainStart, fold.testStart, best.config, cache);
      const test = evaluate(fold.rows, fold.side, fold.testStart, fold.testStart + 30, refit, cache);
      if (!test.total) continue;
      selectedFolds.push({ market: fold.market, side: fold.side, testWindow: fold.testWindow, config: best.config, validation: best.validation, test });
    }
    return { gate, summary: summarize(selectedFolds), selectedFolds };
  });
  const bestFor = (minimum) => results.filter((item) => item.summary.total >= minimum).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin30 = bestFor(30);
  const bestMin120 = bestFor(120);
  const bestMin720 = bestFor(720);
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);
  const output = {
    generatedAt: new Date().toISOString(),
    latentConfigs: configs.length,
    selectorGates: selectorGates.length,
    forwardFolds: folds.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30,
    bestMin120,
    bestMin720,
    results,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-latent-regime-selector-output.json"), JSON.stringify(output, null, 2));
  const lines = [
    "# Two-Digit Latent-Regime Selector",
    "",
    `Generated: ${output.generatedAt}`,
    `Latent-state configurations: ${output.latentConfigs}`,
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
    "- K-means states use only pre-result digit, shape, entropy, sum, and persistence features.",
    "- Each fold uses separate training, validation, and later test periods; configuration selection never sees test outcomes.",
    "- The winning configuration is refit through the validation cutoff before scoring the untouched test window.",
  );
  fs.writeFileSync(path.join(__dirname, "two-digit-latent-regime-selector.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
