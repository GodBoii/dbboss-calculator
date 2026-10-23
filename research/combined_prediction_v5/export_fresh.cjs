/* Export October 18-22 with strictly prior complete history. Writes only V5. */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { loadEvents, exportEvent, sourceHashes } = require("../combined_prediction_v1/export_replay.cjs");
const { getRecordISODate } = require("../../src/lib/db.ts");
const HERE = __dirname;
const ROOT = path.resolve(HERE, "../..");
const hash = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

function record(row) {
  const date = new Date(`${row.date}T00:00:00Z`);
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()];
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const sum = (panel) => [...panel].reduce((total, digit) => total + Number(digit), 0) % 10;
  return { id: `${row.market}|${row.date}`, market: row.market, day,
    dateRangeStart: `${String(monday.getUTCDate()).padStart(2, "0")}/${String(monday.getUTCMonth() + 1).padStart(2, "0")}/${monday.getUTCFullYear()}`,
    dateRangeEnd: row.date, openPanel: row.open, closePanel: row.close,
    openSutta: sum(row.open), closeSutta: sum(row.close),
    jodi: `${sum(row.open)}${sum(row.close)}`, savedAt: 0 };
}

function readCsv(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  assert.equal(lines.shift(), "date,market,open,close");
  return lines.filter(Boolean).map((line) => {
    const fields = line.split(",");
    assert.equal(fields.length, 4);
    const [date, market, open, close] = fields;
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    return { date, market, open, close, record: record({ date, market, open, close }) };
  });
}

function main() {
  const selectionRaw = fs.readFileSync(path.join(HERE, "selection.json"));
  const protocolRaw = fs.readFileSync(path.join(HERE, "protocol.json"));
  const manifest = readJson(path.join(HERE, "selection_manifest.json"));
  assert.equal(manifest.selectionSHA256, hash(selectionRaw));
  assert.equal(manifest.protocolSHA256, hash(protocolRaw));
  const audit = readJson(path.join(HERE, "fresh_source_audit.json"));
  assert.equal(audit.selectionSHA256, hash(selectionRaw));
  assert.equal(audit.protocolSHA256, hash(protocolRaw));
  assert.equal(audit.csvSHA256, hash(fs.readFileSync(path.join(HERE, "fresh_rows.csv"))));
  assert.equal(audit.contextCsvSHA256, hash(fs.readFileSync(path.join(HERE, "fresh_context_rows.csv"))));
  for (const [name, digest] of Object.entries(audit.sealedSHA256)) {
    assert.equal(hash(fs.readFileSync(path.join(ROOT, name))), digest, `Sealed history changed: ${name}`);
  }
  const before = sourceHashes();
  const parityPath = path.join(HERE, "feature_parity.json");
  const parity = readJson(parityPath);
  assert.equal(parity.status, "pass");
  assert.deepEqual(parity.productionSourceHashes, before, "Current source differs from verified feature parity");
  const { events } = loadEvents();
  const sealedOctober = readCsv(path.join(ROOT, "research/combined_prediction_v2/october_rows.csv"));
  const sealedLate = readCsv(path.join(ROOT, "research/combined_prediction_v3/fresh_rows.csv"));
  const context = readCsv(path.join(HERE, "fresh_context_rows.csv"));
  assert(context.every((row) => row.date >= "2026-10-16" && row.date < "2026-10-18"));
  const targets = readCsv(path.join(HERE, "fresh_rows.csv"));
  assert(targets.every((row) => row.date >= "2026-10-18" && row.date <= "2026-10-22"));
  assert.equal(targets.length, audit.rows);
  assert(targets.length > 0, "No complete fresh targets available");
  const histories = {};
  for (const row of [...events, ...sealedOctober, ...sealedLate, ...context, ...targets]) {
    (histories[row.market] ??= []).push(row);
  }
  for (const rows of Object.values(histories)) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < rows.length; i++) assert.notEqual(rows[i].date, rows[i - 1].date, "Duplicate history event");
  }
  const output = [], checked = new Set();
  const started = Date.now();
  for (const [index, event] of targets.entries()) {
    assert.equal(getRecordISODate(event.record), event.date);
    const replay = exportEvent(event, histories, !checked.has(event.market));
    assert(replay.historyMaxDate < replay.date);
    output.push(replay);
    checked.add(event.market);
    if ((index + 1) % 10 === 0) console.log(`Fresh replay ${index + 1}/${targets.length}`);
  }
  assert.deepEqual(sourceHashes(), before, "Production source changed during replay");
  assert.equal(hash(fs.readFileSync(path.join(HERE, "selection.json"))), hash(selectionRaw));
  const raw = Buffer.from(`${output.map((row) => JSON.stringify(row)).join("\n")}\n`);
  fs.writeFileSync(path.join(HERE, "fresh_replay.jsonl.gz"), zlib.gzipSync(raw));
  const metadata = { study: "combined-prediction-v5-fresh", freshStart: "2026-10-18", freshEnd: "2026-10-22",
    rows: output.length, dates: [...new Set(output.map((row) => row.date))].sort(), sha256: hash(raw),
    selectionSHA256: hash(selectionRaw), protocolSHA256: hash(protocolRaw),
    freshCsvSHA256: audit.csvSHA256, contextCsvSHA256: audit.contextCsvSHA256,
    sealedSHA256: audit.sealedSHA256, featureParitySHA256: hash(fs.readFileSync(parityPath)),
    productionSourceHashes: before, elapsedSeconds: (Date.now() - started) / 1000 };
  fs.writeFileSync(path.join(HERE, "fresh_replay_metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`Saved ${output.length} fresh replays.`);
}

if (require.main === module) main();
