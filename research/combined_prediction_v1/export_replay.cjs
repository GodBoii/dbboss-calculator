/* Research-only replay. Production sources are read, never written. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const Module = require("node:module");
const zlib = require("node:zlib");
const assert = require("node:assert/strict");
const ts = require("typescript");
require("../dp_panel_v3/ts-loader.cjs");

const ROOT = path.resolve(__dirname, "../..");
const PROTOCOL = JSON.parse(fs.readFileSync(path.join(__dirname, "protocol.json"), "utf8"));
const { ALL_PANELS, DOUBLE_PANELS, calculateSutta, analyzeMarket } = require("../../src/lib/predictor.ts");
const { historicalCutoffISO } = require("../../src/lib/prediction-contract.ts");
const { buildOpenSuttaRanking, buildCloseSuttaRanking } = require("../../src/lib/sutta-model/production.ts");
const { buildAbsentDigitsPrediction } = require("../../src/lib/absent-digits.ts");
const { buildPresentDigitsPredictionFromPanels } = require("../../src/lib/present-digits.ts");
const { rankPanelsTop10Model } = require("../../src/lib/predictor/panel-top10-model.ts");
const { predictDpPanels } = require("../../src/lib/predictor/dp-panel-model.ts");
const PANEL_INDEX = new Map(ALL_PANELS.map((panel, i) => [panel, i]));
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

function sourceHashes() {
  const out = {};
  for (const name of fs.readdirSync(path.join(ROOT, "src/lib"), { recursive: true })) {
    const relative = `src/lib/${name.replaceAll("\\", "/")}`;
    if (relative.endsWith(".ts")) out[relative] = hash(fs.readFileSync(path.join(ROOT, relative)));
  }
  return out;
}

function researchModule(relative, replacements) {
  const filename = path.join(ROOT, relative);
  let source = fs.readFileSync(filename, "utf8");
  for (const [before, after] of replacements) {
    assert.equal(source.split(before).length, 2, `Adapter match must be unique: ${relative} ${before}`);
    source = source.replace(before, after);
  }
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  instance._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
  return instance.exports;
}

// Expose the full existing order and raw logits without changing their formulas.
const fullAnalyzer = researchModule("src/lib/predictor/analyze.ts", [
  ["openPanelPicks: openPanelPicks.slice(0, PANEL_PREDICTION_COUNT)", "openPanelPicks: openPanelPicks"],
  ["closePanelPicks: closePanelPicks.slice(0, PANEL_PREDICTION_COUNT)", "closePanelPicks: closePanelPicks"],
]);
const rawPanel = researchModule("src/lib/predictor/panel-top10-model.ts", [
  ["return scored.map((item) => item.panel);", "return scored.map((item) => ({ panel: item.panel, score: item.score }));"],
]);
const rawDp = researchModule("src/lib/predictor/dp-panel-model.ts", [
  ["openPicks: open.picks,", "openPicks: open.picks, openProbabilities: open.probs,"],
  ["closePicks: close.picks,", "closePicks: close.picks, closeProbabilities: close.probs,"],
]);

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

function loadEvents() {
  const text = fs.readFileSync(path.join(ROOT, PROTOCOL.source), "utf8").trim();
  const lines = text.split(/\r?\n/);
  assert.equal(lines.shift(), "date,market,open,close");
  const byKey = new Map();
  let invalid = 0;
  for (const line of lines) {
    const fields = line.split(",");
    assert.equal(fields.length, 4, "Unexpected CSV quoting or field count");
    const [date, market, open, close] = fields;
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    if (!PANEL_INDEX.has(open) || !PANEL_INDEX.has(close)) { invalid++; continue; }
    const key = `${market}|${date}`;
    const existing = byKey.get(key);
    if (existing) assert.equal(`${existing.open}|${existing.close}`, `${open}|${close}`, `Conflicting duplicate ${key}`);
    byKey.set(key, { date, market, open, close, record: makeRecord(market, date, open, close) });
  }
  const events = [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.market.localeCompare(b.market));
  return { events, invalid };
}

function vector(rows) {
  const out = new Array(ALL_PANELS.length).fill(null);
  for (const row of rows) out[PANEL_INDEX.get(row.panel)] = row.score;
  assert(out.every(Number.isFinite));
  return out;
}

function suttaProbabilities(picks) {
  const out = new Array(10).fill(0);
  for (const pick of picks) out[pick.sutta] = pick.probabilityPct / 100;
  assert(Math.abs(out.reduce((a, b) => a + b, 0) - 1) < 1e-8);
  return out;
}

function conditionalClose(history) {
  const counts = Array.from({ length: 10 }, () => new Array(10).fill(0));
  const totals = new Array(10).fill(0);
  for (const record of history) { counts[record.openSutta][record.closeSutta]++; totals[record.closeSutta]++; }
  const prior = totals.map((count) => (count + 2) / (history.length + 20));
  return counts.map((row) => {
    const total = row.reduce((a, b) => a + b, 0);
    return row.map((count, s) => (count + PROTOCOL.jodi.smoothing * prior[s]) / (total + PROTOCOL.jodi.smoothing));
  });
}

function exportEvent(event, histories, checkPublic) {
  const { date, market } = event;
  const targetDate = new Date(`${date}T12:00:00+05:30`);
  const cutoff = historicalCutoffISO(date);
  const priorAll = Object.fromEntries(Object.entries(histories).map(([name, rows]) => [name,
    rows.filter((row) => row.date >= cutoff && row.date < date).map((row) => row.record),
  ]));
  const prior = priorAll[market];
  assert(prior.length >= PROTOCOL.minimum_history);
  const all = fullAnalyzer.analyzeMarket(market, prior, priorAll, targetDate, { knownOpenPanel: null });
  assert(all && all.openPanelPicks.length === 220 && all.closePanelPicks.length === 220);
  const rawOpen = rawPanel.rankPanelsTop10Model(prior, "open", event.record.day);
  const rawClose = rawPanel.rankPanelsTop10Model(prior, "close", event.record.day, event.open);
  assert.deepEqual(rawOpen.map((r) => r.panel), rankPanelsTop10Model(prior, "open", event.record.day));
  assert.deepEqual(rawClose.map((r) => r.panel), rankPanelsTop10Model(prior, "close", event.record.day, event.open));
  assert.deepEqual(rawOpen.map((r) => r.panel), all.openPanelPicks.map((r) => r.panel));
  const openSutta = buildOpenSuttaRanking([], {}, prior, market, targetDate);
  const closeSutta = buildCloseSuttaRanking([], {}, prior, market, null, {}, targetDate);
  const absent = buildAbsentDigitsPrediction(market, prior.map((r) => ({
    isoDate: require("../../src/lib/db.ts").getRecordISODate(r), day: r.day, openPanel: r.openPanel, closePanel: r.closePanel,
  })), date, event.record.day);
  const present = buildPresentDigitsPredictionFromPanels(market, prior, targetDate);
  assert(absent && present);
  const dpPre = rawDp.predictDpPanels(market, prior, priorAll, targetDate);
  // Only the declared Open enters this branch, never the target Close.
  const openOnly = makeRecord(market, date, event.open, "");
  const dpKnown = rawDp.predictDpPanels(market, [...prior, openOnly], priorAll, targetDate);
  assert(dpPre && dpKnown);
  if (checkPublic) {
    const publicPre = analyzeMarket(market, prior, priorAll, targetDate, { knownOpenPanel: null });
    const publicKnown = analyzeMarket(market, prior, priorAll, targetDate, { knownOpenPanel: event.open });
    assert.deepEqual(publicPre.openPanelPicks.map((p) => p.panel), all.openPanelPicks.slice(0, 10).map((p) => p.panel));
    assert.deepEqual(publicPre.closePanelPicks.map((p) => p.panel), all.closePanelPicks.slice(0, 10).map((p) => p.panel));
    assert.deepEqual(publicKnown.closePanelPicks.map((p) => p.panel), rawClose.slice(0, 10).map((p) => p.panel));
    const publicDp = predictDpPanels(market, [...prior, openOnly], priorAll, targetDate);
    assert.deepEqual(publicDp.closePicks, dpKnown.closePicks);
  }
  const conditional = conditionalClose(prior);
  const op = suttaProbabilities(openSutta);
  const cp = suttaProbabilities(closeSutta);
  const mix = new Array(10).fill(0).map((_, c) => op.reduce((sum, probability, o) => sum + probability * conditional[o][c], 0));
  const channel = (side, scores, dp, conditionalSutta) => ({
    logits: scores, dpProbabilities: dp, sutta: side === "open" ? op : cp,
    appearance: absent[side].digitProbabilities.map((p) => p.appearanceProbability),
    avoid: absent[side].candidateAvoidDigits, present: present[side].predictedDigits,
    presentAppearance: present[side].digitProbabilities.map((p) => p.appearanceProbability),
    conditionalSutta,
  });
  // The pre-Open heuristic has no probability API. Its order is represented by
  // an explicit rank-temperature prior, not by mislabeled display confidence.
  const preScores = all.closePanelPicks.map((p, rank) => ({ panel: p.panel, score: -rank / 40 }));
  return {
    date, market, historyCount: prior.length, historyCutoff: cutoff,
    historyMaxDate: histories[market].filter((r) => r.date < date).at(-1).date,
    actualOpen: event.open, actualClose: event.close, conditionalClose: conditional,
    channels: {
      open: channel("open", vector(rawOpen), dpPre.openProbabilities, op),
      close_pre: channel("close", vector(preScores), dpPre.closeProbabilities, mix),
      close_known: channel("close", vector(rawClose), dpKnown.closeProbabilities, conditional[event.record.openSutta]),
    },
    productionSuttas: { open: openSutta.map((p) => p.sutta), close: closeSutta.map((p) => p.sutta) },
  };
}

function main() {
  const before = sourceHashes();
  const { events, invalid } = loadEvents();
  const histories = {};
  for (const event of events) (histories[event.market] ??= []).push(event);
  const targets = events.filter((event) => event.date >= PROTOCOL.start && event.date <= PROTOCOL.end);
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : targets.length;
  assert(Number.isInteger(limit) && limit > 0);
  const selected = targets.slice(0, limit);
  const lines = [];
  const parityMarkets = new Set();
  const started = Date.now();
  for (const [i, event] of selected.entries()) {
    lines.push(JSON.stringify(exportEvent(event, histories, !parityMarkets.has(event.market))));
    parityMarkets.add(event.market);
    if ((i + 1) % 25 === 0) console.log(`Replayed ${i + 1}/${selected.length}, ${event.date}, ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }
  assert.deepEqual(sourceHashes(), before, "Production sources changed during replay");
  const raw = Buffer.from(`${lines.join("\n")}\n`);
  const output = limitArg >= 0 ? "smoke-replay.jsonl.gz" : "replay.jsonl.gz";
  fs.writeFileSync(path.join(__dirname, output), zlib.gzipSync(raw));
  const metadata = {
    study: PROTOCOL.study, start: PROTOCOL.start, end: PROTOCOL.end, targets: selected.length,
    markets: [...parityMarkets].sort(), invalidSourceRows: invalid,
    sourceSHA256: hash(fs.readFileSync(path.join(ROOT, PROTOCOL.source))),
    protocolSHA256: hash(fs.readFileSync(path.join(__dirname, "protocol.json"))),
    replaySHA256: hash(raw), productionSourceHashes: before,
    panelOrder: ALL_PANELS, dpOrder: DOUBLE_PANELS,
    publicAdapterParity: "Raw logits/full order match public model calls; full analyzer prefix checked for each market.",
    closePreProbabilityConvention: "softmax(-rank/40), preserves exact public order; not calibrated",
    actualSuttaConvention: "Derived from legal panel digits; source CSV contains no separate Jodi field.",
    elapsedSeconds: (Date.now() - started) / 1000,
  };
  const metadataName = limitArg >= 0 ? "smoke-metadata.json" : "replay_metadata.json";
  fs.writeFileSync(path.join(__dirname, metadataName), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(JSON.stringify({ output, targets: selected.length, elapsedSeconds: metadata.elapsedSeconds }));
}

if (require.main === module) main();
module.exports = { loadEvents, exportEvent, sourceHashes };
