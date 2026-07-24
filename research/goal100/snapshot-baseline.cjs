/* eslint-disable no-console */

// Create a write-once, pre-event baseline registry using a fresh source fetch.
// All writes are confined to research/goal100/forward.

const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const Module = require('module')
const path = require('path')
const ts = require('typescript')

const RESEARCH_DIR = __dirname
const ROOT = path.resolve(RESEARCH_DIR, '..', '..')
const FORWARD_DIR = path.join(RESEARCH_DIR, 'forward')
const manifest = JSON.parse(fs.readFileSync(path.join(RESEARCH_DIR, 'manifest.json'), 'utf8'))

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

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
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

function istClock(now = new Date()) {
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
    display: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+05:30`,
  }
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function nextTargetDate(rows, market, clock) {
  const newest = rows.at(-1).isoDate
  const activeWeekdays = new Set(rows.slice(-120).map((item) => new Date(`${item.isoDate}T00:00:00Z`).getUTCDay()))
  let candidate = addDays(newest, 1)
  if (candidate < clock.isoDate || (candidate === clock.isoDate && clock.minute >= OPEN_MINUTE[market])) {
    candidate = addDays(clock.isoDate, clock.minute >= OPEN_MINUTE[market] ? 1 : 0)
  }
  for (let offset = 0; offset < 14; offset += 1) {
    const current = addDays(candidate, offset)
    const weekday = new Date(`${current}T00:00:00Z`).getUTCDay()
    if (activeWeekdays.has(weekday)) return current
  }
  throw new Error(`${market}: no active target day found`)
}

function ensureNoDuplicate(entries) {
  if (!fs.existsSync(FORWARD_DIR)) return
  for (const name of fs.readdirSync(FORWARD_DIR).filter((value) => /^registry-.*\.json$/.test(value))) {
    const existing = JSON.parse(fs.readFileSync(path.join(FORWARD_DIR, name), 'utf8'))
    const duplicate = existing.entries?.some((oldEntry) => entries.some(
      (entry) => oldEntry.market === entry.market
        && oldEntry.targetDate === entry.targetDate
        && oldEntry.modelId === entry.modelId,
    ))
    if (duplicate) throw new Error(`duplicate model/market/target already exists in ${name}`)
  }
}

async function main() {
  childProcess.execFileSync(process.execPath, [path.join(RESEARCH_DIR, 'production-guard.cjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  installTypeScriptLoader()
  const { GET } = require(path.join(ROOT, 'src', 'app', 'api', 'scrape', 'route.ts'))
  const { SUTTA_MODEL_VERSION } = require(path.join(ROOT, 'src', 'lib', 'app-version.ts'))
  const { analyzeMarket } = require(path.join(ROOT, 'src', 'lib', 'predictor.ts'))
  const { getRecordISODate } = require(path.join(ROOT, 'src', 'lib', 'backtest.ts'))
  const {
    buildCloseSuttaSet,
    buildJodis,
    buildOpenSuttaSet,
  } = require(path.join(ROOT, 'src', 'lib', 'sutta-model', 'production.ts'))

  const startedAt = new Date()
  const startClock = istClock(startedAt)
  if (startClock.minute >= Math.min(...Object.values(OPEN_MINUTE))) {
    throw new Error(`snapshot started at ${startClock.display}, after the earliest market Open; use the next pre-open cycle`)
  }

  const records = {}
  for (const [market, url] of Object.entries(MARKET_URLS)) {
    const request = {
      nextUrl: new URL(`http://local/api/scrape?url=${encodeURIComponent(url)}&market=${encodeURIComponent(market)}`),
    }
    const response = await GET(request)
    const json = await response.json()
    if (!response.ok) throw new Error(`${market}: ${json.error}`)
    records[market] = json.panels.map((panel) => ({
      id: `${panel.market}|${panel.dateRangeStart}|${panel.day}`,
      ...panel,
      savedAt: startedAt.getTime(),
    }))
    console.error(`Fetched ${market}: ${records[market].length}`)
  }

  const dated = (rows) => rows
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item) => item.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
  const allDated = Object.fromEntries(MARKET_ORDER.map((market) => [market, dated(records[market])]))
  const inputPayload = {
    schemaVersion: 1,
    fetchedAtUtc: startedAt.toISOString(),
    fetchedAtIst: startClock.display,
    source: 'fresh scrape through the read-only application scraper',
    records,
  }
  const inputText = `${JSON.stringify(inputPayload, null, 2)}\n`
  const inputSha256 = sha256(Buffer.from(inputText))
  const entries = []

  for (const market of MARKET_ORDER) {
    const rows = allDated[market]
    const targetDate = nextTargetDate(rows, market, startClock)
    const scheduledOpenMinuteIst = OPEN_MINUTE[market]
    if (targetDate === startClock.isoDate && startClock.minute >= scheduledOpenMinuteIst) {
      throw new Error(`${market}: snapshot is not pre-open for ${targetDate}`)
    }
    if (rows.some((item) => item.isoDate >= targetDate)) {
      throw new Error(`${market}: source contains target-day or later data for ${targetDate}`)
    }
    const prior = rows.filter((item) => item.isoDate < targetDate).map((item) => item.record)
    if (prior.length < 50) throw new Error(`${market}: insufficient history`)
    const priorAll = Object.fromEntries(MARKET_ORDER.map((sourceMarket) => [
      sourceMarket,
      allDated[sourceMarket].filter((item) => item.isoDate < targetDate).map((item) => item.record),
    ]))
    priorAll[market] = prior
    const targetDateValue = new Date(`${targetDate}T12:00:00`)
    const prediction = analyzeMarket(market, prior, priorAll, targetDateValue)
    if (!prediction) throw new Error(`${market}: predictor returned no result`)
    const open = buildOpenSuttaSet(
      prediction.openPicks, prediction.openSuttaDroughts, prior, 6,
      market, targetDateValue, records,
    )
    const close = buildCloseSuttaSet(
      prediction.closePicks, prediction.closeSuttaDroughts, prior, 6,
      market, null, records, targetDateValue,
    )
    if (new Set(open.map((pick) => pick.sutta)).size !== 6 || new Set(close.map((pick) => pick.sutta)).size !== 6) {
      throw new Error(`${market}: prediction does not satisfy the fixed Top-6 contract`)
    }
    entries.push({
      schemaVersion: 1,
      researchOnly: true,
      evidenceType: 'local-pre-event-baseline-comparator',
      modelId: `production-baseline-${SUTTA_MODEL_VERSION}`,
      market,
      targetDate,
      generatedAtUtc: new Date().toISOString(),
      snapshotStartedAtIst: startClock.display,
      scheduledOpenMinuteIst,
      ownDataCutoff: rows.at(-1).isoDate,
      sourceDataCutoffs: Object.fromEntries(MARKET_ORDER.map((sourceMarket) => [
        sourceMarket,
        allDated[sourceMarket].at(-1).isoDate,
      ])),
      openRanking: open.map((pick) => pick.sutta),
      closeRanking: close.map((pick) => pick.sutta),
      jodiRanking: buildJodis(open, close),
    })
  }

  ensureNoDuplicate(entries)
  const targetDates = [...new Set(entries.map((entry) => entry.targetDate))].sort()
  const registryCore = {
    schemaVersion: 1,
    researchOnly: true,
    evidenceType: 'local-pre-event-preregistration',
    warning: 'The local timestamp and hash provide tamper evidence but are not an independent trusted timestamp.',
    objective: manifest.objective,
    createdAtUtc: new Date().toISOString(),
    snapshotStartedAtIst: startClock.display,
    targetDates,
    inputFile: null,
    inputSha256,
    productionFingerprint: manifest.productionBoundary.digest,
    modelVersion: SUTTA_MODEL_VERSION,
    fixedSetSizes: { open: 6, close: 6, jodi: 36 },
    entries,
  }
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-').replace('Z', 'Z')
  fs.mkdirSync(FORWARD_DIR, { recursive: true })
  const inputName = `input-${stamp}.json`
  const registryName = `registry-${stamp}.json`
  registryCore.inputFile = inputName
  const registrySeal = sha256(Buffer.from(canonical(registryCore)))
  const registry = { ...registryCore, registrySealSha256: registrySeal }
  fs.writeFileSync(path.join(FORWARD_DIR, inputName), inputText, { encoding: 'utf8', flag: 'wx' })
  fs.writeFileSync(path.join(FORWARD_DIR, registryName), `${JSON.stringify(registry, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })

  childProcess.execFileSync(process.execPath, [path.join(RESEARCH_DIR, 'production-guard.cjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  console.table(entries.map((entry) => ({
    market: entry.market,
    targetDate: entry.targetDate,
    inputCutoff: entry.ownDataCutoff,
    open: entry.openRanking.join(''),
    close: entry.closeRanking.join(''),
  })))
  console.log(`Input: ${path.join(FORWARD_DIR, inputName)}`)
  console.log(`Registry: ${path.join(FORWARD_DIR, registryName)}`)
  console.log(`Registry seal: ${registrySeal}`)
}

main().catch((error) => {
  console.error(error.stack || error)
  process.exit(1)
})
