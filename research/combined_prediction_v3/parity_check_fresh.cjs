/* Fresh parity check: run the real production buildCombinedAnalysis for a sample
 * of fresh 2026-10-16+ events and save its public lists. The Python study
 * reconstructs the same lists from the frozen fresh replay features; verify_study.py
 * compares them. Production sources are read, never written. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
require("../dp_panel_v3/ts-loader.cjs");

const ROOT = path.resolve(__dirname, "../..");
const HERE = __dirname;
const V2 = path.join(ROOT, "research", "combined_prediction_v2");
const { loadEvents, sourceHashes } = require("../combined_prediction_v1/export_replay.cjs");
const { buildCombinedAnalysis } = require("../../src/lib/combined-prediction.ts");
const { historicalCutoffISO } = require("../../src/lib/prediction-contract.ts");
const { calculateSutta } = require("../../src/lib/predictor/panel-utils.ts");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function makeRecord(market, isoDate, openPanel, closePanel) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = DAYS[date.getUTCDay()];
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const monday = `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
  return {
    id: `${market}|${monday}|${day}`, market, dateRangeStart: monday, dateRangeEnd: isoDate,
    day, openPanel, closePanel, openSutta: openPanel ? calculateSutta(openPanel) : -1,
    closeSutta: closePanel ? calculateSutta(closePanel) : -1,
    jodi: openPanel && closePanel ? `${calculateSutta(openPanel)}${calculateSutta(closePanel)}` : "", savedAt: 0,
  };
}

// One declared Open sample per fresh date plus one pre-open sample, spread over markets.
const SAMPLE = [
  ["2026-10-16", "Sridevi", true],
  ["2026-10-16", "Kalyan", false],
  ["2026-10-16", "Madhur Day", true],
  ["2026-10-17", "Time Bazar", true],
  ["2026-10-17", "Sridevi", true],
];

function readCsv(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  assert.equal(lines.shift(), "date,market,open,close");
  return lines.map((line) => {
    const [date, market, open, close] = line.split(",");
    return { date, market, open, close, record: makeRecord(market, date, open, close) };
  });
}

function sideDump(side) {
  return {
    suttas: side.suttas.map((pick) => pick.sutta),
    panelPicks: side.panelPicks.map((pick) => pick.panel),
    spPicks: side.spPicks.map((pick) => pick.panel),
    dpPicks: side.dpPicks.map((pick) => pick.panel),
  };
}

function main() {
  const before = sourceHashes();
  const { events } = loadEvents();
  const october = readCsv(path.join(V2, "october_rows.csv"));
  const fresh = readCsv(path.join(HERE, "fresh_rows.csv"));
  const histories = {};
  for (const event of [...events, ...october, ...fresh]) (histories[event.market] ??= []).push(event);
  for (const rows of Object.values(histories)) rows.sort((a, b) => a.date.localeCompare(b.date));
  const output = {};
  for (const [date, market, declared] of SAMPLE) {
    const event = fresh.find((row) => row.date === date && row.market === market);
    assert(event, `Missing fresh sample event ${date} ${market}`);
    const cutoff = historicalCutoffISO(date);
    const priorAll = Object.fromEntries(Object.entries(histories).map(([name, rows]) => [name,
      rows.filter((row) => row.date >= cutoff && row.date < date).map((row) => row.record),
    ]));
    const prior = priorAll[market];
    assert(prior.length >= 180);
    const targetDate = new Date(`${date}T12:00:00+05:30`);
    const pre = buildCombinedAnalysis(market, prior, priorAll, targetDate);
    assert.equal(pre.status, "ready", `${market} ${date}: ${pre.reason}`);
    const known = declared
      ? buildCombinedAnalysis(market, prior, priorAll, targetDate, event.record.openSutta, event.record.openPanel)
      : pre;
    assert.equal(known.status, "ready");
    output[`${date}|${market}`] = {
      date, market, declared,
      open: sideDump(pre.open),
      closePre: sideDump(pre.close),
      closeKnown: declared ? sideDump(known.close) : null,
    };
    console.log(`Fresh parity sample ${date} ${market} declared=${declared}: ok`);
  }
  assert.deepEqual(sourceHashes(), before, "Production sources changed during fresh parity check");
  const freshMeta = JSON.parse(fs.readFileSync(path.join(HERE, "fresh_replay_metadata.json"), "utf8"));
  const payload = {
    generatedFrom: "production buildCombinedAnalysis",
    productionSourceHashes: before,
    freshReplaySHA256: freshMeta.sha256,
    freshCsvSHA256: hash(fs.readFileSync(path.join(HERE, "fresh_rows.csv"))),
    samples: output,
  };
  fs.writeFileSync(path.join(HERE, "parity_production_fresh.json"), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Saved parity_production_fresh.json with ${Object.keys(output).length} samples`);
}

if (require.main === module) main();
