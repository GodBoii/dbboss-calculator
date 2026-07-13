/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const Module = require('module')
const ts = require('typescript')

const originalResolve = Module._resolveFilename
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolve.call(this, path.join(process.cwd(), 'src', request.slice(2)), parent, isMain, options)
  }
  return originalResolve.call(this, request, parent, isMain, options)
}

for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = function registerTypeScript(module, filename) {
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
}

const { GET } = require('../src/app/api/scrape/route.ts')
const { SUTTA_MODEL_VERSION } = require('../src/lib/app-version.ts')
const {
  analyzeMarket,
  buildContextFromResult,
  computeJodiAnalysis,
} = require('../src/lib/predictor.ts')
const { getRecordISODate } = require('../src/lib/backtest.ts')
const {
  buildCloseSuttaSet,
  buildJodis,
  buildOpenSuttaSet,
} = require('../src/lib/sutta-model/production.ts')

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

const MARKET_ORDER = Object.keys(MARKET_URLS)
const CACHE = path.join(process.cwd(), 'scratch', 'sutta-research-records.json')
const COUNTS = [4, 6]
const TARGETS = ['open', 'close', 'jodi', 'adjustedClose']

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item) => item.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

async function fetchAll(refresh) {
  if (!refresh && fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  const all = {}
  for (const [market, url] of Object.entries(MARKET_URLS)) {
    const request = {
      nextUrl: new URL(`http://local/api/scrape?url=${encodeURIComponent(url)}&market=${encodeURIComponent(market)}`),
    }
    const response = await GET(request)
    const json = await response.json()
    if (!response.ok) throw new Error(`${market}: ${json.error}`)
    all[market] = json.panels.map((panel) => ({
      id: `${panel.market}|${panel.dateRangeStart}|${panel.day}`,
      ...panel,
      savedAt: Date.now(),
    }))
    console.error(`Fetched ${market}: ${all[market].length}`)
  }
  fs.writeFileSync(CACHE, JSON.stringify(all))
  return all
}

function emptyMetric() {
  return { n: 0, hit: 0 }
}

function emptyTargets() {
  return Object.fromEntries(TARGETS.map((target) => [target, emptyMetric()]))
}

function pct(metric) {
  return metric.n ? (metric.hit / metric.n) * 100 : 0
}

function wilson(metric) {
  if (!metric.n) return [0, 0]
  const z = 1.96
  const p = metric.hit / metric.n
  const denominator = 1 + (z * z) / metric.n
  const centre = p + (z * z) / (2 * metric.n)
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * metric.n)) / metric.n)
  return [((centre - spread) / denominator) * 100, ((centre + spread) / denominator) * 100]
}

function add(metric, hit) {
  metric.n++
  if (hit) metric.hit++
}

async function main() {
  const days = Number.parseInt(process.argv.find((value) => /^\d+$/.test(value)) || '30', 10)
  const refresh = process.argv.includes('--refresh')
  const includeLedger = process.argv.includes('--ledger')
  const labelArg = process.argv.find((value) => value.startsWith('--label='))
  const label = labelArg ? `-${labelArg.slice('--label='.length).replace(/[^a-z0-9_-]/gi, '')}` : ''
  const allRecords = await fetchAll(refresh)
  const allDated = Object.fromEntries(
    Object.entries(allRecords).map(([market, records]) => [market, dated(records)]),
  )
  const totals = Object.fromEntries(COUNTS.map((count) => [count, emptyTargets()]))
  const byMarket = {}
  const dateRanges = {}
  const ledger = []

  for (const market of MARKET_ORDER) {
    const rows = allDated[market]
    const newest = rows.at(-1).isoDate
    const start = new Date(`${newest}T00:00:00Z`)
    start.setUTCDate(start.getUTCDate() - days + 1)
    const startISO = start.toISOString().slice(0, 10)
    dateRanges[market] = [startISO, newest]
    byMarket[market] = Object.fromEntries(COUNTS.map((count) => [count, emptyTargets()]))

    for (let index = 0; index < rows.length; index++) {
      const { record, isoDate } = rows[index]
      if (isoDate < startISO || isoDate > newest) continue
      const prior = rows.slice(0, index).filter((item) => item.isoDate < isoDate).map((item) => item.record)
      if (prior.length < 50) continue
      const priorAll = {}
      for (const otherMarket of MARKET_ORDER) {
        priorAll[otherMarket] = allDated[otherMarket]
          .filter((item) => item.isoDate < isoDate)
          .map((item) => item.record)
      }
      priorAll[market] = prior
      const targetDate = new Date(`${isoDate}T12:00:00`)
      const prediction = analyzeMarket(market, prior, priorAll, targetDate)
      if (!prediction) continue
      const adjusted = computeJodiAnalysis(
        record.openSutta,
        record.openPanel || null,
        prior,
        buildContextFromResult(prediction),
        prediction.closeDpKindContext,
      )

      for (const count of COUNTS) {
        const open = buildOpenSuttaSet(
          prediction.openPicks,
          prediction.openSuttaDroughts,
          prior,
          count,
          market,
          targetDate,
          allRecords,
        )
        const close = buildCloseSuttaSet(
          prediction.closePicks,
          prediction.closeSuttaDroughts,
          prior,
          count,
          market,
          null,
          allRecords,
          targetDate,
        )
        const adjustedClose = buildCloseSuttaSet(
          adjusted.adjustedClosePicks,
          prediction.closeSuttaDroughts,
          prior,
          count,
          market,
          record.openSutta,
          allRecords,
          targetDate,
        )
        const results = {
          open: open.some((pick) => pick.sutta === record.openSutta),
          close: close.some((pick) => pick.sutta === record.closeSutta),
          jodi: buildJodis(open, close).includes(record.jodi),
          adjustedClose: adjustedClose.some((pick) => pick.sutta === record.closeSutta),
        }
        if (includeLedger && count === 6) {
          ledger.push({
            market,
            isoDate,
            day: record.day,
            openPanel: record.openPanel,
            closePanel: record.closePanel,
            actualOpen: record.openSutta,
            actualClose: record.closeSutta,
            openRanking: open.map((pick) => pick.sutta),
            closeRanking: close.map((pick) => pick.sutta),
          })
        }
        for (const target of TARGETS) {
          add(totals[count][target], results[target])
          add(byMarket[market][count][target], results[target])
        }
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    modelVersion: SUTTA_MODEL_VERSION,
    days,
    sourceCache: CACHE,
    sourceCacheSha256: crypto.createHash('sha256').update(fs.readFileSync(CACHE)).digest('hex'),
    dateRanges,
    totals,
    byMarket,
    ...(includeLedger ? { ledger } : {}),
  }
  const outputPath = path.join(process.cwd(), 'scratch', `sutta-baseline-${days}d${label}.json`)
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2))

  console.log(`Exact production baseline: last ${days} calendar days per market`)
  for (const count of COUNTS) {
    console.log(`\nTop-${count}`)
    console.table(TARGETS.map((target) => {
      const metric = totals[count][target]
      const [low, high] = wilson(metric)
      return { target, n: metric.n, hits: metric.hit, accuracy: pct(metric).toFixed(1), ci95: `${low.toFixed(1)}-${high.toFixed(1)}` }
    }))
  }
  console.log('\nTop-4 by market')
  console.table(MARKET_ORDER.map((market) => ({
    market,
    range: dateRanges[market].join('..'),
    n: byMarket[market][4].open.n,
    open: pct(byMarket[market][4].open).toFixed(1),
    close: pct(byMarket[market][4].close).toFixed(1),
    jodi: pct(byMarket[market][4].jodi).toFixed(1),
    adjustedClose: pct(byMarket[market][4].adjustedClose).toFixed(1),
  })))
  console.log(`\nSaved ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
