/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { pct } = require("./two-digit-deep-research-runner.cjs");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), "utf8"));
}

function keyFor(row) {
  const window = row.testWindow || `${row.foldStartDate}..`;
  return `${row.market}|${row.side}|${window}`;
}

function addCandidate(groups, row, family) {
  if (!row?.val || !row?.test || !row.test.total) return;
  const key = keyFor(row);
  const list = groups.get(key) || [];
  list.push({
    market: row.market,
    side: row.side,
    testWindow: row.testWindow || `${row.foldStartDate}..`,
    family,
    val: row.val,
    test: row.test,
  });
  groups.set(key, list);
}

function summarize(items) {
  const correct = items.reduce((sum, item) => sum + item.test.correct, 0);
  const digitCorrect = items.reduce((sum, item) => sum + (item.test.digitCorrect || 0), 0);
  const total = items.reduce((sum, item) => sum + item.test.total, 0);
  return {
    correct,
    digitCorrect,
    total,
    accuracy: total ? correct / total : 0,
    avgCorrectDigits: total ? digitCorrect / total : 0,
    folds: items.length,
  };
}

function loadGroups() {
  const groups = new Map();

  const meta = readJson("two-digit-meta-formula-search-output.json");
  for (const row of meta.rollingRows || []) addCandidate(groups, row, "meta_formula");

  const context = readJson("two-digit-context-learner-rolling-output.json");
  for (const row of context.folds || []) addCandidate(groups, row, "context_learner");

  const markov = readJson("two-digit-markov-transition-output.json");
  for (const row of markov.folds || []) addCandidate(groups, row, "markov_transition");

  const bayes = readJson("two-digit-bayesian-gate-output.json");
  for (const row of bayes.folds || []) addCandidate(groups, row, "bayesian_gate");

  return groups;
}

function runConfig(groups, config) {
  const selected = [];
  for (const [key, candidates] of groups.entries()) {
    const eligible = candidates.filter(
      (item) => item.val.total >= config.minValN && item.val.accuracy >= config.minValAccuracy && item.test.total >= config.minTestN,
    );
    if (!eligible.length) continue;
    eligible.sort((a, b) => {
      const scoreA = a.val.accuracy * 1000 + a.val.avgCorrectDigits * config.digitWeight + Math.min(a.val.total, 90) / 100;
      const scoreB = b.val.accuracy * 1000 + b.val.avgCorrectDigits * config.digitWeight + Math.min(b.val.total, 90) / 100;
      return scoreB - scoreA;
    });
    selected.push({ key, ...eligible[0] });
  }
  return { selected, summary: summarize(selected) };
}

function run() {
  const groups = loadGroups();
  const configs = [];
  for (const minValAccuracy of [0, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8]) {
    for (const minValN of [5, 10, 20, 30, 60, 90]) {
      for (const minTestN of [1, 5, 10, 20, 30]) {
        for (const digitWeight of [0, 25, 50]) {
          configs.push({ minValAccuracy, minValN, minTestN, digitWeight });
        }
      }
    }
  }

  const results = configs.map((config) => ({ config, ...runConfig(groups, config) }));
  const bestMin30 = results
    .filter((item) => item.summary.total >= 30)
    .sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin120 = results
    .filter((item) => item.summary.total >= 120)
    .sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin720 = results
    .filter((item) => item.summary.total >= 720)
    .sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const viable80 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = results.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);

  const familyStats = new Map();
  if (bestMin30) {
    for (const item of bestMin30.selected) {
      const stat = familyStats.get(item.family) || { selected: 0, correct: 0, total: 0 };
      stat.selected += 1;
      stat.correct += item.test.correct;
      stat.total += item.test.total;
      familyStats.set(item.family, stat);
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    groups: groups.size,
    configsTested: configs.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30: bestMin30 ? { config: bestMin30.config, selectedCount: bestMin30.selected.length, summary: bestMin30.summary } : null,
    bestMin120: bestMin120 ? { config: bestMin120.config, selectedCount: bestMin120.selected.length, summary: bestMin120.summary } : null,
    bestMin720: bestMin720 ? { config: bestMin720.config, selectedCount: bestMin720.selected.length, summary: bestMin720.summary } : null,
    bestMin30FamilyStats: Object.fromEntries([...familyStats.entries()].map(([family, stat]) => [family, { ...stat, accuracy: stat.total ? stat.correct / stat.total : 0 }])),
    results: results.map((item) => ({ config: item.config, selectedCount: item.selected.length, summary: item.summary })),
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-rolling-portfolio-selector-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Rolling Portfolio Selector");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Grouped forward folds: ${output.groups}`);
  lines.push(`Gate configs tested: ${output.configsTested}`);
  lines.push(`Viable >=80% configs with >=30 calls: ${output.viable80Count}`);
  lines.push(`Viable >=85% configs with >=30 calls: ${output.viable85Count}`);
  lines.push("");
  lines.push("## Best Gates");
  lines.push("");
  lines.push("| Gate | Selected Folds | Calls | Strict Accuracy | Avg Digits |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const [name, item] of [
    ["Best min 30 calls", output.bestMin30],
    ["Best min 120 calls", output.bestMin120],
    ["Best min 720 calls", output.bestMin720],
  ]) {
    if (!item) {
      lines.push(`| ${name} | n/a | n/a | n/a | n/a |`);
    } else {
      const c = item.config;
      lines.push(`| ${name}: val>=${pct(c.minValAccuracy)}, valN>=${c.minValN}, testN>=${c.minTestN}, digitWeight=${c.digitWeight} | ${item.selectedCount} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} |`);
    }
  }
  lines.push("");
  lines.push("## Family Mix For Best Min-30 Gate");
  lines.push("");
  lines.push("| Family | Selected | Strict Accuracy |");
  lines.push("|---|---:|---:|");
  for (const [family, stat] of Object.entries(output.bestMin30FamilyStats)) {
    lines.push(`| ${family} | ${stat.selected} | ${pct(stat.accuracy)} (${stat.correct}/${stat.total}) |`);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This tests whether validation-selected model choice is stable across repeated forward windows.");
  lines.push("- It uses rolling outputs from meta formula, context learner, Markov transition, and Bayesian gate families.");
  lines.push("- A single latest-window 76.7% pocket is not enough; this rolling check shows whether the idea repeats.");
  fs.writeFileSync(path.join(__dirname, "two-digit-rolling-portfolio-selector.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
