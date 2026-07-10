/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { pct } = require("./two-digit-deep-research-runner.cjs");

function score(predictions) {
  const correct = predictions.filter((prediction) => prediction.hit).length;
  const digitCorrect = predictions.reduce((sum, prediction) => sum + (prediction.absentDigits || 0), 0);
  return { correct, digitCorrect, total: predictions.length, accuracy: predictions.length ? correct / predictions.length : 0, avgCorrectDigits: predictions.length ? digitCorrect / predictions.length : 0 };
}

function validationProfile(predictions) {
  const ordered = [...predictions].sort((a, b) => a.date.localeCompare(b.date));
  const blockSize = Math.floor(ordered.length / 3);
  if (blockSize < 10) return null;
  const blocks = [
    score(ordered.slice(0, blockSize)),
    score(ordered.slice(blockSize, blockSize * 2)),
    score(ordered.slice(blockSize * 2)),
  ];
  const accuracies = blocks.map((block) => block.accuracy);
  return {
    aggregate: score(ordered),
    blocks,
    minimum: Math.min(...accuracies),
    maximum: Math.max(...accuracies),
    spread: Math.max(...accuracies) - Math.min(...accuracies),
    last: accuracies[2],
    trend: accuracies[2] - accuracies[0],
  };
}

function summarize(folds) {
  const correct = folds.reduce((sum, fold) => sum + fold.test.correct, 0);
  const digitCorrect = folds.reduce((sum, fold) => sum + fold.test.digitCorrect, 0);
  const total = folds.reduce((sum, fold) => sum + fold.test.total, 0);
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0, folds: folds.length };
}

function run() {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, "two-digit-context-learner-rolling-output.json"), "utf8"));
  const folds = (source.folds || []).map((fold) => ({ ...fold, profile: validationProfile(fold.val.predictions || []) })).filter((fold) => fold.profile);
  const configs = [];
  for (const minBlockAccuracy of [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]) {
    for (const minAggregateAccuracy of [0.55, 0.6, 0.65, 0.7, 0.75, 0.8]) {
      for (const maxSpread of [0.1, 0.15, 0.2, 0.3, 0.4]) {
        for (const minLastAccuracy of [0.5, 0.6, 0.7, 0.8]) configs.push({ minBlockAccuracy, minAggregateAccuracy, maxSpread, minLastAccuracy });
      }
    }
  }
  const results = configs.map((config) => {
    const selected = folds.filter((fold) => {
      const profile = fold.profile;
      return profile.minimum >= config.minBlockAccuracy && profile.aggregate.accuracy >= config.minAggregateAccuracy && profile.spread <= config.maxSpread && profile.last >= config.minLastAccuracy;
    }).map((fold) => ({
      market: fold.market,
      side: fold.side,
      testWindow: fold.testWindow,
      mode: fold.mode,
      profile: fold.profile,
      test: score(fold.test.predictions || []),
    }));
    return { config, summary: summarize(selected), selected };
  });
  const bestFor = (minimum) => results.filter((item) => item.summary.total >= minimum).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin30 = bestFor(30);
  const bestMin120 = bestFor(120);
  const bestMin720 = bestFor(720);
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);
  const madhurPocket = folds.find((fold) => fold.market === "Madhur Night" && fold.side === "close" && fold.testWindow === "2026-06-01..2026-07-04");
  const output = {
    generatedAt: new Date().toISOString(),
    configsTested: configs.length,
    forwardFolds: folds.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30,
    bestMin120,
    bestMin720,
    madhurNightLatestProfile: madhurPocket ? { market: madhurPocket.market, side: madhurPocket.side, testWindow: madhurPocket.testWindow, mode: madhurPocket.mode, profile: madhurPocket.profile, test: score(madhurPocket.test.predictions || []) } : null,
    results: results.map((item) => ({ config: item.config, summary: item.summary, selectedKeys: item.selected.map((fold) => `${fold.market}|${fold.side}|${fold.testWindow}`) })),
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-context-durability-gate-output.json"), JSON.stringify(output, null, 2));
  const lines = [
    "# Two-Digit Context Multi-Block Durability Gate",
    "",
    `Generated: ${output.generatedAt}`,
    `Durability configs tested: ${output.configsTested}`,
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
    else {
      const c = item.config;
      lines.push(`| ${name}: each>=${pct(c.minBlockAccuracy)}, aggregate>=${pct(c.minAggregateAccuracy)}, spread<=${pct(c.maxSpread)}, latest>=${pct(c.minLastAccuracy)} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} | ${item.summary.folds} |`);
    }
  }
  if (output.madhurNightLatestProfile) {
    const pocket = output.madhurNightLatestProfile;
    lines.push("", "## Madhur Night Latest Profile", "", `- Validation blocks: ${pocket.profile.blocks.map((block) => pct(block.accuracy)).join(", ")}.`, `- Validation aggregate: ${pct(pocket.profile.aggregate.accuracy)}; spread: ${pct(pocket.profile.spread)}.`, `- Later test: ${pct(pocket.test.accuracy)} (${pocket.test.correct}/${pocket.test.total}).`);
  }
  lines.push("", "## Interpretation", "", "- Every selected fold must show validation strength in three chronological blocks, not only in the 90-day aggregate.", "- Gate thresholds are applied before the test window; the reported best configuration remains exploratory because it is selected from many backtest gates.", "- Repeated high test folds are required before a durability gate can become a live call rule.");
  fs.writeFileSync(path.join(__dirname, "two-digit-context-durability-gate.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
