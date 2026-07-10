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

const DAY_OFFSETS = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
const PAIRS = [];
for (let a = 0; a <= 9; a++) for (let b = a + 1; b <= 9; b++) PAIRS.push({ key: `${a}${b}`, a, b, mask: (1 << a) | (1 << b) });

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
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

function panelFor(row, side) {
  return side === "open" ? row.record.openPanel : row.record.closePanel;
}

function maskFor(panel) {
  let mask = 0;
  for (const digit of String(panel || "").match(/\d/g) ?? []) mask |= 1 << Number(digit);
  return mask;
}

function uniqueCount(mask) {
  let count = 0;
  for (let digit = 0; digit <= 9; digit++) if (mask & (1 << digit)) count++;
  return count;
}

function panelKind(mask) {
  const count = uniqueCount(mask);
  if (count === 1) return "TP";
  if (count === 2) return "DP";
  return "SP";
}

function isAbsent(pairIndex, mask) {
  return (mask & PAIRS[pairIndex].mask) === 0;
}

function makePrefix(masks) {
  return PAIRS.map((pair) => {
    const prefix = [0];
    for (const mask of masks) prefix.push(prefix[prefix.length - 1] + ((mask & pair.mask) === 0 ? 1 : 0));
    return prefix;
  });
}

function makeDigitPrefix(masks) {
  return Array.from({ length: 10 }, (_, digit) => {
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

function count(prefix, start, end) {
  return prefix[end] - prefix[start];
}

function rate(prefix, start, end) {
  return end > start ? count(prefix, start, end) / (end - start) : 0;
}

function bucket(value, edges) {
  for (const edge of edges) if (value < edge) return `<${edge}`;
  return `>=${edges[edges.length - 1]}`;
}

function findIndexBefore(rows, iso) {
  let index = rows.length;
  while (index > 0 && rows[index - 1].isoDate >= iso) index--;
  return index;
}

function buildSeries(rows, side) {
  const masks = rows.map((row) => maskFor(panelFor(row, side)));
  return { rows, masks, pairPrefix: makePrefix(masks), digitPrefix: makeDigitPrefix(masks) };
}

function pairRate(series, pairIndex, index, lookback) {
  const start = Math.max(0, index - lookback);
  return rate(series.pairPrefix[pairIndex], start, index);
}

function digitAbsentRate(series, digit, index, lookback) {
  const start = Math.max(0, index - lookback);
  return rate(series.digitPrefix[digit].absent, start, index);
}

function gapSincePairFailed(series, pairIndex, index) {
  for (let gap = 1; gap <= Math.min(120, index); gap++) {
    if (!isAbsent(pairIndex, series.masks[index - gap])) return gap;
  }
  return 120;
}

function featuresFor({ market, side, pairIndex, index, target, opposite, source, sourceIndex }) {
  const pair = PAIRS[pairIndex];
  const previousMask = index > 0 ? target.masks[index - 1] : 0;
  const previousOppositeMask = index > 0 ? opposite.masks[index - 1] : 0;
  const previousSourceMask = source && sourceIndex > 0 ? source.masks[sourceIndex - 1] : 0;
  const row = target.rows[index];
  const pairKey = pair.key;
  const pairSum = (pair.a + pair.b) % 10;
  const pairHouse = pair.a <= 4 && pair.b <= 4 ? "low" : pair.a >= 5 && pair.b >= 5 ? "high" : "mixed";
  const pairParity = pair.a % 2 === pair.b % 2 ? "same" : "mixed";
  const features = [
    `market=${market}`,
    `side=${side}`,
    `day=${row.record.day}`,
    `pair=${pairKey}`,
    `pair.sum=${pairSum}`,
    `pair.house=${pairHouse}`,
    `pair.parity=${pairParity}`,
    `pair.has0=${pair.a === 0 || pair.b === 0}`,
    `pair.has789=${pair.a >= 7 || pair.b >= 7}`,
    `prev.kind=${panelKind(previousMask)}`,
    `prev.pairOverlap=${uniqueCount(previousMask & pair.mask)}`,
    `prevOpp.kind=${panelKind(previousOppositeMask)}`,
    `prevOpp.pairOverlap=${uniqueCount(previousOppositeMask & pair.mask)}`,
  ];

  if (source) {
    features.push(`source.prev.kind=${panelKind(previousSourceMask)}`);
    features.push(`source.prev.pairOverlap=${uniqueCount(previousSourceMask & pair.mask)}`);
  }

  for (const lookback of [7, 14, 30, 60, 90, 120, 180, 240]) {
    if (index >= Math.min(lookback, 20)) {
      const pr = pairRate(target, pairIndex, index, lookback);
      const arA = digitAbsentRate(target, pair.a, index, lookback);
      const arB = digitAbsentRate(target, pair.b, index, lookback);
      features.push(`pair.abs.l${lookback}=${bucket(pr, [0.45, 0.55, 0.65, 0.75])}`);
      features.push(`digit.minabs.l${lookback}=${bucket(Math.min(arA, arB), [0.65, 0.72, 0.78, 0.84])}`);
      features.push(`digit.sumabs.l${lookback}=${bucket(arA + arB, [1.35, 1.5, 1.65, 1.8])}`);
    }
  }

  if (index >= 60) {
    const recent = pairRate(target, pairIndex, index, 14);
    const medium = pairRate(target, pairIndex, index, 60);
    features.push(`pair.recentVs60=${bucket(recent - medium, [-0.2, -0.1, 0, 0.1, 0.2])}`);
  }

  features.push(`pair.failGap=${bucket(gapSincePairFailed(target, pairIndex, index), [2, 4, 8, 16, 32, 64])}`);
  return features;
}

function addStats(map, key, ok) {
  const bucket = map.get(key) ?? { key, n: 0, ok: 0 };
  bucket.n++;
  if (ok) bucket.ok++;
  map.set(key, bucket);
}

function mineRules(cases, minSupport) {
  const singleStats = new Map();
  for (const item of cases) {
    for (const feature of item.features) addStats(singleStats, feature, item.ok);
  }

  const topFeatures = Array.from(singleStats.values())
    .map((rule) => ({ ...rule, precision: rule.n ? rule.ok / rule.n : 0 }))
    .filter((rule) => rule.n >= minSupport && rule.precision >= 0.56)
    .sort((a, b) => b.precision - a.precision || b.n - a.n)
    .slice(0, 45);

  const featureRank = new Map(topFeatures.map((rule, index) => [rule.key, index]));
  const topFeatureSet = new Set(topFeatures.map((rule) => rule.key));
  const stats = new Map(topFeatures.map((rule) => [rule.key, { key: rule.key, n: rule.n, ok: rule.ok }]));

  for (const item of cases) {
    const selected = item.features
      .filter((feature) => topFeatureSet.has(feature))
      .sort((a, b) => featureRank.get(a) - featureRank.get(b))
      .slice(0, 8);
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) addStats(stats, `${selected[i]} && ${selected[j]}`, item.ok);
    }
  }

  return Array.from(stats.values())
    .map((rule) => ({ ...rule, precision: rule.n ? rule.ok / rule.n : 0, parts: rule.key.split(" && ") }))
    .filter((rule) => rule.n >= minSupport && rule.precision >= 0.7)
    .sort((a, b) => b.precision - a.precision || b.n - a.n)
    .slice(0, 120);
}

function buildCases({ market, side, rows, target, opposite, source, sourceRows, startIndex, endIndex }) {
  const cases = [];
  for (let index = startIndex; index < endIndex; index++) {
    const sourceIndex = sourceRows ? findIndexBefore(sourceRows, rows[index].isoDate) : 0;
    for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) {
      cases.push({
        index,
        pairIndex,
        ok: isAbsent(pairIndex, target.masks[index]),
        features: featuresFor({ market, side, pairIndex, index, target, opposite, source, sourceIndex }),
      });
    }
  }
  return cases;
}

function ruleMatches(rule, featureSet) {
  return rule.parts.every((part) => featureSet.has(part));
}

function evaluateRuleSet(rules, cases) {
  const byIndex = new Map();
  for (const item of cases) {
    if (!item.featureSet) item.featureSet = new Set(item.features);
    let bestRule = null;
    for (const rule of rules) {
      if (ruleMatches(rule, item.featureSet)) {
        bestRule = rule;
        break;
      }
    }
    if (!bestRule) continue;
    const score = bestRule.precision * 100000 + bestRule.n;
    const existing = byIndex.get(item.index);
    if (!existing || score > existing.score) byIndex.set(item.index, { score, ok: item.ok, pairIndex: item.pairIndex, rule: bestRule });
  }
  const picks = Array.from(byIndex.values());
  const ok = picks.filter((pick) => pick.ok).length;
  return {
    n: picks.length,
    ok,
    accuracy: picks.length ? ok / picks.length : 0,
    coverage: cases.length ? picks.length / (cases.length / PAIRS.length) : 0,
    picks,
  };
}

function buildFolds(rows) {
  const folds = [];
  const trainMin = 120;
  const trainSize = 180;
  const validationSize = 30;
  const testSize = 30;
  const step = 30;
  for (let testEnd = rows.length; testEnd - testSize - validationSize >= trainMin; testEnd -= step) {
    const testStart = testEnd - testSize;
    const validationEnd = testStart;
    const validationStart = validationEnd - validationSize;
    folds.push({ trainStart: Math.max(0, validationStart - trainSize), trainEnd: validationStart, validationStart, validationEnd, testStart, testEnd });
    if (folds.length >= 1) break;
  }
  return folds.reverse();
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scratch", "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(data[market] ?? [])]));
  const series = new Map();
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) series.set(`${market}|${side}`, buildSeries(rowsByMarket[market] ?? [], side));
  }

  const foldRows = [];
  for (const market of MARKETS) {
    const rows = rowsByMarket[market] ?? [];
    if (rows.length < 220) continue;
    const folds = buildFolds(rows);
    for (const side of ["open", "close"]) {
      const target = series.get(`${market}|${side}`);
      const opposite = series.get(`${market}|${side === "open" ? "close" : "open"}`);
      const sourceMarket = SOURCE_MARKET[market];
      const sourceRows = sourceMarket ? rowsByMarket[sourceMarket] : null;
      const source = sourceMarket ? series.get(`${sourceMarket}|${side}`) : null;
      for (const fold of folds) {
        const args = { market, side, rows, target, opposite, source, sourceRows };
        const trainCases = buildCases({ ...args, startIndex: fold.trainStart, endIndex: fold.trainEnd });
        const validationCases = buildCases({ ...args, startIndex: fold.validationStart, endIndex: fold.validationEnd });
        const testCases = buildCases({ ...args, startIndex: fold.testStart, endIndex: fold.testEnd });
        const rules = mineRules(trainCases, 18);
        const validation = evaluateRuleSet(rules, validationCases);
        const acceptedRules = validation.n >= 8 && validation.accuracy >= 0.74 ? rules : [];
        const test = evaluateRuleSet(acceptedRules, testCases);
        foldRows.push({
          market,
          side,
          fold: `${rows[fold.testStart].isoDate}..${rows[fold.testEnd - 1].isoDate}`,
          rules: rules.length,
          accepted: acceptedRules.length > 0,
          validation: { n: validation.n, ok: validation.ok, accuracy: validation.accuracy, coverage: validation.coverage },
          test: { n: test.n, ok: test.ok, accuracy: test.accuracy, coverage: test.coverage },
          topRule: rules[0] ? { key: rules[0].key, n: rules[0].n, precision: rules[0].precision } : null,
        });
      }
    }
  }

  const accepted = foldRows.filter((row) => row.accepted);
  const agg = accepted.reduce((bucket, row) => {
    bucket.n += row.test.n;
    bucket.ok += row.test.ok;
    bucket.folds++;
    if (row.test.n > 0 && row.test.accuracy >= 0.8) bucket.folds80++;
    return bucket;
  }, { n: 0, ok: 0, folds: 0, folds80: 0 });

  const output = {
    generatedAt: new Date().toISOString(),
    folds: foldRows.length,
    acceptedFolds: accepted.length,
    aggregate: {
      n: agg.n,
      ok: agg.ok,
      accuracy: agg.n ? agg.ok / agg.n : 0,
      folds80: agg.folds80,
    },
    foldRows,
  };

  const outPath = path.join(process.cwd(), "scratch", "two-digit-avoid-rule-miner-output.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Output: ${outPath}`);
  console.log(`Accepted folds: ${accepted.length}/${foldRows.length}`);
  console.log(`Aggregate test accuracy: ${pct(output.aggregate.accuracy)} (${output.aggregate.ok}/${output.aggregate.n})`);
  console.log(`Accepted folds >=80%: ${output.aggregate.folds80}`);
  console.log("Top accepted folds:");
  for (const row of accepted.sort((a, b) => b.test.accuracy - a.test.accuracy || b.test.n - a.test.n).slice(0, 20)) {
    console.log(`${row.market} ${row.side} ${row.fold}: val ${pct(row.validation.accuracy)} n=${row.validation.n}, test ${pct(row.test.accuracy)} n=${row.test.n}, rule=${row.topRule?.key ?? "none"}`);
  }
}

main();
