/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { pct } = require("./two-digit-deep-research-runner.cjs");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), "utf8"));
}

function pairDigits(pair) {
  return String(pair || "")
    .split("")
    .map((digit) => Number(digit))
    .filter((digit) => Number.isInteger(digit));
}

function pairKeyFromDigits(digits) {
  const sorted = [...new Set(digits)].sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  return `${sorted[0]}${sorted[1]}`;
}

function addPrediction(map, family, market, side, prediction) {
  if (!prediction?.date || !prediction?.pair) return;
  const key = `${market}|${side}|${prediction.date}`;
  const row = map.get(key) || { market, side, date: prediction.date, votes: [], actual: null };
  row.votes.push({
    family,
    pair: prediction.pair,
    hit: Boolean(prediction.hit),
    absentDigits: prediction.absentDigits ?? 0,
    score: prediction.score ?? null,
  });
  if (!row.actual) {
    row.actual = {
      hitByPair: new Map(),
    };
  }
  row.actual.hitByPair.set(prediction.pair, {
    hit: Boolean(prediction.hit),
    absentDigits: prediction.absentDigits ?? 0,
  });
  map.set(key, row);
}

function loadPredictionRows() {
  const map = new Map();
  const deep = readJson("two-digit-deep-research-output.json");
  for (const row of deep.rows || []) {
    for (const prediction of row.finalTest?.predictions || []) {
      addPrediction(map, `deep:${row.finalFamily}`, row.market, row.side, prediction);
    }
    for (const prediction of row.baselineTest?.predictions || []) {
      addPrediction(map, "baseline", row.market, row.side, prediction);
    }
  }

  const meta = readJson("two-digit-meta-formula-search-output.json");
  for (const row of meta.rows || []) {
    for (const prediction of row.test?.predictions || []) {
      addPrediction(map, "meta_formula", row.market, row.side, prediction);
    }
  }

  const context = readJson("two-digit-context-learner-output.json");
  for (const row of context.rows || []) {
    for (const prediction of row.test?.predictions || []) {
      addPrediction(map, "context_learner", row.market, row.side, prediction);
    }
  }

  const supervised = readJson("two_digit_supervised_ranker_output.json");
  for (const row of supervised.rows || []) {
    for (const prediction of row.predictions || []) {
      addPrediction(map, "supervised_ridge", row.market, row.side, prediction);
    }
  }

  return [...map.values()].filter((row) => row.votes.length >= 2);
}

function resultForPair(row, pair) {
  const matching = row.votes.find((vote) => vote.pair === pair);
  if (matching) return { hit: matching.hit, absentDigits: matching.absentDigits };
  return null;
}

function summarize(calls) {
  const total = calls.length;
  const correct = calls.filter((call) => call.hit).length;
  const digitCorrect = calls.reduce((sum, call) => sum + call.absentDigits, 0);
  return {
    correct,
    digitCorrect,
    total,
    accuracy: total ? correct / total : 0,
    avgCorrectDigits: total ? digitCorrect / total : 0,
  };
}

function chooseCall(row, config) {
  const counts = new Map();
  for (const vote of row.votes) {
    const stat = counts.get(vote.pair) || { pair: vote.pair, count: 0, families: [] };
    stat.count += 1;
    stat.families.push(vote.family);
    counts.set(vote.pair, stat);
  }
  const exact = [...counts.values()].sort((a, b) => b.count - a.count || a.pair.localeCompare(b.pair))[0];
  if (exact && exact.count >= config.minExactVotes) {
    const result = resultForPair(row, exact.pair);
    if (result) return { ...result, pair: exact.pair, mode: "exact", voteCount: exact.count, families: exact.families };
  }

  if (!config.allowOverlap) return null;
  const digitVotes = new Map();
  for (const vote of row.votes) {
    for (const digit of pairDigits(vote.pair)) {
      const stat = digitVotes.get(digit) || { digit, count: 0 };
      stat.count += 1;
      digitVotes.set(digit, stat);
    }
  }
  const topDigits = [...digitVotes.values()]
    .filter((item) => item.count >= config.minDigitVotes)
    .sort((a, b) => b.count - a.count || a.digit - b.digit)
    .slice(0, 2)
    .map((item) => item.digit);
  const pair = pairKeyFromDigits(topDigits);
  if (!pair) return null;
  const result = resultForPair(row, pair);
  if (!result) return null;
  return { ...result, pair, mode: "overlap", voteCount: topDigits.length, families: row.votes.map((vote) => vote.family) };
}

function run() {
  const rows = loadPredictionRows();
  const configs = [];
  for (const minExactVotes of [2, 3, 4, 5]) {
    for (const allowOverlap of [false, true]) {
      for (const minDigitVotes of [2, 3, 4]) {
        configs.push({ minExactVotes, allowOverlap, minDigitVotes });
      }
    }
  }

  const configResults = [];
  for (const config of configs) {
    const calls = [];
    for (const row of rows) {
      const call = chooseCall(row, config);
      if (call) calls.push({ market: row.market, side: row.side, date: row.date, ...call });
    }
    configResults.push({ config, summary: summarize(calls), calls });
  }

  const bestMin30 = configResults
    .filter((item) => item.summary.total >= 30)
    .sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const bestMin60 = configResults
    .filter((item) => item.summary.total >= 60)
    .sort((a, b) => b.summary.accuracy - a.summary.accuracy || b.summary.total - a.summary.total)[0] || null;
  const viable80 = configResults.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.8);
  const viable85 = configResults.filter((item) => item.summary.total >= 30 && item.summary.accuracy >= 0.85);

  const output = {
    generatedAt: new Date().toISOString(),
    alignedRows: rows.length,
    configsTested: configs.length,
    viable80Count: viable80.length,
    viable85Count: viable85.length,
    bestMin30: bestMin30 ? { config: bestMin30.config, summary: bestMin30.summary } : null,
    bestMin60: bestMin60 ? { config: bestMin60.config, summary: bestMin60.summary } : null,
    configResults: configResults.map((item) => ({ config: item.config, summary: item.summary })),
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-agent-arbitration-gate-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Agent Arbitration Gate");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Aligned prediction rows: ${output.alignedRows}`);
  lines.push(`Gate configs tested: ${output.configsTested}`);
  lines.push(`Viable >=80% configs with >=30 calls: ${output.viable80Count}`);
  lines.push(`Viable >=85% configs with >=30 calls: ${output.viable85Count}`);
  lines.push("");
  lines.push("## Best Gates");
  lines.push("");
  lines.push("| Gate | Calls | Strict Accuracy | Avg Digits |");
  lines.push("|---|---:|---:|---:|");
  for (const [name, item] of [
    ["Best min 30 calls", output.bestMin30],
    ["Best min 60 calls", output.bestMin60],
  ]) {
    if (!item) {
      lines.push(`| ${name} | n/a | n/a | n/a |`);
    } else {
      const c = item.config;
      lines.push(`| ${name}: exact>=${c.minExactVotes}, overlap=${c.allowOverlap}, digit>=${c.minDigitVotes} | ${item.summary.total} | ${pct(item.summary.accuracy)} (${item.summary.correct}/${item.summary.total}) | ${item.summary.avgCorrectDigits.toFixed(2)} |`);
    }
  }
  lines.push("");
  lines.push("## AI-Agent Interpretation");
  lines.push("");
  lines.push("- This simulates the practical role of an LLM/agent: compare independent model families, require agreement, and abstain when evidence conflicts.");
  lines.push("- The agent does not invent digits. It arbitrates model evidence and enforces a call/no-call threshold.");
  lines.push("- If agreement gates cannot clear 80%, then adding an LLM as a direct predictor is unlikely to safely beat numeric models; its best role remains audit and risk control.");
  fs.writeFileSync(path.join(__dirname, "two-digit-agent-arbitration-gate.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) run();
