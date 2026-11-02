/* Research-only current-production parity samples for all twelve replay markets.
 * The Python verifier compares these public lists to its reconstructed baseline. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
require("../dp_panel_v3/ts-loader.cjs");

const ROOT = path.resolve(__dirname, "../..");
const { loadEvents, sourceHashes } = require("../combined_prediction_v1/export_replay.cjs");
const { buildCombinedAnalysis } = require("../../src/lib/combined-prediction.ts");
const { historicalCutoffISO } = require("../../src/lib/prediction-contract.ts");
const { ALL_PANELS, calculateSutta } = require("../../src/lib/predictor/panel-utils.ts");
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

function makeRecord(market, isoDate, openPanel, closePanel) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = DAYS[date.getUTCDay()];
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const monday = `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
  return {
    id: `${market}|${monday}|${day}`, market, dateRangeStart: monday, dateRangeEnd: isoDate,
    day, openPanel, closePanel, openSutta: calculateSutta(openPanel),
    closeSutta: calculateSutta(closePanel),
    jodi: `${calculateSutta(openPanel)}${calculateSutta(closePanel)}`, savedAt: 0,
  };
}

function octoberTargets() {
  const filename = path.join(ROOT, "research/combined_prediction_v2/october_rows.csv");
  const raw = fs.readFileSync(filename, "utf8");
  const lines = raw.trim().split(/\r?\n/);
  assert.equal(lines.shift(), "date,market,open,close");
  const legal = new Set(ALL_PANELS);
  const seen = new Set();
  const events = lines.map((line) => {
    const fields = line.split(",");
    assert.equal(fields.length, 4, "Unexpected CSV fields");
    const [date, market, open, close] = fields;
    assert.match(date, /^2026-10-\d{2}$/);
    assert(date >= "2026-10-01" && date <= "2026-10-15");
    assert(market.length > 0 && legal.has(open) && legal.has(close));
    const key = `${date}|${market}`;
    assert(!seen.has(key), `Duplicate target ${key}`);
    seen.add(key);
    return { date, market, open, close, record: makeRecord(market, date, open, close) };
  });
  return { events, sha256: hash(raw) };
}

function sideDump(side) {
  const output = {
    suttas: side.suttas.map((pick) => pick.sutta),
    panelPicks: side.panelPicks.map((pick) => pick.panel),
    spPicks: side.spPicks.map((pick) => pick.panel),
    dpPicks: side.dpPicks.map((pick) => pick.panel),
  };
  for (const [name, count] of [["panelPicks", 10], ["spPicks", 30], ["dpPicks", 20]]) {
    assert.equal(output[name].length, count);
    assert.equal(new Set(output[name]).size, count);
  }
  return output;
}

function main() {
  const before = sourceHashes();
  const { events } = loadEvents();
  const october = octoberTargets();
  const histories = {};
  const latest = new Map();
  const seen = new Map();
  for (const event of [...events, ...october.events]) {
    const key = `${event.date}|${event.market}`;
    if (seen.has(key)) {
      const existing = seen.get(key);
      assert.equal(`${existing.open}|${existing.close}`, `${event.open}|${event.close}`, `Conflicting history ${key}`);
      continue;
    }
    seen.set(key, event);
    (histories[event.market] ??= []).push(event);
  }
  for (const event of october.events) {
    const current = latest.get(event.market);
    if (!current || event.date > current.date) latest.set(event.market, event);
  }
  assert.equal(latest.size, 12, "Expected all twelve replay markets");
  for (const rows of Object.values(histories)) rows.sort((a, b) => a.date.localeCompare(b.date));
  const output = {};
  for (const [market, event] of [...latest].sort(([a], [b]) => a.localeCompare(b))) {
    const date = event.date;
    const cutoff = historicalCutoffISO(date);
    const priorAll = Object.fromEntries(Object.entries(histories).map(([name, rows]) => [name,
      rows.filter((row) => row.date >= cutoff && row.date < date).map((row) => row.record),
    ]));
    const prior = priorAll[market];
    assert(prior.length >= 180, `${market}: insufficient history`);
    const targetDate = new Date(`${date}T12:00:00+05:30`);
    const pre = buildCombinedAnalysis(market, prior, priorAll, targetDate);
    assert.equal(pre.status, "ready", `${market} ${date}: ${pre.reason}`);
    const known = buildCombinedAnalysis(market, prior, priorAll, targetDate,
      event.record.openSutta, event.record.openPanel);
    assert.equal(known.status, "ready", `${market} ${date}: ${known.reason}`);
    output[`${date}|${market}`] = {
      date, market, declared: true, historyCount: prior.length,
      open: sideDump(pre.open), closePre: sideDump(pre.close), closeKnown: sideDump(known.close),
    };
    console.log(`Parity sample ${date} ${market}: three channels, nine panel lists`);
  }
  assert.deepEqual(sourceHashes(), before, "Production sources changed during parity check");
  const payload = {
    generatedFrom: "production buildCombinedAnalysis",
    sampleRule: "Latest October 1-15 replay date in each market, before Open and with actual Open declared",
    productionSourceHashes: before,
    octoberCsvSHA256: october.sha256,
    scriptSHA256: hash(fs.readFileSync(__filename)),
    marketCount: latest.size, expectedPanelListComparisons: latest.size * 3 * 3,
    samples: output,
  };
  fs.writeFileSync(path.join(__dirname, "parity_production.json"), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Saved ${latest.size} markets and ${payload.expectedPanelListComparisons} panel lists`);
}

if (require.main === module) main();
