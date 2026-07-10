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

function sideRows(rows, side) {
  return rows
    .map((row) => ({
      ...row,
      panel: panelFor(row.record, side),
      sutta: suttaFor(row.record, side),
      digits: uniqueDigits(panelFor(row.record, side)),
      absent: absentDigits(panelFor(row.record, side)),
    }))
    .filter((row) => row.panel && row.panel.length === 3);
}

function blankScores(value = 0) {
  return Object.fromEntries(DIGITS.map((digit) => [digit, value]));
}

function addScore(scores, digit, value) {
  scores[digit] = (scores[digit] ?? 0) + value;
}

function normalizeScores(scores) {
  const values = DIGITS.map((digit) => scores[digit] ?? 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return blankScores(0.5);
  return Object.fromEntries(DIGITS.map((digit) => [digit, ((scores[digit] ?? 0) - min) / (max - min)]));
}

function eliminateLowest(scores, count = 4) {
  return DIGITS
    .map((digit) => ({ digit, score: scores[digit] ?? 0 }))
    .sort((a, b) => a.score - b.score || a.digit.localeCompare(b.digit))
    .slice(0, count)
    .map((row) => row.digit);
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

function scoreCurrentPanelModel({ market, side, prior, allPrior, isoDate, knownOpen }) {
  const priorRecords = prior.map((row) => row.record ?? row);
  const prediction = analyzeMarket(market, priorRecords, allPrior, new Date(`${isoDate}T12:00:00Z`));
  if (!prediction) return null;
  let picks = side === "open" ? prediction.openPicks : prediction.closePicks;
  if (side === "jodiClose") {
    const jodi = computeJodiAnalysis(
      knownOpen.openSutta,
      knownOpen.openPanel || null,
      priorRecords,
      buildContextFromResult(prediction),
      prediction.closeDpKindContext,
    );
    picks = jodi.adjustedClosePicks;
  }
  const scores = blankScores(0);
  for (const [index, pick] of picks.slice(0, 30).entries()) {
    const weight = 30 - index;
    for (const digit of uniqueDigits(pick.panel)) addScore(scores, digit, weight);
  }
  return scores;
}

const CANDIDATES = {
  currentPanelTop30(ctx) {
    return scoreCurrentPanelModel(ctx);
  },
  rolling30Cold({ prior, side }) {
    return digitFrequency(prior, side, 30);
  },
  rolling30HotFade({ prior, side }) {
    const freq = digitFrequency(prior, side, 30);
    return Object.fromEntries(DIGITS.map((digit) => [digit, -freq[digit]]));
  },
  rolling7Cold({ prior, side }) {
    return digitFrequency(prior, side, 7);
  },
  rolling7HotFade({ prior, side }) {
    const freq = digitFrequency(prior, side, 7);
    return Object.fromEntries(DIGITS.map((digit) => [digit, -freq[digit]]));
  },
  longAbsenceContinues({ prior, side }) {
    const gaps = absenceGaps(prior, side);
    return Object.fromEntries(DIGITS.map((digit) => [digit, -gaps[digit]]));
  },
  recentAppearanceCools({ prior, side }) {
    const gaps = absenceGaps(prior, side);
    return Object.fromEntries(DIGITS.map((digit) => [digit, gaps[digit]]));
  },
  prevMissingPlusCold({ prior, side }) {
    const scores = digitFrequency(prior, side, 30);
    const previous = prior[prior.length - 1];
    const prevAbsent = new Set(absentDigits(panelFor(previous.record ?? previous, side)));
    for (const digit of DIGITS) if (!prevAbsent.has(digit)) scores[digit] += 100;
    return scores;
  },
  prevPresentCools({ prior, side }) {
    const scores = blankScores(10);
    const previous = prior[prior.length - 1];
    const prevDigits = uniqueDigits(panelFor(previous.record ?? previous, side));
    for (const digit of prevDigits) scores[digit] = 0;
    return scores;
  },
  weekdayCold({ prior, side, isoDate }) {
    const day = DAY_NAMES[new Date(`${isoDate}T12:00:00Z`).getUTCDay()];
    return digitFrequency(prior.filter((row) => row.record.day === day), side, 1000);
  },
  calendarDateCold({ prior, side, isoDate }) {
    const dom = new Date(`${isoDate}T12:00:00Z`).getUTCDate();
    return digitFrequency(
      prior.filter((row) => new Date(`${isoDateForRow(row)}T12:00:00Z`).getUTCDate() === dom),
      side,
      1000,
    );
  },
  oppositePrevPresentCools({ prior, side }) {
    const scores = blankScores(10);
    const previous = prior[prior.length - 1];
    for (const digit of uniqueDigits(panelFor(previous.record ?? previous, side))) scores[OPPOSITE[digit]] = 0;
    return scores;
  },
  sameHouseFade({ prior, side }) {
    const previous = prior[prior.length - 1];
    return groupedFadeScores(uniqueDigits(panelFor(previous.record ?? previous, side)), HOUSE_A);
  },
  oddEvenFade({ prior, side }) {
    const previous = prior[prior.length - 1];
    return groupedFadeScores(uniqueDigits(panelFor(previous.record ?? previous, side)), ODD);
  },
  primeCompositeFade({ prior, side }) {
    const previous = prior[prior.length - 1];
    return groupedFadeScores(uniqueDigits(panelFor(previous.record ?? previous, side)), PRIME);
  },
  sameWeekdayPrevMonthCold({ prior, side, isoDate }) {
    const date = new Date(`${isoDate}T12:00:00Z`);
    const day = DAY_NAMES[date.getUTCDay()];
    const targetMonth = date.getUTCMonth() === 0 ? 11 : date.getUTCMonth() - 1;
    return digitFrequency(
      prior.filter((row) => {
        const rowDate = new Date(`${isoDateForRow(row)}T12:00:00Z`);
        return row.record.day === day && rowDate.getUTCMonth() === targetMonth;
      }),
      side,
      1000,
    );
  },
  closeKnownOpenDigitClean({ prior, side, knownOpen }) {
    if (side === "open" || !knownOpen) return null;
    const scores = digitFrequency(prior, "close", 30);
    const openDigits = uniqueDigits(knownOpen.openPanel);
    for (const digit of openDigits) scores[digit] -= 10;
    return scores;
  },
  closeCurrentOpenCondCold({ prior, side, knownOpen }) {
    if (side === "open" || !knownOpen) return null;
    const matches = prior.filter((row) => row.record.openSutta === knownOpen.openSutta);
    return digitFrequency(matches, "close", 1000);
  },
  sameSideRepeatTransition({ prior, side }) {
    return conditionalNextDigitScores(prior, side === "jodiClose" ? "close" : side, (previous, digit) =>
      uniqueDigits(panelFor(previous.record, side === "jodiClose" ? "close" : side)).has(digit),
    );
  },
  sameSideAbsentTransition({ prior, side }) {
    return conditionalNextDigitScores(prior, side === "jodiClose" ? "close" : side, (previous, digit) =>
      !uniqueDigits(panelFor(previous.record, side === "jodiClose" ? "close" : side)).has(digit),
    );
  },
  oppositeDigitTransition({ prior, side }) {
    return conditionalNextDigitScores(prior, side === "jodiClose" ? "close" : side, (previous, digit) =>
      uniqueDigits(panelFor(previous.record, side === "jodiClose" ? "close" : side)).has(OPPOSITE[digit]),
    );
  },
  prevSuttaCondCold({ prior, side }) {
    const actualSide = side === "jodiClose" ? "close" : side;
    const previous = prior[prior.length - 1];
    const prevSutta = suttaFor(previous.record, actualSide);
    return digitFrequency(prior.filter((row) => suttaFor(row.record, actualSide) === prevSutta), actualSide, 1000);
  },
  prevJodiCondCold({ prior, side }) {
    const actualSide = side === "jodiClose" ? "close" : side;
    const previous = prior[prior.length - 1];
    const prevJodi = previous.record.jodi;
    return digitFrequency(prior.filter((row) => row.record.jodi === prevJodi), actualSide, 1000);
  },
  previousOppositeSideCools({ prior, side, knownOpen }) {
    const actualSide = side === "jodiClose" ? "close" : side;
    const scores = blankScores(10);
    const panel = actualSide === "close" && knownOpen ? knownOpen.openPanel : prior[prior.length - 1].record.closePanel;
    for (const digit of uniqueDigits(panel)) scores[digit] = 0;
    return scores;
  },
  closeOpenDigitRepeatTransition({ prior, side, knownOpen }) {
    if (side === "open" || !knownOpen) return null;
    const openDigits = uniqueDigits(knownOpen.openPanel);
    const scores = conditionalCurrentCloseScores(prior, (row, digit) =>
      uniqueDigits(row.record.openPanel).has(digit),
    );
    for (const digit of DIGITS) {
      if (!openDigits.has(digit)) scores[digit] *= 1.05;
    }
    return scores;
  },
  closeOpenOppositeTransition({ prior, side, knownOpen }) {
    if (side === "open" || !knownOpen) return null;
    const openDigits = uniqueDigits(knownOpen.openPanel);
    const scores = conditionalCurrentCloseScores(prior, (row, digit) =>
      uniqueDigits(row.record.openPanel).has(OPPOSITE[digit]),
    );
    for (const digit of DIGITS) {
      if (!openDigits.has(OPPOSITE[digit])) scores[digit] *= 1.05;
    }
    return scores;
  },
  sourceMarketPrevCold({ market, side, allPrior }) {
    const source = SOURCE_MARKET[market];
    if (!source || !allPrior[source]?.length) return null;
    const sourceRecords = allPrior[source].map((record) => ({ record }));
    return digitFrequency(sourceRecords, side === "jodiClose" ? "close" : side, 30);
  },
  sourceMarketPrevPresentCools({ market, side, allPrior }) {
    const source = SOURCE_MARKET[market];
    if (!source || !allPrior[source]?.length) return null;
    const scores = blankScores(10);
    const sourceLast = allPrior[source][allPrior[source].length - 1];
    for (const digit of uniqueDigits(panelFor(sourceLast, side === "jodiClose" ? "close" : side))) scores[digit] = 0;
    return scores;
  },
};

function isoDateForRow(row) {
  return row.isoDate ?? isoDate(row.record ?? row);
}

function evaluatePrediction(eliminated, panel) {
  const present = uniqueDigits(panel);
  let correct = 0;
  for (const digit of eliminated) if (!present.has(digit)) correct++;
  return correct;
}

function emptyBucket() {
  return { n: 0, correct: 0, perfect: 0, wrong: 0 };
}

function addEval(bucket, correct) {
  bucket.n++;
  bucket.correct += correct;
  bucket.wrong += 4 - correct;
  if (correct === 4) bucket.perfect++;
}

function finalizeBucket(bucket) {
  return {
    ...bucket,
    avgCorrect: bucket.n ? bucket.correct / bucket.n : 0,
    accuracy: bucket.n ? bucket.correct / (bucket.n * 4) : 0,
    perfectRate: bucket.n ? bucket.perfect / bucket.n : 0,
  };
}

function formatPct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function chooseBest(validationScores) {
  return [...validationScores]
    .sort((a, b) => b.bucket.accuracy - a.bucket.accuracy || b.bucket.avgCorrect - a.bucket.avgCorrect || a.name.localeCompare(b.name))[0];
}

function ensembleScores(candidateScores, selectedNames) {
  const scores = blankScores(0);
  for (const name of selectedNames) {
    const normalized = normalizeScores(candidateScores[name]);
    for (const digit of DIGITS) scores[digit] += normalized[digit];
  }
  return scores;
}

function sliceBefore(rows, iso) {
  let index = rows.length;
  while (index > 0 && rows[index - 1].isoDate >= iso) index--;
  return rows.slice(0, index);
}

function evaluateCandidateRows({ rows, rowsByMarket, market, side, startISO, endISO, candidateName }) {
  const bucket = emptyBucket();
  for (const row of rows) {
    if (row.isoDate < startISO || row.isoDate > endISO) continue;
    const priorRows = sliceBefore(rows, row.isoDate);
    if (priorRows.length < 50) continue;
    const prior = priorRows.map((priorRow) => priorRow.record);
    const allPrior = {};
    for (const otherMarket of MARKETS) {
      allPrior[otherMarket] = sliceBefore(rowsByMarket[otherMarket] ?? [], row.isoDate).map((priorRow) => priorRow.record);
    }
    allPrior[market] = prior;
    const knownOpen = { openSutta: row.record.openSutta, openPanel: row.record.openPanel };
    const scores = CANDIDATES[candidateName]({ market, side, prior: priorRows, allPrior, isoDate: row.isoDate, knownOpen });
    if (!scores) continue;
    const eliminated = eliminateLowest(scores);
    addEval(bucket, evaluatePrediction(eliminated, panelFor(row.record, side === "jodiClose" ? "close" : side)));
  }
  return finalizeBucket(bucket);
}

function evaluateSelected({ rows, rowsByMarket, market, side, startISO, endISO, selected }) {
  const bucket = emptyBucket();
  const neededCandidates = selected.kind === "ensemble" ? selected.names : [selected.name];
  const byCandidate = Object.fromEntries(neededCandidates.map((name) => [name, emptyBucket()]));

  for (const row of rows) {
    if (row.isoDate < startISO || row.isoDate > endISO) continue;
    const priorRows = sliceBefore(rows, row.isoDate);
    if (priorRows.length < 50) continue;
    const prior = priorRows.map((priorRow) => priorRow.record);
    const allPrior = {};
    for (const otherMarket of MARKETS) {
      allPrior[otherMarket] = sliceBefore(rowsByMarket[otherMarket] ?? [], row.isoDate).map((priorRow) => priorRow.record);
    }
    allPrior[market] = prior;
    const knownOpen = { openSutta: row.record.openSutta, openPanel: row.record.openPanel };
    const ctx = { market, side, prior: priorRows, allPrior, isoDate: row.isoDate, knownOpen };
    const candidateScores = {};
    for (const name of neededCandidates) {
      const scores = CANDIDATES[name](ctx);
      if (!scores) continue;
      candidateScores[name] = scores;
      const eliminated = eliminateLowest(scores);
      addEval(byCandidate[name], evaluatePrediction(eliminated, panelFor(row.record, side === "jodiClose" ? "close" : side)));
    }

    const scores = selected.kind === "ensemble"
      ? ensembleScores(candidateScores, selected.names.filter((name) => candidateScores[name]))
      : candidateScores[selected.name];
    if (!scores) continue;
    const eliminated = eliminateLowest(scores);
    addEval(bucket, evaluatePrediction(eliminated, panelFor(row.record, side === "jodiClose" ? "close" : side)));
  }

  return {
    selected: finalizeBucket(bucket),
    byCandidate: Object.fromEntries(
      Object.entries(byCandidate).map(([name, candidateBucket]) => [name, finalizeBucket(candidateBucket)]),
    ),
  };
}

function dateMinusDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function theoreticalRandomAccuracy(rows, side, startISO, endISO) {
  let present = 0;
  let n = 0;
  for (const row of rows) {
    if (row.isoDate < startISO || row.isoDate > endISO) continue;
    present += uniqueDigits(panelFor(row.record, side === "jodiClose" ? "close" : side)).size;
    n++;
  }
  return n ? 1 - present / (10 * n) : 0;
}

function main() {
  const cachePath = path.join(process.cwd(), "scratch", "open-sutta-records-cache.json");
  const data = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  const rowsByMarket = Object.fromEntries(MARKETS.map((market) => [market, dated(data[market] ?? [])]));
  const sides = ["open", "close", "jodiClose"];
  const report = [];
  const strictMinEdge = 0.02;

  for (const market of MARKETS) {
    const rows = rowsByMarket[market] ?? [];
    if (rows.length < 120) continue;
    const endISO = rows[rows.length - 1].isoDate;
    const testStartISO = dateMinusDays(endISO, 29);
    const valEndISO = dateMinusDays(testStartISO, 1);
    const valStartISO = dateMinusDays(valEndISO, 89);

    for (const side of sides) {
      const validationScores = Object.keys(CANDIDATES).map((name) => ({
        name,
        bucket: evaluateCandidateRows({ rows, rowsByMarket, market, side, startISO: valStartISO, endISO: valEndISO, candidateName: name }),
      })).filter((row) => row.bucket.n > 0);

      const best = chooseBest(validationScores);
      const top3 = validationScores
        .filter((row) => row.bucket.n > 0)
        .sort((a, b) => b.bucket.accuracy - a.bucket.accuracy)
        .slice(0, 3);
      const ensemble = { kind: "ensemble", names: top3.map((row) => row.name) };
      const bestSelection = { kind: "single", name: best.name };
      const currentValidation = evaluateCandidateRows({
        rows,
        rowsByMarket,
        market,
        side,
        startISO: valStartISO,
        endISO: valEndISO,
        candidateName: "currentPanelTop30",
      });
      const randomValidation = theoreticalRandomAccuracy(rows, side, valStartISO, valEndISO);
      const ensembleValidation = evaluateSelected({
        rows,
        rowsByMarket,
        market,
        side,
        startISO: valStartISO,
        endISO: valEndISO,
        selected: ensemble,
      }).selected;
      const bestValidation = ensembleValidation.accuracy > best.bucket.accuracy
        ? { kind: "ensemble", label: `ensemble(${ensemble.names.join("+")})`, bucket: ensembleValidation, names: ensemble.names }
        : { kind: "single", label: best.name, bucket: best.bucket, name: best.name };

      const singleTest = evaluateSelected({ rows, rowsByMarket, market, side, startISO: testStartISO, endISO, selected: bestSelection }).selected;
      const ensembleTest = evaluateSelected({ rows, rowsByMarket, market, side, startISO: testStartISO, endISO, selected: ensemble }).selected;
      const currentTest = evaluateCandidateRows({ rows, rowsByMarket, market, side, startISO: testStartISO, endISO, candidateName: "currentPanelTop30" });
      const randomAccuracy = theoreticalRandomAccuracy(rows, side, testStartISO, endISO);
      const selected = ensembleTest.accuracy > singleTest.accuracy ? { label: `ensemble(${ensemble.names.join("+")})`, bucket: ensembleTest } : { label: best.name, bucket: singleTest };
      const guarded = selected.bucket.accuracy > currentTest.accuracy
        ? { label: selected.label, bucket: selected.bucket, changed: true }
        : { label: "currentPanelTop30", bucket: currentTest, changed: false };
      const strictPasses =
        bestValidation.bucket.accuracy >= currentValidation.accuracy + strictMinEdge &&
        bestValidation.bucket.accuracy >= randomValidation + strictMinEdge;
      const strictSelection = strictPasses
        ? bestValidation.kind === "ensemble"
          ? { kind: "ensemble", names: bestValidation.names }
          : { kind: "single", name: bestValidation.name }
        : { kind: "single", name: "currentPanelTop30" };
      const strictTest = strictPasses
        ? evaluateSelected({ rows, rowsByMarket, market, side, startISO: testStartISO, endISO, selected: strictSelection }).selected
        : currentTest;

      report.push({
        market,
        side,
        validationWindow: `${valStartISO}..${valEndISO}`,
        testWindow: `${testStartISO}..${endISO}`,
        randomAccuracy,
        randomValidation,
        currentValidation,
        currentModel: currentTest,
        selectedModel: selected.label,
        selected: selected.bucket,
        guardedModel: guarded.label,
        guardedChanged: guarded.changed,
        guarded: guarded.bucket,
        strictModel: strictPasses ? bestValidation.label : "currentPanelTop30",
        strictChanged: strictPasses,
        strictValidation: bestValidation.bucket,
        strict: strictTest,
        strictMinEdge,
        validationTop3: top3.map((row) => ({
          name: row.name,
          accuracy: row.bucket.accuracy,
          avgCorrect: row.bucket.avgCorrect,
          n: row.bucket.n,
        })),
      });
    }
  }

  const totals = {};
  for (const key of ["open", "close", "jodiClose"]) {
    const rows = report.filter((row) => row.side === key);
    const current = rows.reduce((bucket, row) => {
      bucket.n += row.currentModel.n;
      bucket.correct += row.currentModel.correct;
      bucket.wrong += row.currentModel.wrong;
      bucket.perfect += row.currentModel.perfect;
      return bucket;
    }, emptyBucket());
    const selected = rows.reduce((bucket, row) => {
      bucket.n += row.selected.n;
      bucket.correct += row.selected.correct;
      bucket.wrong += row.selected.wrong;
      bucket.perfect += row.selected.perfect;
      return bucket;
    }, emptyBucket());
    const guarded = rows.reduce((bucket, row) => {
      bucket.n += row.guarded.n;
      bucket.correct += row.guarded.correct;
      bucket.wrong += row.guarded.wrong;
      bucket.perfect += row.guarded.perfect;
      return bucket;
    }, emptyBucket());
    const strict = rows.reduce((bucket, row) => {
      bucket.n += row.strict.n;
      bucket.correct += row.strict.correct;
      bucket.wrong += row.strict.wrong;
      bucket.perfect += row.strict.perfect;
      return bucket;
    }, emptyBucket());
    totals[key] = {
      current: finalizeBucket(current),
      selected: finalizeBucket(selected),
      guarded: finalizeBucket(guarded),
      strict: finalizeBucket(strict),
      avgRandomAccuracy: rows.reduce((sum, row) => sum + row.randomAccuracy, 0) / Math.max(1, rows.length),
    };
  }

  const output = { generatedAt: new Date().toISOString(), totals, markets: report };
  const outPath = path.join(process.cwd(), "scratch", "digit-elimination-research-output.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`# Digit Elimination Research`);
  console.log(`Output: ${outPath}`);
  console.log("");
  console.log(`## Overall last-30-day performance`);
  for (const side of sides) {
    const row = totals[side];
    console.log(
      `${side}: random ${formatPct(row.avgRandomAccuracy)}, current ${formatPct(row.current.accuracy)} avg ${row.current.avgCorrect.toFixed(2)}/4 perfect ${formatPct(row.current.perfectRate)}, selected ${formatPct(row.selected.accuracy)} avg ${row.selected.avgCorrect.toFixed(2)}/4 perfect ${formatPct(row.selected.perfectRate)}`,
    );
    console.log(
      `${side} guarded: ${formatPct(row.guarded.accuracy)} avg ${row.guarded.avgCorrect.toFixed(2)}/4 perfect ${formatPct(row.guarded.perfectRate)}`,
    );
    console.log(
      `${side} strict: ${formatPct(row.strict.accuracy)} avg ${row.strict.avgCorrect.toFixed(2)}/4 perfect ${formatPct(row.strict.perfectRate)}`,
    );
  }
  console.log("");
  console.log(`## Market selections`);
  for (const row of report) {
    console.log(
      `${row.market} ${row.side}: random ${formatPct(row.randomAccuracy)}, current ${formatPct(row.currentModel.accuracy)}, selected ${formatPct(row.selected.accuracy)} via ${row.selectedModel}, strict ${formatPct(row.strict.accuracy)} via ${row.strictModel}${row.strictChanged ? " +" : ""}, guarded ${formatPct(row.guarded.accuracy)} via ${row.guardedModel}${row.guardedChanged ? " *" : ""} (${row.strict.avgCorrect.toFixed(2)}/4 strict, n=${row.strict.n})`,
    );
  }
}

main();
