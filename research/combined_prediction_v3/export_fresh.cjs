/* Export the fresh 2026-10-16+ window on top of the sealed history; never rewrite sealed replays. */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { loadEvents, exportEvent, sourceHashes } = require("../combined_prediction_v1/export_replay.cjs");
const { getRecordISODate } = require("../../src/lib/db.ts");

const HERE = __dirname;
const ROOT = path.resolve(__dirname, "../..");
const V1 = path.join(ROOT, "research", "combined_prediction_v1");
const V2 = path.join(ROOT, "research", "combined_prediction_v2");
const FRESH_START = "2026-10-16";
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

function record(row) {
  const date = new Date(`${row.date}T00:00:00Z`);
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()];
  const monday = new Date(date);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const sum = (p) => [...p].reduce((a, b) => a + Number(b), 0) % 10;
  return { id: `${row.market}|${row.date}`, market: row.market, day,
    dateRangeStart: `${String(monday.getUTCDate()).padStart(2, "0")}/${String(monday.getUTCMonth() + 1).padStart(2, "0")}/${monday.getUTCFullYear()}`,
    dateRangeEnd: row.date, openPanel: row.open, closePanel: row.close,
    openSutta: sum(row.open), closeSutta: sum(row.close), jodi: `${sum(row.open)}${sum(row.close)}`, savedAt: 0 };
}

function readCsv(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  assert.equal(lines.shift(), "date,market,open,close");
  return lines.map((line) => {
    const fields = line.split(",");
    assert.equal(fields.length, 4, "Unexpected CSV quoting or field count");
    const [date, market, open, close] = fields;
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    return { date, market, open, close };
  });
}

function main() {
  // The fresh window can only be exported after the selection is frozen, from
  // audited rows that passed the source-identity gate.
  const selectionRaw = fs.readFileSync(path.join(HERE, "selection.json"));
  const protocolRaw = fs.readFileSync(path.join(HERE, "protocol.json"));
  const manifest = JSON.parse(fs.readFileSync(path.join(HERE, "selection_manifest.json"), "utf8"));
  assert.equal(manifest.selectionSHA256, hash(selectionRaw));
  assert.equal(manifest.protocolSHA256, hash(protocolRaw));
  const audit = JSON.parse(fs.readFileSync(path.join(HERE, "fresh_source_audit.json"), "utf8"));
  const freshCsvRaw = fs.readFileSync(path.join(HERE, "fresh_rows.csv"));
  assert.equal(audit.csvSHA256, hash(freshCsvRaw));
  assert.equal(audit.selectionSHA256, hash(selectionRaw));
  assert.equal(audit.protocolSHA256, hash(protocolRaw));
  const policy = JSON.parse(fs.readFileSync(path.join(HERE, "production_policy.json"), "utf8"));
  assert.equal(policy.sourceSHA256, hash(fs.readFileSync(path.join(ROOT, policy.source))));

  const before = sourceHashes();
  // The sealed V1/V2 replays were exported before the 2026-10-17 opt-in
  // exposure commits, so a raw source-hash match with V1's metadata is not
  // required. Instead, feature_parity.cjs must have just proved that the
  // current sources reproduce the sealed feature values exactly (12 markets).
  const parity = JSON.parse(fs.readFileSync(path.join(HERE, "feature_parity.json"), "utf8"));
  assert.equal(parity.status, "pass", "feature_parity.json is not a pass; rerun feature_parity.cjs");
  assert.deepEqual(parity.productionSourceHashes, before, "feature parity was computed on different production sources");
  const { events } = loadEvents();
  const sealedOctober = readCsv(path.join(V2, "october_rows.csv")).map((row) => ({ ...row, record: record(row) }));
  const targets = readCsv(path.join(HERE, "fresh_rows.csv")).map((row) => {
    assert(row.date >= FRESH_START, `fresh_rows.csv contains a date before ${FRESH_START}`);
    return { ...row, record: record(row) };
  });
  assert.equal(targets.length, audit.rows);
  const histories = {};
  for (const event of [...events, ...sealedOctober, ...targets]) (histories[event.market] ??= []).push(event);
  for (const rows of Object.values(histories)) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < rows.length; i++) assert.notEqual(rows[i].date, rows[i - 1].date);
  }
  const started = Date.now();
  const output = [];
  const checked = new Set();
  for (const [i, event] of targets.entries()) {
    assert.equal(getRecordISODate(event.record), event.date);
    output.push(exportEvent(event, histories, !checked.has(event.market)));
    checked.add(event.market);
    if ((i + 1) % 10 === 0) console.log(`Fresh replay ${i + 1}/${targets.length}`);
  }
  assert.deepEqual(sourceHashes(), before, "Production sources changed during replay");
  const raw = Buffer.from(`${output.map((r) => JSON.stringify(r)).join("\n")}\n`);
  fs.writeFileSync(path.join(HERE, "fresh_replay.jsonl.gz"), zlib.gzipSync(raw));
  const v1Meta = JSON.parse(fs.readFileSync(path.join(V1, "replay_metadata.json"), "utf8"));
  const metadata = {
    study: "combined-prediction-v3-fresh", freshStart: FRESH_START,
    dates: [...new Set(targets.map((row) => row.date))].sort(), rows: output.length,
    sha256: hash(raw), selectionSHA256: hash(selectionRaw), protocolSHA256: hash(protocolRaw),
    freshCsvSHA256: hash(freshCsvRaw),
    featureParitySHA256: hash(fs.readFileSync(path.join(HERE, "feature_parity.json"))),
    sealed: {
      v1ReplaySHA256: v1Meta.replaySHA256, v1SourceSHA256: v1Meta.sourceSHA256,
      v2ExtensionSHA256: JSON.parse(fs.readFileSync(path.join(V2, "extension_replay_metadata.json"), "utf8")).sha256,
      v2OctoberSHA256: hash(fs.readFileSync(path.join(V2, "october_rows.csv"))),
    },
    productionSourceHashes: before,
    elapsedSeconds: (Date.now() - started) / 1000,
  };
  fs.writeFileSync(path.join(HERE, "fresh_replay_metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`Saved ${output.length} fresh replays for ${metadata.dates.length} dates.`);
}

if (require.main === module) main();
