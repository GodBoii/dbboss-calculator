/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { pct } = require("./two-digit-deep-research-runner.cjs");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), "utf8"));
}

function summaryFromPredictions(predictions) {
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

function addCandidate(candidates, market, side, family, val, test, predictions) {
  if (!val || !test || !test.total) return;
  const key = `${market}|${side}`;
  const list = candidates.get(key) || [];
  list.push({
    market,
    side,
    family,
    val,
    test,
    predictions: predictions || test.predictions || [],
  });
  candidates.set(key, list);
}

function loadCandidates() {
  const candidates = new Map();

  const deep = readJson("two-digit-deep-research-output.json");
  for (const row of deep.rows || []) {
    addCandidate(candidates, row.market, row.side, "baseline", row.baselineVal, row.baselineTest, row.baselineTest?.predictions);
    addCandidate(candidates, row.market, row.side, `deep:${row.candidateFamily}`, row.candidateVal, row.candidateTest, row.candidateTest?.predictions);
    addCandidate(candidates, row.market, row.side, `deep_final:${row.finalFamily}`, row.candidateVal || row.baselineVal, row.finalTest, row.finalTest?.predictions);
  }

  const meta = readJson("two-digit-meta-formula-search-output.json");
  for (const row of meta.rows || []) {
    addCandidate(candidates, row.market, row.side, "meta_formula", row.val, row.test, row.test?.predictions);
  }

  const context = readJson("two-digit-context-learner-output.json");
  for (const row of context.rows || []) {
    addCandidate(candidates, row.market, row.side, "context_learner", row.val, row.test, row.test?.predictions);
  }

  const supervised = readJson("two_digit_supervised_ranker_output.json");
  for (const row of supervised.rows || []) {
    addCandidate(candidates, row.market, row.side, "supervised_ridge", row.val, row.test, row.predictions);
  }

  return candidates;
}

function runConfig(candidates, config) {
  const selected = [];
  for (const [key, list] of candidates.entries()) {
    const eligible = list.filter((item) => item.val.total >= config.minValN && item.val.accuracy >= config.minValAccuracy);
    if (!eligible.length) continue;
    eligible.sort((a, b) => {
      const scoreA = a.val.accuracy * 1000 + a.val.avgCorrectDigits * config.digitWeight + Math.min(a.val.total, 90) / 100;
      const scoreB = b.val.accuracy * 1000 + b.val.avgCorrectDigits * config.digitWeight + Math.min(b.val.total, 90) / 100;
      return scoreB - scoreA;
    });
    const best = eligible[0];
    selected.push({ key, ...best });
  }
  const predictions = selected.flatMap((item) => item.predictions || []);
  return { selected, summary: summaryFromPredictions(predictions) };
}

function run() {
  const candidates = loadCandidates();
  const configs = [];
  for (const minValAccuracy of [0, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]) {
    for (const minValN of [20, 30, 60, 90]) {
      for (const digitWeight of [0, 10, 25, 50]) {
        configs.push({ minValAccuracy, minValN, digitWeight });
      }
    }
  }

  const results = configs.map((config) => ({ config, ...runConfig(candidates, config) }));
  const fullCoverage = results
    .filter((item) => item.selected.length === candidates.size)
    .sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin30 = results
    .filter((item) => item.summary.total >= 30)
    .sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin120 = results
    .filter((item) => item.summary.total >= 120)
    .sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);

  const output = {
    generatedAt: new Date().toISOString(),
    marketSides: candidates.size,
    configsTested: configs.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    fullCoverage: fullCoverage ? { config: fullCoverage.config, selectedCount: fullCoverage.selected.length, summary: fullCoverage.summary } : null,
    bestMin30: bestMin30 ? { config: bestMin30.config, selectedCount: bestMin30.selected.length, summary: bestMin30.summary } : null,
    bestMin120: bestMin120 ? { config: bestMin120.config, selectedCount: bestMin120.selected.length, summary: bestMin120.summary } : null,
    results: results.map((item) => ({
      config: item.config,
      selectedCount: item.selected.length,
      summary: item.summary,
    })),
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-portfolio-selector-gate-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Portfolio Selector Gate");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Market-sides: ${output.marketSides}`);
  lines.push(`Gate configs tested: ${output.configsTested}`);
  lines.push(`Viable >=80% configs with >=30 calls: ${output.viable80Count}`);
  lines.push(`Viable >=85% configs with >=30 calls: ${output.viable85Count}`);
  lines.push("");
  lines.push("## Best Gates");
  lines.push("");
  lines.push("| Gate | Selected Market-Sides | Calls | Strict Accuracy | Avg Digits |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const [name, item] of [
    ["Full coverage", output.fullCoverage],
    ["Best min 30 calls", output.bestMin30],
    ["Best min 120 calls", output.bestMin120],
  ]) {
    if (!item) {
      lines.push(`| ${name} | n/a | n/a | n/a | n/a |`);
    } else {
      const c = item.config;
      lines.push(`| ${name}: val>=${pct(c.minValAccuracy)}, valN>=${c.minValN}, digitWeight=${c.digitWeight} | ${item.selectedCount} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} |`);
    }
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This tests a validation-only portfolio selector across baseline, deep research, meta formula, context learner, and supervised ranker outputs.");
  lines.push("- It asks whether choosing the best model family per market/side can reach the 80-85% strict target.");
  lines.push("- If no validation threshold produces >=80% with enough calls, the current model family pool is not enough for live avoid betting.");
  fs.writeFileSync(path.join(__dirname, "two-digit-portfolio-selector-gate.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

module.exports = { loadCandidates, runConfig, summaryFromPredictions };

if (require.main === module) run();
