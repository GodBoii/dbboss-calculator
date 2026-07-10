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
const DIGITS = Array.from({ length: 10 }, (_, digit) => digit);
const PAIRS = [];
for (let a = 0; a <= 9; a++) {
  for (let b = a + 1; b <= 9; b++) PAIRS.push({ key: `${a}${b}`, a, b, mask: (1 << a) | (1 << b) });
}

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
  for (const digit of DIGITS) if (mask & (1 << digit)) count++;
  return count;
}

function isAbsent(pairIndex, mask) {
  return (mask & PAIRS[pairIndex].mask) === 0;
}

function makePairPrefix(masks) {
  return PAIRS.map((pair) => {
    const prefix = [0];
    for (const mask of masks) prefix.push(prefix[prefix.length - 1] + ((mask & pair.mask) === 0 ? 1 : 0));
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

function rate(prefix, start, end) {
  return end > start ? prefixCount(prefix, start, end) / (end - start) : 0;
}

function buildSeries(rows, side) {
  const masks = rows.map((row) => maskFor(panelFor(row, side)));
  return { rows, masks, pairPrefix: makePairPrefix(masks), digitPrefix: makeDigitPrefix(masks) };
}

function findIndexBefore(rows, iso) {
  let index = rows.length;
  while (index > 0 && rows[index - 1].isoDate >= iso) index--;
  return index;
}

function pairRate(series, pairIndex, index, lookback) {
  const start = Math.max(0, index - lookback);
  return rate(series.pairPrefix[pairIndex], start, index);
}

function digitAbsentRate(series, digit, index, lookback) {
  const start = Math.max(0, index - lookback);
  return rate(series.digitPrefix[digit].absent, start, index);
}

function digitPresentRate(series, digit, index, lookback) {
  const start = Math.max(0, index - lookback);
  return rate(series.digitPrefix[digit].present, start, index);
}

function gapSince(series, pairIndex, index, wantedAbsent) {
  for (let gap = 1; gap <= Math.min(180, index); gap++) {
    if (isAbsent(pairIndex, series.masks[index - gap]) === wantedAbsent) return gap;
  }
  return 180;
}

function bestPair(scoreFn) {
  let best = null;
  for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) {
    const score = scoreFn(pairIndex);
    if (!Number.isFinite(score)) continue;
    if (!best || score > best.score) best = { pairIndex, score };
  }
  return best;
}

function sourceIndex(allSeries, market, side, iso) {
  const sourceMarket = SOURCE_MARKET[market];
  if (!sourceMarket) return null;
  const source = allSeries[sourceMarket]?.[side];
  if (!source) return null;
  return { source, index: findIndexBefore(source.rows, iso) };
}

function buildTheories() {
  const theories = [];
  const add = (name, family, pick) => theories.push({ name, family, pick });

  for (const lookback of [7, 14, 21, 30, 45, 60, 90, 120, 180, 240, 365]) {
    add(`pair_absence_l${lookback}`, "target", ({ target, index }) => {
      if (index < Math.min(20, lookback)) return null;
      return bestPair((pairIndex) => pairRate(target, pairIndex, index, lookback));
    });
    add(`pair_absence_minus_recent_l${lookback}`, "target", ({ target, index }) => {
      if (index < Math.min(20, lookback)) return null;
      return bestPair((pairIndex) => pairRate(target, pairIndex, index, lookback) - 0.45 * pairRate(target, pairIndex, index, 7));
    });
    add(`digit_absence_sum_l${lookback}`, "digit", ({ target, index }) => {
      if (index < Math.min(20, lookback)) return null;
      return bestPair((pairIndex) => {
        const pair = PAIRS[pairIndex];
        return digitAbsentRate(target, pair.a, index, lookback) + digitAbsentRate(target, pair.b, index, lookback);
      });
    });
    add(`digit_absence_min_l${lookback}`, "digit", ({ target, index }) => {
      if (index < Math.min(20, lookback)) return null;
      return bestPair((pairIndex) => {
        const pair = PAIRS[pairIndex];
        return Math.min(digitAbsentRate(target, pair.a, index, lookback), digitAbsentRate(target, pair.b, index, lookback));
      });
    });
    add(`digit_present_fade_l${lookback}`, "digit", ({ target, index }) => {
      if (index < Math.min(20, lookback)) return null;
      return bestPair((pairIndex) => {
        const pair = PAIRS[pairIndex];
        return -(digitPresentRate(target, pair.a, index, lookback) + digitPresentRate(target, pair.b, index, lookback));
      });
    });
  }

  for (const lookback of [14, 30, 60, 90, 180, 240]) {
    add(`opposite_pair_absence_l${lookback}`, "opposite", ({ opposite, index }) => {
      if (index < Math.min(20, lookback)) return null;
      return bestPair((pairIndex) => pairRate(opposite, pairIndex, index, lookback));
    });
    add(`opposite_hot_fade_l${lookback}`, "opposite", ({ opposite, index }) => {
      if (index < Math.min(20, lookback)) return null;
      return bestPair((pairIndex) => pairRate(opposite, pairIndex, index, lookback) - 0.35 * pairRate(opposite, pairIndex, index, 7));
    });
    add(`source_pair_absence_l${lookback}`, "source", ({ source, sourceIdx }) => {
      if (!source || sourceIdx < Math.min(20, lookback)) return null;
      return bestPair((pairIndex) => pairRate(source, pairIndex, sourceIdx, lookback));
    });
  }

  for (const mode of ["avoid_previous", "avoid_opposite_previous", "prefer_failed_gap", "prefer_absent_gap", "mixed_house", "edge_house"]) {
    add(mode, "shape", ({ target, opposite, index }) => {
      if (index < 20) return null;
      const prev = target.masks[index - 1] || 0;
      const oppPrev = opposite.masks[index - 1] || 0;
      return bestPair((pairIndex) => {
        const pair = PAIRS[pairIndex];
        if (mode === "avoid_previous") return -uniqueCount(prev & pair.mask);
        if (mode === "avoid_opposite_previous") return -uniqueCount(oppPrev & pair.mask);
        if (mode === "prefer_failed_gap") return gapSince(target, pairIndex, index, false);
        if (mode === "prefer_absent_gap") return -gapSince(target, pairIndex, index, true);
        if (mode === "mixed_house") return pair.a <= 4 && pair.b >= 5 ? 1 : 0;
        if (mode === "edge_house") return pair.a === 0 || pair.b === 9 ? 1 : 0;
        return 0;
      });
    });
  }

  return theories;
}

function votePick(theories, context, config) {
  const votes = new Array(PAIRS.length).fill(0);
  const familyVotes = new Map();
  for (const theory of theories) {
    if (config.families && !config.families.includes(theory.family)) continue;
    const picked = theory.pick(context);
    if (!picked) continue;
    const weight = config.weightFamilies ? config.weightFamilies[theory.family] ?? 1 : 1;
    votes[picked.pairIndex] += weight;
    familyVotes.set(picked.pairIndex, (familyVotes.get(picked.pairIndex) || new Set()).add(theory.family));
  }
  const ranked = votes
    .map((score, pairIndex) => ({ pairIndex, score, families: familyVotes.get(pairIndex)?.size || 0 }))
    .sort((a, b) => b.score - a.score || b.families - a.families);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.score < config.minVotes) return null;
  if (top.families < config.minFamilies) return null;
  if (top.score - second.score < config.minMargin) return null;
  return top.pairIndex;
}

function simulateRange({ allSeries, market, side, start, end, theories, config }) {
  const target = allSeries[market][side];
  const opposite = allSeries[market][side === "open" ? "close" : "open"];
  let correct = 0;
  let total = 0;
  const picks = [];
  for (let index = start; index < end; index++) {
    const sourceInfo = sourceIndex(allSeries, market, side, target.rows[index].isoDate);
    const pairIndex = votePick(theories, {
      market,
      side,
      target,
      opposite,
      index,
      source: sourceInfo?.source,
      sourceIdx: sourceInfo?.index ?? 0,
    }, config);
    if (pairIndex == null) continue;
    const hit = isAbsent(pairIndex, target.masks[index]);
    correct += hit ? 1 : 0;
    total++;
    picks.push({ date: target.rows[index].isoDate, pair: PAIRS[pairIndex].key, hit });
  }
  return { correct, total, accuracy: total ? correct / total : 0, picks };
}

function pct(value) {
  return `${(100 * value).toFixed(1)}%`;
}

function main() {
  const cachePath = path.join(__dirname, "open-sutta-records-cache.json");
  const raw = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  const allSeries = {};
  for (const market of MARKETS) {
    const rows = dated(raw[market] || []);
    allSeries[market] = { open: buildSeries(rows, "open"), close: buildSeries(rows, "close") };
  }

  const theories = buildTheories();
  const configs = [];
  const familySets = [
    null,
    ["target", "digit", "opposite", "source", "shape"],
    ["target", "digit"],
    ["target", "opposite", "source"],
    ["target", "digit", "shape"],
    ["digit", "opposite", "source"],
  ];
  for (const families of familySets) {
    for (const minVotes of [6, 8, 10, 12, 14, 16]) {
      for (const minFamilies of [2, 3, 4]) {
        for (const minMargin of [1, 2, 3, 5]) configs.push({ families, minVotes, minFamilies, minMargin });
      }
    }
  }

  const folds = [];
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const n = allSeries[market][side].rows.length;
      for (const testEnd of [n, n - 30, n - 60, n - 90]) {
        const testStart = testEnd - 30;
        const valEnd = testStart;
        const valStart = valEnd - 45;
        if (valStart < 240 || testStart < 0) continue;
        folds.push({ market, side, valStart, valEnd, testStart, testEnd });
      }
    }
  }

  const selected = [];
  const diagnostics = [];
  for (const fold of folds) {
    let best = null;
    for (const config of configs) {
      const val = simulateRange({ allSeries, theories, config, market: fold.market, side: fold.side, start: fold.valStart, end: fold.valEnd });
      if (val.total < 5) continue;
      const score = val.accuracy - 0.025 * Math.max(0, 12 - val.total);
      if (!best || score > best.score || (score === best.score && val.total > best.val.total)) best = { config, val, score };
    }
    if (!best) continue;
    const test = simulateRange({ allSeries, theories, config: best.config, market: fold.market, side: fold.side, start: fold.testStart, end: fold.testEnd });
    diagnostics.push({ ...fold, config: best.config, val: best.val, test });
    if (best.val.accuracy >= 0.8 && best.val.total >= 8) selected.push({ ...fold, config: best.config, val: best.val, test });
  }

  const total = selected.reduce((sum, row) => sum + row.test.total, 0);
  const correct = selected.reduce((sum, row) => sum + row.test.correct, 0);
  const high = selected.filter((row) => row.test.total > 0 && row.test.accuracy >= 0.8).length;
  const topDiag = diagnostics
    .sort((a, b) => b.val.accuracy - a.val.accuracy || b.val.total - a.val.total)
    .slice(0, 30);

  const output = {
    generatedAt: new Date().toISOString(),
    theories: theories.length,
    configs: configs.length,
    folds: folds.length,
    selectedCount: selected.length,
    aggregate: { correct, total, accuracy: total ? correct / total : 0 },
    selected,
    topDiagnostics: topDiag,
  };

  fs.writeFileSync(path.join(__dirname, "two-digit-abstention-guardian-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Abstention Guardian");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Base theories: ${theories.length}`);
  lines.push(`Guardian configs: ${configs.length}`);
  lines.push(`Folds tested: ${folds.length}`);
  lines.push(`Validation-gated selected folds: ${selected.length}`);
  lines.push(`Aggregate strict test accuracy: ${total ? pct(correct / total) : "n/a"} (${correct}/${total})`);
  lines.push(`Selected folds with >=80% strict test accuracy: ${high}/${selected.length}`);
  lines.push("");
  lines.push("## Selected By 80% Validation Gate");
  lines.push("");
  lines.push("| Market | Side | Test Window | Val | Test | Config |");
  lines.push("|---|---|---|---:|---:|---|");
  for (const row of selected) {
    const target = allSeries[row.market][row.side];
    const window = `${target.rows[row.testStart].isoDate}..${target.rows[row.testEnd - 1].isoDate}`;
    const fam = row.config.families ? row.config.families.join("+") : "all";
    lines.push(`| ${row.market} | ${row.side} | ${window} | ${pct(row.val.accuracy)} n=${row.val.total} | ${row.test.total ? pct(row.test.accuracy) : "n/a"} n=${row.test.total} | ${fam}; votes=${row.config.minVotes}; families=${row.config.minFamilies}; margin=${row.config.minMargin} |`);
  }
  lines.push("");
  lines.push("## Best Validation Diagnostics");
  lines.push("");
  lines.push("| Market | Side | Test Window | Val | Test |");
  lines.push("|---|---|---|---:|---:|");
  for (const row of topDiag) {
    const target = allSeries[row.market][row.side];
    const window = `${target.rows[row.testStart].isoDate}..${target.rows[row.testEnd - 1].isoDate}`;
    lines.push(`| ${row.market} | ${row.side} | ${window} | ${pct(row.val.accuracy)} n=${row.val.total} | ${row.test.total ? pct(row.test.accuracy) : "n/a"} n=${row.test.total} |`);
  }
  fs.writeFileSync(path.join(__dirname, "two-digit-abstention-guardian.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main();
