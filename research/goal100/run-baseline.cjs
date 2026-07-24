/* eslint-disable no-console */

// Research-only exact replay of the frozen production model. This file may read
// production modules and the frozen cache, but it writes only below this folder.

const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const Module = require('module')
const path = require('path')
const ts = require('typescript')

const RESEARCH_DIR = __dirname
const ROOT = path.resolve(RESEARCH_DIR, '..', '..')
const ARTIFACT_DIR = path.join(RESEARCH_DIR, 'artifacts')
const MANIFEST_PATH = path.join(RESEARCH_DIR, 'manifest.json')
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))

function fail(message) {
  throw new Error(`Goal-100 baseline aborted: ${message}`)
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function parseArguments(argv) {
  const daysValue = argv.find((value) => value.startsWith('--days='))
  const labelValue = argv.find((value) => value.startsWith('--label='))
  const days = Number.parseInt(daysValue?.slice('--days='.length) || '30', 10)
  if (!Number.isInteger(days) || days < 1 || days > 5000) fail(`invalid --days value: ${daysValue}`)
  const label = (labelValue?.slice('--label='.length) || `last-${days}d`)
    .replace(/[^a-z0-9_-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!label) fail('empty output label')
  return { days, label }
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

function validateFrozenInputs() {
  childProcess.execFileSync(process.execPath, [path.join(RESEARCH_DIR, 'production-guard.cjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  })

  const configuredPath = manifest.baselineData.path.replace(/\//g, path.sep)
  const dataPath = path.resolve(ROOT, configuredPath)
  const relative = path.relative(ROOT, dataPath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail('baseline data path escapes the workspace')
  const bytes = fs.readFileSync(dataPath)
  const actual = { sha256: sha256(bytes), bytes: bytes.length }
  if (actual.sha256 !== manifest.baselineData.sha256 || actual.bytes !== manifest.baselineData.bytes) {
    fail(`frozen data changed; expected ${JSON.stringify(manifest.baselineData)}, got ${JSON.stringify(actual)}`)
  }
  const records = JSON.parse(bytes.toString('utf8'))
  const marketCount = Object.keys(records).length
  const rowCount = Object.values(records).reduce((sum, rows) => sum + rows.length, 0)
  if (marketCount !== manifest.baselineData.markets || rowCount !== manifest.baselineData.rows) {
    fail(`frozen data shape changed; got ${marketCount} markets and ${rowCount} rows`)
  }
  return { dataPath, records, dataSha256: actual.sha256 }
}

const MARKET_ORDER = [
  'Sridevi',
  'Time Bazar',
  'Madhur Day',
  'Milan Day',
  'Rajdhani Day',
  'Kalyan',
  'Sridevi Night',
  'Kalyan Night',
  'Madhur Night',
  'Milan Night',
  'Rajdhani Night',
  'Main Bazar',
]
const COUNTS = [3, 4, 6]
const TARGETS = ['open', 'close', 'jodi', 'adjustedClose']

function emptyMetric() {
  return { n: 0, hits: 0, accuracy: null, wilson95: null }
}

function emptyTargets() {
  return Object.fromEntries(TARGETS.map((target) => [target, emptyMetric()]))
}

function updateMetric(metric, hit) {
  metric.n += 1
  if (hit) metric.hits += 1
}

function finalizeMetric(metric) {
  if (!metric.n) return metric
  const z = 1.96
  const p = metric.hits / metric.n
  const denominator = 1 + (z * z) / metric.n
  const centre = p + (z * z) / (2 * metric.n)
  const spread = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * metric.n)) / metric.n)
  metric.accuracy = p
  metric.wilson95 = [(centre - spread) / denominator, (centre + spread) / denominator]
  return metric
}

function finalizeTargets(targets) {
  for (const metric of Object.values(targets)) finalizeMetric(metric)
  return targets
}

function startDate(newest, days) {
  const date = new Date(`${newest}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - days + 1)
  return date.toISOString().slice(0, 10)
}

async function main() {
  const args = parseArguments(process.argv.slice(2))
  const frozen = validateFrozenInputs()
  installTypeScriptLoader()

  const { SUTTA_MODEL_VERSION } = require(path.join(ROOT, 'src', 'lib', 'app-version.ts'))
  const {
    analyzeMarket,
    buildContextFromResult,
    computeJodiAnalysis,
  } = require(path.join(ROOT, 'src', 'lib', 'predictor.ts'))
  const { getRecordISODate } = require(path.join(ROOT, 'src', 'lib', 'backtest.ts'))
  const {
    buildCloseSuttaSet,
    buildJodis,
    buildOpenSuttaSet,
  } = require(path.join(ROOT, 'src', 'lib', 'sutta-model', 'production.ts'))

  function dated(records) {
    return records
      .map((record) => ({ record, isoDate: getRecordISODate(record) }))
      .filter((item) => item.isoDate)
      .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
  }

  const allDated = Object.fromEntries(
    MARKET_ORDER.map((market) => [market, dated(frozen.records[market] || [])]),
  )
  const totals = Object.fromEntries(COUNTS.map((count) => [count, emptyTargets()]))
  const byMarket = {}
  const dateRanges = {}
  const ledger = []

  for (const market of MARKET_ORDER) {
    const rows = allDated[market]
    if (!rows.length) fail(`no dated records for ${market}`)
    const newest = rows.at(-1).isoDate
    const oldestIncluded = startDate(newest, args.days)
    dateRanges[market] = [oldestIncluded, newest]
    byMarket[market] = Object.fromEntries(COUNTS.map((count) => [count, emptyTargets()]))

    for (let index = 0; index < rows.length; index += 1) {
      const { record, isoDate } = rows[index]
      if (isoDate < oldestIncluded || isoDate > newest) continue
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

      let top6Ledger = null
      for (const count of COUNTS) {
        const open = buildOpenSuttaSet(
          prediction.openPicks,
          prediction.openSuttaDroughts,
          prior,
          count,
          market,
          targetDate,
          frozen.records,
        )
        const close = buildCloseSuttaSet(
          prediction.closePicks,
          prediction.closeSuttaDroughts,
          prior,
          count,
          market,
          null,
          frozen.records,
          targetDate,
        )
        const adjustedClose = buildCloseSuttaSet(
          adjusted.adjustedClosePicks,
          prediction.closeSuttaDroughts,
          prior,
          count,
          market,
          record.openSutta,
          frozen.records,
          targetDate,
        )
        const jodis = buildJodis(open, close)
        const hits = {
          open: open.some((pick) => pick.sutta === record.openSutta),
          close: close.some((pick) => pick.sutta === record.closeSutta),
          jodi: jodis.includes(record.jodi),
          adjustedClose: adjustedClose.some((pick) => pick.sutta === record.closeSutta),
        }
        for (const target of TARGETS) {
          updateMetric(totals[count][target], hits[target])
          updateMetric(byMarket[market][count][target], hits[target])
        }
        if (count === 6) {
          top6Ledger = {
            market,
            isoDate,
            day: record.day,
            actual: {
              open: record.openSutta,
              close: record.closeSutta,
              jodi: record.jodi,
              openPanel: record.openPanel,
              closePanel: record.closePanel,
            },
            prediction: {
              open: open.map((pick) => pick.sutta),
              close: close.map((pick) => pick.sutta),
              jodi: jodis,
              adjustedClose: adjustedClose.map((pick) => pick.sutta),
            },
            hits,
            historyRows: prior.length,
          }
        }
      }
      ledger.push(top6Ledger)
    }
    console.error(`${market}: ${byMarket[market][6].open.n} eligible draws`)
  }

  for (const count of COUNTS) {
    finalizeTargets(totals[count])
    for (const market of MARKET_ORDER) finalizeTargets(byMarket[market][count])
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    researchObjective: manifest.objective,
    evaluationType: 'exact-production-replay-not-sealed-forward',
    caveats: [
      'This is a historical replay of the current frozen production implementation, not proof of future accuracy.',
      'Same-day cross-market inputs require a separate market-time causality audit before being admitted to leakage-safe research.',
      'Model selection or tuning against this window would make the window ineligible as a holdout.',
    ],
    modelVersion: SUTTA_MODEL_VERSION,
    predictionSetSizes: { open: 6, close: 6, jodi: 36, adjustedClose: 6 },
    randomCoverage: { open: 0.6, close: 0.6, jodi: 0.36, adjustedClose: 0.6 },
    requestedCalendarDaysPerMarket: args.days,
    sourceData: {
      path: path.relative(ROOT, frozen.dataPath).replace(/\\/g, '/'),
      sha256: frozen.dataSha256,
      rows: manifest.baselineData.rows,
      markets: manifest.baselineData.markets,
    },
    productionFingerprint: manifest.productionBoundary,
    dateRanges,
    totals,
    byMarket,
    ledger,
  }

  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  const outputPath = path.join(ARTIFACT_DIR, `baseline-${args.label}.json`)
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  // Detect an input mutation that occurred while the replay was running.
  const endingDataHash = sha256(fs.readFileSync(frozen.dataPath))
  if (endingDataHash !== frozen.dataSha256) {
    fs.rmSync(outputPath, { force: true })
    fail('source data changed while the baseline was running; partial report removed')
  }

  console.log(`\nExact production replay: last ${args.days} calendar days per market`)
  console.table(MARKET_ORDER.map((market) => ({
    market,
    draws: byMarket[market][6].open.n,
    open: `${byMarket[market][6].open.hits}/${byMarket[market][6].open.n} (${(byMarket[market][6].open.accuracy * 100).toFixed(1)}%)`,
    close: `${byMarket[market][6].close.hits}/${byMarket[market][6].close.n} (${(byMarket[market][6].close.accuracy * 100).toFixed(1)}%)`,
    jodi: `${byMarket[market][6].jodi.hits}/${byMarket[market][6].jodi.n} (${(byMarket[market][6].jodi.accuracy * 100).toFixed(1)}%)`,
    adjustedClose: `${byMarket[market][6].adjustedClose.hits}/${byMarket[market][6].adjustedClose.n} (${(byMarket[market][6].adjustedClose.accuracy * 100).toFixed(1)}%)`,
  })))
  console.table(TARGETS.map((target) => ({
    target,
    hits: totals[6][target].hits,
    draws: totals[6][target].n,
    accuracy: `${(totals[6][target].accuracy * 100).toFixed(1)}%`,
    wilson95: totals[6][target].wilson95.map((value) => `${(value * 100).toFixed(1)}%`).join(' - '),
  })))
  console.log(`Saved research artifact: ${outputPath}`)
}

main().catch((error) => {
  console.error(error.stack || error)
  process.exit(1)
})
