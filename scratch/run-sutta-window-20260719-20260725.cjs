/* eslint-disable no-console, @typescript-eslint/no-require-imports */

const fs = require('fs')
const Module = require('module')
const path = require('path')
const ts = require('typescript')

const ROOT = path.resolve(__dirname, '..')
const START_DATE = '2026-07-19'
const END_DATE = '2026-07-25'
const COUNTS = [6, 5, 3]
const OUTPUT = path.join(__dirname, 'sutta-window-20260719-20260725.json')
const RAJDHANI_DAY_SUPPLEMENT = [
  ['Monday', '136', '04', '680'],
  ['Tuesday', '118', '04', '400'],
  ['Wednesday', '390', '28', '170'],
  ['Thursday', '145', '03', '445'],
  ['Friday', '188', '74', '149'],
].map(([day, openPanel, jodi, closePanel]) => ({
  id: `Rajdhani Day|20/07/2026|${day}`,
  market: 'Rajdhani Day',
  dateRangeStart: '20/07/2026',
  dateRangeEnd: '25/07/2026',
  day,
  openPanel,
  openSutta: Number(jodi[0]),
  jodi,
  closePanel,
  closeSutta: Number(jodi[1]),
  savedAt: Date.now(),
}))

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

function installTypeScriptLoader() {
  const originalResolve = Module._resolveFilename
  Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
    if (request.startsWith('@/')) {
      return originalResolve.call(this, path.join(ROOT, 'src', request.slice(2)), parent, isMain, options)
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
}

function emptyMetric() {
  return { n: 0, openHits: 0, closeHits: 0, jodiHits: 0 }
}

function finalize(metric) {
  return {
    ...metric,
    openAccuracy: metric.n ? metric.openHits / metric.n : null,
    closeAccuracy: metric.n ? metric.closeHits / metric.n : null,
    jodiAccuracy: metric.n ? metric.jodiHits / metric.n : null,
  }
}

async function main() {
  installTypeScriptLoader()
  const { GET } = require(path.join(ROOT, 'src', 'app', 'api', 'scrape', 'route.ts'))
  const { getRecordISODate } = require(path.join(ROOT, 'src', 'lib', 'backtest.ts'))
  const { analyzeMarket } = require(path.join(ROOT, 'src', 'lib', 'predictor.ts'))
  const { buildOpenSuttaSet, buildCloseSuttaSet, buildJodis } = require(
    path.join(ROOT, 'src', 'lib', 'sutta-model', 'production.ts'),
  )
  const { SUTTA_MODEL_VERSION } = require(path.join(ROOT, 'src', 'lib', 'app-version.ts'))

  const recordsByMarket = {}
  for (const [market, url] of Object.entries(MARKET_URLS)) {
    const request = {
      nextUrl: new URL(`http://local/api/scrape?url=${encodeURIComponent(url)}&market=${encodeURIComponent(market)}`),
    }
    const response = await GET(request)
    const payload = await response.json()
    if (!response.ok) throw new Error(`${market}: ${payload.error}`)
    recordsByMarket[market] = payload.panels.map((panel) => ({
      id: `${panel.market}|${panel.dateRangeStart}|${panel.day}`,
      ...panel,
      savedAt: Date.now(),
    }))
    if (market === 'Rajdhani Day') {
      const existingIds = new Set(recordsByMarket[market].map((record) => record.id))
      recordsByMarket[market].push(
        ...RAJDHANI_DAY_SUPPLEMENT.filter((record) => !existingIds.has(record.id)),
      )
    }
    console.error(`${market}: ${recordsByMarket[market].length} rows`)
  }

  const dated = Object.fromEntries(Object.entries(recordsByMarket).map(([market, records]) => [
    market,
    records
      .map((record) => ({ record, isoDate: getRecordISODate(record) }))
      .filter((row) => row.isoDate)
      .sort((a, b) => a.isoDate.localeCompare(b.isoDate)),
  ]))

  const byMarket = {}
  const totals = Object.fromEntries(COUNTS.map((count) => [count, emptyMetric()]))
  const ledger = []

  for (const market of Object.keys(MARKET_URLS)) {
    byMarket[market] = Object.fromEntries(COUNTS.map((count) => [count, emptyMetric()]))
    const rows = dated[market]
    for (let index = 0; index < rows.length; index += 1) {
      const { record, isoDate } = rows[index]
      if (isoDate < START_DATE || isoDate > END_DATE) continue
      const prior = rows.slice(0, index).map((row) => row.record)
      if (prior.length < 50) continue

      const priorAll = {}
      for (const otherMarket of Object.keys(MARKET_URLS)) {
        priorAll[otherMarket] = dated[otherMarket]
          .filter((row) => row.isoDate < isoDate)
          .map((row) => row.record)
      }
      priorAll[market] = prior
      const targetDate = new Date(`${isoDate}T12:00:00`)
      const prediction = analyzeMarket(market, prior, priorAll, targetDate)
      if (!prediction) continue

      const result = { market, isoDate, actual: { open: record.openSutta, close: record.closeSutta, jodi: record.jodi }, sets: {} }
      for (const count of COUNTS) {
        const open = buildOpenSuttaSet(
          prediction.openPicks, prediction.openSuttaDroughts, prior, count,
          market, targetDate, recordsByMarket,
        )
        const close = buildCloseSuttaSet(
          prediction.closePicks, prediction.closeSuttaDroughts, prior, count,
          market, null, recordsByMarket, targetDate,
        )
        const jodis = buildJodis(open, close)
        const hits = {
          open: open.some((pick) => pick.sutta === record.openSutta),
          close: close.some((pick) => pick.sutta === record.closeSutta),
          jodi: jodis.includes(record.jodi),
        }
        for (const metric of [byMarket[market][count], totals[count]]) {
          metric.n += 1
          if (hits.open) metric.openHits += 1
          if (hits.close) metric.closeHits += 1
          if (hits.jodi) metric.jodiHits += 1
        }
        result.sets[count] = {
          open: open.map((pick) => pick.sutta),
          close: close.map((pick) => pick.sutta),
          jodiCount: jodis.length,
          hits,
        }
      }
      ledger.push(result)
    }
  }

  for (const market of Object.keys(byMarket)) {
    for (const count of COUNTS) byMarket[market][count] = finalize(byMarket[market][count])
  }
  for (const count of COUNTS) totals[count] = finalize(totals[count])

  const report = {
    generatedAt: new Date().toISOString(),
    modelVersion: SUTTA_MODEL_VERSION,
    requestedWindow: { start: START_DATE, end: END_DATE, timezone: 'Asia/Calcutta' },
    supplementalData: {
      market: 'Rajdhani Day',
      dates: ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24'],
      source: 'https://sattamatka.day/rajdhani-day-panel-chart.php',
      reason: 'Configured primary chart ended at 2026-07-18.',
    },
    dataMaxDateByMarket: Object.fromEntries(Object.entries(dated).map(([market, rows]) => [market, rows.at(-1)?.isoDate ?? null])),
    counts: COUNTS,
    byMarket,
    totals,
    ledger,
  }
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`)

  for (const count of COUNTS) {
    console.log(`\nTOP ${count} (${count * count} JODIS)`)
    console.table(Object.keys(MARKET_URLS).map((market) => {
      const row = byMarket[market][count]
      const cell = (hits, accuracy) => row.n ? `${hits}/${row.n} (${(accuracy * 100).toFixed(1)}%)` : 'N/A'
      return {
        market,
        draws: row.n,
        open: cell(row.openHits, row.openAccuracy),
        close: cell(row.closeHits, row.closeAccuracy),
        jodi: cell(row.jodiHits, row.jodiAccuracy),
      }
    }))
    console.log('TOTAL', totals[count])
  }
  console.log(`\nSaved ${OUTPUT}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
