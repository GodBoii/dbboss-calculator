/* Parity check: run the real production buildCombinedAnalysis for a sample of
 * October events and save its public lists. The Python study reconstructs the
 * same lists from the frozen replay features; verify_study.py compares them.
 * Production sources are read, never written. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
require("../dp_panel_v3/ts-loader.cjs");

const ROOT = path.resolve(__dirname, "../..");
const { loadEvents, sourceHashes } = require("../combined_prediction_v1/export_replay.cjs");
const { buildCombinedAnalysis } = require("../../src/lib/combined-prediction.ts");
const { historicalCutoffISO } = require("../../src/lib/prediction-contract.ts");
const { calculateSutta } = require("../../src/lib/predictor/panel-utils.ts");

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

// One deliberate sample per channel type and per market-route override.
const SAMPLE = [
  ["2026-10-02", "Kalyan", false],       // global routes, open + close_pre
  ["2026-10-05", "Sridevi", true],       // close_known, global routes
  ["2026-10-06", "Main Bazar", true],    // close_known
  ["2026-10-07", "Kalyan Night", true],  // close_known, market route on sp30
  ["2026-10-08", "Rajdhani Day", true],  // close_known, market route on sp30
  ["2026-10-09", "Time Bazar", false],   // open + close_pre, market route on sp30
];

function octoberTargets() {
  const text = fs.readFileSync(path.join(ROOT, "research/combined_prediction_v2/october_rows.csv"), "utf8").trim();
  const lines = text.split(/\r?\n/);
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
  const targets = octoberTargets();
  const histories = {};
  for (const event of [...events, ...targets]) (histories[event.market] ??= []).push(event);
  for (const rows of Object.values(histories)) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
  }
  const output = {};
  for (const [date, market, declared] of SAMPLE) {
    const event = targets.find((row) => row.date === date && row.market === market);
    assert(event, `Missing sample event ${date} ${market}`);
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
    console.log(`Parity sample ${date} ${market} declared=${declared}: ok`);
  }
  assert.deepEqual(sourceHashes(), before, "Production sources changed during parity check");
  const payload = {
    generatedFrom: "production buildCombinedAnalysis",
    productionSourceHashes: before,
    samples: output,
  };
  fs.writeFileSync(path.join(__dirname, "parity_production.json"), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Saved parity_production.json with ${Object.keys(output).length} samples`);
}

if (require.main === module) main();
