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

function panelKind(mask) {
  let count = 0;
  for (let digit = 0; digit <= 9; digit++) if (mask & (1 << digit)) count++;
  if (count === 1) return "TP";
  if (count === 2) return "DP";
  return "SP";
}

function suttaFor(row, side) {
  return side === "open" ? row.record.openSutta : row.record.closeSutta;
}

function panelSum(row, side) {
  return String(panelFor(row, side) || "")
    .split("")
    .reduce((sum, digit) => sum + Number(digit || 0), 0);
}

function houseShape(row, side) {
  return String(panelFor(row, side) || "")
    .split("")
    .map((digit) => (Number(digit) <= 4 ? "L" : "H"))
    .join("");
}

function contextValue(rows, side, index, mode) {
  const row = rows[index];
  const prev = rows[index - 1] || null;
  const oppositeSide = side === "open" ? "close" : "open";
  if (mode === "global") return "all";
  if (mode === "weekday") return row.record.day;
  if (mode === "dom_bucket") return row.date.getUTCDate() <= 10 ? "early" : row.date.getUTCDate() <= 20 ? "mid" : "late";
  if (mode === "dom_mod3") return String(row.date.getUTCDate() % 3);
  if (mode === "month") return String(row.date.getUTCMonth() + 1);
  if (!prev) return "none";
  if (mode === "prev_sutta") return String(suttaFor(prev, side));
  if (mode === "prev_opp_sutta") return String(suttaFor(prev, oppositeSide));
  if (mode === "prev_kind") return panelKind(maskFor(panelFor(prev, side)));
  if (mode === "prev_opp_kind") return panelKind(maskFor(panelFor(prev, oppositeSide)));
  if (mode === "prev_sum_bucket") return String(Math.floor(panelSum(prev, side) / 7));
  if (mode === "prev_root") return String(panelSum(prev, side) % 10);
  if (mode === "prev_house_shape") return houseShape(prev, side);
  if (mode === "prev_opp_house_shape") return houseShape(prev, oppositeSide);
  return "all";
}

function bestPairForRows(items, side) {
  return PAIRS.map((pair) => {
    const correct = items.filter((item) => isAbsentPair(pair, maskFor(panelFor(item.row, side)))).length;
    return { pair, correct, total: items.length, accuracy: items.length ? correct / items.length : 0 };
  }).sort((a, b) => b.correct - a.correct || a.pair.key.localeCompare(b.pair.key))[0];
}

function evaluateOracle(rows, side, mode, minContextSupport) {
  const testItems = rows.slice(-30).map((row, offset) => ({ row, index: rows.length - 30 + offset }));
  const groups = new Map();
  for (const item of testItems) {
    const key = contextValue(rows, side, item.index, mode);
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  let correct = 0;
  let total = 0;
  const contexts = [];
  const globalBest = bestPairForRows(testItems, side);
  for (const [key, group] of groups.entries()) {
    const best = group.length >= minContextSupport ? bestPairForRows(group, side) : globalBest;
    correct += best.correct;
    total += best.total;
    contexts.push({
      key,
      n: group.length,
      pair: best.pair.key,
      correct: best.correct,
      accuracy: best.accuracy,
      usedGlobalFallback: group.length < minContextSupport,
    });
  }
  return { mode, minContextSupport, correct, total, accuracy: total ? correct / total : 0, contexts };
}

function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const modes = [
    "global",
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
  const rows = [];
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const marketRows = rowsByMarket[market];
      const candidates = [];
      for (const mode of modes) {
        for (const minSupport of [1, 2, 3, 4, 5]) {
          candidates.push(evaluateOracle(marketRows, side, mode, minSupport));
        }
      }
      candidates.sort((a, b) => b.accuracy - a.accuracy || a.contexts.length - b.contexts.length);
      const supported = candidates.filter((candidate) => candidate.minContextSupport >= 4);
      rows.push({ market, side, best: candidates[0], bestSupported: supported[0], top5: candidates.slice(0, 5) });
    }
  }
  const avg = rows.reduce((sum, row) => sum + row.best.accuracy, 0) / rows.length;
  const supportedAvg = rows.reduce((sum, row) => sum + row.bestSupported.accuracy, 0) / rows.length;
  const at80 = rows.filter((row) => row.best.accuracy >= 0.8).length;
  const supportedAt80 = rows.filter((row) => row.bestSupported.accuracy >= 0.8).length;
  const output = {
    generatedAt: new Date().toISOString(),
    avgBestContextOracleAccuracy: avg,
    avgBestSupportedContextOracleAccuracy: supportedAvg,
    marketSidesAt80: at80,
    supportedMarketSidesAt80: supportedAt80,
    rows,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-context-oracle-upper-bound-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Context Oracle Upper Bound");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Average best context-oracle strict accuracy: ${pct(avg)}`);
  lines.push(`Market-sides where context oracle reaches >=80%: ${at80}/${rows.length}`);
  lines.push(`Average supported-context oracle strict accuracy: ${pct(supportedAvg)}`);
  lines.push(`Market-sides where supported-context oracle reaches >=80%: ${supportedAt80}/${rows.length}`);
  lines.push("");
  lines.push("| Market | Side | Best Context | Strict Accuracy |");
  lines.push("|---|---|---|---:|");
  for (const row of rows) {
    lines.push(`| ${row.market} | ${row.side} | ${row.best.mode}, min n=${row.best.minContextSupport} | ${pct(row.best.accuracy)} (${row.best.correct}/${row.best.total}) |`);
  }
  lines.push("");
  lines.push("## Supported Context Oracle");
  lines.push("");
  lines.push("| Market | Side | Best Supported Context | Strict Accuracy |");
  lines.push("|---|---|---|---:|");
  for (const row of rows) {
    lines.push(`| ${row.market} | ${row.side} | ${row.bestSupported.mode}, min n=${row.bestSupported.minContextSupport} | ${pct(row.bestSupported.accuracy)} (${row.bestSupported.correct}/${row.bestSupported.total}) |`);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This oracle is not deployable because it chooses the best pair after seeing the latest 30 results inside each context.");
  lines.push("- It estimates whether simple context families had enough structure to support an 80% target in hindsight.");
  lines.push("- Strong oracle results still need walk-forward validation; weak oracle results mean that context family is unlikely to support the target.");
  fs.writeFileSync(path.join(__dirname, "two-digit-context-oracle-upper-bound.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main();
