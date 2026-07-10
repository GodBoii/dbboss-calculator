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

function voteSnapshot(models, ctx, familyWeights = null) {
  const votes = Array(PAIRS.length).fill(0);
  const families = Array.from({ length: PAIRS.length }, () => new Set());
  let totalVotes = 0;
  for (const model of models) {
    const pair = model.pick(ctx);
    if (!pair) continue;
    const pairIndex = PAIRS.findIndex((item) => item.key === pair.key);
    if (pairIndex < 0) continue;
    const weight = familyWeights?.[model.family] ?? 1;
    votes[pairIndex] += weight;
    families[pairIndex].add(model.family);
    totalVotes += weight;
  }
  const ranked = votes
    .map((score, pairIndex) => ({
      pairIndex,
      score,
      share: totalVotes ? score / totalVotes : 0,
      families: families[pairIndex].size,
    }))
    .sort((a, b) => b.score - a.score || b.families - a.families);
  const top = ranked[0];
  const second = ranked[1] || { score: 0 };
  return { top, second, totalVotes };
}

function votePredictionFromSnapshot(snapshot, config) {
  const top = snapshot.top;
  const second = snapshot.second || { score: 0 };
  if (!top || top.score < config.minVotes) return null;
  if (top.share < config.minShare) return null;
  if (top.score - second.score < config.minMargin) return null;
  if (top.families < config.minFamilies) return null;
  return { pair: PAIRS[top.pairIndex], score: top.score, share: top.share, margin: top.score - second.score, families: top.families };
}

function buildSnapshots(models, ctxRows, start, end, familyWeights) {
  const rows = [];
  for (let index = start; index < end; index++) {
    const row = ctxRows.rows[index];
    rows.push({
      index,
      isoDate: row.isoDate,
      actualMask: maskFor(panelFor(row, ctxRows.side)),
      snapshot: voteSnapshot(models, { ...ctxRows, index, iso: row.isoDate }, familyWeights),
    });
  }
  return rows;
}

function evalConsensusRows(snapshotRows, config) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  const predictions = [];
  for (const row of snapshotRows) {
    const pred = votePredictionFromSnapshot(row.snapshot, config);
    if (!pred) continue;
    const hit = isAbsentPair(pred.pair, row.actualMask);
    const absentDigits = absentDigitCount(pred.pair, row.actualMask);
    correct += hit ? 1 : 0;
    digitCorrect += absentDigits;
    total++;
    predictions.push({
      date: row.isoDate,
      pair: pred.pair.key,
      hit,
      absentDigits,
      voteScore: pred.score,
      voteShare: pred.share,
      margin: pred.margin,
      families: pred.families,
    });
  }
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0, predictions };
}

function makeConfigs() {
  const configs = [];
  const weightSets = [
    { label: "flat", weights: null },
    { label: "absence-context", weights: { "pair-absence": 1.2, "cross-market": 1.2, "sutta-context": 1.1, baseline: 0.7 } },
    { label: "momentum-gap", weights: { "frequency-hot-fade": 1.2, "momentum-reversal": 1.2, "gap-cycle": 1.1, baseline: 0.7 } },
  ];
  for (const weightSet of weightSets) {
    for (const minVotes of [8, 10, 12, 14, 16, 18, 22]) {
      for (const minShare of [0.1, 0.12, 0.15, 0.18, 0.22]) {
        for (const minMargin of [1, 2, 3, 5, 8]) {
          for (const minFamilies of [2, 3, 4, 5]) {
            configs.push({ weightLabel: weightSet.label, familyWeights: weightSet.weights, minVotes, minShare, minMargin, minFamilies });
          }
        }
      }
    }
  }
  return configs;
}

function configLabel(config) {
  const weights = config.weightLabel;
  return `${weights}; votes>=${config.minVotes}; share>=${Math.round(config.minShare * 100)}%; margin>=${config.minMargin}; families>=${config.minFamilies}`;
}

function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const models = makeModelCatalog();
  const configs = makeConfigs();
  const selected = [];
  const diagnostics = [];

  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const rows = rowsByMarket[market];
      const testEnd = rows.length;
      const testStart = Math.max(0, testEnd - 30);
      const valEnd = testStart;
      const valStart = Math.max(180, valEnd - 90);
      if (valEnd <= valStart || testEnd <= testStart) continue;
      const ctxRows = { market, side, rows, rowsByMarket };
      const snapshotsByWeight = new Map();
      let best = null;
      for (const config of configs) {
        if (!snapshotsByWeight.has(config.weightLabel)) {
          snapshotsByWeight.set(config.weightLabel, {
            val: buildSnapshots(models, ctxRows, valStart, valEnd, config.familyWeights),
            test: buildSnapshots(models, ctxRows, testStart, testEnd, config.familyWeights),
          });
        }
        const val = evalConsensusRows(snapshotsByWeight.get(config.weightLabel).val, config);
        if (val.total < 5) continue;
        const score = val.accuracy * 1000 + Math.min(val.total, 30) - Math.max(0, 12 - val.total) * 8;
        if (!best || score > best.score) best = { config, val, score };
      }
      if (!best) continue;
      const test = evalConsensusRows(snapshotsByWeight.get(best.config.weightLabel).test, best.config);
      const row = {
        market,
        side,
        config: best.config,
        val: best.val,
        test,
        testWindow: `${rows[testStart].isoDate}..${rows[testEnd - 1].isoDate}`,
      };
      diagnostics.push(row);
      if (best.val.accuracy >= 0.8 && best.val.total >= 8) selected.push(row);
    }
  }

  const total = selected.reduce((sum, row) => sum + row.test.total, 0);
  const correct = selected.reduce((sum, row) => sum + row.test.correct, 0);
  const digitCorrect = selected.reduce((sum, row) => sum + row.test.digitCorrect, 0);
  const output = {
    generatedAt: new Date().toISOString(),
    models: models.length,
    configs: configs.length,
    marketSides: diagnostics.length,
    selectedCount: selected.length,
    aggregate: {
      correct,
      total,
      accuracy: total ? correct / total : 0,
      avgCorrectDigits: total ? digitCorrect / total : 0,
      selectedAt80: selected.filter((row) => row.test.total && row.test.accuracy >= 0.8).length,
    },
    selected,
    diagnostics: diagnostics.sort((a, b) => b.val.accuracy - a.val.accuracy || b.val.total - a.val.total),
  };

  fs.writeFileSync(path.join(__dirname, "two-digit-consensus-safe-call-output.json"), JSON.stringify(output, null, 2));
  const lines = [];
  lines.push("# Two-Digit Consensus Safe-Call Backtest");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Base models voted: ${models.length}`);
  lines.push(`Consensus configs tested: ${configs.length}`);
  lines.push(`Market-sides evaluated: ${diagnostics.length}`);
  lines.push("");
  lines.push("## 80% Validation-Gated Calls");
  lines.push("");
  lines.push(`- Selected market-sides: ${selected.length}`);
  lines.push(`- Strict test accuracy: ${total ? pct(correct / total) : "n/a"} (${correct}/${total})`);
  lines.push(`- Average correctly eliminated digits: ${total ? (digitCorrect / total).toFixed(2) : "n/a"} / 2`);
  lines.push(`- Selected market-sides with >=80% strict test: ${output.aggregate.selectedAt80}/${selected.length}`);
  lines.push("");
  lines.push("| Market | Side | Test Window | Validation | Test | Coverage | Config |");
  lines.push("|---|---|---|---:|---:|---:|---|");
  for (const row of selected) {
    lines.push(`| ${row.market} | ${row.side} | ${row.testWindow} | ${pct(row.val.accuracy)} (${row.val.correct}/${row.val.total}) | ${row.test.total ? pct(row.test.accuracy) : "n/a"} (${row.test.correct}/${row.test.total}) | ${row.test.total}/30 | ${configLabel(row.config)} |`);
  }
  lines.push("");
  lines.push("## Best Validation Diagnostics");
  lines.push("");
  lines.push("| Market | Side | Validation | Test | Coverage | Config |");
  lines.push("|---|---|---:|---:|---:|---|");
  for (const row of output.diagnostics.slice(0, 30)) {
    lines.push(`| ${row.market} | ${row.side} | ${pct(row.val.accuracy)} (${row.val.correct}/${row.val.total}) | ${row.test.total ? pct(row.test.accuracy) : "n/a"} (${row.test.correct}/${row.test.total}) | ${row.test.total}/30 | ${configLabel(row.config)} |`);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This test allows abstention. It only issues a pair when the 134-model catalog has enough consensus.");
  lines.push("- A result above 80% here is not full-market coverage; it is a candidate for a no-safe-call production gate.");
  lines.push("- Any selected pocket still needs fresh forward monitoring before real betting use.");
  fs.writeFileSync(path.join(__dirname, "two-digit-consensus-safe-call.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main();
