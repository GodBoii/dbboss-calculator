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
const { getRecordISODate } = require('../src/lib/backtest.ts')
const { analyzeMarket, buildContextFromResult, computeJodiAnalysis, getPanelKind } = require('../src/lib/predictor.ts')

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

const DAY_MARKETS = ['Sridevi', 'Time Bazar', 'Madhur Day', 'Milan Day', 'Rajdhani Day', 'Kalyan']
const NIGHT_MARKETS = ['Sridevi Night', 'Kalyan Night', 'Madhur Night', 'Milan Night', 'Rajdhani Night', 'Main Bazar']
const MARKET_SEQUENCE = [...DAY_MARKETS, ...NIGHT_MARKETS]
const SESSION = Object.fromEntries([
  ...DAY_MARKETS.map((market) => [market, 'day']),
  ...NIGHT_MARKETS.map((market) => [market, 'night']),
])
const LIQUIDITY_SOURCE = {
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

function pct(value, total) {
  return total ? (value / total) * 100 : 0
}

function round(value) {
  return Number(value.toFixed(1))
}

function isDp(panel) {
  return getPanelKind(panel) === 'DP'
}

function isTp(panel) {
  return panel && panel.length === 3 && panel[0] === panel[1] && panel[1] === panel[2]
}

function isJodiDouble(jodi) {
  return typeof jodi === 'string' && jodi.length === 2 && jodi[0] === jodi[1]
}

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item) => item.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

async function fetchAll() {
  const all = {}
  for (const [market, url] of Object.entries(MARKET_URLS)) {
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

function buildDateMap(allRecords) {
  const byDate = new Map()
  for (const [market, records] of Object.entries(allRecords)) {
    for (const item of dated(records)) {
      if (!byDate.has(item.isoDate)) byDate.set(item.isoDate, {})
      byDate.get(item.isoDate)[market] = item.record
    }
  }
  return byDate
}

function previousDateISO(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function kindFeature(prefix, panel, features) {
  if (!panel) return
  const kind = getPanelKind(panel)
  features.push(`${prefix}.kind=${kind}`)
  features.push(`${prefix}.isDP=${kind === 'DP'}`)
  features.push(`${prefix}.isSP=${kind === 'SP'}`)
  if (kind === 'DP') {
    const counts = panel.split('').reduce((acc, digit) => {
      acc[digit] = (acc[digit] || 0) + 1
      return acc
    }, {})
    const repeated = Object.entries(counts).find(([, count]) => count === 2)?.[0]
    if (repeated) features.push(`${prefix}.dpDigit=${repeated}`)
  }
}

function suttaFeature(prefix, value, features) {
  if (typeof value !== 'number' || value < 0) return
  features.push(`${prefix}.sutta=${value}`)
  features.push(`${prefix}.suttaParity=${value % 2 === 0 ? 'even' : 'odd'}`)
  features.push(`${prefix}.suttaBand=${value <= 3 ? 'low' : value <= 6 ? 'mid' : 'high'}`)
}

function countDp(records, side) {
  return records.filter((record) => isDp(record[side === 'open' ? 'openPanel' : 'closePanel'])).length
}

function buildBaseFeatures({ market, side, isoDate, prior, priorAll, byDate, prediction, jodiResult }) {
  const features = []
  const session = SESSION[market]
  const source = LIQUIDITY_SOURCE[market]
  const sameDate = byDate.get(isoDate) || {}
  const previousDate = byDate.get(previousDateISO(isoDate)) || {}
  const marketIndex = MARKET_SEQUENCE.indexOf(market)
  const earlierMarkets = MARKET_SEQUENCE.slice(0, Math.max(0, marketIndex)).filter((m) => sameDate[m])
  const earlierRecords = earlierMarkets.map((m) => sameDate[m])
  const sameDateDayRecords = DAY_MARKETS.map((m) => sameDate[m]).filter(Boolean)
  const previousNightRecords = NIGHT_MARKETS.map((m) => previousDate[m]).filter(Boolean)
  const priorSameMarket = prior[prior.length - 1]
  const sourcePrior = source ? (priorAll[source] || [])[(priorAll[source] || []).length - 1] : null
  const pickSet = side === 'open'
    ? prediction.openPicks
    : side === 'close'
    ? prediction.closePicks
    : jodiResult.adjustedClosePicks
  const kindPrediction = side === 'open'
    ? prediction.openKindPrediction
    : side === 'close'
    ? prediction.closeKindPrediction
    : jodiResult.kindPrediction

  features.push(`target.market=${market}`)
  features.push(`target.session=${session}`)
  features.push(`target.side=${side}`)
  features.push(`target.day=${new Date(`${isoDate}T12:00:00Z`).getUTCDay()}`)
  features.push(`model.predKind=${kindPrediction.predictedKind}`)
  features.push(`model.dpTop30=${kindPrediction.top30Counts.DP}`)
  features.push(`model.dpTop30Band=${kindPrediction.top30Counts.DP <= 3 ? 'low' : kindPrediction.top30Counts.DP <= 6 ? 'mid' : 'high'}`)
  features.push(`model.dpTop10=${pickSet.slice(0, 10).filter((pick) => pick.kind === 'DP').length}`)
  features.push(`model.dpTop3=${pickSet.slice(0, 3).filter((pick) => pick.kind === 'DP').length}`)
  features.push(`model.dpScoreLead=${Math.round((kindPrediction.scores.DP - kindPrediction.scores.SP) / 500) * 500}`)

  if (priorSameMarket) {
    kindFeature('sameMarket.prev.open', priorSameMarket.openPanel, features)
    kindFeature('sameMarket.prev.close', priorSameMarket.closePanel, features)
    suttaFeature('sameMarket.prev.open', priorSameMarket.openSutta, features)
    suttaFeature('sameMarket.prev.close', priorSameMarket.closeSutta, features)
    features.push(`sameMarket.prev.jodiDouble=${isJodiDouble(priorSameMarket.jodi)}`)
  }

  if (sourcePrior) {
    kindFeature('source.prev.open', sourcePrior.openPanel, features)
    kindFeature('source.prev.close', sourcePrior.closePanel, features)
    suttaFeature('source.prev.open', sourcePrior.openSutta, features)
    suttaFeature('source.prev.close', sourcePrior.closeSutta, features)
    features.push(`source.prev.jodiDouble=${isJodiDouble(sourcePrior.jodi)}`)
    features.push(`source.prev.anyDP=${isDp(sourcePrior.openPanel) || isDp(sourcePrior.closePanel)}`)
  }

  if (earlierRecords.length > 0) {
    const earlierOpenDp = countDp(earlierRecords, 'open')
    const earlierCloseDp = countDp(earlierRecords, 'close')
    features.push(`sameDate.earlier.openDpCount=${Math.min(3, earlierOpenDp)}`)
    features.push(`sameDate.earlier.closeDpCount=${Math.min(3, earlierCloseDp)}`)
    features.push(`sameDate.earlier.anyOpenDP=${earlierOpenDp > 0}`)
    features.push(`sameDate.earlier.anyCloseDP=${earlierCloseDp > 0}`)
    const lastEarlier = earlierRecords[earlierRecords.length - 1]
    kindFeature('sameDate.prevMarket.open', lastEarlier.openPanel, features)
    kindFeature('sameDate.prevMarket.close', lastEarlier.closePanel, features)
    features.push(`sameDate.prevMarket.jodiDouble=${isJodiDouble(lastEarlier.jodi)}`)
  }

  if (session === 'night' && sameDateDayRecords.length > 0) {
    const dayOpenDp = countDp(sameDateDayRecords, 'open')
    const dayCloseDp = countDp(sameDateDayRecords, 'close')
    features.push(`dayToNight.openDpCount=${Math.min(4, dayOpenDp)}`)
    features.push(`dayToNight.closeDpCount=${Math.min(4, dayCloseDp)}`)
    features.push(`dayToNight.anyJodiDouble=${sameDateDayRecords.some((record) => isJodiDouble(record.jodi))}`)
  }

  if (session === 'day' && previousNightRecords.length > 0) {
    const nightOpenDp = countDp(previousNightRecords, 'open')
    const nightCloseDp = countDp(previousNightRecords, 'close')
    features.push(`nightToDay.openDpCount=${Math.min(4, nightOpenDp)}`)
    features.push(`nightToDay.closeDpCount=${Math.min(4, nightCloseDp)}`)
    features.push(`nightToDay.anyJodiDouble=${previousNightRecords.some((record) => isJodiDouble(record.jodi))}`)
  }

  return features
}

function buildCases(allRecords, days) {
  const byDate = buildDateMap(allRecords)
  const allDated = Object.fromEntries(Object.entries(allRecords).map(([market, records]) => [market, dated(records)]))
  const cases = []

  for (const market of Object.keys(MARKET_URLS)) {
    const marketRows = allDated[market]
    const endDate = marketRows[marketRows.length - 1].isoDate
    const startDateObj = new Date(`${endDate}T00:00:00Z`)
    startDateObj.setUTCDate(startDateObj.getUTCDate() - days + 1)
    const startDate = startDateObj.toISOString().slice(0, 10)

    for (let i = 0; i < marketRows.length; i++) {
      const item = marketRows[i]
      if (item.isoDate < startDate || item.isoDate > endDate) continue
      const prior = marketRows.slice(0, i).filter((row) => row.isoDate < item.isoDate).map((row) => row.record)
      if (prior.length < 50) continue

      const priorAll = {}
      for (const [m, rows] of Object.entries(allDated)) {
        const cutoff = rows.findIndex((row) => row.isoDate >= item.isoDate)
        const end = cutoff === -1 ? rows.length : cutoff
        priorAll[m] = rows.slice(0, end).map((row) => row.record)
      }
      priorAll[market] = prior

      const prediction = analyzeMarket(market, prior, priorAll, new Date(`${item.isoDate}T12:00:00Z`))
      if (!prediction) continue
      const jodiResult = computeJodiAnalysis(item.record.openSutta, item.record.openPanel || null, prior, buildContextFromResult(prediction))

      for (const side of ['open', 'close', 'jodi']) {
        const panel = side === 'open' ? item.record.openPanel : item.record.closePanel
        if (!panel || isTp(panel)) continue
        const features = buildBaseFeatures({
          market,
          side,
          isoDate: item.isoDate,
          prior,
          priorAll,
          byDate,
          prediction,
          jodiResult,
        })
        cases.push({
          market,
          session: SESSION[market],
          side,
          isoDate: item.isoDate,
          actualDp: isDp(panel),
          features: Array.from(new Set(features)),
        })
      }
    }
  }

  return cases
}

function evaluateRules(cases, maxPairs = true) {
  const stats = new Map()

  function add(rule, actualDp) {
    const item = stats.get(rule) || { support: 0, hits: 0 }
    item.support++
    if (actualDp) item.hits++
    stats.set(rule, item)
  }

  for (const item of cases) {
    for (const feature of item.features) add(feature, item.actualDp)
    if (!maxPairs) continue
    for (let i = 0; i < item.features.length; i++) {
      for (let j = i + 1; j < item.features.length; j++) {
        add(`${item.features[i]} && ${item.features[j]}`, item.actualDp)
      }
    }
  }

  return [...stats.entries()]
    .map(([rule, item]) => ({
      rule,
      support: item.support,
      hits: item.hits,
      precision: pct(item.hits, item.support),
    }))
    .filter((rule) => rule.support >= 20)
    .sort((a, b) => b.precision - a.precision || b.support - a.support)
}

function summarize(cases) {
  const grouped = {}
  for (const item of cases) {
    const key = `${item.side}/${item.session}`
    const bucket = grouped[key] || { n: 0, dp: 0 }
    bucket.n++
    if (item.actualDp) bucket.dp++
    grouped[key] = bucket
  }
  return Object.entries(grouped).map(([key, item]) => ({
    segment: key,
    n: item.n,
    dpRate: round(pct(item.dp, item.n)),
  }))
}

function compact(rule) {
  return {
    precision: round(rule.precision),
    support: rule.support,
    hits: rule.hits,
    rule: rule.rule,
  }
}

function validateRules(rules, cases) {
  return rules.map((rule) => {
    const parts = rule.rule.split(' && ')
    let support = 0
    let hits = 0
    for (const item of cases) {
      if (!parts.every((part) => item.features.includes(part))) continue
      support++
      if (item.actualDp) hits++
    }
    return {
      rule: rule.rule,
      trainPrecision: rule.precision,
      trainSupport: rule.support,
      precision: pct(hits, support),
      support,
      hits,
    }
  })
}

async function main() {
  const days = parseInt(process.argv[2] || '365', 10)
  console.log(`Fetching source data and mining DP rules over last ${days} days...`)
  const allRecords = await fetchAll()
  const cases = buildCases(allRecords, days)
  console.log(`Cases: ${cases.length}`)
  console.log('\nBase DP rates')
  console.table(summarize(cases))

  const allRules = evaluateRules(cases)
  console.log('\nBest global DP rules, min support 20')
  console.table(allRules.slice(0, 20).map(compact))

  for (const side of ['open', 'close', 'jodi']) {
    const sideRules = evaluateRules(cases.filter((item) => item.side === side))
    console.log(`\nBest ${side} DP rules, min support 20`)
    console.table(sideRules.slice(0, 15).map(compact))
  }

  for (const session of ['day', 'night']) {
    const sessionRules = evaluateRules(cases.filter((item) => item.session === session))
    console.log(`\nBest ${session} session DP rules, min support 20`)
    console.table(sessionRules.slice(0, 15).map(compact))
  }

  const highPrecision = allRules.filter((rule) => rule.precision >= 95)
  console.log('\nRules >=95% precision')
  console.table(highPrecision.slice(0, 20).map(compact))

  const sortedDates = [...new Set(cases.map((item) => item.isoDate))].sort()
  const cutoffDate = sortedDates[Math.max(0, sortedDates.length - 90)]
  const trainCases = cases.filter((item) => item.isoDate < cutoffDate)
  const validationCases = cases.filter((item) => item.isoDate >= cutoffDate)
  const trainRules = evaluateRules(trainCases).filter((rule) => rule.precision >= 60 && rule.support >= 20)
  const validated = validateRules(trainRules, validationCases)
    .filter((rule) => rule.support >= 10)
    .sort((a, b) => b.precision - a.precision || b.support - a.support)

  console.log(`\nWalk-forward validation: train before ${cutoffDate}, validate from ${cutoffDate}`)
  console.log(`Train cases: ${trainCases.length}, validation cases: ${validationCases.length}`)
  console.table(validated.slice(0, 20).map((rule) => ({
    validationPrecision: round(rule.precision),
    validationSupport: rule.support,
    validationHits: rule.hits,
    trainPrecision: round(rule.trainPrecision),
    trainSupport: rule.trainSupport,
    rule: rule.rule,
  })))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
