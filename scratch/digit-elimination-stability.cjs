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
const HOUSE_A = new Set(["0", "1", "2", "3", "4"]);
const ODD = new Set(["1", "3", "5", "7", "9"]);
const PRIME = new Set(["2", "3", "5", "7"]);
const DAY_OFFSETS = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 };
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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

function panelFor(record, side) {
  return side === "open" ? record.openPanel : record.closePanel;
}

function suttaFor(record, side) {
  return side === "open" ? record.openSutta : record.closeSutta;
}

function uniqueDigits(panel) {
  return new Set(String(panel || "").match(/\d/g) ?? []);
}

function absentDigits(panel) {
  const present = uniqueDigits(panel);
  return DIGITS.filter((digit) => !present.has(digit));
}

function blankScores(value = 0) {
  return Object.fromEntries(DIGITS.map((digit) => [digit, value]));
}

function addScore(scores, digit, value) {
  scores[digit] = (scores[digit] ?? 0) + value;
}

function digitFrequency(rows, side, windowSize = rows.length) {
  const counts = blankScores(0);
  const slice = rows.slice(-windowSize);
  for (const row of slice) {
    for (const digit of uniqueDigits(panelFor(row.record, side))) addScore(counts, digit, 1);
  }
  return counts;
}

function absenceGaps(rows, side) {
  const gaps = blankScores(1000);
  for (const row of rows.slice().reverse()) {
    const digits = uniqueDigits(panelFor(row.record, side));
    for (const digit of DIGITS) {
      if (gaps[digit] === 1000 && digits.has(digit)) gaps[digit] = 0;
    }
    for (const digit of DIGITS) {
      if (gaps[digit] !== 1000) gaps[digit]++;
    }
  }
  return gaps;
}

function conditionalNextDigitScores(rows, side, conditionFn) {
  const totals = blankScores(0);
  const hits = blankScores(0);
  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1];
    const currentDigits = uniqueDigits(panelFor(rows[i].record, side));
    for (const digit of DIGITS) {
      if (!conditionFn(previous, digit)) continue;
      totals[digit]++;
      if (currentDigits.has(digit)) hits[digit]++;
    }
  }
  const fallback = digitFrequency(rows, side, 90);
  return Object.fromEntries(DIGITS.map((digit) => [
    digit,
    totals[digit] >= 8 ? (hits[digit] + 1) / (totals[digit] + 2) : (fallback[digit] + 1) / 91,
  ]));
}

function conditionalCurrentCloseScores(rows, conditionFn) {
  const totals = blankScores(0);
  const hits = blankScores(0);
  for (const row of rows) {
    const closeDigits = uniqueDigits(row.record.closePanel);
    for (const digit of DIGITS) {
      if (!conditionFn(row, digit)) continue;
      totals[digit]++;
      if (closeDigits.has(digit)) hits[digit]++;
    }
  }
  const fallback = digitFrequency(rows, "close", 90);
  return Object.fromEntries(DIGITS.map((digit) => [
    digit,
    totals[digit] >= 8 ? (hits[digit] + 1) / (totals[digit] + 2) : (fallback[digit] + 1) / 91,
  ]));
}

function groupedFadeScores(previousDigits, group) {
  let inside = 0;
  let outside = 0;
  for (const digit of previousDigits) {
    if (group.has(digit)) inside++;
    else outside++;
  }
  const fadeGroup = inside >= outside ? group : new Set(DIGITS.filter((digit) => !group.has(digit)));
  return Object.fromEntries(DIGITS.map((digit) => [digit, fadeGroup.has(digit) ? 0 : 10]));
}

function eliminateLowest(scores, count = 4) {
  return DIGITS
    .map((digit) => ({ digit, score: scores[digit] ?? 0 }))
    .sort((a, b) => a.score - b.score || a.digit.localeCompare(b.digit))
    .slice(0, count)
    .map((row) => row.digit);
}

function evaluatePrediction(eliminated, panel) {
  const present = uniqueDigits(panel);
  let correct = 0;
  for (const digit of eliminated) if (!present.has(digit)) correct++;
  return correct;
}

function normalize(scores) {
  const values = DIGITS.map((digit) => scores[digit] ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return blankScores(0.5);
  return Object.fromEntries(DIGITS.map((digit) => [digit, ((scores[digit] ?? 0) - min) / (max - min)]));
}

function ensembleScores(scoreRows) {
  const out = blankScores(0);
  for (const scores of scoreRows) {
    const norm = normalize(scores);
    for (const digit of DIGITS) out[digit] += norm[digit];
  }
  return out;
}

function actualSide(side) {
  return side === "jodiClose" ? "close" : side;
}

const CANDIDATES = {
  rolling30Cold({ prior, side }) {
    return digitFrequency(prior, actualSide(side), 30);
  },
  rolling30HotFade({ prior, side }) {
    const freq = digitFrequency(prior, actualSide(side), 30);
    return Object.fromEntries(DIGITS.map((digit) => [digit, -freq[digit]]));
  },
  rolling7Cold({ prior, side }) {
    return digitFrequency(prior, actualSide(side), 7);
  },
  rolling7HotFade({ prior, side }) {
    const freq = digitFrequency(prior, actualSide(side), 7);
    return Object.fromEntries(DIGITS.map((digit) => [digit, -freq[digit]]));
  },
  longAbsenceContinues({ prior, side }) {
    const gaps = absenceGaps(prior, actualSide(side));
    return Object.fromEntries(DIGITS.map((digit) => [digit, -gaps[digit]]));
  },
  recentAppearanceCools({ prior, side }) {
    const gaps = absenceGaps(prior, actualSide(side));
    return Object.fromEntries(DIGITS.map((digit) => [digit, gaps[digit]]));
  },
  prevMissingPlusCold({ prior, side }) {
    const scores = digitFrequency(prior, actualSide(side), 30);
    const previous = prior[prior.length - 1];
    const prevAbsent = new Set(absentDigits(panelFor(previous.record, actualSide(side))));
    for (const digit of DIGITS) if (!prevAbsent.has(digit)) scores[digit] += 100;
    return scores;
  },
  prevPresentCools({ prior, side }) {
    const scores = blankScores(10);
    const previous = prior[prior.length - 1];
    for (const digit of uniqueDigits(panelFor(previous.record, actualSide(side)))) scores[digit] = 0;
    return scores;
  },
  weekdayCold({ prior, side, isoDate }) {
    const day = DAY_NAMES[new Date(`${isoDate}T12:00:00Z`).getUTCDay()];
    return digitFrequency(prior.filter((row) => row.record.day === day), actualSide(side), 1000);
  },
  calendarDateCold({ prior, side, isoDate }) {
    const dom = new Date(`${isoDate}T12:00:00Z`).getUTCDate();
    return digitFrequency(
      prior.filter((row) => new Date(`${row.isoDate}T12:00:00Z`).getUTCDate() === dom),
      actualSide(side),
      1000,
    );
  },
  sameWeekdayPrevMonthCold({ prior, side, isoDate }) {
    const date = new Date(`${isoDate}T12:00:00Z`);
    const day = DAY_NAMES[date.getUTCDay()];
    const targetMonth = date.getUTCMonth() === 0 ? 11 : date.getUTCMonth() - 1;
    return digitFrequency(
      prior.filter((row) => {
        const rowDate = new Date(`${row.isoDate}T12:00:00Z`);
        return row.record.day === day && rowDate.getUTCMonth() === targetMonth;
      }),
      actualSide(side),
      1000,
    );
  },
  oppositePrevPresentCools({ prior, side }) {
    const scores = blankScores(10);
    const previous = prior[prior.length - 1];
    for (const digit of uniqueDigits(panelFor(previous.record, actualSide(side)))) scores[OPPOSITE[digit]] = 0;
    return scores;
  },
  sameHouseFade({ prior, side }) {
    const previous = prior[prior.length - 1];
    return groupedFadeScores(uniqueDigits(panelFor(previous.record, actualSide(side))), HOUSE_A);
  },
  oddEvenFade({ prior, side }) {
    const previous = prior[prior.length - 1];
    return groupedFadeScores(uniqueDigits(panelFor(previous.record, actualSide(side))), ODD);
  },
  primeCompositeFade({ prior, side }) {
    const previous = prior[prior.length - 1];
    return groupedFadeScores(uniqueDigits(panelFor(previous.record, actualSide(side))), PRIME);
  },
  sameSideRepeatTransition({ prior, side }) {
    const sideName = actualSide(side);
    return conditionalNextDigitScores(prior, sideName, (previous, digit) =>
      uniqueDigits(panelFor(previous.record, sideName)).has(digit),
    );
  },
  sameSideAbsentTransition({ prior, side }) {
    const sideName = actualSide(side);
    return conditionalNextDigitScores(prior, sideName, (previous, digit) =>
      !uniqueDigits(panelFor(previous.record, sideName)).has(digit),
    );
  },
  oppositeDigitTransition({ prior, side }) {
    const sideName = actualSide(side);
    return conditionalNextDigitScores(prior, sideName, (previous, digit) =>
      uniqueDigits(panelFor(previous.record, sideName)).has(OPPOSITE[digit]),
    );
  },
  prevSuttaCondCold({ prior, side }) {
    const sideName = actualSide(side);
    const previous = prior[prior.length - 1];
    const prevSutta = suttaFor(previous.record, sideName);
    return digitFrequency(prior.filter((row) => suttaFor(row.record, sideName) === prevSutta), sideName, 1000);
  },
  prevJodiCondCold({ prior, side }) {
    const sideName = actualSide(side);
    const previous = prior[prior.length - 1];
    const prevJodi = previous.record.jodi;
    return digitFrequency(prior.filter((row) => row.record.jodi === prevJodi), sideName, 1000);
  },
  previousOppositeSideCools({ prior, side, knownOpen }) {
    const sideName = actualSide(side);
    const scores = blankScores(10);
    const panel = sideName === "close" && knownOpen ? knownOpen.openPanel : prior[prior.length - 1].record.closePanel;
    for (const digit of uniqueDigits(panel)) scores[digit] = 0;
    return scores;
  },
  closeKnownOpenDigitClean({ prior, side, knownOpen }) {
    if (side === "open" || !knownOpen) return null;
    const scores = digitFrequency(prior, "close", 30);
    for (const digit of uniqueDigits(knownOpen.openPanel)) scores[digit] -= 10;
    return scores;
  },
  closeCurrentOpenCondCold({ prior, side, knownOpen }) {
    if (side === "open" || !knownOpen) return null;
    const matches = prior.filter((row) => row.record.openSutta === knownOpen.openSutta);
    return digitFrequency(matches, "close", 1000);
  },
  closeOpenDigitRepeatTransition({ prior, side, knownOpen }) {
    if (side === "open" || !knownOpen) return null;
    const openDigits = uniqueDigits(knownOpen.openPanel);
    const scores = conditionalCurrentCloseScores(prior, (row, digit) =>
      uniqueDigits(row.record.openPanel).has(digit),
    );
    for (const digit of DIGITS) if (!openDigits.has(digit)) scores[digit] *= 1.05;
    return scores;
  },
  closeOpenOppositeTransition({ prior, side, knownOpen }) {
    if (side === "open" || !knownOpen) return null;
    const openDigits = uniqueDigits(knownOpen.openPanel);
    const scores = conditionalCurrentCloseScores(prior, (row, digit) =>
      uniqueDigits(row.record.openPanel).has(OPPOSITE[digit]),
    );
    for (const digit of DIGITS) if (!openDigits.has(OPPOSITE[digit])) scores[digit] *= 1.05;
    return scores;
  },
  sourceMarketPrevCold({ market, side, allPrior }) {
    const source = SOURCE_MARKET[market];
    if (!source || !allPrior[source]?.length) return null;
    return digitFrequency(allPrior[source].map((record) => ({ record })), actualSide(side), 30);
  },
  sourceMarketPrevPresentCools({ market, side, allPrior }) {
    const source = SOURCE_MARKET[market];
    if (!source || !allPrior[source]?.length) return null;
    const scores = blankScores(10);
    const sourceLast = allPrior[source][allPrior[source].length - 1];
    for (const digit of uniqueDigits(panelFor(sourceLast, actualSide(side)))) scores[digit] = 0;
    return scores;
  },
};

function emptyBucket() {
  return { n: 0, correct: 0, perfect: 0, wrong: 0 };
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

function contextFor({ rowsByMarket, rows, market, side, row }) {
  const prior = sliceBefore(rows, row.isoDate);
  const allPrior = {};
  for (const other of MARKETS) {
    allPrior[other] = sliceBefore(rowsByMarket[other] ?? [], row.isoDate).map((priorRow) => priorRow.record);
  }
  allPrior[market] = prior.map((priorRow) => priorRow.record);
  return {
    market,
    side,
    prior,
    allPrior,
    isoDate: row.isoDate,
    knownOpen: { openSutta: row.record.openSutta, openPanel: row.record.openPanel },
  };
}

function evaluateModel({ rowsByMarket, rows, market, side, startIndex, endIndex, model }) {
  const bucket = emptyBucket();
  for (let i = startIndex; i < endIndex; i++) {
    const row = rows[i];
    if (i < 50) continue;
    const ctx = contextFor({ rowsByMarket, rows, market, side, row });
    if (ctx.prior.length < 50) continue;
    let scores = null;
    if (model.kind === "single") {
      scores = CANDIDATES[model.name](ctx);
    } else {
      const scoreRows = model.names.map((name) => CANDIDATES[name](ctx)).filter(Boolean);
      if (scoreRows.length === 0) continue;
      scores = ensembleScores(scoreRows);
    }
    if (!scores) continue;
    const eliminated = eliminateLowest(scores);
    addEval(bucket, evaluatePrediction(eliminated, panelFor(row.record, actualSide(side))));
  }
  return finalize(bucket);
}

function randomBaseline(rows, side, startIndex, endIndex) {
  let present = 0;
  let n = 0;
  for (let i = startIndex; i < endIndex; i++) {
    present += uniqueDigits(panelFor(rows[i].record, actualSide(side))).size;
    n++;
  }
  return n ? 1 - present / (n * 10) : 0;
}

function topModels(validationScores, count) {
  return validationScores
    .filter((row) => row.bucket.n > 0)
    .sort((a, b) => b.bucket.accuracy - a.bucket.accuracy || b.bucket.avgCorrect - a.bucket.avgCorrect || a.name.localeCompare(b.name))
    .slice(0, count);
}

function buildFolds(rows) {
  const folds = [];
  const testSize = 30;
  const validationSize = 90;
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

function modelLabel(model) {
  return model.kind === "ensemble" ? `ensemble(${model.names.join("+")})` : model.name;
}

function main() {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), "scratch", "open-sutta-records-cache.json"), "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(data[market] ?? [])]));
  const sides = ["open", "close", "jodiClose"];
  const minValidationEdge = 0.02;
  const markets = [];

  for (const market of MARKETS) {
    const rows = rowsByMarket[market] ?? [];
    if (rows.length < 220) continue;
    const folds = buildFolds(rows);
    for (const side of sides) {
      const foldRows = [];
      for (const fold of folds) {
        const validationScores = Object.keys(CANDIDATES).map((name) => ({
          name,
          bucket: evaluateModel({
            rowsByMarket,
            rows,
            market,
            side,
            startIndex: fold.validationStart,
            endIndex: fold.validationEnd,
            model: { kind: "single", name },
          }),
        }));
        const top3 = topModels(validationScores, 3);
        const bestSingle = top3[0];
        const ensemble = { kind: "ensemble", names: top3.map((row) => row.name) };
        const ensembleValidation = evaluateModel({
          rowsByMarket,
          rows,
          market,
          side,
          startIndex: fold.validationStart,
          endIndex: fold.validationEnd,
          model: ensemble,
        });
        const bestValidation = ensembleValidation.accuracy > bestSingle.bucket.accuracy
          ? { model: ensemble, bucket: ensembleValidation }
          : { model: { kind: "single", name: bestSingle.name }, bucket: bestSingle.bucket };
        const randomValidation = randomBaseline(rows, side, fold.validationStart, fold.validationEnd);
        const randomTest = randomBaseline(rows, side, fold.testStart, fold.testEnd);
        const pass = bestValidation.bucket.accuracy >= randomValidation + minValidationEdge;
        const test = pass
          ? evaluateModel({ rowsByMarket, rows, market, side, startIndex: fold.testStart, endIndex: fold.testEnd, model: bestValidation.model })
          : null;
        foldRows.push({
          fold: `${rows[fold.testStart].isoDate}..${rows[fold.testEnd - 1].isoDate}`,
          validationRandom: randomValidation,
          testRandom: randomTest,
          selectedModel: modelLabel(bestValidation.model),
          validation: bestValidation.bucket,
          pass,
          test,
          edge: test ? test.accuracy - randomTest : null,
        });
      }

      const passed = foldRows.filter((fold) => fold.pass && fold.test);
      const stableWins = passed.filter((fold) => fold.edge >= 0.01);
      const losses = passed.filter((fold) => fold.edge < 0);
      const aggregate = passed.reduce((bucket, fold) => {
        bucket.n += fold.test.n;
        bucket.correct += fold.test.correct;
        bucket.wrong += fold.test.wrong;
        bucket.perfect += fold.test.perfect;
        return bucket;
      }, emptyBucket());
      const randomAgg = passed.reduce((sum, fold) => sum + fold.testRandom * fold.test.n, 0) /
        Math.max(1, passed.reduce((sum, fold) => sum + fold.test.n, 0));
      markets.push({
        market,
        side,
        folds: foldRows,
        passCount: passed.length,
        stableWinCount: stableWins.length,
        lossCount: losses.length,
        aggregate: finalize(aggregate),
        randomAggregate: randomAgg,
        averageEdge: passed.length ? passed.reduce((sum, fold) => sum + fold.edge, 0) / passed.length : 0,
        bestModels: Object.entries(passed.reduce((counts, fold) => {
          counts[fold.selectedModel] = (counts[fold.selectedModel] ?? 0) + 1;
          return counts;
        }, {})).sort((a, b) => b[1] - a[1]).map(([model, count]) => ({ model, count })),
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
    }, emptyBucket());
    const randomAgg = rows.reduce((sum, row) => sum + row.randomAggregate * row.aggregate.n, 0) /
      Math.max(1, rows.reduce((sum, row) => sum + row.aggregate.n, 0));
    totals[side] = {
      aggregate: finalize(aggregate),
      randomAggregate: randomAgg,
      totalPassFolds: rows.reduce((sum, row) => sum + row.passCount, 0),
      totalStableWins: rows.reduce((sum, row) => sum + row.stableWinCount, 0),
      totalLosses: rows.reduce((sum, row) => sum + row.lossCount, 0),
    };
  }

  const output = {
    generatedAt: new Date().toISOString(),
    minValidationEdge,
    totals,
    markets,
  };
  const outPath = path.join(process.cwd(), "scratch", "digit-elimination-stability-output.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  const pct = (value) => `${(value * 100).toFixed(1)}%`;
  console.log("# Digit Elimination Rolling Stability");
  console.log(`Output: ${outPath}`);
  for (const side of sides) {
    const row = totals[side];
    console.log(`${side}: passes ${row.totalPassFolds}, wins ${row.totalStableWins}, losses ${row.totalLosses}, random ${pct(row.randomAggregate)}, tested ${pct(row.aggregate.accuracy)}, avg ${row.aggregate.avgCorrect.toFixed(2)}/4`);
  }
  console.log("\nStrongest stable market/side rows:");
  markets
    .filter((row) => row.passCount >= 3)
    .sort((a, b) => (b.aggregate.accuracy - b.randomAggregate) - (a.aggregate.accuracy - a.randomAggregate))
    .slice(0, 15)
    .forEach((row) => {
      console.log(`${row.market} ${row.side}: pass ${row.passCount}, wins ${row.stableWinCount}, losses ${row.lossCount}, edge ${pct(row.aggregate.accuracy - row.randomAggregate)}, acc ${pct(row.aggregate.accuracy)}, models ${row.bestModels.slice(0, 2).map((m) => `${m.model} x${m.count}`).join("; ")}`);
    });
}

main();
