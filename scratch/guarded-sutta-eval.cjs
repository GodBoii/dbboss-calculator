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

const { analyzeMarket, buildContextFromResult, computeJodiAnalysis, getSuttaSignal, LIQUIDITY_FLOW_MAP } = require('../src/lib/predictor.ts')
const { getRecordISODate } = require('../src/lib/backtest.ts')
const { buildOpenSuttaSet, buildCloseSuttaSet, buildJodis } = require('../src/components/analysis/AnalysisTabs.tsx')

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
const COUNTS = [4, 6]
const CACHE = 'scratch/open-sutta-records-cache.json'

function pct(hit, n) {
  return n ? (hit / n) * 100 : 0
}

function fmt(bucket) {
  return `${pct(bucket.hit, bucket.n).toFixed(1)}% (${bucket.hit}/${bucket.n})`
}

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((row) => row.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

function uniqueRank(picks, count) {
  const out = []
  for (const pick of picks) {
    if (!out.includes(pick.sutta)) out.push(pick.sutta)
    if (out.length >= count) break
  }
  return out
}

function pickAggregate(picks, droughts, count, mode) {
  const rows = new Map()
  for (const [index, pick] of picks.entries()) {
    const current = rows.get(pick.sutta) ?? { sutta: pick.sutta, sum: 0, weighted: 0, rank: index + 1 }
    const rankWeight = Math.max(1, 31 - index)
    current.sum += pick.score
    current.weighted += pick.score * rankWeight
    current.rank = Math.min(current.rank, index + 1)
    rows.set(pick.sutta, current)
  }
  for (let s = 0; s <= 9; s++) {
    if (!rows.has(s)) rows.set(s, { sutta: s, sum: 0, weighted: 0, rank: 999 })
  }
  const bonus = mode === 'weightedFresh'
    ? { fresh: 20, warming: 8, danger: -8, cooling: -4, snapback: 6, unknown: 0 }
    : mode === 'weightedSnap'
      ? { fresh: 8, warming: 5, danger: -4, cooling: 0, snapback: 22, unknown: 0 }
      : { fresh: 8, warming: 5, danger: 0, cooling: 12, snapback: 8, unknown: 0 }
  return [...rows.values()]
    .map((row) => {
      const state = getSuttaSignal(droughts[String(row.sutta)] ?? 1000).state
      return {
        sutta: row.sutta,
        rank: row.rank,
        score: (mode === 'sumCooling' ? row.sum : row.weighted / 30) + bonus[state],
      }
    })
    .sort((a, b) => b.score - a.score || a.rank - b.rank || a.sutta - b.sutta)
    .slice(0, count)
    .map((row) => row.sutta)
}

function opposite(sutta) {
  return (sutta + 5) % 10
}

function house(sutta) {
  if (typeof sutta !== 'number') return null
  return sutta >= 1 && sutta <= 5 ? 'low' : 'high'
}

function smoothed(count, total) {
  return (count + 1) / (total + 10)
}

function statCloseRows(strategy, prior, allPrior, market, isoDate, currentOpenSutta) {
  const closeRecords = prior.filter((record) => record.closePanel && record.closeSutta >= 0)
  const dayName = new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
  const dayOfMonth = new Date(`${isoDate}T12:00:00Z`).getUTCDate()
  const recent24 = Array(10).fill(0)
  const weekday = Array(10).fill(0)
  const sameDate = Array(10).fill(0)
  const sameDateOpposite = Array(10).fill(0)
  const prevCloseCond = Array(10).fill(0)
  const prevOpenCond = Array(10).fill(0)
  const prevJodiCond = Array(10).fill(0)
  const currentOpenCond = Array(10).fill(0)
  const prevCloseDelta = Array(10).fill(0)
  const prevOpenDelta = Array(10).fill(0)
  const sourcePrevOpenCond = Array(10).fill(0)
  let weekdayTotal = 0
  let sameDateTotal = 0
  let prevCloseCondTotal = 0
  let prevOpenCondTotal = 0
  let prevJodiCondTotal = 0
  let currentOpenCondTotal = 0
  let sourcePrevOpenCondTotal = 0
  const previousRecord = prior[prior.length - 1]
  const previousClose = previousRecord?.closeSutta ?? 0
  const previousOpen = previousRecord?.openSutta
  const previousJodi = previousRecord?.jodi
  const sourceMarket = LIQUIDITY_FLOW_MAP[market]
  const sourceRecords = sourceMarket ? allPrior[sourceMarket] ?? [] : []
  const sourcePreviousOpen = sourceRecords[sourceRecords.length - 1]?.openSutta

  for (const record of closeRecords.slice(-24)) recent24[record.closeSutta]++
  for (const record of closeRecords) {
    if (record.day === dayName) {
      weekday[record.closeSutta]++
      weekdayTotal++
    }
    const rowIso = getRecordISODate(record)
    if (rowIso && new Date(`${rowIso}T12:00:00Z`).getUTCDate() === dayOfMonth) {
      sameDate[record.closeSutta]++
      sameDateOpposite[opposite(record.closeSutta)]++
      sameDateTotal++
    }
  }
  for (let i = 1; i < prior.length; i++) {
    const previous = prior[i - 1]
    const current = prior[i]
    if (current.closeSutta < 0) continue
    if (previous.closeSutta === previousClose) {
      prevCloseCond[current.closeSutta]++
      prevCloseCondTotal++
    }
    if (previous.openSutta === previousOpen) {
      prevOpenCond[current.closeSutta]++
      prevOpenCondTotal++
    }
    if (previous.jodi === previousJodi) {
      prevJodiCond[current.closeSutta]++
      prevJodiCondTotal++
    }
    if (current.openSutta === currentOpenSutta) {
      currentOpenCond[current.closeSutta]++
      currentOpenCondTotal++
    }
    if (previous.closeSutta >= 0) prevCloseDelta[(current.closeSutta - previous.closeSutta + 10) % 10]++
    if (previous.openSutta >= 0) prevOpenDelta[(current.closeSutta - previous.openSutta + 10) % 10]++
    if (sourcePreviousOpen !== undefined && current.openSutta === sourcePreviousOpen) {
      sourcePrevOpenCond[current.closeSutta]++
      sourcePrevOpenCondTotal++
    }
  }

  const total = closeRecords.length
  return Array.from({ length: 10 }, (_, sutta) => {
    let score = 0
    if (strategy === 'calendarSameDate') score = 0.2 * smoothed(recent24[sutta], Math.min(24, total)) + 0.1 * smoothed(weekday[sutta], weekdayTotal) + 0.7 * smoothed(sameDate[sutta], sameDateTotal)
    else if (strategy === 'calendarSameDateOpposite') score = 0.2 * smoothed(recent24[sutta], Math.min(24, total)) + 0.8 * smoothed(sameDateOpposite[sutta], sameDateTotal)
    else if (strategy === 'prevCloseCond') score = 0.25 * smoothed(recent24[sutta], Math.min(24, total)) + 0.15 * smoothed(weekday[sutta], weekdayTotal) + 0.6 * smoothed(prevCloseCond[sutta], prevCloseCondTotal)
    else if (strategy === 'prevOpenCond') score = 0.25 * smoothed(recent24[sutta], Math.min(24, total)) + 0.15 * smoothed(weekday[sutta], weekdayTotal) + 0.6 * smoothed(prevOpenCond[sutta], prevOpenCondTotal)
    else if (strategy === 'prevJodiCond') score = 0.25 * smoothed(recent24[sutta], Math.min(24, total)) + 0.75 * smoothed(prevJodiCond[sutta], prevJodiCondTotal)
    else if (strategy === 'currentOpenCond') score = 0.2 * smoothed(recent24[sutta], Math.min(24, total)) + 0.1 * smoothed(weekday[sutta], weekdayTotal) + 0.7 * smoothed(currentOpenCond[sutta], currentOpenCondTotal)
    else if (strategy === 'currentOpenOpposite') score = 0.2 * smoothed(recent24[sutta], Math.min(24, total)) + 0.8 * (currentOpenSutta !== null && opposite(currentOpenSutta) === sutta ? 1 : 0)
    else if (strategy === 'currentOpenSameHouse') score = 0.25 * smoothed(recent24[sutta], Math.min(24, total)) + 0.75 * (house(sutta) === house(currentOpenSutta) ? 1 : 0)
    else if (strategy === 'currentOpenOppHouse') score = 0.25 * smoothed(recent24[sutta], Math.min(24, total)) + 0.75 * (house(sutta) !== house(currentOpenSutta) ? 1 : 0)
    else if (strategy === 'prevCloseDelta') score = 0.25 * smoothed(recent24[sutta], Math.min(24, total)) + 0.2 * smoothed(weekday[sutta], weekdayTotal) + 0.55 * smoothed(prevCloseDelta[(sutta - previousClose + 10) % 10], Math.max(1, total - 1))
    else if (strategy === 'prevOpenDelta') score = 0.25 * smoothed(recent24[sutta], Math.min(24, total)) + 0.2 * smoothed(weekday[sutta], weekdayTotal) + 0.55 * smoothed(prevOpenDelta[(sutta - (previousOpen ?? 0) + 10) % 10], Math.max(1, total - 1))
    else if (strategy === 'sourcePrevOpenCond') score = 0.25 * smoothed(recent24[sutta], Math.min(24, total)) + 0.15 * smoothed(weekday[sutta], weekdayTotal) + 0.6 * smoothed(sourcePrevOpenCond[sutta], sourcePrevOpenCondTotal)
    return { sutta, score }
  })
}

function statClose(strategy, prior, allPrior, market, isoDate, currentOpenSutta, count) {
  return statCloseRows(strategy, prior, allPrior, market, isoDate, currentOpenSutta)
    .sort((a, b) => b.score - a.score || a.sutta - b.sutta)
    .slice(0, count)
    .map((row) => row.sutta)
}

function mergeLists(lists, count) {
  const out = []
  for (const list of lists) {
    for (const sutta of list) {
      if (!out.includes(sutta)) out.push(sutta)
      if (out.length >= count) return out
    }
  }
  return out
}

function closeVariant(strategy, picks, droughts, prior, allPrior, market, isoDate, currentOpenSutta, count) {
  if (strategy === 'baseline') return null
  if (strategy.includes('+')) {
    const lists = strategy
      .split('+')
      .map((part) => closeVariant(part, picks, droughts, prior, allPrior, market, isoDate, currentOpenSutta, 10))
      .filter(Boolean)
    return mergeLists(lists, count)
  }
  if (
    currentOpenSutta === null &&
    ['currentOpenCond', 'currentOpenOpposite', 'currentOpenSameHouse', 'currentOpenOppHouse'].includes(strategy)
  ) {
    return null
  }
  if (strategy === 'rankOnly') return uniqueRank(picks, count)
  if (strategy === 'currentUi') return uniqueRank(picks, count)
  if (strategy === 'sumCooling') return pickAggregate(picks, droughts, count, 'sumCooling')
  if (strategy === 'weightedFresh') return pickAggregate(picks, droughts, count, 'weightedFresh')
  if (strategy === 'weightedSnap') return pickAggregate(picks, droughts, count, 'weightedSnap')
  return statClose(strategy, prior, allPrior, market, isoDate, currentOpenSutta, count)
}

const CANDIDATES = [
  'baseline',
  'prevJodiCond',
  'prevOpenCond+prevOpenDelta',
  'calendarSameDateOpposite+prevOpenDelta',
  'calendarSameDate+prevCloseCond',
  'rankOnly+prevCloseCond',
  'weightedSnap+rankOnly',
  'calendarSameDate+sumCooling',
  'rankOnly+prevCloseDelta',
]

function emptyMetric() {
  return Object.fromEntries(COUNTS.map((count) => [count, { n: 0, hit: 0 }]))
}

function add(bucket, count, ok) {
  bucket[count].n++
  if (ok) bucket[count].hit++
}

function buildCases(days) {
  const all = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  const datedByMarket = Object.fromEntries(Object.entries(all).map(([market, records]) => [market, dated(records)]))
  const results = {}

  for (const market of MARKET_ORDER) {
    const rows = datedByMarket[market]
    const cutoffs = new Set(rows.slice(-days).map((row) => row.isoDate))
    results[market] = {
      baseline: { close: emptyMetric(), adj: emptyMetric(), jodi: emptyMetric() },
      candidates: Object.fromEntries(CANDIDATES.map((name) => [name, { close: emptyMetric(), adj: emptyMetric(), jodi: emptyMetric() }])),
    }

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
      const targetDate = new Date(`${row.isoDate}T12:00:00Z`)
      const prediction = analyzeMarket(market, prior, allPrior, targetDate)
      if (!prediction) continue
      const knownOpen = computeJodiAnalysis(row.record.openSutta, row.record.openPanel || null, prior, buildContextFromResult(prediction), prediction.closeDpKindContext)
      const actualJodi = `${row.record.openSutta}${row.record.closeSutta}`

      for (const count of COUNTS) {
        const open = buildOpenSuttaSet(prediction.openPicks, prediction.openSuttaDroughts, prior, count, market, targetDate).map((pick) => pick.sutta)
        const baseClose = buildCloseSuttaSet(prediction.closePicks, prediction.closeSuttaDroughts, prior, count, market, null, allPrior, targetDate).map((pick) => pick.sutta)
        const baseAdj = buildCloseSuttaSet(knownOpen.adjustedClosePicks, prediction.closeSuttaDroughts, prior, count, market, row.record.openSutta, allPrior, targetDate).map((pick) => pick.sutta)
        add(results[market].baseline.close, count, baseClose.includes(row.record.closeSutta))
        add(results[market].baseline.adj, count, baseAdj.includes(row.record.closeSutta))
        add(results[market].baseline.jodi, count, buildJodis(open.map((sutta) => ({ sutta })), baseClose.map((sutta) => ({ sutta }))).includes(actualJodi))

        for (const name of CANDIDATES) {
          const close = name === 'baseline'
            ? baseClose
            : closeVariant(name, prediction.closePicks, prediction.closeSuttaDroughts, prior, allPrior, market, row.isoDate, null, count) ?? baseClose
          const adj = name === 'baseline'
            ? baseAdj
            : closeVariant(name, knownOpen.adjustedClosePicks, prediction.closeSuttaDroughts, prior, allPrior, market, row.isoDate, row.record.openSutta, count) ?? baseAdj
          add(results[market].candidates[name].close, count, close.includes(row.record.closeSutta))
          add(results[market].candidates[name].adj, count, adj.includes(row.record.closeSutta))
          add(results[market].candidates[name].jodi, count, jodiCombos(open, close).has(actualJodi))
        }
      }
    }
  }
  return results
}

function jodiCombos(open, close) {
  const combos = new Set()
  for (const o of open) for (const c of close) combos.add(`${o}${c}`)
  return combos
}

function summarize(shortWindow, longWindow) {
  for (const target of ['close', 'adj', 'jodi']) {
    console.log(`\nGUARDED ${target.toUpperCase()}`)
    const rows = []
    for (const market of MARKET_ORDER) {
      for (const count of COUNTS) {
        const base30 = shortWindow[market].baseline[target][count]
        const base730 = longWindow[market].baseline[target][count]
        const accepted = CANDIDATES
          .map((name) => ({
            name,
            latest: shortWindow[market].candidates[name][target][count],
            long: longWindow[market].candidates[name][target][count],
          }))
          .filter((row) =>
            row.latest.hit >= base30.hit &&
            row.long.hit >= base730.hit &&
            (row.latest.hit > base30.hit || row.long.hit > base730.hit),
          )
          .sort((a, b) =>
            (b.latest.hit - base30.hit) - (a.latest.hit - base30.hit) ||
            (b.long.hit - base730.hit) - (a.long.hit - base730.hit),
          )[0]
        if (accepted) {
          rows.push({
            market,
            count,
            strategy: accepted.name,
            latest: `${fmt(base30)} -> ${fmt(accepted.latest)}`,
            long: `${fmt(base730)} -> ${fmt(accepted.long)}`,
            latestGain: accepted.latest.hit - base30.hit,
            longGain: accepted.long.hit - base730.hit,
          })
        }
      }
    }
    console.table(rows)
  }
}

const shortWindow = buildCases(30)
const longWindow = buildCases(730)
summarize(shortWindow, longWindow)
