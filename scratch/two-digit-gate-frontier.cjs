/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function summarize(folds) {
  const total = folds.reduce((sum, fold) => sum + fold.test.total, 0);
  const correct = folds.reduce((sum, fold) => sum + fold.test.correct, 0);
  const digitCorrect = folds.reduce((sum, fold) => sum + fold.test.digitCorrect, 0);
  return {
    folds: folds.length,
    total,
    correct,
    accuracy: total ? correct / total : 0,
    avgCorrectDigits: total ? digitCorrect / total : 0,
    at70: folds.filter((fold) => fold.test.accuracy >= 0.7).length,
    at80: folds.filter((fold) => fold.test.accuracy >= 0.8).length,
  };
}

function main() {
  const inputPath = path.join(__dirname, "two-digit-context-learner-rolling-output.json");
  if (!fs.existsSync(inputPath)) {
    throw new Error("Missing two-digit-context-learner-rolling-output.json. Run two-digit-context-learner-rolling.cjs first.");
  }
  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const folds = input.folds || [];
  const rows = [];

  for (const minValAcc of [0.5, 0.55, 0.58, 0.6, 0.62, 0.64, 0.66, 0.68, 0.7]) {
    for (const minValAvgDigits of [1.35, 1.4, 1.45, 1.5, 1.55, 1.6, 1.65]) {
      for (const requireValidationN of [60, 90]) {
        const selected = folds.filter((fold) =>
          fold.val.total >= requireValidationN &&
          fold.val.accuracy >= minValAcc &&
          fold.val.avgCorrectDigits >= minValAvgDigits
        );
        rows.push({
          minValAcc,
          minValAvgDigits,
          requireValidationN,
          ...summarize(selected),
        });
      }
    }
  }

  rows.sort((a, b) =>
    b.accuracy - a.accuracy ||
    b.folds - a.folds ||
    b.avgCorrectDigits - a.avgCorrectDigits
  );

  const viable80 = rows.filter((row) => row.folds >= 3 && row.accuracy >= 0.8);
  const viable70 = rows.filter((row) => row.folds >= 3 && row.accuracy >= 0.7);
  const bestCoverageAt60 = rows
    .filter((row) => row.accuracy >= 0.6)
    .sort((a, b) => b.folds - a.folds || b.accuracy - a.accuracy)[0] || null;

  const output = {
    generatedAt: new Date().toISOString(),
    source: "two-digit-context-learner-rolling-output.json",
    totalFolds: folds.length,
    viable80Count: viable80.length,
    viable70Count: viable70.length,
    bestCoverageAt60,
    rows,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-gate-frontier-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Gate Frontier");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Source folds: ${folds.length}`);
  lines.push(`Gate configs with >=80% strict and >=3 folds: ${viable80.length}`);
  lines.push(`Gate configs with >=70% strict and >=3 folds: ${viable70.length}`);
  if (bestCoverageAt60) {
    lines.push(`Best coverage config at >=60% strict: val>=${pct(bestCoverageAt60.minValAcc)}, avgDigits>=${bestCoverageAt60.minValAvgDigits.toFixed(2)}, n>=${bestCoverageAt60.requireValidationN}: ${pct(bestCoverageAt60.accuracy)} (${bestCoverageAt60.correct}/${bestCoverageAt60.total}), folds=${bestCoverageAt60.folds}`);
  }
  lines.push("");
  lines.push("## Top Gates By Test Accuracy");
  lines.push("");
  lines.push("| Min Val Acc | Min Val Avg Digits | Val N | Folds | Test Accuracy | Avg Digits | >=80 Folds |");
  lines.push("|---:|---:|---:|---:|---:|---:|---:|");
  for (const row of rows.slice(0, 30)) {
    lines.push(`| ${pct(row.minValAcc)} | ${row.minValAvgDigits.toFixed(2)} | ${row.requireValidationN} | ${row.folds} | ${row.total ? `${pct(row.accuracy)} (${row.correct}/${row.total})` : "n/a"} | ${row.total ? row.avgCorrectDigits.toFixed(2) : "n/a"} | ${row.at80}/${row.folds} |`);
  }
  lines.push("");
  lines.push("## 70%+ Regions");
  lines.push("");
  lines.push("| Min Val Acc | Min Val Avg Digits | Val N | Folds | Test Accuracy |");
  lines.push("|---:|---:|---:|---:|---:|");
  for (const row of viable70.slice(0, 20)) {
    lines.push(`| ${pct(row.minValAcc)} | ${row.minValAvgDigits.toFixed(2)} | ${row.requireValidationN} | ${row.folds} | ${pct(row.accuracy)} (${row.correct}/${row.total}) |`);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This sweeps validation gates over already walk-forward context-learner folds.");
  lines.push("- A useful 80% gate should select several folds and maintain >=80% strict accuracy on their unseen test windows.");
  lines.push("- If no 80% region appears, stricter validation alone is not enough for this model family.");
  fs.writeFileSync(path.join(__dirname, "two-digit-gate-frontier.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main();
