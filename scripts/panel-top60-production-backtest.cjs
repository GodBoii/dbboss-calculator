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
const FORWARD = path.join(ROOT, "research", "panel_top30_v2", "forward_records.json")
const OUTPUT_DIR = path.join(ROOT, "backtest_reports", "2026-07-24")
const OUTPUT_JSON = path.join(OUTPUT_DIR, "top60-production-backtest.json")
const OUTPUT_REPORT = path.join(OUTPUT_DIR, "top60-production-backtest.md")
const WINDOWS = [30, 180]

function mergeRecords() {
  const cache = JSON.parse(fs.readFileSync(CACHE, "utf8"))
  const forward = JSON.parse(fs.readFileSync(FORWARD, "utf8")).forward
  const merged = {}
  for (const market of Object.keys(cache)) {
    const byDate = new Map()
    for (const record of [...cache[market], ...(forward[market] || [])]) {
      const isoDate = getRecordISODate(record)
      if (isoDate && record.openPanel?.length === 3 && record.closePanel?.length === 3) {
        byDate.set(isoDate, record)
      }
    }
    merged[market] = [...byDate.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, record]) => record)
  }
  return merged
}

function aggregate(reports, side, metric) {
  const n = reports.reduce((sum, report) => sum + report[side].n, 0)
  const hits = reports.reduce((sum, report) => sum + report[side][metric], 0)
  return { n, hits, rate: n ? hits / n : 0 }
}

function pct(value) {
  return `${(100 * value).toFixed(1)}%`
}

function main() {
  const records = mergeRecords()
  const windows = {}
  for (const days of WINDOWS) {
    console.log(`Running ${days}-day Top-60 production backtest`)
    const reports = []
    for (const [market, marketRecords] of Object.entries(records)) {
      const report = runMarketBacktest(
        market,
        marketRecords,
        records,
        { days, minTrainingRecords: 120 },
      )
      if (report) reports.push(report)
      console.log(`  ${market}: ${report?.drawsTested || 0} draws`)
    }
    windows[String(days)] = {
      reports,
      totals: Object.fromEntries(
        ["open", "close"].map((side) => [
          side,
          Object.fromEntries(
            ["panelTop3", "panelTop10", "panelTop30", "panelTop60"].map((metric) => [
              metric,
              aggregate(reports, side, metric),
            ]),
          ),
        ]),
      ),
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    data: {
      cache: path.relative(ROOT, CACHE),
      forward: path.relative(ROOT, FORWARD),
      markets: Object.fromEntries(
        Object.entries(records).map(([market, rows]) => [
          market,
          {
            rows: rows.length,
            first: getRecordISODate(rows[0]),
            last: getRecordISODate(rows.at(-1)),
          },
        ]),
      ),
    },
    randomCoverage: {
      top3: 3 / 220,
      top10: 10 / 220,
      top30: 30 / 220,
      top60: 60 / 220,
    },
    windows,
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`)

  const lines = [
    "# Production Top-60 panel backtest",
    "",
    `Generated: ${payload.generatedAt}`,
    "",
    "Every target draw is replayed using only records with an earlier date. The frozen cache "
      + "and post-cache forward records are merged without duplicate market-dates.",
    "",
    `Uniform Top-60 coverage reference: ${pct(payload.randomCoverage.top60)}.`,
  ]
  for (const days of WINDOWS) {
    const window = windows[String(days)]
    lines.push(
      "",
      `## Last ${days} calendar days`,
      "",
      "| Side | N | Top-3 | Top-10 | Top-30 | Top-60 |",
      "|---|---:|---:|---:|---:|---:|",
    )
    for (const side of ["open", "close"]) {
      const totals = window.totals[side]
      lines.push(
        `| ${side} | ${totals.panelTop60.n} | ${pct(totals.panelTop3.rate)} | `
          + `${pct(totals.panelTop10.rate)} | ${pct(totals.panelTop30.rate)} | `
          + `${pct(totals.panelTop60.rate)} |`,
      )
    }
    lines.push(
      "",
      "| Market | Open Top-60 | Close Top-60 |",
      "|---|---:|---:|",
    )
    for (const report of window.reports) {
      lines.push(
        `| ${report.market} | ${pct(report.open.panelTop60 / report.open.n)} | `
          + `${pct(report.close.panelTop60 / report.close.n)} |`,
      )
    }
  }
  lines.push(
    "",
    "## Interpretation",
    "",
    "Top-60 coverage is a set-hit metric, not a probability for any individual panel and not "
      + "evidence of profitability. A 60-panel ticket costs sixty individual stakes when each "
      + "panel is charged separately.",
  )
  fs.writeFileSync(OUTPUT_REPORT, `${lines.join("\n")}\n`)
  console.log(`Wrote ${OUTPUT_JSON}`)
  console.log(`Wrote ${OUTPUT_REPORT}`)
}

main()
