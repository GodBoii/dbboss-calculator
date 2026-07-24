/* eslint-disable no-console */

// Compare the exact historical production replay with an event-time-censored
// replay. This is research-only and writes exclusively below research/goal100.

const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const Module = require('module')
const os = require('os')
const path = require('path')
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads')
const ts = require('typescript')

const RESEARCH_DIR = __dirname
const ROOT = path.resolve(RESEARCH_DIR, '..', '..')
const ARTIFACT_DIR = path.join(RESEARCH_DIR, 'artifacts')
const manifest = JSON.parse(fs.readFileSync(path.join(RESEARCH_DIR, 'manifest.json'), 'utf8'))
const DATA_PATH = path.resolve(ROOT, manifest.baselineData.path)

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

const OPEN_MINUTE = {
  Sridevi: 695,
  'Time Bazar': 790,
  'Madhur Day': 810,
  'Rajdhani Day': 905,
  'Milan Day': 910,
  Kalyan: 945,
  'Sridevi Night': 1155,
  'Madhur Night': 1230,
  'Milan Night': 1265,
  'Rajdhani Night': 1295,
  'Kalyan Night': 1305,
  'Main Bazar': 1320,
}

const CLOSE_MINUTE = {
  Sridevi: 755,
  'Time Bazar': 850,
  'Madhur Day': 870,
  'Rajdhani Day': 1025,
  'Milan Day': 1030,
  Kalyan: 1065,
  'Sridevi Night': 1215,
  'Madhur Night': 1350,
  'Milan Night': 1385,
  'Rajdhani Night': 1415,
  'Kalyan Night': 1425,
  'Main Bazar': 1450,
}

const EMBARGO_MINUTES = 10
const TARGET_FREEZE_LEAD_MINUTES = 1
const TARGETS = ['open', 'close', 'jodi']
const BLOCKS = {
  development: ['2024-09-23', '2025-07-13'],
  validation: ['2025-07-14', '2025-11-12'],
  holdout: ['2025-11-13', '2026-03-14'],
  recentFrozen: ['2026-03-15', '2026-07-12'],
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
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

function blockForDate(isoDate) {
  for (const [name, [start, end]] of Object.entries(BLOCKS)) {
    if (isoDate >= start && isoDate <= end) return name
  }
  return null
}

function emptyPair() {
  return {
    n: 0,
    exactHits: 0,
    causalHits: 0,
    bothHit: 0,
    exactOnly: 0,
    causalOnly: 0,
    bothMiss: 0,
    changedRanking: 0,
  }
}

function emptyMetrics() {
  return Object.fromEntries(TARGETS.map((target) => [target, emptyPair()]))
}

function updatePair(metric, exactHit, causalHit, changed) {
  metric.n += 1
  if (exactHit) metric.exactHits += 1
  if (causalHit) metric.causalHits += 1
  if (exactHit && causalHit) metric.bothHit += 1
  else if (exactHit) metric.exactOnly += 1
  else if (causalHit) metric.causalOnly += 1
  else metric.bothMiss += 1
  if (changed) metric.changedRanking += 1
}

function addPair(target, source) {
  for (const key of Object.keys(target)) target[key] += source[key]
}

function binomialCoefficient(n, k) {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let index = 1; index <= Math.min(k, n - k); index += 1) {
    result *= (n - index + 1) / index
  }
  return result
}

function exactTwoSidedSignP(a, b) {
  const n = a + b
  if (!n) return 1
  const observed = Math.min(a, b)
  let lower = 0
  for (let index = 0; index <= observed; index += 1) {
    lower += binomialCoefficient(n, index) * (0.5 ** n)
  }
  return Math.min(1, 2 * lower)
}

function finalizePair(metric) {
  return {
    ...metric,
    exactAccuracy: metric.n ? metric.exactHits / metric.n : null,
    causalAccuracy: metric.n ? metric.causalHits / metric.n : null,
    causalMinusExactHits: metric.causalHits - metric.exactHits,
    causalMinusExactPctPoints: metric.n ? ((metric.causalHits - metric.exactHits) / metric.n) * 100 : null,
    pairedSignP: exactTwoSidedSignP(metric.exactOnly, metric.causalOnly),
  }
}

function upperBoundBefore(rows, isoDate) {
  let low = 0
  let high = rows.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (rows[middle].isoDate < isoDate) low = middle + 1
    else high = middle
  }
  return low
}

function sameDateRow(rows, isoDate) {
  const index = upperBoundBefore(rows, isoDate)
  return rows[index]?.isoDate === isoDate ? rows[index].record : null
}

function partialRecord(record, includeClose) {
  if (includeClose) return record
  return {
    ...record,
    jodi: '',
    closePanel: '',
    closeSutta: -1,
  }
}

function availabilityProfile(targetMarket) {
  const freezeMinute = OPEN_MINUTE[targetMarket] - TARGET_FREEZE_LEAD_MINUTES
  return Object.fromEntries(MARKET_ORDER.map((sourceMarket) => {
    const openAvailable = OPEN_MINUTE[sourceMarket] + EMBARGO_MINUTES <= freezeMinute
    const closeAvailable = CLOSE_MINUTE[sourceMarket] + EMBARGO_MINUTES <= freezeMinute
    return [sourceMarket, {
      open: openAvailable,
      close: closeAvailable,
      openMinuteIst: OPEN_MINUTE[sourceMarket],
      closeMinuteIst: CLOSE_MINUTE[sourceMarket],
    }]
  }))
}

function causalRecordsForTarget(allDated, targetMarket, isoDate) {
  const profile = availabilityProfile(targetMarket)
  return Object.fromEntries(MARKET_ORDER.map((sourceMarket) => {
    const sourceRows = allDated[sourceMarket]
    const before = sourceRows.slice(0, upperBoundBefore(sourceRows, isoDate)).map((item) => item.record)
    const sameDay = sameDateRow(sourceRows, isoDate)
    if (!sameDay || !profile[sourceMarket].open) return [sourceMarket, before]
    return [sourceMarket, [...before, partialRecord(sameDay, profile[sourceMarket].close)]]
  }))
}

function validateData() {
  const bytes = fs.readFileSync(DATA_PATH)
  const actualHash = sha256(bytes)
  if (actualHash !== manifest.baselineData.sha256) {
    throw new Error(`frozen cache hash mismatch: expected ${manifest.baselineData.sha256}, got ${actualHash}`)
  }
  return JSON.parse(bytes.toString('utf8'))
}

function evaluateMarket(market) {
  installTypeScriptLoader()
  const raw = validateData()
  const { analyzeMarket } = require(path.join(ROOT, 'src', 'lib', 'predictor.ts'))
  const { getRecordISODate } = require(path.join(ROOT, 'src', 'lib', 'backtest.ts'))
  const {
    buildCloseSuttaSet,
    buildJodis,
    buildOpenSuttaSet,
  } = require(path.join(ROOT, 'src', 'lib', 'sutta-model', 'production.ts'))

  const dated = (records) => records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item) => item.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
  const allDated = Object.fromEntries(MARKET_ORDER.map((name) => [name, dated(raw[name] || [])]))
  const rows = allDated[market]
  const metrics = Object.fromEntries(Object.keys(BLOCKS).map((block) => [block, emptyMetrics()]))
  metrics.overall = emptyMetrics()
  const ledger = []

  for (let index = 0; index < rows.length; index += 1) {
    const { record, isoDate } = rows[index]
    const block = blockForDate(isoDate)
    if (!block) continue
    const priorEnd = upperBoundBefore(rows, isoDate)
    const prior = rows.slice(0, priorEnd).map((item) => item.record)
    if (prior.length < 50) continue
    const priorAll = Object.fromEntries(MARKET_ORDER.map((sourceMarket) => {
      const sourceRows = allDated[sourceMarket]
      return [sourceMarket, sourceRows.slice(0, upperBoundBefore(sourceRows, isoDate)).map((item) => item.record)]
    }))
    priorAll[market] = prior
    const targetDate = new Date(`${isoDate}T12:00:00`)
    const prediction = analyzeMarket(market, prior, priorAll, targetDate)
    if (!prediction) continue

    const exactOpen = buildOpenSuttaSet(
      prediction.openPicks, prediction.openSuttaDroughts, prior, 6,
      market, targetDate, raw,
    ).map((pick) => pick.sutta)
    const exactClose = buildCloseSuttaSet(
      prediction.closePicks, prediction.closeSuttaDroughts, prior, 6,
      market, null, raw, targetDate,
    ).map((pick) => pick.sutta)
    const causalRecords = causalRecordsForTarget(allDated, market, isoDate)
    const causalOpenPicks = buildOpenSuttaSet(
      prediction.openPicks, prediction.openSuttaDroughts, prior, 6,
      market, targetDate, causalRecords,
    )
    const causalClosePicks = buildCloseSuttaSet(
      prediction.closePicks, prediction.closeSuttaDroughts, prior, 6,
      market, null, causalRecords, targetDate,
    )
    const causalOpen = causalOpenPicks.map((pick) => pick.sutta)
    const causalClose = causalClosePicks.map((pick) => pick.sutta)
    const exactJodi = buildJodis(
      exactOpen.map((sutta, rank) => ({ sutta, rank, score: 0, probabilityPct: 0 })),
      exactClose.map((sutta, rank) => ({ sutta, rank, score: 0, probabilityPct: 0 })),
    )
    const causalJodi = buildJodis(causalOpenPicks, causalClosePicks)
    const actualJodi = `${record.openSutta}${record.closeSutta}`
    const hits = {
      exact: {
        open: exactOpen.includes(record.openSutta),
        close: exactClose.includes(record.closeSutta),
        jodi: exactJodi.includes(actualJodi),
      },
      causal: {
        open: causalOpen.includes(record.openSutta),
        close: causalClose.includes(record.closeSutta),
        jodi: causalJodi.includes(actualJodi),
      },
    }
    const changed = {
      open: JSON.stringify(exactOpen) !== JSON.stringify(causalOpen),
      close: JSON.stringify(exactClose) !== JSON.stringify(causalClose),
      jodi: JSON.stringify(exactJodi) !== JSON.stringify(causalJodi),
    }
    for (const target of TARGETS) {
      updatePair(metrics[block][target], hits.exact[target], hits.causal[target], changed[target])
      updatePair(metrics.overall[target], hits.exact[target], hits.causal[target], changed[target])
    }
    ledger.push({
      market,
      isoDate,
      block,
      actual: { open: record.openSutta, close: record.closeSutta, jodi: actualJodi },
      exact: { open: exactOpen, close: exactClose, jodi: exactJodi, hits: hits.exact },
      causal: { open: causalOpen, close: causalClose, jodi: causalJodi, hits: hits.causal },
      changed,
      historyRows: prior.length,
    })
  }

  return { market, metrics, ledger, availabilityProfile: availabilityProfile(market) }
}

function runWorker(market) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { market } })
    worker.once('message', (message) => {
      if (message.error) reject(new Error(message.error))
      else resolve(message.result)
    })
    worker.once('error', reject)
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`${market} worker exited with code ${code}`))
    })
  })
}

async function runPool(markets, concurrency) {
  const results = []
  let nextIndex = 0
  async function consume() {
    while (nextIndex < markets.length) {
      const index = nextIndex
      nextIndex += 1
      const market = markets[index]
      const started = Date.now()
      const result = await runWorker(market)
      results[index] = result
      console.error(`${market}: ${result.ledger.length} rows in ${((Date.now() - started) / 1000).toFixed(1)}s`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, markets.length) }, consume))
  return results
}

function mergeResults(results) {
  const aggregate = Object.fromEntries([...Object.keys(BLOCKS), 'overall'].map((block) => [block, emptyMetrics()]))
  for (const result of results) {
    for (const block of Object.keys(aggregate)) {
      for (const target of TARGETS) addPair(aggregate[block][target], result.metrics[block][target])
    }
  }
  const finalizeMetrics = (metrics) => Object.fromEntries(
    Object.entries(metrics).map(([target, metric]) => [target, finalizePair(metric)]),
  )
  return {
    aggregate: Object.fromEntries(Object.entries(aggregate).map(([block, metrics]) => [block, finalizeMetrics(metrics)])),
    byMarket: Object.fromEntries(results.map((result) => [
      result.market,
      Object.fromEntries(Object.entries(result.metrics).map(([block, metrics]) => [block, finalizeMetrics(metrics)])),
    ])),
  }
}

async function main() {
  childProcess.execFileSync(process.execPath, [path.join(RESEARCH_DIR, 'production-guard.cjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  const dataHashBefore = sha256(fs.readFileSync(DATA_PATH))
  const marketArg = process.argv.find((value) => value.startsWith('--market='))
  const workersArg = process.argv.find((value) => value.startsWith('--workers='))
  const labelArg = process.argv.find((value) => value.startsWith('--label='))
  const markets = marketArg ? [marketArg.slice('--market='.length)] : MARKET_ORDER
  for (const market of markets) if (!MARKET_ORDER.includes(market)) throw new Error(`unknown market ${market}`)
  const concurrency = Math.max(1, Math.min(
    Number.parseInt(workersArg?.slice('--workers='.length) || String(Math.min(4, os.cpus().length)), 10),
    markets.length,
  ))
  const label = (labelArg?.slice('--label='.length) || (marketArg ? markets[0] : 'all-blocks'))
    .replace(/[^a-z0-9_-]/gi, '-')
  const startedAt = new Date().toISOString()
  const results = await runPool(markets, concurrency)
  const merged = mergeResults(results)
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    startedAt,
    evaluationType: 'retrospective-nominal-schedule-causal-audit-not-sealed-forward',
    objective: manifest.objective,
    dataSha256: dataHashBefore,
    productionFingerprint: manifest.productionBoundary.digest,
    markets,
    schedule: { timezone: 'Asia/Kolkata', openMinute: OPEN_MINUTE, closeMinute: CLOSE_MINUTE },
    timingPolicy: {
      targetFreezeLeadMinutes: TARGET_FREEZE_LEAD_MINUTES,
      sourcePublicationEmbargoMinutes: EMBARGO_MINUTES,
      rule: 'source publication minute + embargo <= target Open minute - freeze lead',
      limitation: 'Nominal schedule times are used because historical observed publication timestamps are unavailable.',
    },
    blocks: BLOCKS,
    metrics: merged,
    availabilityProfiles: Object.fromEntries(results.map((result) => [result.market, result.availabilityProfile])),
    ledger: results.flatMap((result) => result.ledger),
  }
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true })
  const outputPath = path.join(ARTIFACT_DIR, `causal-audit-${label}.json`)
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  if (sha256(fs.readFileSync(DATA_PATH)) !== dataHashBefore) {
    fs.rmSync(outputPath, { force: true })
    throw new Error('frozen input changed during evaluation; report removed')
  }
  childProcess.execFileSync(process.execPath, [path.join(RESEARCH_DIR, 'production-guard.cjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  console.log('\nCausal audit: exact replay versus event-time-censored replay')
  console.table(Object.entries(report.metrics.aggregate).flatMap(([block, metrics]) => TARGETS.map((target) => ({
    block,
    target,
    n: metrics[target].n,
    exact: `${metrics[target].exactHits}/${metrics[target].n}`,
    causal: `${metrics[target].causalHits}/${metrics[target].n}`,
    delta: metrics[target].causalMinusExactHits,
    changed: metrics[target].changedRanking,
    pairedP: metrics[target].pairedSignP.toPrecision(3),
  }))))
  console.log(`Saved ${outputPath}`)
}

if (isMainThread) {
  main().catch((error) => {
    console.error(error.stack || error)
    process.exit(1)
  })
} else {
  try {
    parentPort.postMessage({ result: evaluateMarket(workerData.market) })
  } catch (error) {
    parentPort.postMessage({ error: error.stack || String(error) })
  }
}
