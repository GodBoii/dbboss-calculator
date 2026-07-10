/* eslint-disable no-console */

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
const {
  analyzeMarket,
  buildContextFromResult,
  computeJodiAnalysis,
  getSuttaSignal,
} = require('../src/lib/predictor.ts')
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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TARGETS = ['open', 'close', 'jodi', 'knownOpenClose']
const COUNTS = [3, 4, 6]

function pct(n, d) {
  return d ? (n / d) * 100 : 0
}

function fmt(value) {
  return Number(value.toFixed(1))
}

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item) => item.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

function flatten(records, position) {
  const rows = []
  for (const record of records) {
    if ((position === 'all' || position === 'open') && record.openPanel) {
      rows.push({ sutta: record.openSutta, panel: record.openPanel, day: record.day })
    }
    if ((position === 'all' || position === 'close') && record.closePanel) {
      rows.push({ sutta: record.closeSutta, panel: record.closePanel, day: record.day })
    }
  }
  return rows
}

function uniqueRanked(picks) {
  const seen = new Set()
  const rows = []
  for (const [index, pick] of picks.entries()) {
    if (seen.has(pick.sutta)) continue
    seen.add(pick.sutta)
    rows.push({ sutta: pick.sutta, rank: index + 1, score: pick.score })
  }
  return rows
}

function selectCurrentUi(picks, droughts, count) {
  const bySutta = new Map()
  for (const [index, pick] of picks.entries()) {
    if (bySutta.has(pick.sutta)) continue
    const signal = getSuttaSignal(droughts[String(pick.sutta)] ?? 1000)
    bySutta.set(pick.sutta, {
      sutta: pick.sutta,
      rank: index + 1,
      score: pick.score,
      signalState: signal.state,
    })
  }
  for (let sutta = 0; sutta <= 9; sutta++) {
    if (bySutta.has(sutta)) continue
    const signal = getSuttaSignal(droughts[String(sutta)] ?? 1000)
    bySutta.set(sutta, { sutta, rank: 999, score: 0, signalState: signal.state })
  }
  const ranked = Array.from(bySutta.values())
  const selected = ranked.filter((item) => item.signalState === 'fresh')
  for (const item of ranked.filter((row) => row.signalState === 'snapback')) {
    if (selected.length >= count) break
    if (!selected.some((row) => row.sutta === item.sutta)) selected.push(item)
  }
  for (const item of ranked) {
    if (selected.length >= count) break
    if (!selected.some((row) => row.sutta === item.sutta)) selected.push(item)
  }
  return selected.slice(0, count).map((row) => row.sutta)
}

function scoreByPicks(picks, droughts, options) {
  const rows = new Map()
  for (const [index, pick] of picks.entries()) {
    const sutta = pick.sutta
    const row = rows.get(sutta) ?? {
      sutta,
      max: -Infinity,
      sum: 0,
      weighted: 0,
      firstRank: index + 1,
      count: 0,
    }
    const rankWeight = Math.max(1, 31 - index)
    row.max = Math.max(row.max, pick.score)
    row.sum += pick.score
    row.weighted += pick.score * rankWeight
    row.count++
    rows.set(sutta, row)
  }
  const signalBonus = {
    fresh: options.fresh ?? 0,
    warming: options.warming ?? 0,
    danger: options.danger ?? 0,
    cooling: options.cooling ?? 0,
    snapback: options.snapback ?? 0,
    unknown: options.unknown ?? 0,
  }
  for (let sutta = 0; sutta <= 9; sutta++) {
    const row = rows.get(sutta) ?? {
      sutta,
      max: 0,
      sum: 0,
      weighted: 0,
      firstRank: 999,
      count: 0,
    }
    const drought = droughts[String(sutta)] ?? 1000
    const signal = getSuttaSignal(drought)
    const base =
      options.mode === 'sum'
        ? row.sum
        : options.mode === 'weighted'
          ? row.weighted / 30
          : options.mode === 'count'
            ? row.count * 20 + row.max
            : row.max
    row.score = base + signalBonus[signal.state] - (options.rankPenalty ?? 0) * row.firstRank
    row.signalState = signal.state
    rows.set(sutta, row)
  }
  return Array.from(rows.values()).sort((a, b) => b.score - a.score)
}

function selectPickVariant(picks, droughts, count, options) {
  return scoreByPicks(picks, droughts, options).slice(0, count).map((row) => row.sutta)
}

function suttaStats(prior, position, isoDate, openSutta = null) {
  const entries = flatten(prior, position)
  const dayName = DAY_NAMES[new Date(`${isoDate}T12:00:00Z`).getUTCDay()]
  const counts = Array(10).fill(0)
  const recent24 = Array(10).fill(0)
  const recent60 = Array(10).fill(0)
  const dayCounts = Array(10).fill(0)
  const conditional = Array(10).fill(0)
  let total = 0
  let dayTotal = 0
  let conditionalTotal = 0

  for (const row of entries) {
    counts[row.sutta]++
    total++
    if (row.day === dayName) {
      dayCounts[row.sutta]++
      dayTotal++
    }
  }
  for (const row of entries.slice(-24)) recent24[row.sutta]++
  for (const row of entries.slice(-60)) recent60[row.sutta]++
  if (openSutta !== null) {
    for (const record of prior) {
      if (record.openSutta === openSutta && record.closeSutta >= 0) {
        conditional[record.closeSutta]++
        conditionalTotal++
      }
    }
  }

  return { counts, recent24, recent60, dayCounts, total, dayTotal, conditional, conditionalTotal }
}

function selectStatVariant(prior, position, isoDate, count, options, openSutta = null) {
  const stats = suttaStats(prior, position, isoDate, openSutta)
  const scores = []
  for (let s = 0; s <= 9; s++) {
    const longRate = (stats.counts[s] + 1) / (stats.total + 10)
    const recent24Rate = (stats.recent24[s] + 1) / (Math.min(24, stats.total) + 10)
    const recent60Rate = (stats.recent60[s] + 1) / (Math.min(60, stats.total) + 10)
    const dayRate = (stats.dayCounts[s] + 1) / (stats.dayTotal + 10)
    const condRate =
      openSutta === null
        ? 0.1
        : (stats.conditional[s] + 1) / (stats.conditionalTotal + 10)
    const score =
      (options.long ?? 0) * longRate +
      (options.recent24 ?? 0) * recent24Rate +
      (options.recent60 ?? 0) * recent60Rate +
      (options.day ?? 0) * dayRate +
      (options.conditional ?? 0) * condRate
    scores.push({ sutta: s, score })
  }
  return scores.sort((a, b) => b.score - a.score).slice(0, count).map((row) => row.sutta)
}

function mergeSelectors(selectors, count) {
  const selected = []
  for (const list of selectors) {
    for (const sutta of list) {
      if (selected.length >= count) return selected
      if (!selected.includes(sutta)) selected.push(sutta)
    }
  }
  return selected
}

function jodiCombos(openSuttas, closeSuttas) {
  const combos = new Set()
  for (const open of openSuttas) {
    for (const close of closeSuttas) combos.add(`${open}${close}`)
  }
  return combos
}

function empty() {
  const obj = {}
  for (const count of COUNTS) obj[count] = { n: 0, hit: 0 }
  return obj
}

function addMetric(metrics, count, ok) {
  metrics[count].n++
  if (ok) metrics[count].hit++
}

function initVariantMetrics(variantNames) {
  const metrics = {}
  for (const variant of variantNames) {
    metrics[variant] = {}
    for (const target of TARGETS) metrics[variant][target] = empty()
  }
  return metrics
}

async function fetchAll() {
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
  return all
}

const PICK_VARIANTS = {
  currentUi: (picks, droughts, count) => selectCurrentUi(picks, droughts, count),
  rankOnly: (picks, _droughts, count) => uniqueRanked(picks).slice(0, count).map((row) => row.sutta),
  maxScore: (picks, droughts, count) => selectPickVariant(picks, droughts, count, { mode: 'max' }),
  weightedFresh: (picks, droughts, count) =>
    selectPickVariant(picks, droughts, count, { mode: 'weighted', fresh: 20, warming: 8, snapback: 6, danger: -8, cooling: -4 }),
  weightedSnap: (picks, droughts, count) =>
    selectPickVariant(picks, droughts, count, { mode: 'weighted', fresh: 8, warming: 5, snapback: 22, danger: -4 }),
  sumCooling: (picks, droughts, count) =>
    selectPickVariant(picks, droughts, count, { mode: 'sum', fresh: 8, warming: 5, cooling: 12, snapback: 8 }),
}

const STAT_VARIANTS = {
  freqRecentDay: (prior, pos, iso, count) =>
    selectStatVariant(prior, pos, iso, count, { long: 0.15, recent24: 0.35, recent60: 0.25, day: 0.25 }),
  freqRecentOnly: (prior, pos, iso, count) =>
    selectStatVariant(prior, pos, iso, count, { recent24: 0.55, recent60: 0.45 }),
  freqDayHeavy: (prior, pos, iso, count) =>
    selectStatVariant(prior, pos, iso, count, { long: 0.1, recent24: 0.2, recent60: 0.2, day: 0.5 }),
}

const JODI_STAT_VARIANTS = {
  conditionalOnly: (prior, _pos, iso, count, openSutta) =>
    selectStatVariant(prior, 'close', iso, count, { conditional: 1 }, openSutta),
  conditionalRecent: (prior, _pos, iso, count, openSutta) =>
    selectStatVariant(prior, 'close', iso, count, { conditional: 0.55, recent24: 0.2, recent60: 0.15, day: 0.1 }, openSutta),
  conditionalDay: (prior, _pos, iso, count, openSutta) =>
    selectStatVariant(prior, 'close', iso, count, { conditional: 0.45, day: 0.25, recent60: 0.2, long: 0.1 }, openSutta),
}

function variantNames() {
  return [
    ...Object.keys(PICK_VARIANTS),
    ...Object.keys(STAT_VARIANTS),
    ...Object.keys(JODI_STAT_VARIANTS),
    'hybridUiRecent',
    'hybridWeightedRecent',
    'hybridKnownOpen',
    'openCurrentCloseSum',
    'openCurrentCloseWeighted',
    'production',
  ]
}

function makeRows(metrics, target, count) {
  return Object.entries(metrics)
    .map(([variant, data]) => ({
      variant,
      n: data[target][count].n,
      hit: fmt(pct(data[target][count].hit, data[target][count].n)),
    }))
    .sort((a, b) => b.hit - a.hit)
    .slice(0, 12)
}

async function main() {
  const days = Number.parseInt(process.argv[2] || '30', 10)
  const allRecords = await fetchAll()
  const allDated = Object.fromEntries(Object.entries(allRecords).map(([market, records]) => [market, dated(records)]))
  const metrics = initVariantMetrics(variantNames())
  const perMarket = {}

  for (const [market, records] of Object.entries(allDated)) {
    const endDate = records[records.length - 1].isoDate
    const start = new Date(`${endDate}T00:00:00Z`)
    start.setUTCDate(start.getUTCDate() - days + 1)
    const startDate = start.toISOString().slice(0, 10)
    perMarket[market] = initVariantMetrics(variantNames())

    for (let i = 0; i < records.length; i++) {
      const { record, isoDate } = records[i]
      if (isoDate < startDate || isoDate > endDate) continue
      const prior = records.slice(0, i).filter((row) => row.isoDate < isoDate).map((row) => row.record)
      if (prior.length < 50) continue

      const priorAll = {}
      for (const [otherMarket, otherRecords] of Object.entries(allDated)) {
        priorAll[otherMarket] = otherRecords.filter((row) => row.isoDate < isoDate).map((row) => row.record)
      }
      priorAll[market] = prior

      const prediction = analyzeMarket(market, prior, priorAll, new Date(`${isoDate}T12:00:00Z`))
      if (!prediction) continue
      const knownOpen = computeJodiAnalysis(
        record.openSutta,
        record.openPanel || null,
        prior,
        buildContextFromResult(prediction),
        prediction.closeDpKindContext,
      )

      for (const count of COUNTS) {
        const pickSelections = {}
        for (const [name, fn] of Object.entries(PICK_VARIANTS)) {
          pickSelections[name] = {
            open: fn(prediction.openPicks, prediction.openSuttaDroughts, count),
            close: fn(prediction.closePicks, prediction.closeSuttaDroughts, count),
            knownOpenClose: fn(knownOpen.adjustedClosePicks, prediction.closeSuttaDroughts, count),
          }
        }
        for (const [name, fn] of Object.entries(STAT_VARIANTS)) {
          pickSelections[name] = {
            open: fn(prior, 'open', isoDate, count),
            close: fn(prior, 'close', isoDate, count),
            knownOpenClose: fn(prior, 'close', isoDate, count),
          }
        }
        for (const [name, fn] of Object.entries(JODI_STAT_VARIANTS)) {
          pickSelections[name] = {
            open: PICK_VARIANTS.currentUi(prediction.openPicks, prediction.openSuttaDroughts, count),
            close: PICK_VARIANTS.currentUi(prediction.closePicks, prediction.closeSuttaDroughts, count),
            knownOpenClose: fn(prior, 'close', isoDate, count, record.openSutta),
          }
        }
        pickSelections.hybridUiRecent = {
          open: mergeSelectors([
            pickSelections.currentUi.open,
            pickSelections.freqRecentDay.open,
            pickSelections.rankOnly.open,
          ], count),
          close: mergeSelectors([
            pickSelections.freqRecentDay.close,
            pickSelections.currentUi.close,
            pickSelections.rankOnly.close,
          ], count),
          knownOpenClose: mergeSelectors([
            pickSelections.conditionalRecent.knownOpenClose,
            pickSelections.currentUi.knownOpenClose,
            pickSelections.freqRecentDay.knownOpenClose,
          ], count),
        }
        pickSelections.hybridWeightedRecent = {
          open: mergeSelectors([
            pickSelections.weightedFresh.open,
            pickSelections.freqRecentDay.open,
            pickSelections.currentUi.open,
          ], count),
          close: mergeSelectors([
            pickSelections.weightedSnap.close,
            pickSelections.freqRecentOnly.close,
            pickSelections.currentUi.close,
          ], count),
          knownOpenClose: mergeSelectors([
            pickSelections.conditionalDay.knownOpenClose,
            pickSelections.weightedSnap.knownOpenClose,
            pickSelections.currentUi.knownOpenClose,
          ], count),
        }
        pickSelections.hybridKnownOpen = {
          open: pickSelections.hybridWeightedRecent.open,
          close: pickSelections.hybridWeightedRecent.close,
          knownOpenClose: mergeSelectors([
            pickSelections.currentUi.knownOpenClose,
            pickSelections.conditionalRecent.knownOpenClose,
            pickSelections.conditionalDay.knownOpenClose,
          ], count),
        }
        pickSelections.openCurrentCloseSum = {
          open: pickSelections.currentUi.open,
          close: pickSelections.sumCooling.close,
          knownOpenClose: pickSelections.sumCooling.knownOpenClose,
        }
        pickSelections.openCurrentCloseWeighted = {
          open: pickSelections.currentUi.open,
          close: pickSelections.weightedFresh.close,
          knownOpenClose: count <= 4
            ? pickSelections.sumCooling.knownOpenClose
            : pickSelections.weightedSnap.knownOpenClose,
        }
        pickSelections.production = {
          open: pickSelections.currentUi.open,
          close: count <= 4
            ? pickSelections.sumCooling.close
            : pickSelections.weightedFresh.close,
          knownOpenClose: count <= 4
            ? pickSelections.sumCooling.knownOpenClose
            : pickSelections.weightedSnap.knownOpenClose,
        }
        const productionJodiClose = count <= 4
          ? pickSelections.currentUi.close
          : pickSelections.weightedFresh.close

        for (const [name, selection] of Object.entries(pickSelections)) {
          const openOk = selection.open.includes(record.openSutta)
          const closeOk = selection.close.includes(record.closeSutta)
          const knownOpenOk = selection.knownOpenClose.includes(record.closeSutta)
          const jodiOk = jodiCombos(
            selection.open,
            name === 'production' ? productionJodiClose : selection.close,
          ).has(`${record.openSutta}${record.closeSutta}`)
          for (const target of TARGETS) {
            const ok =
              target === 'open'
                ? openOk
                : target === 'close'
                  ? closeOk
                  : target === 'knownOpenClose'
                    ? knownOpenOk
                    : jodiOk
            addMetric(metrics[name][target], count, ok)
            addMetric(perMarket[market][name][target], count, ok)
          }
        }
      }
    }
  }

  console.log(`SUTTA MODEL RESEARCH - last ${days} days`)
  for (const target of TARGETS) {
    for (const count of [4, 6]) {
      console.log(`\nGlobal best ${target}@${count}`)
      console.table(makeRows(metrics, target, count))
    }
  }

  console.log('\nPer-market currentUi vs selected improved @4/@6')
  const selected = {
    open: 'currentUi',
    close: 'production',
    jodi: 'production',
    knownOpenClose: 'production',
  }
  for (const target of TARGETS) {
    console.log(`\n${target}`)
    const rows = Object.entries(perMarket).map(([market, data]) => ({
      market,
      n: data.currentUi[target][4].n,
      current4: fmt(pct(data.currentUi[target][4].hit, data.currentUi[target][4].n)),
      improved4: fmt(pct(data[selected[target]][target][4].hit, data[selected[target]][target][4].n)),
      current6: fmt(pct(data.currentUi[target][6].hit, data.currentUi[target][6].n)),
      improved6: fmt(pct(data[selected[target]][target][6].hit, data[selected[target]][target][6].n)),
      selected: selected[target],
    }))
    console.table(rows)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
