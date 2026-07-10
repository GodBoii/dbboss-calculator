/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const {
  MARKETS,
  dated,
  panelFor,
  maskFor,
  pct,
} = require("./two-digit-deep-research-runner.cjs");

function pairMask(pair) {
  let mask = 0;
  for (const digit of String(pair || "").match(/\d/g) || []) mask |= 1 << Number(digit);
  return mask;
}

function scorePair(pair, panel) {
  const avoidMask = pairMask(pair);
  const actualMask = maskFor(panel);
  let absentDigits = 0;
  for (const digit of String(pair || "").match(/\d/g) || []) {
    if ((actualMask & (1 << Number(digit))) === 0) absentDigits++;
  }
  return {
    absentDigits,
    strictHit: (actualMask & avoidMask) === 0,
  };
}

function main() {
  const registerPath = path.join(__dirname, "two-digit-forward-register.json");
  if (!fs.existsSync(registerPath)) {
    throw new Error("Missing scratch/two-digit-forward-register.json. Run two-digit-forward-register.cjs first.");
  }
  const register = JSON.parse(fs.readFileSync(registerPath, "utf8"));
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));

  const scoredRows = [];
  for (const row of register.rows || []) {
    if (row.status !== "CALL") {
      scoredRows.push({ ...row, scoreStatus: "ABSTAINED" });
      continue;
    }
    const marketRows = rowsByMarket[row.market] || [];
    const actual = marketRows.find((item) => item.isoDate === row.targetDate);
    if (!actual) {
      scoredRows.push({ ...row, scoreStatus: "PENDING_RESULT" });
      continue;
    }
    const actualPanel = panelFor(actual, row.side);
    if (!actualPanel) {
      scoredRows.push({ ...row, scoreStatus: "PENDING_PANEL", actualPanel: actualPanel || null });
      continue;
    }
    const score = scorePair(row.avoidPair, actualPanel);
    scoredRows.push({
      ...row,
      scoreStatus: "SCORED",
      actualPanel,
      strictHit: score.strictHit,
      absentDigits: score.absentDigits,
    });
  }

  const scoredCalls = scoredRows.filter((row) => row.scoreStatus === "SCORED");
  const pendingCalls = scoredRows.filter((row) => row.scoreStatus === "PENDING_RESULT" || row.scoreStatus === "PENDING_PANEL");
  const correct = scoredCalls.filter((row) => row.strictHit).length;
  const digitCorrect = scoredCalls.reduce((sum, row) => sum + row.absentDigits, 0);
  const output = {
    generatedAt: new Date().toISOString(),
    registerGeneratedAt: register.generatedAt,
    calls: (register.rows || []).filter((row) => row.status === "CALL").length,
    abstentions: scoredRows.filter((row) => row.scoreStatus === "ABSTAINED").length,
    scored: scoredCalls.length,
    pending: pendingCalls.length,
    strictCorrect: correct,
    strictAccuracy: scoredCalls.length ? correct / scoredCalls.length : null,
    avgCorrectDigits: scoredCalls.length ? digitCorrect / scoredCalls.length : null,
    rows: scoredRows,
  };

  fs.writeFileSync(path.join(__dirname, "two-digit-forward-score-output.json"), JSON.stringify(output, null, 2));
  const lines = [];
  lines.push("# Two-Digit Forward Score");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Register generated: ${output.registerGeneratedAt}`);
  lines.push(`Calls: ${output.calls}`);
  lines.push(`Scored calls: ${output.scored}`);
  lines.push(`Pending calls: ${output.pending}`);
  lines.push(`Abstentions: ${output.abstentions}`);
  lines.push(`Strict accuracy: ${output.strictAccuracy == null ? "n/a" : `${pct(output.strictAccuracy)} (${output.strictCorrect}/${output.scored})`}`);
  lines.push(`Average correctly eliminated digits: ${output.avgCorrectDigits == null ? "n/a" : `${output.avgCorrectDigits.toFixed(2)} / 2`}`);
  lines.push("");
  lines.push("| Market | Side | Target Date | Status | Avoid Pair | Actual Panel | Result |");
  lines.push("|---|---|---|---|---:|---:|---|");
  for (const row of scoredRows) {
    const result = row.scoreStatus === "SCORED" ? (row.strictHit ? "CORRECT" : `WRONG (${row.absentDigits}/2)`) : row.scoreStatus;
    lines.push(`| ${row.market} | ${row.side} | ${row.targetDate || "-"} | ${row.status} | ${row.avoidPair || "-"} | ${row.actualPanel || "-"} | ${result} |`);
  }
  lines.push("");
  lines.push("## Scoring Rule");
  lines.push("");
  lines.push("- Only rows marked CALL are predictions.");
  lines.push("- NO_SAFE_CALL rows are abstentions.");
  lines.push("- A CALL is correct only when both avoid digits are absent from the actual panel.");
  fs.writeFileSync(path.join(__dirname, "two-digit-forward-score.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main();
