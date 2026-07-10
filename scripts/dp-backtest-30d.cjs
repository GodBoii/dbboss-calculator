/**
 * 30-Day DP/SP Kind Prediction Backtest
 *
 * Runs the full predictor against the last 30 days of real results for all
 * 12 tracked markets and reports:
 *
 *   - Baseline DP rate (actual % of draws that were DP)
 *   - Kind accuracy   (how often we got SP/DP right)
 *   - DP precision    (when we said DP, how often was it actually DP?)
 *   - DP recall       (of all real DPs, how many did we predict?)
 *   - F1 score        (harmonic mean of precision and recall)
 *
 * Also shows the active DP signals fired per draw so you can sanity-check
 * the new context engine.
 */

const ts = require('typescript')
require.extensions['.ts'] = function (module, filename) {
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
const { runMarketBacktest, getRecordISODate } = require('../src/lib/backtest.ts')
const { analyzeMarket, getPanelKind } = require('../src/lib/predictor.ts')

const MARKET_URLS = {
  Sridevi:         'https://dpbossss.boston/panel-chart-record/sridevi.php',
  'Time Bazar':    'https://dpbossss.boston/panel-chart-record/time-bazar.php',
  'Madhur Day':    'https://dpbossss.boston/panel-chart-record/madhur-day.php',
  'Milan Day':     'https://dpbossss.boston/panel-chart-record/milan-day.php',
  'Rajdhani Day':  'https://dpbossss.boston/panel-chart-record/rajdhani-day.php',
  Kalyan:          'https://dpbossss.boston/panel-chart-record/kalyan.php',
  'Sridevi Night': 'https://dpbossss.boston/panel-chart-record/sridevi-night.php',
  'Kalyan Night':  'https://dpbossss.boston/panel-chart-record/kalyan-night.php',
  'Madhur Night':  'https://dpbossss.boston/panel-chart-record/madhur-night.php',
  'Milan Night':   'https://dpbossss.boston/panel-chart-record/milan-night.php',
  'Rajdhani Night':'https://dpbossss.boston/panel-chart-record/rajdhani-night.php',
  'Main Bazar':    'https://dpbossss.boston/panel-chart-record/main-bazar.php',
}

function pct(n, d) {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10
}
function f1(prec, rec) {
  return (prec + rec === 0) ? 0 : Math.round((2 * prec * rec) / (prec + rec) * 10) / 10
}

async function fetchAll() {
  const all = {}
  for (const [market, url] of Object.entries(MARKET_URLS)) {
    const request = {
      nextUrl: new URL(
        `http://local/api/scrape?url=${encodeURIComponent(url)}&market=${encodeURIComponent(market)}`
      ),
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

const DAY_OFFSETS = { Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3, Friday: 4, Saturday: 5, Sunday: 6 }
function dated(records) {
  return records
    .map((r) => ({ record: r, isoDate: getRecordISODate(r) }))
    .filter((x) => x.isoDate)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

async function main() {
  const DAYS = parseInt(process.argv[2] || '30', 10)
  console.log(`\n${'='.repeat(70)}`)
  console.log(`  DP / SP KIND PREDICTION BACKTEST  —  Last ${DAYS} days`)
  console.log(`${'='.repeat(70)}\n`)

  console.log(`Fetching historical panel data for all ${Object.keys(MARKET_URLS).length} markets…`)
  const allRecords = await fetchAll()
  console.log('Data fetched.\n')

  // Aggregate stats
  const totals = {
    open:  { n: 0, kindCorrect: 0, actualDp: 0, dpPredicted: 0, dpCorrect: 0 },
    close: { n: 0, kindCorrect: 0, actualDp: 0, dpPredicted: 0, dpCorrect: 0 },
    jodi:  { n: 0, kindCorrect: 0, actualDp: 0, dpPredicted: 0, dpCorrect: 0 },
  }

  const rows = []

  for (const [market, records] of Object.entries(allRecords)) {
    const report = runMarketBacktest(market, records, allRecords, { days: DAYS })
    if (!report) continue

    for (const pos of ['open', 'close', 'jodi']) {
      const b = report[pos]
      totals[pos].n           += b.n
      totals[pos].kindCorrect += b.kindCorrect
      totals[pos].actualDp    += b.actualDp
      totals[pos].dpPredicted += b.dpPredicted
      totals[pos].dpCorrect   += b.dpCorrect
    }

    rows.push({
      market,
      drawsTested: report.drawsTested,
      // open
      openN:           report.open.n,
      openKindAcc:     pct(report.open.kindCorrect, report.open.n),
      openActualDp:    report.open.actualDp,
      openDpPred:      report.open.dpPredicted,
      openDpCorrect:   report.open.dpCorrect,
      openDpPrec:      pct(report.open.dpCorrect, report.open.dpPredicted),
      openDpRecall:    pct(report.open.dpCorrect, report.open.actualDp),
      openDpF1:        f1(pct(report.open.dpCorrect, report.open.dpPredicted), pct(report.open.dpCorrect, report.open.actualDp)),
      // close
      closeN:          report.close.n,
      closeKindAcc:    pct(report.close.kindCorrect, report.close.n),
      closeActualDp:   report.close.actualDp,
      closeDpPred:     report.close.dpPredicted,
      closeDpCorrect:  report.close.dpCorrect,
      closeDpPrec:     pct(report.close.dpCorrect, report.close.dpPredicted),
      closeDpRecall:   pct(report.close.dpCorrect, report.close.actualDp),
      closeDpF1:       f1(pct(report.close.dpCorrect, report.close.dpPredicted), pct(report.close.dpCorrect, report.close.actualDp)),
    })
  }

  // Per-market table
  console.log('PER-MARKET RESULTS')
  console.log('-'.repeat(120))
  const header = [
    'Market'.padEnd(18),
    'Draws'.padStart(6),
    '── OPEN ──────────────────────────────────────',
    '── CLOSE ─────────────────────────────────────',
  ].join('  ')
  console.log(header)
  console.log([
    ' '.repeat(18),
    ' '.repeat(6),
    'KindAcc  ActDP  Pred  Corr  Prec   Recall  F1',
    'KindAcc  ActDP  Pred  Corr  Prec   Recall  F1',
  ].join('  '))
  console.log('-'.repeat(120))

  for (const r of rows) {
    const openCols = [
      `${r.openKindAcc}%`.padStart(7),
      String(r.openActualDp).padStart(6),
      String(r.openDpPred).padStart(5),
      String(r.openDpCorrect).padStart(5),
      `${r.openDpPrec}%`.padStart(6),
      `${r.openDpRecall}%`.padStart(7),
      `${r.openDpF1}`.padStart(5),
    ].join('  ')
    const closeCols = [
      `${r.closeKindAcc}%`.padStart(7),
      String(r.closeActualDp).padStart(6),
      String(r.closeDpPred).padStart(5),
      String(r.closeDpCorrect).padStart(5),
      `${r.closeDpPrec}%`.padStart(6),
      `${r.closeDpRecall}%`.padStart(7),
      `${r.closeDpF1}`.padStart(5),
    ].join('  ')
    console.log(`${r.market.padEnd(18)}  ${String(r.drawsTested).padStart(6)}  ${openCols}  ${closeCols}`)
  }

  // Global totals
  console.log('-'.repeat(120))
  for (const pos of ['open', 'close', 'jodi']) {
    const t = totals[pos]
    const kindAcc  = pct(t.kindCorrect, t.n)
    const dpPrec   = pct(t.dpCorrect, t.dpPredicted)
    const dpRecall = pct(t.dpCorrect, t.actualDp)
    const dpF1     = f1(dpPrec, dpRecall)
    console.log(
      `TOTAL ${pos.toUpperCase().padEnd(6)} — N=${t.n}  KindAcc=${kindAcc}%  ActualDP=${t.actualDp}`
      + `  DPpredicted=${t.dpPredicted}  DPcorrect=${t.dpCorrect}`
      + `  Prec=${dpPrec}%  Recall=${dpRecall}%  F1=${dpF1}`
    )
  }

  // --- Detailed draw-by-draw DP signal inspection for each market (last 10 draws) ---
  console.log(`\n${'='.repeat(70)}`)
  console.log('  DP CONTEXT SIGNALS — Last 5 draws per market (to verify signals)')
  console.log(`${'='.repeat(70)}\n`)

  for (const [market, records] of Object.entries(allRecords)) {
    const datedRecs = dated(records)
    if (datedRecs.length < 55) continue

    console.log(`── ${market} ──`)
    const last5 = datedRecs.slice(-5)

    for (const { record, isoDate } of last5) {
      const prior = datedRecs
        .filter((x) => x.isoDate < isoDate)
        .map((x) => x.record)
      if (prior.length < 50) continue

      const priorAll = {}
      for (const [m, recs] of Object.entries(allRecords)) {
        const dRecs = dated(recs)
        const cut = dRecs.findIndex((x) => x.isoDate >= isoDate)
        priorAll[m] = (cut === -1 ? dRecs : dRecs.slice(0, cut)).map((x) => x.record)
      }
      priorAll[market] = prior

      const pred = analyzeMarket(market, prior, priorAll, new Date(`${isoDate}T12:00:00Z`))
      if (!pred) continue

      const openActual = getPanelKind(record.openPanel || '')
      const closeActual = getPanelKind(record.closePanel || '')
      const openPred = pred.openKindPrediction.predictedKind
      const closePred = pred.closeKindPrediction.predictedKind
      const openOk = openActual === openPred ? '✓' : '✗'
      const closeOk = closeActual === closePred ? '✓' : '✗'

      console.log(
        `  ${isoDate} ${record.day.padEnd(9)}`
        + `  open: ${record.openPanel || '???'} (${openActual}) pred=${openPred} ${openOk}`
        + `  close: ${record.closePanel || '???'} (${closeActual}) pred=${closePred} ${closeOk}`
        + `  openBias=${pred.openDpKindContext.dpBias.toFixed(2)}`
        + `  closeBias=${pred.closeDpKindContext.dpBias.toFixed(2)}`
      )
      if (pred.openDpKindContext.signals.length > 0) {
        console.log(`           openSignals: ${pred.openDpKindContext.signals.join(' | ')}`)
      }
      if (pred.closeDpKindContext.signals.length > 0) {
        console.log(`           closeSignals: ${pred.closeDpKindContext.signals.join(' | ')}`)
      }
    }
    console.log()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
