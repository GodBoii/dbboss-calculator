/* Append October observations to frozen history; never rewrite the V1 replay. */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { loadEvents, exportEvent, sourceHashes } = require("../combined_prediction_v1/export_replay.cjs");
const HERE = __dirname;
const protocol = JSON.parse(fs.readFileSync(path.join(HERE, "protocol.json"), "utf8"));
const { getRecordISODate } = require("../../src/lib/db.ts");

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

function main() {
  const policy = path.join(HERE, "frozen_policy.json");
  const audit = JSON.parse(fs.readFileSync(path.join(HERE, "extension_source_audit.json"), "utf8"));
  assert.equal(audit.frozen_policySHA256, crypto.createHash("sha256").update(fs.readFileSync(policy)).digest("hex"));
  const before = sourceHashes();
  const { events } = loadEvents();
  const lines = fs.readFileSync(path.join(HERE, "october_rows.csv"), "utf8").trim().split(/\r?\n/);
  assert.equal(lines.shift(), "date,market,open,close");
  const targets = lines.map((line) => {
    const [date, market, open, close] = line.split(",");
    assert(date >= protocol.extension_start && date <= protocol.extension_end);
    const row = { date, market, open, close };
    return { ...row, record: record(row) };
  });
  const histories = {};
  for (const event of [...events, ...targets]) (histories[event.market] ??= []).push(event);
  for (const rows of Object.values(histories)) {
    rows.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < rows.length; i++) assert.notEqual(rows[i].date, rows[i - 1].date);
  }
  const output = [];
  const checked = new Set();
  for (const [i, event] of targets.entries()) {
    assert.equal(getRecordISODate(event.record), event.date);
    output.push(exportEvent(event, histories, !checked.has(event.market)));
    checked.add(event.market);
    if ((i + 1) % 25 === 0) console.log(`October replay ${i+1}/${targets.length}`);
  }
  assert.deepEqual(sourceHashes(), before);
  const raw = Buffer.from(`${output.map((r) => JSON.stringify(r)).join("\n")}\n`);
  fs.writeFileSync(path.join(HERE, "extension_replay.jsonl.gz"), zlib.gzipSync(raw));
  fs.writeFileSync(path.join(HERE, "extension_replay_metadata.json"), JSON.stringify({ rows: output.length, sha256: crypto.createHash("sha256").update(raw).digest("hex"), productionSourceHashes: before }, null, 2) + "\n");
  console.log(`Saved ${output.length} strictly prior-date October replays.`);
}

if (require.main === module) main();
