/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { pct } = require("./two-digit-deep-research-runner.cjs");

function wilsonLower(correct, total, z = 1.2815515655446004) {
  if (!total) return 0;
  const p = correct / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator;
  return center - margin;
}

function shouldCall(history, config) {
  if (config.mode === "trailing") {
    const recent = history.slice(-config.window);
    if (recent.length < config.window) return false;
    return recent.filter(Boolean).length / recent.length >= config.threshold;
  }
  if (config.mode === "ewma") {
    const recent = history.slice(-90);
    if (recent.length < 20) return false;
    let estimate = 0.5;
    for (const hit of recent) estimate = config.alpha * (hit ? 1 : 0) + (1 - config.alpha) * estimate;
    return estimate >= config.threshold;
  }
  if (config.mode === "wilson") {
    const recent = history.slice(-config.window);
    if (recent.length < config.window) return false;
    return wilsonLower(recent.filter(Boolean).length, recent.length) >= config.threshold;
  }
  const recent = history.slice(-config.window);
  if (recent.length < config.window) return false;
  return recent.filter((hit) => !hit).length <= config.maxFailures;
}

function simulate(initialHistory, predictions, config) {
  const history = initialHistory.map((prediction) => Boolean(prediction.hit));
  const calls = [];
  for (const prediction of predictions) {
    const call = shouldCall(history, config);
    if (call) calls.push(prediction);
    history.push(Boolean(prediction.hit));
  }
  const correct = calls.filter((prediction) => prediction.hit).length;
  const digitCorrect = calls.reduce((sum, prediction) => sum + (prediction.absentDigits || 0), 0);
  return { correct, digitCorrect, total: calls.length, accuracy: calls.length ? correct / calls.length : 0, avgCorrectDigits: calls.length ? digitCorrect / calls.length : 0, calls };
}

function summarize(folds) {
  const correct = folds.reduce((sum, fold) => sum + fold.test.correct, 0);
  const digitCorrect = folds.reduce((sum, fold) => sum + fold.test.digitCorrect, 0);
  const total = folds.reduce((sum, fold) => sum + fold.test.total, 0);
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0, folds: folds.length };
}

function run() {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, "two-digit-context-learner-rolling-output.json"), "utf8"));
  const configs = [];
  for (const window of [5, 10, 15, 20, 30, 45, 60, 90]) {
    for (const threshold of [0.55, 0.6, 0.65, 0.7, 0.75, 0.8]) configs.push({ mode: "trailing", window, threshold });
  }
  for (const alpha of [0.05, 0.1, 0.2, 0.3, 0.5]) {
    for (const threshold of [0.55, 0.6, 0.65, 0.7, 0.75, 0.8]) configs.push({ mode: "ewma", alpha, threshold });
  }
  for (const window of [10, 20, 30, 45, 60, 90]) {
    for (const threshold of [0.4, 0.45, 0.5, 0.55, 0.6, 0.65]) configs.push({ mode: "wilson", window, threshold });
  }
  for (const window of [5, 10, 20, 30]) {
    for (const maxFailures of [0, 1, 2, 3, 4]) configs.push({ mode: "stoploss", window, maxFailures });
  }

  const prepared = (source.folds || []).map((fold) => {
    const validation = [...(fold.val.predictions || [])].sort((a, b) => a.date.localeCompare(b.date));
    const testPredictions = [...(fold.test.predictions || [])].sort((a, b) => a.date.localeCompare(b.date));
    const calibration = validation.slice(0, -30);
    const validationTail = validation.slice(-30);
    const candidates = configs.map((config) => ({
      config,
      validation: simulate(calibration, validationTail, config),
      test: simulate(validation, testPredictions, config),
    }));
    return { fold, validation, candidates };
  });

  const selectorGates = [];
  for (const minValCalls of [5, 10, 20]) {
    for (const minValAccuracy of [0.65, 0.7, 0.75, 0.8]) selectorGates.push({ minValCalls, minValAccuracy });
  }
  const results = selectorGates.map((gate) => {
    const folds = [];
    for (const item of prepared) {
      const best = item.candidates
        .filter((candidate) => candidate.validation.total >= gate.minValCalls && candidate.validation.accuracy >= gate.minValAccuracy)
        .sort((a, b) => b.validation.accuracy - a.validation.accuracy || b.validation.total - a.validation.total)[0];
      if (!best || !best.test.total) continue;
      folds.push({ market: item.fold.market, side: item.fold.side, testWindow: item.fold.testWindow, baseMode: item.fold.mode, config: best.config, validation: { ...best.validation, calls: undefined }, test: { ...best.test, calls: undefined } });
    }
    return { gate, summary: summarize(folds), folds };
  });
  const bestFor = (minimum) => results.filter((item) => item.summary.total >= minimum).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin30 = bestFor(30);
  const bestMin120 = bestFor(120);
  const bestMin720 = bestFor(720);
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);
  const madhurLatest = prepared.find((item) => item.fold.market === "Madhur Night" && item.fold.side === "close" && item.fold.testWindow === "2026-06-01..2026-07-04");
  const madhurBest = madhurLatest?.candidates
    .filter((candidate) => candidate.validation.total >= 10 && candidate.validation.accuracy >= 0.7)
    .sort((a, b) => b.validation.accuracy - a.validation.accuracy || b.validation.total - a.validation.total)[0] || null;
  const output = {
    generatedAt: new Date().toISOString(),
    onlineConfigs: configs.length,
    selectorGates: selectorGates.length,
    forwardFolds: prepared.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30,
    bestMin120,
    bestMin720,
    madhurNightLatest: madhurBest ? { config: madhurBest.config, validation: { ...madhurBest.validation, calls: undefined }, test: { ...madhurBest.test, calls: undefined } } : null,
    results,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-online-regime-stoploss-output.json"), JSON.stringify(output, null, 2));
  const lines = [
    "# Two-Digit Online Regime / Stop-Loss Gate",
    "",
    `Generated: ${output.generatedAt}`,
    `Sequential configs: ${output.onlineConfigs}`,
    `Selector gates: ${output.selectorGates}`,
    `Forward folds: ${output.forwardFolds}`,
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
    else lines.push(`| ${name}: validation calls>=${item.gate.minValCalls}, validation>=${pct(item.gate.minValAccuracy)} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} | ${item.summary.folds} |`);
  }
  if (output.madhurNightLatest) lines.push("", "## Madhur Night Latest Sequential Gate", "", `- Selected config: ${JSON.stringify(output.madhurNightLatest.config)}.`, `- Calibration-validation calls: ${output.madhurNightLatest.validation.total}; accuracy ${pct(output.madhurNightLatest.validation.accuracy)}.`, `- Later sequential calls: ${output.madhurNightLatest.test.total}; accuracy ${pct(output.madhurNightLatest.test.accuracy)} (${output.madhurNightLatest.test.correct}/${output.madhurNightLatest.test.total}).`);
  lines.push("", "## Interpretation", "", "- Each online decision uses only earlier hypothetical model outcomes and updates after the actual result becomes available.", "- Gate configuration is chosen on the last 30 validation rows after initialization from the preceding 60, then frozen for the test window.", "- Broad rolling performance, not one hot regime, determines whether sequential continuation can be deployed.");
  fs.writeFileSync(path.join(__dirname, "two-digit-online-regime-stoploss.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
