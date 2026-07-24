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
  getRecordISODate,
  runMarketBacktest,
} = require("../src/lib/backtest.ts")

const ROOT = path.resolve(__dirname, "..")
const CACHE = path.join(ROOT, "scratch", "open-sutta-records-cache.json")
const PRIMARY = path.join(ROOT, "research", "panel_top30_v2", "forward_records.json")
const INDEPENDENT = path.join(
  ROOT,
  "research",
  "panel_top60_prospective_v2",
  "independent_forward_records.json",
)
const OUTPUT_DIR = path.join(ROOT, "backtest_reports", "2026-07-24")
const OUTPUT_JSON = path.join(OUTPUT_DIR, "top60-independent-production-score.json")
const OUTPUT_REPORT = path.join(OUTPUT_DIR, "top60-independent-production-score.md")
const DAY_INDEX = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

function formatDate(date) {
  const day = String(date.getUTCDate()).padStart(2, "0")
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${day}/${month}/${date.getUTCFullYear()}`
}

function toPanelRecord(record) {
  const target = new Date(`${record.isoDate}T00:00:00Z`)
  const weekStart = new Date(target)
  weekStart.setUTCDate(weekStart.getUTCDate() - DAY_INDEX[record.day])
  return {
    id: `independent|${record.market}|${record.isoDate}`,
    market: record.market,
    dateRangeStart: formatDate(weekStart),
    dateRangeEnd: formatDate(new Date(weekStart.getTime() + 6 * 86400000)),
    day: record.day,
    openPanel: record.openPanel,
    openSutta: record.openSutta,
    jodi: record.jodi,
    closePanel: record.closePanel,
    closeSutta: record.closeSutta,
  }
}

function mergeRecords() {
  const cache = JSON.parse(fs.readFileSync(CACHE, "utf8"))
  const primary = JSON.parse(fs.readFileSync(PRIMARY, "utf8")).forward
  const independentPayload = JSON.parse(fs.readFileSync(INDEPENDENT, "utf8"))
  const independent = independentPayload.forward
  const merged = {}
  const admittedMarkets = []
  for (const market of Object.keys(cache)) {
    const independentRows = (independent[market] || []).map(toPanelRecord)
    if (independentRows.length) admittedMarkets.push(market)
    const byDate = new Map()
    for (const record of [
      ...cache[market],
      ...(primary[market] || []),
      ...independentRows,
    ]) {
      const isoDate = getRecordISODate(record)
      if (isoDate && record.openPanel?.length === 3 && record.closePanel?.length === 3) {
        byDate.set(isoDate, record)
      }
    }
    merged[market] = [...byDate.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, record]) => record)
  }
  return { merged, admittedMarkets, independentPayload }
}

function aggregate(reports, side) {
  const n = reports.reduce((sum, report) => sum + report[side].n, 0)
  const hits = reports.reduce((sum, report) => sum + report[side].panelTop60, 0)
  return { n, hits, rate: n ? hits / n : 0 }
}

function pct(value) {
  return `${(100 * value).toFixed(1)}%`
}

function main() {
  const { merged, admittedMarkets, independentPayload } = mergeRecords()
  const reports = []
  for (const market of admittedMarkets) {
    const report = runMarketBacktest(
      market,
      merged[market],
      merged,
      { days: 4, minTrainingRecords: 120 },
    )
    if (!report) throw new Error(`No backtest report for ${market}`)
    if (report.startDate !== "2026-07-20" || report.endDate !== "2026-07-23") {
      throw new Error(`${market}: unexpected window ${report.startDate}..${report.endDate}`)
    }
    if (report.drawsTested !== 4) {
      throw new Error(`${market}: expected 4 draws, got ${report.drawsTested}`)
    }
    reports.push(report)
    console.log(
      `${market}: Open ${report.open.panelTop60}/4; Close ${report.close.panelTop60}/4`,
    )
  }

  const totals = {
    open: aggregate(reports, "open"),
    close: aggregate(reports, "close"),
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    design: {
      windowStart: "2026-07-20",
      windowEnd: "2026-07-23",
      independentlySourcedRows: totals.open.n,
      markets: admittedMarkets,
      excludedMarket: "Rajdhani Day",
      causalReplay: "Each target uses only records with an earlier ISO date.",
    },
    source: independentPayload.source,
    identityAudit: independentPayload.audit,
    totals,
    reports,
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`)

  const lines = [
    "# Production Top-60 score on independent prospective rows",
    "",
    `Generated: ${payload.generatedAt}`,
    "",
    "This replays the actual production predictor on the 44 independently sourced, "
      + "identity-validated rows dated 2026-07-20 through 2026-07-23. Rajdhani Day is "
      + "excluded because no matching independent series was found.",
    "",
    "| Side | N | Hits | Top-60 rate |",
    "|---|---:|---:|---:|",
    `| Open | ${totals.open.n} | ${totals.open.hits} | ${pct(totals.open.rate)} |`,
    `| Close | ${totals.close.n} | ${totals.close.hits} | ${pct(totals.close.rate)} |`,
    "",
    "| Market | Open | Close |",
    "|---|---:|---:|",
  ]
  for (const report of reports) {
    lines.push(
      `| ${report.market} | ${report.open.panelTop60}/4 | ${report.close.panelTop60}/4 |`,
    )
  }
  lines.push(
    "",
    "These 44 rows extend the prospective evidence but do not meet the 100-row "
      + "promotion minimum. They are not used to retune production.",
  )
  fs.writeFileSync(OUTPUT_REPORT, `${lines.join("\n")}\n`)
  console.log(`Wrote ${OUTPUT_JSON}`)
  console.log(`Wrote ${OUTPUT_REPORT}`)
}

main()
