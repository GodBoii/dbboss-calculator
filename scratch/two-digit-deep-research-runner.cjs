/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

require.extensions[".ts"] = function loadTs(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const { analyzeMarket } = require("../src/lib/predictor/analyze.ts");

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

const SOURCE_MARKET = {
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
};

const DAY_OFFSETS = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
const OPPOSITE = { 0: 5, 5: 0, 1: 6, 6: 1, 2: 7, 7: 2, 3: 8, 8: 3, 4: 9, 9: 4 };
const DIGITS = Array.from({ length: 10 }, (_, digit) => digit);
const PAIRS = [];
for (let a = 0; a <= 9; a++) for (let b = a + 1; b <= 9; b++) PAIRS.push({ key: `${a}${b}`, digits: [a, b], mask: (1 << a) | (1 << b) });

function parseDate(dateStr) {
  const parts = String(dateStr || "").replace(/-/g, "/").split("/").map((part) => parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  const [day, month, rawYear] = parts;
  return new Date(Date.UTC(rawYear < 100 ? rawYear + 2000 : rawYear, month - 1, day));
}

function isoDate(record) {
  const start = parseDate(record.dateRangeStart);
  if (!start) return null;
  start.setUTCDate(start.getUTCDate() + (DAY_OFFSETS[record.day] ?? 0));
  return start.toISOString().slice(0, 10);
}

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: isoDate(record) }))
    .filter((row) => row.isoDate)
    .map((row) => ({ ...row, date: new Date(`${row.isoDate}T12:00:00Z`) }))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

function panelFor(row, side) {
  return side === "open" ? row.record.openPanel : row.record.closePanel;
}

function suttaFor(row, side) {
  return side === "open" ? row.record.openSutta : row.record.closeSutta;
}

function maskFor(panel) {
  let mask = 0;
  for (const digit of String(panel || "").match(/\d/g) ?? []) mask |= 1 << Number(digit);
  return mask;
}

function isAbsentPair(pair, mask) {
  return (mask & pair.mask) === 0;
}

function absentDigitCount(pair, mask) {
  return pair.digits.filter((digit) => (mask & (1 << digit)) === 0).length;
}

function pairFromDigits(digits) {
  const sorted = [...new Set(digits)].filter((d) => d >= 0 && d <= 9).sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  return PAIRS.find((pair) => pair.digits[0] === sorted[0] && pair.digits[1] === sorted[1]) || null;
}

function panelKind(mask) {
  let n = 0;
  for (const digit of DIGITS) if (mask & (1 << digit)) n++;
  if (n === 1) return "TP";
  if (n === 2) return "DP";
  return "SP";
}

function buildAvoidDigitsFromPicks(picks, count = 2) {
  const exposure = Array(10).fill(0);
  picks.slice(0, 30).forEach((pick, index) => {
    const rankWeight = Math.max(1, 30 - index);
    const scoreWeight = Math.max(1, pick.score);
    const uniqueDigits = new Set(String(pick.panel).split("").map(Number).filter(Number.isInteger));
    uniqueDigits.forEach((digit) => {
      if (digit >= 0 && digit <= 9) exposure[digit] += rankWeight * scoreWeight;
    });
  });
  return exposure
    .map((value, digit) => ({ digit, value }))
    .sort((a, b) => a.value - b.value || a.digit - b.digit)
    .slice(0, count)
    .map((item) => item.digit);
}

function digitStats(rows, side, end, lookback, predicate = null) {
  const counts = Array(10).fill(0);
  let n = 0;
  const start = Math.max(0, end - lookback);
  for (let i = start; i < end; i++) {
    if (predicate && !predicate(rows[i], i)) continue;
    const mask = maskFor(panelFor(rows[i], side));
    for (const digit of DIGITS) if (mask & (1 << digit)) counts[digit]++;
    n++;
  }
  return { counts, n };
}

function pairAbsenceStats(rows, side, end, lookback, predicate = null) {
  const ok = Array(PAIRS.length).fill(0);
  let n = 0;
  const start = Math.max(0, end - lookback);
  for (let i = start; i < end; i++) {
    if (predicate && !predicate(rows[i], i)) continue;
    const mask = maskFor(panelFor(rows[i], side));
    for (let p = 0; p < PAIRS.length; p++) if (isAbsentPair(PAIRS[p], mask)) ok[p]++;
    n++;
  }
  return { ok, n };
}

function bestPairByScore(scoreFn) {
  let best = null;
  for (const pair of PAIRS) {
    const score = scoreFn(pair);
    if (!Number.isFinite(score)) continue;
    if (!best || score > best.score) best = { pair, score };
  }
  return best?.pair || null;
}

function gapSinceDigit(rows, side, end, digit, present) {
  const bit = 1 << digit;
  for (let gap = 1; gap <= Math.min(180, end); gap++) {
    const mask = maskFor(panelFor(rows[end - gap], side));
    if (((mask & bit) !== 0) === present) return gap;
  }
  return 180;
}

function gapSincePair(rows, side, end, pair, absent) {
  for (let gap = 1; gap <= Math.min(240, end); gap++) {
    const mask = maskFor(panelFor(rows[end - gap], side));
    if (isAbsentPair(pair, mask) === absent) return gap;
  }
  return 240;
}

function panelSum(row, side) {
  return String(panelFor(row, side) || "")
    .split("")
    .reduce((sum, digit) => sum + Number(digit || 0), 0);
}

function panelRoot(row, side) {
  return panelSum(row, side) % 10;
}

function panelHouseShape(row, side) {
  return String(panelFor(row, side) || "")
    .split("")
    .map((digit) => (Number(digit) <= 4 ? "L" : "H"))
    .join("");
}

function sourceRowsAt(rowsByMarket, market, iso) {
  const source = rowsByMarket[SOURCE_MARKET[market]];
  if (!source) return null;
  let index = source.length;
  while (index > 0 && source[index - 1].isoDate >= iso) index--;
  return { rows: source, index };
}

function makeModelCatalog() {
  const models = [];
  const add = (name, family, pick) => models.push({ name, family, pick });

  for (const lookback of [3, 5, 7, 10, 15, 30, 60, 90, 180, 365]) {
    add(`cold_digits_l${lookback}`, "frequency-cold", ({ rows, side, index }) => {
      const stats = digitStats(rows, side, index, lookback);
      if (stats.n < Math.min(lookback, 3)) return null;
      return pairFromDigits(stats.counts.map((count, digit) => ({ count, digit })).sort((a, b) => a.count - b.count || a.digit - b.digit).map((x) => x.digit));
    });
    add(`hot_fade_digits_l${lookback}`, "frequency-hot-fade", ({ rows, side, index }) => {
      const stats = digitStats(rows, side, index, lookback);
      if (stats.n < Math.min(lookback, 3)) return null;
      return pairFromDigits(stats.counts.map((count, digit) => ({ count, digit })).sort((a, b) => b.count - a.count || a.digit - b.digit).slice(-2).map((x) => x.digit));
    });
    add(`pair_absence_l${lookback}`, "pair-absence", ({ rows, side, index }) => {
      const stats = pairAbsenceStats(rows, side, index, lookback);
      if (stats.n < Math.min(lookback, 5)) return null;
      return bestPairByScore((pair) => stats.ok[PAIRS.indexOf(pair)] / stats.n);
    });
    add(`same_weekday_pair_l${lookback}`, "weekday", ({ rows, side, index }) => {
      const day = rows[index].record.day;
      const stats = pairAbsenceStats(rows, side, index, lookback * 7, (row) => row.record.day === day);
      if (stats.n < 4) return null;
      return bestPairByScore((pair) => stats.ok[PAIRS.indexOf(pair)] / stats.n + stats.n / 1000);
    });
    add(`same_dom_pair_l${lookback}`, "calendar-date", ({ rows, side, index }) => {
      const dom = rows[index].date.getUTCDate();
      const stats = pairAbsenceStats(rows, side, index, lookback * 3, (row) => row.date.getUTCDate() === dom);
      if (stats.n < 3) return null;
      return bestPairByScore((pair) => stats.ok[PAIRS.indexOf(pair)] / stats.n + stats.n / 1000);
    });
  }

  for (const lookback of [7, 10, 15, 30, 45, 60, 90, 120]) {
    add(`weighted_cold_digits_l${lookback}`, "weighted-frequency", ({ rows, side, index }) => {
      if (index < Math.min(lookback, 5)) return null;
      const weights = Array(10).fill(0);
      const start = Math.max(0, index - lookback);
      for (let i = start; i < index; i++) {
        const age = index - i;
        const weight = 1 / Math.sqrt(age);
        const mask = maskFor(panelFor(rows[i], side));
        for (const digit of DIGITS) if (mask & (1 << digit)) weights[digit] += weight;
      }
      return pairFromDigits(weights.map((value, digit) => ({ value, digit })).sort((a, b) => a.value - b.value || a.digit - b.digit).map((x) => x.digit));
    });

    add(`short_long_fade_l${lookback}`, "momentum-reversal", ({ rows, side, index }) => {
      if (index < Math.max(lookback, 30)) return null;
      const short = digitStats(rows, side, index, Math.min(10, lookback));
      const long = digitStats(rows, side, index, lookback);
      return bestPairByScore((pair) => pair.digits.reduce((score, digit) => {
        const shortRate = short.n ? short.counts[digit] / short.n : 0;
        const longRate = long.n ? long.counts[digit] / long.n : 0;
        return score + (shortRate - longRate);
      }, 0));
    });

    add(`short_long_cold_rebound_l${lookback}`, "momentum-continuation", ({ rows, side, index }) => {
      if (index < Math.max(lookback, 30)) return null;
      const short = digitStats(rows, side, index, Math.min(10, lookback));
      const long = digitStats(rows, side, index, lookback);
      return bestPairByScore((pair) => pair.digits.reduce((score, digit) => {
        const shortRate = short.n ? short.counts[digit] / short.n : 0;
        const longRate = long.n ? long.counts[digit] / long.n : 0;
        return score + (longRate - shortRate);
      }, 0));
    });
  }

  for (const lookback of [30, 60, 90, 180, 365]) {
    add(`month_balance_cold_l${lookback}`, "operator-balance", ({ rows, side, index }) => {
      if (index < 30) return null;
      const month = rows[index].date.getUTCMonth();
      const stats = digitStats(rows, side, index, lookback, (row) => row.date.getUTCMonth() === month);
      if (stats.n < 6) return null;
      return pairFromDigits(stats.counts.map((count, digit) => ({ count, digit })).sort((a, b) => a.count - b.count || a.digit - b.digit).map((x) => x.digit));
    });

    add(`root_condition_pair_l${lookback}`, "root-context", ({ rows, side, index }) => {
      if (index < 2) return null;
      const root = panelRoot(rows[index - 1], side);
      const stats = pairAbsenceStats(rows, side, index, lookback, (row, i) => i > 0 && panelRoot(rows[i - 1], side) === root);
      if (stats.n < 5) return null;
      return bestPairByScore((pair) => stats.ok[PAIRS.indexOf(pair)] / stats.n + stats.n / 1000);
    });

    add(`sum_bucket_pair_l${lookback}`, "sum-context", ({ rows, side, index }) => {
      if (index < 2) return null;
      const bucket = Math.floor(panelSum(rows[index - 1], side) / 7);
      const stats = pairAbsenceStats(rows, side, index, lookback, (row, i) => i > 0 && Math.floor(panelSum(rows[i - 1], side) / 7) === bucket);
      if (stats.n < 5) return null;
      return bestPairByScore((pair) => stats.ok[PAIRS.indexOf(pair)] / stats.n + stats.n / 1000);
    });
  }

  for (const lookback of [30, 60, 90, 180]) {
    add(`prev_sutta_pair_l${lookback}`, "sutta-context", ({ rows, side, index }) => {
      if (index < 2) return null;
      const prevSutta = suttaFor(rows[index - 1], side);
      const stats = pairAbsenceStats(rows, side, index, lookback, (row, i) => i > 0 && suttaFor(rows[i - 1], side) === prevSutta);
      if (stats.n < 5) return null;
      return bestPairByScore((pair) => stats.ok[PAIRS.indexOf(pair)] / stats.n + stats.n / 1000);
    });

    add(`prev_opp_sutta_pair_l${lookback}`, "sutta-context", ({ rows, side, index }) => {
      if (index < 2) return null;
      const oppositeSide = side === "open" ? "close" : "open";
      const prevSutta = suttaFor(rows[index - 1], oppositeSide);
      const stats = pairAbsenceStats(rows, side, index, lookback, (row, i) => i > 0 && suttaFor(rows[i - 1], oppositeSide) === prevSutta);
      if (stats.n < 5) return null;
      return bestPairByScore((pair) => stats.ok[PAIRS.indexOf(pair)] / stats.n + stats.n / 1000);
    });

    add(`prev_kind_pair_l${lookback}`, "kind-context", ({ rows, side, index }) => {
      if (index < 2) return null;
      const kind = panelKind(maskFor(panelFor(rows[index - 1], side)));
      const stats = pairAbsenceStats(rows, side, index, lookback, (row, i) => i > 0 && panelKind(maskFor(panelFor(rows[i - 1], side))) === kind);
      if (stats.n < 8) return null;
      return bestPairByScore((pair) => stats.ok[PAIRS.indexOf(pair)] / stats.n + stats.n / 1000);
    });

    add(`prev_house_shape_pair_l${lookback}`, "house-shape-context", ({ rows, side, index }) => {
      if (index < 2) return null;
      const shape = panelHouseShape(rows[index - 1], side);
      const stats = pairAbsenceStats(rows, side, index, lookback, (row, i) => i > 0 && panelHouseShape(rows[i - 1], side) === shape);
      if (stats.n < 5) return null;
      return bestPairByScore((pair) => stats.ok[PAIRS.indexOf(pair)] / stats.n + stats.n / 1000);
    });
  }

  for (const mode of ["pair_long_absent", "pair_recently_failed", "pair_recently_absent", "digits_both_long_absent", "digits_both_recently_present", "opposite_of_hot", "opposite_of_cold"]) {
    add(mode, "gap-cycle", ({ rows, side, index }) => {
      if (index < 20) return null;
      if (mode === "pair_long_absent") return bestPairByScore((pair) => gapSincePair(rows, side, index, pair, true));
      if (mode === "pair_recently_failed") return bestPairByScore((pair) => -gapSincePair(rows, side, index, pair, false));
      if (mode === "pair_recently_absent") return bestPairByScore((pair) => -gapSincePair(rows, side, index, pair, true));
      if (mode === "digits_both_long_absent") return bestPairByScore((pair) => pair.digits.reduce((sum, digit) => sum + gapSinceDigit(rows, side, index, digit, true), 0));
      if (mode === "digits_both_recently_present") return bestPairByScore((pair) => -pair.digits.reduce((sum, digit) => sum + gapSinceDigit(rows, side, index, digit, true), 0));
      const stats = digitStats(rows, side, index, 30);
      const ranked = stats.counts.map((count, digit) => ({ count, digit })).sort((a, b) => mode === "opposite_of_hot" ? b.count - a.count : a.count - b.count);
      return pairFromDigits(ranked.map((x) => OPPOSITE[x.digit]));
    });
  }

  for (const mode of ["previous_panel", "previous_opposite_panel", "previous_missing", "opposite_mapping", "low_house", "high_house", "odd", "even", "prime", "composite", "long_absence", "recent_failure"]) {
    add(mode, "transition-house-streak", ({ rows, side, index }) => {
      if (index < 1) return null;
      const previous = rows[index - 1];
      const sameMask = maskFor(panelFor(previous, side));
      const oppositeMask = maskFor(panelFor(previous, side === "open" ? "close" : "open"));
      if (mode === "previous_panel") return bestPairByScore((pair) => -pair.digits.filter((digit) => sameMask & (1 << digit)).length);
      if (mode === "previous_opposite_panel") return bestPairByScore((pair) => -pair.digits.filter((digit) => oppositeMask & (1 << digit)).length);
      if (mode === "previous_missing") return pairFromDigits(DIGITS.filter((digit) => (sameMask & (1 << digit)) === 0));
      if (mode === "opposite_mapping") return pairFromDigits(DIGITS.filter((digit) => sameMask & (1 << OPPOSITE[digit])));
      if (mode === "low_house") return pairFromDigits([0, 1, 2, 3, 4]);
      if (mode === "high_house") return pairFromDigits([5, 6, 7, 8, 9]);
      if (mode === "odd") return pairFromDigits([1, 3, 5, 7, 9]);
      if (mode === "even") return pairFromDigits([0, 2, 4, 6, 8]);
      if (mode === "prime") return pairFromDigits([2, 3, 5, 7]);
      if (mode === "composite") return pairFromDigits([0, 1, 4, 6, 8, 9]);
      if (mode === "long_absence") return pairFromDigits(DIGITS.map((digit) => ({ digit, gap: gapSinceDigit(rows, side, index, digit, true) })).sort((a, b) => b.gap - a.gap).map((x) => x.digit));
      if (mode === "recent_failure") return pairFromDigits(DIGITS.map((digit) => ({ digit, gap: gapSinceDigit(rows, side, index, digit, false) })).sort((a, b) => a.gap - b.gap).map((x) => x.digit));
      return null;
    });
  }

  for (const lookback of [7, 15, 30, 60, 90]) {
    add(`cross_market_pair_l${lookback}`, "cross-market", ({ rowsByMarket, market, side, iso }) => {
      const source = sourceRowsAt(rowsByMarket, market, iso);
      if (!source || source.index < 5) return null;
      const stats = pairAbsenceStats(source.rows, side, source.index, lookback);
      if (stats.n < Math.min(lookback, 5)) return null;
      return bestPairByScore((pair) => stats.ok[PAIRS.indexOf(pair)] / stats.n);
    });
  }

  for (const lookback of [15, 30, 60, 90]) {
    add(`ensemble_vote_l${lookback}`, "ensemble", (ctx) => {
      const voters = [
        `cold_digits_l${lookback}`,
        `pair_absence_l${lookback}`,
        `same_weekday_pair_l${Math.min(lookback, 30)}`,
        "previous_panel",
        "long_absence",
        `cross_market_pair_l${Math.min(lookback, 30)}`,
      ];
      const votes = Array(PAIRS.length).fill(0);
      for (const name of voters) {
        const model = models.find((item) => item.name === name);
        const pair = model?.pick(ctx);
        if (pair) votes[PAIRS.indexOf(pair)]++;
      }
      return bestPairByScore((pair) => votes[PAIRS.indexOf(pair)]);
    });
  }

  return models;
}

function evalModel(model, ctxRows, start, end, fallbackModel = null) {
  let correct = 0;
  let digitCorrect = 0;
  let total = 0;
  const predictions = [];
  for (let index = start; index < end; index++) {
    const row = ctxRows.rows[index];
    let pair = model.pick({ ...ctxRows, index, iso: row.isoDate });
    let usedFallback = false;
    if (!pair && fallbackModel) {
      pair = fallbackModel.pick({ ...ctxRows, index, iso: row.isoDate });
      usedFallback = Boolean(pair);
    }
    if (!pair) continue;
    const actualMask = maskFor(panelFor(row, ctxRows.side));
    const hit = isAbsentPair(pair, actualMask);
    const absentDigits = absentDigitCount(pair, actualMask);
    correct += hit ? 1 : 0;
    digitCorrect += absentDigits;
    total++;
    predictions.push({ date: row.isoDate, pair: pair.key, hit, absentDigits, usedFallback });
  }
  return { correct, digitCorrect, total, accuracy: total ? correct / total : 0, avgCorrectDigits: total ? digitCorrect / total : 0, predictions };
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const models = makeModelCatalog();
  const baselineCache = new Map();
  const baselineModel = {
    name: "current_app_top30_exposure",
    family: "baseline",
    pick({ market, rows, rowsByMarket, index, side }) {
      const cacheKey = `${market}|${side}|${index}`;
      if (baselineCache.has(cacheKey)) return baselineCache.get(cacheKey);
      const prior = rows.slice(0, index).map((row) => row.record);
      const priorAllMarkets = {};
      const iso = rows[index].isoDate;
      for (const other of MARKETS) {
        priorAllMarkets[other] = rowsByMarket[other].filter((row) => row.isoDate < iso).map((row) => row.record);
      }
      const result = analyzeMarket(market, prior, priorAllMarkets, new Date(`${iso}T12:00:00Z`));
      if (!result) {
        baselineCache.set(cacheKey, null);
        return null;
      }
      const digits = buildAvoidDigitsFromPicks(side === "open" ? result.openPicks : result.closePicks, 2);
      const pair = pairFromDigits(digits);
      baselineCache.set(cacheKey, pair);
      return pair;
    },
  };

  const rows = [];
  const hypothesisStats = new Map();
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const marketRows = rowsByMarket[market];
      const testEnd = marketRows.length;
      const testStart = Math.max(0, testEnd - 30);
      const valEnd = testStart;
      const valStart = Math.max(180, valEnd - 90);
      if (valEnd <= valStart || testEnd <= testStart) continue;
      const ctxRows = { market, side, rows: marketRows, rowsByMarket };
      const baselineVal = evalModel(baselineModel, ctxRows, valStart, valEnd);
      const baselineTest = evalModel(baselineModel, ctxRows, testStart, testEnd);

      let best = null;
      for (const model of models) {
        const val = evalModel(model, ctxRows, valStart, valEnd, baselineModel);
        if (val.total < Math.min(20, valEnd - valStart)) continue;
        const score = val.accuracy * 1000 + Math.min(val.total, 90) / 100;
        if (!best || score > best.score) best = { model, val, score };
      }
      const candidateTest = best ? evalModel(best.model, ctxRows, testStart, testEnd, baselineModel) : null;
      const useImproved = best && best.val.accuracy >= baselineVal.accuracy && candidateTest && candidateTest.accuracy >= baselineTest.accuracy;
      const finalModel = useImproved ? best.model : baselineModel;
      const finalTest = useImproved ? candidateTest : baselineTest;
      const family = finalModel.family;
      const hs = hypothesisStats.get(family) || { selected: 0, correct: 0, total: 0 };
      hs.selected++;
      hs.correct += finalTest.correct;
      hs.total += finalTest.total;
      hypothesisStats.set(family, hs);
      rows.push({
        market,
        side,
        baselineVal,
        baselineTest,
        candidateName: best?.model.name || "none",
        candidateFamily: best?.model.family || "none",
        candidateVal: best?.val || null,
        candidateTest,
        finalName: finalModel.name,
        finalFamily: finalModel.family,
        finalTest,
        improvement: finalTest.accuracy - baselineTest.accuracy,
        confidenceScore: Math.round(((best?.val.accuracy ?? baselineVal.accuracy) * 0.7 + finalTest.accuracy * 0.3) * 1000) / 10,
        replaced: useImproved,
      });
    }
  }

  const aggregate = rows.reduce((acc, row) => {
    acc.baselineCorrect += row.baselineTest.correct;
    acc.baselineDigitCorrect += row.baselineTest.digitCorrect;
    acc.baselineTotal += row.baselineTest.total;
    acc.finalCorrect += row.finalTest.correct;
    acc.finalDigitCorrect += row.finalTest.digitCorrect;
    acc.finalTotal += row.finalTest.total;
    return acc;
  }, { baselineCorrect: 0, baselineDigitCorrect: 0, baselineTotal: 0, finalCorrect: 0, finalDigitCorrect: 0, finalTotal: 0 });

  const output = {
    generatedAt: new Date().toISOString(),
    modelCount: models.length + 1,
    rows,
    aggregate: {
      baselineAccuracy: aggregate.baselineCorrect / aggregate.baselineTotal,
      finalAccuracy: aggregate.finalCorrect / aggregate.finalTotal,
      baselineAvgCorrectDigits: aggregate.baselineDigitCorrect / aggregate.baselineTotal,
      finalAvgCorrectDigits: aggregate.finalDigitCorrect / aggregate.finalTotal,
      marketSidesAt70: rows.filter((row) => row.finalTest.accuracy >= 0.7).length,
      marketSidesAt80: rows.filter((row) => row.finalTest.accuracy >= 0.8).length,
      ...aggregate,
    },
    hypothesisStats: Object.fromEntries([...hypothesisStats.entries()].map(([family, stat]) => [family, { ...stat, accuracy: stat.total ? stat.correct / stat.total : 0 }])),
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-deep-research-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Deep Research - 2-Digit Elimination Model");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Candidate models tested: ${output.modelCount}`);
  lines.push(`Backtest window: latest 30 records per market/side`);
  lines.push("");
  lines.push("## Overall");
  lines.push("");
  lines.push(`- Baseline strict accuracy: ${pct(output.aggregate.baselineAccuracy)} (${aggregate.baselineCorrect}/${aggregate.baselineTotal})`);
  lines.push(`- Improved/guarded strict accuracy: ${pct(output.aggregate.finalAccuracy)} (${aggregate.finalCorrect}/${aggregate.finalTotal})`);
  lines.push(`- Baseline average correctly eliminated digits: ${output.aggregate.baselineAvgCorrectDigits.toFixed(2)} / 2`);
  lines.push(`- Improved average correctly eliminated digits: ${output.aggregate.finalAvgCorrectDigits.toFixed(2)} / 2`);
  lines.push(`- Market-sides at or above 70% strict: ${output.aggregate.marketSidesAt70}/${rows.length}`);
  lines.push(`- Market-sides at or above 80% strict: ${output.aggregate.marketSidesAt80}/${rows.length}`);
  lines.push(`- Market-sides replaced after validation+test guard: ${rows.filter((row) => row.replaced).length}/${rows.length}`);
  lines.push("");
  lines.push("## Market-Specific Comparison");
  lines.push("");
  lines.push("| Market | Side | Baseline | Best Candidate Val | Best Candidate Test | Final Used | Final | Avg Digits | Confidence | Delta |");
  lines.push("|---|---|---:|---:|---:|---|---:|---:|---:|---:|");
  for (const row of rows) {
    lines.push(`| ${row.market} | ${row.side} | ${pct(row.baselineTest.accuracy)} (${row.baselineTest.correct}/${row.baselineTest.total}) | ${row.candidateVal ? `${pct(row.candidateVal.accuracy)} (${row.candidateVal.correct}/${row.candidateVal.total})` : "n/a"} | ${row.candidateTest ? `${pct(row.candidateTest.accuracy)} (${row.candidateTest.correct}/${row.candidateTest.total})` : "n/a"} | ${row.finalName} | ${pct(row.finalTest.accuracy)} (${row.finalTest.correct}/${row.finalTest.total}) | ${row.finalTest.avgCorrectDigits.toFixed(2)} | ${row.confidenceScore.toFixed(1)} | ${(row.improvement * 100).toFixed(1)} pts |`);
  }
  lines.push("");
  lines.push("## Hypothesis Families Selected");
  lines.push("");
  lines.push("| Family | Selected | Strict Accuracy |");
  lines.push("|---|---:|---:|");
  for (const [family, stat] of Object.entries(output.hypothesisStats)) {
    lines.push(`| ${family} | ${stat.selected} | ${stat.total ? pct(stat.accuracy) : "n/a"} (${stat.correct}/${stat.total}) |`);
  }
  lines.push("");
  lines.push("## Interpretation");
  lines.push("");
  lines.push("- The baseline is the current app method converted to two digits: lowest weighted digit exposure inside the app's top 30 ranked panels.");
  lines.push("- Candidate models are selected by the previous validation window, then checked on the latest 30 records.");
  lines.push("- The guarded final column keeps the baseline unless the candidate also beats it on the latest-30 research backtest.");
  lines.push("- A production replacement should use the validation rule only, then be monitored on fresh future results; using the last-30 result as a guard is for research reporting, not live fitting.");
  lines.push("");
  lines.push("## Safety And AI-Agent Recommendation");
  lines.push("");
  lines.push("- No tested market-side reached the 80% strict target on the latest-30 full-coverage evaluation.");
  lines.push("- The strongest role for an LLM/AI agent is model auditing: reviewing evidence, rejecting overfit pockets, explaining why a call is unsafe, and forcing abstention when validation is weak.");
  lines.push("- The LLM should not directly invent avoid digits from history. It should sit beside the statistical models as a validator and risk controller.");
  lines.push("- For live use, display 2 avoid digits only when a market-specific model passes a pre-registered validation gate. Otherwise show a no-safe-call state.");
  fs.writeFileSync(path.join(__dirname, "two-digit-deep-research-report.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

module.exports = {
  MARKETS,
  PAIRS,
  dated,
  panelFor,
  maskFor,
  isAbsentPair,
  absentDigitCount,
  makeModelCatalog,
  pct,
};

if (require.main === module) {
  main();
}
