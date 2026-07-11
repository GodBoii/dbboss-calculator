/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const RECORDS_PATH = path.join(ROOT, 'scratch', 'sutta-research-records.json')
const LEDGER_30_PATH = path.join(ROOT, 'scratch', 'sutta-baseline-30d-current-ledger.json')
const LEDGER_730_PATH = path.join(ROOT, 'scratch', 'sutta-baseline-730d-current-ledger.json')
const OUTPUT_PATH = path.join(ROOT, 'scratch', 'sutta-feasibility-audit-output.json')
const REPORT_PATH = path.join(ROOT, 'backtest_reports', '2026-07-11', 'sutta-feasibility-and-miss-audit.md')

const DAY_OFFSETS = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
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

function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

function getRecordIsoDate(record) {
  const start = parseDate(record.dateRangeStart)
  if (!start) return null
  return toIsoDate(addDays(start, DAY_OFFSETS[record.day] ?? 0))
}

function pct(hit, n) {
  return n ? (hit / n) * 100 : 0
}

function pctText(hit, n) {
  return `${hit}/${n} (${pct(hit, n).toFixed(1)}%)`
}

function digit(value) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed % 10 : null
}

function mod10(value) {
  return ((value % 10) + 10) % 10
}

function unique(values) {
  const seen = new Set()
  const output = []
  for (const value of values) {
    const next = digit(value)
    if (next === null || seen.has(next)) continue
    seen.add(next)
    output.push(next)
  }
  return output
}

function topDigits(values, count) {
  const counts = Array.from({ length: 10 }, (_, sutta) => ({ sutta, hit: 0 }))
  for (const value of values) {
    const next = digit(value)
    if (next !== null) counts[next].hit++
  }
  return counts
    .sort((a, b) => b.hit - a.hit || a.sutta - b.sutta)
    .slice(0, count)
    .map((item) => item.sutta)
}

function fillToSix(base, fallback) {
  const output = unique(base)
  for (const value of fallback) {
    if (output.length >= 6) break
    const next = digit(value)
    if (next !== null && !output.includes(next)) output.push(next)
  }
  for (let value = 0; output.length < 6 && value <= 9; value++) {
    if (!output.includes(value)) output.push(value)
  }
  return output.slice(0, 6)
}

function countHits(rows, side, getSet) {
  const actualKey = side === 'open' ? 'actualOpen' : 'actualClose'
  let hit = 0
  for (const row of rows) {
    if (getSet(row).includes(row[actualKey])) hit++
  }
  return { hit, n: rows.length }
}

function currentSet(row, side) {
  return side === 'open' ? row.openRanking : row.closeRanking
}

function hasJodi(row, openSet = row.openRanking, closeSet = row.closeRanking) {
  const actualJodi = row.actualJodi || String(row.actualOpen) + String(row.actualClose)
  return openSet.some((open) => closeSet.some((close) => String(open) + String(close) === actualJodi))
}

function currentMetrics(rows) {
  const byMarket = {}
  const totals = {
    open: { hit: 0, n: 0 },
    close: { hit: 0, n: 0 },
    jodi: { hit: 0, n: 0 },
  }

  for (const row of rows) {
    if (!byMarket[row.market]) {
      byMarket[row.market] = {
        open: { hit: 0, n: 0 },
        close: { hit: 0, n: 0 },
        jodi: { hit: 0, n: 0 },
      }
    }

    const openHit = row.openRanking.includes(row.actualOpen)
    const closeHit = row.closeRanking.includes(row.actualClose)
    const jodiHit = hasJodi(row)
    for (const [target, didHit] of [
      ['open', openHit],
      ['close', closeHit],
      ['jodi', jodiHit],
    ]) {
      byMarket[row.market][target].n++
      totals[target].n++
      if (didHit) {
        byMarket[row.market][target].hit++
        totals[target].hit++
      }
    }
  }

  return { byMarket, totals }
}

function enrichRows(rows, byDate) {
  return rows.map((row) => ({
    ...row,
    actualJodi: byDate[row.market]?.get(row.isoDate)?.jodi || String(row.actualOpen) + String(row.actualClose),
  }))
}

function fixedWindowAudit(rows, markets) {
  const output = {}
  for (const market of markets) {
    const marketRows = rows.filter((row) => row.market === market)
    output[market] = {}
    for (const side of ['open', 'close']) {
      const actualKey = side === 'open' ? 'actualOpen' : 'actualClose'
      const values = marketRows.map((row) => row[actualKey])
      const bestSix = topDigits(values, 6)
      const hit = values.filter((value) => bestSix.includes(value)).length
      const minK90 = minimumKForCoverage(values, 0.9)
      output[market][side] = {
        bestSix,
        bestSixHit: hit,
        n: values.length,
        bestSixAccuracy: pct(hit, values.length),
        minimumKFor90: minK90,
      }
    }
  }
  return output
}

function minimumKForCoverage(values, target) {
  const n = values.length
  if (!n) return null
  const counts = Array.from({ length: 10 }, (_, sutta) => ({
    sutta,
    hit: values.filter((value) => digit(value) === sutta).length,
  })).sort((a, b) => b.hit - a.hit || a.sutta - b.sutta)
  let seen = 0
  for (let k = 1; k <= 10; k++) {
    seen += counts[k - 1].hit
    if (seen / n >= target) return k
  }
  return 10
}

function missAudit(rows, markets) {
  const output = {}
  for (const market of markets) {
    const marketRows = rows.filter((row) => row.market === market)
    output[market] = {}
    for (const side of ['open', 'close']) {
      const actualKey = side === 'open' ? 'actualOpen' : 'actualClose'
      const misses = marketRows.filter((row) => !currentSet(row, side).includes(row[actualKey]))
      const topMissDigits = topDigits(misses.map((row) => row[actualKey]), 4)
      output[market][side] = {
        misses: misses.length,
        n: marketRows.length,
        topMissDigits,
      }
    }
  }
  return output
}

function prepareRecords(recordsByMarket) {
  const output = {}
  const byDate = {}
  for (const [market, records] of Object.entries(recordsByMarket)) {
    output[market] = records
      .map((record) => ({ ...record, isoDate: getRecordIsoDate(record) }))
      .filter((record) => record.isoDate)
      .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    byDate[market] = new Map(output[market].map((record) => [record.isoDate, record]))
  }
  return { sorted: output, byDate }
}

function priorRecords(sortedRecords, market, isoDate) {
  return (sortedRecords[market] || []).filter((record) => record.isoDate < isoDate)
}

function rollingFrequencySet(sortedRecords, row, side, mode) {
  const prior = priorRecords(sortedRecords, row.market, row.isoDate)
  const sideKey = side === 'open' ? 'openSutta' : 'closeSutta'
  const targetDate = new Date(`${row.isoDate}T00:00:00Z`)
  const filtered = prior.filter((record) => {
    if (mode === 'all') return true
    if (mode === 'weekday') return record.day === row.day
    if (mode === 'recent20') return true
    if (mode === 'monthday') {
      const recordDate = new Date(`${record.isoDate}T00:00:00Z`)
      return recordDate.getUTCMonth() === targetDate.getUTCMonth()
        && recordDate.getUTCDate() === targetDate.getUTCDate()
    }
    return true
  })
  const source = mode === 'recent20' ? filtered.slice(-20) : filtered
  return fillToSix(topDigits(source.map((record) => record[sideKey]), 6), topDigits(prior.map((record) => record[sideKey]), 10))
}

function sourceRecordFor(origin, sourceMarket, row, byDate, sortedRecords) {
  if (origin === 'sameDayEarlier') {
    return byDate[sourceMarket]?.get(row.isoDate) || null
  }
  if (origin === 'previousDraw') {
    return priorRecords(sortedRecords, sourceMarket, row.isoDate).at(-1) || null
  }
  return null
}

const SOURCE_FORMULAS = {
  source: (d) => [d],
  opposite: (d) => [d + 5],
  sourceOpposite: (d) => [d, d + 5],
  nearTwoOpposite: (d) => [d, d + 1, d - 1, d + 2, d - 2, d + 5],
  oppositeNearTwo: (d) => [d + 5, d + 4, d + 6, d, d + 1, d - 1],
  mirrorOpposite: (d) => [d, 9 - d, d + 5, 14 - d, d + 1, d - 1],
  addThreeCycle: (d) => [d, d + 3, d + 6, d + 9, d + 1, d + 5],
}

function formulaSet(formulaName, sourceDigit, fallback) {
  const raw = SOURCE_FORMULAS[formulaName](sourceDigit).map(mod10)
  return fillToSix(raw, fallback)
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

function evaluateCandidate(rows, side, getSet) {
  const actualKey = side === 'open' ? 'actualOpen' : 'actualClose'
  let candidateHit = 0
  let currentHit = 0
  for (const row of rows) {
    if (getSet(row).includes(row[actualKey])) candidateHit++
    if (currentSet(row, side).includes(row[actualKey])) currentHit++
  }
  return {
    candidateHit,
    currentHit,
    n: rows.length,
    delta: candidateHit - currentHit,
  }
}

function simpleFallbackComparisons(rows, markets, sortedRecords) {
  const output = []
  for (const market of markets) {
    const marketRows = rows.filter((row) => row.market === market)
    for (const side of ['open', 'close']) {
      for (const mode of ['all', 'weekday', 'monthday', 'recent20']) {
        const metric = countHits(marketRows, side, (row) => rollingFrequencySet(sortedRecords, row, side, mode))
        const current = countHits(marketRows, side, (row) => currentSet(row, side))
        output.push({
          market,
          side,
          mode,
          candidateHit: metric.hit,
          currentHit: current.hit,
          n: metric.n,
          delta: metric.hit - current.hit,
          candidateAccuracy: pct(metric.hit, metric.n),
          currentAccuracy: pct(current.hit, current.n),
        })
      }
    }
  }
  return output.sort((a, b) => b.delta - a.delta || b.candidateAccuracy - a.candidateAccuracy)
}

function sourceFormulaSearch(rows730, rows30, markets, sortedRecords, byDate, mode = 'replace') {
  const marketOrderIndex = new Map(markets.map((market, index) => [market, index]))
  const candidates = []

  for (const targetMarket of markets) {
    const targetRows730 = rows730.filter((row) => row.market === targetMarket)
    const targetRows30 = rows30.filter((row) => row.market === targetMarket)
    const split = splitRows(targetRows730)
    for (const side of ['open', 'close']) {
      for (const sourceMarket of markets) {
        for (const sourceSide of ['open', 'close']) {
          for (const origin of ['sameDayEarlier', 'previousDraw']) {
            if (origin === 'sameDayEarlier' && marketOrderIndex.get(sourceMarket) >= marketOrderIndex.get(targetMarket)) {
              continue
            }
            for (const formulaName of Object.keys(SOURCE_FORMULAS)) {
              const getSet = (row) => {
                const fallback = rollingFrequencySet(sortedRecords, row, side, 'all')
                const source = sourceRecordFor(origin, sourceMarket, row, byDate, sortedRecords)
                const sourceDigit = source ? digit(sourceSide === 'open' ? source.openSutta : source.closeSutta) : null
                const formula = sourceDigit === null ? fallback : formulaSet(formulaName, sourceDigit, fallback)
                if (mode === 'hybridTop4') return fillToSix(currentSet(row, side).slice(0, 4), formula)
                return formula
              }
              const full730 = evaluateCandidate(targetRows730, side, getSet)
              const final30 = evaluateCandidate(targetRows30, side, getSet)
              const splitMetrics = Object.fromEntries(
                Object.entries(split).map(([name, splitRowsForName]) => [name, evaluateCandidate(splitRowsForName, side, getSet)]),
              )
              candidates.push({
                targetMarket,
                side,
                sourceMarket,
                sourceSide,
                origin,
                formulaName,
                mode,
                full730,
                final30,
                split: splitMetrics,
                stable: full730.delta >= 0
                  && final30.delta > 0
                  && splitMetrics.dev.delta >= 0
                  && splitMetrics.val.delta >= 0
                  && splitMetrics.holdout.delta >= 0,
              })
            }
          }
        }
      }
    }
  }

  return candidates.sort((a, b) => {
    if (Number(b.stable) !== Number(a.stable)) return Number(b.stable) - Number(a.stable)
    return (b.final30.delta - a.final30.delta)
      || (b.full730.delta - a.full730.delta)
      || (b.final30.candidateHit - a.final30.candidateHit)
  })
}

function summarizeCurrent(rows, markets) {
  const metrics = currentMetrics(rows)
  return markets.map((market) => {
    const item = metrics.byMarket[market]
    return {
      market,
      n: item.open.n,
      open: pctText(item.open.hit, item.open.n),
      close: pctText(item.close.hit, item.close.n),
      jodi: pctText(item.jodi.hit, item.jodi.n),
    }
  })
}

function markdownTable(rows, columns) {
  const header = `| ${columns.map((column) => column.label).join(' | ')} |`
  const separator = `| ${columns.map(() => '---').join(' | ')} |`
  const body = rows.map((row) => `| ${columns.map((column) => String(column.value(row))).join(' | ')} |`)
  return [header, separator, ...body].join('\n')
}

function writeReport(output) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  const bestStable = output.sourceFormulaSearch.filter((candidate) => candidate.stable).slice(0, 10)
  const bestExploratory = output.sourceFormulaSearch.slice(0, 10)
  const bestHybridStable = output.sourceFormulaHybridSearch.filter((candidate) => candidate.stable).slice(0, 10)
  const bestHybridExploratory = output.sourceFormulaHybridSearch.slice(0, 10)
  const fallbackRows = output.simpleFallbackComparisons30.slice(0, 12)

  const requiredRows = []
  for (const [market, item] of Object.entries(output.fixedWindowAudit30)) {
    requiredRows.push({
      market,
      open: item.open.minimumKFor90,
      close: item.close.minimumKFor90,
      openBest6: pctText(item.open.bestSixHit, item.open.n),
      closeBest6: pctText(item.close.bestSixHit, item.close.n),
    })
  }

  const missRows = []
  for (const [market, item] of Object.entries(output.missAudit30)) {
    missRows.push({
      market,
      openMisses: `${item.open.misses}/${item.open.n}`,
      openDigits: item.open.topMissDigits.join(', '),
      closeMisses: `${item.close.misses}/${item.close.n}`,
      closeDigits: item.close.topMissDigits.join(', '),
    })
  }

  const lines = [
    '# Sutta Feasibility and Miss Audit',
    '',
    `Generated: ${output.generatedAt}`,
    '',
    'This audit is research-only. It evaluates the current Top-6 production ledger, fixed hindsight limits, rolling frequency fallbacks, and simple source-market/opposite/near-number formulas. No production predictor change is made from this file alone.',
    '',
    '## Current Top-6 Accuracy',
    '',
    markdownTable(output.current30ByMarket, [
      { label: 'Market', value: (row) => row.market },
      { label: 'N', value: (row) => row.n },
      { label: 'Open', value: (row) => row.open },
      { label: 'Close', value: (row) => row.close },
      { label: 'Jodi', value: (row) => row.jodi },
    ]),
    '',
    `30-day totals: Open ${pctText(output.current30Totals.open.hit, output.current30Totals.open.n)}, Close ${pctText(output.current30Totals.close.hit, output.current30Totals.close.n)}, Jodi ${pctText(output.current30Totals.jodi.hit, output.current30Totals.jodi.n)}.`,
    '',
    `730-day totals: Open ${pctText(output.current730Totals.open.hit, output.current730Totals.open.n)}, Close ${pctText(output.current730Totals.close.hit, output.current730Totals.close.n)}, Jodi ${pctText(output.current730Totals.jodi.hit, output.current730Totals.jodi.n)}.`,
    '',
    '## 90% Feasibility Signal',
    '',
    'The `minimumKFor90` columns are cheating hindsight: they ask how many different sutta digits would be needed to cover 90% of the last 30 actual results if we already knew the results. If this is usually 8-10, a true Top-6 90% target needs a very strong conditional signal, not just better frequency ranking.',
    '',
    markdownTable(requiredRows, [
      { label: 'Market', value: (row) => row.market },
      { label: 'Open minimumKFor90', value: (row) => row.open },
      { label: 'Close minimumKFor90', value: (row) => row.close },
      { label: 'Best fixed Open-6', value: (row) => row.openBest6 },
      { label: 'Best fixed Close-6', value: (row) => row.closeBest6 },
    ]),
    '',
    '## Current Miss Clusters',
    '',
    markdownTable(missRows, [
      { label: 'Market', value: (row) => row.market },
      { label: 'Open misses', value: (row) => row.openMisses },
      { label: 'Open miss digits', value: (row) => row.openDigits },
      { label: 'Close misses', value: (row) => row.closeMisses },
      { label: 'Close miss digits', value: (row) => row.closeDigits },
    ]),
    '',
    '## Rolling Fallbacks vs Current Model',
    '',
    'These are simple market-specific fallbacks on the last 30 days: all-history frequency, same-weekday frequency, same month-day frequency, and recent-20 frequency. Positive delta means the fallback beat the current model for that market and side.',
    '',
    markdownTable(fallbackRows, [
      { label: 'Market', value: (row) => row.market },
      { label: 'Side', value: (row) => row.side },
      { label: 'Fallback', value: (row) => row.mode },
      { label: 'Fallback', value: (row) => pctText(row.candidateHit, row.n) },
      { label: 'Current', value: (row) => pctText(row.currentHit, row.n) },
      { label: 'Delta', value: (row) => row.delta },
    ]),
    '',
    '## Source Formula Search',
    '',
    bestStable.length
      ? 'Stable candidates below beat or tied current over dev/validation/holdout/full-730 and improved final-30.'
      : 'No source-market formula cleared the stability gate. The best exploratory formulas are listed below, but they are not deployment-safe yet.',
    '',
    markdownTable((bestStable.length ? bestStable : bestExploratory).map((candidate) => ({
      rule: `${candidate.origin}:${candidate.sourceMarket}.${candidate.sourceSide}.${candidate.formulaName}`,
      target: `${candidate.targetMarket}.${candidate.side}`,
      d730: candidate.full730.delta,
      h730: `${candidate.full730.candidateHit}/${candidate.full730.n}`,
      d30: candidate.final30.delta,
      h30: `${candidate.final30.candidateHit}/${candidate.final30.n}`,
      split: `${candidate.split.dev.delta}/${candidate.split.val.delta}/${candidate.split.holdout.delta}`,
      stable: candidate.stable ? 'yes' : 'no',
    })), [
      { label: 'Target', value: (row) => row.target },
      { label: 'Rule', value: (row) => row.rule },
      { label: '730 delta', value: (row) => row.d730 },
      { label: '730 hit', value: (row) => row.h730 },
      { label: '30 delta', value: (row) => row.d30 },
      { label: '30 hit', value: (row) => row.h30 },
      { label: 'dev/val/holdout delta', value: (row) => row.split },
      { label: 'Stable', value: (row) => row.stable },
    ]),
    '',
    '## Source Formula Hybrid Search',
    '',
    bestHybridStable.length
      ? 'These candidates preserve the current Top-4 digits and only use the formula for ranks 5-6. This is the safer shape for production review.'
      : 'No Top-4-preserving source formula cleared the stability gate. The best exploratory hybrid formulas are listed below.',
    '',
    markdownTable((bestHybridStable.length ? bestHybridStable : bestHybridExploratory).map((candidate) => ({
      rule: candidate.origin + ':' + candidate.sourceMarket + '.' + candidate.sourceSide + '.' + candidate.formulaName,
      target: candidate.targetMarket + '.' + candidate.side,
      d730: candidate.full730.delta,
      h730: candidate.full730.candidateHit + '/' + candidate.full730.n,
      d30: candidate.final30.delta,
      h30: candidate.final30.candidateHit + '/' + candidate.final30.n,
      split: candidate.split.dev.delta + '/' + candidate.split.val.delta + '/' + candidate.split.holdout.delta,
      stable: candidate.stable ? 'yes' : 'no',
    })), [
      { label: 'Target', value: (row) => row.target },
      { label: 'Rule', value: (row) => row.rule },
      { label: '730 delta', value: (row) => row.d730 },
      { label: '730 hit', value: (row) => row.h730 },
      { label: '30 delta', value: (row) => row.d30 },
      { label: '30 hit', value: (row) => row.h30 },
      { label: 'dev/val/holdout delta', value: (row) => row.split },
      { label: 'Stable', value: (row) => row.stable },
    ]),
    '',
    '## Interpretation',
    '',
    output.interpretation,
    '',
  ]

  fs.writeFileSync(REPORT_PATH, lines.join('\n'))
}

function main() {
  const recordsByMarket = readJson(RECORDS_PATH)
  const ledger30 = readJson(LEDGER_30_PATH)
  const ledger730 = readJson(LEDGER_730_PATH)
  const markets = Object.keys(ledger30.byMarket)
  const { sorted, byDate } = prepareRecords(recordsByMarket)
  const rows30 = enrichRows(ledger30.ledger, byDate)
  const rows730 = enrichRows(ledger730.ledger, byDate)

  const current30 = currentMetrics(rows30)
  const current730 = currentMetrics(rows730)
  const simpleFallbackComparisons30 = simpleFallbackComparisons(rows30, markets, sorted)
  const simpleFallbackComparisons730 = simpleFallbackComparisons(rows730, markets, sorted)
  const sourceFormulaSearchResults = sourceFormulaSearch(rows730, rows30, markets, sorted, byDate)
  const sourceFormulaHybridSearchResults = sourceFormulaSearch(rows730, rows30, markets, sorted, byDate, 'hybridTop4')
  const stableFormulaCount = sourceFormulaSearchResults.filter((candidate) => candidate.stable).length
  const stableHybridFormulaCount = sourceFormulaHybridSearchResults.filter((candidate) => candidate.stable).length

  const interpretation = stableFormulaCount
    ? `Found ${stableFormulaCount} full-replacement stable source formula candidates and ${stableHybridFormulaCount} Top-4-preserving stable hybrid candidates. They still need manual review before production integration because this search was broad and can overfit.`
    : 'No broad source-market/opposite/near-number formula passed the stability gate. Current evidence says the 90% Top-6 goal is not reachable by simple frequency, same-weekday, month-day, previous-result, opposite, or source-market arithmetic formulas alone.'

  const output = {
    generatedAt: new Date().toISOString(),
    inputs: {
      records: RECORDS_PATH,
      ledger30: LEDGER_30_PATH,
      ledger730: LEDGER_730_PATH,
    },
    current30Totals: current30.totals,
    current730Totals: current730.totals,
    current30ByMarket: summarizeCurrent(rows30, markets),
    fixedWindowAudit30: fixedWindowAudit(rows30, markets),
    fixedWindowAudit730: fixedWindowAudit(rows730, markets),
    missAudit30: missAudit(rows30, markets),
    simpleFallbackComparisons30,
    simpleFallbackComparisons730,
    sourceFormulaSearch: sourceFormulaSearchResults.slice(0, 100),
    sourceFormulaHybridSearch: sourceFormulaHybridSearchResults.slice(0, 100),
    stableFormulaCount,
    stableHybridFormulaCount,
    interpretation,
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  writeReport(output)

  console.log(`Current 30d Top-6: Open ${pctText(current30.totals.open.hit, current30.totals.open.n)}, Close ${pctText(current30.totals.close.hit, current30.totals.close.n)}, Jodi ${pctText(current30.totals.jodi.hit, current30.totals.jodi.n)}`)
  console.log(`Current 730d Top-6: Open ${pctText(current730.totals.open.hit, current730.totals.open.n)}, Close ${pctText(current730.totals.close.hit, current730.totals.close.n)}, Jodi ${pctText(current730.totals.jodi.hit, current730.totals.jodi.n)}`)
  console.log(`Stable source formula candidates: ${stableFormulaCount}`)
  console.log(`Stable Top-4-preserving formula candidates: ${stableHybridFormulaCount}`)
  console.log(`Saved ${OUTPUT_PATH}`)
  console.log(`Saved ${REPORT_PATH}`)
}

main()
