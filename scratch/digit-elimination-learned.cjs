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

function sliceBefore(rows, iso) {
  let index = rows.length;
  while (index > 0 && rows[index - 1].isoDate >= iso) index--;
  return rows.slice(0, index);
}

function buildFolds(rows) {
  const folds = [];
  const testSize = 30;
  const validationSize = 90;
  const step = 30;
  for (let testEnd = rows.length; testEnd - testSize - validationSize >= 100; testEnd -= step) {
    const testStart = testEnd - testSize;
    const validationEnd = testStart;
    const validationStart = validationEnd - validationSize;
    folds.push({ validationStart, validationEnd, testStart, testEnd });
    if (folds.length >= 8) break;
  }
  return folds.reverse();
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
  const epochs = options.epochs;
  const lr = options.lr;
  const l2 = options.l2;
  for (let epoch = 0; epoch < epochs; epoch++) {
    for (const sample of samples) {
      const p = sigmoid(dot(w, sample.x));
      const err = p - sample.y;
      for (let i = 0; i < dims; i++) {
        w[i] -= lr * (err * sample.x[i] + l2 * w[i]);
      }
    }
  }
  return w;
}

function scoreLogistic(w, x) {
  return sigmoid(dot(w, x));
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

function buildSamples({ rowsByMarket, rows, market, side, startIndex, endIndex }) {
  const samples = [];
  for (let index = Math.max(startIndex, 50); index < endIndex; index++) {
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

function eliminateForRow({ rowsByMarket, rows, market, side, index, model }) {
  const probs = DIGITS.map((digit) => ({
    digit,
    p: scoreLogistic(model, featureVector({ rowsByMarket, rows, market, side, index, digit })),
  }));
  return probs.sort((a, b) => a.p - b.p || a.digit.localeCompare(b.digit)).slice(0, 4).map((row) => row.digit);
}

function evaluateModel({ rowsByMarket, rows, market, side, startIndex, endIndex, model }) {
  const bucket = { n: 0, correct: 0, wrong: 0, perfect: 0 };
  for (let index = startIndex; index < endIndex; index++) {
    const eliminated = eliminateForRow({ rowsByMarket, rows, market, side, index, model });
    const present = uniqueDigits(panelFor(rows[index].record, actualSide(side)));
    let correct = 0;
    for (const digit of eliminated) if (!present.has(digit)) correct++;
    bucket.n++;
    bucket.correct += correct;
    bucket.wrong += 4 - correct;
    if (correct === 4) bucket.perfect++;
  }
  return finalize(bucket);
}

function finalize(bucket) {
  return {
    ...bucket,
    avgCorrect: bucket.n ? bucket.correct / bucket.n : 0,
    accuracy: bucket.n ? bucket.correct / (bucket.n * 4) : 0,
    perfectRate: bucket.n ? bucket.perfect / bucket.n : 0,
  };
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

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scratch", "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(data[market] ?? [])]));
  const sides = ["open", "close", "jodiClose"];
  const configs = [
    { name: "logreg_slow_l2", lr: 0.012, l2: 0.002, epochs: 18 },
    { name: "logreg_fast_l2", lr: 0.025, l2: 0.006, epochs: 14 },
    { name: "logreg_low_reg", lr: 0.018, l2: 0.0008, epochs: 18 },
  ];
  const minValidationEdge = 0.01;
  const markets = [];

  for (const market of MARKETS) {
    const rows = rowsByMarket[market] ?? [];
    if (rows.length < 230) continue;
    const folds = buildFolds(rows);
    for (const side of sides) {
      const foldRows = [];
      for (const fold of folds) {
        const trainStart = 0;
        const trainEnd = fold.validationStart;
        const trainSamples = buildSamples({ rowsByMarket, rows, market, side, startIndex: trainStart, endIndex: trainEnd });
        if (trainSamples.length < 500) continue;
        const validationRandom = randomBaseline(rows, side, fold.validationStart, fold.validationEnd);
        const testRandom = randomBaseline(rows, side, fold.testStart, fold.testEnd);
        const testedConfigs = [];
        for (const config of configs) {
          const model = trainLogistic(trainSamples, config);
          const validation = evaluateModel({ rowsByMarket, rows, market, side, startIndex: fold.validationStart, endIndex: fold.validationEnd, model });
          testedConfigs.push({ config, model, validation });
        }
        testedConfigs.sort((a, b) => b.validation.accuracy - a.validation.accuracy || a.config.name.localeCompare(b.config.name));
        const best = testedConfigs[0];
        const pass = best.validation.accuracy >= validationRandom + minValidationEdge;
        const test = pass ? evaluateModel({ rowsByMarket, rows, market, side, startIndex: fold.testStart, endIndex: fold.testEnd, model: best.model }) : null;
        foldRows.push({
          fold: `${rows[fold.testStart].isoDate}..${rows[fold.testEnd - 1].isoDate}`,
          selectedModel: best.config.name,
          validationRandom,
          testRandom,
          validation: best.validation,
          pass,
          test,
          edge: test ? test.accuracy - testRandom : null,
        });
      }
      const passed = foldRows.filter((fold) => fold.pass && fold.test);
      const aggregate = passed.reduce((bucket, fold) => {
        bucket.n += fold.test.n;
        bucket.correct += fold.test.correct;
        bucket.wrong += fold.test.wrong;
        bucket.perfect += fold.test.perfect;
        return bucket;
      }, { n: 0, correct: 0, wrong: 0, perfect: 0 });
      const randomAggregate = passed.reduce((sum, fold) => sum + fold.testRandom * fold.test.n, 0) /
        Math.max(1, passed.reduce((sum, fold) => sum + fold.test.n, 0));
      markets.push({
        market,
        side,
        folds: foldRows,
        passCount: passed.length,
        winCount: passed.filter((fold) => fold.edge >= 0.01).length,
        lossCount: passed.filter((fold) => fold.edge < 0).length,
        aggregate: finalize(aggregate),
        randomAggregate,
        averageEdge: passed.length ? passed.reduce((sum, fold) => sum + fold.edge, 0) / passed.length : 0,
      });
    }
  }

  const totals = {};
  for (const side of sides) {
    const rows = markets.filter((row) => row.side === side);
    const aggregate = rows.reduce((bucket, row) => {
      bucket.n += row.aggregate.n;
      bucket.correct += row.aggregate.correct;
      bucket.wrong += row.aggregate.wrong;
      bucket.perfect += row.aggregate.perfect;
      return bucket;
    }, { n: 0, correct: 0, wrong: 0, perfect: 0 });
    const randomAggregate = rows.reduce((sum, row) => sum + row.randomAggregate * row.aggregate.n, 0) /
      Math.max(1, rows.reduce((sum, row) => sum + row.aggregate.n, 0));
    totals[side] = {
      aggregate: finalize(aggregate),
      randomAggregate,
      passes: rows.reduce((sum, row) => sum + row.passCount, 0),
      wins: rows.reduce((sum, row) => sum + row.winCount, 0),
      losses: rows.reduce((sum, row) => sum + row.lossCount, 0),
    };
  }

  const output = { generatedAt: new Date().toISOString(), minValidationEdge, totals, markets };
  const outPath = path.join(process.cwd(), "scratch", "digit-elimination-learned-output.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  const pct = (value) => `${(value * 100).toFixed(1)}%`;
  console.log("# Digit Elimination Learned Models");
  console.log(`Output: ${outPath}`);
  for (const side of sides) {
    const row = totals[side];
    console.log(`${side}: passes ${row.passes}, wins ${row.wins}, losses ${row.losses}, random ${pct(row.randomAggregate)}, tested ${pct(row.aggregate.accuracy)}, avg ${row.aggregate.avgCorrect.toFixed(2)}/4`);
  }
  console.log("\nStrongest learned market/side rows:");
  markets
    .filter((row) => row.passCount >= 3)
    .sort((a, b) => (b.aggregate.accuracy - b.randomAggregate) - (a.aggregate.accuracy - a.randomAggregate))
    .slice(0, 15)
    .forEach((row) => {
      console.log(`${row.market} ${row.side}: pass ${row.passCount}, wins ${row.winCount}, losses ${row.lossCount}, edge ${pct(row.aggregate.accuracy - row.randomAggregate)}, acc ${pct(row.aggregate.accuracy)}`);
    });
}

main();
