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

const DAY_OFFSETS = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
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

function findIndexBefore(rows, iso) {
  let index = rows.length;
  while (index > 0 && rows[index - 1].isoDate >= iso) index--;
  return index;
}

function rollingCounts(rows, side, index, lookback) {
  const counts = Array(10).fill(0);
  const start = Math.max(0, index - lookback);
  for (let i = start; i < index; i++) {
    const mask = maskFor(panelFor(rows[i], side));
    for (let digit = 0; digit <= 9; digit++) if (mask & (1 << digit)) counts[digit]++;
  }
  return counts;
}

function rankedDigits(rows, side, index, lookback) {
  const counts = rollingCounts(rows, side, index, lookback);
  const cold = counts.map((count, digit) => ({ digit, count })).sort((a, b) => a.count - b.count || a.digit - b.digit);
  const hot = counts.map((count, digit) => ({ digit, count })).sort((a, b) => b.count - a.count || a.digit - b.digit);
  return { cold, hot, counts };
}

function previousFeatureSet(prefix, row, side) {
  if (!row) return [`${prefix}.missing`];
  const sameMask = maskFor(panelFor(row, side));
  const oppMask = maskFor(panelFor(row, side === "open" ? "close" : "open"));
  return [
    `${prefix}.sameKind=${panelKind(sameMask)}`,
    `${prefix}.oppKind=${panelKind(oppMask)}`,
    `${prefix}.sameSutta=${suttaFor(row, side)}`,
    `${prefix}.oppSutta=${suttaFor(row, side === "open" ? "close" : "open")}`,
    `${prefix}.sameHouse=${suttaFor(row, side) <= 4 ? "low" : "high"}`,
    `${prefix}.oppHouse=${suttaFor(row, side === "open" ? "close" : "open") <= 4 ? "low" : "high"}`,
  ];
}

function baseFeatures({ market, side, rowsByMarket, rows, index }) {
  const row = rows[index];
  const prev = rows[index - 1];
  const features = [
    `market=${market}`,
    `side=${side}`,
    `day=${row.record.day}`,
    `domBucket=${row.date.getUTCDate() <= 10 ? "early" : row.date.getUTCDate() <= 20 ? "mid" : "late"}`,
    `month=${row.date.getUTCMonth() + 1}`,
    ...previousFeatureSet("prev", prev, side),
  ];

  for (const lookback of [14, 30, 60, 90]) {
    if (index >= Math.min(lookback, 14)) {
      const ranked = rankedDigits(rows, side, index, lookback);
      features.push(`cold${lookback}.1=${ranked.cold[0].digit}`);
      features.push(`cold${lookback}.2=${ranked.cold[1].digit}`);
      features.push(`hot${lookback}.1=${ranked.hot[0].digit}`);
      features.push(`hot${lookback}.2=${ranked.hot[1].digit}`);
      features.push(`spread${lookback}=${ranked.hot[0].count - ranked.cold[0].count >= 5 ? "wide" : "flat"}`);
    }
  }

  const sourceMarket = SOURCE_MARKET[market];
  const sourceRows = sourceMarket ? rowsByMarket[sourceMarket] || [] : [];
  const sourceIndex = sourceMarket ? findIndexBefore(sourceRows, row.isoDate) : 0;
  if (sourceIndex > 0) features.push(...previousFeatureSet("sourcePrev", sourceRows[sourceIndex - 1], side));

  return [...new Set(features)];
}

function contextKeys(features) {
  const always = features.filter((feature) => feature.startsWith("market=") || feature.startsWith("side="));
  const candidates = features.filter((feature) => !always.includes(feature));
  const keys = [];
  for (const feature of candidates) keys.push([...always, feature].join("|"));
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      if (keys.length > 80) break;
      keys.push([...always, candidates[i], candidates[j]].join("|"));
    }
    if (keys.length > 80) break;
  }
  return keys;
}

function buildRows({ market, side, rowsByMarket }) {
  const rows = rowsByMarket[market];
  return rows.map((row, index) => ({
    index,
    isoDate: row.isoDate,
    mask: maskFor(panelFor(row, side)),
    contexts: contextKeys(baseFeatures({ market, side, rowsByMarket, rows, index })),
  }));
}

function addStats(stats, key, pairIndex, ok) {
  const fullKey = `${key}::${pairIndex}`;
  const bucket = stats.get(fullKey) || { key, pairIndex, n: 0, ok: 0 };
  bucket.n++;
  if (ok) bucket.ok++;
  stats.set(fullKey, bucket);
}

function collectStats(rows, start, end) {
  const stats = new Map();
  for (let i = start; i < end; i++) {
    const row = rows[i];
    for (const context of row.contexts) {
      for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) addStats(stats, context, pairIndex, isAbsent(pairIndex, row.mask));
    }
  }
  return stats;
}

function scoreCandidatesFromStats(trainStats, valStats, config) {
  const candidates = [];
  for (const train of trainStats.values()) {
    const val = valStats.get(`${train.key}::${train.pairIndex}`) || { n: 0, ok: 0 };
    const trainAcc = train.ok / train.n;
    const valAcc = val.n ? val.ok / val.n : 0;
    if (train.n < config.minTrainN || val.n < config.minValN) continue;
    if (trainAcc < config.minTrainAcc || valAcc < config.minValAcc) continue;
    candidates.push({
      key: train.key,
      pairIndex: train.pairIndex,
      trainN: train.n,
      trainAcc,
      valN: val.n,
      valAcc,
      score: valAcc * 1000 + trainAcc * 100 + Math.min(train.n, 80) + Math.min(val.n, 30),
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, config.maxCandidates);
}

function testCandidates(rows, candidates, start, end) {
  let correct = 0;
  let total = 0;
  const predictions = [];
  for (let i = start; i < end; i++) {
    const contextSet = new Set(rows[i].contexts);
    const candidate = candidates.find((item) => contextSet.has(item.key));
    if (!candidate) continue;
    const hit = isAbsent(candidate.pairIndex, rows[i].mask);
    correct += hit ? 1 : 0;
    total++;
    predictions.push({ date: rows[i].isoDate, pair: PAIRS[candidate.pairIndex].key, hit, context: candidate.key });
  }
  return { correct, total, accuracy: total ? correct / total : 0, predictions };
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(raw[market] || [])]));
  const configs = [];
  for (const minTrainN of [18, 24, 30, 40]) {
    for (const minValN of [4, 6, 8]) {
      for (const minTrainAcc of [0.72, 0.78, 0.82]) {
        for (const minValAcc of [0.75, 0.8, 0.85]) {
          for (const maxCandidates of [1, 3, 5]) configs.push({ minTrainN, minValN, minTrainAcc, minValAcc, maxCandidates });
        }
      }
    }
  }

  const selected = [];
  const diagnostics = [];
  let folds = 0;
  for (const market of MARKETS) {
    for (const side of ["open", "close"]) {
      const rows = buildRows({ market, side, rowsByMarket });
      for (const testEnd of [rows.length, rows.length - 30, rows.length - 60, rows.length - 90, rows.length - 120]) {
        const testStart = testEnd - 30;
        const valEnd = testStart;
        const valStart = valEnd - 90;
        const trainEnd = valStart;
        const trainStart = Math.max(0, trainEnd - 365);
        if (trainEnd - trainStart < 240 || valStart < 0 || testStart < 0) continue;
        folds++;
        let best = null;
        const trainStats = collectStats(rows, trainStart, trainEnd);
        const valStats = collectStats(rows, valStart, valEnd);
        for (const config of configs) {
          const candidates = scoreCandidatesFromStats(trainStats, valStats, config);
          if (!candidates.length) continue;
          const valReplay = testCandidates(rows, candidates, valStart, valEnd);
          if (valReplay.total < config.minValN || valReplay.accuracy < config.minValAcc) continue;
          const rankScore = valReplay.accuracy * 1000 + Math.min(valReplay.total, 20) + candidates[0].trainAcc * 10;
          if (!best || rankScore > best.rankScore) best = { config, candidates, valReplay, rankScore };
        }
        if (!best) continue;
        const test = testCandidates(rows, best.candidates, testStart, testEnd);
        const row = { market, side, testWindow: `${rows[testStart].isoDate}..${rows[testEnd - 1].isoDate}`, config: best.config, val: best.valReplay, test, candidates: best.candidates.slice(0, 3) };
        diagnostics.push(row);
        if (best.valReplay.accuracy >= 0.8 && best.valReplay.total >= 6) selected.push(row);
      }
    }
  }

  const total = selected.reduce((sum, row) => sum + row.test.total, 0);
  const correct = selected.reduce((sum, row) => sum + row.test.correct, 0);
  const output = {
    generatedAt: new Date().toISOString(),
    configs: configs.length,
    folds,
    selectedCount: selected.length,
    aggregate: { correct, total, accuracy: total ? correct / total : 0 },
    selected,
    diagnostics: diagnostics.sort((a, b) => b.val.accuracy - a.val.accuracy || b.val.total - a.val.total).slice(0, 50),
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-durable-pocket-miner-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Durable Pocket Miner");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Configs tested: ${configs.length}`);
  lines.push(`Folds tested: ${folds}`);
  lines.push(`Validation-gated selected folds: ${selected.length}`);
  lines.push(`Aggregate strict test accuracy: ${total ? pct(correct / total) : "n/a"} (${correct}/${total})`);
  lines.push(`Selected folds >=80% strict test: ${selected.filter((row) => row.test.total && row.test.accuracy >= 0.8).length}/${selected.length}`);
  lines.push("");
  lines.push("## Selected Pockets");
  lines.push("");
  lines.push("| Market | Side | Test Window | Val | Test | Top Pair |");
  lines.push("|---|---|---|---:|---:|---|");
  for (const row of selected) {
    const top = row.candidates[0];
    lines.push(`| ${row.market} | ${row.side} | ${row.testWindow} | ${pct(row.val.accuracy)} n=${row.val.total} | ${row.test.total ? pct(row.test.accuracy) : "n/a"} n=${row.test.total} | ${PAIRS[top.pairIndex].key} |`);
  }
  lines.push("");
  lines.push("## Best Diagnostics");
  lines.push("");
  lines.push("| Market | Side | Test Window | Val | Test |");
  lines.push("|---|---|---|---:|---:|");
  for (const row of output.diagnostics.slice(0, 30)) {
    lines.push(`| ${row.market} | ${row.side} | ${row.testWindow} | ${pct(row.val.accuracy)} n=${row.val.total} | ${row.test.total ? pct(row.test.accuracy) : "n/a"} n=${row.test.total} |`);
  }
  fs.writeFileSync(path.join(__dirname, "two-digit-durable-pocket-miner.md"), lines.join("\n"));
  console.log(lines.join("\n"));
}

main();
