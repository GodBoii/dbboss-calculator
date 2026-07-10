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

const DIGITS = Array.from({ length: 10 }, (_, digit) => digit);
const OPPOSITE = { 0: 5, 5: 0, 1: 6, 6: 1, 2: 7, 7: 2, 3: 8, 8: 3, 4: 9, 9: 4 };
const FEATURE_NAMES = [
  "cold_3",
  "cold_7",
  "cold_15",
  "cold_30",
  "cold_90",
  "hot_7",
  "hot_30",
  "pair_abs_7",
  "pair_abs_15",
  "pair_abs_30",
  "pair_abs_90",
  "weekday",
  "dom_mod3",
  "dom_bucket",
  "prev_sutta",
  "prev_kind",
  "prev_root",
  "gap_present",
  "gap_absent",
  "in_prev",
  "in_prev_opp",
  "opp_in_prev",
  "same_house",
  "same_parity",
  "cross_market_30",
];

function suttaFor(row, side) {
  return side === "open" ? row.record.openSutta : row.record.closeSutta;
}

function panelSum(row, side) {
  return String(panelFor(row, side) || "")
    .split("")
    .reduce((sum, digit) => sum + Number(digit || 0), 0);
}

function panelKind(mask) {
  let count = 0;
  for (const digit of DIGITS) if (mask & (1 << digit)) count++;
  if (count === 1) return "TP";
  if (count === 2) return "DP";
  return "SP";
}

function normalize(values) {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return values.map(() => 0);
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (Math.abs(max - min) < 1e-9) return values.map(() => 0);
  return values.map((value) => (Number.isFinite(value) ? (value - min) / (max - min) : 0));
}

function buildFeatureSnapshot(rows, side, index, rowsByMarket, market) {
  const digit = Object.fromEntries(DIGITS.map((d) => [d, {}]));
  const pair = Object.fromEntries(PAIRS.map((p) => [p.key, {}]));
  const prev = rows[index - 1] || null;
  const prevMask = prev ? maskFor(panelFor(prev, side)) : 0;
  const oppositeSide = side === "open" ? "close" : "open";
  const prevOppMask = prev ? maskFor(panelFor(prev, oppositeSide)) : 0;

  for (const lookback of [3, 5, 7, 10, 15, 30, 60, 90, 180, 365]) {
    const start = Math.max(0, index - lookback);
    const n = Math.max(1, index - start);
    const digitHits = Array(10).fill(0);
    const pairAbsences = Object.fromEntries(PAIRS.map((p) => [p.key, 0]));
    for (let i = start; i < index; i++) {
      const mask = maskFor(panelFor(rows[i], side));
      for (const d of DIGITS) if (mask & (1 << d)) digitHits[d]++;
      for (const p of PAIRS) if (isAbsentPair(p, mask)) pairAbsences[p.key]++;
    }
    for (const d of DIGITS) {
      digit[d][`cold_${lookback}`] = 1 - digitHits[d] / n;
      digit[d][`hot_${lookback}`] = digitHits[d] / n;
    }
    for (const p of PAIRS) pair[p.key][`pair_abs_${lookback}`] = pairAbsences[p.key] / n;
  }

  const currentDay = rows[index].record.day;
  const currentDom = rows[index].date.getUTCDate();
  const prevSutta = prev ? suttaFor(prev, side) : null;
  const prevKind = prev ? panelKind(prevMask) : null;
  const prevRoot = prev ? panelSum(prev, side) % 10 : null;

  for (const context of [
    ["weekday", (row) => row.record.day === currentDay, 240, 4],
    ["dom_mod3", (row) => row.date.getUTCDate() % 3 === currentDom % 3, 240, 10],
    ["dom_bucket", (row) => Math.floor((row.date.getUTCDate() - 1) / 10) === Math.floor((currentDom - 1) / 10), 240, 10],
    ["prev_sutta", (_row, i) => i > 0 && suttaFor(rows[i - 1], side) === prevSutta, 365, 5],
    ["prev_kind", (_row, i) => i > 0 && panelKind(maskFor(panelFor(rows[i - 1], side))) === prevKind, 365, 8],
    ["prev_root", (_row, i) => i > 0 && panelSum(rows[i - 1], side) % 10 === prevRoot, 365, 5],
  ]) {
    const [name, predicate, lookback, minSupport] = context;
    const start = Math.max(0, index - lookback);
    let n = 0;
    const pairAbsences = Object.fromEntries(PAIRS.map((p) => [p.key, 0]));
    for (let i = start; i < index; i++) {
      if (!predicate(rows[i], i)) continue;
      n++;
      const mask = maskFor(panelFor(rows[i], side));
      for (const p of PAIRS) if (isAbsentPair(p, mask)) pairAbsences[p.key]++;
    }
    for (const p of PAIRS) pair[p.key][`ctx_${name}`] = n >= minSupport ? pairAbsences[p.key] / n : 0.5;
  }

  for (const d of DIGITS) {
    let presentGap = 180;
    let absentGap = 180;
    for (let gap = 1; gap <= Math.min(180, index); gap++) {
      const mask = maskFor(panelFor(rows[index - gap], side));
      if (presentGap === 180 && (mask & (1 << d))) presentGap = gap;
      if (absentGap === 180 && !(mask & (1 << d))) absentGap = gap;
    }
    digit[d].gap_present = presentGap / 180;
    digit[d].gap_absent = absentGap / 180;
    digit[d].in_prev = prevMask & (1 << d) ? 1 : 0;
    digit[d].in_prev_opp = prevOppMask & (1 << d) ? 1 : 0;
    digit[d].opp_in_prev = prevMask & (1 << OPPOSITE[d]) ? 1 : 0;
    digit[d].low = d <= 4 ? 1 : 0;
    digit[d].odd = d % 2 ? 1 : 0;
  }

  const sourceMarket = {
    "Time Bazar": "Sridevi",
    "Madhur Day": "Time Bazar",
    "Milan Day": "Madhur Day",
    "Rajdhani Day": "Milan Day",
    Kalyan: "Rajdhani Day",
    "Kalyan Night": "Sridevi Night",
    "Madhur Night": "Kalyan Night",
    "Milan Night": "Madhur Night",
    "Rajdhani Night": "Milan Night",
    "Main Bazar": "Rajdhani Night",
  }[market];
  if (sourceMarket && rowsByMarket[sourceMarket]) {
    const sourceRows = rowsByMarket[sourceMarket].filter((row) => row.isoDate < rows[index].isoDate);
    const start = Math.max(0, sourceRows.length - 30);
    const n = Math.max(1, sourceRows.length - start);
    const pairAbsences = Object.fromEntries(PAIRS.map((p) => [p.key, 0]));
    for (let i = start; i < sourceRows.length; i++) {
      const mask = maskFor(panelFor(sourceRows[i], side));
      for (const p of PAIRS) if (isAbsentPair(p, mask)) pairAbsences[p.key]++;
    }
    for (const p of PAIRS) pair[p.key].cross_market_30 = pairAbsences[p.key] / n;
  } else {
    for (const p of PAIRS) pair[p.key].cross_market_30 = 0.5;
  }

  return { digit, pair };
}

function pairVector(snapshot, p) {
  const a = snapshot.digit[p.digits[0]];
  const b = snapshot.digit[p.digits[1]];
  const pair = snapshot.pair[p.key];
  return {
    cold_3: (a.cold_3 + b.cold_3) / 2,
    cold_7: (a.cold_7 + b.cold_7) / 2,
    cold_15: (a.cold_15 + b.cold_15) / 2,
    cold_30: (a.cold_30 + b.cold_30) / 2,
    cold_90: (a.cold_90 + b.cold_90) / 2,
    hot_7: (a.hot_7 + b.hot_7) / 2,
    hot_30: (a.hot_30 + b.hot_30) / 2,
    pair_abs_7: pair.pair_abs_7,
    pair_abs_15: pair.pair_abs_15,
    pair_abs_30: pair.pair_abs_30,
    pair_abs_90: pair.pair_abs_90,
    weekday: pair.ctx_weekday,
    dom_mod3: pair.ctx_dom_mod3,
    dom_bucket: pair.ctx_dom_bucket,
    prev_sutta: pair.ctx_prev_sutta,
    prev_kind: pair.ctx_prev_kind,
    prev_root: pair.ctx_prev_root,
    gap_present: (a.gap_present + b.gap_present) / 2,
    gap_absent: (a.gap_absent + b.gap_absent) / 2,
    in_prev: (a.in_prev + b.in_prev) / 2,
    in_prev_opp: (a.in_prev_opp + b.in_prev_opp) / 2,
    opp_in_prev: (a.opp_in_prev + b.opp_in_prev) / 2,
    same_house: a.low === b.low ? 1 : 0,
    same_parity: a.odd === b.odd ? 1 : 0,
    cross_market_30: pair.cross_market_30,
  };
}

function buildFormulaCatalog() {
  const formulas = [];
  const add = (name, weights) => formulas.push({ name, weights });

  for (const feature of FEATURE_NAMES) add(`single_${feature}`, { [feature]: 1 });
  for (const a of FEATURE_NAMES) {
    for (const b of FEATURE_NAMES) {
      if (a >= b) continue;
      if (formulas.length >= 160) break;
      add(`mix_${a}_${b}`, { [a]: 1, [b]: 1 });
      if (formulas.length >= 160) break;
      add(`tilt_${a}_${b}`, { [a]: 2, [b]: 1 });
      if (formulas.length >= 160) break;
      add(`tilt_${b}_${a}`, { [a]: 1, [b]: 2 });
    }
    if (formulas.length >= 160) break;
  }

  add("anti_recent_presence", { cold_3: 2, cold_7: 2, pair_abs_7: 1, in_prev: -1, in_prev_opp: -0.5 });
  add("durable_pair_absence", { pair_abs_30: 2, pair_abs_90: 2, weekday: 1, prev_kind: 1 });
  add("context_dominant", { weekday: 2, prev_sutta: 2, prev_kind: 1, prev_root: 1, dom_bucket: 1 });
  add("operator_balance", { cold_30: 1, cold_90: 2, gap_present: 1, hot_7: -1 });
  add("opposite_transition", { opp_in_prev: 2, pair_abs_15: 1, cold_7: 1 });
  add("cross_market_context", { cross_market_30: 2, pair_abs_30: 1, weekday: 1 });
  add("house_parity_filter", { pair_abs_30: 2, same_house: 0.5, same_parity: 0.5, cold_15: 1 });

  return formulas;
}

function pickPair(snapshot, formula) {
  const vectors = PAIRS.map((p) => ({ p, vector: pairVector(snapshot, p) }));
  const normalizedByFeature = {};
  for (const feature of Object.keys(formula.weights)) {
    normalizedByFeature[feature] = normalize(vectors.map((item) => item.vector[feature] ?? 0));
  }
  let best = null;
  for (let i = 0; i < vectors.length; i++) {
    let score = 0;
    for (const [feature, weight] of Object.entries(formula.weights)) {
      score += weight * normalizedByFeature[feature][i];
    }
    if (!best || score > best.score) best = { pair: vectors[i].p, score };
  }
  return best.pair;
}

function buildEvalCache(rows, side, rowsByMarket, market, start, end) {
  const cache = [];
  for (let index = start; index < end; index++) {
    const snapshot = buildFeatureSnapshot(rows, side, index, rowsByMarket, market);
    const vectors = PAIRS.map((p) => ({ p, vector: pairVector(snapshot, p) }));
    const normalized = {};
    for (const feature of FEATURE_NAMES) {
      normalized[feature] = normalize(vectors.map((item) => item.vector[feature] ?? 0));
    }
    const actualMask = maskFor(panelFor(rows[index], side));
    cache.push({ index, date: rows[index].isoDate, vectors, normalized, actualMask });
  }
  return cache;
}

function pickPairFromCachedRow(row, formula) {
  let best = null;
  for (let i = 0; i < row.vectors.length; i++) {
    let score = 0;
    for (const [feature, weight] of Object.entries(formula.weights)) {
      score += weight * row.normalized[feature][i];
    }
    if (!best || score > best.score) best = { pair: row.vectors[i].p, score };
  }
  return best.pair;
}

function evalFormulaCache(cache, formula) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  const predictions = [];
  for (const row of cache) {
    const pair = pickPairFromCachedRow(row, formula);
    const hit = isAbsentPair(pair, row.actualMask);
    const absentDigits = absentDigitCount(pair, row.actualMask);
    correct += hit ? 1 : 0;
    digitCorrect += absentDigits;
    total++;
    predictions.push({ date: row.date, pair: pair.key, hit, absentDigits });
  }
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0, predictions };
}

function run() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const formulas = buildFormulaCatalog();
  const rows = [];
  const rollingRows = [];

  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const marketRows = rowsByMarket[market];
      const testEnd = marketRows.length;
      const testStart = testEnd - 30;
      const valEnd = testStart;
      const valStart = Math.max(180, valEnd - 90);
      if (valEnd <= valStart) continue;
      const valCache = buildEvalCache(marketRows, side, rowsByMarket, market, valStart, valEnd);
      const testCache = buildEvalCache(marketRows, side, rowsByMarket, market, testStart, testEnd);
      let best = null;
      for (const formula of formulas) {
        const val = evalFormulaCache(valCache, formula);
        const score = val.accuracy * 1000 + val.avgCorrectDigits * 25;
        if (!best || score > best.score) best = { formula, val, score };
      }
      const test = evalFormulaCache(testCache, best.formula);
      rows.push({ market, side, formula: best.formula.name, val: best.val, test });

      let foldCount = 0;
      for (let foldEnd = marketRows.length - 30; foldEnd >= 240 && foldEnd >= marketRows.length - 120 && foldCount < 3; foldEnd -= 30) {
        foldCount++;
        const foldTestEnd = foldEnd + 30;
        const foldTestStart = foldEnd;
        const foldValEnd = foldTestStart;
        const foldValStart = Math.max(180, foldValEnd - 90);
        if (foldValEnd <= foldValStart) continue;
        const foldValCache = buildEvalCache(marketRows, side, rowsByMarket, market, foldValStart, foldValEnd);
        const foldTestCache = buildEvalCache(marketRows, side, rowsByMarket, market, foldTestStart, foldTestEnd);
        let foldBest = null;
        for (const formula of formulas) {
          const val = evalFormulaCache(foldValCache, formula);
          const score = val.accuracy * 1000 + val.avgCorrectDigits * 25;
          if (!foldBest || score > foldBest.score) foldBest = { formula, val, score };
        }
        const testFold = evalFormulaCache(foldTestCache, foldBest.formula);
        rollingRows.push({
          market,
          side,
          foldStartDate: marketRows[foldTestStart].isoDate,
          formula: foldBest.formula.name,
          val: foldBest.val,
          test: testFold,
        });
      }
    }
  }

  const aggregate = rows.reduce(
    (acc, row) => {
      acc.correct += row.test.correct;
      acc.digitCorrect += row.test.digitCorrect;
      acc.total += row.test.total;
      return acc;
    },
    { correct: 0, digitCorrect: 0, total: 0 },
  );
  const rollingAggregate = rollingRows.reduce(
    (acc, row) => {
      acc.correct += row.test.correct;
      acc.digitCorrect += row.test.digitCorrect;
      acc.total += row.test.total;
      return acc;
    },
    { correct: 0, digitCorrect: 0, total: 0 },
  );
  const output = {
    generatedAt: new Date().toISOString(),
    formulaCount: formulas.length,
    aggregate: {
      ...aggregate,
      accuracy: aggregate.total ? aggregate.correct / aggregate.total : 0,
      avgCorrectDigits: aggregate.total ? aggregate.digitCorrect / aggregate.total : 0,
      marketSidesAt70: rows.filter((row) => row.test.accuracy >= 0.7).length,
      marketSidesAt80: rows.filter((row) => row.test.accuracy >= 0.8).length,
    },
    rollingAggregate: {
      ...rollingAggregate,
      accuracy: rollingAggregate.total ? rollingAggregate.correct / rollingAggregate.total : 0,
      avgCorrectDigits: rollingAggregate.total ? rollingAggregate.digitCorrect / rollingAggregate.total : 0,
      foldsAt70: rollingRows.filter((row) => row.test.accuracy >= 0.7).length,
      foldsAt80: rollingRows.filter((row) => row.test.accuracy >= 0.8).length,
      folds: rollingRows.length,
    },
    rows,
    rollingRows,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-meta-formula-search-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Meta Formula Search");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Formulas tested: ${output.formulaCount}`);
  lines.push("");
  lines.push("## Latest 30 Full Coverage");
  lines.push("");
  lines.push(`- Strict accuracy: ${pct(output.aggregate.accuracy)} (${aggregate.correct}/${aggregate.total})`);
  lines.push(`- Average correctly eliminated digits: ${output.aggregate.avgCorrectDigits.toFixed(2)} / 2`);
  lines.push(`- Market-sides >=70%: ${output.aggregate.marketSidesAt70}/${rows.length}`);
  lines.push(`- Market-sides >=80%: ${output.aggregate.marketSidesAt80}/${rows.length}`);
  lines.push("");
  lines.push("## Rolling Forward Check");
  lines.push("");
  lines.push(`- Strict accuracy: ${pct(output.rollingAggregate.accuracy)} (${rollingAggregate.correct}/${rollingAggregate.total})`);
  lines.push(`- Average correctly eliminated digits: ${output.rollingAggregate.avgCorrectDigits.toFixed(2)} / 2`);
  lines.push(`- Folds >=70%: ${output.rollingAggregate.foldsAt70}/${rollingRows.length}`);
  lines.push(`- Folds >=80%: ${output.rollingAggregate.foldsAt80}/${rollingRows.length}`);
  lines.push("");
  lines.push("| Market | Side | Formula | Val | Test | Avg Digits |");
  lines.push("|---|---|---|---:|---:|---:|");
  for (const row of rows) {
    lines.push(`| ${row.market} | ${row.side} | ${row.formula} | ${pct(row.val.accuracy)} (${row.val.correct}/${row.val.total}) | ${pct(row.test.accuracy)} (${row.test.correct}/${row.test.total}) | ${row.test.avgCorrectDigits.toFixed(2)} |`);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- This searches a large family of weighted pair-scoring formulas across frequency, gaps, context buckets, previous-result features, house/parity features, opposite mapping, and cross-market lag.");
  lines.push("- Formula selection uses only the validation window before each test window.");
  lines.push("- Any 80%+ row here should still be treated as a candidate, not proof, unless it repeats across rolling folds with enough support.");
  fs.writeFileSync(path.join(__dirname, "two-digit-meta-formula-search.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

if (require.main === module) {
  run();
}
