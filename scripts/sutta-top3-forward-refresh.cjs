/* eslint-disable no-console */

/**
 * Fetch a fresh, isolated research cache without overwriting the app or the
 * existing two-year research cache. The companion Python scorer treats rows
 * after 2026-07-12 as a new forward block for already-frozen formulas.
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const Module = require('module')
const ts = require('typescript')

const ROOT = path.resolve(__dirname, '..')
const OUTPUT = path.join(ROOT, 'scratch', 'sutta-top3-forward-cache-20260715.json')
const META = path.join(ROOT, 'scratch', 'sutta-top3-forward-cache-20260715-meta.json')

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

const { GET } = require('../src/app/api/scrape/route.ts')

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

async function main() {
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
      // Keep the isolated research cache byte-stable across identical fetches
      // so its SHA-256 identifies chart content rather than fetch time.
      savedAt: 0,
    }))
    console.log(`${market}: ${all[market].length}`)
  }
  const encoded = JSON.stringify(all)
  const sha256 = crypto.createHash('sha256').update(encoded).digest('hex')
  fs.writeFileSync(OUTPUT, encoded)
  fs.writeFileSync(META, JSON.stringify({
    fetchedAt: new Date().toISOString(),
    sha256,
    output: path.relative(ROOT, OUTPUT),
    markets: Object.fromEntries(Object.entries(all).map(([market, records]) => [market, records.length])),
  }, null, 2))
  console.log(`sha256 ${sha256}`)
  console.log(`Saved ${OUTPUT}`)
  console.log(`Saved ${META}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
