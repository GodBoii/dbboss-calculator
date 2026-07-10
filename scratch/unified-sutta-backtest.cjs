/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')
const Module = require('module')
const ts = require('typescript')

const originalResolve = Module._resolveFilename
Module._resolveFilename = function resolveAlias(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    return originalResolve.call(this, path.join(process.cwd(), 'src', request.slice(2)), parent, isMain, options)
  }
  return originalResolve.call(this, request, parent, isMain, options)
}

for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = function registerTs(module, filename) {
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

const { analyzeMarket, getSuttaSignal, LIQUIDITY_FLOW_MAP } = require('../src/lib/predictor.ts')
const { getRecordISODate } = require('../src/lib/backtest.ts')
const { buildOpenSuttaSet, buildCloseSuttaSet } = require('../src/components/analysis/AnalysisTabs.tsx')

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
const COUNTS = [2, 4, 5, 6, 8]
const CACHE = 'scratch/open-sutta-records-cache.json'
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const oldOpenMap = {
  Sridevi: { narrow: 'current', wide: 'current' },
  'Time Bazar': { narrow: 'sameDate', wide: 'sameDate' },
  'Madhur Day': { narrow: 'gapBalanced', wide: 'gapBalanced' },
  'Milan Day': { narrow: 'gapSnapback', wide: 'housePrevOpenFlip' },
  'Rajdhani Day': { narrow: 'sameDate', wide: 'sameDate' },
  Kalyan: { narrow: 'rankOnly', wide: 'rankOnly' },
  'Sridevi Night': { narrow: 'sameDate', wide: 'sameDate' },
  'Kalyan Night': { narrow: 'current', wide: 'weightedSnap' },
  'Madhur Night': { narrow: 'housePrevOpenSame', wide: 'sameDateOpposite' },
  'Milan Night': { narrow: 'sameDate', wide: 'sameDateOpposite' },
  'Rajdhani Night': { narrow: 'gapBalanced', wide: 'gapBalanced' },
  'Main Bazar': { narrow: 'housePrevOpenSame', wide: 'housePrevOpenSame' },
}

const oldCloseMap = {
  Sridevi: { narrow: 'currentOpenOppHouse', wide: 'calendarSameDateOpposite' },
  'Time Bazar': { narrow: 'prevJodiCond', wide: 'prevJodiCond' },
  'Madhur Day': { narrow: 'prevOpenCond', wide: 'prevOpenCond' },
  'Milan Day': { narrow: 'currentProduction', wide: 'sumCooling' },
  'Rajdhani Day': { narrow: 'sourcePrevOpenCond', wide: 'currentOpenSameHouse' },
  Kalyan: { narrow: 'calendarSameDate', wide: 'prevCloseCond' },
  'Sridevi Night': { narrow: 'currentProduction', wide: 'currentUi' },
  'Kalyan Night': { narrow: 'currentOpenOppHouse', wide: 'currentOpenCond' },
  'Madhur Night': { narrow: 'rankOnly', wide: 'prevCloseDelta' },
  'Milan Night': { narrow: 'calendarSameDateOpposite', wide: 'currentProduction' },
  'Rajdhani Night': { narrow: 'rankOnly', wide: 'rankOnly' },
  'Main Bazar': { narrow: 'currentProduction', wide: 'sumCooling' },
}

function pct(hit, n) {
  return n ? (hit / n) * 100 : 0
}

function fmt(hit, n) {
  return `${pct(hit, n).toFixed(1)}% (${hit}/${n})`
}

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((row) => row.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

function smoothedRate(count, total) {
  return (count + 1) / (total + 10)
}

function oppositeSutta(sutta) {
  return (sutta + 5) % 10
}

function suttaHouse(sutta) {
  if (sutta === undefined || sutta === null) return null
  return sutta >= 1 && sutta <= 5 ? 'low' : 'high'
}

function houseScore(sutta, targetHouse) {
  return targetHouse !== null && suttaHouse(sutta) === targetHouse ? 1 : 0
}

const signalPriority = { fresh: 0, snapback: 1, warming: 2, cooling: 3, danger: 4, unknown: 5 }

function makePick(sutta, score, rank, droughts) {
  const signal = getSuttaSignal(droughts[String(sutta)] ?? 1000)
  return { sutta, score, rank, signalState: signal.state }
}

function finalize(rows, droughts, count) {
  return rows
    .map((row, index) => makePick(row.sutta, row.score, row.rank ?? index + 1, droughts))
    .sort((a, b) => signalPriority[a.signalState] - signalPriority[b.signalState] || b.score - a.score || a.rank - b.rank || a.sutta - b.sutta)
    .slice(0, count)
    .map((row) => row.sutta)
}

function aggregate(picks, droughts, count, mode) {
  const bySutta = new Map()
  picks.forEach((pick, index) => {
    const existing = bySutta.get(pick.sutta) ?? { sutta: pick.sutta, score: 0, rank: index + 1 }
    const rankWeight = Math.max(1, 31 - index)
    existing.score += mode === 'weightedAggregate' || mode === 'weightedSnap' ? pick.score * rankWeight : pick.score
    existing.rank = Math.min(existing.rank, index + 1)
    bySutta.set(pick.sutta, existing)
  })
  for (let sutta = 0; sutta <= 9; sutta++) {
    if (!bySutta.has(sutta)) bySutta.set(sutta, { sutta, score: 0, rank: 999 })
  }
  const bonus =
    mode === 'weightedAggregate'
      ? { fresh: 20, warming: 8, danger: -8, cooling: -4, snapback: 6, unknown: 0 }
      : mode === 'weightedSnap'
        ? { fresh: 8, warming: 5, danger: -4, cooling: 0, snapback: 22, unknown: 0 }
        : mode === 'aggregate'
          ? { fresh: 8, warming: 5, danger: 0, cooling: 12, snapback: 8, unknown: 0 }
          : { fresh: 0, warming: 0, danger: 0, cooling: 0, snapback: 0, unknown: 0 }
  const rows = Array.from(bySutta.values()).map((row) => ({
    ...row,
    score: row.score + bonus[getSuttaSignal(droughts[String(row.sutta)] ?? 1000).state],
  }))
  return finalize(rows, droughts, count)
}

function rankOnly(picks, droughts, count) {
  const seen = new Set()
  const rows = []
  picks.forEach((pick, index) => {
    if (seen.has(pick.sutta)) return
    seen.add(pick.sutta)
    rows.push({ sutta: pick.sutta, score: pick.score, rank: index + 1 })
  })
  return finalize(rows, droughts, count)
}

function openRows(strategy, records, droughts, isoDate) {
  const openRecords = records.filter((record) => record.openPanel && record.openSutta >= 0)
  const date = new Date(`${isoDate}T12:00:00Z`)
  const todayDayName = DAY_NAMES[date.getUTCDay()]
  const dayOfMonth = date.getUTCDate()
  const recent24 = Array(10).fill(0)
  const recent60 = Array(10).fill(0)
  const weekday = Array(10).fill(0)
  const sameDate = Array(10).fill(0)
  const sameDateOpposite = Array(10).fill(0)
  const prevOpenDelta = Array(10).fill(0)
  let weekdayTotal = 0
  let sameDateTotal = 0
  for (const record of openRecords) if (record.day === todayDayName) { weekday[record.openSutta]++; weekdayTotal++ }
  for (const record of openRecords.slice(-24)) recent24[record.openSutta]++
  for (const record of openRecords.slice(-60)) recent60[record.openSutta]++
  for (const record of openRecords) {
    const recordIso = getRecordISODate(record)
    if (recordIso && new Date(`${recordIso}T12:00:00Z`).getUTCDate() === dayOfMonth) {
      sameDate[record.openSutta]++
      sameDateOpposite[oppositeSutta(record.openSutta)]++
      sameDateTotal++
    }
  }
  for (let i = 1; i < openRecords.length; i++) {
    prevOpenDelta[(openRecords[i].openSutta - openRecords[i - 1].openSutta + 10) % 10]++
  }
  const total = openRecords.length
  const previousOpen = openRecords[openRecords.length - 1]?.openSutta
  const previousOpenHouse = suttaHouse(previousOpen)
  const previousOpenFlipHouse = previousOpenHouse === 'low' ? 'high' : previousOpenHouse === 'high' ? 'low' : null
  return Array.from({ length: 10 }, (_, sutta) => {
    const delta = (sutta - previousOpen + 10) % 10
    const openGap = droughts[String(sutta)] ?? 1000
    const gapBalancedBonus = openGap <= 2 ? 0 : openGap <= 5 ? 0 : openGap <= 12 ? 0.05 : openGap <= 25 ? 0.06 : 0
    const gapSnapbackBonus = openGap <= 2 ? -0.08 : openGap <= 5 ? 0 : openGap <= 12 ? 0 : openGap <= 25 ? 0.04 : 0.12
    let score = 0
    if (strategy === 'sameDate') {
      score = 0.18 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.12 * smoothedRate(weekday[sutta], weekdayTotal) + 0.7 * smoothedRate(sameDate[sutta], sameDateTotal)
    } else if (strategy === 'sameDateOpposite') {
      score = 0.18 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.12 * smoothedRate(weekday[sutta], weekdayTotal) + 0.7 * smoothedRate(sameDateOpposite[sutta], sameDateTotal)
    } else if (strategy === 'gapBalanced') {
      score = 0.18 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.18 * smoothedRate(recent60[sutta], Math.min(60, total)) + 0.2 * smoothedRate(weekday[sutta], weekdayTotal) + gapBalancedBonus
    } else if (strategy === 'gapSnapback') {
      score = 0.18 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.16 * smoothedRate(weekday[sutta], weekdayTotal) + gapSnapbackBonus
    } else if (strategy === 'housePrevOpenSame') {
      score = 0.24 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.16 * smoothedRate(weekday[sutta], weekdayTotal) + 0.6 * houseScore(sutta, previousOpenHouse)
    } else if (strategy === 'housePrevOpenFlip') {
      score = 0.24 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.16 * smoothedRate(weekday[sutta], weekdayTotal) + 0.6 * houseScore(sutta, previousOpenFlipHouse)
    } else {
      score = 0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.2 * smoothedRate(weekday[sutta], weekdayTotal) + 0.55 * smoothedRate(prevOpenDelta[delta], Math.max(1, total - 1))
    }
    return { sutta, score: score * 100 }
  })
}

function oldOpen(prediction, records, count, market, isoDate) {
  const strategy = oldOpenMap[market]?.[count <= 4 ? 'narrow' : 'wide'] ?? 'current'
  if (strategy === 'current') return aggregate(prediction.openPicks, prediction.openSuttaDroughts, count, 'current')
  if (strategy === 'rankOnly') return rankOnly(prediction.openPicks, prediction.openSuttaDroughts, count)
  if (strategy === 'weightedSnap') return aggregate(prediction.openPicks, prediction.openSuttaDroughts, count, 'weightedSnap')
  return finalize(openRows(strategy, records, prediction.openSuttaDroughts, isoDate), prediction.openSuttaDroughts, count)
}

function closeRows(strategy, records, allPrior, market, droughts, isoDate, currentOpenSutta) {
  const closeRecords = records.filter((record) => record.closePanel && record.closeSutta >= 0)
  const date = new Date(`${isoDate}T12:00:00Z`)
  const todayDayName = DAY_NAMES[date.getUTCDay()]
  const dayOfMonth = date.getUTCDate()
  const recent24 = Array(10).fill(0)
  const weekday = Array(10).fill(0)
  const sameDate = Array(10).fill(0)
  const sameDateOpposite = Array(10).fill(0)
  const prevCloseCond = Array(10).fill(0)
  const prevOpenCond = Array(10).fill(0)
  const prevJodiCond = Array(10).fill(0)
  const currentOpenCond = Array(10).fill(0)
  const prevCloseDelta = Array(10).fill(0)
  const sourcePrevOpenCond = Array(10).fill(0)
  let weekdayTotal = 0
  let sameDateTotal = 0
  let prevCloseCondTotal = 0
  let prevOpenCondTotal = 0
  let prevJodiCondTotal = 0
  let currentOpenCondTotal = 0
  let sourcePrevOpenCondTotal = 0
  for (const record of closeRecords.slice(-24)) recent24[record.closeSutta]++
  for (const record of closeRecords) {
    if (record.day === todayDayName) { weekday[record.closeSutta]++; weekdayTotal++ }
    const recordIso = getRecordISODate(record)
    if (recordIso && new Date(`${recordIso}T12:00:00Z`).getUTCDate() === dayOfMonth) {
      sameDate[record.closeSutta]++
      sameDateOpposite[oppositeSutta(record.closeSutta)]++
      sameDateTotal++
    }
  }
  const previousRecord = records[records.length - 1]
  const previousClose = previousRecord?.closeSutta ?? 0
  const previousOpen = previousRecord?.openSutta
  const previousJodi = previousRecord?.jodi
  const sourceMarket = LIQUIDITY_FLOW_MAP[market]
  const sourceRecords = sourceMarket ? allPrior[sourceMarket] ?? [] : []
  const sourcePreviousOpen = sourceRecords[sourceRecords.length - 1]?.openSutta
  for (let i = 1; i < records.length; i++) {
    const previous = records[i - 1]
    const current = records[i]
    if (current.closeSutta < 0) continue
    if (previous.closeSutta === previousClose) { prevCloseCond[current.closeSutta]++; prevCloseCondTotal++ }
    if (previous.openSutta === previousOpen) { prevOpenCond[current.closeSutta]++; prevOpenCondTotal++ }
    if (previous.jodi === previousJodi) { prevJodiCond[current.closeSutta]++; prevJodiCondTotal++ }
    if (current.openSutta === currentOpenSutta) { currentOpenCond[current.closeSutta]++; currentOpenCondTotal++ }
    if (previous.closeSutta >= 0) prevCloseDelta[(current.closeSutta - previous.closeSutta + 10) % 10]++
    if (sourcePreviousOpen !== undefined && current.openSutta === sourcePreviousOpen) { sourcePrevOpenCond[current.closeSutta]++; sourcePrevOpenCondTotal++ }
  }
  const total = closeRecords.length
  return Array.from({ length: 10 }, (_, sutta) => {
    let score = 0
    if (strategy === 'calendarSameDate') score = 0.2 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.1 * smoothedRate(weekday[sutta], weekdayTotal) + 0.7 * smoothedRate(sameDate[sutta], sameDateTotal)
    else if (strategy === 'calendarSameDateOpposite') score = 0.2 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.8 * smoothedRate(sameDateOpposite[sutta], sameDateTotal)
    else if (strategy === 'prevCloseCond') score = 0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.15 * smoothedRate(weekday[sutta], weekdayTotal) + 0.6 * smoothedRate(prevCloseCond[sutta], prevCloseCondTotal)
    else if (strategy === 'prevOpenCond') score = 0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.15 * smoothedRate(weekday[sutta], weekdayTotal) + 0.6 * smoothedRate(prevOpenCond[sutta], prevOpenCondTotal)
    else if (strategy === 'prevJodiCond') score = 0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.75 * smoothedRate(prevJodiCond[sutta], prevJodiCondTotal)
    else if (strategy === 'currentOpenCond') score = 0.2 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.1 * smoothedRate(weekday[sutta], weekdayTotal) + 0.7 * smoothedRate(currentOpenCond[sutta], currentOpenCondTotal)
    else if (strategy === 'currentOpenOppHouse') score = 0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.75 * (suttaHouse(sutta) !== suttaHouse(currentOpenSutta) ? 1 : 0)
    else if (strategy === 'currentOpenSameHouse') score = 0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.75 * houseScore(sutta, suttaHouse(currentOpenSutta))
    else if (strategy === 'prevCloseDelta') {
      const delta = (sutta - previousClose + 10) % 10
      score = 0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.2 * smoothedRate(weekday[sutta], weekdayTotal) + 0.55 * smoothedRate(prevCloseDelta[delta], Math.max(1, total - 1))
    } else if (strategy === 'sourcePrevOpenCond') score = 0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) + 0.15 * smoothedRate(weekday[sutta], weekdayTotal) + 0.6 * smoothedRate(sourcePrevOpenCond[sutta], sourcePrevOpenCondTotal)
    return { sutta, score: score * 100 }
  })
}

function oldClose(prediction, records, allPrior, count, market, isoDate, currentOpenSutta) {
  const strategy = oldCloseMap[market]?.[count <= 4 ? 'narrow' : 'wide'] ?? 'currentProduction'
  if (strategy === 'currentProduction') return aggregate(prediction.closePicks, prediction.closeSuttaDroughts, count, count <= 4 ? 'aggregate' : 'weightedAggregate')
  if (strategy === 'sumCooling') return aggregate(prediction.closePicks, prediction.closeSuttaDroughts, count, 'aggregate')
  if (strategy === 'currentUi') return aggregate(prediction.closePicks, prediction.closeSuttaDroughts, count, 'current')
  if (strategy === 'rankOnly') return rankOnly(prediction.closePicks, prediction.closeSuttaDroughts, count)
  return finalize(closeRows(strategy, records, allPrior, market, prediction.closeSuttaDroughts, isoDate, currentOpenSutta), prediction.closeSuttaDroughts, count)
}

async function run(days = 30) {
  const all = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  const datedByMarket = Object.fromEntries(Object.entries(all).map(([market, records]) => [market, dated(records)]))
  const metrics = {}
  for (const key of ['oldOpen', 'newOpen', 'oldClose', 'newClose']) {
    metrics[key] = Object.fromEntries(COUNTS.map((count) => [count, { hit: 0, n: 0 }]))
  }
  const perMarket = {}
  for (const market of MARKET_ORDER) {
    perMarket[market] = {}
    for (const key of ['oldOpen', 'newOpen', 'oldClose', 'newClose']) {
      perMarket[market][key] = Object.fromEntries(COUNTS.map((count) => [count, { hit: 0, n: 0 }]))
    }
    const rows = datedByMarket[market]
    const cutoffs = new Set(rows.slice(-days).map((row) => row.isoDate))
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!cutoffs.has(row.isoDate)) continue
      const priorRows = rows.slice(0, i)
      if (priorRows.length < 50) continue
      const prior = priorRows.map((item) => item.record)
      const allPrior = {}
      for (const otherMarket of MARKET_ORDER) {
        allPrior[otherMarket] = datedByMarket[otherMarket].filter((item) => item.isoDate < row.isoDate).map((item) => item.record)
      }
      allPrior[market] = prior
      const prediction = analyzeMarket(market, prior, allPrior, new Date(`${row.isoDate}T12:00:00Z`))
      if (!prediction) continue
      for (const count of COUNTS) {
        const cases = [
          ['oldOpen', oldOpen(prediction, prior, count, market, row.isoDate), row.record.openSutta],
          ['newOpen', buildOpenSuttaSet(prediction.openPicks, prediction.openSuttaDroughts, prior, count, market, new Date(`${row.isoDate}T12:00:00Z`)).map((pick) => pick.sutta), row.record.openSutta],
          ['oldClose', oldClose(prediction, prior, allPrior, count, market, row.isoDate, row.record.openSutta), row.record.closeSutta],
          ['newClose', buildCloseSuttaSet(prediction.closePicks, prediction.closeSuttaDroughts, prior, count, market, row.record.openSutta, allPrior, new Date(`${row.isoDate}T12:00:00Z`)).map((pick) => pick.sutta), row.record.closeSutta],
        ]
        for (const [key, picks, actual] of cases) {
          if (actual < 0) continue
          metrics[key][count].n++
          perMarket[market][key][count].n++
          if (picks.includes(actual)) {
            metrics[key][count].hit++
            perMarket[market][key][count].hit++
          }
        }
      }
    }
  }

  console.log(`Unified strategy backtest, last ${days} results per market`)
  for (const count of COUNTS) {
    console.log(
      `top ${count}: open ${fmt(metrics.oldOpen[count].hit, metrics.oldOpen[count].n)} -> ${fmt(metrics.newOpen[count].hit, metrics.newOpen[count].n)} | ` +
      `close ${fmt(metrics.oldClose[count].hit, metrics.oldClose[count].n)} -> ${fmt(metrics.newClose[count].hit, metrics.newClose[count].n)}`,
    )
  }
  console.log('\nPer market top4/top6')
  for (const market of MARKET_ORDER) {
    const m = perMarket[market]
    console.log(
      `${market.padEnd(15)} ` +
      `O4 ${fmt(m.oldOpen[4].hit, m.oldOpen[4].n)} -> ${fmt(m.newOpen[4].hit, m.newOpen[4].n)} ` +
      `O6 ${fmt(m.oldOpen[6].hit, m.oldOpen[6].n)} -> ${fmt(m.newOpen[6].hit, m.newOpen[6].n)} ` +
      `C4 ${fmt(m.oldClose[4].hit, m.oldClose[4].n)} -> ${fmt(m.newClose[4].hit, m.newClose[4].n)} ` +
      `C6 ${fmt(m.oldClose[6].hit, m.oldClose[6].n)} -> ${fmt(m.newClose[6].hit, m.newClose[6].n)}`,
    )
  }
  console.log('\nClose detail top2/top5/top8')
  for (const market of MARKET_ORDER) {
    const m = perMarket[market]
    console.log(
      `${market.padEnd(15)} ` +
      `C2 ${fmt(m.oldClose[2].hit, m.oldClose[2].n)} -> ${fmt(m.newClose[2].hit, m.newClose[2].n)} ` +
      `C5 ${fmt(m.oldClose[5].hit, m.oldClose[5].n)} -> ${fmt(m.newClose[5].hit, m.newClose[5].n)} ` +
      `C8 ${fmt(m.oldClose[8].hit, m.oldClose[8].n)} -> ${fmt(m.newClose[8].hit, m.newClose[8].n)}`,
    )
  }
}

run(Number(process.argv[2] ?? 30)).catch((error) => {
  console.error(error)
  process.exit(1)
})
