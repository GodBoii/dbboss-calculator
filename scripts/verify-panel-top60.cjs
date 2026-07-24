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

if (PANEL_PREDICTION_COUNT !== 60) {
  throw new Error(`Expected PANEL_PREDICTION_COUNT=60, received ${PANEL_PREDICTION_COUNT}`)
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
      throw new Error(`${market} ${side}: expected 60 picks, received ${picks.length}`)
    }
    const unique = new Set(picks.map((pick) => pick.panel))
    if (unique.size !== picks.length) {
      throw new Error(`${market} ${side}: duplicate panels in ranked output`)
    }
  }
  console.log(`${market}: Open 60 / Close 60 verified`)
}

console.log("Top-60 panel contract verified for every configured market.")
