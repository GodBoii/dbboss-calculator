/* eslint-disable no-console */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const Module = require('module')
const ts = require('typescript')

const ROOT = process.cwd()
const CACHE = path.join(ROOT, 'scratch', 'sutta-research-records.json')
const REGISTRY = path.join(ROOT, 'scratch', 'sutta-forward-registry-v1010.json')
const PUBLIC_STATUS = path.join(ROOT, 'public', 'sutta-forward-score.json')
const MARKET_ORDER = [
  'Sridevi', 'Time Bazar', 'Madhur Day', 'Milan Day', 'Rajdhani Day', 'Kalyan',
  'Sridevi Night', 'Kalyan Night', 'Madhur Night', 'Milan Night', 'Rajdhani Night', 'Main Bazar',
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

const { SUTTA_MODEL_VERSION } = require('../src/lib/app-version.ts')
const { analyzeMarket } = require('../src/lib/predictor.ts')
const { getRecordISODate } = require('../src/lib/backtest.ts')
const {
  buildCloseSuttaSet,
  buildJodis,
  buildOpenSuttaSet,
} = require('../src/lib/sutta-model/production.ts')

function addDays(isoDate, days) {
  const value = new Date(`${isoDate}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function istNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  )
  return {
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item) => item.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

function nextTargetDate(rows, market, clock) {
  const newest = rows.at(-1).isoDate
  const activeWeekdays = new Set(rows.slice(-120).map((item) => new Date(`${item.isoDate}T00:00:00Z`).getUTCDay()))
  let candidate = addDays(newest, 1)
  if (candidate < clock.isoDate || (candidate === clock.isoDate && clock.minute >= OPEN_MINUTE[market])) {
    candidate = addDays(clock.isoDate, clock.minute >= OPEN_MINUTE[market] ? 1 : 0)
  }
  for (let offset = 0; offset < 14; offset++) {
    const current = addDays(candidate, offset)
    const weekday = new Date(`${current}T00:00:00Z`).getUTCDay()
    if (activeWeekdays.has(weekday)) return current
  }
  throw new Error(`${market}: no active weekday found after ${candidate}`)
}

function canonicalPayload(entry) {
  return {
    schemaVersion: entry.schemaVersion,
    modelVersion: entry.modelVersion,
    market: entry.market,
    targetDate: entry.targetDate,
    generatedAt: entry.generatedAt,
    generatedAtIST: entry.generatedAtIST,
    predictionTiming: entry.predictionTiming,
    ownDataCutoff: entry.ownDataCutoff,
    sourceDataCutoffs: entry.sourceDataCutoffs,
    openRanking: entry.openRanking,
    closeRanking: entry.closeRanking,
    jodiRanking: entry.jodiRanking,
  }
}

function seal(entry) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalPayload(entry))).digest('hex')
}

function loadRegistry() {
  if (!fs.existsSync(REGISTRY)) {
    return { schemaVersion: 1, createdAt: new Date().toISOString(), entries: [] }
  }
  return JSON.parse(fs.readFileSync(REGISTRY, 'utf8'))
}

function saveRegistry(registry) {
  registry.updatedAt = new Date().toISOString()
  fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2))
  writePublicStatus(registry)
}

function verifyRegistry(registry) {
  const failures = registry.entries.filter((entry) => entry.seal !== seal(entry))
  if (failures.length) {
    throw new Error(`Registry integrity failure: ${failures.map((entry) => `${entry.market}:${entry.targetDate}`).join(', ')}`)
  }
}

function publicMetric(entries, field) {
  const scored = entries.filter((entry) => entry.score)
  const hits = scored.filter((entry) => entry.score[field]).length
  const accuracy = scored.length ? (hits / scored.length) * 100 : null
  return {
    hits,
    accuracy,
    label: accuracy === null ? 'Pending' : `${accuracy.toFixed(1)}% (${hits}/${scored.length})`,
  }
}

function summarizeEntries(entries) {
  const scoredDraws = entries.filter((entry) => entry.score).length
  return {
    frozenDraws: entries.length,
    scoredDraws,
    pendingDraws: entries.length - scoredDraws,
    open: publicMetric(entries, 'openHit'),
    close: publicMetric(entries, 'closeHit'),
    jodi: publicMetric(entries, 'jodiHit'),
  }
}

function writePublicStatus(registry) {
  verifyRegistry(registry)
  const modelEntries = registry.entries.filter((entry) => entry.modelVersion === SUTTA_MODEL_VERSION)
  const status = {
    schemaVersion: 1,
    modelVersion: SUTTA_MODEL_VERSION,
    updatedAt: registry.updatedAt || new Date().toISOString(),
    integrityVerified: true,
    aggregate: summarizeEntries(modelEntries),
    byMarket: Object.fromEntries(
      MARKET_ORDER.map((market) => [market, summarizeEntries(modelEntries.filter((entry) => entry.market === market))]),
    ),
  }
  fs.writeFileSync(PUBLIC_STATUS, JSON.stringify(status, null, 2))
}

function snapshot() {
  const allRecords = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  const allDated = Object.fromEntries(Object.entries(allRecords).map(([market, records]) => [market, dated(records)]))
  const clock = istNow()
  const registry = loadRegistry()
  verifyRegistry(registry)
  const marketArg = process.argv.find((value) => value.startsWith('--market='))
  const targetMarkets = marketArg ? [marketArg.slice('--market='.length)] : MARKET_ORDER
  let added = 0

  for (const market of targetMarkets) {
    if (!MARKET_ORDER.includes(market)) throw new Error(`Unknown market: ${market}`)
    const rows = allDated[market]
    const targetDate = nextTargetDate(rows, market, clock)
    if (registry.entries.some((entry) => entry.market === market && entry.targetDate === targetDate && entry.modelVersion === SUTTA_MODEL_VERSION)) {
      console.log(`${market} ${targetDate}: already frozen`)
      continue
    }
    const prior = rows.filter((item) => item.isoDate < targetDate).map((item) => item.record)
    if (prior.length < 50) throw new Error(`${market}: insufficient history`)
    const priorAll = Object.fromEntries(
      MARKET_ORDER.map((sourceMarket) => [
        sourceMarket,
        allDated[sourceMarket].filter((item) => item.isoDate <= targetDate).map((item) => item.record),
      ]),
    )
    priorAll[market] = prior
    const targetDateValue = new Date(`${targetDate}T12:00:00`)
    const prediction = analyzeMarket(market, prior, priorAll, targetDateValue)
    if (!prediction) throw new Error(`${market}: production predictor returned no result`)
    const open = buildOpenSuttaSet(
      prediction.openPicks, prediction.openSuttaDroughts, prior, 6,
      market, targetDateValue, allRecords,
    )
    const close = buildCloseSuttaSet(
      prediction.closePicks, prediction.closeSuttaDroughts, prior, 6,
      market, null, allRecords, targetDateValue,
    )
    const generatedAt = new Date().toISOString()
    const entry = {
      schemaVersion: 1,
      modelVersion: SUTTA_MODEL_VERSION,
      market,
      targetDate,
      generatedAt,
      generatedAtIST: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'medium', hourCycle: 'h23',
      }).format(new Date(generatedAt)),
      predictionTiming: targetDate === clock.isoDate ? 'same-day-pre-open' : 'advance-batch',
      ownDataCutoff: rows.at(-1).isoDate,
      sourceDataCutoffs: Object.fromEntries(MARKET_ORDER.map((sourceMarket) => [sourceMarket, allDated[sourceMarket].at(-1).isoDate])),
      openRanking: open.map((pick) => pick.sutta),
      closeRanking: close.map((pick) => pick.sutta),
      jodiRanking: buildJodis(open, close),
      score: null,
    }
    entry.seal = seal(entry)
    registry.entries.push(entry)
    added++
    console.log(`${market} ${targetDate}: frozen ${entry.openRanking.join('')} / ${entry.closeRanking.join('')} (${entry.predictionTiming})`)
  }
  saveRegistry(registry)
  console.log(`Added ${added}; registry now has ${registry.entries.length} sealed predictions`)
}

function score() {
  const allRecords = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  const resultMaps = Object.fromEntries(
    Object.entries(allRecords).map(([market, records]) => [market, new Map(dated(records).map((item) => [item.isoDate, item.record]))]),
  )
  const registry = loadRegistry()
  verifyRegistry(registry)
  let scored = 0
  for (const entry of registry.entries) {
    if (entry.score) continue
    const actual = resultMaps[entry.market]?.get(entry.targetDate)
    if (!actual) continue
    const actualJodi = `${actual.openSutta}${actual.closeSutta}`
    entry.score = {
      scoredAt: new Date().toISOString(),
      actualOpen: actual.openSutta,
      actualClose: actual.closeSutta,
      actualJodi,
      openHit: entry.openRanking.includes(actual.openSutta),
      closeHit: entry.closeRanking.includes(actual.closeSutta),
      jodiHit: entry.jodiRanking.includes(actualJodi),
    }
    scored++
  }
  saveRegistry(registry)
  console.log(`Scored ${scored} newly available predictions`)
  status(registry)
}

function status(existingRegistry = null) {
  const registry = existingRegistry || loadRegistry()
  verifyRegistry(registry)
  writePublicStatus(registry)
  const scored = registry.entries.filter((entry) => entry.score)
  const totals = {
    n: scored.length,
    open: scored.filter((entry) => entry.score.openHit).length,
    close: scored.filter((entry) => entry.score.closeHit).length,
    jodi: scored.filter((entry) => entry.score.jodiHit).length,
  }
  const pct = (hits) => totals.n ? `${hits}/${totals.n} (${((hits / totals.n) * 100).toFixed(1)}%)` : '0/0'
  console.log(`Integrity: ${registry.entries.length}/${registry.entries.length} seals valid`)
  console.log(`Scored: ${totals.n}; Open ${pct(totals.open)}; Close ${pct(totals.close)}; Jodi ${pct(totals.jodi)}`)
  const pending = registry.entries.filter((entry) => !entry.score)
  if (pending.length) console.table(pending.map((entry) => ({ market: entry.market, targetDate: entry.targetDate, timing: entry.predictionTiming })))
}

const command = process.argv[2] || 'status'
if (command === 'snapshot') snapshot()
else if (command === 'score') score()
else if (command === 'status') status()
else throw new Error(`Unknown command: ${command}. Use snapshot, score, or status.`)
