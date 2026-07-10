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
const {
  trainContextModel,
  evalContextModel,
} = require("./two-digit-context-learner.cjs");

const MODES = [
  "weekday",
  "dom_bucket",
  "dom_mod3",
  "month",
  "prev_sutta",
  "prev_opp_sutta",
  "prev_kind",
  "prev_opp_kind",
  "prev_sum_bucket",
  "prev_root",
  "prev_house_shape",
  "prev_opp_house_shape",
];

function voteSnapshot(models, ctx) {
  const votes = Array(PAIRS.length).fill(0);
  const families = Array.from({ length: PAIRS.length }, () => new Set());
  let totalVotes = 0;
  for (const model of models) {
    const pair = model.pick(ctx);
    if (!pair) continue;
    const pairIndex = PAIRS.findIndex((item) => item.key === pair.key);
    if (pairIndex < 0) continue;
    votes[pairIndex]++;
    totalVotes++;
    families[pairIndex].add(model.family);
  }
  const ranked = votes
    .map((score, pairIndex) => ({
      pair: PAIRS[pairIndex],
      score,
      share: totalVotes ? score / totalVotes : 0,
      families: families[pairIndex].size,
    }))
    .sort((a, b) => b.score - a.score || b.families - a.families || a.pair.key.localeCompare(b.pair.key));
  return { ranked, totalVotes };
}

function evalConsensusConfig(models, rows, side, start, end, config) {
  let correct = 0;
  let total = 0;
  let digitCorrect = 0;
  const predictions = [];
  for (let index = start; index < end; index++) {
    const snapshot = voteSnapshot(models, { rows, side, index, iso: rows[index].isoDate, market: rows[index].record.market, rowsByMarket: {} });
    const top = snapshot.ranked[0];
    const second = snapshot.ranked[1] || { score: 0 };
    if (!top || top.score < config.minVotes || top.share < config.minShare || top.families < config.minFamilies || top.score - second.score < config.minMargin) continue;
    const actualMask = maskFor(panelFor(rows[index], side));
    const hit = isAbsentPair(top.pair, actualMask);
    correct += hit ? 1 : 0;
    digitCorrect += absentDigitCount(top.pair, actualMask);
    total++;
    predictions.push({ date: rows[index].isoDate, pair: top.pair.key, hit });
  }
  return { correct, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0, predictions };
}

function selectContext(rows, side, valStart, valEnd) {
  let best = null;
  for (const trainLookback of [180, 240, 365, 500]) {
    const trainStart = Math.max(0, valStart - trainLookback);
    if (valStart - trainStart < 120) continue;
    for (const mode of MODES) {
      for (const minSupport of [3, 5, 8, 12]) {
        for (const shrink of [0, 2, 5, 10, 20]) {
          const model = trainContextModel(rows, side, trainStart, valStart, mode, minSupport, shrink);
          const val = evalContextModel(rows, side, valStart, valEnd, model);
          const score = val.accuracy * 1000 + val.avgCorrectDigits * 10;
          if (!best || score > best.score) best = { model, val, score, trainLookback };
        }
      }
    }
  }
  return best;
}

function pickContextPair(rows, side, model) {
  const syntheticRows = withSyntheticNextRow(rows);
  const nextIndex = rows.length;
  const key = require("./two-digit-context-learner.cjs").contextValue(syntheticRows, side, nextIndex, model.mode);
  const stat = model.byContext.get(key);
  return { pair: stat?.pair || model.globalPair, contextKey: key, usedGlobalFallback: !stat };
}

function nextDayName(day) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const index = days.indexOf(day);
  return days[(index + 1 + days.length) % days.length] || day;
}

function withSyntheticNextRow(rows) {
  const last = rows[rows.length - 1];
  const date = new Date(`${last.isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  const isoDate = date.toISOString().slice(0, 10);
  return rows.concat([{
    ...last,
    isoDate,
    date,
    record: {
      ...last.record,
      day: nextDayName(last.record.day),
      openPanel: "",
      closePanel: "",
      openSutta: -1,
      closeSutta: -1,
      jodi: "",
    },
  }]);
}

function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const researchModels = makeModelCatalog();
  const consensusConfigs = [
    { minVotes: 8, minShare: 0.1, minMargin: 1, minFamilies: 2 },
    { minVotes: 12, minShare: 0.12, minMargin: 2, minFamilies: 3 },
    { minVotes: 16, minShare: 0.15, minMargin: 3, minFamilies: 4 },
  ];
  const rows = [];

  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const marketRows = rowsByMarket[market];
      const syntheticRows = withSyntheticNextRow(marketRows);
      const targetDate = syntheticRows[marketRows.length].isoDate;
      const valEnd = marketRows.length;
      const valStart = Math.max(180, valEnd - 90);
      const context = selectContext(marketRows, side, valStart, valEnd);
      const contextPick = pickContextPair(marketRows, side, context.model);

      let bestConsensus = null;
      for (const config of consensusConfigs) {
        const val = evalConsensusConfig(researchModels, marketRows, side, valStart, valEnd, config);
        const score = val.accuracy * 1000 + val.total;
        if (!bestConsensus || score > bestConsensus.score) bestConsensus = { config, val, score };
      }

      const snapshot = voteSnapshot(researchModels, {
        market,
        side,
        rows: syntheticRows,
        rowsByMarket,
        index: marketRows.length,
        iso: syntheticRows[marketRows.length].isoDate,
      });
      const topVote = snapshot.ranked[0];
      const contextPass = context.val.total >= 60 && context.val.accuracy >= 0.72 && context.val.avgCorrectDigits >= 1.6;
      const consensusPass = bestConsensus.val.total >= 10 && bestConsensus.val.accuracy >= 0.8;
      const agreementPass = topVote && contextPick.pair && topVote.pair.key === contextPick.pair.key;
      const callAllowed = Boolean(contextPass && (consensusPass || agreementPass));
      const finalPair = callAllowed ? contextPick.pair.key : null;
      rows.push({
        market,
        side,
        targetDate,
        status: callAllowed ? "CALL" : "NO_SAFE_CALL",
        avoidPair: finalPair,
        contextModel: {
          mode: context.model.mode,
          minSupport: context.model.minSupport,
          shrink: context.model.shrink,
          trainLookback: context.trainLookback,
          validationAccuracy: context.val.accuracy,
          validationCorrect: context.val.correct,
          validationTotal: context.val.total,
          validationAvgCorrectDigits: context.val.avgCorrectDigits,
          nextContextKey: contextPick.contextKey,
          usedGlobalFallback: contextPick.usedGlobalFallback,
          proposedPair: contextPick.pair.key,
        },
        consensusModel: {
          config: bestConsensus.config,
          validationAccuracy: bestConsensus.val.accuracy,
          validationCorrect: bestConsensus.val.correct,
          validationTotal: bestConsensus.val.total,
          topVotePair: topVote?.pair.key || null,
          topVoteScore: topVote?.score || 0,
          topVoteShare: topVote?.share || 0,
          topVoteFamilies: topVote?.families || 0,
        },
        gates: { contextPass, consensusPass, agreementPass },
      });
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    purpose: "Pre-registered future 2-digit avoid calls. Score this only after future results are known.",
    gate: "CALL only when context validation is strong and either consensus validation is >=80% or consensus agrees with context.",
    calls: rows.filter((row) => row.status === "CALL").length,
    noSafeCalls: rows.filter((row) => row.status !== "CALL").length,
    rows,
  };
  const outPath = path.join(__dirname, "two-digit-forward-register.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Forward Register");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Calls allowed: ${output.calls}`);
  lines.push(`No-safe-call rows: ${output.noSafeCalls}`);
  lines.push("");
  lines.push("| Market | Side | Status | Avoid Pair | Context Val | Consensus Val | Gates |");
  lines.push("|---|---|---|---:|---:|---:|---|");
  for (const row of rows) {
    lines.push(`| ${row.market} | ${row.side} | ${row.status} | ${row.avoidPair || "-"} | ${pct(row.contextModel.validationAccuracy)} (${row.contextModel.validationCorrect}/${row.contextModel.validationTotal}) | ${row.consensusModel.validationTotal ? `${pct(row.consensusModel.validationAccuracy)} (${row.consensusModel.validationCorrect}/${row.consensusModel.validationTotal})` : "n/a"} | context=${row.gates.contextPass}; consensus=${row.gates.consensusPass}; agree=${row.gates.agreementPass} |`);
  }
  lines.push("");
  lines.push("## How To Use");
  lines.push("");
  lines.push("- This file is a pre-registration ledger. Do not edit it after results arrive.");
  lines.push("- When new open/close panels are known, score only rows with status CALL.");
  lines.push("- A call is correct only if both avoid digits are absent from the actual panel.");
  lines.push("- Rows with NO_SAFE_CALL should be treated as abstentions, not wrong predictions.");
  lines.push("");
  lines.push("## Gate Policy Note");
  lines.push("");
  lines.push("- The current gates are intentionally strict because rolling context-gate frontier testing found no >=80% historical forward region.");
  lines.push("- Do not lower the gates just to produce calls; that would increase action while reducing evidence quality.");
  lines.push("- A future CALL should mean the model has stronger validation evidence than any region found so far.");
  fs.writeFileSync(path.join(__dirname, "two-digit-forward-register.md"), lines.join("\n"));
  console.log(lines.join("\n"));
  console.log(`\nWrote ${outPath}`);
}

main();
