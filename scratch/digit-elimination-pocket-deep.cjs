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

const POCKETS = [
  ["Milan Night", "open"],
  ["Time Bazar", "open"],
  ["Milan Day", "jodiClose"],
  ["Sridevi Night", "close"],
  ["Time Bazar", "close"],
  ["Milan Day", "close"],
  ["Kalyan", "close"],
  ["Kalyan", "jodiClose"],
  ["Main Bazar", "open"],
  ["Time Bazar", "jodiClose"],
];

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const OPPOSITE = { 0: "5", 1: "6", 2: "7", 3: "8", 4: "9", 5: "0", 6: "1", 7: "2", 8: "3", 9: "4" };
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

function parseDate(dateStr) {
  const parts = dateStr.replace(/-/g, "/").split("/").map((part) => parseInt(part, 10));
  const [day, month, rawYear] = parts;
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

function evaluateEliminated(eliminated, panel) {
  const present = uniqueDigits(panel);
  let correct = 0;
  for (const digit of eliminated) if (!present.has(digit)) correct++;
  return correct;
}

function addEval(bucket, correct) {
  bucket.n++;
  bucket.correct += correct;
  bucket.wrong += 4 - correct;
  if (correct === 4) bucket.perfect++;
}

function finalize(bucket) {
  return {
    ...bucket,
    avgCorrect: bucket.n ? bucket.correct / bucket.n : 0,
    accuracy: bucket.n ? bucket.correct / (bucket.n * 4) : 0,
    perfectRate: bucket.n ? bucket.perfect / bucket.n : 0,
  };
}

function sliceBefore(rows, iso) {
  let index = rows.length;
  while (index > 0 && rows[index - 1].isoDate >= iso) index--;
  return rows.slice(0, index);
}

function buildFolds(rows) {
  const folds = [];
  const testSize = 30;
  const validationSize = 90;
  for (let testEnd = rows.length; testEnd - testSize - validationSize >= 100; testEnd -= 30) {
    const testStart = testEnd - testSize;
    const validationEnd = testStart;
    const validationStart = validationEnd - validationSize;
    folds.push({ validationStart, validationEnd, testStart, testEnd });
    if (folds.length >= 8) break;
  }
  return folds.reverse();
}

function randomBaseline(rows, side, startIndex, endIndex) {
  let present = 0;
  let n = 0;
  for (let index = startIndex; index < endIndex; index++) {
    present += uniqueDigits(panelFor(rows[index].record, actualSide(side))).size;
    n++;
  }
  return n ? 1 - present / (10 * n) : 0;
}

const predictionCache = new Map();

function currentScores({ rowsByMarket, rows, market, side, index }) {
  const row = rows[index];
  const cacheKey = `${market}|${row.isoDate}`;
  let prediction = predictionCache.get(cacheKey);
  let prior;
  if (!prediction) {
    const priorRows = rows.slice(0, index);
    prior = priorRows.map((priorRow) => priorRow.record);
    const allPrior = {};
    for (const other of MARKETS) {
      allPrior[other] = sliceBefore(rowsByMarket[other] ?? [], row.isoDate).map((priorRow) => priorRow.record);
    }
    allPrior[market] = prior;
    prediction = {
      prior,
      result: analyzeMarket(market, prior, allPrior, new Date(`${row.isoDate}T12:00:00Z`)),
    };
    predictionCache.set(cacheKey, prediction);
  }
  if (!prediction.result) return null;
  prior = prediction.prior;
  let picks = side === "open" ? prediction.result.openPicks : prediction.result.closePicks;
  if (side === "jodiClose") {
    const jodi = computeJodiAnalysis(
      row.record.openSutta,
      row.record.openPanel || null,
      prior,
      buildContextFromResult(prediction.result),
      prediction.result.closeDpKindContext,
    );
    picks = jodi.adjustedClosePicks;
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

function featureVector({ rowsByMarket, rows, market, side, index, digit }) {
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
  const source = SOURCE_MARKET[market];
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

function trainLogistic(samples, options) {
  const dims = samples[0]?.x.length ?? 0;
  const w = Array(dims).fill(0);
  for (let epoch = 0; epoch < options.epochs; epoch++) {
    for (const sample of samples) {
      const p = sigmoid(dot(w, sample.x));
      const err = p - sample.y;
      for (let i = 0; i < dims; i++) {
        w[i] -= options.lr * (err * sample.x[i] + options.l2 * w[i]);
      }
    }
  }
  return w;
}

function buildSamples({ rowsByMarket, rows, market, side, endIndex }) {
  const samples = [];
  for (let index = 50; index < endIndex; index++) {
    const actualDigits = uniqueDigits(panelFor(rows[index].record, actualSide(side)));
    for (const digit of DIGITS) {
      samples.push({
        x: featureVector({ rowsByMarket, rows, market, side, index, digit }),
        y: actualDigits.has(digit) ? 1 : 0,
      });
    }
  }
  return samples;
}

function learnedScores({ rowsByMarket, rows, market, side, index, model }) {
  return Object.fromEntries(DIGITS.map((digit) => [
    digit,
    sigmoid(dot(model, featureVector({ rowsByMarket, rows, market, side, index, digit }))),
  ]));
}

function evaluateLearned({ rowsByMarket, rows, market, side, startIndex, endIndex, model }) {
  const bucket = { n: 0, correct: 0, wrong: 0, perfect: 0 };
  for (let index = startIndex; index < endIndex; index++) {
    const eliminated = eliminateLowest(learnedScores({ rowsByMarket, rows, market, side, index, model }));
    addEval(bucket, evaluateEliminated(eliminated, panelFor(rows[index].record, actualSide(side))));
  }
  return finalize(bucket);
}

function evaluateCurrent({ rowsByMarket, rows, market, side, startIndex, endIndex }) {
  const bucket = { n: 0, correct: 0, wrong: 0, perfect: 0 };
  for (let index = startIndex; index < endIndex; index++) {
    const scores = currentScores({ rowsByMarket, rows, market, side, index });
    if (!scores) continue;
    addEval(bucket, evaluateEliminated(eliminateLowest(scores), panelFor(rows[index].record, actualSide(side))));
  }
  return finalize(bucket);
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scratch", "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(data[market] ?? [])]));
  const configs = [
    { name: "logreg_slow_l2", lr: 0.012, l2: 0.002, epochs: 18 },
    { name: "logreg_fast_l2", lr: 0.025, l2: 0.006, epochs: 14 },
    { name: "logreg_low_reg", lr: 0.018, l2: 0.0008, epochs: 18 },
  ];
  const results = [];

  for (const [market, side] of POCKETS) {
    const rows = rowsByMarket[market] ?? [];
    const folds = buildFolds(rows);
    const foldRows = [];
    for (const fold of folds) {
      const samples = buildSamples({ rowsByMarket, rows, market, side, endIndex: fold.validationStart });
      const trained = configs.map((config) => {
        const model = trainLogistic(samples, config);
        const validation = evaluateLearned({ rowsByMarket, rows, market, side, startIndex: fold.validationStart, endIndex: fold.validationEnd, model });
        return { config, model, validation };
      }).sort((a, b) => b.validation.accuracy - a.validation.accuracy || a.config.name.localeCompare(b.config.name));
      const best = trained[0];
      const learned = evaluateLearned({ rowsByMarket, rows, market, side, startIndex: fold.testStart, endIndex: fold.testEnd, model: best.model });
      const current = evaluateCurrent({ rowsByMarket, rows, market, side, startIndex: fold.testStart, endIndex: fold.testEnd });
      const random = randomBaseline(rows, side, fold.testStart, fold.testEnd);
      foldRows.push({
        fold: `${rows[fold.testStart].isoDate}..${rows[fold.testEnd - 1].isoDate}`,
        selectedModel: best.config.name,
        validation: best.validation,
        random,
        current,
        learned,
        learnedEdgeVsCurrent: learned.accuracy - current.accuracy,
        learnedEdgeVsRandom: learned.accuracy - random,
      });
    }
    const learnedAgg = foldRows.reduce((bucket, fold) => {
      bucket.n += fold.learned.n;
      bucket.correct += fold.learned.correct;
      bucket.wrong += fold.learned.wrong;
      bucket.perfect += fold.learned.perfect;
      return bucket;
    }, { n: 0, correct: 0, wrong: 0, perfect: 0 });
    const currentAgg = foldRows.reduce((bucket, fold) => {
      bucket.n += fold.current.n;
      bucket.correct += fold.current.correct;
      bucket.wrong += fold.current.wrong;
      bucket.perfect += fold.current.perfect;
      return bucket;
    }, { n: 0, correct: 0, wrong: 0, perfect: 0 });
    const random = foldRows.reduce((sum, fold) => sum + fold.random * fold.learned.n, 0) /
      Math.max(1, foldRows.reduce((sum, fold) => sum + fold.learned.n, 0));
    results.push({
      market,
      side,
      folds: foldRows,
      learned: finalize(learnedAgg),
      current: finalize(currentAgg),
      random,
      learnedWinsCurrent: foldRows.filter((fold) => fold.learnedEdgeVsCurrent > 0).length,
      learnedLossesCurrent: foldRows.filter((fold) => fold.learnedEdgeVsCurrent < 0).length,
    });
  }

  const output = { generatedAt: new Date().toISOString(), foldsPerPocket: 8, results };
  const outPath = path.join(process.cwd(), "scratch", "digit-elimination-pocket-deep-output.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  const pct = (value) => `${(value * 100).toFixed(1)}%`;
  console.log("# Digit Elimination Pocket Deep Test");
  console.log(`Output: ${outPath}`);
  for (const row of results.sort((a, b) => (b.learned.accuracy - b.current.accuracy) - (a.learned.accuracy - a.current.accuracy))) {
    console.log(`${row.market} ${row.side}: random ${pct(row.random)}, current ${pct(row.current.accuracy)}, learned ${pct(row.learned.accuracy)}, delta ${pct(row.learned.accuracy - row.current.accuracy)}, W/L ${row.learnedWinsCurrent}/${row.learnedLossesCurrent}`);
  }
}

main();
