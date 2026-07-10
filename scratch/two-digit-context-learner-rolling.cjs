/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const {
  MARKETS,
  dated,
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

function selectContextModel(rows, side, trainStart, valStart, valEnd) {
  let best = null;
  for (const trainLookback of [180, 240, 365, 500]) {
    const start = Math.max(trainStart, valStart - trainLookback);
    if (valStart - start < 120) continue;
    for (const mode of MODES) {
      for (const minSupport of [3, 5, 8, 12]) {
        for (const shrink of [0, 2, 5, 10, 20]) {
          const model = trainContextModel(rows, side, start, valStart, mode, minSupport, shrink);
          const val = evalContextModel(rows, side, valStart, valEnd, model);
          const score = val.accuracy * 1000 + val.avgCorrectDigits * 10 - Math.max(0, 0.55 - val.accuracy) * 300;
          if (!best || score > best.score) best = { trainLookback, model, val, score };
        }
      }
    }
  }
  return best;
}

function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const foldRows = [];
  const marketSummary = new Map();

  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const rows = rowsByMarket[market];
      const foldEnds = [rows.length, rows.length - 30, rows.length - 60, rows.length - 90, rows.length - 120, rows.length - 150].filter((end) => end > 0);
      for (const testEnd of foldEnds) {
        const testStart = testEnd - 30;
        const valEnd = testStart;
        const valStart = valEnd - 90;
        if (testStart < 0 || valStart < 180) continue;
        const selected = selectContextModel(rows, side, 0, valStart, valEnd);
        if (!selected) continue;
        const test = evalContextModel(rows, side, testStart, testEnd, selected.model);
        const fold = {
          market,
          side,
          testWindow: `${rows[testStart].isoDate}..${rows[testEnd - 1].isoDate}`,
          mode: selected.model.mode,
          trainLookback: selected.trainLookback,
          minSupport: selected.model.minSupport,
          shrink: selected.model.shrink,
          val: selected.val,
          test,
        };
        foldRows.push(fold);
        const key = `${market}|${side}`;
        const summary = marketSummary.get(key) || { market, side, folds: 0, correct: 0, total: 0, digitCorrect: 0, at70: 0, at80: 0 };
        summary.folds++;
        summary.correct += test.correct;
        summary.total += test.total;
        summary.digitCorrect += test.digitCorrect;
        if (test.accuracy >= 0.7) summary.at70++;
        if (test.accuracy >= 0.8) summary.at80++;
        marketSummary.set(key, summary);
      }
    }
  }

  const correct = foldRows.reduce((sum, fold) => sum + fold.test.correct, 0);
  const total = foldRows.reduce((sum, fold) => sum + fold.test.total, 0);
  const digitCorrect = foldRows.reduce((sum, fold) => sum + fold.test.digitCorrect, 0);
  const summaries = [...marketSummary.values()].map((summary) => ({
    ...summary,
    accuracy: summary.total ? summary.correct / summary.total : 0,
    avgCorrectDigits: summary.total ? summary.digitCorrect / summary.total : 0,
  })).sort((a, b) => b.accuracy - a.accuracy);

  const output = {
    generatedAt: new Date().toISOString(),
    aggregate: {
      folds: foldRows.length,
      correct,
      total,
      accuracy: total ? correct / total : 0,
      avgCorrectDigits: total ? digitCorrect / total : 0,
      foldsAt70: foldRows.filter((fold) => fold.test.accuracy >= 0.7).length,
      foldsAt80: foldRows.filter((fold) => fold.test.accuracy >= 0.8).length,
    },
    summaries,
    folds: foldRows,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-context-learner-rolling-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Context Learner Rolling Evaluation");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Forward folds: ${output.aggregate.folds}`);
  lines.push(`Aggregate strict accuracy: ${pct(output.aggregate.accuracy)} (${correct}/${total})`);
  lines.push(`Average correctly eliminated digits: ${output.aggregate.avgCorrectDigits.toFixed(2)} / 2`);
  lines.push(`Folds >=70% strict: ${output.aggregate.foldsAt70}/${output.aggregate.folds}`);
  lines.push(`Folds >=80% strict: ${output.aggregate.foldsAt80}/${output.aggregate.folds}`);
  lines.push("");
  lines.push("## Market-Side Stability");
  lines.push("");
  lines.push("| Market | Side | Folds | Strict Accuracy | Avg Digits | >=70 Folds | >=80 Folds |");
  lines.push("|---|---|---:|---:|---:|---:|---:|");
  for (const row of summaries) {
    lines.push(`| ${row.market} | ${row.side} | ${row.folds} | ${pct(row.accuracy)} (${row.correct}/${row.total}) | ${row.avgCorrectDigits.toFixed(2)} | ${row.at70}/${row.folds} | ${row.at80}/${row.folds} |`);
  }
  lines.push("");
  lines.push("## Top Individual Folds");
  lines.push("");
  lines.push("| Market | Side | Window | Context | Validation | Test |");
  lines.push("|---|---|---|---|---:|---:|");
  for (const fold of [...foldRows].sort((a, b) => b.test.accuracy - a.test.accuracy || b.val.accuracy - a.val.accuracy).slice(0, 30)) {
    lines.push(`| ${fold.market} | ${fold.side} | ${fold.testWindow} | ${fold.mode}; train=${fold.trainLookback}; support=${fold.minSupport}; shrink=${fold.shrink} | ${pct(fold.val.accuracy)} (${fold.val.correct}/${fold.val.total}) | ${pct(fold.test.accuracy)} (${fold.test.correct}/${fold.test.total}) |`);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This evaluates the context learner across several historical 30-day forward windows, not only the latest window.");
  lines.push("- A durable 80% model should produce repeated >=80% folds for the same market-side, not isolated hindsight pockets.");
  lines.push("- If high folds are rare and unstable, the context method should remain research-only.");
  fs.writeFileSync(path.join(__dirname, "two-digit-context-learner-rolling.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main();
