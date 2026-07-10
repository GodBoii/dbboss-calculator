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
  makeModelCatalog,
  pct,
} = require("./two-digit-deep-research-runner.cjs");

function aggregatePrediction(pairIndexes, weights, mode) {
  const pairVotes = Array(PAIRS.length).fill(0);
  const digitVotes = Array(10).fill(0);
  let totalWeight = 0;
  for (let i = 0; i < pairIndexes.length; i++) {
    const pairIndex = pairIndexes[i];
    if (pairIndex < 0) continue;
    const weight = weights[i];
    totalWeight += weight;
    pairVotes[pairIndex] += weight;
    for (const digit of PAIRS[pairIndex].digits) digitVotes[digit] += weight;
  }
  if (!totalWeight) return null;

  if (mode === "exact_pair_vote") {
    let pairIndex = 0;
    for (let i = 1; i < pairVotes.length; i++) if (pairVotes[i] > pairVotes[pairIndex]) pairIndex = i;
    return { pairIndex, confidence: pairVotes[pairIndex] / totalWeight };
  }

  const digits = digitVotes
    .map((vote, digit) => ({ vote, digit }))
    .sort((a, b) => b.vote - a.vote || a.digit - b.digit)
    .slice(0, 2)
    .map((item) => item.digit)
    .sort((a, b) => a - b);
  const pairIndex = PAIRS.findIndex((pair) => pair.digits[0] === digits[0] && pair.digits[1] === digits[1]);
  return { pairIndex, confidence: (digitVotes[digits[0]] + digitVotes[digits[1]]) / (2 * totalWeight) };
}

function emptyScore() {
  return { correct: 0, digitCorrect: 0, total: 0, accuracy: 0, avgCorrectDigits: 0 };
}

function finishScore(score) {
  score.accuracy = score.total ? score.correct / score.total : 0;
  score.avgCorrectDigits = score.total ? score.digitCorrect / score.total : 0;
  return score;
}

function simulate(sequence, split, config) {
  const weights = Array(sequence[0].pairIndexes.length).fill(1);
  const validation = emptyScore();
  const test = emptyScore();
  for (let day = 0; day < sequence.length; day++) {
    const item = sequence[day];
    const prediction = aggregatePrediction(item.pairIndexes, weights, config.mode);
    const score = day < split ? validation : test;
    if (prediction && prediction.confidence >= config.minConfidence) {
      const pair = PAIRS[prediction.pairIndex];
      score.correct += isAbsentPair(pair, item.mask) ? 1 : 0;
      score.digitCorrect += absentDigitCount(pair, item.mask);
      score.total++;
    }

    let weightSum = 0;
    for (let i = 0; i < weights.length; i++) {
      const pairIndex = item.pairIndexes[i];
      const hit = pairIndex >= 0 && isAbsentPair(PAIRS[pairIndex], item.mask);
      const decayed = Math.pow(weights[i], config.decay);
      weights[i] = decayed * Math.exp(config.eta * (hit ? 0.5 : -0.5));
      weightSum += weights[i];
    }
    if (weightSum) {
      const scale = weights.length / weightSum;
      for (let i = 0; i < weights.length; i++) weights[i] *= scale;
    }
  }
  return { validation: finishScore(validation), test: finishScore(test) };
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
  const models = makeModelCatalog();
  const confidenceByMode = {
    exact_pair_vote: [0, 0.05, 0.1],
    digit_vote: [0, 0.2, 0.3],
  };
  const candidateConfigs = [];
  for (const mode of Object.keys(confidenceByMode)) {
    for (const eta of [0.1, 0.3, 0.7]) {
      for (const decay of [1, 0.98]) {
        for (const minConfidence of confidenceByMode[mode]) candidateConfigs.push({ mode, eta, decay, minConfidence });
      }
    }
  }
  const gates = [];
  for (const minValCalls of [20, 50]) {
    for (const minValAccuracy of [0.6, 0.7, 0.8]) gates.push({ minValCalls, minValAccuracy });
  }
  const foldData = [];

  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const rows = rowsByMarket[market];
      const ctx = { market, side, rows, rowsByMarket };
      let foldCount = 0;
      for (let testStart = rows.length - 30; testStart >= 240 && foldCount < 3; testStart -= 30, foldCount++) {
        const valStart = Math.max(180, testStart - 90);
        if (testStart - valStart < 60) continue;
        const sequence = [];
        for (let index = valStart; index < testStart + 30; index++) {
          const iso = rows[index].isoDate;
          const pairIndexes = models.map((model) => {
            const pair = model.pick({ ...ctx, index, iso });
            return pair ? PAIRS.indexOf(pair) : -1;
          });
          sequence.push({ mask: maskFor(panelFor(rows[index], side)), pairIndexes });
        }
        const simulations = candidateConfigs.map((config) => ({ config, ...simulate(sequence, testStart - valStart, config) }));
        foldData.push({ market, side, testWindow: `${rows[testStart].isoDate}..${rows[testStart + 29].isoDate}`, simulations });
      }
    }
  }

  const results = gates.map((gate) => {
    const folds = [];
    for (const fold of foldData) {
      const best = fold.simulations
        .filter((item) => item.validation.total >= gate.minValCalls && item.validation.accuracy >= gate.minValAccuracy)
        .sort((a, b) => b.validation.accuracy - a.validation.accuracy || b.validation.total - a.validation.total)[0];
      if (!best || !best.test.total) continue;
      folds.push({ market: fold.market, side: fold.side, testWindow: fold.testWindow, config: best.config, validation: best.validation, test: best.test });
    }
    return { gate, summary: summarize(folds), folds };
  });
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
    expertModels: models.length,
    candidateConfigs: candidateConfigs.length,
    selectorGates: gates.length,
    forwardFolds: foldData.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30,
    bestMin120,
    bestMin720,
    results,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-online-expert-ensemble-output.json"), JSON.stringify(output, null, 2));

  const lines = [
    "# Two-Digit Online Expert Ensemble",
    "",
    `Generated: ${output.generatedAt}`,
    `Expert models: ${output.expertModels}`,
    `Adaptive voting configs: ${output.candidateConfigs}`,
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
    "- All catalog models vote; weights are updated only after each outcome becomes available.",
    "- Voting mode, learning speed, memory decay, and abstention confidence are selected on the preceding validation period before each forward test fold.",
    "- This is a numeric adaptive-agent benchmark. An LLM still cannot improve it merely by narrating the same historical inputs.",
  );
  fs.writeFileSync(path.join(__dirname, "two-digit-online-expert-ensemble.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
