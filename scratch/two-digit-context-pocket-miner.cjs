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
for (let a = 0; a <= 9; a++) for (let b = a + 1; b <= 9; b++) PAIRS.push({ key: `${a}${b}`, mask: (1 << a) | (1 << b) });

const CONFIGS = [];
for (const contextMode of ["single"]) {
  for (const minSupport of [8, 12]) {
    for (const trainMinPrecision of [0.62, 0.7, 0.78]) {
      for (const validationMinAccuracy of [0.7, 0.78]) {
        CONFIGS.push({ contextMode, minSupport, trainMinPrecision, validationMinAccuracy });
      }
    }
  }
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
    .map((record) => ({ record, isoDate: isoDate(record), date: null }))
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

function rollingDigitCounts(rows, side, index, lookback) {
  const counts = Array(10).fill(0);
  const start = Math.max(0, index - lookback);
  for (let i = start; i < index; i++) {
    const mask = maskFor(panelFor(rows[i], side));
    for (let digit = 0; digit <= 9; digit++) if (mask & (1 << digit)) counts[digit]++;
  }
  return { counts, n: index - start };
}

function digitRankFeatures(prefix, rows, side, index, lookback) {
  const { counts, n } = rollingDigitCounts(rows, side, index, lookback);
  if (n < Math.min(lookback, 12)) return [];
  const rankedCold = counts.map((count, digit) => ({ digit, count })).sort((a, b) => a.count - b.count || a.digit - b.digit);
  const rankedHot = counts.map((count, digit) => ({ digit, count })).sort((a, b) => b.count - a.count || a.digit - b.digit);
  return [
    `${prefix}.l${lookback}.cold1=${rankedCold[0].digit}`,
    `${prefix}.l${lookback}.cold2=${rankedCold[1].digit}`,
    `${prefix}.l${lookback}.hot1=${rankedHot[0].digit}`,
    `${prefix}.l${lookback}.hot2=${rankedHot[1].digit}`,
    `${prefix}.l${lookback}.spread=${rankedHot[0].count - rankedCold[0].count >= 5 ? "wide" : "flat"}`,
  ];
}

function previousFeatures(prefix, row) {
  if (!row) return [`${prefix}.missing=true`];
  const openMask = maskFor(row.record.openPanel);
  const closeMask = maskFor(row.record.closePanel);
  return [
    `${prefix}.open.kind=${panelKind(openMask)}`,
    `${prefix}.close.kind=${panelKind(closeMask)}`,
    `${prefix}.open.sutta=${row.record.openSutta}`,
    `${prefix}.close.sutta=${row.record.closeSutta}`,
    `${prefix}.jodi=${row.record.jodi}`,
    `${prefix}.open.house=${row.record.openSutta <= 4 ? "low" : "high"}`,
    `${prefix}.close.house=${row.record.closeSutta <= 4 ? "low" : "high"}`,
  ];
}

function contextFeatures({ market, side, rows, rowsByMarket, index }) {
  const row = rows[index];
  const prev = rows[index - 1] ?? null;
  const sourceMarket = SOURCE_MARKET[market];
  const sourceRows = sourceMarket ? rowsByMarket[sourceMarket] ?? [] : [];
  const sourceIndex = sourceMarket ? findIndexBefore(sourceRows, row.isoDate) : 0;
  const sourcePrev = sourceIndex > 0 ? sourceRows[sourceIndex - 1] : null;
  const monthDay = row.date.getUTCDate();
  const features = [
    `market=${market}`,
    `side=${side}`,
    `day=${row.record.day}`,
    `dom.bucket=${monthDay <= 10 ? "early" : monthDay <= 20 ? "mid" : "late"}`,
    `dom.mod3=${monthDay % 3}`,
    `target.prev.sutta=${prev ? suttaFor(prev, side) : "none"}`,
    `target.prev.kind=${prev ? panelKind(maskFor(panelFor(prev, side))) : "none"}`,
    `target.prev.oppKind=${prev ? panelKind(maskFor(panelFor(prev, side === "open" ? "close" : "open"))) : "none"}`,
    ...previousFeatures("same.prev", prev),
    ...previousFeatures("source.prev", sourcePrev),
    ...digitRankFeatures("target", rows, side, index, 14),
    ...digitRankFeatures("target", rows, side, index, 30),
    ...digitRankFeatures("target", rows, side, index, 60),
  ];

  if (sourceMarket && sourceIndex > 12) {
    features.push(...digitRankFeatures("source", sourceRows, side, sourceIndex, 30));
  }

  return [...new Set(features)];
}

function contextsFromFeatures(features, mode) {
  if (mode === "single") return features;
  const important = features.filter((feature) =>
    feature.startsWith("day=") ||
    feature.includes(".kind=") ||
    feature.includes(".sutta=") ||
    feature.includes(".cold") ||
    feature.includes(".hot") ||
    feature.includes("dom."),
  );
  const contexts = [...features];
  for (let i = 0; i < important.length; i++) {
    for (let j = i + 1; j < important.length; j++) contexts.push(`${important[i]} && ${important[j]}`);
  }
  return contexts;
}

function buildFoldContexts(args, startIndex, endIndex, mode) {
  const rows = [];
  for (let index = startIndex; index < endIndex; index++) {
    const features = contextFeatures({ ...args, index });
    rows.push({ index, contexts: contextsFromFeatures(features, mode), mask: maskFor(panelFor(args.rows[index], args.side)) });
  }
  return rows;
}

function trainCandidates(trainRows, minSupport, trainMinPrecision) {
  const stats = new Map();
  for (const row of trainRows) {
    for (const context of row.contexts) {
      for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex++) {
        const key = `${context}::${pairIndex}`;
        const bucket = stats.get(key) ?? { context, pairIndex, n: 0, ok: 0 };
        bucket.n++;
        if (isAbsent(pairIndex, row.mask)) bucket.ok++;
        stats.set(key, bucket);
      }
    }
  }

  const byContext = new Map();
  for (const candidate of stats.values()) {
    candidate.precision = candidate.n ? candidate.ok / candidate.n : 0;
    if (candidate.n < minSupport || candidate.precision < trainMinPrecision) continue;
    const existing = byContext.get(candidate.context);
    if (!existing || candidate.precision > existing.precision || (candidate.precision === existing.precision && candidate.n > existing.n)) {
      byContext.set(candidate.context, candidate);
    }
  }
  return Array.from(byContext.values()).sort((a, b) => b.precision - a.precision || b.n - a.n);
}

function evaluateCandidates(candidates, rows) {
  const candidateByContext = new Map(candidates.map((candidate) => [candidate.context, candidate]));
  const bucket = { n: 0, ok: 0, picks: [] };
  for (const row of rows) {
    let best = null;
    for (const context of row.contexts) {
      const candidate = candidateByContext.get(context);
      if (!candidate) continue;
      const score = candidate.precision * 10000 + candidate.n;
      if (!best || score > best.score) best = { ...candidate, score };
    }
    if (!best) continue;
    const ok = isAbsent(best.pairIndex, row.mask);
    bucket.n++;
    if (ok) bucket.ok++;
    bucket.picks.push({ ok, pair: PAIRS[best.pairIndex].key, context: best.context, precision: best.precision, support: best.n });
  }
  return { n: bucket.n, ok: bucket.ok, accuracy: bucket.n ? bucket.ok / bucket.n : 0, picks: bucket.picks };
}

function buildFolds(rows) {
  const folds = [];
  const trainSize = 180;
  const validationSize = 30;
  const testSize = 30;
  for (let testEnd = rows.length; testEnd - testSize - validationSize >= 120; testEnd -= 30) {
    const testStart = testEnd - testSize;
    const validationEnd = testStart;
    const validationStart = validationEnd - validationSize;
    folds.push({ trainStart: Math.max(0, validationStart - trainSize), trainEnd: validationStart, validationStart, validationEnd, testStart, testEnd });
    if (folds.length >= 2) break;
  }
  return folds.reverse();
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scratch", "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(data[market] ?? [])]));
  const foldRows = [];

  for (const market of MARKETS) {
    const rows = rowsByMarket[market] ?? [];
    if (rows.length < 220) continue;
    for (const side of ["open", "close"]) {
      const args = { market, side, rows, rowsByMarket };
      for (const fold of buildFolds(rows)) {
        const contextCache = new Map();
        for (const mode of ["single"]) {
          contextCache.set(mode, {
            trainRows: buildFoldContexts(args, fold.trainStart, fold.trainEnd, mode),
            validationRows: buildFoldContexts(args, fold.validationStart, fold.validationEnd, mode),
            testRows: buildFoldContexts(args, fold.testStart, fold.testEnd, mode),
          });
        }
        const configResults = [];
        for (const config of CONFIGS) {
          const { trainRows, validationRows, testRows } = contextCache.get(config.contextMode);
          const candidates = trainCandidates(trainRows, config.minSupport, config.trainMinPrecision);
          const validation = evaluateCandidates(candidates, validationRows);
          const accepted = validation.n >= 8 && validation.accuracy >= config.validationMinAccuracy;
          const test = accepted ? evaluateCandidates(candidates, testRows) : { n: 0, ok: 0, accuracy: 0, picks: [] };
          configResults.push({ config, candidates: candidates.length, validation, accepted, test });
        }
        const bestValidation = [...configResults].sort((a, b) =>
          b.validation.accuracy - a.validation.accuracy ||
          b.validation.n - a.validation.n ||
          b.candidates - a.candidates,
        )[0];
        const bestAccepted = configResults
          .filter((row) => row.accepted)
          .sort((a, b) => b.validation.accuracy - a.validation.accuracy || b.validation.n - a.validation.n)[0] ?? null;
        foldRows.push({
          market,
          side,
          fold: `${rows[fold.testStart].isoDate}..${rows[fold.testEnd - 1].isoDate}`,
          bestValidation: {
            config: bestValidation.config,
            candidates: bestValidation.candidates,
            validation: { n: bestValidation.validation.n, ok: bestValidation.validation.ok, accuracy: bestValidation.validation.accuracy },
          },
          selected: bestAccepted ? {
            config: bestAccepted.config,
            candidates: bestAccepted.candidates,
            validation: { n: bestAccepted.validation.n, ok: bestAccepted.validation.ok, accuracy: bestAccepted.validation.accuracy },
            test: { n: bestAccepted.test.n, ok: bestAccepted.test.ok, accuracy: bestAccepted.test.accuracy },
            samplePicks: bestAccepted.test.picks.slice(0, 5),
          } : null,
        });
      }
    }
  }

  const selectedRows = foldRows.filter((row) => row.selected);
  const agg = selectedRows.reduce((bucket, row) => {
    bucket.n += row.selected.test.n;
    bucket.ok += row.selected.test.ok;
    if (row.selected.test.n > 0 && row.selected.test.accuracy >= 0.8) bucket.folds80++;
    return bucket;
  }, { n: 0, ok: 0, folds80: 0 });

  const output = {
    generatedAt: new Date().toISOString(),
    configs: CONFIGS.length,
    folds: foldRows.length,
    selectedFolds: selectedRows.length,
    aggregate: { n: agg.n, ok: agg.ok, accuracy: agg.n ? agg.ok / agg.n : 0, folds80: agg.folds80 },
    foldRows,
  };
  fs.writeFileSync(path.join(process.cwd(), "scratch", "two-digit-context-pocket-miner-output.json"), JSON.stringify(output, null, 2));

  const lines = [];
  lines.push("# Two-Digit Context Pocket Miner");
  lines.push("");
  lines.push(`Generated: ${output.generatedAt}`);
  lines.push(`Configs tested per fold: ${output.configs}`);
  lines.push(`Folds tested: ${output.folds}`);
  lines.push(`Selected folds: ${output.selectedFolds}`);
  lines.push(`Aggregate strict accuracy: ${pct(output.aggregate.accuracy)} (${output.aggregate.ok}/${output.aggregate.n})`);
  lines.push(`Selected folds >=80%: ${output.aggregate.folds80}`);
  lines.push("");
  lines.push("| Market | Side | Fold | Val | Test | Config |");
  lines.push("|---|---|---|---:|---:|---|");
  for (const row of selectedRows.sort((a, b) => b.selected.test.accuracy - a.selected.test.accuracy || b.selected.test.n - a.selected.test.n)) {
    const config = row.selected.config;
    lines.push(`| ${row.market} | ${row.side} | ${row.fold} | ${pct(row.selected.validation.accuracy)} n=${row.selected.validation.n} | ${pct(row.selected.test.accuracy)} n=${row.selected.test.n} | ${config.contextMode}/sup${config.minSupport}/train${pct(config.trainMinPrecision)}/gate${pct(config.validationMinAccuracy)} |`);
  }
  fs.writeFileSync(path.join(process.cwd(), "scratch", "two-digit-context-pocket-miner.md"), `${lines.join("\n")}\n`);

  console.log(`Folds tested: ${output.folds}`);
  console.log(`Selected folds: ${output.selectedFolds}`);
  console.log(`Aggregate strict accuracy: ${pct(output.aggregate.accuracy)} (${output.aggregate.ok}/${output.aggregate.n})`);
  console.log(`Selected folds >=80%: ${output.aggregate.folds80}`);
  console.log("Report: scratch/two-digit-context-pocket-miner.md");
}

main();
