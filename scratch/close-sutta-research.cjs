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
  if (fs.existsSync(CACHE)) return JSON.parse(fs.readFileSync(CACHE, 'utf8'))
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
  for (let s = 0; s <= 9; s++) if (!rows.some((row) => row.sutta === s)) rows.push({ sutta: s, score: 0, rank: 999 })
  const withSignal = rows.map((row) => ({ ...row, signal: getSuttaSignal(droughts[String(row.sutta)] ?? 1000).state }))
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

function currentProduction(picks, droughts, count) {
  return count <= 4
    ? pickAggregate(picks, droughts, count, { base: 'sum', bonus: { fresh: 8, warming: 5, danger: 0, cooling: 12, snapback: 8 } })
    : pickAggregate(picks, droughts, count, { base: 'weighted', bonus: { fresh: 20, warming: 8, danger: -8, cooling: -4, snapback: 6 } })
}

function opposite(s) {
  return (s + 5) % 10
}

function house(s) {
  return s >= 1 && s <= 5 ? 'low' : 'high'
}

function smoothedRate(count, total) {
  return (count + 1) / (total + 10)
}

function scoreRowsFromBuckets(buckets, weights, totalHints) {
  return Array.from({ length: 10 }, (_, sutta) => {
    let score = 0
    for (const [name, weight] of Object.entries(weights)) {
      score += weight * smoothedRate(buckets[name][sutta] ?? 0, totalHints[name] ?? 0)
    }
    return { sutta, score }
  })
}

function take(rows, count) {
  return rows.sort((a, b) => b.score - a.score || a.sutta - b.sutta).slice(0, count).map((row) => row.sutta)
}

function relationStats(prior, allPrior, market, isoDate, actualOpenSutta) {
  const close = flattenClose(prior)
  const currentDate = new Date(`${isoDate}T12:00:00Z`)
  const day = DAY_NAMES[currentDate.getUTCDay()]
  const dayOfMonth = currentDate.getUTCDate()
  const stats = {
    day,
    close,
    long: Array(10).fill(0),
    recent12: Array(10).fill(0),
    recent24: Array(10).fill(0),
    recent60: Array(10).fill(0),
    weekday: Array(10).fill(0),
    sameDate: Array(10).fill(0),
    sameDateOpposite: Array(10).fill(0),
    sameWeekdayRecent: Array(10).fill(0),
    prevCloseCond: Array(10).fill(0),
    prevOpenCond: Array(10).fill(0),
    prevJodiCond: Array(10).fill(0),
    prevCloseDelta: Array(10).fill(0),
    prevOpenDelta: Array(10).fill(0),
    currentOpenCond: Array(10).fill(0),
    currentOpenOpposite: Array(10).fill(0),
    currentOpenSameHouse: Array(10).fill(0),
    currentOpenOppHouse: Array(10).fill(0),
    sourcePrevCloseCond: Array(10).fill(0),
    sourcePrevOpenCond: Array(10).fill(0),
  }

  for (const entry of close) {
    stats.long[entry.sutta]++
    if (entry.day === day) stats.weekday[entry.sutta]++
  }
  for (const entry of close.slice(-12)) stats.recent12[entry.sutta]++
  for (const entry of close.slice(-24)) stats.recent24[entry.sutta]++
  for (const entry of close.slice(-60)) stats.recent60[entry.sutta]++

  const last = prior[prior.length - 1]
  const prevClose = last?.closeSutta
  const prevOpen = last?.openSutta
  const prevJodi = last?.jodi

  for (let i = 1; i < prior.length; i++) {
    const row = prior[i]
    const prev = prior[i - 1]
    if (prev.closeSutta === prevClose) stats.prevCloseCond[row.closeSutta]++
    if (prev.openSutta === prevOpen) stats.prevOpenCond[row.closeSutta]++
    if (prev.jodi === prevJodi) stats.prevJodiCond[row.closeSutta]++
    stats.prevCloseDelta[(row.closeSutta - prev.closeSutta + 10) % 10]++
    stats.prevOpenDelta[(row.closeSutta - prev.openSutta + 10) % 10]++
    if (row.openSutta === actualOpenSutta) stats.currentOpenCond[row.closeSutta]++
  }

  if (actualOpenSutta !== undefined && actualOpenSutta >= 0) {
    stats.currentOpenOpposite[opposite(actualOpenSutta)] += 1
    for (let s = 0; s <= 9; s++) {
      if (house(s) === house(actualOpenSutta)) stats.currentOpenSameHouse[s] += 1
      else stats.currentOpenOppHouse[s] += 1
    }
  }

  for (const row of prior) {
    const rowIso = getRecordISODate(row)
    if (!rowIso) continue
    const rowDate = new Date(`${rowIso}T12:00:00Z`)
    if (rowDate.getUTCDate() === dayOfMonth) {
      stats.sameDate[row.closeSutta]++
      stats.sameDateOpposite[opposite(row.closeSutta)]++
    }
  }
  for (const row of prior.filter((record) => record.day === day).slice(-24)) stats.sameWeekdayRecent[row.closeSutta]++

  const marketIndex = MARKET_ORDER.indexOf(market)
  const sourceMarket = marketIndex > 0 ? MARKET_ORDER[marketIndex - 1] : MARKET_ORDER[MARKET_ORDER.length - 1]
  const sourceLast = sourceMarket ? allPrior[sourceMarket]?.[allPrior[sourceMarket].length - 1] : null
  if (sourceLast?.closeSutta !== undefined) {
    for (const row of prior.slice(-220)) if (sourceLast.closeSutta === row.closeSutta) stats.sourcePrevCloseCond[row.closeSutta]++
  }
  if (sourceLast?.openSutta !== undefined) {
    for (const row of prior.slice(-220)) if (sourceLast.openSutta === row.openSutta) stats.sourcePrevOpenCond[row.closeSutta]++
  }

  stats.prevClose = prevClose
  stats.prevOpen = prevOpen
  return stats
}

function closeVariant(name, picks, droughts, count, stats) {
  const current = currentProduction(picks, droughts, count)
  const buckets = stats
  const totals = {
    long: stats.close.length,
    recent12: Math.min(12, stats.close.length),
    recent24: Math.min(24, stats.close.length),
    recent60: Math.min(60, stats.close.length),
    weekday: stats.close.filter((entry) => entry.day === stats.day).length,
    sameDate: stats.sameDate.reduce((a, b) => a + b, 0),
    sameDateOpposite: stats.sameDateOpposite.reduce((a, b) => a + b, 0),
    sameWeekdayRecent: stats.sameWeekdayRecent.reduce((a, b) => a + b, 0),
    prevCloseCond: stats.prevCloseCond.reduce((a, b) => a + b, 0),
    prevOpenCond: stats.prevOpenCond.reduce((a, b) => a + b, 0),
    prevJodiCond: stats.prevJodiCond.reduce((a, b) => a + b, 0),
    currentOpenCond: stats.currentOpenCond.reduce((a, b) => a + b, 0),
    currentOpenOpposite: 1,
    currentOpenSameHouse: 5,
    currentOpenOppHouse: 5,
    prevCloseDelta: Math.max(1, stats.close.length - 1),
    prevOpenDelta: Math.max(1, stats.close.length - 1),
    sourcePrevCloseCond: stats.sourcePrevCloseCond.reduce((a, b) => a + b, 0),
    sourcePrevOpenCond: stats.sourcePrevOpenCond.reduce((a, b) => a + b, 0),
  }
  const previousClose = stats.prevClose ?? 0
  const previousOpen = stats.prevOpen ?? 0

  if (name === 'currentProduction') return current
  if (name === 'currentUi') return currentUi(picks, droughts, count)
  if (name === 'rankOnly') return uniqueByPickRank(picks).slice(0, count).map((row) => row.sutta)
  if (name === 'sumCooling') return pickAggregate(picks, droughts, count, { base: 'sum', bonus: { fresh: 8, warming: 5, danger: 0, cooling: 12, snapback: 8 } })
  if (name === 'weightedFresh') return pickAggregate(picks, droughts, count, { base: 'weighted', bonus: { fresh: 20, warming: 8, danger: -8, cooling: -4, snapback: 6 } })
  if (name === 'calendarSameDate') return take(scoreRowsFromBuckets(buckets, { recent24: 0.2, weekday: 0.1, sameDate: 0.7 }, totals), count)
  if (name === 'calendarSameDateOpposite') return take(scoreRowsFromBuckets(buckets, { recent24: 0.2, sameDateOpposite: 0.8 }, totals), count)
  if (name === 'sameWeekdayRecent') return take(scoreRowsFromBuckets(buckets, { recent24: 0.35, sameWeekdayRecent: 0.65 }, totals), count)
  if (name === 'prevCloseCond') return take(scoreRowsFromBuckets(buckets, { recent24: 0.25, weekday: 0.15, prevCloseCond: 0.6 }, totals), count)
  if (name === 'prevOpenCond') return take(scoreRowsFromBuckets(buckets, { recent24: 0.25, weekday: 0.15, prevOpenCond: 0.6 }, totals), count)
  if (name === 'prevJodiCond') return take(scoreRowsFromBuckets(buckets, { recent24: 0.25, prevJodiCond: 0.75 }, totals), count)
  if (name === 'currentOpenCond') return take(scoreRowsFromBuckets(buckets, { recent24: 0.2, weekday: 0.1, currentOpenCond: 0.7 }, totals), count)
  if (name === 'currentOpenOpposite') return take(scoreRowsFromBuckets(buckets, { recent24: 0.2, currentOpenOpposite: 0.8 }, totals), count)
  if (name === 'currentOpenSameHouse') return take(scoreRowsFromBuckets(buckets, { recent24: 0.25, currentOpenSameHouse: 0.75 }, totals), count)
  if (name === 'currentOpenOppHouse') return take(scoreRowsFromBuckets(buckets, { recent24: 0.25, currentOpenOppHouse: 0.75 }, totals), count)
  if (name === 'prevCloseDelta') {
    const rows = Array.from({ length: 10 }, (_, sutta) => {
      const delta = (sutta - previousClose + 10) % 10
      return { sutta, score: 0.25 * smoothedRate(stats.recent24[sutta], totals.recent24) + 0.2 * smoothedRate(stats.weekday[sutta], totals.weekday) + 0.55 * smoothedRate(stats.prevCloseDelta[delta], totals.prevCloseDelta) }
    })
    return take(rows, count)
  }
  if (name === 'prevOpenDelta') {
    const rows = Array.from({ length: 10 }, (_, sutta) => {
      const delta = (sutta - previousOpen + 10) % 10
      return { sutta, score: 0.25 * smoothedRate(stats.recent24[sutta], totals.recent24) + 0.2 * smoothedRate(stats.weekday[sutta], totals.weekday) + 0.55 * smoothedRate(stats.prevOpenDelta[delta], totals.prevOpenDelta) }
    })
    return take(rows, count)
  }
  if (name === 'sourcePrevCloseCond') return take(scoreRowsFromBuckets(buckets, { recent24: 0.25, weekday: 0.15, sourcePrevCloseCond: 0.6 }, totals), count)
  if (name === 'sourcePrevOpenCond') return take(scoreRowsFromBuckets(buckets, { recent24: 0.25, weekday: 0.15, sourcePrevOpenCond: 0.6 }, totals), count)
  throw new Error(`Unknown variant ${name}`)
}

const VARIANTS = [
  'currentProduction',
  'currentUi',
  'rankOnly',
  'sumCooling',
  'weightedFresh',
  'calendarSameDate',
  'calendarSameDateOpposite',
  'sameWeekdayRecent',
  'prevCloseCond',
  'prevOpenCond',
  'prevJodiCond',
  'currentOpenCond',
  'currentOpenOpposite',
  'currentOpenSameHouse',
  'currentOpenOppHouse',
  'prevCloseDelta',
  'prevOpenDelta',
  'sourcePrevCloseCond',
  'sourcePrevOpenCond',
]

const STABLE_GUARDED_MAP = {
  Sridevi: { 4: 'currentOpenOppHouse', 6: 'calendarSameDateOpposite' },
  'Time Bazar': { 4: 'prevOpenCond', 6: 'currentOpenSameHouse' },
  'Madhur Day': { 4: 'prevJodiCond', 6: 'currentProduction' },
  'Milan Day': { 4: 'rankOnly', 6: 'sumCooling' },
  'Rajdhani Day': { 4: 'currentOpenCond', 6: 'prevCloseCond' },
  Kalyan: { 4: 'calendarSameDate', 6: 'prevCloseCond' },
  'Sridevi Night': { 4: 'currentProduction', 6: 'calendarSameDate' },
  'Kalyan Night': { 4: 'currentUi', 6: 'currentOpenCond' },
  'Madhur Night': { 4: 'rankOnly', 6: 'rankOnly' },
  'Milan Night': { 4: 'currentOpenOppHouse', 6: 'currentProduction' },
  'Rajdhani Night': { 4: 'weightedFresh', 6: 'rankOnly' },
  'Main Bazar': { 4: 'currentProduction', 6: 'sourcePrevCloseCond' },
}

async function run(days = 30) {
  const all = await fetchAll()
  const datedByMarket = Object.fromEntries(Object.entries(all).map(([market, records]) => [market, dated(records)]))
  const cutoffs = Object.fromEntries(
    Object.entries(datedByMarket).map(([market, rows]) => [market, rows.slice(-days).map((row) => row.isoDate)]),
  )
  const results = {}
  const marketRows = {}

  for (const market of MARKET_ORDER) {
    const rows = datedByMarket[market]
    marketRows[market] = {}
    for (const row of rows) {
      if (!cutoffs[market].includes(row.isoDate)) continue
      const index = rows.findIndex((item) => item.isoDate === row.isoDate)
      const priorRows = rows.slice(0, index)
      if (priorRows.length < MIN_TRAINING || row.record.closeSutta < 0) continue
      const prior = priorRows.map((item) => item.record)
      const allPrior = {}
      for (const otherMarket of MARKET_ORDER) {
        allPrior[otherMarket] = datedByMarket[otherMarket]
          .filter((item) => item.isoDate < row.isoDate)
          .map((item) => item.record)
      }
      const prediction = analyzeMarket(market, prior, allPrior)
      if (!prediction) continue
      const stats = relationStats(prior, allPrior, market, row.isoDate, row.record.openSutta)
      const actual = row.record.closeSutta
      for (const variant of VARIANTS) {
        for (const count of COUNTS) {
          const key = `${variant}@${count}`
          const picks = closeVariant(variant, prediction.closePicks, prediction.closeSuttaDroughts, count, stats)
          const result = (results[key] ??= { hit: 0, n: 0 })
          result.hit += picks.includes(actual) ? 1 : 0
          result.n++
          const marketResult = (marketRows[market][key] ??= { hit: 0, n: 0 })
          marketResult.hit += picks.includes(actual) ? 1 : 0
          marketResult.n++
        }
      }
    }
  }

  console.log(`\nClose sutta research over last ${days} available close results`)
  console.log('\nTop global variants')
  for (const count of COUNTS) {
    const sorted = Object.entries(results)
      .filter(([key]) => key.endsWith(`@${count}`))
      .sort((a, b) => pct(b[1].hit, b[1].n) - pct(a[1].hit, a[1].n))
      .slice(0, 8)
    console.log(`\n@${count}`)
    for (const [key, value] of sorted) console.log(`${key.padEnd(26)} ${fmt(pct(value.hit, value.n)).toFixed(1)}% (${value.hit}/${value.n})`)
  }

  console.log('\nMarket guarded best versus current production')
  const chosen = {}
  for (const market of MARKET_ORDER) {
    chosen[market] = {}
    console.log(`\n${market}`)
    for (const count of [4, 6]) {
      const current = marketRows[market][`currentProduction@${count}`]
      const best = Object.entries(marketRows[market])
        .filter(([key]) => key.endsWith(`@${count}`))
        .sort((a, b) => pct(b[1].hit, b[1].n) - pct(a[1].hit, a[1].n))[0]
      const accepted = pct(best[1].hit, best[1].n) >= pct(current.hit, current.n) ? best : [`currentProduction@${count}`, current]
      chosen[market][count] = accepted[0].replace(`@${count}`, '')
      console.log(
        `@${count} current=${fmt(pct(current.hit, current.n)).toFixed(1)}% (${current.hit}/${current.n}) ` +
        `best=${accepted[0]} ${fmt(pct(accepted[1].hit, accepted[1].n)).toFixed(1)}% (${accepted[1].hit}/${accepted[1].n})`,
      )
    }
  }

  const guarded = { 4: { hit: 0, n: 0 }, 6: { hit: 0, n: 0 } }
  const current = { 4: { hit: 0, n: 0 }, 6: { hit: 0, n: 0 } }
  for (const market of MARKET_ORDER) {
    for (const count of [4, 6]) {
      const c = marketRows[market][`currentProduction@${count}`]
      current[count].hit += c.hit
      current[count].n += c.n
      const g = marketRows[market][`${chosen[market][count]}@${count}`]
      guarded[count].hit += g.hit
      guarded[count].n += g.n
    }
  }
  console.log('\nGuarded portfolio')
  for (const count of [4, 6]) {
    console.log(`@${count} current=${fmt(pct(current[count].hit, current[count].n)).toFixed(1)}% (${current[count].hit}/${current[count].n}) guarded=${fmt(pct(guarded[count].hit, guarded[count].n)).toFixed(1)}% (${guarded[count].hit}/${guarded[count].n})`)
  }
  console.log('\nStable 60-day map applied to this window')
  const stable = { 4: { hit: 0, n: 0 }, 6: { hit: 0, n: 0 } }
  for (const market of MARKET_ORDER) {
    const c4 = marketRows[market]['currentProduction@4']
    const s4 = marketRows[market][`${STABLE_GUARDED_MAP[market][4]}@4`]
    const c6 = marketRows[market]['currentProduction@6']
    const s6 = marketRows[market][`${STABLE_GUARDED_MAP[market][6]}@6`]
    stable[4].hit += s4.hit
    stable[4].n += s4.n
    stable[6].hit += s6.hit
    stable[6].n += s6.n
    console.log(
      `${market.padEnd(15)} ` +
      `@4 ${fmt(pct(c4.hit, c4.n)).toFixed(1)} -> ${fmt(pct(s4.hit, s4.n)).toFixed(1)} (${STABLE_GUARDED_MAP[market][4]}) ` +
      `@6 ${fmt(pct(c6.hit, c6.n)).toFixed(1)} -> ${fmt(pct(s6.hit, s6.n)).toFixed(1)} (${STABLE_GUARDED_MAP[market][6]})`,
    )
  }
  for (const count of [4, 6]) {
    console.log(`stable @${count}=${fmt(pct(stable[count].hit, stable[count].n)).toFixed(1)}% (${stable[count].hit}/${stable[count].n})`)
  }
  console.log('\nChosen strategy map')
  console.log(JSON.stringify(chosen, null, 2))
}

run(Number(process.argv[2] ?? 30)).catch((error) => {
  console.error(error)
  process.exit(1)
})
