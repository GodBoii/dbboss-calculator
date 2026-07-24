/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Sutta & Jodi Backtest — 30-day and 90-day accuracy report.
 *
 * Scrapes live panel data from dpbossss.boston for all 12 tracked markets,
 * then replays the production predictor on each historical draw (using only
 * data available *before* that draw) and measures:
 *   - Open Sutta accuracy  (top-6 sutta set contains the actual open sutta)
 *   - Close Sutta accuracy (top-6 sutta set contains the actual close sutta)
 *   - Jodi accuracy        (6×6 = 36 jodi grid contains the actual jodi)
 *
 * Usage:  node scripts/sutta-jodi-backtest.cjs
 */

const ts = require('typescript')

require.extensions['.ts'] = function compileTypeScript(module, filename) {
  const fs = require('fs')
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
  module._compile(output, filename)
}

const { GET } = require('../src/app/api/scrape/route.ts')
const { getRecordISODate } = require('../src/lib/backtest.ts')
const { analyzeMarket, getSuttaSignal } = require('../src/lib/predictor.ts')

const MARKET_URLS = {
  Sridevi: 'https://dpbossss.boston/panel-chart-record/sridevi.php',
  'Time Bazar': 'https://dpbossss.boston/panel-chart-record/time-bazar.php',
  'Madhur Day': 'https://dpbossss.boston/panel-chart-record/madhur-day.php',
  'Milan Day': 'https://dpbossss.boston/panel-chart-record/milan-day.php',
  'Rajdhani Day': 'https://dpbossss.boston/panel-chart-record/rajdhani-day.php',
  Kalyan: 'https://dpbossss.boston/panel-chart-record/kalyan.php',
  'Sridevi Night': 'https://dpbossss.boston/panel-chart-record/sridevi-night.php',
  'Kalyan Night': 'https://dpbossss.boston/panel-chart-record/kalyan-night.php',
  'Madhur Night': 'https://dpbossss.boston/panel-chart-record/madhur-night.php',
  'Milan Night': 'https://dpbossss.boston/panel-chart-record/milan-night.php',
  'Rajdhani Night': 'https://dpbossss.boston/panel-chart-record/rajdhani-night.php',
  'Main Bazar': 'https://dpbossss.boston/panel-chart-record/main-bazar.php',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function pct(n, d) {
  return d === 0 ? '  N/A  ' : `${((n / d) * 100).toFixed(1)}%`
}

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item) => item.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

/** Extract top-N unique suttas from panel picks using production logic. */
function topSuttas(picks, droughts, count) {
  const bySutta = new Map()
  picks.forEach((pick, index) => {
    if (bySutta.has(pick.sutta)) return
    const signal = getSuttaSignal(droughts[String(pick.sutta)] ?? 1000)
    bySutta.set(pick.sutta, {
      sutta: pick.sutta,
      rank: index + 1,
      isFresh: signal.state === 'fresh',
    })
  })

  const ranked = Array.from(bySutta.values())
  const selected = ranked.filter((item) => item.isFresh)

  for (const item of ranked) {
    if (selected.length >= count) break
    if (!selected.some((s) => s.sutta === item.sutta)) {
      selected.push(item)
    }
  }

  return selected.slice(0, count).map((item) => item.sutta)
}

function buildJodis(openSuttas, closeSuttas) {
  return openSuttas.flatMap((open) => closeSuttas.map((close) => `${open}${close}`))
}

// ── Data fetching ───────────────────────────────────────────────────────────

async function fetchAll() {
  const all = {}
  const errors = []
  for (const [market, url] of Object.entries(MARKET_URLS)) {
    try {
      const request = {
        nextUrl: new URL(
          `http://local/api/scrape?url=${encodeURIComponent(url)}&market=${encodeURIComponent(market)}`
        ),
      }
      const response = await GET(request)
      const json = await response.json()
      if (!response.ok) {
        errors.push(`  ✗ ${market}: ${json.error}`)
        continue
      }
      all[market] = json.panels.map((panel) => ({
        id: `${panel.market}|${panel.dateRangeStart}|${panel.day}`,
        ...panel,
        savedAt: Date.now(),
      }))
      process.stdout.write(`  ✓ ${market} (${all[market].length} records)\n`)
    } catch (err) {
      errors.push(`  ✗ ${market}: ${err.message}`)
    }
  }
  if (errors.length > 0) {
    console.log('\nScrape errors:')
    errors.forEach((e) => console.log(e))
  }
  return all
}

// ── Core backtest ───────────────────────────────────────────────────────────

function emptyMetrics() {
  return {
    n: 0,
    open6: 0,
    close6: 0,
    jodi6: 0,
  }
}

function addMetrics(target, source) {
  for (const key of Object.keys(target)) {
    target[key] += source[key]
  }
}

function runBacktestForDays(allRecords, days) {
  const minTrainingRecords = 50
  const rows = []
  const totals = emptyMetrics()

  for (const [market, records] of Object.entries(allRecords)) {
    const marketDated = dated(records)
    if (marketDated.length <= minTrainingRecords) continue

    const endDate = marketDated[marketDated.length - 1].isoDate
    const startDateObj = new Date(`${endDate}T00:00:00Z`)
    startDateObj.setUTCDate(startDateObj.getUTCDate() - days + 1)
    const startDate = startDateObj.toISOString().slice(0, 10)
    const metrics = emptyMetrics()

    for (const { record, isoDate } of marketDated) {
      if (isoDate < startDate || isoDate > endDate) continue

      const prior = marketDated
        .filter((item) => item.isoDate < isoDate)
        .map((item) => item.record)
      if (prior.length < minTrainingRecords) continue

      const priorAllMarkets = {}
      for (const [marketName, marketRecords] of Object.entries(allRecords)) {
        priorAllMarkets[marketName] = dated(marketRecords)
          .filter((item) => item.isoDate < isoDate)
          .map((item) => item.record)
      }
      priorAllMarkets[market] = prior

      const prediction = analyzeMarket(
        market,
        prior,
        priorAllMarkets,
        new Date(`${isoDate}T12:00:00Z`)
      )
      if (!prediction) continue

      const open6 = topSuttas(prediction.openPicks, prediction.openSuttaDroughts, 6)
      const close6 = topSuttas(prediction.closePicks, prediction.closeSuttaDroughts, 6)
      const actualJodi = `${record.openSutta}${record.closeSutta}`

      metrics.n++
      if (open6.includes(record.openSutta)) metrics.open6++
      if (close6.includes(record.closeSutta)) metrics.close6++
      if (buildJodis(open6, close6).includes(actualJodi)) metrics.jodi6++
    }

    addMetrics(totals, metrics)
    rows.push({ market, startDate, endDate, ...metrics })
  }

  return { rows, totals }
}

// ── Pretty output ───────────────────────────────────────────────────────────

function pad(str, len) {
  return String(str).padEnd(len)
}
function rpad(str, len) {
  return String(str).padStart(len)
}

function printReport(title, { rows, totals }) {
  const header = `\n${'═'.repeat(80)}\n  ${title}\n${'═'.repeat(80)}`
  console.log(header)
  console.log('')
  console.log(
    `  ${pad('Market', 20)} ${rpad('Draws', 6)} ${rpad('Open Sutta', 12)} ${rpad('Close Sutta', 12)} ${rpad('Jodi', 12)}`
  )
  console.log(`  ${'─'.repeat(62)}`)

  for (const row of rows) {
    console.log(
      `  ${pad(row.market, 20)} ${rpad(row.n, 6)} ${rpad(pct(row.open6, row.n), 12)} ${rpad(pct(row.close6, row.n), 12)} ${rpad(pct(row.jodi6, row.n), 12)}`
    )
  }

  console.log(`  ${'─'.repeat(62)}`)
  console.log(
    `  ${pad('TOTAL', 20)} ${rpad(totals.n, 6)} ${rpad(pct(totals.open6, totals.n), 12)} ${rpad(pct(totals.close6, totals.n), 12)} ${rpad(pct(totals.jodi6, totals.n), 12)}`
  )

  // Random baseline: 6/10 = 60% for sutta, 36/100 = 36% for jodi
  console.log('')
  console.log('  Random baseline: Open/Close = 60.0% (6 of 10 digits), Jodi = 36.0% (36 of 100 pairs)')
  console.log('')
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗')
  console.log('║          SUTTA & JODI BACKTEST — Open / Close / Jodi               ║')
  console.log('║          Top-6 sutta set accuracy (production predictor)            ║')
  console.log('╚══════════════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('Scraping live panel data from dpbossss.boston...')

  const allRecords = await fetchAll()

  const marketCount = Object.keys(allRecords).length
  const totalRecords = Object.values(allRecords).reduce((sum, r) => sum + r.length, 0)
  console.log(`\nLoaded ${totalRecords} records across ${marketCount} markets.\n`)
  console.log('Running backtests...')

  // 30-day backtest
  const report30 = runBacktestForDays(allRecords, 30)
  printReport('LAST 30 DAYS — Top-6 Sutta & 36-Jodi Accuracy', report30)

  // 90-day backtest
  const report90 = runBacktestForDays(allRecords, 90)
  printReport('LAST 90 DAYS — Top-6 Sutta & 36-Jodi Accuracy', report90)

  // Summary comparison
  console.log('═'.repeat(80))
  console.log('  SUMMARY COMPARISON')
  console.log('═'.repeat(80))
  console.log('')
  console.log(
    `  ${pad('Period', 12)} ${rpad('Draws', 7)} ${rpad('Open Sutta', 12)} ${rpad('Close Sutta', 13)} ${rpad('Jodi', 12)}`
  )
  console.log(`  ${'─'.repeat(56)}`)
  console.log(
    `  ${pad('Last 30d', 12)} ${rpad(report30.totals.n, 7)} ${rpad(pct(report30.totals.open6, report30.totals.n), 12)} ${rpad(pct(report30.totals.close6, report30.totals.n), 13)} ${rpad(pct(report30.totals.jodi6, report30.totals.n), 12)}`
  )
  console.log(
    `  ${pad('Last 90d', 12)} ${rpad(report90.totals.n, 7)} ${rpad(pct(report90.totals.open6, report90.totals.n), 12)} ${rpad(pct(report90.totals.close6, report90.totals.n), 13)} ${rpad(pct(report90.totals.jodi6, report90.totals.n), 12)}`
  )
  console.log(
    `  ${pad('Random', 12)} ${rpad('—', 7)} ${rpad('60.0%', 12)} ${rpad('60.0%', 13)} ${rpad('36.0%', 12)}`
  )
  console.log('')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
