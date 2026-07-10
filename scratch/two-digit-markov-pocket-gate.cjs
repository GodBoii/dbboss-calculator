/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { pct } = require("./two-digit-deep-research-runner.cjs");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), "utf8"));
}

function summarize(predictions) {
  const total = predictions.length;
  const correct = predictions.filter((item) => item.hit).length;
  const digitCorrect = predictions.reduce((sum, item) => sum + (item.absentDigits || 0), 0);
  return {
    correct,
    digitCorrect,
    total,
    accuracy: total ? correct / total : 0,
    avgCorrectDigits: total ? digitCorrect / total : 0,
  };
}

function ruleKeys(prediction) {
  const pair = prediction.pair ?? "na";
  const state = prediction.state ?? "na";
  const source = prediction.source ?? "na";
  const stateKind = state.includes(":") ? state.split(":")[0] : state;
  return [
    `pair=${pair}`,
    `state=${state}`,
    `source=${source}`,
    `stateKind=${stateKind}`,
    `pair=${pair}|state=${state}`,
    `pair=${pair}|source=${source}`,
    `state=${state}|source=${source}`,
    `pair=${pair}|stateKind=${stateKind}`,
    `pair=${pair}|state=${state}|source=${source}`,
  ];
}

function mineRules(validationPredictions, minSupport, minAccuracy) {
  const stats = new Map();
  for (const prediction of validationPredictions) {
    for (const key of ruleKeys(prediction)) {
      const stat = stats.get(key) || { key, correct: 0, total: 0 };
      stat.correct += prediction.hit ? 1 : 0;
      stat.total += 1;
      stats.set(key, stat);
    }
  }
  return [...stats.values()]
    .map((stat) => ({ ...stat, accuracy: stat.total ? stat.correct / stat.total : 0 }))
    .filter((stat) => stat.total >= minSupport && stat.accuracy >= minAccuracy)
    .sort((a, b) => b.accuracy - a.accuracy || b.total - a.total);
}

function matches(prediction, key) {
  return ruleKeys(prediction).includes(key);
}

function run() {
  const markov = readJson("two-digit-markov-transition-output.json");
  const configs = [];
  for (const minSupport of [3, 5, 8, 10, 12]) {
    for (const minAccuracy of [0.8, 0.85, 0.9, 0.95, 1.0]) {
      for (const maxRules of [1, 2, 3, 5, 8]) {
        configs.push({ minSupport, minAccuracy, maxRules });
      }
    }
  }

  const configResults = [];
  for (const config of configs) {
    const selected = [];
    for (const fold of markov.folds || []) {
      const valPredictions = fold.val?.predictions || [];
      const testPredictions = fold.test?.predictions || [];
      const rules = mineRules(valPredictions, config.minSupport, config.minAccuracy).slice(0, config.maxRules);
      if (!rules.length) continue;
      const accepted = testPredictions.filter((prediction) => rules.some((rule) => matches(prediction, rule.key)));
      if (!accepted.length) continue;
      selected.push({
        market: fold.market,
        side: fold.side,
        testWindow: fold.testWindow,
        config: fold.config,
        gate: config,
        rules,
        test: summarize(accepted),
        calls: accepted,
      });
    }
    const aggregatePredictions = selected.flatMap((item) => item.calls);
    const aggregate = summarize(aggregatePredictions);
    configResults.push({
      ...config,
      selectedFolds: selected.length,
      aggregate,
      selected,
    });
  }

  const viable80 = configResults
    .filter((item) => item.aggregate.total >= 30 && item.aggregate.accuracy >= 0.8)
    .sort((a, b) => b.aggregate.total - a.aggregate.total || b.aggregate.accuracy - a.aggregate.accuracy);
  const viable85 = configResults
    .filter((item) => item.aggregate.total >= 30 && item.aggregate.accuracy >= 0.85)
    .sort((a, b) => b.aggregate.total - a.aggregate.total || b.aggregate.accuracy - a.aggregate.accuracy);
  const bestCoverageAt80 = viable80[0] || null;
  const bestAccuracyMin30 = configResults
    .filter((item) => item.aggregate.total >= 30)
    .sort((a, b) => b.aggregate.accuracy - a.aggregate.accuracy || b.aggregate.total - a.aggregate.total)[0] || null;
  const bestAccuracyMin60 = configResults
    .filter((item) => item.aggregate.total >= 60)
    .sort((a, b) => b.aggregate.accuracy - a.aggregate.accuracy || b.aggregate.total - a.aggregate.total)[0] || null;

  const output = {
    generatedAt: new Date().toISOString(),
    configsTested: configs.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestCoverageAt80,
    bestAccuracyMin30,
    bestAccuracyMin60,
    configResults: configResults.map((item) => ({
      minSupport: item.minSupport,
      minAccuracy: item.minAccuracy,
      maxRules: item.maxRules,
      selectedFolds: item.selectedFolds,
      aggregate: item.aggregate,
    })),
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-markov-pocket-gate-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Markov Pocket Gate");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Gate configs tested: ${output.configsTested}`);
  lines.push(`Viable >=80% configs with >=30 calls: ${output.viable80Count}`);
  lines.push(`Viable >=85% configs with >=30 calls: ${output.viable85Count}`);
  lines.push("");
  lines.push("## Best Gates");
  lines.push("");
  lines.push("| Gate | Selected Folds | Calls | Strict Accuracy | Avg Digits |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const [name, item] of [
    ["Best coverage at >=80%", bestCoverageAt80],
    ["Best accuracy min 30 calls", bestAccuracyMin30],
    ["Best accuracy min 60 calls", bestAccuracyMin60],
  ]) {
    if (!item) {
      lines.push(`| ${name} | n/a | n/a | n/a | n/a |`);
    } else {
      lines.push(`| ${name}: support>=${item.minSupport}, val>=${pct(item.minAccuracy)}, maxRules=${item.maxRules} | ${item.selectedFolds} | ${item.aggregate.total} | ${pct(item.aggregate.accuracy)} (${item.aggregate.correct}/${item.aggregate.total}) | ${item.aggregate.avgCorrectDigits.toFixed(2)} |`);
    }
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This is a selective abstention gate on top of the Markov/transition model.");
  lines.push("- It mines high-accuracy validation pockets by pair/state/source labels, then scores only matching future test calls.");
  lines.push("- A useful live gate must keep >=80% strict accuracy with enough calls to matter; tiny perfect pockets are not enough.");
  lines.push("- If no >=80% config with reasonable call count appears here, the Markov pocket is not deployable as a money-risk avoid-call engine yet.");
  fs.writeFileSync(path.join(__dirname, "two-digit-markov-pocket-gate.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) {
  run();
}
