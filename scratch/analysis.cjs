const ts = require('typescript')
const fs = require('fs')

require.extensions['.ts'] = function registerTs(module, filename) {
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
const { runMarketBacktest, getRecordISODate } = require('../src/lib/backtest.ts')
const { analyzeMarket, buildContextFromResult, computeJodiAnalysis, getPanelKind } = require('../src/lib/predictor.ts')

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

async function fetchAll() {
  const all = {}
  for (const [market, url] of Object.entries(MARKET_URLS)) {
    console.log(`Fetching ${market}...`)
    const request = { nextUrl: new URL(`http://local/api/scrape?url=${encodeURIComponent(url)}&market=${encodeURIComponent(market)}`) }
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

function filterLast2Years(allRecords) {
  const filtered = {}
  let totalCount = 0
  for (const [market, records] of Object.entries(allRecords)) {
    filtered[market] = records.filter(r => {
      const iso = getRecordISODate(r)
      return iso && iso >= '2024-07-01'
    })
    totalCount += filtered[market].length
  }
  console.log(`Filtered to ${totalCount} records >= 2024-07-01`)
  return filtered
}

async function main() {
  console.log('Starting Analysis')
  const allRecords = await fetchAll()
  const records2Years = filterLast2Years(allRecords)
  
  // Dump a JSON copy in scratch for faster iteration during analysis scripts
  fs.writeFileSync('scratch/records_2years.json', JSON.stringify(records2Years))
  console.log('Saved cached records to scratch/records_2years.json')
  console.log('Data Preparation Complete')
}

main().catch(console.error)
