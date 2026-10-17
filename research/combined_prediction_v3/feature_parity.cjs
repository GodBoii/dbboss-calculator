/* Feature parity: recompute the sealed October replay features with the current
 * production sources and compare them, field by field, against the frozen
 * extension_replay.jsonl.gz exported before the 2026-10-17 exposure commits.
 * Exact equality demonstrates the commits changed only opt-in surfaces, not the
 * feature values the V3 study consumes. Production sources are read, never written. */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { loadEvents, exportEvent, sourceHashes } = require("../combined_prediction_v1/export_replay.cjs");

const HERE = __dirname;
const ROOT = path.resolve(__dirname, "../..");
const V2 = path.join(ROOT, "research", "combined_prediction_v2");
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

function diffWalk(left, right, pathName, out) {
  if (Array.isArray(left) || Array.isArray(right)) {
    assert(Array.isArray(left) && Array.isArray(right));
    if (left.length !== right.length) return void out.push({ path: pathName, left: `len ${left.length}`, right: `len ${right.length}` });
    left.forEach((value, i) => diffWalk(value, right[i], `${pathName}[${i}]`, out));
  } else if (left && right && typeof left === "object" && typeof right === "object") {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) diffWalk(left[key], right[key], pathName ? `${pathName}.${key}` : key, out);
  } else if (!(left === right)) {
    // Strict equality keeps JSON round-trip semantics: JSON.stringify(-0) is
    // "0", so a live -0 and a parsed +0 are the same frozen value.
    out.push({ path: pathName, left, right });
  }
}

function main() {
  const before = sourceHashes();
  const { events } = loadEvents();
  const targets = fs.readFileSync(path.join(V2, "october_rows.csv"), "utf8").trim().split(/\r?\n/);
  assert.equal(targets.shift(), "date,market,open,close");
  const october = targets.map((line) => {
    const [date, market, open, close] = line.split(",");
    const row = { date, market, open, close };
    return { ...row, record: record(row) };
  });
  const histories = {};
  for (const event of [...events, ...october]) (histories[event.market] ??= []).push(event);
  for (const rows of Object.values(histories)) rows.sort((a, b) => a.date.localeCompare(b.date));
  const frozen = new Map();
  for (const line of zlib.gunzipSync(fs.readFileSync(path.join(V2, "extension_replay.jsonl.gz"))).toString("utf8").trim().split("\n")) {
    const row = JSON.parse(line);
    frozen.set(`${row.market}|${row.date}`, row);
  }
  // One event per market, the middle of its October rows: covers every market
  // and both early and late October dates without cherry-picking outcomes.
  const byMarket = new Map();
  for (const event of october) {
    if (!byMarket.has(event.market)) byMarket.set(event.market, []);
    byMarket.get(event.market).push(event);
  }
  const picks = [...byMarket.values()].map((rows) => rows[Math.floor(rows.length / 2)]);
  const report = { status: "pass", sampleSize: picks.length, productionSourceHashes: before, events: {} };
  for (const event of picks) {
    const key = `${event.market}|${event.date}`;
    const recomputed = exportEvent(event, histories, false);
    const sealed = frozen.get(key);
    assert(sealed, `Missing frozen October replay row ${key}`);
    const differences = [];
    diffWalk(recomputed, sealed, "", differences);
    report.events[key] = { differences: differences.length, examples: differences.slice(0, 5) };
    if (differences.length) report.status = "fail";
    console.log(`${key}: ${differences.length} field differences`);
  }
  assert.deepEqual(sourceHashes(), before, "Production sources changed during feature parity");
  fs.writeFileSync(path.join(HERE, "feature_parity.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "pass") {
    console.error("FEATURE PARITY FAILED: current sources no longer reproduce the sealed feature values.");
    process.exitCode = 1;
  }
  console.log(`feature_parity.json: ${report.status} (${picks.length} sealed October events, hash ${hash(fs.readFileSync(path.join(HERE, "feature_parity.json"))).slice(0, 12)})`);
}

if (require.main === module) main();
