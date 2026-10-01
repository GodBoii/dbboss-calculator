/* Replay the current production Open/Close panel ranker on every target in
 * the research period using only strictly earlier calendar dates.
 *
 * Usage: node research/panel_top10_v1/replay_production.cjs [startISO] [endISO] [outFile]
 */
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const ts = require("typescript")

const ROOT = path.resolve(__dirname, "..", "..")
const originalResolve = Module._resolveFilename
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolve.call(this, path.join(ROOT, "src", request.slice(2)), parent, isMain, options)
  }
  return originalResolve.call(this, request, parent, isMain, options)
}
for (const ext of [".ts", ".tsx"]) {
  require.extensions[ext] = function registerTypeScript(module, filename) {
    const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText
    module._compile(output, filename)
  }
}

const { analyzeMarket } = require(path.join(ROOT, "src", "lib", "predictor.ts"))
const { historicalCutoffISO } = require(path.join(ROOT, "src", "lib", "prediction-contract.ts"))

const START = process.argv[2] ?? "2025-10-01"
const END = process.argv[3] ?? "2026-09-30"
const OUT = process.argv[4] ?? path.join(__dirname, "production_replay.json")
const MODE = process.argv[5] ?? "legacy"
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function addDays(iso, count) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + count)
  return d.toISOString().slice(0, 10)
}
const sutta = (panel) => [...panel].reduce((sum, digit) => sum + Number(digit), 0) % 10
function makeRecord(date, market, openPanel, closePanel) {
  const day = new Date(`${date}T00:00:00Z`)
  const week = addDays(date, -((day.getUTCDay() + 6) % 7))
  const display = (value) => {
    const [y, m, d] = value.split("-")
    return `${d}/${m}/${y}`
  }
  const openSutta = sutta(openPanel)
  const closeSutta = sutta(closePanel)
  return {
    id: `${market}|${date}`,
    market,
    dateRangeStart: display(week),
    dateRangeEnd: display(addDays(week, 6)),
    day: DAY_NAMES[day.getUTCDay()],
    openPanel,
    closePanel,
    openSutta,
    closeSutta,
    jodi: `${openSutta}${closeSutta}`,
    savedAt: 0,
  }
}

const grouped = {}
const csv = fs.readFileSync(path.join(__dirname, "chart_rows.csv"), "utf8").trim().split(/\r?\n/).slice(1)
for (const line of csv) {
  const [date, market, open, close] = line.split(",")
  if (!/^\d{3}$/.test(open) || !/^\d{3}$/.test(close)) continue
  ;(grouped[market] ??= []).push({ date, record: makeRecord(date, market, open, close) })
}
for (const rows of Object.values(grouped)) rows.sort((a, b) => a.date.localeCompare(b.date))
const MARKETS = Object.keys(grouped)

function prior(market, first, date) {
  return grouped[market].filter((item) => item.date >= first && item.date < date).map((item) => item.record)
}

const ledger = []
const started = Date.now()
for (const market of MARKETS) {
  for (const { date, record } of grouped[market]) {
    if (date < START || date > END) continue
    const first = historicalCutoffISO(date)
    const own = prior(market, first, date)
    if (own.length < 50) continue
    const priorAll = Object.fromEntries(MARKETS.map((name) => [name, prior(name, first, date)]))
    // MODE=legacy reproduces the pre-change Top-40 rankers; MODE=top10 scores
    // Close after today's Open is declared (as the Close tab shows it).
    const options = MODE === "legacy"
      ? { panelModel: "legacy", knownOpenPanel: null }
      : { knownOpenPanel: record.openPanel }
    const prediction = analyzeMarket(market, own, priorAll, new Date(`${date}T12:00:00`), options)
    if (!prediction) continue
    ledger.push({
      market,
      date,
      open: record.openPanel,
      close: record.closePanel,
      // Shown ranking (current Top-40 contract).
      prodOpen: prediction.openPanelPicks.slice(0, 40).map((pick) => pick.panel),
      prodClose: prediction.closePanelPicks.slice(0, 40).map((pick) => pick.panel),
    })
  }
  process.stderr.write(`${market}: done (${ledger.length} targets, ${((Date.now() - started) / 1000).toFixed(0)}s)\n`)
}
fs.writeFileSync(OUT, `${JSON.stringify({ start: START, end: END, ledger })}\n`)
process.stdout.write(`Saved ${ledger.length} targets to ${path.relative(ROOT, OUT)}\n`)
