// Fetch the same 28-month history the app uses (via the production /api/scrape
// route handler) for all 12 app markets and cache it to data.json.
require('./ts-loader.cjs')
const fs = require('fs')
const path = require('path')

const { GET } = require('../../src/app/api/scrape/route.ts')

const BASE = 'https://dpboss.tax/panel-chart-record/'
const MARKETS = {
  Sridevi: 'sridevi', 'Time Bazar': 'time-bazar', 'Madhur Day': 'madhur-day',
  'Milan Day': 'milan-day', 'Rajdhani Day': 'rajdhani-day', Kalyan: 'kalyan',
  'Sridevi Night': 'sridevi-night', 'Kalyan Night': 'kalyan-night',
  'Madhur Night': 'madhur-night', 'Milan Night': 'milan-night',
  'Rajdhani Night': 'rajdhani-night', 'Main Bazar': 'main-bazar',
}

async function fetchMarket(market, slug) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const url = `${BASE}${slug}.php`
    const request = {
      nextUrl: new URL(`http://local/api/scrape?url=${encodeURIComponent(url)}&market=${encodeURIComponent(market)}`),
    }
    const response = await GET(request)
    const json = await response.json()
    if (response.ok) {
      return json.panels.map((panel) => ({
        id: `${panel.market}|${panel.dateRangeStart}|${panel.day}`,
        ...panel,
        savedAt: 0,
      }))
    }
    console.warn(`${market} attempt ${attempt}: ${json.error}`)
  }
  throw new Error(`Failed to fetch ${market}`)
}

async function main() {
  const out = {}
  for (const [market, slug] of Object.entries(MARKETS)) {
    out[market] = await fetchMarket(market, slug)
    console.log(`${market}: ${out[market].length} draws`)
  }
  const file = path.join(__dirname, 'data.json')
  fs.writeFileSync(file, JSON.stringify({ fetchedAt: new Date().toISOString(), markets: out }))
  console.log(`Saved ${file}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
