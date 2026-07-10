const ts = require('typescript')

require.extensions['.ts'] = function registerTs(module, filename) {
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

const MARKETS = {
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

const LIQUIDITY_FLOW_MAP = {
  'Time Bazar': 'Sridevi',
  'Madhur Day': 'Time Bazar',
  'Milan Day': 'Madhur Day',
  'Rajdhani Day': 'Milan Day',
  Kalyan: 'Rajdhani Day',
  'Sridevi Night': 'Kalyan',
  'Kalyan Night': 'Kalyan',
  'Madhur Night': 'Sridevi Night',
  'Milan Night': 'Madhur Night',
  'Rajdhani Night': 'Milan Night',
  'Main Bazar': 'Rajdhani Night',
}

const DAY_OFFSETS = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HIGH_VOLUME = new Set(Object.keys(MARKETS))
const MEDIUM_VOLUME = new Set(['Time Bazar', 'Madhur Day', 'Rajdhani Day', 'Sridevi Night', 'Kalyan Night', 'Madhur Night', 'Rajdhani Night'])

function generateAllPanels() {
  const panels = []
  const ord = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
  for (let i = 0; i < 10; i++) {
    for (let j = i; j < 10; j++) {
      for (let k = j; k < 10; k++) {
        panels.push(`${ord[i]}${ord[j]}${ord[k]}`)
      }
    }
  }
  return panels
}

const ALL_PANELS = generateAllPanels()

function parseDate(dateStr) {
  const parts = dateStr.replace(/-/g, '/').split('/').map((part) => parseInt(part, 10))
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null
  const [day, month, rawYear] = parts
  const year = rawYear < 100 ? rawYear + 2000 : rawYear
  return new Date(Date.UTC(year, month - 1, day))
}

function toISODate(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function getRecordISODate(record) {
  const start = parseDate(record.dateRangeStart)
  if (!start) return null
  return toISODate(addDays(start, DAY_OFFSETS[record.day] ?? 0))
}

function calculateSutta(panel) {
  return (parseInt(panel[0], 10) + parseInt(panel[1], 10) + parseInt(panel[2], 10)) % 10
}

function isSequential(panel) {
  if (!panel || panel.length !== 3) return false
  const d1 = parseInt(panel[0], 10)
  const d2 = parseInt(panel[1], 10)
  const d3 = parseInt(panel[2], 10)
  if (d2 === d1 + 1 && d3 === d2 + 1) return true
  if (d2 === d1 - 1 && d3 === d2 - 1) return true
  return ['890', '901', '012', '789'].includes(panel)
}

function isTriple(panel) {
  return panel && panel.length === 3 && panel[0] === panel[1] && panel[1] === panel[2]
}

function countLuckyDigits(panel) {
  return panel.split('').filter((digit) => ['7', '8', '9'].includes(digit)).length
}

function flattenRecords(records) {
  const entries = []
  for (const rec of records) {
    if (rec.openPanel) entries.push({ panel: rec.openPanel, sutta: rec.openSutta, type: 'open', day: rec.day })
    if (rec.closePanel) entries.push({ panel: rec.closePanel, sutta: rec.closeSutta, type: 'close', day: rec.day })
  }
  return entries
}

function computeDroughts(entries) {
  const droughts = {}
  for (let s = 0; s <= 9; s++) droughts[String(s)] = 1000
  for (let i = entries.length - 1; i >= 0; i--) {
    const key = String(entries[i].sutta)
    if (droughts[key] === 1000) droughts[key] = entries.length - 1 - i
    if (Object.values(droughts).every((value) => value < 1000)) break
  }
  return droughts
}

function suttaState(drought) {
  if (drought >= 1000) return 'unknown'
  if (drought > 20) return 'snapback'
  if (drought > 15) return 'cooling'
  if (drought > 8) return 'danger'
  if (drought > 4) return 'warming'
  return 'fresh'
}

const BASE = {
  name: 'current',
  openDroughtMode: 'combined',
  closeDroughtMode: 'close',
  useLiquidity: true,
  useTemporal: true,
  useDayBoost: true,
  recency: 'current',
  cooldown: [40, 20],
  seqPenalty: 35,
  triplePenalty: 50,
  luckyPenalty: 0,
  suttaPenalty: {
    fresh: 0,
    warming: 10,
    danger: 30,
    dangerHigh: 35,
    cooling: 10,
    snapback: -25,
  },
  jodi: {
    enabled: true,
    strength: 1,
    sampleDenom: 220,
    recentWindow: 0,
    strongHigh: 1.5,
    mildHigh: 1.2,
    mildLow: 0.8,
    strongLow: 0.6,
    strongBonus: 24,
    mildBonus: 12,
    strongPenalty: 24,
    mildPenalty: 12,
  },
}

function variant(name, patch) {
  return {
    ...BASE,
    ...patch,
    name,
    suttaPenalty: { ...BASE.suttaPenalty, ...(patch.suttaPenalty || {}) },
    jodi: { ...BASE.jodi, ...(patch.jodi || {}) },
  }
}

const VARIANTS = [
  variant('current', {}),
  variant('open-use-open-drought', { openDroughtMode: 'open' }),
  variant('close-use-combined-drought', { closeDroughtMode: 'combined' }),
  variant('no-liquidity', { useLiquidity: false }),
  variant('no-temporal', { useTemporal: false }),
  variant('no-day-boost', { useDayBoost: false }),
  variant('no-cooldown', { cooldown: [0, 0] }),
  variant('soft-cooldown', { cooldown: [20, 10] }),
  variant('hard-cooldown', { cooldown: [60, 30] }),
  variant('no-popular-penalty', { seqPenalty: 0, triplePenalty: 0 }),
  variant('soft-popular-penalty', { seqPenalty: 15, triplePenalty: 25 }),
  variant('hard-popular-penalty', { seqPenalty: 55, triplePenalty: 75 }),
  variant('lucky-penalty-8', { luckyPenalty: 8 }),
  variant('recency-flat', { recency: 'flat' }),
  variant('recency-older-heavy', { recency: 'older-heavy' }),
  variant('recency-recent-heavy', { recency: 'recent-heavy' }),
  variant('sutta-neutral', { suttaPenalty: { fresh: 0, warming: 0, danger: 0, dangerHigh: 0, cooling: 0, snapback: 0 } }),
  variant('sutta-no-snapback', { suttaPenalty: { snapback: 0 } }),
  variant('sutta-avoid-all-drought', { suttaPenalty: { warming: 15, danger: 25, dangerHigh: 25, cooling: 25, snapback: 25 } }),
  variant('sutta-favor-drought', { suttaPenalty: { warming: -5, danger: -10, dangerHigh: -10, cooling: -15, snapback: -25 } }),
  variant('jodi-off', { jodi: { enabled: false } }),
  variant('jodi-half', { jodi: { strength: 0.5 } }),
  variant('jodi-strong', { jodi: { strength: 1.75 } }),
  variant('jodi-more-sample-trust', { jodi: { sampleDenom: 100 } }),
  variant('jodi-less-sample-trust', { jodi: { sampleDenom: 500 } }),
  variant('jodi-recent-500', { jodi: { recentWindow: 500 } }),
  variant('combo-open-panel', { recency: 'older-heavy', useDayBoost: false }),
  variant('combo-close-panel', { suttaPenalty: { warming: -5, danger: -10, dangerHigh: -10, cooling: -15, snapback: -25 }, useDayBoost: false }),
  variant('combo-jodi-panel', { suttaPenalty: { warming: -5, danger: -10, dangerHigh: -10, cooling: -15, snapback: -25 }, useDayBoost: false, jodi: { strength: 1 } }),
  variant('combo-jodi-safer-sutta', { suttaPenalty: { warming: -5, danger: -10, dangerHigh: -10, cooling: -15, snapback: -25 }, useDayBoost: false, jodi: { sampleDenom: 500, strength: 0.5 } }),
]

function recencyScore(lastSeen, mode) {
  if (mode === 'flat') return 60
  if (mode === 'recent-heavy') {
    if (lastSeen <= 3) return 25
    if (lastSeen <= 8) return 65
    if (lastSeen <= 20) return 85
    if (lastSeen <= 50) return 70
    if (lastSeen <= 100) return 55
    return 45
  }
  if (mode === 'older-heavy') {
    if (lastSeen <= 3) return 0
    if (lastSeen <= 8) return 20
    if (lastSeen <= 20) return 50
    if (lastSeen <= 50) return 75
    if (lastSeen <= 100) return 90
    return 80
  }
  if (lastSeen <= 3) return 5
  if (lastSeen <= 8) return 30
  if (lastSeen <= 20) return 60
  if (lastSeen <= 50) return 85
  if (lastSeen <= 100) return 70
  return 50
}

function suttaPenalty(drought, options) {
  const state = suttaState(drought)
  if (state === 'danger' && drought > 12) return options.suttaPenalty.dangerHigh
  return options.suttaPenalty[state] ?? 0
}

function volumeMultiplier(market) {
  if (HIGH_VOLUME.has(market)) return 0.6
  if (MEDIUM_VOLUME.has(market)) return 0.8
  return 1
}

function temporalMultiplier(date, options) {
  if (!options.useTemporal) return 1
  const day = date.getUTCDate()
  if (day >= 1 && day <= 5) return 0.7
  if (day >= 25) return 1.3
  return 1
}

function liquidityMultiplier(market, allMarketsPrior, options) {
  if (!options.useLiquidity) return 1
  const source = LIQUIDITY_FLOW_MAP[market]
  const records = source ? allMarketsPrior[source] || [] : []
  const last = records[records.length - 1]
  if (!last) return 1
  if (isSequential(last.openPanel) || isTriple(last.openPanel) || isSequential(last.closePanel) || isTriple(last.closePanel)) return 1.5
  return 0.9
}

function hasHoneyPot(entries) {
  let sinceSeq = 0
  for (let i = entries.length - 1; i >= 0; i--) {
    if (isSequential(entries[i].panel)) break
    sinceSeq++
  }
  const droughts = []
  let current = 0
  for (const entry of entries) {
    if (isSequential(entry.panel)) {
      if (current > 0) droughts.push(current)
      current = 0
    } else {
      current++
    }
  }
  const average = droughts.length ? droughts.reduce((a, b) => a + b, 0) / droughts.length : 21
  return sinceSeq > Math.max(30, average * 1.4)
}

function scorePosition(entries, suttaEntries, market, allMarketsPrior, date, type, options, jodiPenalties = {}) {
  if (!entries.length) return []

  const panelLastSeen = {}
  for (let i = entries.length - 1; i >= 0; i--) {
    if (!(entries[i].panel in panelLastSeen)) panelLastSeen[entries[i].panel] = entries.length - 1 - i
  }

  const droughts = computeDroughts(suttaEntries)
  const allEntries = flattenRecords(allMarketsPrior[market] || [])
  const honeyPot = hasHoneyPot(allEntries)
  const dayName = DAY_NAMES[date.getUTCDay()]
  const vol = volumeMultiplier(market)
  const temporal = temporalMultiplier(date, options)
  const liquidity = liquidityMultiplier(market, allMarketsPrior, options)

  const daySuttaCounts = {}
  let dayTotal = 0
  for (const entry of entries) {
    if (entry.day === dayName) {
      daySuttaCounts[String(entry.sutta)] = (daySuttaCounts[String(entry.sutta)] || 0) + 1
      dayTotal++
    }
  }

  const picks = []
  for (const panel of ALL_PANELS) {
    const lastSeen = panelLastSeen[panel] ?? Infinity
    const sutta = calculateSutta(panel)
    const panelSeq = isSequential(panel)
    const panelTriple = isTriple(panel)

    let seqPenalty = 0
    if (panelSeq) seqPenalty = honeyPot ? -40 : options.seqPenalty * vol * temporal * liquidity
    const triplePenalty = panelTriple ? options.triplePenalty * vol * temporal * liquidity : 0
    const luckyPenalty = countLuckyDigits(panel) * options.luckyPenalty * vol * temporal * liquidity
    const cooldownPenalty = lastSeen <= 3 ? options.cooldown[0] : lastSeen <= 5 ? options.cooldown[1] : 0

    let dayBoost = 0
    if (options.useDayBoost && dayTotal > 20) {
      const rate = (daySuttaCounts[String(sutta)] || 0) / dayTotal
      if (rate > 0.13) dayBoost = 10 * (rate / 0.1)
    }

    const raw =
      recencyScore(lastSeen, options.recency) -
      cooldownPenalty -
      seqPenalty -
      triplePenalty -
      luckyPenalty -
      suttaPenalty(droughts[String(sutta)] ?? 1000, options) +
      dayBoost -
      (jodiPenalties[sutta] || 0)

    picks.push({ panel, sutta, score: Math.max(0, Math.min(100, raw)), type })
  }

  picks.sort((a, b) => b.score - a.score)
  return picks
}

function jodiPenalties(openSutta, prior, options) {
  if (!options.jodi.enabled) return {}
  const rows = options.jodi.recentWindow > 0 ? prior.slice(-options.jodi.recentWindow) : prior
  const counts = {}
  for (let s = 0; s <= 9; s++) counts[s] = 0
  let total = 0
  for (const rec of rows) {
    if (rec.openSutta === openSutta && rec.closeSutta >= 0) {
      counts[rec.closeSutta]++
      total++
    }
  }
  const avg = total / 10
  const sampleWeight = Math.min(1, total / options.jodi.sampleDenom)
  const penalties = {}
  for (let s = 0; s <= 9; s++) {
    const ratio = avg > 0 ? counts[s] / avg : 1
    if (ratio > options.jodi.strongHigh) penalties[s] = -options.jodi.strongBonus * sampleWeight * options.jodi.strength
    else if (ratio > options.jodi.mildHigh) penalties[s] = -options.jodi.mildBonus * sampleWeight * options.jodi.strength
    else if (ratio < options.jodi.strongLow) penalties[s] = options.jodi.strongPenalty * sampleWeight * options.jodi.strength
    else if (ratio < options.jodi.mildLow) penalties[s] = options.jodi.mildPenalty * sampleWeight * options.jodi.strength
    else penalties[s] = 0
  }
  return penalties
}

function emptyMetrics() {
  return {
    n: 0,
    panelTop3: 0,
    panelTop10: 0,
    panelTop30: 0,
    suttaTop3: 0,
    suttaTop10: 0,
    suttaTop30: 0,
    rankSum: 0,
    rankSeen: 0,
  }
}

function addHit(metrics, picks, actualPanel, actualSutta) {
  if (!actualPanel || actualSutta < 0) return
  metrics.n++
  const rank = picks.findIndex((pick) => pick.panel === actualPanel) + 1
  if (rank > 0) {
    metrics.rankSum += rank
    metrics.rankSeen++
  }
  for (const [key, size] of [
    ['Top3', 3],
    ['Top10', 10],
    ['Top30', 30],
  ]) {
    if (picks.slice(0, size).some((pick) => pick.panel === actualPanel)) metrics[`panel${key}`]++
    if (picks.slice(0, size).some((pick) => pick.sutta === actualSutta)) metrics[`sutta${key}`]++
  }
}

function pct(value, total) {
  return total ? (value / total) * 100 : 0
}

function compact(metrics) {
  return {
    n: metrics.n,
    p3: pct(metrics.panelTop3, metrics.n),
    p10: pct(metrics.panelTop10, metrics.n),
    p30: pct(metrics.panelTop30, metrics.n),
    s3: pct(metrics.suttaTop3, metrics.n),
    s10: pct(metrics.suttaTop10, metrics.n),
    s30: pct(metrics.suttaTop30, metrics.n),
    avgRank: metrics.rankSeen ? metrics.rankSum / metrics.rankSeen : null,
  }
}

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item) => item.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

function buildCases(market, records, allRecords, days) {
  const datedRecords = dated(records)
  const endDate = datedRecords[datedRecords.length - 1].isoDate
  const startDateObj = new Date(`${endDate}T00:00:00Z`)
  startDateObj.setUTCDate(startDateObj.getUTCDate() - days + 1)
  const startDate = toISODate(startDateObj)
  const allDated = {}
  for (const [m, marketRecords] of Object.entries(allRecords)) {
    allDated[m] = dated(marketRecords)
  }
  const cases = []

  for (let i = 0; i < datedRecords.length; i++) {
    const item = datedRecords[i]
    if (item.isoDate < startDate || item.isoDate > endDate) continue
    const prior = datedRecords.slice(0, i).filter((row) => row.isoDate < item.isoDate).map((row) => row.record)
    if (prior.length < 50) continue

    const priorAll = {}
    for (const [m, marketRows] of Object.entries(allDated)) {
      const cutoff = marketRows.findIndex((row) => row.isoDate >= item.isoDate)
      const end = cutoff === -1 ? marketRows.length : cutoff
      priorAll[m] = marketRows.slice(0, end).map((row) => row.record)
    }
    priorAll[market] = prior

    const date = new Date(`${item.isoDate}T12:00:00Z`)
    const allEntries = flattenRecords(prior)
    const openEntries = allEntries.filter((entry) => entry.type === 'open')
    const closeEntries = allEntries.filter((entry) => entry.type === 'close')
    cases.push({
      record: item.record,
      prior,
      priorAll,
      date,
      allEntries,
      openEntries,
      closeEntries,
    })
  }

  return cases
}

function runVariant(market, cases, options) {
  const open = emptyMetrics()
  const close = emptyMetrics()
  const jodi = emptyMetrics()

  for (const item of cases) {
    const openSuttaEntries = options.openDroughtMode === 'open' ? item.openEntries : item.allEntries
    const closeSuttaEntries = options.closeDroughtMode === 'combined' ? item.allEntries : item.closeEntries

    const openPicks = scorePosition(item.openEntries, openSuttaEntries, market, item.priorAll, item.date, 'open', options)
    const closePicks = scorePosition(item.closeEntries, closeSuttaEntries, market, item.priorAll, item.date, 'close', options)
    const adjustedClosePicks = scorePosition(
      item.closeEntries,
      closeSuttaEntries,
      market,
      item.priorAll,
      item.date,
      'jodi',
      options,
      jodiPenalties(item.record.openSutta, item.prior, options),
    )

    addHit(open, openPicks, item.record.openPanel, item.record.openSutta)
    addHit(close, closePicks, item.record.closePanel, item.record.closeSutta)
    addHit(jodi, adjustedClosePicks, item.record.closePanel, item.record.closeSutta)
  }

  return { open: compact(open), close: compact(close), jodi: compact(jodi) }
}

async function fetchAll() {
  const all = {}
  for (const [market, url] of Object.entries(MARKETS)) {
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

function summarizeVariant(caseMap, options) {
  const perMarket = {}
  const totals = {
    open: emptyMetrics(),
    close: emptyMetrics(),
    jodi: emptyMetrics(),
  }

  for (const market of Object.keys(MARKETS)) {
    perMarket[market] = runVariant(market, caseMap[market], options)
    for (const target of ['open', 'close', 'jodi']) {
      const compacted = perMarket[market][target]
      totals[target].n += compacted.n
      totals[target].panelTop3 += compacted.p3 * compacted.n / 100
      totals[target].panelTop10 += compacted.p10 * compacted.n / 100
      totals[target].panelTop30 += compacted.p30 * compacted.n / 100
      totals[target].suttaTop3 += compacted.s3 * compacted.n / 100
      totals[target].suttaTop10 += compacted.s10 * compacted.n / 100
      totals[target].suttaTop30 += compacted.s30 * compacted.n / 100
    }
  }

  return {
    name: options.name,
    perMarket,
    open: compact(totals.open),
    close: compact(totals.close),
    jodi: compact(totals.jodi),
  }
}

function relationStats(allRecords) {
  const rows = []
  for (const [market, records] of Object.entries(allRecords)) {
    const matrix = Array.from({ length: 10 }, () => Array(10).fill(0))
    const closeCounts = Array(10).fill(0)
    let total = 0
    for (const record of records) {
      matrix[record.openSutta][record.closeSutta]++
      closeCounts[record.closeSutta]++
      total++
    }
    let weightedLift = 0
    let seenOpen = 0
    for (let os = 0; os <= 9; os++) {
      const rowTotal = matrix[os].reduce((a, b) => a + b, 0)
      if (!rowTotal) continue
      const maxRate = Math.max(...matrix[os]) / rowTotal
      weightedLift += maxRate * rowTotal
      seenOpen += rowTotal
    }
    const baselineMax = Math.max(...closeCounts) / total
    rows.push({
      market,
      draws: total,
      bestConditionalCloseSutta: seenOpen ? (weightedLift / seenOpen) * 100 : 0,
      baselineBestCloseSutta: baselineMax * 100,
      conditionalLift: seenOpen ? ((weightedLift / seenOpen) - baselineMax) * 100 : 0,
    })
  }
  return rows.sort((a, b) => b.conditionalLift - a.conditionalLift)
}

function droughtRelation(allRecords, target) {
  const buckets = {}
  for (const state of ['fresh', 'warming', 'danger', 'cooling', 'snapback']) {
    buckets[state] = { n: 0 }
  }
  for (const records of Object.values(allRecords)) {
    const datedRecords = dated(records)
    for (let i = 50; i < datedRecords.length; i++) {
      const prior = datedRecords.slice(0, i).map((item) => item.record)
      const allEntries = flattenRecords(prior)
      const openEntries = allEntries.filter((entry) => entry.type === 'open')
      const closeEntries = allEntries.filter((entry) => entry.type === 'close')
      const droughts = target === 'open'
        ? computeDroughts(allEntries)
        : computeDroughts(closeEntries)
      const record = datedRecords[i].record
      const actualSutta = target === 'open' ? record.openSutta : record.closeSutta
      const state = suttaState(droughts[String(actualSutta)] ?? 1000)
      if (buckets[state]) buckets[state].n++
    }
  }
  return buckets
}

function recencyRelation(allRecords, target) {
  const bins = {
    '0-3': 0,
    '4-8': 0,
    '9-20': 0,
    '21-50': 0,
    '51-100': 0,
    '100+': 0,
    never: 0,
  }
  for (const records of Object.values(allRecords)) {
    const datedRecords = dated(records)
    for (let i = 50; i < datedRecords.length; i++) {
      const prior = datedRecords.slice(0, i).map((item) => item.record)
      const entries = flattenRecords(prior).filter((entry) => entry.type === target)
      const actualPanel = target === 'open' ? datedRecords[i].record.openPanel : datedRecords[i].record.closePanel
      let lastSeen = Infinity
      for (let j = entries.length - 1; j >= 0; j--) {
        if (entries[j].panel === actualPanel) {
          lastSeen = entries.length - 1 - j
          break
        }
      }
      if (lastSeen === Infinity) bins.never++
      else if (lastSeen <= 3) bins['0-3']++
      else if (lastSeen <= 8) bins['4-8']++
      else if (lastSeen <= 20) bins['9-20']++
      else if (lastSeen <= 50) bins['21-50']++
      else if (lastSeen <= 100) bins['51-100']++
      else bins['100+']++
    }
  }
  return bins
}

function liquidityRelation(allRecords) {
  const rows = []
  for (const [market, source] of Object.entries(LIQUIDITY_FLOW_MAP)) {
    const targetDated = dated(allRecords[market])
    const sourceRecords = allRecords[source] || []
    const yes = { n: 0, targetPopular: 0 }
    const no = { n: 0, targetPopular: 0 }
    for (const item of targetDated.slice(50)) {
      const priorSource = sourceRecords.filter((record) => {
        const iso = getRecordISODate(record)
        return iso && iso < item.isoDate
      })
      const last = priorSource[priorSource.length - 1]
      if (!last) continue
      const sourcePopular = isSequential(last.openPanel) || isTriple(last.openPanel) || isSequential(last.closePanel) || isTriple(last.closePanel)
      const targetPopular = isSequential(item.record.openPanel) || isTriple(item.record.openPanel) || isSequential(item.record.closePanel) || isTriple(item.record.closePanel)
      const bucket = sourcePopular ? yes : no
      bucket.n++
      if (targetPopular) bucket.targetPopular++
    }
    rows.push({
      market,
      source,
      sourcePopularN: yes.n,
      targetPopularAfterSourcePopular: pct(yes.targetPopular, yes.n),
      sourceNormalN: no.n,
      targetPopularAfterSourceNormal: pct(no.targetPopular, no.n),
      delta: pct(yes.targetPopular, yes.n) - pct(no.targetPopular, no.n),
    })
  }
  return rows.sort((a, b) => b.delta - a.delta)
}

function fmt(value) {
  return value == null ? null : Number(value.toFixed(1))
}

function topVariantRows(results, target, metric) {
  return [...results]
    .sort((a, b) => b[target][metric] - a[target][metric])
    .slice(0, 8)
    .map((result) => ({
      variant: result.name,
      [`${target}.${metric}`]: fmt(result[target][metric]),
      [`${target}.p30`]: fmt(result[target].p30),
      [`${target}.s30`]: fmt(result[target].s30),
    }))
}

function perMarketBest(results, target, metric) {
  const rows = []
  for (const market of Object.keys(MARKETS)) {
    let best = null
    for (const result of results) {
      const score = result.perMarket[market][target][metric]
      if (!best || score > best.score) best = { variant: result.name, score, p30: result.perMarket[market][target].p30, s30: result.perMarket[market][target].s30 }
    }
    rows.push({ market, variant: best.variant, [metric]: fmt(best.score), p30: fmt(best.p30), s30: fmt(best.s30) })
  }
  return rows
}

function selectedVariantRows(results, target, names) {
  return names
    .map((name) => results.find((result) => result.name === name))
    .filter(Boolean)
    .map((result) => ({
      variant: result.name,
      p3: fmt(result[target].p3),
      p10: fmt(result[target].p10),
      p30: fmt(result[target].p30),
      s3: fmt(result[target].s3),
      s10: fmt(result[target].s10),
      s30: fmt(result[target].s30),
    }))
}

async function main() {
  const days = parseInt(process.argv[2] || '90', 10)
  console.log(`Fetching trusted source data for ${Object.keys(MARKETS).length} markets...`)
  const allRecords = await fetchAll()
  const caseMap = {}
  for (const market of Object.keys(MARKETS)) {
    caseMap[market] = buildCases(market, allRecords[market], allRecords, days)
  }
  console.log(`Running ${VARIANTS.length} variants over last ${days} days...`)
  const results = VARIANTS.map((options) => summarizeVariant(caseMap, options))

  console.log('\nGlobal best variants: open panel@30')
  console.table(topVariantRows(results, 'open', 'p30'))
  console.log('\nGlobal best variants: open sutta@30')
  console.table(topVariantRows(results, 'open', 's30'))
  console.log('\nGlobal best variants: close panel@30')
  console.table(topVariantRows(results, 'close', 'p30'))
  console.log('\nGlobal best variants: close sutta@30')
  console.table(topVariantRows(results, 'close', 's30'))
  console.log('\nGlobal best variants: jodi panel@30')
  console.table(topVariantRows(results, 'jodi', 'p30'))
  console.log('\nGlobal best variants: jodi sutta@30')
  console.table(topVariantRows(results, 'jodi', 's30'))

  console.log('\nPer-market best open panel@30')
  console.table(perMarketBest(results, 'open', 'p30'))
  console.log('\nPer-market best close panel@30')
  console.table(perMarketBest(results, 'close', 'p30'))
  console.log('\nPer-market best jodi panel@30')
  console.table(perMarketBest(results, 'jodi', 'p30'))

  const selected = [
    'current',
    'recency-flat',
    'recency-older-heavy',
    'no-day-boost',
    'close-use-combined-drought',
    'sutta-neutral',
    'sutta-favor-drought',
    'jodi-off',
    'jodi-half',
    'jodi-less-sample-trust',
  ]
  console.log('\nSelected variants with top3/top10/top30: open')
  console.table(selectedVariantRows(results, 'open', selected))
  console.log('\nSelected variants with top3/top10/top30: close')
  console.table(selectedVariantRows(results, 'close', selected))
  console.log('\nSelected variants with top3/top10/top30: jodi')
  console.table(selectedVariantRows(results, 'jodi', selected))

  console.log('\nOpen-close sutta dependency by market')
  console.table(relationStats(allRecords).map((row) => ({
    market: row.market,
    draws: row.draws,
    conditionalBest: fmt(row.bestConditionalCloseSutta),
    baselineBest: fmt(row.baselineBestCloseSutta),
    lift: fmt(row.conditionalLift),
  })))

  console.log('\nActual open sutta drought state distribution')
  console.table(droughtRelation(allRecords, 'open'))
  console.log('\nActual close sutta drought state distribution')
  console.table(droughtRelation(allRecords, 'close'))

  console.log('\nActual panel last-seen bins: open')
  console.table(recencyRelation(allRecords, 'open'))
  console.log('\nActual panel last-seen bins: close')
  console.table(recencyRelation(allRecords, 'close'))

  console.log('\nLiquidity premise check: does source popular hit precede target popular hit?')
  console.table(liquidityRelation(allRecords).map((row) => ({
    market: row.market,
    source: row.source,
    sourcePopularN: row.sourcePopularN,
    afterPopular: fmt(row.targetPopularAfterSourcePopular),
    sourceNormalN: row.sourceNormalN,
    afterNormal: fmt(row.targetPopularAfterSourceNormal),
    delta: fmt(row.delta),
  })))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
