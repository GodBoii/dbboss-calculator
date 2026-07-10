const fs = require('fs')
const path = require('path')
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

function round(value, digits = 1) {
  return Number(value.toFixed(digits))
}

function kind(panel) {
  if (!panel || panel.length !== 3) return 'NONE'
  const unique = new Set(panel.split('')).size
  if (unique === 1) return 'TP'
  if (unique === 2) return 'DP'
  return 'SP'
}

function repeatedDigit(panel) {
  if (kind(panel) !== 'DP') return null
  const counts = {}
  for (const digit of panel) counts[digit] = (counts[digit] || 0) + 1
  return Object.entries(counts).find(([, count]) => count === 2)?.[0] ?? null
}

function sutta(panel) {
  if (!panel || panel.length !== 3) return -1
  return panel.split('').reduce((sum, digit) => sum + Number(digit), 0) % 10
}

function gapBin(gap) {
  if (gap == null) return 'never'
  if (gap <= 1) return '1'
  if (gap <= 2) return '2'
  if (gap <= 3) return '3'
  if (gap <= 5) return '4-5'
  if (gap <= 8) return '6-8'
  if (gap <= 13) return '9-13'
  return '14+'
}

function monthBand(isoDate) {
  const day = Number(isoDate.slice(8, 10))
  if (day <= 5) return '1-5'
  if (day >= 25) return '25+'
  return '6-24'
}

function previousDateISO(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function dated(records) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item) => item.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

function quantile(values, q) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))
  return sorted[index]
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

function buildMaps(allRecords) {
  const allDated = Object.fromEntries(Object.entries(allRecords).map(([market, records]) => [market, dated(records)]))
  const byDate = new Map()
  const byMarketDate = new Map()

  for (const [market, rows] of Object.entries(allDated)) {
    for (const item of rows) {
      if (!byDate.has(item.isoDate)) byDate.set(item.isoDate, {})
      byDate.get(item.isoDate)[market] = item.record
      byMarketDate.set(`${market}|${item.isoDate}`, item.record)
    }
  }

  return { allDated, byDate, byMarketDate }
}

function eventFromRecord(market, isoDate, record, side) {
  const panel = side === 'open' ? record.openPanel : record.closePanel
  return {
    market,
    session: SESSION[market],
    isoDate,
    day: record.day,
    side,
    panel,
    kind: kind(panel),
    sutta: sutta(panel),
    first: panel?.[0] ?? '',
    last: panel?.[2] ?? '',
    repeatedDigit: repeatedDigit(panel),
  }
}

function addPanelFeature(prefix, event, features) {
  if (!event?.panel) return
  features.push(`${prefix}.kind=${event.kind}`)
  features.push(`${prefix}.sutta=${event.sutta}`)
  features.push(`${prefix}.first=${event.first}`)
  features.push(`${prefix}.last=${event.last}`)
  features.push(`${prefix}.firstLast=${event.first}${event.last}`)
  if (event.repeatedDigit != null) features.push(`${prefix}.dpDigit=${event.repeatedDigit}`)
}

function addDigitCarry(prefix, source, target, features) {
  if (!source?.panel || !target?.panel) return
  const targetDigits = new Set(target.panel.split(''))
  features.push(`${prefix}.sourceFirstInTarget=${targetDigits.has(source.first)}`)
  features.push(`${prefix}.sourceLastInTarget=${targetDigits.has(source.last)}`)
  features.push(`${prefix}.sourceFirstToTargetFirst=${source.first === target.first}`)
  features.push(`${prefix}.sourceLastToTargetLast=${source.last === target.last}`)
  if (source.repeatedDigit != null) {
    features.push(`${prefix}.dpDigitInTarget=${targetDigits.has(source.repeatedDigit)}`)
    features.push(`${prefix}.dpDigitToTargetFirst=${source.repeatedDigit === target.first}`)
    features.push(`${prefix}.dpDigitToTargetLast=${source.repeatedDigit === target.last}`)
  }
}

function buildCases(allRecords) {
  const { allDated, byDate } = buildMaps(allRecords)
  const cases = []

  for (const [market, rows] of Object.entries(allDated)) {
    for (let i = 0; i < rows.length; i++) {
      const { record, isoDate } = rows[i]
      const priorRows = rows.slice(0, i)
      if (priorRows.length < 60) continue

      for (const side of ['open', 'close']) {
        const target = eventFromRecord(market, isoDate, record, side)
        if (!target.panel || target.kind === 'TP') continue

        const features = [
          `target.market=${market}`,
          `target.session=${target.session}`,
          `target.side=${side}`,
          `target.day=${record.day}`,
          `target.monthBand=${monthBand(isoDate)}`,
        ]

        const sameSideHistory = priorRows.map((row) => eventFromRecord(market, row.isoDate, row.record, side))
        const lastSameSide = sameSideHistory[sameSideHistory.length - 1]
        const lastRecord = priorRows[priorRows.length - 1]
        const prevOpen = lastRecord ? eventFromRecord(market, lastRecord.isoDate, lastRecord.record, 'open') : null
        const prevClose = lastRecord ? eventFromRecord(market, lastRecord.isoDate, lastRecord.record, 'close') : null
        const lastSameWeekday = [...sameSideHistory].reverse().find((event) => event.day === record.day)
        const previousDPIndex = (() => {
          for (let j = sameSideHistory.length - 1; j >= 0; j--) {
            if (sameSideHistory[j].kind === 'DP') return j
          }
          return -1
        })()
        const dpGap = previousDPIndex >= 0 ? sameSideHistory.length - previousDPIndex : null

        features.push(`sameSide.dpGapBin=${gapBin(dpGap)}`)
        if (dpGap != null) features.push(`sameSide.dpGapParity=${dpGap % 2 === 0 ? 'even' : 'odd'}`)

        addPanelFeature('sameSide.prev', lastSameSide, features)
        addPanelFeature('prevRecord.open', prevOpen, features)
        addPanelFeature('prevRecord.close', prevClose, features)
        addPanelFeature('sameWeekday.prev', lastSameWeekday, features)
        addDigitCarry('sameSide.prev', lastSameSide, target, features)
        addDigitCarry('prevRecord.open', prevOpen, target, features)
        addDigitCarry('prevRecord.close', prevClose, target, features)
        addDigitCarry('sameWeekday.prev', lastSameWeekday, target, features)

        if (side === 'close') {
          const currentOpen = eventFromRecord(market, isoDate, record, 'open')
          addPanelFeature('sameDate.open', currentOpen, features)
          addDigitCarry('sameDate.openToClose', currentOpen, target, features)
          features.push(`sameDate.jodiDouble=${record.jodi?.[0] === record.jodi?.[1]}`)
        }

        const sameDate = byDate.get(isoDate) || {}
        const previousDate = byDate.get(previousDateISO(isoDate)) || {}
        const marketIndex = MARKET_SEQUENCE.indexOf(market)
        const earlierMarkets = MARKET_SEQUENCE.slice(0, Math.max(0, marketIndex)).filter((m) => sameDate[m])
        const earlierEvents = earlierMarkets.flatMap((m) => [
          eventFromRecord(m, isoDate, sameDate[m], 'open'),
          eventFromRecord(m, isoDate, sameDate[m], 'close'),
        ])
        const dayDpCount = earlierEvents.filter((event) => event.kind === 'DP').length
        features.push(`sameDate.earlierDpCount=${Math.min(5, dayDpCount)}`)
        if (earlierEvents.length > 0) {
          addPanelFeature('sameDate.prevMarket.open', earlierEvents[earlierEvents.length - 2], features)
          addPanelFeature('sameDate.prevMarket.close', earlierEvents[earlierEvents.length - 1], features)
          addDigitCarry('sameDate.prevMarket.close', earlierEvents[earlierEvents.length - 1], target, features)
        }

        const source = LIQUIDITY_SOURCE[market]
        if (source) {
          const sourceRows = allDated[source].filter((row) => row.isoDate < isoDate)
          const sourceLast = sourceRows[sourceRows.length - 1]
          if (sourceLast) {
            const sourceOpen = eventFromRecord(source, sourceLast.isoDate, sourceLast.record, 'open')
            const sourceClose = eventFromRecord(source, sourceLast.isoDate, sourceLast.record, 'close')
            addPanelFeature('source.prev.open', sourceOpen, features)
            addPanelFeature('source.prev.close', sourceClose, features)
            addDigitCarry('source.prev.open', sourceOpen, target, features)
            addDigitCarry('source.prev.close', sourceClose, target, features)
          }
        }

        if (target.session === 'night') {
          const dayEvents = DAY_MARKETS.filter((m) => sameDate[m]).flatMap((m) => [
            eventFromRecord(m, isoDate, sameDate[m], 'open'),
            eventFromRecord(m, isoDate, sameDate[m], 'close'),
          ])
          features.push(`dayToNight.dpCount=${Math.min(8, dayEvents.filter((event) => event.kind === 'DP').length)}`)
        }

        if (target.session === 'day') {
          const nightEvents = NIGHT_MARKETS.filter((m) => previousDate[m]).flatMap((m) => [
            eventFromRecord(m, previousDateISO(isoDate), previousDate[m], 'open'),
            eventFromRecord(m, previousDateISO(isoDate), previousDate[m], 'close'),
          ])
          features.push(`nightToDay.dpCount=${Math.min(8, nightEvents.filter((event) => event.kind === 'DP').length)}`)
        }

        cases.push({
          ...target,
          actualDP: target.kind === 'DP',
          actualSP: target.kind === 'SP',
          features: Array.from(new Set(features)),
        })
      }
    }
  }

  return cases
}

function summarizeDaily(allRecords) {
  const { allDated, byDate } = buildMaps(allRecords)
  const dateRows = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([isoDate, markets]) => {
    const events = Object.entries(markets).flatMap(([market, record]) => [
      eventFromRecord(market, isoDate, record, 'open'),
      eventFromRecord(market, isoDate, record, 'close'),
    ]).filter((event) => event.panel)
    return {
      isoDate,
      events: events.length,
      dp: events.filter((event) => event.kind === 'DP').length,
      sp: events.filter((event) => event.kind === 'SP').length,
      tp: events.filter((event) => event.kind === 'TP').length,
    }
  })

  const distribution = {}
  for (const row of dateRows) distribution[row.dp] = (distribution[row.dp] || 0) + 1

  const marketRows = []
  for (const [market, rows] of Object.entries(allDated)) {
    for (const side of ['open', 'close']) {
      const events = rows.map((row) => eventFromRecord(market, row.isoDate, row.record, side)).filter((event) => event.panel)
      const dpIndexes = []
      events.forEach((event, index) => {
        if (event.kind === 'DP') dpIndexes.push(index)
      })
      const gaps = []
      for (let i = 1; i < dpIndexes.length; i++) gaps.push(dpIndexes[i] - dpIndexes[i - 1])
      const lastDP = dpIndexes[dpIndexes.length - 1]
      marketRows.push({
        market,
        side,
        n: events.length,
        dp: dpIndexes.length,
        dpRate: round(pct(dpIndexes.length, events.length)),
        avgGap: gaps.length ? round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null,
        medianGap: quantile(gaps, 0.5),
        p75Gap: quantile(gaps, 0.75),
        p90Gap: quantile(gaps, 0.9),
        maxGap: gaps.length ? Math.max(...gaps) : null,
        currentWait: lastDP == null ? null : events.length - 1 - lastDP,
      })
    }
  }

  return {
    dateRange: {
      start: dateRows[0]?.isoDate,
      end: dateRows[dateRows.length - 1]?.isoDate,
      days: dateRows.length,
    },
    totalEvents: dateRows.reduce((sum, row) => sum + row.events, 0),
    totalDP: dateRows.reduce((sum, row) => sum + row.dp, 0),
    totalSP: dateRows.reduce((sum, row) => sum + row.sp, 0),
    totalTP: dateRows.reduce((sum, row) => sum + row.tp, 0),
    dailyDPDistribution: distribution,
    averageDPPerCalendarDay: round(dateRows.reduce((sum, row) => sum + row.dp, 0) / dateRows.length, 2),
    marketRows: marketRows.sort((a, b) => b.dpRate - a.dpRate),
  }
}

function groupedRate(cases, keyFn, minN = 30) {
  const buckets = new Map()
  for (const item of cases) {
    const key = keyFn(item)
    if (key == null) continue
    const bucket = buckets.get(key) || { n: 0, dp: 0, sp: 0 }
    bucket.n++
    if (item.actualDP) bucket.dp++
    if (item.actualSP) bucket.sp++
    buckets.set(key, bucket)
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      n: bucket.n,
      dpRate: round(pct(bucket.dp, bucket.n)),
      spRate: round(pct(bucket.sp, bucket.n)),
    }))
    .filter((row) => row.n >= minN)
    .sort((a, b) => b.dpRate - a.dpRate || b.n - a.n)
}

function addRule(stats, rule, item, target) {
  const bucket = stats.get(rule) || { support: 0, hits: 0 }
  bucket.support++
  if (target === 'DP' ? item.actualDP : item.actualSP) bucket.hits++
  stats.set(rule, bucket)
}

function mineRules(cases, target, pairs = true) {
  const stats = new Map()
  for (const item of cases) {
    for (const feature of item.features) addRule(stats, feature, item, target)
  }

  const singleRules = [...stats.entries()].map(([rule, bucket]) => ({
    rule,
    support: bucket.support,
    hits: bucket.hits,
    precision: pct(bucket.hits, bucket.support),
  }))

  if (!pairs) return singleRules

  const candidateSingles = new Set(
    singleRules
      .filter((rule) => rule.support >= 30 && rule.precision >= (target === 'DP' ? 28 : 70))
      .sort((a, b) => b.precision - a.precision || b.support - a.support)
      .slice(0, 90)
      .map((rule) => rule.rule),
  )

  for (const item of cases) {
    const pairFeatures = item.features.filter((feature) => candidateSingles.has(feature)).slice(0, 35)
    for (let i = 0; i < pairFeatures.length; i++) {
      for (let j = i + 1; j < pairFeatures.length; j++) {
        addRule(stats, `${pairFeatures[i]} && ${pairFeatures[j]}`, item, target)
      }
    }
  }

  return [...stats.entries()].map(([rule, bucket]) => ({
    rule,
    support: bucket.support,
    hits: bucket.hits,
    precision: pct(bucket.hits, bucket.support),
  }))
}

function validateRule(rule, cases, target) {
  const parts = rule.rule.split(' && ')
  let support = 0
  let hits = 0
  for (const item of cases) {
    if (!parts.every((part) => item.features.includes(part))) continue
    support++
    if (target === 'DP' ? item.actualDP : item.actualSP) hits++
  }
  return {
    rule: rule.rule,
    trainSupport: rule.support,
    trainPrecision: rule.precision,
    support,
    hits,
    precision: pct(hits, support),
  }
}

function knownBeforeDrawCases(cases) {
  const leakPattern = /InTarget|ToTarget/
  return cases.map((item) => ({
    ...item,
    features: item.features.filter((feature) => !leakPattern.test(feature)),
  }))
}

function walkForward(cases, target) {
  cases = knownBeforeDrawCases(cases)
  const dates = [...new Set(cases.map((item) => item.isoDate))].sort()
  const cutoff = dates[Math.max(0, dates.length - 90)]
  const train = cases.filter((item) => item.isoDate < cutoff)
  const test = cases.filter((item) => item.isoDate >= cutoff)
  const baseRate = pct(test.filter((item) => target === 'DP' ? item.actualDP : item.actualSP).length, test.length)
  const trainRules = mineRules(train, target)
    .filter((rule) => rule.support >= 40 && rule.precision >= (target === 'DP' ? 35 : 78))
    .sort((a, b) => b.precision - a.precision || b.support - a.support)
    .slice(0, 400)
  const validated = trainRules
    .map((rule) => validateRule(rule, test, target))
    .filter((rule) => rule.support >= 12)
    .map((rule) => ({
      ...rule,
      lift: rule.precision - baseRate,
    }))
    .sort((a, b) => b.lift - a.lift || b.support - a.support)

  return { cutoff, trainN: train.length, testN: test.length, baseRate, rules: validated }
}

function table(rows, columns) {
  if (!rows.length) return '_No rows passed the support threshold._'
  const header = `| ${columns.join(' | ')} |`
  const sep = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${columns.map((column) => row[column] ?? '').join(' | ')} |`)
  return [header, sep, ...body].join('\n')
}

function compactRule(rule) {
  return {
    precision: round(rule.precision),
    lift: round(rule.lift),
    support: rule.support,
    hits: rule.hits,
    trainPrecision: round(rule.trainPrecision),
    trainSupport: rule.trainSupport,
    rule: rule.rule.replaceAll('|', '/'),
  }
}

function buildReport(summary, cases, dpWF, spWF) {
  const base = groupedRate(cases, (item) => `${item.side}/${item.session}`, 30)
  const weekday = groupedRate(cases, (item) => `${item.side}/${item.day}`, 40)
  const gap = groupedRate(cases, (item) => item.features.find((feature) => feature.startsWith('sameSide.dpGapBin='))?.split('=')[1], 40)
  const sameWeekday = groupedRate(cases, (item) => item.features.find((feature) => feature.startsWith('sameWeekday.prev.kind='))?.split('=')[1], 40)
  const closeOpenKind = groupedRate(cases.filter((item) => item.side === 'close'), (item) => item.features.find((feature) => feature.startsWith('sameDate.open.kind='))?.split('=')[1], 40)
  const openToCloseDigits = groupedRate(cases.filter((item) => item.side === 'close'), (item) => {
    const first = item.features.find((feature) => feature.startsWith('sameDate.openToClose.sourceFirstInTarget='))?.split('=')[1]
    const last = item.features.find((feature) => feature.startsWith('sameDate.openToClose.sourceLastInTarget='))?.split('=')[1]
    return first && last ? `openFirstInClose=${first}, openLastInClose=${last}` : null
  }, 40)

  const topMarketRows = summary.marketRows.slice(0, 12).map((row) => ({
    market: row.market,
    side: row.side,
    n: row.n,
    dpRate: `${row.dpRate}%`,
    avgGap: row.avgGap,
    medianGap: row.medianGap,
    p90Gap: row.p90Gap,
    maxGap: row.maxGap,
    currentWait: row.currentWait,
  }))

  const dailyDist = Object.entries(summary.dailyDPDistribution)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([dpCount, days]) => ({ dpCount, days }))

  return `# SP / DP Pattern Research

Generated: ${new Date().toISOString()}

## Dataset

- Markets: ${Object.keys(MARKET_URLS).length}
- Date range: ${summary.dateRange.start} to ${summary.dateRange.end}
- Calendar days seen: ${summary.dateRange.days}
- Open/close panels: ${summary.totalEvents}
- SP: ${summary.totalSP} (${round(pct(summary.totalSP, summary.totalEvents))}%)
- DP: ${summary.totalDP} (${round(pct(summary.totalDP, summary.totalEvents))}%)
- TP: ${summary.totalTP} (${round(pct(summary.totalTP, summary.totalEvents), 2)}%)
- Average DPs per calendar day across all markets/sides: ${summary.averageDPPerCalendarDay}

## How Many DPs Come Per Day

${table(dailyDist, ['dpCount', 'days'])}

## Highest DP Markets / Gaps

Gap means number of same-market same-side draws from one DP to the next. A gap of 1 means back-to-back DP.

${table(topMarketRows, ['market', 'side', 'n', 'dpRate', 'avgGap', 'medianGap', 'p90Gap', 'maxGap', 'currentWait'])}

## Base Rates

${table(base.map((row) => ({ segment: row.key, n: row.n, dpRate: `${row.dpRate}%`, spRate: `${row.spRate}%` })), ['segment', 'n', 'dpRate', 'spRate'])}

## Weekday Rates

${table(weekday.map((row) => ({ segment: row.key, n: row.n, dpRate: `${row.dpRate}%`, spRate: `${row.spRate}%` })).slice(0, 20), ['segment', 'n', 'dpRate', 'spRate'])}

## DP Gap Buckets

${table(gap.map((row) => ({ gap: row.key, n: row.n, dpRate: `${row.dpRate}%`, spRate: `${row.spRate}%` })), ['gap', 'n', 'dpRate', 'spRate'])}

## Same Weekday Repeat Test

This answers the "last Sunday had DP, can current Sunday get DP?" style question using the previous same weekday in the same market and same side.

${table(sameWeekday.map((row) => ({ previousSameWeekdayKind: row.key, n: row.n, dpRate: `${row.dpRate}%`, spRate: `${row.spRate}%` })), ['previousSameWeekdayKind', 'n', 'dpRate', 'spRate'])}

## Open To Close Tests

These rows are observational candidate clues, not standalone pre-draw kind predictors: they describe whether the eventual close panel reused digits from the known open panel.

${table(closeOpenKind.map((row) => ({ todayOpenKind: row.key, n: row.n, closeDpRate: `${row.dpRate}%`, closeSpRate: `${row.spRate}%` })), ['todayOpenKind', 'n', 'closeDpRate', 'closeSpRate'])}

${table(openToCloseDigits.map((row) => ({ digitCarry: row.key, n: row.n, closeDpRate: `${row.dpRate}%`, closeSpRate: `${row.spRate}%` })), ['digitCarry', 'n', 'closeDpRate', 'closeSpRate'])}

## Walk-Forward DP Rules

Known-before-draw features only. Train before ${dpWF.cutoff}; validate from ${dpWF.cutoff}. Validation DP baseline: ${round(dpWF.baseRate)}%.

${table(dpWF.rules.slice(0, 20).map(compactRule), ['precision', 'lift', 'support', 'hits', 'trainPrecision', 'trainSupport', 'rule'])}

## Walk-Forward SP Rules

Known-before-draw features only. Train before ${spWF.cutoff}; validate from ${spWF.cutoff}. Validation SP baseline: ${round(spWF.baseRate)}%.

${table(spWF.rules.slice(0, 20).map(compactRule), ['precision', 'lift', 'support', 'hits', 'trainPrecision', 'trainSupport', 'rule'])}

## Read This Before Changing The Predictor

The important score is validation lift, not training precision. A rule that looks strong in old data but has weak or negative lift in the final 90 days is probably curve-fit noise.
`
}

async function main() {
  console.log('Fetching all historical panel records...')
  const allRecords = await fetchAll()
  const summary = summarizeDaily(allRecords)
  const cases = buildCases(allRecords)
  console.log(`Built ${cases.length} SP/DP cases.`)

  const dpWF = walkForward(cases, 'DP')
  const spWF = walkForward(cases, 'SP')
  const report = buildReport(summary, cases, dpWF, spWF)
  const outDir = path.join(process.cwd(), 'backtest_reports', new Date().toISOString().slice(0, 10))
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'sp-dp-pattern-research.md')
  fs.writeFileSync(outPath, report)

  console.log(`Report written to ${outPath}`)
  console.log('\nTop validated DP rules')
  console.table(dpWF.rules.slice(0, 10).map(compactRule))
  console.log('\nTop validated SP rules')
  console.table(spWF.rules.slice(0, 10).map(compactRule))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
