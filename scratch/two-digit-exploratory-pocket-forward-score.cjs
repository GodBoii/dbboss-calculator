/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { dated, panelFor, maskFor, isAbsentPair, absentDigitCount, PAIRS, pct } = require("./two-digit-deep-research-runner.cjs");

const DAY_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function panelKind(panel) {
  const mask = maskFor(panel);
  let unique = 0;
  for (let digit = 0; digit <= 9; digit++) unique += mask & (1 << digit) ? 1 : 0;
  return unique === 3 ? "SP" : unique === 2 ? "DP" : "TP";
}

function uniqueRecords(records) {
  const map = new Map();
  for (const row of dated(records)) map.set(row.isoDate, row.record);
  return dated([...map.values()]);
}

function run() {
  const register = JSON.parse(fs.readFileSync(path.join(__dirname, "two-digit-exploratory-pocket-forward-register.json"), "utf8"));
  const cache = JSON.parse(fs.readFileSync(path.join(__dirname, "open-sutta-records-cache.json"), "utf8"));
  const livePath = path.join(__dirname, "live-freshness-check-output.json");
  const live = fs.existsSync(livePath) ? JSON.parse(fs.readFileSync(livePath, "utf8")) : null;
  const liveRows = live?.liveRecords?.[register.market] || [];
  const rows = uniqueRecords([...(cache[register.market] || []), ...liveRows]);
  const allowed = new Set(register.rule.allowedWeekdays);
  const calls = [];
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    if (row.isoDate <= register.startAfter) continue;
    const weekday = DAY_NAME[row.date.getUTCDay()];
    if (!allowed.has(weekday)) continue;
    const previousKind = panelKind(panelFor(rows[index - 1], "open"));
    const digits = register.rule.avoidPairByPreviousOpenKind[previousKind];
    if (!digits) continue;
    const pair = PAIRS.find((candidate) => candidate.digits[0] === digits[0] && candidate.digits[1] === digits[1]);
    const mask = maskFor(panelFor(row, "close"));
    if (!pair || !mask) continue;
    calls.push({ date: row.isoDate, weekday, previousOpenKind: previousKind, pair: pair.key, closePanel: panelFor(row, "close"), hit: isAbsentPair(pair, mask), absentDigits: absentDigitCount(pair, mask) });
  }
  const correct = calls.filter((call) => call.hit).length;
  const output = {
    generatedAt: new Date().toISOString(),
    registerStatus: register.status,
    startAfter: register.startAfter,
    newestAvailableDate: rows.at(-1)?.isoDate || null,
    calls,
    summary: { correct, total: calls.length, accuracy: calls.length ? correct / calls.length : null },
    promotionEligible: calls.length >= register.promotionRequirements.minimumFreshCalls && correct / calls.length >= register.promotionRequirements.minimumObservedStrictAccuracy,
  };
  fs.writeFileSync(path.join(__dirname, "two-digit-exploratory-pocket-forward-score-output.json"), JSON.stringify(output, null, 2));
  console.log(`Fresh calls: ${calls.length}`);
  console.log(`Strict accuracy: ${calls.length ? `${pct(output.summary.accuracy)} (${correct}/${calls.length})` : "n/a"}`);
  console.log(`Promotion eligible: ${output.promotionEligible}`);
}

if (require.main === module) run();
