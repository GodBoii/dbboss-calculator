/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolve.call(this, path.join(process.cwd(), "src", request.slice(2)), parent, isMain, options);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

for (const ext of [".ts", ".tsx"]) {
  require.extensions[ext] = function registerTs(module, filename) {
    const source = fs.readFileSync(filename, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    module._compile(output, filename);
  };
}

const { analyzeMarket, buildContextFromResult, computeJodiAnalysis } = require("../src/lib/predictor.ts");

const MARKET = "Milan Day";
const SIDES = ["close", "jodiClose"];
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
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const OPPOSITE = { 0: "5", 1: "6", 2: "7", 3: "8", 4: "9", 5: "0", 6: "1", 7: "2", 8: "3", 9: "4" };
const DAY_OFFSETS = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
const SOURCE_MARKET = { "Milan Day": "Madhur Day" };

function parseDate(dateStr) {
  const [day, month, rawYear] = dateStr.replace(/-/g, "/").split("/").map((part) => parseInt(part, 10));
  const year = rawYear < 100 ? rawYear + 2000 : rawYear;
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(record) {
  const start = parseDate(record.dateRangeStart);
  start.setUTCDate(start.getUTCDate() + (DAY_OFFSETS[record.day] ?? 0));
  return start.toISOString().slice(0, 10);
}

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: isoDate(record) }))
    .filter((row) => row.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

function actualSide(side) {
  return side === "jodiClose" ? "close" : side;
}

function panelFor(record, side) {
  return side === "open" ? record.openPanel : record.closePanel;
}

function uniqueDigits(panel) {
  return new Set(String(panel || "").match(/\d/g) ?? []);
}

function blank(value = 0) {
  return Object.fromEntries(DIGITS.map((digit) => [digit, value]));
}

function eliminateLowest(scores) {
  return DIGITS
    .map((digit) => ({ digit, score: scores[digit] ?? 0 }))
    .sort((a, b) => a.score - b.score || a.digit.localeCompare(b.digit))
    .slice(0, 4)
    .map((row) => row.digit);
}

function evaluate(eliminated, panel) {
  const present = uniqueDigits(panel);
  let correct = 0;
  for (const digit of eliminated) if (!present.has(digit)) correct++;
  return correct;
}

function sliceBefore(rows, iso) {
  let index = rows.length;
  while (index > 0 && rows[index - 1].isoDate >= iso) index--;
  return rows.slice(0, index);
}

function currentScores({ rowsByMarket, rows, side, index }) {
  const row = rows[index];
  const priorRows = rows.slice(0, index);
  const prior = priorRows.map((priorRow) => priorRow.record);
  const allPrior = {};
  for (const market of MARKETS) {
    allPrior[market] = sliceBefore(rowsByMarket[market] ?? [], row.isoDate).map((priorRow) => priorRow.record);
  }
  allPrior[MARKET] = prior;
  const prediction = analyzeMarket(MARKET, prior, allPrior, new Date(`${row.isoDate}T12:00:00Z`));
  if (!prediction) return null;
  let picks = prediction.closePicks;
  if (side === "jodiClose") {
    picks = computeJodiAnalysis(
      row.record.openSutta,
      row.record.openPanel || null,
      prior,
      buildContextFromResult(prediction),
      prediction.closeDpKindContext,
    ).adjustedClosePicks;
  }
  const scores = blank(0);
  for (const [pickIndex, pick] of picks.slice(0, 30).entries()) {
    const weight = 30 - pickIndex;
    for (const digit of uniqueDigits(pick.panel)) scores[digit] += weight;
  }
  return scores;
}

function digitFrequency(rows, side, windowSize) {
  const counts = blank(0);
  const slice = rows.slice(Math.max(0, rows.length - windowSize));
  for (const row of slice) {
    for (const digit of uniqueDigits(panelFor(row.record, side))) counts[digit]++;
  }
  return counts;
}

function digitGap(rows, side) {
  const gaps = blank(50);
  for (const digit of DIGITS) {
    let gap = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      gap++;
      if (uniqueDigits(panelFor(rows[i].record, side)).has(digit)) break;
    }
    gaps[digit] = Math.min(gap, 50);
  }
  return gaps;
}

function featureVector({ rowsByMarket, rows, side, index, digit }) {
  const sideName = actualSide(side);
  const prior = rows.slice(0, index);
  const row = rows[index];
  const previous = prior[prior.length - 1];
  const freq7 = digitFrequency(prior, sideName, 7);
  const freq30 = digitFrequency(prior, sideName, 30);
  const freq90 = digitFrequency(prior, sideName, 90);
  const gaps = digitGap(prior, sideName);
  const prevDigits = previous ? uniqueDigits(panelFor(previous.record, sideName)) : new Set();
  const prevOppDigits = previous ? new Set([...uniqueDigits(panelFor(previous.record, sideName))].map((d) => OPPOSITE[d])) : new Set();
  const weekdayRows = prior.filter((priorRow) => priorRow.record.day === row.record.day);
  const weekdayFreq = digitFrequency(weekdayRows, sideName, 1000);
  const knownOpenDigits = uniqueDigits(row.record.openPanel);
  const source = SOURCE_MARKET[MARKET];
  const sourcePrior = source ? sliceBefore(rowsByMarket[source] ?? [], row.isoDate) : [];
  const sourceLast = sourcePrior[sourcePrior.length - 1];
  const sourceDigits = sourceLast ? uniqueDigits(panelFor(sourceLast.record, sideName)) : new Set();
  return [
    1,
    (freq7[digit] ?? 0) / 7,
    (freq30[digit] ?? 0) / 30,
    (freq90[digit] ?? 0) / 90,
    Math.min((gaps[digit] ?? 50) / 20, 2.5),
    prevDigits.has(digit) ? 1 : 0,
    prevOppDigits.has(digit) ? 1 : 0,
    (weekdayFreq[digit] ?? 0) / Math.max(1, weekdayRows.length),
    sideName === "close" && knownOpenDigits.has(digit) ? 1 : 0,
    sideName === "close" && knownOpenDigits.has(OPPOSITE[digit]) ? 1 : 0,
    sourceDigits.has(digit) ? 1 : 0,
  ];
}

function sigmoid(z) {
  if (z < -30) return 0;
  if (z > 30) return 1;
  return 1 / (1 + Math.exp(-z));
}

function dot(w, x) {
  let total = 0;
  for (let i = 0; i < w.length; i++) total += w[i] * x[i];
  return total;
}

function train(samples, config) {
  const dims = samples[0]?.x.length ?? 0;
  const w = Array(dims).fill(0);
  for (let epoch = 0; epoch < config.epochs; epoch++) {
    for (const sample of samples) {
      const p = sigmoid(dot(w, sample.x));
      const err = p - sample.y;
      for (let i = 0; i < dims; i++) w[i] -= config.lr * (err * sample.x[i] + config.l2 * w[i]);
    }
  }
  return w;
}

function buildSamples({ rowsByMarket, rows, side, start, end }) {
  const samples = [];
  for (let index = Math.max(50, start); index < end; index++) {
    const actual = uniqueDigits(panelFor(rows[index].record, actualSide(side)));
    for (const digit of DIGITS) {
      samples.push({
        x: featureVector({ rowsByMarket, rows, side, index, digit }),
        y: actual.has(digit) ? 1 : 0,
      });
    }
  }
  return samples;
}

function learnedScores({ rowsByMarket, rows, side, index, model }) {
  return Object.fromEntries(DIGITS.map((digit) => [
    digit,
    sigmoid(dot(model, featureVector({ rowsByMarket, rows, side, index, digit }))),
  ]));
}

function evaluateLearned({ rowsByMarket, rows, side, start, end, model }) {
  const bucket = { n: 0, correct: 0, wrong: 0, perfect: 0 };
  for (let index = start; index < end; index++) {
    const eliminated = eliminateLowest(learnedScores({ rowsByMarket, rows, side, index, model }));
    const correct = evaluate(eliminated, panelFor(rows[index].record, actualSide(side)));
    bucket.n++;
    bucket.correct += correct;
    bucket.wrong += 4 - correct;
    if (correct === 4) bucket.perfect++;
  }
  return { ...bucket, accuracy: bucket.n ? bucket.correct / (bucket.n * 4) : 0, avgCorrect: bucket.n ? bucket.correct / bucket.n : 0 };
}

function main() {
  const cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scratch", "open-sutta-records-cache.json"), "utf8"));
  const live = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scratch", "live-freshness-check-output.json"), "utf8")).liveRecords;
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(cache[market] ?? [])]));
  const cachedRows = rowsByMarket[MARKET];
  const cachedNewest = cachedRows.at(-1).isoDate;
  const liveRows = dated(live[MARKET] ?? []);
  const fresh = liveRows.filter((row) => row.isoDate > cachedNewest);
  const combinedRows = [...cachedRows, ...fresh].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  rowsByMarket[MARKET] = combinedRows;
  const freshStart = combinedRows.findIndex((row) => row.isoDate === fresh[0]?.isoDate);
  const freshEnd = freshStart + fresh.length;
  const configs = [
    { name: "logreg_slow_l2", lr: 0.012, l2: 0.002, epochs: 18 },
    { name: "logreg_fast_l2", lr: 0.025, l2: 0.006, epochs: 14 },
    { name: "logreg_low_reg", lr: 0.018, l2: 0.0008, epochs: 18 },
  ];
  const results = [];
  for (const side of SIDES) {
    const validationEnd = freshStart;
    const validationStart = validationEnd - 90;
    const trainEnd = validationStart;
    const trained = configs.map((config) => {
      const samples = buildSamples({ rowsByMarket, rows: combinedRows, side, start: 0, end: trainEnd });
      const model = train(samples, config);
      const validation = evaluateLearned({ rowsByMarket, rows: combinedRows, side, start: validationStart, end: validationEnd, model });
      return { config, model, validation };
    }).sort((a, b) => b.validation.accuracy - a.validation.accuracy || a.config.name.localeCompare(b.config.name));
    const best = trained[0];
    const learned = evaluateLearned({ rowsByMarket, rows: combinedRows, side, start: freshStart, end: freshEnd, model: best.model });
    const currentBucket = { n: 0, correct: 0, wrong: 0, perfect: 0 };
    const rows = [];
    for (let index = freshStart; index < freshEnd; index++) {
      const currentEliminated = eliminateLowest(currentScores({ rowsByMarket, rows: combinedRows, side, index }));
      const learnedEliminated = eliminateLowest(learnedScores({ rowsByMarket, rows: combinedRows, side, index, model: best.model }));
      const panel = panelFor(combinedRows[index].record, actualSide(side));
      const currentCorrect = evaluate(currentEliminated, panel);
      const learnedCorrect = evaluate(learnedEliminated, panel);
      currentBucket.n++;
      currentBucket.correct += currentCorrect;
      currentBucket.wrong += 4 - currentCorrect;
      if (currentCorrect === 4) currentBucket.perfect++;
      rows.push({
        isoDate: combinedRows[index].isoDate,
        panel,
        currentEliminated,
        currentCorrect,
        learnedEliminated,
        learnedCorrect,
      });
    }
    const current = { ...currentBucket, accuracy: currentBucket.correct / (currentBucket.n * 4), avgCorrect: currentBucket.correct / currentBucket.n };
    results.push({
      side,
      selectedModel: best.config.name,
      validation: best.validation,
      current,
      learned,
      rows,
    });
  }
  const output = { generatedAt: new Date().toISOString(), market: MARKET, cachedNewest, freshRows: fresh.length, results };
  const outPath = path.join(process.cwd(), "scratch", "live-holdout-milan-day-output.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`# Live holdout: ${MARKET}`);
  console.log(`Fresh rows: ${fresh.length} (${fresh[0]?.isoDate}..${fresh.at(-1)?.isoDate})`);
  for (const result of results) {
    console.log(`${result.side}: current ${(result.current.accuracy * 100).toFixed(1)}% avg ${result.current.avgCorrect.toFixed(2)}/4, learned ${(result.learned.accuracy * 100).toFixed(1)}% avg ${result.learned.avgCorrect.toFixed(2)}/4, model ${result.selectedModel}`);
  }
  console.log(`Output: ${outPath}`);
}

main();
