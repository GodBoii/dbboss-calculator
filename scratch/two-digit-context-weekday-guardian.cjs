/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { pct } = require("./two-digit-deep-research-runner.cjs");

function weekday(date) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${date}T12:00:00Z`).getUTCDay()];
}

function groupKey(prediction, mode) {
  if (mode === "weekday_threshold" || mode === "exclude_worst_weekdays") return weekday(prediction.date);
  if (mode === "context_threshold") return prediction.context;
  return `${prediction.context}|${weekday(prediction.date)}`;
}

function learnAllowed(predictions, config) {
  const stats = new Map();
  for (const prediction of predictions) {
    const key = groupKey(prediction, config.mode);
    const stat = stats.get(key) || { key, correct: 0, total: 0 };
    stat.correct += prediction.hit ? 1 : 0;
    stat.total++;
    stats.set(key, stat);
  }
  const groups = [...stats.values()].map((stat) => ({ ...stat, accuracy: stat.total ? stat.correct / stat.total : 0 }));
  if (config.mode === "exclude_worst_weekdays") {
    const excluded = groups
      .filter((group) => group.total >= config.minSupport)
      .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
      .slice(0, config.excludeCount)
      .map((group) => group.key);
    return { allowed: new Set(groups.map((group) => group.key).filter((key) => !excluded.includes(key))), groups, excluded };
  }
  return {
    allowed: new Set(groups.filter((group) => group.total >= config.minSupport && group.accuracy >= config.minGroupAccuracy).map((group) => group.key)),
    groups,
    excluded: [],
  };
}

function evaluate(predictions, config, learned) {
  const selected = predictions.filter((prediction) => learned.allowed.has(groupKey(prediction, config.mode)));
  const correct = selected.filter((prediction) => prediction.hit).length;
  const digitCorrect = selected.reduce((sum, prediction) => sum + (prediction.absentDigits || 0), 0);
  return { correct, digitCorrect, total: selected.length, accuracy: selected.length ? correct / selected.length : 0, avgCorrectDigits: selected.length ? digitCorrect / selected.length : 0 };
}

function summarize(folds) {
  const correct = folds.reduce((sum, fold) => sum + fold.test.correct, 0);
  const digitCorrect = folds.reduce((sum, fold) => sum + fold.test.digitCorrect, 0);
  const total = folds.reduce((sum, fold) => sum + fold.test.total, 0);
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0, folds: folds.length };
}

function run() {
  const rolling = JSON.parse(fs.readFileSync(path.join(__dirname, "two-digit-context-learner-rolling-output.json"), "utf8"));
  const guardianConfigs = [];
  for (const mode of ["weekday_threshold", "context_threshold", "context_weekday_threshold"]) {
    for (const minSupport of [3, 5, 8, 10]) {
      for (const minGroupAccuracy of [0.6, 0.7, 0.8]) guardianConfigs.push({ mode, minSupport, minGroupAccuracy });
    }
  }
  for (const minSupport of [3, 5, 8]) {
    for (const excludeCount of [1, 2]) guardianConfigs.push({ mode: "exclude_worst_weekdays", minSupport, excludeCount });
  }
  const preparedFolds = (rolling.folds || []).map((fold) => {
    const candidates = guardianConfigs.map((config) => {
      const learned = learnAllowed(fold.val.predictions || [], config);
      return {
        config,
        learned,
        validation: evaluate(fold.val.predictions || [], config, learned),
        test: evaluate(fold.test.predictions || [], config, learned),
      };
    });
    return { fold, candidates };
  });
  const selectorGates = [];
  for (const minValCalls of [20, 30, 60]) for (const minValAccuracy of [0.7, 0.75, 0.8]) selectorGates.push({ minValCalls, minValAccuracy });
  const results = selectorGates.map((gate) => {
    const folds = [];
    for (const prepared of preparedFolds) {
      const best = prepared.candidates
        .filter((candidate) => candidate.validation.total >= gate.minValCalls && candidate.validation.accuracy >= gate.minValAccuracy)
        .sort((a, b) => b.validation.accuracy - a.validation.accuracy || b.validation.total - a.validation.total)[0];
      if (!best || !best.test.total) continue;
      folds.push({
        market: prepared.fold.market,
        side: prepared.fold.side,
        testWindow: prepared.fold.testWindow,
        baseMode: prepared.fold.mode,
        guardian: best.config,
        allowedGroups: [...best.learned.allowed],
        excludedGroups: best.learned.excluded,
        validation: best.validation,
        test: best.test,
      });
    }
    return { gate, summary: summarize(folds), folds };
  });
  const bestFor = (minimum) => results.filter((item) => item.summary.total >= minimum).sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin30 = bestFor(30);
  const bestMin120 = bestFor(120);
  const bestMin720 = bestFor(720);
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);

  const latestPocketFold = preparedFolds.find(({ fold }) => fold.market === "Madhur Night" && fold.side === "close" && fold.testWindow === "2026-06-01..2026-07-04");
  const latestWeekdayGuardian = latestPocketFold?.candidates.find((candidate) => candidate.config.mode === "weekday_threshold" && candidate.config.minSupport === 5 && candidate.config.minGroupAccuracy === 0.6) || null;
  const output = {
    generatedAt: new Date().toISOString(),
    guardianConfigs: guardianConfigs.length,
    selectorGates: selectorGates.length,
    forwardFolds: preparedFolds.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30,
    bestMin120,
    bestMin720,
    latestMadhurNightCloseExploratory: latestWeekdayGuardian ? {
      config: latestWeekdayGuardian.config,
      allowedGroups: [...latestWeekdayGuardian.learned.allowed],
      excludedGroups: latestWeekdayGuardian.learned.groups.filter((group) => !latestWeekdayGuardian.learned.allowed.has(group.key)).map((group) => group.key),
      validation: latestWeekdayGuardian.validation,
      test: latestWeekdayGuardian.test,
      warning: "Post-hoc research discovery on an already inspected test window; requires fresh pre-registered confirmation.",
    } : null,
    results,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-context-weekday-guardian-output.json"), JSON.stringify(output, null, 2));
  const lines = [
    "# Two-Digit Context Weekday Guardian",
    "",
    `Generated: ${output.generatedAt}`,
    `Guardian configs: ${output.guardianConfigs}`,
    `Selector gates: ${output.selectorGates}`,
    `Forward folds: ${output.forwardFolds}`,
    `Viable >=80% selector results with >=30 calls: ${output.viable80Count}`,
    `Viable >=85% selector results with >=30 calls: ${output.viable85Count}`,
    "",
    "## Best Rolling Gates",
    "",
    "| Gate | Calls | Strict Accuracy | Avg Digits | Folds |",
    "|---|---:|---:|---:|---:|",
  ];
  for (const [name, item] of [["Best min 30 calls", bestMin30], ["Best min 120 calls", bestMin120], ["Best min 720 calls", bestMin720]]) {
    if (!item) lines.push(`| ${name} | n/a | n/a | n/a | n/a |`);
    else lines.push(`| ${name}: validation calls>=${item.gate.minValCalls}, validation>=${pct(item.gate.minValAccuracy)} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} | ${item.summary.folds} |`);
  }
  if (output.latestMadhurNightCloseExploratory) {
    const pocket = output.latestMadhurNightCloseExploratory;
    lines.push("", "## Exploratory Madhur Night Close Pocket", "", `- Validation-learned allowed weekdays: ${pocket.allowedGroups.join(", ")}.`, `- Validation: ${pct(pocket.validation.accuracy)} (${pocket.validation.correct}/${pocket.validation.total}).`, `- Later 30-day window after filtering: ${pct(pocket.test.accuracy)} (${pocket.test.correct}/${pocket.test.total}).`, `- Warning: ${pocket.warning}`);
  }
  lines.push("", "## Interpretation", "", "- Each guardian learns allowed weekday/context groups only from a fold's validation predictions, then filters its later test predictions.", "- The rolling aggregate determines whether the procedure repeats; an isolated post-hoc 80% pocket is not production proof.", "- A fresh forward register is required before the exploratory Madhur Night rule can be treated as evidence.");
  fs.writeFileSync(path.join(__dirname, "two-digit-context-weekday-guardian.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
