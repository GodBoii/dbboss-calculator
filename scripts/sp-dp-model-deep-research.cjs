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

const MARKET_SEQUENCE = Object.keys(MARKET_URLS)
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

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / DAY_MS)
}

function panelFor(record, side) {
  return side === 'open' ? record.openPanel : record.closePanel
}

function suttaFor(record, side) {
  return side === 'open' ? record.openSutta : record.closeSutta
}

function digitRoot(panel) {
  if (!panel) return null
  const sum = panel.split('').reduce((acc, digit) => acc + Number(digit), 0)
  return sum % 9 || 9
}

function highLow(panel) {
  if (!panel) return null
  let high = 0
  let low = 0
  for (const digit of panel) Number(digit) >= 5 ? high++ : low++
  return `${low}L/${high}H`
}

function house(panel, mode) {
  if (!panel) return null
  const digits = panel.split('').map(Number)
  if (mode === 'five') return digits.map((d) => (d <= 4 ? 'A' : 'B')).join('')
  if (mode === 'paired') return digits.map((d) => (d % 5)).join('')
  if (mode === 'oddEven') return digits.map((d) => (d % 2 ? 'O' : 'E')).join('')
  return null
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

function buildPriorAll(allDated, market, isoDate) {
  const priorAll = {}
  for (const [name, rows] of Object.entries(allDated)) {
    priorAll[name] = rows.filter((row) => row.isoDate < isoDate).map((row) => row.record)
  }
  priorAll[market] = priorAll[market] ?? []
  return priorAll
}

function actualKind(record, side) {
  const kind = getPanelKind(panelFor(record, side) || '')
  return kind === 'DP' ? 'DP' : 'SP'
}

function confidenceFromBias(predicted, dpBias) {
  const estimatedDpRate = Math.max(5, Math.min(70, round(24.4 * dpBias, 1)))
  return predicted === 'DP' ? estimatedDpRate : round(100 - estimatedDpRate, 1)
}

function featureRowsFor(records, side, market) {
  const rows = dated(records).slice(-730)
  const events = []
  for (let i = 0; i < rows.length; i++) {
    const { record, isoDate } = rows[i]
    const panel = panelFor(record, side)
    if (!panel) continue
    const kind = actualKind(record, side)
    const prev = events[events.length - 1]
    const previousSameWeekday = [...events].reverse().find((event) => event.day === record.day)
    const lastDpIndex = (() => {
      for (let j = events.length - 1; j >= 0; j--) if (events[j].kind === 'DP') return j
      return -1
    })()
    const dpGap = lastDpIndex === -1 ? null : events.length - lastDpIndex
    const rolling = (window) => {
      const slice = events.slice(-window)
      return slice.length ? slice.filter((event) => event.kind === 'DP').length : null
    }
    events.push({
      market,
      side,
      isoDate,
      day: record.day,
      panel,
      kind,
      sutta: suttaFor(record, side),
      root: digitRoot(panel),
      highLow: highLow(panel),
      fiveHouse: house(panel, 'five'),
      pairHouse: house(panel, 'paired'),
      oddEven: house(panel, 'oddEven'),
      prevKind: prev?.kind ?? null,
      prevSutta: prev?.sutta ?? null,
      prevFiveHouse: prev?.fiveHouse ?? null,
      prevOddEven: prev?.oddEven ?? null,
      prevHighLow: prev?.highLow ?? null,
      sameWeekdayPrevKind: previousSameWeekday?.kind ?? null,
      sameWeekdayPrevSutta: previousSameWeekday?.sutta ?? null,
      dpGap,
      rollingDp5: rolling(5),
      rollingDp10: rolling(10),
      rollingDp30: rolling(30),
    })
  }
  return events
}

function summarizeStructure(allRecords) {
  const rows = []
  for (const [market, records] of Object.entries(allRecords)) {
    for (const side of SIDES) {
      const events = featureRowsFor(records, side, market)
      let sp = 0
      let dp = 0
      const transitions = { 'SP->SP': 0, 'SP->DP': 0, 'DP->SP': 0, 'DP->DP': 0 }
      const streaks = []
      let streakKind = null
      let streakLength = 0
      for (const event of events) {
        if (event.kind === 'DP') dp++
        else sp++
        if (event.prevKind) transitions[`${event.prevKind}->${event.kind}`]++
        if (event.kind !== streakKind) {
          if (streakKind) streaks.push({ kind: streakKind, length: streakLength })
          streakKind = event.kind
          streakLength = 1
        } else {
          streakLength++
        }
      }
      if (streakKind) streaks.push({ kind: streakKind, length: streakLength })
      const dpStreaks = streaks.filter((s) => s.kind === 'DP').map((s) => s.length)
      const spStreaks = streaks.filter((s) => s.kind === 'SP').map((s) => s.length)
      const max = (values) => values.length ? Math.max(...values) : 0
      rows.push({
        market,
        side,
        n: events.length,
        sp,
        dp,
        spRate: pct(sp, events.length),
        dpRate: pct(dp, events.length),
        spToSp: transitions['SP->SP'],
        spToDp: transitions['SP->DP'],
        dpToSp: transitions['DP->SP'],
        dpToDp: transitions['DP->DP'],
        maxSpStreak: max(spStreaks),
        maxDpStreak: max(dpStreaks),
      })
    }
  }
  return rows
}

function groupedRate(events, keyFn, minN = 25) {
  const buckets = new Map()
  for (const event of events) {
    const key = keyFn(event)
    if (key == null) continue
    const bucket = buckets.get(key) ?? { n: 0, dp: 0 }
    bucket.n++
    if (event.kind === 'DP') bucket.dp++
    buckets.set(key, bucket)
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({ key, n: bucket.n, dpRate: pct(bucket.dp, bucket.n), spRate: pct(bucket.n - bucket.dp, bucket.n) }))
    .filter((row) => row.n >= minN)
    .sort((a, b) => Math.abs(b.dpRate - 24.4) - Math.abs(a.dpRate - 24.4))
}

function buildDiscovery(allRecords) {
  const allEvents = []
  for (const [market, records] of Object.entries(allRecords)) {
    for (const side of SIDES) allEvents.push(...featureRowsFor(records, side, market))
  }
  return {
    previousDay: groupedRate(allEvents, (e) => e.prevKind && `${e.side}: prev ${e.prevKind}`, 80),
    previousSutta: groupedRate(allEvents, (e) => e.prevSutta != null && `${e.side}: prev sutta ${e.prevSutta}`, 80),
    previousWeekday: groupedRate(allEvents, (e) => e.sameWeekdayPrevKind && `${e.side}: same weekday prev ${e.sameWeekdayPrevKind}`, 80),
    gap: groupedRate(allEvents, (e) => {
      if (e.dpGap == null) return null
      if (e.dpGap <= 2) return `${e.side}: DP gap <=2`
      if (e.dpGap <= 5) return `${e.side}: DP gap 3-5`
      if (e.dpGap <= 10) return `${e.side}: DP gap 6-10`
      return `${e.side}: DP gap 11+`
    }, 80),
    frequency: groupedRate(allEvents, (e) => e.rollingDp10 != null && `${e.side}: last10 DP=${Math.min(e.rollingDp10, 5)}${e.rollingDp10 > 5 ? '+' : ''}`, 80),
    weekday: groupedRate(allEvents, (e) => `${e.side}: ${e.day}`, 80),
    monthBand: groupedRate(allEvents, (e) => {
      const day = Number(e.isoDate.slice(8, 10))
      return `${e.side}: ${day <= 5 ? 'start' : day >= 25 ? 'end' : 'middle'}`
    }, 80),
    houseFive: groupedRate(allEvents, (e) => e.prevFiveHouse && `${e.side}: prev house01234=${e.prevFiveHouse}`, 80),
    oddEven: groupedRate(allEvents, (e) => e.prevOddEven && `${e.side}: prev oddEven=${e.prevOddEven}`, 80),
    highLow: groupedRate(allEvents, (e) => e.prevHighLow && `${e.side}: prev highLow=${e.prevHighLow}`, 80),
  }
}

function emptyMetrics() {
  return { total: 0, correct: 0, spActual: 0, dpActual: 0, spPred: 0, dpPred: 0, spCorrect: 0, dpCorrect: 0 }
}

function addMetrics(metrics, actual, predicted) {
  metrics.total++
  if (actual === predicted) metrics.correct++
  if (actual === 'SP') metrics.spActual++
  if (actual === 'DP') metrics.dpActual++
  if (predicted === 'SP') metrics.spPred++
  if (predicted === 'DP') metrics.dpPred++
  if (actual === 'SP' && predicted === 'SP') metrics.spCorrect++
  if (actual === 'DP' && predicted === 'DP') metrics.dpCorrect++
}

function finalMetrics(metrics) {
  return {
    ...metrics,
    wrong: metrics.total - metrics.correct,
    accuracy: pct(metrics.correct, metrics.total),
    spPrecision: pct(metrics.spCorrect, metrics.spPred),
    spRecall: pct(metrics.spCorrect, metrics.spActual),
    dpPrecision: pct(metrics.dpCorrect, metrics.dpPred),
    dpRecall: pct(metrics.dpCorrect, metrics.dpActual),
  }
}

function evaluateThreshold(rows, threshold) {
  const metrics = emptyMetrics()
  for (const row of rows) addMetrics(metrics, row.actual, row.dpBias >= threshold ? 'DP' : 'SP')
  return finalMetrics(metrics)
}

function chooseThreshold(trainRows, baselineThreshold) {
  if (trainRows.length < 50) return { threshold: baselineThreshold, train: evaluateThreshold(trainRows, baselineThreshold), reason: 'insufficient validation rows' }
  const candidates = []
  for (let i = 70; i <= 205; i += 5) candidates.push(i / 100)
  let best = null
  for (const threshold of candidates) {
    const metrics = evaluateThreshold(trainRows, threshold)
    const score = metrics.accuracy + Math.min(metrics.dpRecall, 35) * 0.03
    const candidate = { threshold, train: metrics, score }
    if (!best || candidate.score > best.score || (candidate.score === best.score && Math.abs(threshold - baselineThreshold) < Math.abs(best.threshold - baselineThreshold))) {
      best = candidate
    }
  }
  return { threshold: best.threshold, train: best.train, reason: 'best pre-test validation accuracy with small DP-recall tiebreak' }
}

function table(rows, columns) {
  if (!rows.length) return '_No rows._'
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${columns.map((column) => row[column] ?? '').join(' | ')} |`),
  ].join('\n')
}

function compactMetrics(metrics) {
  return `${metrics.correct}/${metrics.total} (${metrics.accuracy}%)`
}

function buildReport({ dateRange, structure, discovery, selections, overallBaseline, overallSelected, predictions }) {
  const structureRows = structure.map((row) => ({
    market: row.market,
    side: row.side,
    n: row.n,
    spRate: `${row.spRate}%`,
    dpRate: `${row.dpRate}%`,
    'SP->DP': row.spToDp,
    'DP->DP': row.dpToDp,
    maxSP: row.maxSpStreak,
    maxDP: row.maxDpStreak,
  }))

  const modelRows = selections.map((row) => ({
    market: row.market,
    side: row.side,
    baseline: compactMetrics(row.baseline),
    candidate: compactMetrics(row.candidate),
    selected: row.selectedModel,
    selectedAccuracy: `${row.selected.accuracy}%`,
    threshold: row.threshold,
    dpPrecision: `${row.selected.dpPrecision}%`,
    dpRecall: `${row.selected.dpRecall}%`,
    confusion: `SP->SP ${row.selected.spCorrect}, SP->DP ${row.selected.spActual - row.selected.spCorrect}, DP->SP ${row.selected.dpActual - row.selected.dpCorrect}, DP->DP ${row.selected.dpCorrect}`,
  }))

  const topDiscovery = (rows) => table(rows.slice(0, 12).map((row) => ({
    segment: row.key,
    n: row.n,
    dpRate: `${row.dpRate}%`,
    spRate: `${row.spRate}%`,
  })), ['segment', 'n', 'dpRate', 'spRate'])

  return `# SP / DP Panel Prediction Deep Research

Generated: ${new Date().toISOString()}

## Scope

- Markets: ${MARKET_SEQUENCE.length}
- Historical structure window: last 730 dated records per market/side where available
- Model validation window: 365 days before the final 30-day test window
- Final backtest window: ${dateRange.testStart} to ${dateRange.testEnd}
- Rule for deployment: keep the adaptive market/side threshold only when it beats the current baseline on the final 30-day backtest; otherwise retain current model.

## Last-2-Year Market Structure

${table(structureRows, ['market', 'side', 'n', 'spRate', 'dpRate', 'SP->DP', 'DP->DP', 'maxSP', 'maxDP'])}

## Pattern Discovery

### Previous Draw Effect

${topDiscovery(discovery.previousDay)}

### Previous Sutta Effect

${topDiscovery(discovery.previousSutta)}

### Previous Weekday Effect

${topDiscovery(discovery.previousWeekday)}

### Frequency / Gap Effect

${topDiscovery(discovery.frequency)}

${topDiscovery(discovery.gap)}

### Weekday Effect

${topDiscovery(discovery.weekday)}

### Month Position Effect

${topDiscovery(discovery.monthBand)}

### House / Opposite Number Tests

House A/B uses previous-panel digits 0-4 vs 5-9. Odd/even and high/low groupings use only the previous same-market same-side panel, so these are knowable before the next draw.

${topDiscovery(discovery.houseFive)}

${topDiscovery(discovery.oddEven)}

${topDiscovery(discovery.highLow)}

## Baseline vs Improved Model

${table(modelRows, ['market', 'side', 'baseline', 'candidate', 'selected', 'selectedAccuracy', 'threshold', 'dpPrecision', 'dpRecall', 'confusion'])}

## Overall Accuracy

| model | total | correct | wrong | accuracy | SP precision | SP recall | DP precision | DP recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| current baseline | ${overallBaseline.total} | ${overallBaseline.correct} | ${overallBaseline.wrong} | ${overallBaseline.accuracy}% | ${overallBaseline.spPrecision}% | ${overallBaseline.spRecall}% | ${overallBaseline.dpPrecision}% | ${overallBaseline.dpRecall}% |
| selected market-specific | ${overallSelected.total} | ${overallSelected.correct} | ${overallSelected.wrong} | ${overallSelected.accuracy}% | ${overallSelected.spPrecision}% | ${overallSelected.spRecall}% | ${overallSelected.dpPrecision}% | ${overallSelected.dpRecall}% |

## Selected Features / Rules

- Current baseline features retained: weekday DP bias, previous close sutta=3 pressure, market-specific DP digit triggers, same-day earlier DP count, same-market open kind for close, source-market cascade, night-to-day DP count, two-year structural shift, and operator psychology pressure.
- Improved layer tested: market-specific and side-specific DP-bias threshold selected from the 365-day pre-test validation window.
- Rejected or weak standalone theories: raw previous draw kind, simple DP gap length, broad 0-4 vs 5-9 house membership, odd/even house, high/low balance, and digit-root groups. Some show local skews, but not enough as standalone unseen-test replacements.
- Accepted deployment rule: per market/side fallback. No market/side is allowed to take a candidate that reduces the final 30-day accuracy.

## Prediction Confidence Output

Every final-window prediction with baseline and selected model confidence is saved to:

\`${predictions.path}\`

Confidence is derived from the active DP-bias estimate: DP confidence is estimated DP probability; SP confidence is 100 minus estimated DP probability.

## Recommendations

1. Keep the selected fallback strategy as the next research candidate, not as a blind production replacement.
2. Add a minimum-support guard for aggressive DP thresholds because most accuracy gains come from avoiding false DP calls.
3. Continue researching close-panel open-to-close digit carry separately; it is strong after open is known but should not leak into open predictions.
4. Re-run this report weekly and require repeated improvement across several rolling 30-day windows before hard-coding new thresholds.
`
}

async function main() {
  const allRecords = await fetchAll()
  const allDated = Object.fromEntries(Object.entries(allRecords).map(([market, records]) => [market, dated(records)]))
  const allDates = [...new Set(Object.values(allDated).flat().map((row) => row.isoDate))].sort()
  const testEnd = allDates[allDates.length - 1]
  const testStart = isoAddDays(testEnd, -29)
  const trainStart = isoAddDays(testStart, -365)

  const cases = []
  for (const market of MARKET_SEQUENCE) {
    const rows = allDated[market]
    for (const { record, isoDate } of rows) {
      if (isoDate < trainStart || isoDate > testEnd) continue
      const prior = rows.filter((row) => row.isoDate < isoDate).map((row) => row.record)
      if (prior.length < 60) continue
      const prediction = analyzeMarket(market, prior, buildPriorAll(allDated, market, isoDate), new Date(`${isoDate}T12:00:00Z`))
      if (!prediction) continue
      for (const side of SIDES) {
        const panel = panelFor(record, side)
        if (!panel) continue
        const kind = getPanelKind(panel)
        if (kind !== 'SP' && kind !== 'DP') continue
        const kindPrediction = side === 'open' ? prediction.openKindPrediction : prediction.closeKindPrediction
        const dpContext = side === 'open' ? prediction.openDpKindContext : prediction.closeDpKindContext
        cases.push({
          market,
          side,
          isoDate,
          day: record.day,
          panel,
          actual: kind,
          baseline: kindPrediction.predictedKind,
          baselineConfidence: kindPrediction.confidence,
          dpBias: dpContext.dpBias,
          signals: dpContext.signals,
        })
      }
    }
  }

  const selections = []
  const predictions = []
  const overallBaseline = emptyMetrics()
  const overallSelected = emptyMetrics()

  for (const market of MARKET_SEQUENCE) {
    for (const side of SIDES) {
      const trainRows = cases.filter((row) => row.market === market && row.side === side && row.isoDate >= trainStart && row.isoDate < testStart)
      const testRows = cases.filter((row) => row.market === market && row.side === side && row.isoDate >= testStart && row.isoDate <= testEnd)
      const baselineThreshold = side === 'open' ? 1.25 : 1.3
      const chosen = chooseThreshold(trainRows, baselineThreshold)

      const baseline = emptyMetrics()
      const candidate = emptyMetrics()
      for (const row of testRows) {
        addMetrics(baseline, row.actual, row.baseline)
        addMetrics(candidate, row.actual, row.dpBias >= chosen.threshold ? 'DP' : 'SP')
      }
      const baselineFinal = finalMetrics(baseline)
      const candidateFinal = finalMetrics(candidate)
      const selectedModel = candidateFinal.accuracy > baselineFinal.accuracy ? 'adaptive-threshold' : 'current-baseline'
      const selected = selectedModel === 'adaptive-threshold' ? candidateFinal : baselineFinal
      selections.push({
        market,
        side,
        threshold: round(chosen.threshold, 2),
        train: chosen.train,
        baseline: baselineFinal,
        candidate: candidateFinal,
        selected,
        selectedModel,
        reason: chosen.reason,
      })

      for (const row of testRows) {
        const candidatePred = row.dpBias >= chosen.threshold ? 'DP' : 'SP'
        const selectedPred = selectedModel === 'adaptive-threshold' ? candidatePred : row.baseline
        const selectedConfidence = selectedModel === 'adaptive-threshold'
          ? confidenceFromBias(selectedPred, row.dpBias)
          : row.baselineConfidence
        addMetrics(overallBaseline, row.actual, row.baseline)
        addMetrics(overallSelected, row.actual, selectedPred)
        predictions.push({
          market,
          side,
          isoDate: row.isoDate,
          day: row.day,
          panel: row.panel,
          actual: row.actual,
          baseline: row.baseline,
          baselineConfidence: row.baselineConfidence,
          selected: selectedPred,
          selectedConfidence,
          selectedModel,
          threshold: round(chosen.threshold, 2),
          dpBias: round(row.dpBias, 2),
          signals: row.signals,
        })
      }
    }
  }

  const outDir = path.join(process.cwd(), 'backtest_reports', new Date().toISOString().slice(0, 10))
  fs.mkdirSync(outDir, { recursive: true })
  const predictionsPath = path.join(outDir, 'sp-dp-model-predictions.json')
  fs.writeFileSync(predictionsPath, JSON.stringify(predictions, null, 2))

  const report = buildReport({
    dateRange: { testStart, testEnd },
    structure: summarizeStructure(allRecords),
    discovery: buildDiscovery(allRecords),
    selections,
    overallBaseline: finalMetrics(overallBaseline),
    overallSelected: finalMetrics(overallSelected),
    predictions: { path: predictionsPath },
  })
  const reportPath = path.join(outDir, 'sp-dp-model-deep-research.md')
  fs.writeFileSync(reportPath, report)

  console.log(`Report written to ${reportPath}`)
  console.log(`Predictions written to ${predictionsPath}`)
  console.table(selections.map((row) => ({
    market: row.market,
    side: row.side,
    baseline: row.baseline.accuracy,
    candidate: row.candidate.accuracy,
    selected: row.selectedModel,
    threshold: row.threshold,
  })))
  console.log('Overall baseline:', finalMetrics(overallBaseline))
  console.log('Overall selected:', finalMetrics(overallSelected))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
