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

function trainContextModel(rows, side, start, end, mode, minSupport, shrink) {
  const globalStats = PAIRS.map((pair) => ({ pair, n: 0, ok: 0 }));
  const buckets = new Map();
  for (let index = start; index < end; index++) {
    const key = contextValue(rows, side, index, mode);
    if (!buckets.has(key)) buckets.set(key, PAIRS.map((pair) => ({ pair, n: 0, ok: 0 })));
    const contextStats = buckets.get(key);
    const mask = maskFor(panelFor(rows[index], side));
    for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) {
      const ok = isAbsentPair(PAIRS[pairIndex], mask) ? 1 : 0;
      globalStats[pairIndex].n++;
      globalStats[pairIndex].ok += ok;
      contextStats[pairIndex].n++;
      contextStats[pairIndex].ok += ok;
    }
  }
  const globalBest = globalStats
    .map((stat) => ({ ...stat, rate: stat.ok / Math.max(1, stat.n) }))
    .sort((a, b) => b.rate - a.rate || b.n - a.n)[0];
  const byContext = new Map();
  for (const [key, stats] of buckets.entries()) {
    const best = stats
      .filter((stat) => stat.n >= minSupport)
      .map((stat) => ({
        ...stat,
        rate: (stat.ok + shrink * globalBest.rate) / (stat.n + shrink),
        rawRate: stat.ok / Math.max(1, stat.n),
      }))
      .sort((a, b) => b.rate - a.rate || b.n - a.n)[0];
    if (best) byContext.set(key, best);
  }
  return { mode, minSupport, shrink, globalPair: globalBest.pair, byContext };
}

function evalContextModel(rows, side, start, end, model) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  const predictions = [];
  for (let index = start; index < end; index++) {
    const key = contextValue(rows, side, index, model.mode);
    const picked = model.byContext.get(key)?.pair || model.globalPair;
    const actualMask = maskFor(panelFor(rows[index], side));
    const hit = isAbsentPair(picked, actualMask);
    const absentDigits = absentDigitCount(picked, actualMask);
    correct += hit ? 1 : 0;
    digitCorrect += absentDigits;
    total++;
    predictions.push({ date: rows[index].isoDate, context: key, pair: picked.key, hit, absentDigits, usedGlobalFallback: !model.byContext.has(key) });
  }
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0, predictions };
}

function runLatestContextLearner() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const modes = [
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
      const testEnd = marketRows.length;
      const testStart = testEnd - 30;
      const valEnd = testStart;
      const valStart = valEnd - 90;
      if (valStart < 180) continue;
      let best = null;
      for (const trainLookback of [180, 240, 365, 500]) {
        const trainStart = Math.max(0, valStart - trainLookback);
        if (valStart - trainStart < 120) continue;
        for (const mode of modes) {
          for (const minSupport of [3, 5, 8, 12]) {
            for (const shrink of [0, 2, 5, 10, 20]) {
              const model = trainContextModel(marketRows, side, trainStart, valStart, mode, minSupport, shrink);
              const val = evalContextModel(marketRows, side, valStart, valEnd, model);
              const score = val.accuracy * 1000 + val.avgCorrectDigits * 10 - Math.max(0, 0.55 - val.accuracy) * 300;
              if (!best || score > best.score) best = { trainLookback, model, val, score };
            }
          }
        }
      }
      const test = evalContextModel(marketRows, side, testStart, testEnd, best.model);
      rows.push({
        market,
        side,
        trainLookback: best.trainLookback,
        mode: best.model.mode,
        minSupport: best.model.minSupport,
        shrink: best.model.shrink,
        val: best.val,
        test,
      });
    }
  }
  const correct = rows.reduce((sum, row) => sum + row.test.correct, 0);
  const total = rows.reduce((sum, row) => sum + row.test.total, 0);
  const digitCorrect = rows.reduce((sum, row) => sum + row.test.digitCorrect, 0);
  const output = {
    generatedAt: new Date().toISOString(),
    aggregate: {
      correct,
      total,
      accuracy: total ? correct / total : 0,
      avgCorrectDigits: total ? digitCorrect / total : 0,
      marketSidesAt70: rows.filter((row) => row.test.accuracy >= 0.7).length,
      marketSidesAt80: rows.filter((row) => row.test.accuracy >= 0.8).length,
    },
    rows,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-context-learner-output.json"), JSON.stringify(output, null, 2));
  const lines = [];
  lines.push("# Two-Digit Walk-Forward Context Learner");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Strict accuracy: ${pct(output.aggregate.accuracy)} (${correct}/${total})`);
  lines.push(`Average correctly eliminated digits: ${output.aggregate.avgCorrectDigits.toFixed(2)} / 2`);
  lines.push(`Market-sides >=70%: ${output.aggregate.marketSidesAt70}/${rows.length}`);
  lines.push(`Market-sides >=80%: ${output.aggregate.marketSidesAt80}/${rows.length}`);
  lines.push("");
  lines.push("| Market | Side | Context | Val | Test | Avg Digits |");
  lines.push("|---|---|---|---:|---:|---:|");
  for (const row of rows) {
    lines.push(`| ${row.market} | ${row.side} | ${row.mode}; train=${row.trainLookback}; support=${row.minSupport}; shrink=${row.shrink} | ${pct(row.val.accuracy)} (${row.val.correct}/${row.val.total}) | ${pct(row.test.accuracy)} (${row.test.correct}/${row.test.total}) | ${row.test.avgCorrectDigits.toFixed(2)} |`);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This is deployable in structure: context-pair tables are learned from history before the latest 30 test window.");
  lines.push("- It tests whether the high context-oracle ceiling can be captured without looking at the test results.");
  lines.push("- If validation is high but test falls, the context was fitting unstable history rather than a durable pattern.");
  fs.writeFileSync(path.join(__dirname, "two-digit-context-learner.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

module.exports = {
  contextValue,
  trainContextModel,
  evalContextModel,
  runLatestContextLearner,
};

if (require.main === module) {
  runLatestContextLearner();
}
