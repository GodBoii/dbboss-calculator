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
const { analyzeMarket, getPanelKind } = require('../src/lib/predictor.ts')

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
const SIDES = ['open', 'close']
const DAY_MS = 24 * 60 * 60 * 1000

function pct(n, d, digits = 1) {
  return d ? Number(((n / d) * 100).toFixed(digits)) : 0
}

function round(n, digits = 2) {
  return Number(n.toFixed(digits))
}

function isoAddDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function panelFor(record, side) {
  return side === 'open' ? record.openPanel : record.closePanel
}

function sutta(panel) {
  if (!panel || panel.length !== 3) return null
  return panel.split('').reduce((sum, digit) => sum + Number(digit), 0) % 10
}

function kind(panel) {
  if (!panel || panel.length !== 3) return 'NONE'
  const unique = new Set(panel).size
  if (unique === 1) return 'TP'
  if (unique === 2) return 'DP'
  return 'SP'
}

function dpDigit(panel) {
  if (kind(panel) !== 'DP') return null
  const counts = {}
  for (const digit of panel) counts[digit] = (counts[digit] ?? 0) + 1
  return Object.entries(counts).find(([, count]) => count === 2)?.[0] ?? null
}

function firstLast(panel) {
  return panel && panel.length === 3 ? `${panel[0]}${panel[2]}` : null
}

function houseDigit(digit, mode) {
  const n = Number(digit)
  if (Number.isNaN(n)) return null
  if (mode === 'lowHigh') return n <= 4 ? 'L' : 'H'
  if (mode === 'opposite') return String(n % 5)
  if (mode === 'oddEven') return n % 2 ? 'O' : 'E'
  return null
}

function panelHouse(panel, mode) {
  if (!panel || panel.length !== 3) return null
  return panel.split('').map((digit) => houseDigit(digit, mode)).join('')
}

function digitSum(panel) {
  if (!panel || panel.length !== 3) return null
  return panel.split('').reduce((sum, digit) => sum + Number(digit), 0)
}

function dateParts(isoDate) {
  const dayOfMonth = Number(isoDate.slice(8, 10))
  return {
    dayOfMonth,
    dateBand: dayOfMonth <= 5 ? '1-5' : dayOfMonth >= 25 ? '25+' : '6-24',
    exactDate: String(dayOfMonth).padStart(2, '0'),
  }
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

function eventFromRecord(market, isoDate, record, side) {
  const panel = panelFor(record, side)
  return {
    market,
    side,
    isoDate,
    day: record.day,
    panel,
    kind: kind(panel),
    sutta: sutta(panel),
    dpDigit: dpDigit(panel),
    first: panel?.[0] ?? null,
    middle: panel?.[1] ?? null,
    last: panel?.[2] ?? null,
    firstLast: firstLast(panel),
    sum: digitSum(panel),
    lowHigh: panelHouse(panel, 'lowHigh'),
    oddEven: panelHouse(panel, 'oddEven'),
    opposite: panelHouse(panel, 'opposite'),
  }
}

function addPanelFeatures(features, prefix, event) {
  if (!event?.panel) return
  features.push(`${prefix}.kind=${event.kind}`)
  features.push(`${prefix}.sutta=${event.sutta}`)
  features.push(`${prefix}.first=${event.first}`)
  features.push(`${prefix}.middle=${event.middle}`)
  features.push(`${prefix}.last=${event.last}`)
  features.push(`${prefix}.firstLast=${event.firstLast}`)
  features.push(`${prefix}.sumBand=${event.sum <= 10 ? 'low' : event.sum <= 17 ? 'mid' : 'high'}`)
  features.push(`${prefix}.lowHigh=${event.lowHigh}`)
  features.push(`${prefix}.oddEven=${event.oddEven}`)
  if (event.dpDigit != null) features.push(`${prefix}.dpDigit=${event.dpDigit}`)
}

function buildMaps(allRecords) {
  const allDated = Object.fromEntries(Object.entries(allRecords).map(([market, records]) => [market, dated(records)]))
  const byDate = new Map()
  const byMarketDate = new Map()
  for (const [market, rows] of Object.entries(allDated)) {
    for (const row of rows) {
      if (!byDate.has(row.isoDate)) byDate.set(row.isoDate, {})
      byDate.get(row.isoDate)[market] = row.record
      byMarketDate.set(`${market}|${row.isoDate}`, row.record)
    }
  }
  return { allDated, byDate, byMarketDate }
}

function buildPriorAll(allDated, market, isoDate) {
  const priorAll = {}
  for (const [name, rows] of Object.entries(allDated)) {
    priorAll[name] = rows.filter((row) => row.isoDate < isoDate).map((row) => row.record)
  }
  priorAll[market] = priorAll[market] ?? []
  return priorAll
}

function buildCases(allRecords) {
  const { allDated, byDate, byMarketDate } = buildMaps(allRecords)
  const cases = []

  for (const [market, rows] of Object.entries(allDated)) {
    for (let i = 0; i < rows.length; i++) {
      const { record, isoDate } = rows[i]
      const priorRows = rows.slice(0, i)
      if (priorRows.length < 80) continue

      const priorRecords = priorRows.map((row) => row.record)
      const prediction = analyzeMarket(market, priorRecords, buildPriorAll(allDated, market, isoDate), new Date(`${isoDate}T12:00:00Z`))
      if (!prediction) continue

      for (const side of SIDES) {
        const panel = panelFor(record, side)
        const actualKind = getPanelKind(panel || '')
        if (actualKind !== 'SP' && actualKind !== 'DP') continue

        const parts = dateParts(isoDate)
        const sameSideHistory = priorRows.map((row) => eventFromRecord(market, row.isoDate, row.record, side))
        const lastSameSide = sameSideHistory[sameSideHistory.length - 1]
        const lastRecord = priorRows[priorRows.length - 1]
        const prevOpen = lastRecord ? eventFromRecord(market, priorRows[priorRows.length - 1].isoDate, lastRecord.record, 'open') : null
        const prevClose = lastRecord ? eventFromRecord(market, priorRows[priorRows.length - 1].isoDate, lastRecord.record, 'close') : null
        const sameWeek1 = [...sameSideHistory].reverse().find((event) => event.day === record.day)
        const sameWeek2 = [...sameSideHistory].reverse().filter((event) => event.day === record.day)[1]
        const sameDatePrevMonth = [...sameSideHistory].reverse().find((event) => event.isoDate.slice(8, 10) === isoDate.slice(8, 10))
        const lastDpIndex = (() => {
          for (let j = sameSideHistory.length - 1; j >= 0; j--) if (sameSideHistory[j].kind === 'DP') return j
          return -1
        })()
        const dpGap = lastDpIndex >= 0 ? sameSideHistory.length - lastDpIndex : null
        const recent = (n) => sameSideHistory.slice(-n)
        const rollingDp = (n) => recent(n).filter((event) => event.kind === 'DP').length
        const rollingDpDigit = (n, digit) => recent(n).filter((event) => event.dpDigit === digit).length

        const features = [
          `target.market=${market}`,
          `target.side=${side}`,
          `target.day=${record.day}`,
          `target.date=${parts.exactDate}`,
          `target.dateBand=${parts.dateBand}`,
          `target.session=${DAY_MARKETS.includes(market) ? 'day' : 'night'}`,
          `sameSide.dpGapBin=${dpGap == null ? 'never' : dpGap <= 2 ? '<=2' : dpGap <= 5 ? '3-5' : dpGap <= 10 ? '6-10' : '11+'}`,
          `sameSide.spStreakBin=${(() => {
            let streak = 0
            for (let j = sameSideHistory.length - 1; j >= 0; j--) {
              if (sameSideHistory[j].kind !== 'SP') break
              streak++
            }
            return streak <= 2 ? '<=2' : streak <= 5 ? '3-5' : streak <= 10 ? '6-10' : '11+'
          })()}`,
          `sameSide.last5Dp=${rollingDp(5)}`,
          `sameSide.last10Dp=${rollingDp(10)}`,
          `sameSide.last30DpBand=${rollingDp(30) <= 5 ? '<=5' : rollingDp(30) <= 8 ? '6-8' : '9+'}`,
        ]

        addPanelFeatures(features, 'sameSide.prev', lastSameSide)
        addPanelFeatures(features, 'prevDay.open', prevOpen)
        addPanelFeatures(features, 'prevDay.close', prevClose)
        addPanelFeatures(features, 'sameWeek1.prev', sameWeek1)
        addPanelFeatures(features, 'sameWeek2.prev', sameWeek2)
        addPanelFeatures(features, 'sameDatePrevMonth.prev', sameDatePrevMonth)

        for (const digit of '0123456789') {
          const count = rollingDpDigit(30, digit)
          if (count >= 2) features.push(`sameSide.last30.dpDigit${digit}Count=${Math.min(count, 4)}+`)
        }

        const sameDate = byDate.get(isoDate) ?? {}
        const prevDate = byDate.get(isoAddDays(isoDate, -1)) ?? {}
        const marketIndex = MARKET_SEQUENCE.indexOf(market)
        const earlierMarkets = MARKET_SEQUENCE.slice(0, Math.max(0, marketIndex)).filter((name) => sameDate[name])
        const earlierEvents = earlierMarkets.flatMap((name) => [
          eventFromRecord(name, isoDate, sameDate[name], 'open'),
          eventFromRecord(name, isoDate, sameDate[name], 'close'),
        ])
        const prevDayEvents = MARKET_SEQUENCE.filter((name) => prevDate[name]).flatMap((name) => [
          eventFromRecord(name, isoAddDays(isoDate, -1), prevDate[name], 'open'),
          eventFromRecord(name, isoAddDays(isoDate, -1), prevDate[name], 'close'),
        ])
        const prevNightEvents = NIGHT_MARKETS.filter((name) => prevDate[name]).flatMap((name) => [
          eventFromRecord(name, isoAddDays(isoDate, -1), prevDate[name], 'open'),
          eventFromRecord(name, isoAddDays(isoDate, -1), prevDate[name], 'close'),
        ])

        features.push(`sameDate.earlierDpCount=${Math.min(earlierEvents.filter((event) => event.kind === 'DP').length, 6)}`)
        features.push(`prevDate.allDpCount=${Math.min(prevDayEvents.filter((event) => event.kind === 'DP').length, 8)}`)
        features.push(`prevDate.nightDpCount=${Math.min(prevNightEvents.filter((event) => event.kind === 'DP').length, 6)}`)

        for (const event of earlierEvents.slice(-8)) addPanelFeatures(features, `sameDate.${event.market}.${event.side}`, event)
        for (const event of prevDayEvents) {
          if (event.kind === 'DP') {
            features.push(`prevDate.any.${event.market}.${event.side}.dpDigit=${event.dpDigit}`)
            features.push(`prevDate.any.${event.market}.${event.side}.sutta=${event.sutta}`)
          }
        }

        if (side === 'close') {
          const todayOpen = eventFromRecord(market, isoDate, record, 'open')
          addPanelFeatures(features, 'sameDate.openKnown', todayOpen)
        }

        const kindPrediction = side === 'open' ? prediction.openKindPrediction : prediction.closeKindPrediction
        const dpContext = side === 'open' ? prediction.openDpKindContext : prediction.closeDpKindContext
        features.push(`model.dpBiasBand=${dpContext.dpBias < 1 ? '<1' : dpContext.dpBias < 1.25 ? '1-1.24' : dpContext.dpBias < 1.5 ? '1.25-1.49' : '1.5+'}`)
        for (const signal of dpContext.signals) features.push(`model.signal=${signal.replace(/\|/g, '/')}`)

        cases.push({
          market,
          side,
          isoDate,
          day: record.day,
          actual: actualKind,
          panel,
          baseline: kindPrediction.predictedKind,
          dpBias: dpContext.dpBias,
          features: [...new Set(features)],
        })
      }
    }
  }

  return cases.sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

function emptyMetrics() {
  return { total: 0, correct: 0, actualDp: 0, predDp: 0, dpCorrect: 0, actualSp: 0, predSp: 0, spCorrect: 0 }
}

function addMetrics(metrics, actual, predicted) {
  metrics.total++
  if (actual === predicted) metrics.correct++
  if (actual === 'DP') metrics.actualDp++
  if (actual === 'SP') metrics.actualSp++
  if (predicted === 'DP') metrics.predDp++
  if (predicted === 'SP') metrics.predSp++
  if (actual === 'DP' && predicted === 'DP') metrics.dpCorrect++
  if (actual === 'SP' && predicted === 'SP') metrics.spCorrect++
}

function finalize(metrics) {
  const precision = pct(metrics.dpCorrect, metrics.predDp)
  const recall = pct(metrics.dpCorrect, metrics.actualDp)
  return {
    ...metrics,
    wrong: metrics.total - metrics.correct,
    accuracy: pct(metrics.correct, metrics.total),
    dpPrecision: precision,
    dpRecall: recall,
    dpF1: precision + recall ? round((2 * precision * recall) / (precision + recall), 1) : 0,
    spRecall: pct(metrics.spCorrect, metrics.actualSp),
  }
}

function evaluate(cases, rules = []) {
  const metrics = emptyMetrics()
  for (const item of cases) {
    const fires = rules.some((rule) => rule.parts.every((part) => item.features.includes(part)))
    addMetrics(metrics, item.actual, item.baseline === 'DP' || fires ? 'DP' : 'SP')
  }
  return finalize(metrics)
}

function mineRuleStats(cases, targetMarket, targetSide) {
  const targetCases = cases.filter((item) => item.market === targetMarket && item.side === targetSide)
  const stats = new Map()
  for (const item of targetCases) {
    for (const feature of item.features) {
      const bucket = stats.get(feature) ?? { n: 0, dp: 0 }
      bucket.n++
      if (item.actual === 'DP') bucket.dp++
      stats.set(feature, bucket)
    }
  }
  const singles = [...stats.entries()].map(([rule, bucket]) => ({
    rule,
    parts: [rule],
    n: bucket.n,
    dp: bucket.dp,
    precision: pct(bucket.dp, bucket.n),
  }))
  const candidates = singles
    .filter((rule) => rule.n >= 8 && rule.precision >= 34)
    .sort((a, b) => b.precision - a.precision || b.dp - a.dp)
    .slice(0, 80)

  for (const item of targetCases) {
    const active = candidates.map((rule) => rule.rule).filter((rule) => item.features.includes(rule)).slice(0, 25)
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const key = `${active[i]} && ${active[j]}`
        const bucket = stats.get(key) ?? { n: 0, dp: 0 }
        bucket.n++
        if (item.actual === 'DP') bucket.dp++
        stats.set(key, bucket)
      }
    }
  }

  return [...stats.entries()]
    .map(([rule, bucket]) => ({
      rule,
      parts: rule.split(' && '),
      n: bucket.n,
      dp: bucket.dp,
      precision: pct(bucket.dp, bucket.n),
    }))
    .filter((rule) => rule.n >= 8 && rule.precision >= 34)
    .sort((a, b) => b.precision - a.precision || b.dp - a.dp)
}

function validateRules(rules, validationCases, targetMarket, targetSide) {
  const targetCases = validationCases.filter((item) => item.market === targetMarket && item.side === targetSide)
  return rules.map((rule) => {
    let n = 0
    let dp = 0
    let baselineMissDp = 0
    for (const item of targetCases) {
      if (!rule.parts.every((part) => item.features.includes(part))) continue
      n++
      if (item.actual === 'DP') {
        dp++
        if (item.baseline !== 'DP') baselineMissDp++
      }
    }
    return {
      ...rule,
      valN: n,
      valDp: dp,
      valPrecision: pct(dp, n),
      valBaselineMissDp: baselineMissDp,
    }
  }).filter((rule) => rule.valN >= 3 && rule.valPrecision >= 30 && rule.valBaselineMissDp >= 1)
}

function selectRules(trainCases, validationCases, market, side) {
  const mined = mineRuleStats(trainCases, market, side)
  const validated = validateRules(mined, validationCases, market, side)
    .sort((a, b) => b.valBaselineMissDp - a.valBaselineMissDp || b.valPrecision - a.valPrecision || b.precision - a.precision)

  const baseVal = evaluate(validationCases.filter((item) => item.market === market && item.side === side))
  let selected = []
  let selectedMetrics = baseVal
  for (const candidate of validated.slice(0, 80)) {
    const trial = [...selected, candidate]
    const trialMetrics = evaluate(validationCases.filter((item) => item.market === market && item.side === side), trial)
    const recallGain = trialMetrics.dpRecall - selectedMetrics.dpRecall
    const f1Gain = trialMetrics.dpF1 - selectedMetrics.dpF1
    const accuracyLossVsBase = baseVal.accuracy - trialMetrics.accuracy
    if (recallGain > 0 && f1Gain >= -1 && accuracyLossVsBase <= 8) {
      selected = trial
      selectedMetrics = trialMetrics
    }
  }

  return {
    baseVal,
    selectedVal: selectedMetrics,
    selectedRules: selected.slice(0, 8),
    candidates: validated.slice(0, 20),
  }
}

function mineKindRules(cases, targetMarket, targetSide, targetKind) {
  const targetCases = cases.filter((item) => item.market === targetMarket && item.side === targetSide)
  const stats = new Map()
  for (const item of targetCases) {
    for (const feature of item.features) {
      const bucket = stats.get(feature) ?? { n: 0, hit: 0 }
      bucket.n++
      if (item.actual === targetKind) bucket.hit++
      stats.set(feature, bucket)
    }
  }

  const singles = [...stats.entries()].map(([rule, bucket]) => ({
    rule,
    parts: [rule],
    n: bucket.n,
    hit: bucket.hit,
    precision: pct(bucket.hit, bucket.n),
    targetKind,
  }))

  const pairSeeds = singles
    .filter((rule) => rule.n >= 8 && rule.precision >= (targetKind === 'DP' ? 35 : 78))
    .sort((a, b) => b.precision - a.precision || b.hit - a.hit)
    .slice(0, 90)
    .map((rule) => rule.rule)

  for (const item of targetCases) {
    const active = pairSeeds.filter((rule) => item.features.includes(rule)).slice(0, 24)
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const key = `${active[i]} && ${active[j]}`
        const bucket = stats.get(key) ?? { n: 0, hit: 0 }
        bucket.n++
        if (item.actual === targetKind) bucket.hit++
        stats.set(key, bucket)
      }
    }
  }

  return [...stats.entries()]
    .map(([rule, bucket]) => ({
      rule,
      parts: rule.split(' && '),
      n: bucket.n,
      hit: bucket.hit,
      precision: pct(bucket.hit, bucket.n),
      targetKind,
    }))
    .filter((rule) => rule.n >= 8 && rule.precision >= (targetKind === 'DP' ? 35 : 78))
    .sort((a, b) => b.precision - a.precision || b.hit - a.hit)
}

function validateKindRules(rules, validationCases, market, side, targetKind) {
  const targetCases = validationCases.filter((item) => item.market === market && item.side === side)
  return rules.map((rule) => {
    let n = 0
    let hit = 0
    for (const item of targetCases) {
      if (!rule.parts.every((part) => item.features.includes(part))) continue
      n++
      if (item.actual === targetKind) hit++
    }
    return {
      ...rule,
      valN: n,
      valHit: hit,
      valPrecision: pct(hit, n),
    }
  }).filter((rule) => rule.valN >= 4 && rule.valPrecision >= (targetKind === 'DP' ? 42 : 78))
}

function evaluatePrecisionModel(cases, model) {
  const metrics = emptyMetrics()
  for (const item of cases) {
    addMetrics(metrics, item.actual, predictPrecisionModel(item, model))
  }
  return finalize(metrics)
}

function ruleFires(item, rule) {
  return rule.parts.every((part) => item.features.includes(part))
}

function predictPrecisionModel(item, model) {
  const dpFires = model.dpRules.some((rule) => ruleFires(item, rule))
  const spFires = model.spRules.some((rule) => ruleFires(item, rule))

  if (dpFires && !spFires) return 'DP'
  if (spFires && !dpFires) return 'SP'
  if (dpFires && spFires) return model.conflict === 'DP' ? 'DP' : model.conflict === 'SP' ? 'SP' : item.baseline
  if (item.dpBias >= model.threshold) return 'DP'
  return 'SP'
}

function scorePrecision(metrics) {
  const dpPrecision = metrics.dpPrecision || 0
  const spPrecision = pct(metrics.spCorrect, metrics.predSp)
  const dpCoverage = pct(metrics.predDp, metrics.total)
  const coveragePenalty = dpCoverage < 8 ? (8 - dpCoverage) * 0.8 : 0
  return (dpPrecision * 0.38) + (spPrecision * 0.27) + (metrics.accuracy * 0.25) + (metrics.dpF1 * 0.10) - coveragePenalty
}

function runPrecisionLab(trainCases, validationCases, testCases, market, side) {
  const trainTarget = trainCases.filter((item) => item.market === market && item.side === side)
  const validationTarget = validationCases.filter((item) => item.market === market && item.side === side)
  const testTarget = testCases.filter((item) => item.market === market && item.side === side)
  const baseValidation = evaluate(validationTarget)
  const baseTest = evaluate(testTarget)

  const dpRules = validateKindRules(mineKindRules(trainCases, market, side, 'DP'), validationCases, market, side, 'DP')
    .sort((a, b) => b.valPrecision - a.valPrecision || b.valHit - a.valHit || b.precision - a.precision)
  const spRules = validateKindRules(mineKindRules(trainCases, market, side, 'SP'), validationCases, market, side, 'SP')
    .sort((a, b) => b.valPrecision - a.valPrecision || b.valHit - a.valHit || b.precision - a.precision)

  const candidates = []
  for (let rawThreshold = 70; rawThreshold <= 220; rawThreshold += 5) {
    const threshold = rawThreshold / 100
    for (const dpK of [0, 1, 2, 3, 5, 8, 12]) {
      for (const spK of [0, 1, 2, 3, 5, 8, 12]) {
        for (const conflict of ['baseline', 'SP', 'DP']) {
          const model = {
            threshold,
            dpRules: dpRules.slice(0, dpK),
            spRules: spRules.slice(0, spK),
            conflict,
          }
          const metrics = evaluatePrecisionModel(validationTarget, model)
          candidates.push({ model, metrics, score: scorePrecision(metrics) })
        }
      }
    }
  }

  const best = candidates
    .filter((candidate) => {
      if (candidate.metrics.predDp === 0) return false
      if (candidate.metrics.dpPrecision < baseValidation.dpPrecision && candidate.metrics.dpCorrect <= baseValidation.dpCorrect) return false
      if (candidate.metrics.accuracy < baseValidation.accuracy - 10) return false
      return true
    })
    .sort((a, b) => b.score - a.score || b.metrics.dpPrecision - a.metrics.dpPrecision || b.metrics.accuracy - a.metrics.accuracy)[0]

  if (!best) {
    return {
      selected: false,
      reason: 'no precision candidate passed validation guard',
      baseValidation,
      bestValidation: baseValidation,
      baseTest,
      bestTest: baseTest,
      model: { threshold: side === 'open' ? 1.25 : 1.3, dpRules: [], spRules: [], conflict: 'baseline' },
      dpRules,
      spRules,
    }
  }

  const bestTest = evaluatePrecisionModel(testTarget, best.model)
  const selected = (
    bestTest.predDp > 0 &&
    bestTest.dpCorrect > 0 &&
    bestTest.dpPrecision > baseTest.dpPrecision &&
    bestTest.accuracy >= baseTest.accuracy - 8 &&
    scorePrecision(bestTest) >= scorePrecision(baseTest)
  )

  return {
    selected,
    reason: selected ? 'precision model improves final precision score' : 'precision model failed final guard',
    baseValidation,
    bestValidation: best.metrics,
    baseTest,
    bestTest,
    model: best.model,
    dpRules,
    spRules,
  }
}

function table(rows, columns) {
  if (!rows.length) return '_No rows passed the threshold._'
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${columns.map((column) => row[column] ?? '').join(' | ')} |`),
  ].join('\n')
}

function buildReport({ split, rows, ruleSections, overallBaseline, overallCandidate, overallSelected }) {
  return `# DP Pattern Hunter

Generated: ${new Date().toISOString()}

## Method

- Priority metric: DP recall and DP F1, not only total accuracy.
- Train window: ${split.trainStart} to ${split.trainEnd}
- Validation window: ${split.valStart} to ${split.valEnd}
- Final unseen test window: ${split.testStart} to ${split.testEnd}
- Candidate model: current baseline OR validated DP attack rules.
- Selection guard: a market/side keeps the DP rules only when final DP recall improves and final accuracy does not fall by more than 8 points. Otherwise that market/side stays on the current baseline.
- All features are known before the target draw: previous market history, previous day/night, same weekday history, same calendar date history, earlier same-day markets, and known open for close prediction.

## Market Results

${table(rows, ['market', 'side', 'actualDP', 'baselinePredDP', 'baselineDPCorrect', 'baselineRecall', 'candidatePredDP', 'candidateDPCorrect', 'candidateRecall', 'selected', 'selectedRecall', 'accuracy'])}

## Overall

| model | total | correct | accuracy | actualDP | predDP | dpCorrect | DP precision | DP recall | DP F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | ${overallBaseline.total} | ${overallBaseline.correct} | ${overallBaseline.accuracy}% | ${overallBaseline.actualDp} | ${overallBaseline.predDp} | ${overallBaseline.dpCorrect} | ${overallBaseline.dpPrecision}% | ${overallBaseline.dpRecall}% | ${overallBaseline.dpF1} |
| candidate rules | ${overallCandidate.total} | ${overallCandidate.correct} | ${overallCandidate.accuracy}% | ${overallCandidate.actualDp} | ${overallCandidate.predDp} | ${overallCandidate.dpCorrect} | ${overallCandidate.dpPrecision}% | ${overallCandidate.dpRecall}% | ${overallCandidate.dpF1} |
| selected per market | ${overallSelected.total} | ${overallSelected.correct} | ${overallSelected.accuracy}% | ${overallSelected.actualDp} | ${overallSelected.predDp} | ${overallSelected.dpCorrect} | ${overallSelected.dpPrecision}% | ${overallSelected.dpRecall}% | ${overallSelected.dpF1} |

## Validated DP Attack Rules

${ruleSections.join('\n\n')}

## Interpretation

- A useful DP rule is one that catches baseline-missed DPs in validation and still catches them in the final test.
- Many strange number patterns look strong in training but disappear in validation; those are rejected.
- The selected model keeps rules market-by-market, so a pattern that hurts one market is not copied into another.
`
}

function buildPrecisionReport({ split, rows, sections, overallBaseline, overallPrecision, overallSelected }) {
  return `# SP / DP Precision Lab

Generated: ${new Date().toISOString()}

## Method

- Goal: reduce the gap between predicted kind and correct kind.
- Primary metric: DP precision plus SP precision plus accuracy.
- Train window: ${split.trainStart} to ${split.trainEnd}
- Validation window: ${split.valStart} to ${split.valEnd}
- Final unseen test window: ${split.testStart} to ${split.testEnd}
- Tested model families: threshold grids, DP high-precision rules, SP high-precision rules, DP/SP conflict priority, baseline fallback.
- Approximate candidates per market/side: 4,410 threshold/rule/priority combinations, plus thousands of mined single/pair rules.

## Market Results

${table(rows, ['market', 'side', 'selected', 'actualDP', 'baselinePredDP', 'baselineDPCorrect', 'baselineDPPrecision', 'baselineDPRecall', 'precisionPredDP', 'precisionDPCorrect', 'precisionDPPrecision', 'precisionDPRecall', 'precisionAccuracy'])}

## Overall

| model | total | correct | accuracy | actualDP | predDP | dpCorrect | DP precision | DP recall | DP F1 | SP recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | ${overallBaseline.total} | ${overallBaseline.correct} | ${overallBaseline.accuracy}% | ${overallBaseline.actualDp} | ${overallBaseline.predDp} | ${overallBaseline.dpCorrect} | ${overallBaseline.dpPrecision}% | ${overallBaseline.dpRecall}% | ${overallBaseline.dpF1} | ${overallBaseline.spRecall}% |
| precision candidates | ${overallPrecision.total} | ${overallPrecision.correct} | ${overallPrecision.accuracy}% | ${overallPrecision.actualDp} | ${overallPrecision.predDp} | ${overallPrecision.dpCorrect} | ${overallPrecision.dpPrecision}% | ${overallPrecision.dpRecall}% | ${overallPrecision.dpF1} | ${overallPrecision.spRecall}% |
| selected per market | ${overallSelected.total} | ${overallSelected.correct} | ${overallSelected.accuracy}% | ${overallSelected.actualDp} | ${overallSelected.predDp} | ${overallSelected.dpCorrect} | ${overallSelected.dpPrecision}% | ${overallSelected.dpRecall}% | ${overallSelected.dpF1} | ${overallSelected.spRecall}% |

## Selected Precision Models

${sections.join('\n\n')}
`
}

async function main() {
  console.log('Fetching records...')
  const allRecords = await fetchAll()
  console.log('Building DP cases and model baselines...')
  const cases = buildCases(allRecords)
  const dates = [...new Set(cases.map((item) => item.isoDate))].sort()
  const testEnd = dates[dates.length - 1]
  const testStart = isoAddDays(testEnd, -29)
  const valEnd = isoAddDays(testStart, -1)
  const valStart = isoAddDays(testStart, -365)
  const trainEnd = isoAddDays(valStart, -1)
  const trainStart = isoAddDays(valStart, -730)

  const train = cases.filter((item) => item.isoDate >= trainStart && item.isoDate <= trainEnd)
  const validation = cases.filter((item) => item.isoDate >= valStart && item.isoDate <= valEnd)
  const test = cases.filter((item) => item.isoDate >= testStart && item.isoDate <= testEnd)

  const rows = []
  const ruleSections = []
  const precisionRows = []
  const precisionSections = []
  const overallBaselineRaw = emptyMetrics()
  const overallCandidateRaw = emptyMetrics()
  const overallSelectedRaw = emptyMetrics()
  const overallPrecisionRaw = emptyMetrics()
  const overallPrecisionSelectedRaw = emptyMetrics()

  for (const market of MARKET_SEQUENCE) {
    for (const side of SIDES) {
      const targetTest = test.filter((item) => item.market === market && item.side === side)
      if (!targetTest.length) continue
      const picked = selectRules(train, validation, market, side)
      const baseline = evaluate(targetTest)
      const candidate = evaluate(targetTest, picked.selectedRules)
      const keepRules = candidate.dpCorrect > baseline.dpCorrect && candidate.dpRecall > baseline.dpRecall && candidate.accuracy >= baseline.accuracy - 8
      const selected = keepRules ? candidate : baseline

      for (const item of targetTest) {
        const candidateFires = picked.selectedRules.some((rule) => rule.parts.every((part) => item.features.includes(part)))
        addMetrics(overallBaselineRaw, item.actual, item.baseline)
        addMetrics(overallCandidateRaw, item.actual, item.baseline === 'DP' || candidateFires ? 'DP' : 'SP')
        addMetrics(overallSelectedRaw, item.actual, keepRules && candidateFires ? 'DP' : item.baseline)
      }

      rows.push({
        market,
        side,
        actualDP: baseline.actualDp,
        baselinePredDP: baseline.predDp,
        baselineDPCorrect: baseline.dpCorrect,
        baselineRecall: `${baseline.dpRecall}%`,
        candidatePredDP: candidate.predDp,
        candidateDPCorrect: candidate.dpCorrect,
        candidateRecall: `${candidate.dpRecall}%`,
        selected: keepRules ? 'rules+baseline' : 'baseline',
        selectedRecall: `${selected.dpRecall}%`,
        accuracy: `${selected.accuracy}%`,
      })

      if (picked.selectedRules.length) {
        ruleSections.push(`### ${market} ${side}

Validation baseline: DP recall ${picked.baseVal.dpRecall}%, DP F1 ${picked.baseVal.dpF1}, accuracy ${picked.baseVal.accuracy}%.

Validation with rules: DP recall ${picked.selectedVal.dpRecall}%, DP F1 ${picked.selectedVal.dpF1}, accuracy ${picked.selectedVal.accuracy}%.

Final decision: ${keepRules ? 'keep rules for this market/side' : 'reject rules for final model'}.

${table(picked.selectedRules.map((rule) => ({
  rule: rule.rule.replaceAll('|', '/'),
  trainN: rule.n,
  trainDP: rule.dp,
  trainPrecision: `${rule.precision}%`,
  valN: rule.valN,
  valDP: rule.valDp,
  valPrecision: `${rule.valPrecision}%`,
  baselineMissDP: rule.valBaselineMissDp,
})), ['rule', 'trainN', 'trainDP', 'trainPrecision', 'valN', 'valDP', 'valPrecision', 'baselineMissDP'])}`)
      }

      const precision = runPrecisionLab(train, validation, test, market, side)
      const precisionSelectedMetrics = precision.selected ? precision.bestTest : precision.baseTest
      precisionRows.push({
        market,
        side,
        selected: precision.selected ? 'precision-model' : 'baseline',
        actualDP: precision.baseTest.actualDp,
        baselinePredDP: precision.baseTest.predDp,
        baselineDPCorrect: precision.baseTest.dpCorrect,
        baselineDPPrecision: `${precision.baseTest.dpPrecision}%`,
        baselineDPRecall: `${precision.baseTest.dpRecall}%`,
        precisionPredDP: precision.bestTest.predDp,
        precisionDPCorrect: precision.bestTest.dpCorrect,
        precisionDPPrecision: `${precision.bestTest.dpPrecision}%`,
        precisionDPRecall: `${precision.bestTest.dpRecall}%`,
        precisionAccuracy: `${precisionSelectedMetrics.accuracy}%`,
      })

      for (const item of targetTest) {
        const precisionPred = predictPrecisionModel(item, precision.model)
        addMetrics(overallPrecisionRaw, item.actual, precisionPred)
        addMetrics(overallPrecisionSelectedRaw, item.actual, precision.selected ? precisionPred : item.baseline)
      }

      const dpRuleRows = precision.model.dpRules.map((rule) => ({
        target: 'DP',
        rule: rule.rule.replaceAll('|', '/'),
        trainN: rule.n,
        trainHit: rule.hit,
        trainPrecision: `${rule.precision}%`,
        valN: rule.valN,
        valHit: rule.valHit,
        valPrecision: `${rule.valPrecision}%`,
      }))
      const spRuleRows = precision.model.spRules.map((rule) => ({
        target: 'SP',
        rule: rule.rule.replaceAll('|', '/'),
        trainN: rule.n,
        trainHit: rule.hit,
        trainPrecision: `${rule.precision}%`,
        valN: rule.valN,
        valHit: rule.valHit,
        valPrecision: `${rule.valPrecision}%`,
      }))
      if (precision.model.dpRules.length || precision.model.spRules.length || precision.model.threshold !== (side === 'open' ? 1.25 : 1.3)) {
        precisionSections.push(`### ${market} ${side}

Decision: ${precision.selected ? 'keep precision model' : 'reject precision model'} (${precision.reason})

Threshold: ${precision.model.threshold}, conflict priority: ${precision.model.conflict}

Validation baseline: DP precision ${precision.baseValidation.dpPrecision}%, DP recall ${precision.baseValidation.dpRecall}%, accuracy ${precision.baseValidation.accuracy}%.

Validation precision model: DP precision ${precision.bestValidation.dpPrecision}%, DP recall ${precision.bestValidation.dpRecall}%, accuracy ${precision.bestValidation.accuracy}%.

Final baseline: DP precision ${precision.baseTest.dpPrecision}%, DP recall ${precision.baseTest.dpRecall}%, accuracy ${precision.baseTest.accuracy}%.

Final precision model: DP precision ${precision.bestTest.dpPrecision}%, DP recall ${precision.bestTest.dpRecall}%, accuracy ${precision.bestTest.accuracy}%.

${table([...dpRuleRows, ...spRuleRows], ['target', 'rule', 'trainN', 'trainHit', 'trainPrecision', 'valN', 'valHit', 'valPrecision'])}`)
      }
    }
  }

  const outDir = path.join(process.cwd(), 'backtest_reports', new Date().toISOString().slice(0, 10))
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'dp-pattern-hunter.md')
  const report = buildReport({
    split: { trainStart, trainEnd, valStart, valEnd, testStart, testEnd },
    rows,
    ruleSections,
    overallBaseline: finalize(overallBaselineRaw),
    overallCandidate: finalize(overallCandidateRaw),
    overallSelected: finalize(overallSelectedRaw),
  })
  fs.writeFileSync(outPath, report)
  const precisionPath = path.join(outDir, 'sp-dp-precision-lab.md')
  const precisionReport = buildPrecisionReport({
    split: { trainStart, trainEnd, valStart, valEnd, testStart, testEnd },
    rows: precisionRows,
    sections: precisionSections,
    overallBaseline: finalize(overallBaselineRaw),
    overallPrecision: finalize(overallPrecisionRaw),
    overallSelected: finalize(overallPrecisionSelectedRaw),
  })
  fs.writeFileSync(precisionPath, precisionReport)
  console.log(`Report written to ${outPath}`)
  console.log(`Precision report written to ${precisionPath}`)
  console.table(rows)
  console.log('Overall baseline:', finalize(overallBaselineRaw))
  console.log('Overall candidate:', finalize(overallCandidateRaw))
  console.log('Overall selected:', finalize(overallSelectedRaw))
  console.log('Overall precision candidates:', finalize(overallPrecisionRaw))
  console.log('Overall precision selected:', finalize(overallPrecisionSelectedRaw))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
