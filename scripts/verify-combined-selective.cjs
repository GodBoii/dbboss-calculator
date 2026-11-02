/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const Module = require("node:module")
const ts = require("typescript")
require("../research/dp_panel_v3/ts-loader.cjs")
const { buildCombinedAnalysis } = require("../src/lib/combined-prediction.ts")
const { buildSelectiveCombinedOutputs } = require("../src/lib/combined-selective.ts")
const { ALL_PANELS, calculateSutta } = require("../src/lib/predictor/panel-utils.ts")
const { buildJodis } = require("../src/lib/sutta-model/production.ts")
const { historicalCutoffISO } = require("../src/lib/prediction-contract.ts")
const ROOT = path.resolve(__dirname, "..")
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/combined-selective-endpoints.json"), "utf8"))
const legal = new Set(ALL_PANELS)
const fields = { all10: "panelPicks", sp30: "spPicks", dp20: "dpPicks", absent2: "absentDigits" }
const started = performance.now()

// Compile the actual old implementation in memory, with its original relative imports.
const filename = path.join(ROOT, "src/lib/combined-prediction.ts")
const oldFixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/combined-before-selective.json"), "utf8"))
const oldSource = oldFixture.source
assert.equal(crypto.createHash("sha256").update(oldSource).digest("hex"), oldFixture.sha256, "Pre-selective source fixture changed")
const oldModule = new Module(filename, module)
oldModule.filename = filename
oldModule.paths = Module._nodeModulePaths(path.dirname(filename))
oldModule._compile(ts.transpileModule(oldSource, {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename)
const baseline = oldModule.exports.buildCombinedAnalysis

function record(market, date, openPanel, closePanel) {
  const dayDate = new Date(`${date}T00:00:00Z`)
  const day = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayDate.getUTCDay()]
  dayDate.setUTCDate(dayDate.getUTCDate() - (dayDate.getUTCDay() + 6) % 7)
  const monday = `${String(dayDate.getUTCDate()).padStart(2, "0")}/${String(dayDate.getUTCMonth() + 1).padStart(2, "0")}/${dayDate.getUTCFullYear()}`
  return { id: `${market}|${monday}|${day}`, market, day, dateRangeStart: monday, dateRangeEnd: date,
    openPanel, closePanel, openSutta: calculateSutta(openPanel), closeSutta: closePanel ? calculateSutta(closePanel) : -1,
    jodi: closePanel ? `${calculateSutta(openPanel)}${calculateSutta(closePanel)}` : "", savedAt: 0 }
}
const events = new Map()
for (const relative of ["research/panel_top10_v1/chart_rows.csv", "research/combined_prediction_v2/october_rows.csv",
  "research/combined_prediction_v3/fresh_rows.csv", "research/combined_prediction_v5/fresh_rows.csv",
  "research/combined_prediction_v5/fresh_context_rows.csv", "research/combined_prediction_v6/extension_context_rows.csv",
  "research/combined_prediction_v6/extension_rows.csv"]) {
  const lines = fs.readFileSync(path.join(ROOT, relative), "utf8").trim().split(/\r?\n/)
  assert.equal(lines.shift(), "date,market,open,close")
  for (const line of lines) {
    const [date, market, open, close] = line.split(",")
    if (!legal.has(open) || !legal.has(close)) continue
    const key = `${market}|${date}`
    const value = { date, market, open, close, record: record(market, date, open, close) }
    if (events.has(key)) assert.deepEqual(events.get(key), value, `Conflicting source ${key}`)
    events.set(key, value)
  }
}
const ordered = [...events.values()].sort((a, b) => a.date.localeCompare(b.date) || a.market.localeCompare(b.market))
function histories(date) {
  const all = {}
  for (const event of ordered) if (event.date < date && event.date >= historicalCutoffISO(date)) (all[event.market] ??= []).push(event.record)
  return all
}
const round = value => Math.round(value * 1e12) / 1e12
function ranked(probabilities, kind, count) {
  return ALL_PANELS.map((panel, index) => ({ panel, index, probability: round(probabilities[index]) }))
    .filter(({ panel }) => !kind || new Set(panel).size === kind)
    .sort((a, b) => b.probability - a.probability || a.index - b.index).slice(0, count).map(({ panel }) => panel)
}
function absent(probabilities) {
  let best, maximum = -1
  for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) {
    const score = round(probabilities.reduce((sum, p, i) => sum + (!ALL_PANELS[i].includes(String(a)) && !ALL_PANELS[i].includes(String(b)) ? p : 0), 0))
    if (score > maximum) { maximum = score; best = [a, b] }
  }
  return best
}
function changed(market, channel) {
  return market === "Sridevi" && channel === "open" ? ["panelPicks", "spPicks", "dpPicks", "absentDigits"]
    : market === "Rajdhani Night" && channel === "close_pre" ? ["spPicks"] : []
}
function compare(actual, old, market, channel, side) {
  assert.equal(actual.status, "ready"); assert.equal(old.status, "ready")
  const omitted = new Set(changed(market, channel))
  for (const key of Object.keys(old[side])) if (!omitted.has(key)) assert.deepEqual(actual[side][key], old[side][key], `${market}/${channel}/${key} changed`)
  for (const key of ["suttas", "presentDigits", "rankedPanels"]) assert.deepEqual(actual[side][key], old[side][key])
  for (const [field, size, kind] of [["panelPicks", 10], ["spPicks", 30, 3], ["dpPicks", 20, 2]]) {
    const picks = actual[side][field]
    assert.equal(picks.length, size); assert.equal(new Set(picks.map(p => p.panel)).size, size)
    for (const pick of picks) { assert(legal.has(pick.panel)); assert(Number.isFinite(pick.score)); if (kind) assert.equal(new Set(pick.panel).size, kind) }
  }
  assert.equal(new Set(actual[side].absentDigits).size, 2)
  for (const count of [1, 4, 5, 6, 10]) assert.deepEqual(
    buildJodis(actual.open.suttas.slice(0, count), actual.close.suttas.slice(0, count)),
    buildJodis(old.open.suttas.slice(0, count), old.close.suttas.slice(0, count)))
}
function comparePrediction(actual, old, market) {
  const allowed = new Set(market === "Sridevi" ? ["openPanelPicks", "openDpPicks", "openDpDigitFocus"] : [])
  for (const key of Object.keys(old.prediction)) if (!allowed.has(key)) assert.deepEqual(actual.prediction[key], old.prediction[key], `${market}/prediction/${key} changed`)
  assert.equal(actual.targetDate, old.targetDate)
  assert.equal(actual.knownOpenSutta, old.knownOpenSutta)
}

assert.deepEqual(golden.panelOrder, ALL_PANELS)
for (const [relative, digest] of Object.entries(golden.sourceHashes)) {
  const filename = path.join(ROOT, relative)
  // Large research replay files are optional provenance. The checked-in golden
  // inputs and chart CSVs make these runtime regression checks self-contained.
  if (!fs.existsSync(filename) && (relative.endsWith(".npz") || relative.endsWith(".jsonl.gz"))) continue
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex"), digest, `Golden source changed: ${relative}`)
}
let comparisons = 0
for (const item of golden.cases) {
  const local = item.history.map(row => record(item.market, row.date, row.openPanel, row.closePanel))
  const frozen = JSON.stringify({ local, probabilities: item.baseSP30 })
  const output = buildSelectiveCombinedOutputs(item.market, item.channel, local, item.baseSP30, item.date)
  assert(output, `Missing selective output ${item.market}/${item.channel}`)
  const picks = { sp30: ranked(output.sp, 3, 30) }
  if (output.kind === "sridevi-open") Object.assign(picks, { all10: ranked(output.panel, undefined, 10), dp20: ranked(output.dp, 2, 20), absent2: absent(output.absent) })
  assert.deepEqual(picks, item.expected, `Helper replay ${item.market}/${item.date}/${item.channel}`)
  assert.equal(JSON.stringify({ local, probabilities: item.baseSP30 }), frozen, "Helper mutated inputs")
  const all = histories(item.date), prior = all[item.market], date = new Date(`${item.date}T12:00:00+05:30`)
  const actual = buildCombinedAnalysis(item.market, prior, all, date)
  const old = baseline(item.market, prior, all, date)
  const side = item.channel === "open" ? "open" : "close"
  compare(actual, old, item.market, item.channel, side)
  compare(actual, old, item.market, side === "open" ? "close_pre" : "open", side === "open" ? "close" : "open")
  comparePrediction(actual, old, item.market)
  for (const [task, expected] of Object.entries(item.expected)) assert.deepEqual(
    task === "absent2" ? actual[side][fields[task]] : actual[side][fields[task]].map(p => p.panel), expected,
    `Public replay ${item.market}/${item.date}/${task}`)
  comparisons++
}

const dateISO = "2026-11-02", all = histories(dateISO), date = new Date(`${dateISO}T12:00:00+05:30`)
assert.equal(Object.keys(all).length, 12)
for (const [market, prior] of Object.entries(all)) {
  const before = JSON.stringify(all)
  for (const args of [[], [0], [0, "550"]]) {
    const actual = buildCombinedAnalysis(market, prior, all, date, ...args), old = baseline(market, prior, all, date, ...args)
    compare(actual, old, market, "open", "open")
    compare(actual, old, market, args.length ? "close_known" : "close_pre", "close")
    comparePrediction(actual, old, market)
    if (market !== "Sridevi" && market !== "Rajdhani Night") assert.deepEqual(actual, old, `${market} changed`)
    assert.deepEqual(actual.prediction.openPicks, old.prediction.openPicks)
    assert.deepEqual(actual.prediction.closePicks, old.prediction.closePicks)
  }
  assert.equal(JSON.stringify(all), before, "Analysis mutated input history")
}
for (const market of ["Sridevi", "Rajdhani Night"]) {
  const earlyAll = histories("2026-09-07"), earlyDate = new Date("2026-09-07T12:00:00+05:30")
  assert.deepEqual(buildCombinedAnalysis(market, earlyAll[market], earlyAll, earlyDate), baseline(market, earlyAll[market], earlyAll, earlyDate), "Earlier unsupported analyses changed")
  const prior = all[market], current = buildCombinedAnalysis(market, prior, all, date)
  const future = record(market, "2026-11-03", "123", "550")
  assert.deepEqual(buildCombinedAnalysis(market, [...prior, future], { ...all, [market]: [...prior, future] }, date), current)
  assert.deepEqual(buildCombinedAnalysis(market, [...prior].reverse(), all, date), current)
  assert.deepEqual(buildCombinedAnalysis(market, [...prior, prior.at(-1)], all, date), current)
  const conflict = { ...prior.at(-1), openPanel: prior.at(-1).openPanel === "123" ? "124" : "123" }
  assert.equal(buildCombinedAnalysis(market, [...prior, conflict], all, date).status, "unavailable")
  assert.equal(buildCombinedAnalysis(market, prior, all, date, 12).status, "unavailable")
  assert.equal(buildCombinedAnalysis(market, prior.slice(-50), all, date).status, "unavailable")
  const partial = record(market, dateISO, "550", "")
  assert.deepEqual(buildCombinedAnalysis(market, [...prior, partial], all, date), buildCombinedAnalysis(market, prior, all, date, 0, "550"))
  const complete = record(market, dateISO, "550", "123")
  const rolled = buildCombinedAnalysis(market, [...prior, complete], all, date)
  assert.equal(rolled.status, "ready"); assert.equal(rolled.targetDate, "2026-11-03")
  assert.deepEqual(rolled, buildCombinedAnalysis(market, [...prior, complete], all, new Date("2026-11-03T12:00:00+05:30")))
}
console.log(`Passed ${comparisons} independent selective replay cases, all 12 markets and known-Open modes, unchanged Sutta/Jodi/full rankings, budgets, input immutability and history boundaries in ${((performance.now() - started) / 1000).toFixed(1)}s.`)
