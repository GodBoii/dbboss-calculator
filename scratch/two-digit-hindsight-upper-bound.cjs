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
  pct,
} = require("./two-digit-deep-research-runner.cjs");

function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const rows = [];
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const marketRows = rowsByMarket[market];
      const testRows = marketRows.slice(-30);
      const scored = PAIRS.map((pair) => {
        const correct = testRows.filter((row) => isAbsentPair(pair, maskFor(panelFor(row, side)))).length;
        return { pair: pair.key, correct, total: testRows.length, accuracy: correct / testRows.length };
      }).sort((a, b) => b.accuracy - a.accuracy || a.pair.localeCompare(b.pair));
      rows.push({ market, side, best: scored[0], top5: scored.slice(0, 5) });
    }
  }
  const avgBest = rows.reduce((sum, row) => sum + row.best.accuracy, 0) / rows.length;
  const output = {
    generatedAt: new Date().toISOString(),
    avgBestFixedPairAccuracy: avgBest,
    marketSidesAt80: rows.filter((row) => row.best.accuracy >= 0.8).length,
    rows,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-hindsight-upper-bound-output.json"), JSON.stringify(output, null, 2));
  const lines = [];
  lines.push("# Two-Digit Hindsight Upper Bound");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Average best fixed-pair strict accuracy: ${pct(avgBest)}`);
  lines.push(`Market-sides where hindsight fixed pair reaches >=80%: ${output.marketSidesAt80}/${rows.length}`);
  lines.push("");
  lines.push("| Market | Side | Best Fixed Avoid Pair | Hindsight Accuracy |");
  lines.push("|---|---|---:|---:|");
  for (const row of rows) {
    lines.push(`| ${row.market} | ${row.side} | ${row.best.pair} | ${pct(row.best.accuracy)} (${row.best.correct}/${row.best.total}) |`);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This is not a deployable model. It cheats by choosing the best fixed pair after seeing the latest 30 results.");
  lines.push("- If a market-side is below 80% even here, then no fixed-pair avoid strategy could have met the requested target in that window.");
  lines.push("- If a market-side is above 80% here, it only proves a pocket existed in hindsight, not that it was predictable before results.");
  fs.writeFileSync(path.join(__dirname, "two-digit-hindsight-upper-bound.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main();
