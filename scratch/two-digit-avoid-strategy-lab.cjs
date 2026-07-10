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

const DAY_OFFSETS = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

const PAIRS = [];
for (let a = 0; a <= 9; a++) {
  for (let b = a + 1; b <= 9; b++) {
    PAIRS.push({ key: `${a}${b}`, digits: [String(a), String(b)], mask: (1 << a) | (1 << b) });
  }
}

const LOOKBACKS = [7, 14, 21, 30, 45, 60, 90, 120, 180, 240, 365];
const SHORT_LOOKBACKS = [7, 14, 21, 30, 45, 60];
const LONG_LOOKBACKS = [90, 120, 180, 240, 365];
const THRESHOLDS = [0.58, 0.62, 0.66, 0.7, 0.74, 0.78];
const DIGITS = Array.from({ length: 10 }, (_, digit) => digit);

function parseDate(dateStr) {
  const parts = String(dateStr || "")
    .replace(/-/g, "/")
    .split("/")
    .map((part) => parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
  const [day, month, rawYear] = parts;
  const year = rawYear < 100 ? rawYear + 2000 : rawYear;
  return new Date(Date.UTC(year, month - 1, day));
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
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

function panelFor(row, side) {
  return side === "open" ? row.record.openPanel : row.record.closePanel;
}

function maskForPanel(panel) {
  let mask = 0;
  for (const digit of String(panel || "").match(/\d/g) ?? []) mask |= 1 << Number(digit);
  return mask;
}

function uniqueCount(mask) {
  let count = 0;
  for (const digit of DIGITS) if (mask & (1 << digit)) count++;
  return count;
}

function isPairAbsent(pairIndex, panelMask) {
  return (panelMask & PAIRS[pairIndex].mask) === 0;
}

function makePairPrefix(masks) {
  return PAIRS.map((pair) => {
    const prefix = [0];
    for (const mask of masks) prefix.push(prefix[prefix.length - 1] + (isPairAbsent(PAIRS.indexOf(pair), mask) ? 1 : 0));
    return prefix;
  });
}

function makeDigitPrefix(masks) {
  return DIGITS.map((digit) => {
    const bit = 1 << digit;
    const absent = [0];
    const present = [0];
    for (const mask of masks) {
      absent.push(absent[absent.length - 1] + ((mask & bit) === 0 ? 1 : 0));
      present.push(present[present.length - 1] + ((mask & bit) !== 0 ? 1 : 0));
    }
    return { absent, present };
  });
}

function prefixCount(prefix, start, end) {
  return prefix[end] - prefix[start];
}

function clampStart(index, lookback) {
  return Math.max(0, index - lookback);
}

function rateFromPrefix(prefix, start, end, fallback = 0) {
  const n = end - start;
  return n > 0 ? prefixCount(prefix, start, end) / n : fallback;
}

function buildSeries(records, side) {
  const masks = records.map((row) => maskForPanel(panelFor(row, side)));
  return {
    records,
    masks,
    pairAbsentPrefix: makePairPrefix(masks),
    digitPrefix: makeDigitPrefix(masks),
  };
}

function pairRate(series, pairIndex, start, end) {
  return rateFromPrefix(series.pairAbsentPrefix[pairIndex], start, end, 0);
}

function digitAbsentRate(series, digit, start, end) {
  return rateFromPrefix(series.digitPrefix[digit].absent, start, end, 0);
}

function digitPresentRate(series, digit, start, end) {
  return rateFromPrefix(series.digitPrefix[digit].present, start, end, 0);
}

function pairLastFailedGap(series, pairIndex, index, maxGap = 120) {
  for (let offset = 1; offset <= Math.min(index, maxGap); offset++) {
    if (!isPairAbsent(pairIndex, series.masks[index - offset])) return offset;
  }
  return maxGap;
}

function pairLastAbsentGap(series, pairIndex, index, maxGap = 120) {
  for (let offset = 1; offset <= Math.min(index, maxGap); offset++) {
    if (isPairAbsent(pairIndex, series.masks[index - offset])) return offset;
  }
  return maxGap;
}

function bestPairByScore(scoreFn, tieMode = "low") {
  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) {
    const score = scoreFn(pairIndex);
    if (score > bestScore || (score === bestScore && (tieMode === "high" ? pairIndex > bestIndex : pairIndex < bestIndex))) {
      bestIndex = pairIndex;
      bestScore = score;
    }
  }
  return { pairIndex: bestIndex, score: bestScore };
}

function sourceIndexByDate(sourceRows, iso) {
  let index = sourceRows.length;
  while (index > 0 && sourceRows[index - 1].isoDate >= iso) index--;
  return index;
}

function makeStrategy(name, family, pickPair, options = {}) {
  return { name, family, pickPair, ...options };
}

function buildStrategies() {
  const strategies = [];

  for (const lookback of LOOKBACKS) {
    strategies.push(makeStrategy(`target_pair_absence_l${lookback}`, "target-pair-rate", ({ target, index }) => {
      const start = clampStart(index, lookback);
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => pairRate(target, pairIndex, start, index));
    }));

    strategies.push(makeStrategy(`target_pair_absence_recent_penalty_l${lookback}`, "target-pair-rate", ({ target, index }) => {
      const start = clampStart(index, lookback);
      const recentStart = clampStart(index, Math.min(14, lookback));
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => pairRate(target, pairIndex, start, index) - 0.35 * pairRate(target, pairIndex, recentStart, index));
    }));

    strategies.push(makeStrategy(`digit_absence_sum_l${lookback}`, "digit-rate", ({ target, index }) => {
      const start = clampStart(index, lookback);
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => {
        const [a, b] = PAIRS[pairIndex].digits.map(Number);
        return digitAbsentRate(target, a, start, index) + digitAbsentRate(target, b, start, index);
      });
    }));

    strategies.push(makeStrategy(`digit_absence_min_l${lookback}`, "digit-rate", ({ target, index }) => {
      const start = clampStart(index, lookback);
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => {
        const [a, b] = PAIRS[pairIndex].digits.map(Number);
        return Math.min(digitAbsentRate(target, a, start, index), digitAbsentRate(target, b, start, index));
      });
    }));

    strategies.push(makeStrategy(`digit_present_fade_l${lookback}`, "digit-rate", ({ target, index }) => {
      const start = clampStart(index, lookback);
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => {
        const [a, b] = PAIRS[pairIndex].digits.map(Number);
        return -(digitPresentRate(target, a, start, index) + digitPresentRate(target, b, start, index));
      });
    }));
  }

  for (const shortLookback of SHORT_LOOKBACKS) {
    for (const longLookback of LONG_LOOKBACKS) {
      if (shortLookback >= longLookback) continue;
      strategies.push(makeStrategy(`pair_hot_fade_s${shortLookback}_l${longLookback}`, "recent-vs-long", ({ target, index }) => {
        const shortStart = clampStart(index, shortLookback);
        const longStart = clampStart(index, longLookback);
        if (index - longStart < 40) return null;
        return bestPairByScore((pairIndex) => pairRate(target, pairIndex, longStart, index) - pairRate(target, pairIndex, shortStart, index));
      }));

      strategies.push(makeStrategy(`pair_cold_continue_s${shortLookback}_l${longLookback}`, "recent-vs-long", ({ target, index }) => {
        const shortStart = clampStart(index, shortLookback);
        const longStart = clampStart(index, longLookback);
        if (index - longStart < 40) return null;
        return bestPairByScore((pairIndex) => 0.65 * pairRate(target, pairIndex, shortStart, index) + 0.35 * pairRate(target, pairIndex, longStart, index));
      }));
    }
  }

  for (const lookback of LOOKBACKS) {
    strategies.push(makeStrategy(`pair_failed_recently_l${lookback}`, "gap", ({ target, index }) => {
      const start = clampStart(index, lookback);
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => pairRate(target, pairIndex, start, index) - pairLastFailedGap(target, pairIndex, index) / 120);
    }));

    strategies.push(makeStrategy(`pair_absent_streak_l${lookback}`, "gap", ({ target, index }) => {
      const start = clampStart(index, lookback);
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => pairRate(target, pairIndex, start, index) + pairLastAbsentGap(target, pairIndex, index) / 120);
    }));
  }

  for (const lookback of LOOKBACKS) {
    strategies.push(makeStrategy(`same_weekday_pair_l${lookback}`, "calendar", ({ target, targetRows, index }) => {
      const weekday = targetRows[index].record.day;
      const matches = [];
      for (let cursor = index - 1; cursor >= 0 && matches.length < lookback; cursor--) {
        if (targetRows[cursor].record.day === weekday) matches.push(cursor);
      }
      if (matches.length < 8) return null;
      return bestPairByScore((pairIndex) => matches.reduce((sum, cursor) => sum + (isPairAbsent(pairIndex, target.masks[cursor]) ? 1 : 0), 0) / matches.length);
    }));
  }

  for (const lookback of LOOKBACKS) {
    strategies.push(makeStrategy(`opposite_side_pair_l${lookback}`, "opposite-side", ({ opposite, index }) => {
      const start = clampStart(index, lookback);
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => pairRate(opposite, pairIndex, start, index));
    }));

    strategies.push(makeStrategy(`opposite_side_hot_fade_l${lookback}`, "opposite-side", ({ opposite, index }) => {
      const start = clampStart(index, lookback);
      const recentStart = clampStart(index, Math.min(14, lookback));
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => pairRate(opposite, pairIndex, start, index) - 0.4 * pairRate(opposite, pairIndex, recentStart, index));
    }));
  }

  for (const lookback of LOOKBACKS) {
    strategies.push(makeStrategy(`source_pair_l${lookback}`, "source-market", ({ source, sourceIndex }) => {
      if (!source) return null;
      const start = clampStart(sourceIndex, lookback);
      if (sourceIndex - start < 20) return null;
      return bestPairByScore((pairIndex) => pairRate(source, pairIndex, start, sourceIndex));
    }));

    strategies.push(makeStrategy(`source_digit_absence_l${lookback}`, "source-market", ({ source, sourceIndex }) => {
      if (!source) return null;
      const start = clampStart(sourceIndex, lookback);
      if (sourceIndex - start < 20) return null;
      return bestPairByScore((pairIndex) => {
        const [a, b] = PAIRS[pairIndex].digits.map(Number);
        return digitAbsentRate(source, a, start, sourceIndex) + digitAbsentRate(source, b, start, sourceIndex);
      });
    }));
  }

  for (const lookback of LOOKBACKS) {
    strategies.push(makeStrategy(`prev_panel_digits_avoid_l${lookback}`, "previous-panel", ({ target, index }) => {
      if (index < 2) return null;
      const previousMask = target.masks[index - 1];
      return bestPairByScore((pairIndex) => {
        const overlap = uniqueCount(PAIRS[pairIndex].mask & previousMask);
        const start = clampStart(index, lookback);
        return overlap + (index - start >= 20 ? 0.25 * pairRate(target, pairIndex, start, index) : 0);
      }, "high");
    }));

    strategies.push(makeStrategy(`prev_panel_digits_exclude_l${lookback}`, "previous-panel", ({ target, index }) => {
      if (index < 2) return null;
      const previousMask = target.masks[index - 1];
      return bestPairByScore((pairIndex) => {
        const overlap = uniqueCount(PAIRS[pairIndex].mask & previousMask);
        const start = clampStart(index, lookback);
        return -overlap + (index - start >= 20 ? 0.25 * pairRate(target, pairIndex, start, index) : 0);
      });
    }));
  }

  for (const lookback of LOOKBACKS) {
    strategies.push(makeStrategy(`house_low_fade_l${lookback}`, "house", ({ target, index }) => {
      const lowPairs = new Set(PAIRS.map((pair, index) => [pair, index]).filter(([pair]) => pair.digits.every((digit) => Number(digit) <= 4)).map(([, index]) => index));
      const start = clampStart(index, lookback);
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => pairRate(target, pairIndex, start, index) + (lowPairs.has(pairIndex) ? 0.04 : 0));
    }));

    strategies.push(makeStrategy(`house_high_fade_l${lookback}`, "house", ({ target, index }) => {
      const highPairs = new Set(PAIRS.map((pair, index) => [pair, index]).filter(([pair]) => pair.digits.every((digit) => Number(digit) >= 5)).map(([, index]) => index));
      const start = clampStart(index, lookback);
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => pairRate(target, pairIndex, start, index) + (highPairs.has(pairIndex) ? 0.04 : 0));
    }));
  }

  for (const lookback of LOOKBACKS) {
    strategies.push(makeStrategy(`odd_even_mixed_l${lookback}`, "parity", ({ target, index }) => {
      const start = clampStart(index, lookback);
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => {
        const [a, b] = PAIRS[pairIndex].digits.map(Number);
        const mixed = a % 2 !== b % 2 ? 0.04 : 0;
        return pairRate(target, pairIndex, start, index) + mixed;
      });
    }));

    strategies.push(makeStrategy(`odd_even_same_l${lookback}`, "parity", ({ target, index }) => {
      const start = clampStart(index, lookback);
      if (index - start < 20) return null;
      return bestPairByScore((pairIndex) => {
        const [a, b] = PAIRS[pairIndex].digits.map(Number);
        const same = a % 2 === b % 2 ? 0.04 : 0;
        return pairRate(target, pairIndex, start, index) + same;
      });
    }));
  }

  for (const lookback of LOOKBACKS) {
    for (const threshold of THRESHOLDS) {
      strategies.push(makeStrategy(`gated_pair_rate_l${lookback}_t${Math.round(threshold * 100)}`, "gated", ({ target, index }) => {
        const start = clampStart(index, lookback);
        if (index - start < 20) return null;
        const best = bestPairByScore((pairIndex) => pairRate(target, pairIndex, start, index));
        return best.score >= threshold ? best : null;
      }, { gated: true }));
    }
  }

  return strategies;
}

function makeBucket() {
  return { n: 0, ok: 0 };
}

function addResult(bucket, ok) {
  bucket.n++;
  if (ok) bucket.ok++;
}

function finalize(bucket) {
  return {
    n: bucket.n,
    ok: bucket.ok,
    accuracy: bucket.n ? bucket.ok / bucket.n : 0,
  };
}

function evaluateStrategy({ strategy, targetRows, target, opposite, source, sourceRows, side, startIndex, endIndex }) {
  const bucket = makeBucket();
  for (let index = startIndex; index < endIndex; index++) {
    const sourceIndex = sourceRows ? sourceIndexByDate(sourceRows, targetRows[index].isoDate) : 0;
    const pick = strategy.pickPair({
      targetRows,
      target,
      opposite,
      source,
      sourceRows,
      sourceIndex,
      index,
      side,
    });
    if (!pick) continue;
    addResult(bucket, isPairAbsent(pick.pairIndex, target.masks[index]));
  }
  return finalize(bucket);
}

function buildFolds(rows) {
  const folds = [];
  const validationSize = 60;
  const testSize = 30;
  const step = 30;
  for (let testEnd = rows.length; testEnd - testSize - validationSize >= 80; testEnd -= step) {
    const testStart = testEnd - testSize;
    const validationEnd = testStart;
    const validationStart = validationEnd - validationSize;
    folds.push({ validationStart, validationEnd, testStart, testEnd });
    if (folds.length >= 8) break;
  }
  return folds.reverse();
}

function bestOracle(rows, side, startIndex, endIndex) {
  const masks = rows.slice(startIndex, endIndex).map((row) => maskForPanel(panelFor(row, side)));
  let best = { pairIndex: 0, accuracy: 0 };
  for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) {
    const ok = masks.filter((mask) => isPairAbsent(pairIndex, mask)).length;
    const accuracy = masks.length ? ok / masks.length : 0;
    if (accuracy > best.accuracy) best = { pairIndex, accuracy };
  }
  return best;
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function table(rows, columns) {
  const widths = columns.map((column) => Math.max(column.length, ...rows.map((row) => String(row[column] ?? "").length)));
  const line = (cells) => `| ${cells.map((cell, index) => String(cell).padEnd(widths[index])).join(" | ")} |`;
  const sep = `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`;
  return [line(columns), sep, ...rows.map((row) => line(columns.map((column) => row[column] ?? "")))].join("\n");
}

function main() {
  const recordsPath = path.join(process.cwd(), "scratch", "open-sutta-records-cache.json");
  const data = JSON.parse(fs.readFileSync(recordsPath, "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(data[market] ?? [])]));
  const seriesByKey = new Map();
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      seriesByKey.set(`${market}|${side}`, buildSeries(rowsByMarket[market] ?? [], side));
    }
  }

  const strategies = buildStrategies();
  const allRows = [];
  const selectedFoldRows = [];

  for (const market of MARKETS) {
    const targetRows = rowsByMarket[market] ?? [];
    if (targetRows.length < 180) continue;
    const folds = buildFolds(targetRows);

    for (const side of ["open", "close"]) {
      const target = seriesByKey.get(`${market}|${side}`);
      const opposite = seriesByKey.get(`${market}|${side === "open" ? "close" : "open"}`);
      const sourceMarket = SOURCE_MARKET[market];
      const sourceRows = sourceMarket ? rowsByMarket[sourceMarket] : null;
      const source = sourceMarket ? seriesByKey.get(`${sourceMarket}|${side}`) : null;

      for (const fold of folds) {
        const oracle = bestOracle(targetRows, side, fold.testStart, fold.testEnd);
        const evaluations = strategies.map((strategy) => {
          const validation = evaluateStrategy({
            strategy,
            targetRows,
            target,
            opposite,
            source,
            sourceRows,
            side,
            startIndex: fold.validationStart,
            endIndex: fold.validationEnd,
          });
          const test = evaluateStrategy({
            strategy,
            targetRows,
            target,
            opposite,
            source,
            sourceRows,
            side,
            startIndex: fold.testStart,
            endIndex: fold.testEnd,
          });
          return { strategy, validation, test };
        });

        const selected = evaluations
          .filter((row) => row.validation.n >= 20)
          .sort((a, b) => b.validation.accuracy - a.validation.accuracy || b.validation.n - a.validation.n || a.strategy.name.localeCompare(b.strategy.name))[0];

        selectedFoldRows.push({
          market,
          side,
          fold: `${targetRows[fold.testStart].isoDate}..${targetRows[fold.testEnd - 1].isoDate}`,
          selected: selected?.strategy.name ?? "none",
          family: selected?.strategy.family ?? "none",
          validation: selected?.validation ?? finalize(makeBucket()),
          test: selected?.test ?? finalize(makeBucket()),
          oraclePair: PAIRS[oracle.pairIndex].key,
          oracleAccuracy: oracle.accuracy,
        });

        for (const row of evaluations) {
          allRows.push({
            market,
            side,
            fold: `${targetRows[fold.testStart].isoDate}..${targetRows[fold.testEnd - 1].isoDate}`,
            strategy: row.strategy.name,
            family: row.strategy.family,
            validation: row.validation,
            test: row.test,
          });
        }
      }
    }
  }

  const byStrategy = new Map();
  for (const row of allRows) {
    const key = `${row.strategy}|${row.family}`;
    const bucket = byStrategy.get(key) ?? {
      strategy: row.strategy,
      family: row.family,
      folds: 0,
      validationN: 0,
      validationOk: 0,
      testN: 0,
      testOk: 0,
      wins80: 0,
    };
    bucket.folds++;
    bucket.validationN += row.validation.n;
    bucket.validationOk += row.validation.ok;
    bucket.testN += row.test.n;
    bucket.testOk += row.test.ok;
    if (row.test.n >= 20 && row.test.accuracy >= 0.8) bucket.wins80++;
    byStrategy.set(key, bucket);
  }

  const strategySummary = Array.from(byStrategy.values())
    .map((row) => ({
      ...row,
      validationAccuracy: row.validationN ? row.validationOk / row.validationN : 0,
      testAccuracy: row.testN ? row.testOk / row.testN : 0,
    }))
    .sort((a, b) => b.testAccuracy - a.testAccuracy || b.testN - a.testN);

  const selectedAgg = selectedFoldRows.reduce(
    (bucket, row) => {
      bucket.n += row.test.n;
      bucket.ok += row.test.ok;
      bucket.oracleSum += row.oracleAccuracy;
      bucket.folds++;
      if (row.test.n >= 20 && row.test.accuracy >= 0.8) bucket.test80++;
      return bucket;
    },
    { n: 0, ok: 0, oracleSum: 0, folds: 0, test80: 0 },
  );

  const marketSideRows = [];
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const rows = selectedFoldRows.filter((row) => row.market === market && row.side === side);
      if (!rows.length) continue;
      const n = rows.reduce((sum, row) => sum + row.test.n, 0);
      const ok = rows.reduce((sum, row) => sum + row.test.ok, 0);
      marketSideRows.push({
        market,
        side,
        folds: rows.length,
        selectedAccuracy: n ? ok / n : 0,
        avgOracle: rows.reduce((sum, row) => sum + row.oracleAccuracy, 0) / rows.length,
        hits80: rows.filter((row) => row.test.n >= 20 && row.test.accuracy >= 0.8).length,
        topFamilies: Object.entries(
          rows.reduce((counts, row) => {
            counts[row.family] = (counts[row.family] ?? 0) + 1;
            return counts;
          }, {}),
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([family, count]) => `${family}:${count}`)
          .join(", "),
      });
    }
  }

  const output = {
    generatedAt: new Date().toISOString(),
    recordsPath,
    strategiesTested: strategies.length,
    foldsTested: selectedFoldRows.length,
    selectedOverall: {
      n: selectedAgg.n,
      ok: selectedAgg.ok,
      accuracy: selectedAgg.n ? selectedAgg.ok / selectedAgg.n : 0,
      foldsAt80: selectedAgg.test80,
      avgHindsightOracle: selectedAgg.folds ? selectedAgg.oracleSum / selectedAgg.folds : 0,
    },
    marketSideRows,
    selectedFoldRows,
    strategySummary,
  };

  const outJson = path.join(process.cwd(), "scratch", "two-digit-avoid-strategy-lab-output.json");
  fs.writeFileSync(outJson, JSON.stringify(output, null, 2));

  const reportLines = [];
  reportLines.push("# Two-Digit Avoid Strategy Lab");
  reportLines.push("");
  reportLines.push(`Generated: ${output.generatedAt}`);
  reportLines.push(`Strategies tested: ${output.strategiesTested}`);
  reportLines.push(`Market-side folds tested: ${output.foldsTested}`);
  reportLines.push("");
  reportLines.push("## Overall Validation-Selected Result");
  reportLines.push("");
  reportLines.push(`- Strict 2-digit avoid accuracy: ${pct(output.selectedOverall.accuracy)} (${output.selectedOverall.ok}/${output.selectedOverall.n})`);
  reportLines.push(`- Folds at or above 80% strict accuracy: ${output.selectedOverall.foldsAt80}/${output.foldsTested}`);
  reportLines.push(`- Average hindsight oracle per fold: ${pct(output.selectedOverall.avgHindsightOracle)}`);
  reportLines.push("");
  reportLines.push("## Market / Side Summary");
  reportLines.push("");
  reportLines.push(
    table(
      marketSideRows.map((row) => ({
        market: row.market,
        side: row.side,
        folds: row.folds,
        selected: pct(row.selectedAccuracy),
        oracle: pct(row.avgOracle),
        "80% folds": row.hits80,
        families: row.topFamilies,
      })),
      ["market", "side", "folds", "selected", "oracle", "80% folds", "families"],
    ),
  );
  reportLines.push("");
  reportLines.push("## Top Global Strategies By Test Accuracy");
  reportLines.push("");
  reportLines.push(
    table(
      strategySummary.slice(0, 30).map((row) => ({
        strategy: row.strategy,
        family: row.family,
        folds: row.folds,
        val: pct(row.validationAccuracy),
        test: pct(row.testAccuracy),
        n: row.testN,
        "80% folds": row.wins80,
      })),
      ["strategy", "family", "folds", "val", "test", "n", "80% folds"],
    ),
  );

  const outMd = path.join(process.cwd(), "scratch", "two-digit-avoid-strategy-lab.md");
  fs.writeFileSync(outMd, `${reportLines.join("\n")}\n`);

  console.log(`Output JSON: ${outJson}`);
  console.log(`Report: ${outMd}`);
  console.log(`Strategies tested: ${output.strategiesTested}`);
  console.log(`Selected strict accuracy: ${pct(output.selectedOverall.accuracy)} (${output.selectedOverall.ok}/${output.selectedOverall.n})`);
  console.log(`Avg hindsight oracle: ${pct(output.selectedOverall.avgHindsightOracle)}`);
}

main();
