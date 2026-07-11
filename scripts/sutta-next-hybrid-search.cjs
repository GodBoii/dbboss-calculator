/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const RECORDS_PATH = path.join(ROOT, 'scratch', 'sutta-research-records.json')
const LEDGER_30_PATH = process.env.SUTTA_LEDGER_30
  ? path.resolve(ROOT, process.env.SUTTA_LEDGER_30)
  : path.join(ROOT, 'scratch', 'sutta-baseline-30d-latest-panel-ledger.json')
const LEDGER_730_PATH = process.env.SUTTA_LEDGER_730
  ? path.resolve(ROOT, process.env.SUTTA_LEDGER_730)
  : path.join(ROOT, 'scratch', 'sutta-baseline-730d-latest-panel-ledger.json')
const OUTPUT_PATH = process.env.SUTTA_SEARCH_OUTPUT
  ? path.resolve(ROOT, process.env.SUTTA_SEARCH_OUTPUT)
  : path.join(ROOT, 'scratch', 'sutta-next-hybrid-search-output.json')
const REPORT_PATH = process.env.SUTTA_SEARCH_REPORT
  ? path.resolve(ROOT, process.env.SUTTA_SEARCH_REPORT)
  : path.join(ROOT, 'backtest_reports', '2026-07-11', 'sutta-next-hybrid-search.md')

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
const TARGET_MARKETS = process.env.SUTTA_TARGET_MARKETS
  ? process.env.SUTTA_TARGET_MARKETS.split('|').filter((market) => MARKET_ORDER.includes(market))
  : MARKET_ORDER
const TARGET_SIDES = process.env.SUTTA_SIDES
  ? process.env.SUTTA_SIDES.split('|').filter((side) => side === 'open' || side === 'close')
  : ['open', 'close']
const OUTPUT_LIMIT = Number.parseInt(process.env.SUTTA_OUTPUT_LIMIT || '250', 10)
const PRESERVE_COUNTS = process.env.SUTTA_PRESERVE_COUNTS
  ? process.env.SUTTA_PRESERVE_COUNTS.split('|').map(Number).filter((count) => count >= 2 && count <= 5)
  : [4]

const DAY_OFFSETS = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

const FORMULAS = {
  source: (d) => [d],
  opposite: (d) => [d + 5],
  sourceOpposite: (d) => [d, d + 5],
  nearTwoOpposite: (d) => [d, d + 1, d - 1, d + 2, d - 2, d + 5],
  oppositeNearTwo: (d) => [d + 5, d + 4, d + 6, d, d + 1, d - 1],
  mirrorOpposite: (d) => [d, 9 - d, d + 5, 14 - d, d + 1, d - 1],
  addThreeCycle: (d) => [d, d + 3, d + 6, d + 9, d + 1, d + 5],
  subtractThreeCycle: (d) => [d, d - 3, d - 6, d - 9, d - 1, d + 5],
  addTwoCycle: (d) => [d, d + 2, d + 4, d + 6, d + 8, d + 5],
  addFourCycle: (d) => [d, d + 4, d + 8, d + 2, d + 6, d + 5],
  nearThree: (d) => [d, d + 1, d - 1, d + 2, d - 2, d + 3],
  multiplyCycle: (d) => [d, d * 2, d * 3, d * 4, d * 5, d + 5],
  mirrorNear: (d) => [9 - d, 8 - d, 10 - d, d, d + 5, d + 1],
  houseLowFirst: (d) => [d, d + 5, 1, 2, 3, 4],
  houseHighFirst: (d) => [d, d + 5, 6, 7, 8, 9],
}

const FEATURE_DEFS = [
  ['openSutta', (record) => digit(record.openSutta)],
  ['closeSutta', (record) => digit(record.closeSutta)],
  ['openPanel.first', (record) => panelDigit(record.openPanel, 0)],
  ['openPanel.middle', (record) => panelDigit(record.openPanel, 1)],
  ['openPanel.last', (record) => panelDigit(record.openPanel, 2)],
  ['openPanel.sum', (record) => panelSum(record.openPanel)],
  ['openPanel.kind', (record) => panelKindDigit(record.openPanel)],
  ['openPanel.outerSum', (record) => panelOuterSum(record.openPanel)],
  ['openPanel.outerDiff', (record) => panelOuterDiff(record.openPanel)],
  ['openPanel.innerLeftSum', (record) => panelPairSum(record.openPanel, 0, 1)],
  ['openPanel.innerRightSum', (record) => panelPairSum(record.openPanel, 1, 2)],
  ['openPanel.innerLeftDiff', (record) => panelPairDiff(record.openPanel, 0, 1)],
  ['openPanel.innerRightDiff', (record) => panelPairDiff(record.openPanel, 1, 2)],
  ['openPanel.product', (record) => panelProduct(record.openPanel)],
  ['openPanel.span', (record) => panelSpan(record.openPanel)],
  ['closePanel.first', (record) => panelDigit(record.closePanel, 0)],
  ['closePanel.middle', (record) => panelDigit(record.closePanel, 1)],
  ['closePanel.last', (record) => panelDigit(record.closePanel, 2)],
  ['closePanel.sum', (record) => panelSum(record.closePanel)],
  ['closePanel.kind', (record) => panelKindDigit(record.closePanel)],
  ['closePanel.outerSum', (record) => panelOuterSum(record.closePanel)],
  ['closePanel.outerDiff', (record) => panelOuterDiff(record.closePanel)],
  ['closePanel.innerLeftSum', (record) => panelPairSum(record.closePanel, 0, 1)],
  ['closePanel.innerRightSum', (record) => panelPairSum(record.closePanel, 1, 2)],
  ['closePanel.innerLeftDiff', (record) => panelPairDiff(record.closePanel, 0, 1)],
  ['closePanel.innerRightDiff', (record) => panelPairDiff(record.closePanel, 1, 2)],
  ['closePanel.product', (record) => panelProduct(record.closePanel)],
  ['closePanel.span', (record) => panelSpan(record.closePanel)],
  ['jodi.sum', (record) => mod10(digit(record.openSutta) + digit(record.closeSutta))],
  ['jodi.diff', (record) => mod10(digit(record.openSutta) - digit(record.closeSutta))],
]

const CURRENT_RULES = {
  open: {
    'Madhur Day': [['Milan Day', 'previousDraw', 'openSutta', 'sourceOpposite']],
    'Milan Day': [['Rajdhani Night', 'previousDraw', 'openPanel.middle', 'addThreeCycle']],
    Kalyan: [['Sridevi', 'sameDay', 'openPanel.last', 'addThreeCycle']],
    Sridevi: [['Milan Night', 'previousDraw', 'closeSutta', 'mirrorOpposite']],
    'Sridevi Night': [
      ['Madhur Day', 'sameDay', 'closeSutta', 'addThreeCycle'],
      ['Main Bazar', 'previousDraw', 'openPanel.outerSum', 'source'],
    ],
    'Kalyan Night': [['Madhur Day', 'sameDay', 'closePanel.outerDiff', 'houseLowFirst']],
    'Madhur Night': [['Kalyan Night', 'previousDraw', 'closePanel.outerSum', 'opposite']],
    'Milan Night': [['Madhur Night', 'sameDay', 'openSutta', 'sourceOpposite']],
    'Rajdhani Day': [['Time Bazar', 'sameDay', 'openPanel.outerSum', 'mirrorOpposite']],
    'Main Bazar': [['Madhur Day', 'previousDraw', 'openPanel.first', 'source']],
  },
  close: {
    Sridevi: [
      ['Kalyan', 'previousDraw', 'openSutta', 'mirrorOpposite'],
      ['Milan Night', 'previousDraw', 'openPanel.outerDiff', 'opposite'],
    ],
    'Time Bazar': [['Sridevi', 'sameDay', 'openSutta', 'oppositeNearTwo']],
    'Madhur Day': [['Main Bazar', 'previousDraw', 'closePanel.first', 'mirrorOpposite']],
    'Milan Day': [['Madhur Day', 'sameDay', 'closeSutta', 'oppositeNearTwo']],
    Kalyan: [['Time Bazar', 'sameDay', 'openSutta', 'nearTwoOpposite']],
    'Sridevi Night': [['Sridevi', 'previousDraw', 'closeSutta', 'mirrorOpposite']],
    'Madhur Night': [['Sridevi Night', 'sameDay', 'openSutta', 'addThreeCycle']],
    'Milan Night': [
      ['Madhur Day', 'sameDay', 'closeSutta', 'addThreeCycle'],
      ['Sridevi', 'sameDay', 'closePanel.first', 'source'],
    ],
    'Main Bazar': [
      ['Time Bazar', 'sameDay', 'openSutta', 'addThreeCycle'],
      ['Milan Day', 'sameDay', 'openPanel.outerSum', 'opposite'],
    ],
  },
}

const EXPERIMENTAL_RULES = {
  open: {
    Sridevi: [['Kalyan', 'previousWeekday', 'openPanel.middle', 'sourceOpposite']],
    'Time Bazar': [['Madhur Night', 'previousWeekday', 'closePanel.middle', 'source']],
    'Madhur Day': [['Time Bazar', 'lag2', 'closePanel.first', 'opposite']],
    'Milan Day': [['Main Bazar', 'previousDraw', 'closePanel.first', 'source']],
    'Rajdhani Day': [['Sridevi', 'previousDraw', 'openPanel.outerDiff', 'source']],
    Kalyan: [['Time Bazar', 'sameDay', 'openPanel.outerSum', 'opposite']],
    'Sridevi Night': [['Rajdhani Day', 'previousDraw', 'openPanel.first', 'opposite']],
    'Kalyan Night': [['Kalyan Night', 'lag2', 'openSutta', 'source']],
    'Madhur Night': [['Milan Night', 'lag3', 'openPanel.outerDiff', 'source']],
    'Rajdhani Night': [['Main Bazar', 'lag3', 'openPanel.last', 'sourceOpposite']],
    'Main Bazar': [['Milan Night', 'previousWeekday', 'closeSutta', 'source']],
  },
  close: {
    Sridevi: [['Time Bazar', 'lag4', 'closeSutta', 'source']],
    'Time Bazar': [['Time Bazar', 'previousWeekday', 'jodi.diff', 'opposite']],
    'Madhur Day': [['Milan Night', 'lag5', 'jodi.diff', 'source']],
    'Milan Day': [['Madhur Day', 'previousMonthDay', 'openPanel.last', 'opposite']],
    'Rajdhani Day': [['Madhur Day', 'sameDay', 'closePanel.product', 'source']],
    Kalyan: [['Main Bazar', 'previousDraw', 'jodi.sum', 'opposite']],
    'Sridevi Night': [['Madhur Day', 'lag7', 'openPanel.innerRightSum', 'opposite']],
    'Kalyan Night': [['Sridevi Night', 'sameDay', 'openSutta', 'sourceOpposite']],
    'Madhur Night': [['Madhur Night', 'lag7', 'openPanel.span', 'opposite']],
    'Milan Night': [['Madhur Day', 'previousDraw', 'closePanel.outerSum', 'source']],
    'Rajdhani Night': [['Madhur Night', 'lag2', 'closePanel.middle', 'subtractThreeCycle', 2]],
    'Main Bazar': [['Time Bazar', 'lag4', 'openPanel.innerRightSum', 'opposite']],
  },
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function parseDate(dateStr) {
  const parts = String(dateStr).replace(/-/g, '/').split('/').map((part) => Number.parseInt(part, 10))
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null
  const [day, month, rawYear] = parts
  const year = rawYear < 100 ? rawYear + 2000 : rawYear
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(date, days) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function getRecordIsoDate(record) {
  const start = parseDate(record.dateRangeStart)
  if (!start) return null
  return addDays(start, DAY_OFFSETS[record.day] ?? 0).toISOString().slice(0, 10)
}

function digit(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed % 10 : null
}

function mod10(value) {
  return ((value % 10) + 10) % 10
}

function panelDigits(panel) {
  if (!panel || String(panel).length !== 3) return null
  const digits = String(panel).split('').map((part) => Number.parseInt(part, 10))
  return digits.some((value) => Number.isNaN(value)) ? null : digits
}

function panelDigit(panel, index) {
  const digits = panelDigits(panel)
  return digits ? digits[index] : null
}

function panelSum(panel) {
  const digits = panelDigits(panel)
  return digits ? mod10(digits.reduce((sum, value) => sum + value, 0)) : null
}

function panelKindDigit(panel) {
  const digits = panelDigits(panel)
  return digits ? new Set(digits).size : null
}

function panelOuterSum(panel) {
  const digits = panelDigits(panel)
  return digits ? mod10(digits[0] + digits[2]) : null
}

function panelOuterDiff(panel) {
  const digits = panelDigits(panel)
  return digits ? mod10(digits[0] - digits[2]) : null
}

function panelPairSum(panel, left, right) {
  const digits = panelDigits(panel)
  return digits ? mod10(digits[left] + digits[right]) : null
}

function panelPairDiff(panel, left, right) {
  const digits = panelDigits(panel)
  return digits ? mod10(digits[left] - digits[right]) : null
}

function panelProduct(panel) {
  const digits = panelDigits(panel)
  return digits ? mod10(digits[0] * digits[1] * digits[2]) : null
}

function panelSpan(panel) {
  const digits = panelDigits(panel)
  return digits ? Math.max(...digits) - Math.min(...digits) : null
}

function prepareRecords(recordsByMarket) {
  const sorted = {}
  const byDate = {}
  for (const [market, records] of Object.entries(recordsByMarket)) {
    sorted[market] = records
      .map((record) => ({ ...record, isoDate: getRecordIsoDate(record) }))
      .filter((record) => record.isoDate)
      .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    byDate[market] = new Map(sorted[market].map((record) => [record.isoDate, record]))
  }
  return { sorted, byDate }
}

function enrichRows(rows, byDate) {
  return rows.map((row) => ({
    ...row,
    actualJodi: byDate[row.market]?.get(row.isoDate)?.jodi || `${row.actualOpen}${row.actualClose}`,
  }))
}

function buildHistoricalLookups(sorted, rows) {
  const dates = [...new Set(rows.map((row) => row.isoDate))].sort()
  const lookups = Object.fromEntries(
    ['previousDraw', 'lag2', 'lag3', 'lag4', 'lag5', 'lag6', 'lag7', 'previousWeekday', 'previousMonthDay']
      .map((origin) => [origin, {}]),
  )
  for (const sourceMarket of MARKET_ORDER) {
    const records = sorted[sourceMarket] || []
    const marketLookups = Object.fromEntries(Object.keys(lookups).map((origin) => [origin, new Map()]))
    let pointer = 0
    for (const isoDate of dates) {
      while (pointer < records.length && records[pointer].isoDate < isoDate) pointer++
      marketLookups.previousDraw.set(isoDate, pointer > 0 ? records[pointer - 1] : null)
      marketLookups.lag2.set(isoDate, pointer > 1 ? records[pointer - 2] : null)
      marketLookups.lag3.set(isoDate, pointer > 2 ? records[pointer - 3] : null)
      marketLookups.lag4.set(isoDate, pointer > 3 ? records[pointer - 4] : null)
      marketLookups.lag5.set(isoDate, pointer > 4 ? records[pointer - 5] : null)
      marketLookups.lag6.set(isoDate, pointer > 5 ? records[pointer - 6] : null)
      marketLookups.lag7.set(isoDate, pointer > 6 ? records[pointer - 7] : null)
      const targetWeekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay()
      let weekdayRecord = null
      for (let index = pointer - 1; index >= Math.max(0, pointer - 10); index--) {
        if (new Date(`${records[index].isoDate}T00:00:00Z`).getUTCDay() === targetWeekday) {
          weekdayRecord = records[index]
          break
        }
      }
      marketLookups.previousWeekday.set(isoDate, weekdayRecord)
      const targetDayOfMonth = Number(isoDate.slice(8, 10))
      let monthDayRecord = null
      for (let index = pointer - 1; index >= Math.max(0, pointer - 45); index--) {
        if (Number(records[index].isoDate.slice(8, 10)) === targetDayOfMonth) {
          monthDayRecord = records[index]
          break
        }
      }
      marketLookups.previousMonthDay.set(isoDate, monthDayRecord)
    }
    for (const origin of Object.keys(lookups)) lookups[origin][sourceMarket] = marketLookups[origin]
  }
  return lookups
}

function sourceRecord(candidate, row, byDate, marketIndex, historicalLookups) {
  if (candidate.origin === 'sameDay') {
    if (marketIndex.get(candidate.sourceMarket) >= marketIndex.get(row.market)) return null
    return byDate[candidate.sourceMarket]?.get(row.isoDate) || null
  }
  return historicalLookups[candidate.origin]?.[candidate.sourceMarket]?.get(row.isoDate) || null
}

function formulaDigits(formulaName, anchor) {
  return FORMULAS[formulaName](anchor).map(mod10)
}

function hybridSet(base, formula, preserveCount = 4) {
  const output = base.slice(0, preserveCount)
  for (const value of formula) {
    if (output.length >= 6) break
    if (!output.includes(value)) output.push(value)
  }
  for (const value of base) {
    if (output.length >= 6) break
    if (!output.includes(value)) output.push(value)
  }
  for (let value = 0; output.length < 6 && value <= 9; value++) {
    if (!output.includes(value)) output.push(value)
  }
  return output.slice(0, 6)
}

function currentSet(row, side) {
  return side === 'open' ? row.openRanking : row.closeRanking
}

function actualDigit(row, side) {
  return side === 'open' ? row.actualOpen : row.actualClose
}

function hasJodi(row, openSet, closeSet) {
  return openSet.some((open) => closeSet.some((close) => `${open}${close}` === row.actualJodi))
}

function splitRows(rows) {
  const sorted = [...rows].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
  const devEnd = Math.floor(sorted.length * 0.6)
  const valEnd = Math.floor(sorted.length * 0.8)
  return {
    dev: sorted.slice(0, devEnd),
    val: sorted.slice(devEnd, valEnd),
    holdout: sorted.slice(valEnd),
  }
}

function evaluate(rows, side, getSet) {
  let currentHit = 0
  let candidateHit = 0
  let currentJodi = 0
  let candidateJodi = 0
  for (const row of rows) {
    const currentOpen = row.openRanking
    const currentClose = row.closeRanking
    const candidateSideSet = getSet(row)
    const candidateOpen = side === 'open' ? candidateSideSet : currentOpen
    const candidateClose = side === 'close' ? candidateSideSet : currentClose
    if (currentSet(row, side).includes(actualDigit(row, side))) currentHit++
    if (candidateSideSet.includes(actualDigit(row, side))) candidateHit++
    if (hasJodi(row, currentOpen, currentClose)) currentJodi++
    if (hasJodi(row, candidateOpen, candidateClose)) candidateJodi++
  }
  return {
    n: rows.length,
    currentHit,
    candidateHit,
    delta: candidateHit - currentHit,
    currentJodi,
    candidateJodi,
    jodiDelta: candidateJodi - currentJodi,
  }
}

function candidateSet(candidate, row, byDate, marketIndex, historicalLookups) {
  const base = currentSet(row, candidate.side)
  const source = sourceRecord(candidate, row, byDate, marketIndex, historicalLookups)
  if (!source) return base
  const anchor = candidate.featureFn(source)
  if (anchor === null) return base
  return hybridSet(base, formulaDigits(candidate.formulaName, anchor), candidate.preserveCount)
}

function materializeRows(rows, byDate, sorted, rules) {
  const marketIndex = new Map(MARKET_ORDER.map((market, index) => [market, index]))
  const historicalLookups = buildHistoricalLookups(sorted, rows)
  const featureFns = new Map(FEATURE_DEFS)
  return rows.map((row) => {
    const next = { ...row, openRanking: [...row.openRanking], closeRanking: [...row.closeRanking] }
    for (const side of TARGET_SIDES) {
      for (const [sourceMarket, origin, featureName, formulaName, preserveCount] of rules[side][row.market] || []) {
        const candidate = {
          side,
          sourceMarket,
          origin,
          featureFn: featureFns.get(featureName),
          formulaName,
          preserveCount,
        }
        const baseRow = { ...next }
        const source = sourceRecord(candidate, baseRow, byDate, marketIndex, historicalLookups)
        if (!source) continue
        const anchor = candidate.featureFn(source)
        if (anchor === null) continue
        const ranking = hybridSet(currentSet(baseRow, side), formulaDigits(formulaName, anchor), preserveCount)
        if (side === 'open') next.openRanking = ranking
        else next.closeRanking = ranking
      }
    }
    return next
  })
}

function gateValue(candidate, row, gateName, byDate, marketIndex, historicalLookups) {
  if (gateName === 'weekday') return row.day
  if (gateName === 'weekOfMonth') return String(Math.floor((Number(row.isoDate.slice(8, 10)) - 1) / 7))
  if (gateName === 'dayParity') return String(Number(row.isoDate.slice(8, 10)) % 2)
  const base = currentSet(row, candidate.side)
  if (gateName === 'base5') return String(base[4])
  if (gateName === 'base6') return String(base[5])
  if (gateName === 'baseHousePair') return `${base[4] <= 4 ? 'L' : 'H'}${base[5] <= 4 ? 'L' : 'H'}`
  const source = sourceRecord(candidate, row, byDate, marketIndex, historicalLookups)
  if (!source) return null
  const anchor = candidate.featureFn(source)
  if (anchor === null) return null
  if (gateName === 'anchorHouse') return anchor <= 4 ? 'low' : 'high'
  return String(anchor)
}

function searchGated(candidates, rows730, rows30, sorted, byDate) {
  const marketIndex = new Map(MARKET_ORDER.map((market, index) => [market, index]))
  const historicalLookups = buildHistoricalLookups(sorted, rows730)
  const featureFns = new Map(FEATURE_DEFS)
  const gateNames = ['weekday', 'weekOfMonth', 'dayParity', 'base5', 'base6', 'baseHousePair', 'anchorDigit', 'anchorHouse']
  const output = []
  for (const targetMarket of TARGET_MARKETS) {
    const targetRows730 = rows730.filter((row) => row.market === targetMarket)
    const targetRows30 = rows30.filter((row) => row.market === targetMarket)
    const splits = splitRows(targetRows730)
    for (const side of TARGET_SIDES) {
      const shortlist = candidates
        .filter((candidate) => candidate.targetMarket === targetMarket && candidate.side === side && candidate.split.dev.delta > 0)
        .sort((a, b) => b.split.dev.delta - a.split.dev.delta || b.split.dev.candidateHit - a.split.dev.candidateHit)
        .slice(0, 120)
      for (const stored of shortlist) {
        const candidate = { ...stored, featureFn: featureFns.get(stored.featureName) }
        const rawSet = (row) => candidateSet(candidate, row, byDate, marketIndex, historicalLookups)
        for (const gateName of gateNames) {
          const categoryDeltas = new Map()
          const categoryN = new Map()
          for (const row of splits.dev) {
            const category = gateValue(candidate, row, gateName, byDate, marketIndex, historicalLookups)
            if (category === null) continue
            const actual = actualDigit(row, side)
            const delta = Number(rawSet(row).includes(actual)) - Number(currentSet(row, side).includes(actual))
            categoryDeltas.set(category, (categoryDeltas.get(category) || 0) + delta)
            categoryN.set(category, (categoryN.get(category) || 0) + 1)
          }
          const categories = [...categoryDeltas.keys()].filter(
            (category) => categoryDeltas.get(category) > 0 && categoryN.get(category) >= 8,
          )
          if (categories.length === 0) continue
          const categorySet = new Set(categories)
          const getSet = (row) => {
            const category = gateValue(candidate, row, gateName, byDate, marketIndex, historicalLookups)
            return category !== null && categorySet.has(category) ? rawSet(row) : currentSet(row, side)
          }
          const full730 = evaluate(targetRows730, side, getSet)
          const final30 = evaluate(targetRows30, side, getSet)
          const split = Object.fromEntries(
            Object.entries(splits).map(([name, splitRowsForName]) => [name, evaluate(splitRowsForName, side, getSet)]),
          )
          const stable = split.dev.delta > 0
            && split.val.delta >= 0
            && split.holdout.delta >= 0
            && full730.delta > 0
            && full730.jodiDelta >= 0
            && final30.delta > 0
            && final30.jodiDelta >= 0
          output.push({
            targetMarket,
            side,
            sourceMarket: candidate.sourceMarket,
            origin: candidate.origin,
            featureName: candidate.featureName,
            formulaName: candidate.formulaName,
            preserveCount: candidate.preserveCount,
            gateName,
            categories,
            full730,
            final30,
            split,
            stable,
          })
        }
      }
    }
  }
  return output.sort((a, b) => {
    if (Number(b.stable) !== Number(a.stable)) return Number(b.stable) - Number(a.stable)
    return b.final30.delta - a.final30.delta
      || b.final30.jodiDelta - a.final30.jodiDelta
      || b.full730.delta - a.full730.delta
  })
}

function searchExpertGated(candidates, rows730, rows30, sorted, byDate) {
  const marketIndex = new Map(MARKET_ORDER.map((market, index) => [market, index]))
  const historicalLookups = buildHistoricalLookups(sorted, rows730)
  const featureFns = new Map(FEATURE_DEFS)
  const gateNames = ['weekday', 'weekOfMonth', 'dayParity', 'base5', 'base6', 'baseHousePair']
  const output = []
  for (const targetMarket of TARGET_MARKETS) {
    const targetRows730 = rows730.filter((row) => row.market === targetMarket)
    const targetRows30 = rows30.filter((row) => row.market === targetMarket)
    const splits = splitRows(targetRows730)
    for (const side of TARGET_SIDES) {
      const experts = candidates
        .filter((candidate) => candidate.targetMarket === targetMarket && candidate.side === side && candidate.split.dev.delta > 0)
        .sort((a, b) => b.split.dev.delta - a.split.dev.delta || b.split.dev.candidateHit - a.split.dev.candidateHit)
        .slice(0, 40)
        .map((candidate) => ({ ...candidate, featureFn: featureFns.get(candidate.featureName) }))
      if (experts.length === 0) continue
      for (const gateName of gateNames) {
        const categoryRows = new Map()
        for (const row of splits.dev) {
          const category = gateValue(experts[0], row, gateName, byDate, marketIndex, historicalLookups)
          if (category === null) continue
          if (!categoryRows.has(category)) categoryRows.set(category, [])
          categoryRows.get(category).push(row)
        }
        const expertByCategory = new Map()
        for (const [category, rows] of categoryRows) {
          if (rows.length < 8) continue
          let best = null
          for (const expert of experts) {
            let delta = 0
            for (const row of rows) {
              const actual = actualDigit(row, side)
              delta += Number(candidateSet(expert, row, byDate, marketIndex, historicalLookups).includes(actual))
                - Number(currentSet(row, side).includes(actual))
            }
            if (delta > 0 && (!best || delta > best.delta)) best = { expert, delta }
          }
          if (best) expertByCategory.set(category, best.expert)
        }
        if (expertByCategory.size === 0) continue
        const getSet = (row) => {
          const category = gateValue(experts[0], row, gateName, byDate, marketIndex, historicalLookups)
          const expert = category === null ? null : expertByCategory.get(category)
          return expert ? candidateSet(expert, row, byDate, marketIndex, historicalLookups) : currentSet(row, side)
        }
        const full730 = evaluate(targetRows730, side, getSet)
        const final30 = evaluate(targetRows30, side, getSet)
        const split = Object.fromEntries(
          Object.entries(splits).map(([name, splitRowsForName]) => [name, evaluate(splitRowsForName, side, getSet)]),
        )
        const stable = split.dev.delta > 0
          && split.val.delta >= 0
          && split.holdout.delta >= 0
          && full730.delta > 0
          && full730.jodiDelta >= 0
          && final30.delta > 0
          && final30.jodiDelta >= 0
        output.push({
          targetMarket,
          side,
          gateName,
          experts: Object.fromEntries([...expertByCategory].map(([category, expert]) => [category, {
            sourceMarket: expert.sourceMarket,
            origin: expert.origin,
            featureName: expert.featureName,
            formulaName: expert.formulaName,
            preserveCount: expert.preserveCount,
          }])),
          full730,
          final30,
          split,
          stable,
        })
      }
    }
  }
  return output.sort((a, b) => {
    if (Number(b.stable) !== Number(a.stable)) return Number(b.stable) - Number(a.stable)
    return b.final30.delta - a.final30.delta
      || b.final30.jodiDelta - a.final30.jodiDelta
      || b.full730.delta - a.full730.delta
  })
}

function summarizeRows(rows) {
  const totals = { n: rows.length, open: 0, close: 0, jodi: 0 }
  for (const row of rows) {
    if (row.openRanking.includes(row.actualOpen)) totals.open++
    if (row.closeRanking.includes(row.actualClose)) totals.close++
    if (hasJodi(row, row.openRanking, row.closeRanking)) totals.jodi++
  }
  return totals
}

function search(rows730, rows30, sorted, byDate) {
  const marketIndex = new Map(MARKET_ORDER.map((market, index) => [market, index]))
  const historicalLookups = buildHistoricalLookups(sorted, rows730)
  const candidates = []
  for (const targetMarket of TARGET_MARKETS) {
    const targetRows730 = rows730.filter((row) => row.market === targetMarket)
    const targetRows30 = rows30.filter((row) => row.market === targetMarket)
    const splits = splitRows(targetRows730)
    for (const side of TARGET_SIDES) {
      for (const sourceMarket of MARKET_ORDER) {
        for (const origin of [
          'previousDraw', 'lag2', 'lag3', 'lag4', 'lag5', 'lag6', 'lag7',
          'previousWeekday', 'previousMonthDay', 'sameDay',
        ]) {
          if (origin === 'sameDay' && marketIndex.get(sourceMarket) >= marketIndex.get(targetMarket)) continue
          for (const [featureName, featureFn] of FEATURE_DEFS) {
            for (const formulaName of Object.keys(FORMULAS)) {
              for (const preserveCount of PRESERVE_COUNTS) {
                const candidate = {
                  targetMarket,
                  side,
                  sourceMarket,
                  origin,
                  featureName,
                  featureFn,
                  formulaName,
                  preserveCount,
                }
                const getSet = (row) => candidateSet(candidate, row, byDate, marketIndex, historicalLookups)
                const full730 = evaluate(targetRows730, side, getSet)
                const final30 = evaluate(targetRows30, side, getSet)
                const split = Object.fromEntries(
                  Object.entries(splits).map(([name, splitRowsForName]) => [name, evaluate(splitRowsForName, side, getSet)]),
                )
                const stable = full730.delta >= 0
                  && full730.jodiDelta >= 0
                  && final30.delta > 0
                  && final30.jodiDelta >= 0
                  && split.dev.delta >= 0
                  && split.val.delta >= 0
                  && split.holdout.delta >= 0
                candidates.push({
                  targetMarket,
                  side,
                  sourceMarket,
                  origin,
                  featureName,
                  formulaName,
                  preserveCount,
                  full730,
                  final30,
                  split,
                  stable,
                })
              }
            }
          }
        }
      }
    }
  }
  return candidates.sort((a, b) => {
    if (Number(b.stable) !== Number(a.stable)) return Number(b.stable) - Number(a.stable)
    return (b.final30.delta - a.final30.delta)
      || (b.final30.jodiDelta - a.final30.jodiDelta)
      || (b.full730.delta - a.full730.delta)
      || (b.full730.jodiDelta - a.full730.jodiDelta)
  })
}

function pct(hit, n) {
  return n ? `${hit}/${n} (${((hit / n) * 100).toFixed(1)}%)` : '0/0 (0.0%)'
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.map((column) => column.label).join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${columns.map((column) => String(column.value(row))).join(' | ')} |`),
  ].join('\n')
}

function writeReport(output) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  const stable = output.candidates.filter((candidate) => candidate.stable)
  const rows = (stable.length ? stable : output.candidates).slice(0, 30).map((candidate) => ({
    target: `${candidate.targetMarket}.${candidate.side}`,
    rule: `${candidate.origin}:${candidate.sourceMarket}.${candidate.featureName}.${candidate.formulaName}`,
    d30: candidate.final30.delta,
    j30: candidate.final30.jodiDelta,
    hit30: pct(candidate.final30.candidateHit, candidate.final30.n),
    d730: candidate.full730.delta,
    j730: candidate.full730.jodiDelta,
    hit730: pct(candidate.full730.candidateHit, candidate.full730.n),
    split: `${candidate.split.dev.delta}/${candidate.split.val.delta}/${candidate.split.holdout.delta}`,
    stable: candidate.stable ? 'yes' : 'no',
  }))
  const text = [
    '# Next Hybrid Candidate Search',
    '',
    `Generated: ${output.generatedAt}`,
    '',
    'Baseline: latest same-day-pack production ledger.',
    '',
    `Stable candidates: ${stable.length}`,
    '',
    markdownTable(rows, [
      { label: 'Target', value: (row) => row.target },
      { label: 'Rule', value: (row) => row.rule },
      { label: '30 delta', value: (row) => row.d30 },
      { label: '30 jodi delta', value: (row) => row.j30 },
      { label: '30 hit', value: (row) => row.hit30 },
      { label: '730 delta', value: (row) => row.d730 },
      { label: '730 jodi delta', value: (row) => row.j730 },
      { label: '730 hit', value: (row) => row.hit730 },
      { label: 'dev/val/holdout', value: (row) => row.split },
      { label: 'Stable', value: (row) => row.stable },
    ]),
    '',
  ].join('\n')
  fs.writeFileSync(REPORT_PATH, text)
}

function main() {
  const { sorted, byDate } = prepareRecords(readJson(RECORDS_PATH))
  if (process.env.SUTTA_MATERIALIZE_CURRENT === '1') {
    const base30 = enrichRows(readJson(LEDGER_30_PATH).ledger, byDate)
    const base730 = enrichRows(readJson(LEDGER_730_PATH).ledger, byDate)
    const rules = process.env.SUTTA_MATERIALIZE_EXPERIMENT === '1' ? EXPERIMENTAL_RULES : CURRENT_RULES
    const current30 = materializeRows(base30, byDate, sorted, rules)
    const current730 = materializeRows(base730, byDate, sorted, rules)
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ ledger: current30, totals: summarizeRows(current30) }, null, 2))
    fs.writeFileSync(REPORT_PATH, JSON.stringify({ ledger: current730, totals: summarizeRows(current730) }, null, 2))
    console.log('30d', summarizeRows(current30))
    console.log('730d', summarizeRows(current730))
    console.log(`Saved ${OUTPUT_PATH}`)
    console.log(`Saved ${REPORT_PATH}`)
    return
  }
  const rows30 = enrichRows(readJson(LEDGER_30_PATH).ledger, byDate)
  const rows730 = enrichRows(readJson(LEDGER_730_PATH).ledger, byDate)
  const candidates = search(rows730, rows30, sorted, byDate)
  const gatedCandidates = process.env.SUTTA_GATED_SEARCH === '1'
    ? searchGated(candidates, rows730, rows30, sorted, byDate)
    : []
  const expertGatedCandidates = process.env.SUTTA_EXPERT_GATED === '1'
    ? searchExpertGated(candidates, rows730, rows30, sorted, byDate)
    : []
  const output = {
    generatedAt: new Date().toISOString(),
    inputs: {
      records: RECORDS_PATH,
      ledger30: LEDGER_30_PATH,
      ledger730: LEDGER_730_PATH,
    },
    candidates: candidates.slice(0, OUTPUT_LIMIT),
    gatedCandidates: gatedCandidates.slice(0, OUTPUT_LIMIT),
    expertGatedCandidates: expertGatedCandidates.slice(0, OUTPUT_LIMIT),
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  writeReport(output)
  const stable = candidates.filter((candidate) => candidate.stable)
  const stableGated = gatedCandidates.filter((candidate) => candidate.stable)
  console.log(`Stable candidates: ${stable.length}`)
  console.log(`Stable gated candidates: ${stableGated.length}`)
  for (const candidate of stable.slice(0, 20)) {
    console.log([
      `${candidate.targetMarket}.${candidate.side}`,
      `${candidate.origin}:${candidate.sourceMarket}.${candidate.featureName}.${candidate.formulaName}`,
      `30d +${candidate.final30.delta} side / +${candidate.final30.jodiDelta} jodi`,
      `730d +${candidate.full730.delta} side / +${candidate.full730.jodiDelta} jodi`,
      `split ${candidate.split.dev.delta}/${candidate.split.val.delta}/${candidate.split.holdout.delta}`,
    ].join(' | '))
  }
  console.log(`Saved ${OUTPUT_PATH}`)
  console.log(`Saved ${REPORT_PATH}`)
}

main()
