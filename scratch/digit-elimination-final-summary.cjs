/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");

const MARKETS = [
  "Sridevi",
  "Time Bazar",
  "Madhur Day",
  "Milan Day",
  "Rajdhani Day",
  "Kalyan",
  "Sridevi Night",
  "Kalyan Night",
  "Madhur Night",
  "Milan Night",
  "Rajdhani Night",
  "Main Bazar",
];
const SIDES = ["open", "close", "jodiClose"];

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function pp(value) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)} pp`;
}

function sideLabel(side) {
  return side === "jodiClose" ? "Known-open close" : side[0].toUpperCase() + side.slice(1);
}

function recommendation(row, livePenalty) {
  const learnedEdgeCurrent = row.learned.accuracy - row.current.accuracy;
  const learnedEdgeRandom = row.learned.accuracy - row.random;
  if (livePenalty) return "Keep current - failed fresh holdout";
  if (learnedEdgeCurrent >= 0.02 && learnedEdgeRandom >= 0.01 && row.learnedWinsCurrent >= row.learnedLossesCurrent + 2) {
    return "Research candidate";
  }
  if (learnedEdgeCurrent >= 0.01 && learnedEdgeRandom >= 0.005 && row.learnedWinsCurrent > row.learnedLossesCurrent) {
    return "Weak candidate";
  }
  if (row.current.accuracy >= row.random + 0.01) return "Keep current";
  return "No strong signal";
}

function confidenceScore(row, rec) {
  if (rec === "Keep current - failed fresh holdout") return 20;
  if (rec === "Keep current") return 35;
  if (rec === "No strong signal") return 20;
  const edgeCurrent = Math.max(0, row.learned.accuracy - row.current.accuracy);
  const edgeRandom = Math.max(0, row.learned.accuracy - row.random);
  const totalFolds = Math.max(1, (row.learnedWinsCurrent ?? 0) + (row.learnedLossesCurrent ?? row.learnedLosesCurrent ?? 0));
  const winRate = (row.learnedWinsCurrent ?? 0) / totalFolds;
  const score = 35 + edgeCurrent * 700 + edgeRandom * 500 + Math.max(0, winRate - 0.5) * 35;
  return Math.max(0, Math.min(95, Math.round(score)));
}

function main() {
  const currentVsLearned = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scratch", "digit-elimination-current-vs-learned-output.json"), "utf8"));
  const pocketDeep = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scratch", "digit-elimination-pocket-deep-output.json"), "utf8"));
  const live = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scratch", "live-holdout-milan-day-output.json"), "utf8"));

  const rowsByKey = new Map();
  for (const row of currentVsLearned.markets) {
    rowsByKey.set(`${row.market}|${row.side}`, {
      ...row,
      source: "4-fold all-market",
      folds: 4,
    });
  }
  for (const row of pocketDeep.results) {
    rowsByKey.set(`${row.market}|${row.side}`, {
      ...row,
      source: "8-fold pocket",
      folds: 8,
    });
  }

  const livePenalty = new Set();
  for (const row of live.results) {
    if (row.learned.accuracy < row.current.accuracy) {
      livePenalty.add(`${live.market}|${row.side}`);
    }
  }

  const rows = [];
  for (const market of MARKETS) {
    for (const side of SIDES) {
      const row = rowsByKey.get(`${market}|${side}`);
      if (!row) continue;
      const rec = recommendation(row, livePenalty.has(`${market}|${side}`));
      const confidence = confidenceScore(row, rec);
      rows.push({
        market,
        side,
        random: row.random,
        current: row.current.accuracy,
        learned: row.learned.accuracy,
        currentAvg: row.current.avgCorrect,
        learnedAvg: row.learned.avgCorrect,
        deltaCurrent: row.learned.accuracy - row.current.accuracy,
        deltaRandom: row.learned.accuracy - row.random,
        wins: row.learnedWinsCurrent,
        losses: row.learnedLossesCurrent ?? row.learnedLosesCurrent ?? 0,
        folds: row.folds,
        source: row.source,
        recommendation: rec,
        confidence,
      });
    }
  }

  const candidates = rows.filter((row) => row.recommendation === "Research candidate");
  const weak = rows.filter((row) => row.recommendation === "Weak candidate");
  const keepCurrent = rows.filter((row) => row.recommendation.startsWith("Keep current"));
  const noSignal = rows.filter((row) => row.recommendation === "No strong signal");

  const lines = [];
  lines.push("# Digit Elimination Final Research Summary");
  lines.push("");
  lines.push("This is a synthesis of scratch-only research artifacts. No app code was changed.");
  lines.push("");
  lines.push("## Decision Rules");
  lines.push("");
  lines.push("- `Research candidate`: learned beats current by at least 2 pp, beats random by at least 1 pp, and fold W/L is clearly positive.");
  lines.push("- `Weak candidate`: learned beats current by at least 1 pp, beats random slightly, and W/L is positive.");
  lines.push("- `Keep current`: current already has the better or safer evidence.");
  lines.push("- `No strong signal`: neither current nor learned has enough edge over random.");
  lines.push("- Fresh Milan Day holdout overrides rolling evidence where learned lost to current.");
  lines.push("");
  lines.push("## Summary Counts");
  lines.push("");
  lines.push(`- Research candidates: ${candidates.length}`);
  lines.push(`- Weak candidates: ${weak.length}`);
  lines.push(`- Keep current: ${keepCurrent.length}`);
  lines.push(`- No strong signal: ${noSignal.length}`);
  lines.push("");
  lines.push("## Research Candidates");
  lines.push("");
  lines.push("| Market | Side | Random | Current | Learned | Delta vs current | W/L | Folds | Source |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const row of candidates.sort((a, b) => b.deltaCurrent - a.deltaCurrent)) {
    lines.push(`| ${row.market} | ${sideLabel(row.side)} | ${pct(row.random)} | ${pct(row.current)} | ${pct(row.learned)} | ${pp(row.deltaCurrent)} | ${row.wins}/${row.losses} | ${row.folds} | ${row.source} |`);
  }
  lines.push("");
  lines.push("## Weak Candidates");
  lines.push("");
  lines.push("| Market | Side | Random | Current | Learned | Delta vs current | W/L | Folds | Source |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const row of weak.sort((a, b) => b.deltaCurrent - a.deltaCurrent)) {
    lines.push(`| ${row.market} | ${sideLabel(row.side)} | ${pct(row.random)} | ${pct(row.current)} | ${pct(row.learned)} | ${pp(row.deltaCurrent)} | ${row.wins}/${row.losses} | ${row.folds} | ${row.source} |`);
  }
  lines.push("");
  lines.push("## Full Market-Side Table");
  lines.push("");
  lines.push("| Market | Side | Random | Current | Learned | Avg current | Avg learned | Delta vs current | W/L | Confidence | Recommendation |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const row of rows) {
    lines.push(`| ${row.market} | ${sideLabel(row.side)} | ${pct(row.random)} | ${pct(row.current)} | ${pct(row.learned)} | ${row.currentAvg.toFixed(2)} | ${row.learnedAvg.toFixed(2)} | ${pp(row.deltaCurrent)} | ${row.wins}/${row.losses} | ${row.confidence}/100 | ${row.recommendation} |`);
  }
  lines.push("");
  lines.push("## Final Recommendation");
  lines.push("");
  lines.push("Do not implement a broad digit-elimination feature yet. The best evidence supports only a few research candidates, and even those sit near 73-75% accuracy, or about 3 correct eliminated digits out of 4. Continue collecting fresh holdout rows before any app integration.");

  const outPath = path.join(process.cwd(), "scratch", "digit-elimination-final-summary.md");
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`);
  console.log(`Output: ${outPath}`);
  console.log(`Research candidates: ${candidates.length}`);
  console.log(candidates.map((row) => `${row.market} ${row.side}: ${pct(row.learned)} (${pp(row.deltaCurrent)})`).join("\n"));
}

main();
