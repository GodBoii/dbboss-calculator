/* eslint-disable @typescript-eslint/no-require-imports */

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

function pct(n, d) {
  return d === 0 ? '0.0%' : `${((n / d) * 100).toFixed(1)}%`
}

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item) => item.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

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
    if (!selected.some((selectedItem) => selectedItem.sutta === item.sutta)) {
      selected.push(item)
    }
  }

  return selected.slice(0, count).map((item) => item.sutta)
}

function buildJodis(openSuttas, closeSuttas) {
  return openSuttas.flatMap((open) => closeSuttas.map((close) => `${open}${close}`))
}

async function fetchAll() {
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
  }
  return all
}

function emptyMetrics() {
  return {
    n: 0,
    open4: 0,
    close4: 0,
    jodi4: 0,
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

async function main() {
  const days = Number.parseInt(process.argv[2] || '30', 10)
  const minTrainingRecords = 50
  const allRecords = await fetchAll()
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

      const prior = marketDated.filter((item) => item.isoDate < isoDate).map((item) => item.record)
      if (prior.length < minTrainingRecords) continue

      const priorAllMarkets = {}
      for (const [marketName, marketRecords] of Object.entries(allRecords)) {
        priorAllMarkets[marketName] = dated(marketRecords)
          .filter((item) => item.isoDate < isoDate)
          .map((item) => item.record)
      }
      priorAllMarkets[market] = prior

      const prediction = analyzeMarket(market, prior, priorAllMarkets, new Date(`${isoDate}T12:00:00Z`))
      if (!prediction) continue

      const open4 = topSuttas(prediction.openPicks, prediction.openSuttaDroughts, 4)
      const close4 = topSuttas(prediction.closePicks, prediction.closeSuttaDroughts, 4)
      const open6 = topSuttas(prediction.openPicks, prediction.openSuttaDroughts, 6)
      const close6 = topSuttas(prediction.closePicks, prediction.closeSuttaDroughts, 6)
      const actualJodi = `${record.openSutta}${record.closeSutta}`

      metrics.n++
      if (open4.includes(record.openSutta)) metrics.open4++
      if (close4.includes(record.closeSutta)) metrics.close4++
      if (buildJodis(open4, close4).includes(actualJodi)) metrics.jodi4++
      if (open6.includes(record.openSutta)) metrics.open6++
      if (close6.includes(record.closeSutta)) metrics.close6++
      if (buildJodis(open6, close6).includes(actualJodi)) metrics.jodi6++
    }

    addMetrics(totals, metrics)
    rows.push({ market, startDate, endDate, ...metrics })
  }

  console.log(`BET COPY BACKTEST - last ${days} days from latest scraped result`)
  console.log('Market,Date Range,N,Open@4,Close@4,Jodi@4,Open@6,Close@6,Jodi@6')
  for (const row of rows) {
    console.log([
      row.market,
      `${row.startDate}..${row.endDate}`,
      row.n,
      pct(row.open4, row.n),
      pct(row.close4, row.n),
      pct(row.jodi4, row.n),
      pct(row.open6, row.n),
      pct(row.close6, row.n),
      pct(row.jodi6, row.n),
    ].join(','))
  }
  console.log([
    'TOTAL',
    '',
    totals.n,
    pct(totals.open4, totals.n),
    pct(totals.close4, totals.n),
    pct(totals.jodi4, totals.n),
    pct(totals.open6, totals.n),
    pct(totals.close6, totals.n),
    pct(totals.jodi6, totals.n),
  ].join(','))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
