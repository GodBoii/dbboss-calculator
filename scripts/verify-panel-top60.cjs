/* eslint-disable no-console */

const fs = require("fs")
const path = require("path")
const ts = require("typescript")

require.extensions[".ts"] = function registerTypeScript(module, filename) {
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

const {
  PANEL_PREDICTION_COUNT,
  analyzeMarket,
} = require("../src/lib/predictor.ts")
const { getRecordISODate } = require("../src/lib/backtest.ts")
const {
  HISTORICAL_LOOKBACK_MONTHS,
  JODI_GRID_COUNT,
  SUTTA_PREDICTION_COUNT,
  historicalCutoffISO,
} = require("../src/lib/prediction-contract.ts")

const ROOT = path.resolve(__dirname, "..")
const cache = JSON.parse(
  fs.readFileSync(path.join(ROOT, "scratch", "open-sutta-records-cache.json"), "utf8"),
)
const forward = JSON.parse(
  fs.readFileSync(path.join(ROOT, "research", "panel_top30_v2", "forward_records.json"), "utf8"),
).forward

function mergedRecords(market) {
  const byDate = new Map()
  for (const record of [...cache[market], ...(forward[market] || [])]) {
    const isoDate = getRecordISODate(record)
    if (isoDate && record.openPanel?.length === 3 && record.closePanel?.length === 3) {
      byDate.set(isoDate, record)
    }
  }
  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, record]) => record)
}

const allMarkets = Object.fromEntries(
  Object.keys(cache).map((market) => [market, mergedRecords(market)]),
)

if (PANEL_PREDICTION_COUNT !== 40) {
  throw new Error(`Expected PANEL_PREDICTION_COUNT=40, received ${PANEL_PREDICTION_COUNT}`)
}
if (SUTTA_PREDICTION_COUNT !== 6 || JODI_GRID_COUNT !== 36) {
  throw new Error("Expected the Top-6 / 6x6 36-Jodi production contract")
}
if (HISTORICAL_LOOKBACK_MONTHS !== 28) {
  throw new Error(`Expected 28 history months, received ${HISTORICAL_LOOKBACK_MONTHS}`)
}
for (const [anchor, expected] of [
  ["2026-08-01", "2024-04-01"],
  ["2026-06-30", "2024-02-29"],
  ["2026-03-31", "2023-11-30"],
]) {
  const actual = historicalCutoffISO(anchor)
  if (actual !== expected) throw new Error(`${anchor}: expected ${expected}, received ${actual}`)
}

for (const [market, records] of Object.entries(allMarkets)) {
  const latestDate = getRecordISODate(records.at(-1))
  const analysisDate = new Date(`${latestDate}T12:00:00Z`)
  analysisDate.setUTCDate(analysisDate.getUTCDate() + 1)
  const result = analyzeMarket(market, records, allMarkets, analysisDate)
  if (!result) throw new Error(`${market}: no analysis result`)
  for (const [side, picks] of [
    ["open", result.openPanelPicks],
    ["close", result.closePanelPicks],
  ]) {
    if (picks.length !== PANEL_PREDICTION_COUNT) {
      throw new Error(`${market} ${side}: expected 40 picks, received ${picks.length}`)
    }
    const unique = new Set(picks.map((pick) => pick.panel))
    if (unique.size !== picks.length) {
      throw new Error(`${market} ${side}: duplicate panels in ranked output`)
    }
  }
  console.log(`${market}: Open 40 / Close 40 verified`)
}

console.log("Top-40 panel contract verified for every configured market.")
