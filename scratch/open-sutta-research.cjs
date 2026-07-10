/* eslint-disable no-console */

const fs = require('fs')
const ts = require('typescript')

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
const { analyzeMarket, getSuttaSignal } = require('../src/lib/predictor.ts')
const { getRecordISODate } = require('../src/lib/backtest.ts')

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
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const COUNTS = [3, 4, 6]
const MIN_TRAINING = 50
const CACHE = 'scratch/open-sutta-records-cache.json'

function pct(n, d) {
  return d ? (n / d) * 100 : 0
}

function fmt(n) {
  return Number(n.toFixed(1))
}

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item) => item.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

async function fetchAll() {
  if (fs.existsSync(CACHE)) {
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  }
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
  fs.writeFileSync(CACHE, JSON.stringify(all))
  return all
}

function flattenOpen(records) {
  return records
    .filter((record) => record.openPanel && record.openSutta >= 0)
    .map((record) => ({ sutta: record.openSutta, panel: record.openPanel, day: record.day }))
}

function flattenClose(records) {
  return records
    .filter((record) => record.closePanel && record.closeSutta >= 0)
    .map((record) => ({ sutta: record.closeSutta, panel: record.closePanel, day: record.day }))
}

function uniqueByPickRank(picks) {
  const seen = new Set()
  const rows = []
  for (const [index, pick] of picks.entries()) {
    if (seen.has(pick.sutta)) continue
    seen.add(pick.sutta)
    rows.push({ sutta: pick.sutta, score: pick.score, rank: index + 1 })
  }
  return rows
}

function currentUi(picks, droughts, count) {
  const rows = uniqueByPickRank(picks)
  for (let s = 0; s <= 9; s++) {
    if (!rows.some((row) => row.sutta === s)) rows.push({ sutta: s, score: 0, rank: 999 })
  }
  const withSignal = rows.map((row) => ({
    ...row,
    signal: getSuttaSignal(droughts[String(row.sutta)] ?? 1000).state,
  }))
  const selected = withSignal.filter((row) => row.signal === 'fresh')
  for (const row of withSignal.filter((item) => item.signal === 'snapback')) {
    if (selected.length >= count) break
    if (!selected.some((item) => item.sutta === row.sutta)) selected.push(row)
  }
  for (const row of withSignal) {
    if (selected.length >= count) break
    if (!selected.some((item) => item.sutta === row.sutta)) selected.push(row)
  }
  return selected.slice(0, count).map((row) => row.sutta)
}

function pickAggregate(picks, droughts, count, options) {
  const rows = new Map()
  for (const [index, pick] of picks.entries()) {
    const rankWeight = Math.max(1, 31 - index)
    const existing = rows.get(pick.sutta) ?? {
      sutta: pick.sutta,
      sum: 0,
      weighted: 0,
      max: -Infinity,
      count: 0,
      rank: index + 1,
    }
    existing.sum += pick.score
    existing.weighted += pick.score * rankWeight
    existing.max = Math.max(existing.max, pick.score)
    existing.count++
    existing.rank = Math.min(existing.rank, index + 1)
    rows.set(pick.sutta, existing)
  }
  const bonus = options.bonus ?? {}
  for (let s = 0; s <= 9; s++) {
    const row = rows.get(s) ?? { sutta: s, sum: 0, weighted: 0, max: 0, count: 0, rank: 999 }
    const signal = getSuttaSignal(droughts[String(s)] ?? 1000).state
    const base =
      options.base === 'sum'
        ? row.sum
        : options.base === 'weighted'
          ? row.weighted / 30
          : options.base === 'count'
            ? row.count * 20 + row.max
            : row.max
    row.score = base + (bonus[signal] ?? 0) - (options.rankPenalty ?? 0) * row.rank
    rows.set(s, row)
  }
  return Array.from(rows.values()).sort((a, b) => b.score - a.score || a.rank - b.rank).slice(0, count).map((row) => row.sutta)
}

function lastSeenGaps(entries) {
  const gaps = Array(10).fill(1000)
  for (let i = entries.length - 1; i >= 0; i--) {
    const s = entries[i].sutta
    if (gaps[s] === 1000) gaps[s] = entries.length - 1 - i
  }
  return gaps
}

function relationStats(prior, allPrior, market, isoDate) {
  const open = flattenOpen(prior)
  const close = flattenClose(prior)
  const currentDate = new Date(`${isoDate}T12:00:00Z`)
  const day = DAY_NAMES[currentDate.getUTCDay()]
  const dayOfMonth = currentDate.getUTCDate()
  const stats = {
    open,
    close,
    day,
    long: Array(10).fill(0),
    recent12: Array(10).fill(0),
    recent24: Array(10).fill(0),
    recent60: Array(10).fill(0),
    weekday: Array(10).fill(0),
    prevOpenCond: Array(10).fill(0),
    prevCloseCond: Array(10).fill(0),
    prevJodiCond: Array(10).fill(0),
    crossPrevCloseCond: Array(10).fill(0),
    crossPrevOpenCond: Array(10).fill(0),
    sameDate: Array(10).fill(0),
    sameDateOpposite: Array(10).fill(0),
    sameWeekdayRecent: Array(10).fill(0),
    previousOpenHouse: null,
    previousCloseHouse: null,
    sourceOpenHouse: null,
    sourceCloseHouse: null,
    prevOpenDelta: Array(10).fill(0),
    prevCloseDelta: Array(10).fill(0),
    openGaps: lastSeenGaps(open),
    closeGaps: lastSeenGaps(close),
  }

  for (const entry of open) {
    stats.long[entry.sutta]++
    if (entry.day === day) stats.weekday[entry.sutta]++
  }
  for (const entry of open.slice(-12)) stats.recent12[entry.sutta]++
  for (const entry of open.slice(-24)) stats.recent24[entry.sutta]++
  for (const entry of open.slice(-60)) stats.recent60[entry.sutta]++

  const last = prior[prior.length - 1]
  const prevOpen = last?.openSutta
  const prevClose = last?.closeSutta
  const prevJodi = last?.jodi
  const marketIndex = MARKET_ORDER.indexOf(market)
  const sourceMarket = marketIndex > 0 ? MARKET_ORDER[marketIndex - 1] : MARKET_ORDER[MARKET_ORDER.length - 1]
  const sourceLast = sourceMarket ? allPrior[sourceMarket]?.[allPrior[sourceMarket].length - 1] : null
  const sourceOpen = sourceLast?.openSutta
  const sourceClose = sourceLast?.closeSutta

  for (let i = 1; i < prior.length; i++) {
    const row = prior[i]
    const prev = prior[i - 1]
    if (prev.openSutta === prevOpen) stats.prevOpenCond[row.openSutta]++
    if (prev.closeSutta === prevClose) stats.prevCloseCond[row.openSutta]++
    if (prev.jodi === prevJodi) stats.prevJodiCond[row.openSutta]++
    stats.prevOpenDelta[(row.openSutta - prev.openSutta + 10) % 10]++
    stats.prevCloseDelta[(row.openSutta - prev.closeSutta + 10) % 10]++
  }

  if (sourceClose !== undefined) {
    // Cheap proxy: source market's current previous close maps to this market's
    // same-index historical open. It avoids an O(n^2) date join in research runs.
    for (const row of prior.slice(-220)) {
      if (sourceClose === row.closeSutta) stats.crossPrevCloseCond[row.openSutta]++
    }
  }
  if (sourceOpen !== undefined) {
    for (const row of prior.slice(-220)) {
      if (sourceOpen === row.openSutta) stats.crossPrevOpenCond[row.openSutta]++
    }
  }

  for (const row of prior) {
    const rowIso = getRecordISODate(row)
    if (!rowIso) continue
    const rowDate = new Date(`${rowIso}T12:00:00Z`)
    if (rowDate.getUTCDate() === dayOfMonth) {
      stats.sameDate[row.openSutta]++
      stats.sameDateOpposite[opposite(row.openSutta)]++
    }
  }

  for (const row of prior.filter((record) => record.day === day).slice(-24)) {
    stats.sameWeekdayRecent[row.openSutta]++
  }

  stats.prevOpen = prevOpen
  stats.prevClose = prevClose
  stats.sourceOpen = sourceOpen
  stats.sourceClose = sourceClose
  stats.previousOpenHouse = house(prevOpen)
  stats.previousCloseHouse = house(prevClose)
  stats.sourceOpenHouse = house(sourceOpen)
  stats.sourceCloseHouse = house(sourceClose)
  return stats
}

function opposite(sutta) {
  return typeof sutta === 'number' ? (sutta + 5) % 10 : null
}

function house(sutta) {
  if (typeof sutta !== 'number') return null
  return sutta >= 1 && sutta <= 5 ? 'low' : 'high'
}

function houseScore(sutta, targetHouse) {
  return house(sutta) === targetHouse ? 1 : 0
}

function rate(count, total) {
  return (count + 1) / (total + 10)
}

function scoreStats(stats, weights) {
  const totalOpen = Math.max(1, stats.open.length)
  const dayTotal = Math.max(0, stats.open.filter((entry) => entry.day === stats.day).length)
  const prevOpenTotal = stats.prevOpenCond.reduce((a, b) => a + b, 0)
  const prevCloseTotal = stats.prevCloseCond.reduce((a, b) => a + b, 0)
  const prevJodiTotal = stats.prevJodiCond.reduce((a, b) => a + b, 0)
  const crossTotal = stats.crossPrevCloseCond.reduce((a, b) => a + b, 0)
  const crossOpenTotal = stats.crossPrevOpenCond.reduce((a, b) => a + b, 0)
  const sameDateTotal = stats.sameDate.reduce((a, b) => a + b, 0)
  const sameDateOppTotal = stats.sameDateOpposite.reduce((a, b) => a + b, 0)
  const sameWeekdayRecentTotal = stats.sameWeekdayRecent.reduce((a, b) => a + b, 0)
  const rows = []
  for (let s = 0; s <= 9; s++) {
    const openGap = stats.openGaps[s]
    const closeGap = stats.closeGaps[s]
    const prevOpenDelta = stats.prevOpen === undefined ? 0.1 : rate(stats.prevOpenDelta[(s - stats.prevOpen + 10) % 10], Math.max(1, stats.open.length - 1))
    const prevCloseDelta = stats.prevClose === undefined ? 0.1 : rate(stats.prevCloseDelta[(s - stats.prevClose + 10) % 10], Math.max(1, stats.open.length - 1))
    const droughtBand =
      openGap <= 2
        ? (weights.veryFresh ?? 0)
        : openGap <= 5
          ? (weights.fresh ?? 0)
          : openGap <= 12
            ? (weights.warming ?? 0)
            : openGap <= 25
              ? (weights.mid ?? 0)
              : (weights.longGap ?? 0)
    rows.push({
      sutta: s,
      score:
        (weights.long ?? 0) * rate(stats.long[s], totalOpen) +
        (weights.recent12 ?? 0) * rate(stats.recent12[s], Math.min(12, totalOpen)) +
        (weights.recent24 ?? 0) * rate(stats.recent24[s], Math.min(24, totalOpen)) +
        (weights.recent60 ?? 0) * rate(stats.recent60[s], Math.min(60, totalOpen)) +
        (weights.weekday ?? 0) * rate(stats.weekday[s], dayTotal) +
        (weights.prevOpen ?? 0) * rate(stats.prevOpenCond[s], prevOpenTotal) +
        (weights.prevClose ?? 0) * rate(stats.prevCloseCond[s], prevCloseTotal) +
        (weights.prevJodi ?? 0) * rate(stats.prevJodiCond[s], prevJodiTotal) +
        (weights.crossClose ?? 0) * rate(stats.crossPrevCloseCond[s], crossTotal) +
        (weights.crossOpen ?? 0) * rate(stats.crossPrevOpenCond[s], crossOpenTotal) +
        (weights.sameDate ?? 0) * rate(stats.sameDate[s], sameDateTotal) +
        (weights.sameDateOpposite ?? 0) * rate(stats.sameDateOpposite[s], sameDateOppTotal) +
        (weights.sameWeekdayRecent ?? 0) * rate(stats.sameWeekdayRecent[s], sameWeekdayRecentTotal) +
        (weights.prevOpenDelta ?? 0) * prevOpenDelta +
        (weights.prevCloseDelta ?? 0) * prevCloseDelta +
        (weights.prevOpenOpposite ?? 0) * (opposite(stats.prevOpen) === s ? 1 : 0) +
        (weights.prevCloseOpposite ?? 0) * (opposite(stats.prevClose) === s ? 1 : 0) +
        (weights.sourceOpenOpposite ?? 0) * (opposite(stats.sourceOpen) === s ? 1 : 0) +
        (weights.sourceCloseOpposite ?? 0) * (opposite(stats.sourceClose) === s ? 1 : 0) +
        (weights.prevOpenSameHouse ?? 0) * houseScore(s, stats.previousOpenHouse) +
        (weights.prevOpenOppHouse ?? 0) * houseScore(s, stats.previousOpenHouse === 'low' ? 'high' : stats.previousOpenHouse === 'high' ? 'low' : null) +
        (weights.prevCloseSameHouse ?? 0) * houseScore(s, stats.previousCloseHouse) +
        (weights.prevCloseOppHouse ?? 0) * houseScore(s, stats.previousCloseHouse === 'low' ? 'high' : stats.previousCloseHouse === 'high' ? 'low' : null) +
        (weights.sourceOpenSameHouse ?? 0) * houseScore(s, stats.sourceOpenHouse) +
        (weights.sourceOpenOppHouse ?? 0) * houseScore(s, stats.sourceOpenHouse === 'low' ? 'high' : stats.sourceOpenHouse === 'high' ? 'low' : null) +
        (weights.openGapInverse ?? 0) / (openGap + 1) +
        (weights.closeGapInverse ?? 0) / (closeGap + 1) +
        droughtBand,
    })
  }
  return rows.sort((a, b) => b.score - a.score)
}

function merge(count, ...lists) {
  const out = []
  for (const list of lists) {
    for (const s of list) {
      if (out.length >= count) return out
      if (!out.includes(s)) out.push(s)
    }
  }
  return out
}

const STAT_VARIANTS = {
  freq_long_recent_day: { long: 0.12, recent24: 0.36, recent60: 0.22, weekday: 0.3 },
  freq_day_heavy: { long: 0.08, recent24: 0.18, recent60: 0.14, weekday: 0.6 },
  freq_recent_only: { recent12: 0.28, recent24: 0.42, recent60: 0.3 },
  markov_prev_open: { recent24: 0.15, recent60: 0.15, prevOpen: 0.7 },
  markov_prev_close: { recent24: 0.15, recent60: 0.15, prevClose: 0.7 },
  markov_prev_jodi: { recent24: 0.2, recent60: 0.15, prevJodi: 0.65 },
  delta_prev_open: { recent24: 0.25, weekday: 0.2, prevOpenDelta: 0.55 },
  delta_prev_close: { recent24: 0.25, weekday: 0.2, prevCloseDelta: 0.55 },
  cross_source_close: { recent24: 0.22, weekday: 0.18, crossClose: 0.6 },
  cross_source_open: { recent24: 0.2, weekday: 0.15, crossOpen: 0.65 },
  gap_snapback: { recent24: 0.18, weekday: 0.16, longGap: 0.12, mid: 0.04, veryFresh: -0.08 },
  gap_fresh: { recent24: 0.2, weekday: 0.15, veryFresh: 0.1, fresh: 0.06, longGap: -0.06 },
  gap_balanced: { recent24: 0.18, recent60: 0.18, weekday: 0.2, warming: 0.05, mid: 0.06 },
  close_echo: { recent24: 0.2, weekday: 0.18, closeGapInverse: 0.12, prevClose: 0.5 },
  opposite_prev_open: { recent24: 0.2, weekday: 0.15, prevOpenOpposite: 0.65 },
  opposite_prev_close: { recent24: 0.2, weekday: 0.15, prevCloseOpposite: 0.65 },
  opposite_source_open: { recent24: 0.2, weekday: 0.15, sourceOpenOpposite: 0.65 },
  opposite_source_close: { recent24: 0.2, weekday: 0.15, sourceCloseOpposite: 0.65 },
  house_prev_open_same: { recent24: 0.24, weekday: 0.16, prevOpenSameHouse: 0.6 },
  house_prev_open_flip: { recent24: 0.24, weekday: 0.16, prevOpenOppHouse: 0.6 },
  house_prev_close_same: { recent24: 0.24, weekday: 0.16, prevCloseSameHouse: 0.6 },
  house_prev_close_flip: { recent24: 0.24, weekday: 0.16, prevCloseOppHouse: 0.6 },
  house_source_open_same: { recent24: 0.24, weekday: 0.16, sourceOpenSameHouse: 0.6 },
  house_source_open_flip: { recent24: 0.24, weekday: 0.16, sourceOpenOppHouse: 0.6 },
  calendar_same_date: { recent24: 0.18, weekday: 0.12, sameDate: 0.7 },
  calendar_same_date_opposite: { recent24: 0.18, weekday: 0.12, sameDateOpposite: 0.7 },
  calendar_same_weekday_recent: { recent24: 0.2, sameWeekdayRecent: 0.8 },
}

function makeVariantFns() {
  const variants = {
    current: ({ prediction, count }) => currentUi(prediction.openPicks, prediction.openSuttaDroughts, count),
    rank_only: ({ prediction, count }) => uniqueByPickRank(prediction.openPicks).slice(0, count).map((row) => row.sutta),
    pick_sum_cooling: ({ prediction, count }) =>
      pickAggregate(prediction.openPicks, prediction.openSuttaDroughts, count, {
        base: 'sum',
        bonus: { fresh: 8, warming: 5, cooling: 12, snapback: 8 },
      }),
    pick_weighted_fresh: ({ prediction, count }) =>
      pickAggregate(prediction.openPicks, prediction.openSuttaDroughts, count, {
        base: 'weighted',
        bonus: { fresh: 20, warming: 8, danger: -8, cooling: -4, snapback: 6 },
      }),
    pick_weighted_snap: ({ prediction, count }) =>
      pickAggregate(prediction.openPicks, prediction.openSuttaDroughts, count, {
        base: 'weighted',
        bonus: { fresh: 8, warming: 5, danger: -4, snapback: 22 },
      }),
  }
  for (const [name, weights] of Object.entries(STAT_VARIANTS)) {
    variants[name] = ({ stats, count }) => scoreStats(stats, weights).slice(0, count).map((row) => row.sutta)
  }
  variants.hybrid_current_day = (ctx) => merge(ctx.count, variants.current(ctx), variants.freq_day_heavy(ctx), variants.rank_only(ctx))
  variants.hybrid_current_markov = (ctx) => merge(ctx.count, variants.current(ctx), variants.markov_prev_open(ctx), variants.delta_prev_open(ctx))
  variants.hybrid_stats_first = (ctx) => merge(ctx.count, variants.freq_long_recent_day(ctx), variants.current(ctx), variants.markov_prev_close(ctx))
  variants.hybrid_gap_current = (ctx) => merge(ctx.count, variants.gap_balanced(ctx), variants.current(ctx), variants.freq_day_heavy(ctx))
  variants.production_open = (ctx) => (ctx.count >= 5 ? variants.delta_prev_open(ctx) : variants.current(ctx))
  variants.production_guarded = (ctx) => {
    const deltaRegressedLatest = new Set(['Sridevi', 'Rajdhani Day', 'Milan Night'])
    if (ctx.count >= 5 && !deltaRegressedLatest.has(ctx.market)) return variants.delta_prev_open(ctx)
    return variants.current(ctx)
  }
  variants.calendar_guarded = (ctx) => {
    const sameDateRegressedLatest = new Set(['Sridevi', 'Kalyan', 'Kalyan Night', 'Rajdhani Night'])
    if (ctx.count <= 4 && !sameDateRegressedLatest.has(ctx.market)) return variants.calendar_same_date(ctx)
    if (ctx.count >= 5 && !sameDateRegressedLatest.has(ctx.market)) return variants.calendar_same_date(ctx)
    return variants.current(ctx)
  }
  variants.hybrid_calendar_delta_guarded = (ctx) => {
    const sameDateRegressedLatest = new Set(['Sridevi', 'Kalyan', 'Kalyan Night', 'Rajdhani Night'])
    const deltaRegressedLatest = new Set(['Sridevi', 'Rajdhani Day', 'Milan Night'])
    if (ctx.count <= 4 && !sameDateRegressedLatest.has(ctx.market)) return variants.calendar_same_date(ctx)
    if (ctx.count >= 5 && !deltaRegressedLatest.has(ctx.market)) return variants.delta_prev_open(ctx)
    return variants.current(ctx)
  }
  return variants
}

function emptyMetrics() {
  const metrics = {}
  for (const count of COUNTS) metrics[count] = { n: 0, hit: 0 }
  return metrics
}

function add(metrics, count, ok) {
  metrics[count].n++
  if (ok) metrics[count].hit++
}

function initMetrics(names) {
  return Object.fromEntries(names.map((name) => [name, emptyMetrics()]))
}

function rowsFor(metrics, count) {
  return Object.entries(metrics)
    .map(([variant, m]) => ({
      variant,
      n: m[count].n,
      hit: fmt(pct(m[count].hit, m[count].n)),
    }))
    .sort((a, b) => b.hit - a.hit)
}

async function buildCases(days, offset = 0) {
  const allRecords = await fetchAll()
  const allDated = Object.fromEntries(Object.entries(allRecords).map(([market, records]) => [market, dated(records)]))
  const casesByMarket = {}

  for (const [market, records] of Object.entries(allDated)) {
    const newest = records[records.length - 1].isoDate
    const end = new Date(`${newest}T00:00:00Z`)
    end.setUTCDate(end.getUTCDate() - offset)
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - days + 1)
    const endIso = end.toISOString().slice(0, 10)
    const startIso = start.toISOString().slice(0, 10)
    casesByMarket[market] = []

    for (let i = 0; i < records.length; i++) {
      const { record, isoDate } = records[i]
      if (isoDate < startIso || isoDate > endIso) continue
      const prior = records.slice(0, i).filter((row) => row.isoDate < isoDate).map((row) => row.record)
      if (prior.length < MIN_TRAINING) continue
      const priorAll = {}
      for (const [otherMarket, otherRecords] of Object.entries(allDated)) {
        priorAll[otherMarket] = otherRecords.filter((row) => row.isoDate < isoDate).map((row) => row.record)
      }
      priorAll[market] = prior
      const prediction = analyzeMarket(market, prior, priorAll, new Date(`${isoDate}T12:00:00Z`))
      if (!prediction) continue
      casesByMarket[market].push({
        market,
        isoDate,
        actual: record.openSutta,
        prediction,
        stats: relationStats(prior, priorAll, market, isoDate),
      })
    }
  }
  return casesByMarket
}

function evaluate(casesByMarket, variants) {
  const global = initMetrics(Object.keys(variants))
  const perMarket = {}
  for (const [market, cases] of Object.entries(casesByMarket)) {
    perMarket[market] = initMetrics(Object.keys(variants))
    for (const ctxBase of cases) {
      for (const count of COUNTS) {
        for (const [name, fn] of Object.entries(variants)) {
          const picks = fn({ ...ctxBase, count })
          const ok = picks.includes(ctxBase.actual)
          add(global[name], count, ok)
          add(perMarket[market][name], count, ok)
        }
      }
    }
  }
  return { global, perMarket }
}

function bestVariant(metrics, count, minN = 1) {
  return rowsFor(metrics, count).filter((row) => row.n >= minN)[0]
}

function printTable(title, rows) {
  console.log(`\n${title}`)
  console.table(rows)
}

async function main() {
  const testDays = Number.parseInt(process.argv[2] || '30', 10)
  const variants = makeVariantFns()
  const testCases = await buildCases(testDays, 0)
  const trainCases = await buildCases(testDays, testDays)
  const test = evaluate(testCases, variants)
  const train = evaluate(trainCases, variants)

  console.log(`OPEN SUTTA RESEARCH - train previous ${testDays} days, test latest ${testDays} days`)

  for (const count of [3, 4, 6]) {
    printTable(`Global latest-window best @${count}`, rowsFor(test.global, count).slice(0, 12))
  }

  const selectedByMarket = {}
  for (const market of MARKET_ORDER) {
    selectedByMarket[market] = {
      top4: bestVariant(train.perMarket[market], 4)?.variant ?? 'current',
      top6: bestVariant(train.perMarket[market], 6)?.variant ?? 'current',
    }
  }

  const selectedMetrics = { 4: { n: 0, hit: 0 }, 6: { n: 0, hit: 0 } }
  const currentMetrics = { 4: { n: 0, hit: 0 }, 6: { n: 0, hit: 0 } }
  const perMarketRows = []

  for (const market of MARKET_ORDER) {
    const current4 = test.perMarket[market].current[4]
    const current6 = test.perMarket[market].current[6]
    const sel4Name = selectedByMarket[market].top4
    const sel6Name = selectedByMarket[market].top6
    const sel4 = test.perMarket[market][sel4Name][4]
    const sel6 = test.perMarket[market][sel6Name][6]

    currentMetrics[4].n += current4.n
    currentMetrics[4].hit += current4.hit
    currentMetrics[6].n += current6.n
    currentMetrics[6].hit += current6.hit
    selectedMetrics[4].n += sel4.n
    selectedMetrics[4].hit += sel4.hit
    selectedMetrics[6].n += sel6.n
    selectedMetrics[6].hit += sel6.hit

    perMarketRows.push({
      market,
      n: current4.n,
      current4: fmt(pct(current4.hit, current4.n)),
      selected4: fmt(pct(sel4.hit, sel4.n)),
      selected4Model: sel4Name,
      current6: fmt(pct(current6.hit, current6.n)),
      selected6: fmt(pct(sel6.hit, sel6.n)),
      selected6Model: sel6Name,
      bestLatest4: bestVariant(test.perMarket[market], 4)?.variant,
      bestLatest4Pct: bestVariant(test.perMarket[market], 4)?.hit,
      bestLatest6: bestVariant(test.perMarket[market], 6)?.variant,
      bestLatest6Pct: bestVariant(test.perMarket[market], 6)?.hit,
    })
  }

  printTable('Market strategies selected by previous-window validation, tested on latest window', perMarketRows)
  printTable('Global current vs previous-window selected', [
    {
      target: 'Open@4',
      current: fmt(pct(currentMetrics[4].hit, currentMetrics[4].n)),
      selected: fmt(pct(selectedMetrics[4].hit, selectedMetrics[4].n)),
      n: currentMetrics[4].n,
    },
    {
      target: 'Open@6',
      current: fmt(pct(currentMetrics[6].hit, currentMetrics[6].n)),
      selected: fmt(pct(selectedMetrics[6].hit, selectedMetrics[6].n)),
      n: currentMetrics[6].n,
    },
  ])

  printTable('Current vs production open model by market', MARKET_ORDER.map((market) => {
    const current4 = test.perMarket[market].current[4]
    const current6 = test.perMarket[market].current[6]
    const production4 = test.perMarket[market].production_open[4]
    const production6 = test.perMarket[market].production_open[6]
    return {
      market,
      n: current4.n,
      current4: fmt(pct(current4.hit, current4.n)),
      production4: fmt(pct(production4.hit, production4.n)),
      delta4: fmt(pct(production4.hit, production4.n) - pct(current4.hit, current4.n)),
      current6: fmt(pct(current6.hit, current6.n)),
      production6: fmt(pct(production6.hit, production6.n)),
      delta6: fmt(pct(production6.hit, production6.n) - pct(current6.hit, current6.n)),
    }
  }))

  printTable('Current vs guarded candidates by market', MARKET_ORDER.map((market) => {
    const current4 = test.perMarket[market].current[4]
    const current6 = test.perMarket[market].current[6]
    const calendar4 = test.perMarket[market].calendar_same_date[4]
    const delta6 = test.perMarket[market].delta_prev_open[6]
    const guarded4 = test.perMarket[market].hybrid_calendar_delta_guarded[4]
    const guarded6 = test.perMarket[market].hybrid_calendar_delta_guarded[6]
    return {
      market,
      n: current4.n,
      current4: fmt(pct(current4.hit, current4.n)),
      calendar4: fmt(pct(calendar4.hit, calendar4.n)),
      guarded4: fmt(pct(guarded4.hit, guarded4.n)),
      current6: fmt(pct(current6.hit, current6.n)),
      delta6: fmt(pct(delta6.hit, delta6.n)),
      guarded6: fmt(pct(guarded6.hit, guarded6.n)),
    }
  }))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
