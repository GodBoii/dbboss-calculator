/* eslint-disable no-console, @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads')
require('../research/dp_panel_v3/ts-loader.cjs')
const { getRecordISODate } = require('../src/lib/db.ts')
const { analyzeMarket, computeJodiAnalysis, buildContextFromResult } = require('../src/lib/predictor.ts')
const { buildOpenSuttaSet, buildCloseSuttaSet } = require('../src/lib/sutta-model/production.ts')
const { buildAbsentDigitsPrediction } = require('../src/lib/absent-digits.ts')
const { MARKET_TIMINGS } = require('../src/lib/market-schedule.ts')
const { APP_VERSION, SUTTA_MODEL_VERSION } = require('../src/lib/app-version.ts')
const { PANELS, INDEX, NAMES, sutta, kind, predictions, score, selectWinners, pairedInterval } = require('./lib/two-year-walkforward.cjs')

const ROOT = path.resolve(__dirname, '..')
const OUTPUT = path.join(ROOT, 'research', 'two_year_walkforward_v1')
const START = '2024-10-09'
const END = '2026-10-08'
const SELECTION_START = '2025-10-09'
const SELECTION_END = '2026-04-08'
const TEST_START = '2026-04-09'
const MARKETS = Object.keys(MARKET_TIMINGS)
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const pct = (value) => `${(100 * value).toFixed(2)}%`
const table = (headers, rows) => [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n')
const chartDate = (iso) => iso.split('-').reverse().join('/')
function addDays(iso, count) { const date = new Date(`${iso}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10) }

function scopedRows(records, market) {
  if (!Array.isArray(records)) throw new Error(`${market}: missing source records`)
  const rows = new Map()
  const excluded = { outsideWindow: 0, incompleteOrInvalid: 0, duplicates: 0 }
  for (const record of records) {
    const isoDate = getRecordISODate(record)
    if (!isoDate) { excluded.incompleteOrInvalid++; continue }
    if (isoDate < START || isoDate > END) { excluded.outsideWindow++; continue }
    if (!INDEX.has(record.openPanel) || !INDEX.has(record.closePanel)) { excluded.incompleteOrInvalid++; continue }
    const previous = rows.get(isoDate)
    if (previous && (previous.openPanel !== record.openPanel || previous.closePanel !== record.closePanel)) throw new Error(`Conflicting panels: ${market}/${isoDate}`)
    if (previous) excluded.duplicates++
    rows.set(isoDate, { isoDate, day: DAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()], openPanel: record.openPanel, closePanel: record.closePanel })
  }
  return { rows: [...rows.values()].sort((a, b) => a.isoDate.localeCompare(b.isoDate)), excluded }
}

function toRecord(market, row) {
  const weekday = new Date(`${row.isoDate}T00:00:00Z`).getUTCDay()
  const monday = addDays(row.isoDate, -((weekday + 6) % 7))
  return {
    id: `${market}|${row.isoDate}`, market, dateRangeStart: chartDate(monday), dateRangeEnd: chartDate(addDays(monday, 6)), day: DAYS[weekday],
    openPanel: row.openPanel, closePanel: row.closePanel, openSutta: sutta(row.openPanel), closeSutta: sutta(row.closePanel),
    jodi: `${sutta(row.openPanel)}${sutta(row.closePanel)}`, savedAt: 0,
  }
}

async function fetchSource() {
  const { GET } = require('../src/app/api/scrape/route.ts')
  const settled = await Promise.allSettled(MARKETS.map(async (market) => {
    const slug = market.toLowerCase().replaceAll(' ', '-')
    const url = `https://dpboss.tax/panel-chart-record/${slug}.php`
    const response = await GET({ nextUrl: new URL(`http://local/api/scrape?url=${encodeURIComponent(url)}&market=${encodeURIComponent(market)}`) })
    const body = await response.json()
    if (!response.ok) throw new Error(`${market}: ${body.error}`)
    const { rows, excluded } = scopedRows(body.panels, market)
    if (rows.length < 360) throw new Error(`${market}: less than 360 permitted complete draws`)
    console.log(`Source ${market}: ${rows.length} complete draws; latest ${rows.at(-1).isoDate}`)
    return { market, rows, excluded, source: body.historySources }
  }))
  const failed = settled.filter((item) => item.status === 'rejected')
  if (failed.length) throw new AggregateError(failed.map((item) => item.reason), 'Source refresh failed; use --snapshot explicitly to replay a saved source')
  const values = settled.map((item) => item.value)
  return { start: START, end: END, fetchedAt: new Date().toISOString(), records: Object.fromEntries(values.map((item) => [item.market, item.rows])), audit: Object.fromEntries(values.map((item) => [item.market, { excluded: item.excluded, source: item.source }])) }
}

function validateSnapshot(snapshot) {
  if (snapshot.start !== START || snapshot.end !== END) throw new Error('Snapshot bounds differ from protocol')
  for (const market of MARKETS) {
    const rows = snapshot.records?.[market]
    if (!Array.isArray(rows) || rows.length < 360) throw new Error(`${market}: invalid snapshot coverage`)
    rows.forEach((row, i) => {
      if (row.isoDate < START || row.isoDate > END || (i > 0 && rows[i - 1].isoDate >= row.isoDate) || !INDEX.has(row.openPanel) || !INDEX.has(row.closePanel)) throw new Error(`${market}: invalid or out-of-scope snapshot row`)
    })
  }
}

function productionPrediction(market, prior, priorRecords, allRecords, target) {
  const date = new Date(`${target.isoDate}T06:30:00Z`)
  const result = analyzeMarket(market, priorRecords, allRecords, date, { knownOpenPanel: null })
  const absent = buildAbsentDigitsPrediction(market, prior, target.isoDate, target.day)
  if (!result || !absent) throw new Error(`No production prediction: ${market}/${target.isoDate}`)
  const openSuttas = buildOpenSuttaSet(result.openPicks, result.openSuttaDroughts, priorRecords, 6, market, date, allRecords).map((pick) => pick.sutta)
  const closeSuttas = buildCloseSuttaSet(result.closePicks, result.closeSuttaDroughts, priorRecords, 6, market, null, allRecords, date).map((pick) => pick.sutta)
  // This separate stage has seen today's Open, but never today's Close.
  const live = computeJodiAnalysis(sutta(target.openPanel), target.openPanel, priorRecords, buildContextFromResult(result), result.closeDpKindContext)
  const closeLiveSuttas = buildCloseSuttaSet(live.adjustedClosePicks, result.closeSuttaDroughts, priorRecords, 6, market, sutta(target.openPanel), allRecords, date).map((pick) => pick.sutta)
  return {
    open: { panels: result.openPanelPicks.map((pick) => pick.panel), suttas: openSuttas, avoid: absent.open.candidateAvoidDigits, dpProbability: result.openKindPrediction.estimatedDpRate / 100, dpCall: result.openKindPrediction.predictedKind === 'DP', avoidStatus: absent.open.status },
    close: { panels: result.closePanelPicks.map((pick) => pick.panel), suttas: closeSuttas, avoid: absent.close.candidateAvoidDigits, dpProbability: result.closeKindPrediction.estimatedDpRate / 100, dpCall: result.closeKindPrediction.predictedKind === 'DP', avoidStatus: absent.close.status },
    closeLive: { panels: live.adjustedClosePanelPicks.map((pick) => pick.panel), suttas: closeLiveSuttas },
  }
}

function replay(snapshot, markets = MARKETS) {
  const records = Object.fromEntries(MARKETS.map((market) => [market, snapshot.records[market].map((row) => toRecord(market, row))]))
  const ledger = []
  for (const market of markets) {
    const rows = snapshot.records[market]
    for (let i = 180; i < rows.length; i++) {
      const target = rows[i]
      const prior = rows.slice(0, i)
      const allRecords = Object.fromEntries(MARKETS.map((name) => [name, records[name].filter((row) => getRecordISODate(row) < target.isoDate)]))
      const pooled = MARKETS.flatMap((name) => snapshot.records[name].filter((row) => row.isoDate < target.isoDate))
      const candidates = predictions(prior, pooled, target.day, target.openPanel)
      const prediction = { production: productionPrediction(market, prior, records[market].slice(0, i), allRecords, target), ...candidates }
      for (const [name, bundle] of Object.entries(prediction)) {
        for (const side of ['open', 'close', 'closeLive']) {
          const pick = bundle[side]
          if (pick.panels.length !== 10 || new Set(pick.panels).size !== 10 || pick.suttas.length !== 6 || new Set(pick.suttas).size !== 6) throw new Error(`${name}: wrong prediction count`)
        }
      }
      ledger.push({ date: target.isoDate, market, history: { first: prior[0].isoDate, last: prior.at(-1).isoDate, count: prior.length, pooledCount: pooled.length }, actual: { openPanel: target.openPanel, closePanel: target.closePanel, openKind: kind(target.openPanel), closeKind: kind(target.closePanel) }, predictions: prediction, scores: Object.fromEntries(Object.entries(prediction).map(([name, bundle]) => [name, score(target, bundle)])) })
      if ((i - 180) % 100 === 0) console.log(`Replay ${market} ${target.isoDate}: ${ledger.length} market-days`)
    }
    console.log(`Completed ${market}: ${rows.length - 180} targets`)
  }
  return ledger
}

async function replayWorkers(snapshot) {
  const queue = [...MARKETS]
  const completed = new Map()
  async function runNext() {
    while (queue.length) {
      const market = queue.shift()
      const bytes = await new Promise((resolve, reject) => {
        const worker = new Worker(__filename, { workerData: { market } })
        worker.once('message', resolve)
        worker.once('error', reject)
        worker.once('exit', (code) => { if (code !== 0) reject(new Error(`${market}: worker exited ${code}`)) })
      })
      completed.set(market, zlib.gunzipSync(bytes).toString('utf8').trim().split('\n').map((line) => JSON.parse(line)))
    }
  }
  // Independent market replays share the same immutable source, with bounded
  // concurrency so production calculations do not block every other market.
  await Promise.all([runNext(), runNext(), runNext()])
  return MARKETS.flatMap((market) => completed.get(market))
}

function summary(rows, winners) {
  if (!rows.length) return { n: 0, tasks: {} }
  return { n: rows.length, tasks: Object.fromEntries(Object.entries(winners).map(([task, candidate]) => {
    const rate = (name) => rows.reduce((sum, row) => sum + row.scores[name][task], 0) / rows.length
    return [task, { candidate, production: rate('production'), challenger: rate(candidate), ...pairedInterval(rows, task, candidate), allCandidates: Object.fromEntries(NAMES.map((name) => [name, rate(name)])) }]
  })) }
}

function diagnostics(rows, winners) {
  return Object.fromEntries(['open', 'close'].map((side) => {
    const dpName = winners[`${side}DpBrier`]
    const dp = (name) => {
      const calls = rows.filter((row) => name === 'production' ? row.predictions[name][side].dpCall : row.predictions[name][side].dpProbability >= 0.5)
      const hits = calls.filter((row) => row.actual[`${side}Kind`] === 'DP').length
      const actualDp = rows.filter((row) => row.actual[`${side}Kind`] === 'DP').length
      return { calls: calls.length, hits, precision: calls.length ? hits / calls.length : null, recall: actualDp ? hits / actualDp : null, coverage: calls.length / rows.length }
    }
    const calibration = Object.fromEntries(['Panel', 'Sutta', 'Avoid'].map((task) => {
      const name = winners[`${side}${task}`]
      const field = `${task.toLowerCase()}Confidence`
      const bins = Array.from({ length: 10 }, () => ({ n: 0, probability: 0, hits: 0 }))
      for (const row of rows) {
        const probability = row.predictions[name][side][field]
        const bin = bins[Math.min(9, Math.floor(probability * 10))]
        bin.n++; bin.probability += probability; bin.hits += row.scores[name][`${side}${task}`]
      }
      return [task, { candidate: name, bins: bins.map((bin) => ({ n: bin.n, predicted: bin.n ? bin.probability / bin.n : null, observed: bin.n ? bin.hits / bin.n : null })) }]
    }))
    const errors = Object.fromEntries(['production', winners[`${side}Panel`]].map((name) => {
      const panelMisses = rows.filter((row) => !row.scores[name][`${side}Panel`])
      return [name, {
        panelMisses: panelMisses.length,
        panelMissDespiteSuttaHit: panelMisses.filter((row) => row.scores[name][`${side}Sutta`]).length,
        byActualKind: Object.fromEntries(['SP', 'DP', 'TP'].map((actualKind) => {
          const selected = rows.filter((row) => row.actual[`${side}Kind`] === actualKind)
          return [actualKind, { n: selected.length, hits: selected.reduce((sum, row) => sum + row.scores[name][`${side}Panel`], 0) }]
        })),
      }]
    }))
    return [side, { dp: { candidate: dpName, production: dp('production'), challenger: dp(dpName) }, calibration, errors }]
  }))
}

function modelSourceHash() {
  const files = ['src/lib/predictor.ts', 'src/lib/absent-digits.ts', 'src/lib/db.ts', 'src/lib/prediction-contract.ts', 'src/lib/market-schedule.ts', 'src/lib/app-version.ts']
  for (const directory of ['src/lib/predictor', 'src/lib/sutta-model']) {
    files.push(...fs.readdirSync(path.join(ROOT, directory)).filter((file) => file.endsWith('.ts')).map((file) => `${directory}/${file}`))
  }
  return hash(Buffer.concat(files.sort().flatMap((file) => [Buffer.from(file), fs.readFileSync(path.join(ROOT, file))])))
}

function analyze(ledger, snapshot) {
  const winners = selectWinners(ledger, SELECTION_START, SELECTION_END)
  const test = ledger.filter((row) => row.date >= TEST_START)
  const report = {
    generatedAt: new Date().toISOString(), scope: { start: START, end: END, warmupDraws: 180, selectionStart: SELECTION_START, selectionEnd: SELECTION_END, testStart: TEST_START },
    versions: { app: APP_VERSION, sutta: SUTTA_MODEL_VERSION }, snapshotSHA256: hash(fs.readFileSync(path.join(OUTPUT, 'source-snapshot.json'))),
    codeSHA256: hash(Buffer.concat(['scripts/two-year-walkforward.cjs', 'scripts/lib/two-year-walkforward.cjs'].map((file) => fs.readFileSync(path.join(ROOT, file))))), productionCodeSHA256: modelSourceHash(),
    ledgerSHA256: hash(fs.readFileSync(path.join(OUTPUT, 'predictions.jsonl.gz'))),
    coverage: Object.fromEntries(MARKETS.map((market) => { const rows = snapshot.records[market]; const targets = ledger.filter((row) => row.market === market); return [market, { sourceRows: rows.length, first: rows[0].isoDate, last: rows.at(-1).isoDate, firstTarget: targets[0]?.date, targets: targets.length }] })),
    winners, development: summary(ledger.filter((row) => row.date < SELECTION_START), winners), selection: summary(ledger.filter((row) => row.date >= SELECTION_START && row.date <= SELECTION_END), winners), confirmation: summary(test, winners),
    postPanelTraining: summary(test.filter((row) => row.date > '2026-07-02'), winners),
    recent: Object.fromEntries([30, 90, 365].map((days) => [days, summary(ledger.filter((row) => row.date >= addDays(END, -(days - 1))), winners)])),
    markets: Object.fromEntries(MARKETS.map((market) => [market, summary(test.filter((row) => row.market === market), winners)])),
    monthly: Object.fromEntries([...new Set(test.map((row) => row.date.slice(0, 7)))].sort().map((month) => [month, summary(test.filter((row) => row.date.startsWith(month)), winners)])),
    diagnostics: diagnostics(test, winners), ledgerEvents: ledger.length,
  }
  fs.writeFileSync(path.join(OUTPUT, 'results.json'), JSON.stringify(report, null, 2))
  const comparison = (section) => table(['Task', 'Frozen candidate', 'Production', 'Candidate', 'Lift / Brier reduction', '95% date interval'], Object.entries(section.tasks).map(([task, value]) => [task, value.candidate, task.endsWith('Brier') ? value.production.toFixed(4) : pct(value.production), task.endsWith('Brier') ? value.challenger.toFixed(4) : pct(value.challenger), task.endsWith('Brier') ? value.lift.toFixed(4) : `${(100 * value.lift).toFixed(2)} pp`, value.interval95.map((n) => task.endsWith('Brier') ? n.toFixed(4) : `${(100 * n).toFixed(2)} pp`).join(' to ')]))
  const lines = [
    '# Two-year walk-forward results', '', `Permitted outcomes: ${START} through ${END}. Generated ${report.generatedAt}. Saved ${ledger.length} market-day predictions for production and eight causal challengers.`, '',
    'No outcome before the fixed cutoff enters this study. Every ordinary prediction uses strictly earlier dates, including all pooled inputs. CloseLive additionally receives the target Open panel and never its Close. Initial 180 complete draws per market are warmup. All rankings use Top-6 Sutta, Top-10 panels and a 36-pair Cartesian Jodi grid.', '',
    `Selection: ${SELECTION_START} through ${SELECTION_END}. Confirmation: ${TEST_START} through ${END}. One candidate per task was chosen on selection only. The selection criterion for DP is Brier loss, not alert accuracy. TP is not counted as DP.`, '',
    'Production is the fixed current-code comparator, not a historical deployment reconstruction. Its rules and calibration were previously chosen from other data, and panel weights were fit through July 2, 2026. Only challenger training is guaranteed to use exclusively permitted, prior outcomes. Earlier research inspected overlapping dates. Confidence intervals here are retrospective and are not corrected for multiple task comparisons.', '',
    '## Source coverage', '', table(['Market', 'Complete draws', 'First', 'Latest', 'First scored target', 'Targets'], Object.entries(report.coverage).map(([market, c]) => [market, c.sourceRows, c.first, c.last, c.firstTarget, c.targets])), '',
    `Source hash: ${report.snapshotSHA256}. Missing or incomplete draws are excluded, not filled. Latest source date is shown per market; the end of the requested window does not imply complete source coverage.`, '',
    `## Confirmation, ${report.confirmation.n} market-days`, '', comparison(report.confirmation), '',
    `## After panel-weight training, ${report.postPanelTraining.n} market-days`, '', comparison(report.postPanelTraining), '',
  ]
  for (const days of [30, 90, 365]) lines.push(`## Last ${days} calendar days, ${report.recent[days].n} market-days`, '', comparison(report.recent[days]), '')
  lines.push('## Confirmation by market', '', table(['Market', 'N', 'Open panel production / candidate', 'Close panel production / candidate', 'Open Sutta production / candidate', 'Close Sutta production / candidate', 'Jodi production / candidate'], Object.entries(report.markets).map(([market, section]) => [market, section.n, ...['openPanel', 'closePanel', 'openSutta', 'closeSutta', 'jodi'].map((task) => `${pct(section.tasks[task].production)} / ${pct(section.tasks[task].challenger)}`)])), '',
    '## Panel errors by actual kind', '', table(['Side', 'Model', 'SP hits / draws', 'DP hits / draws', 'TP hits / draws', 'Panel misses despite Sutta hit'], Object.entries(report.diagnostics).flatMap(([side, values]) => Object.entries(values.errors).map(([name, errors]) => [side, name, ...['SP', 'DP', 'TP'].map((k) => `${errors.byActualKind[k].hits}/${errors.byActualKind[k].n}`), `${errors.panelMissDespiteSuttaHit}/${errors.panelMisses}`]))), '',
    '## Interpretation', '', 'A confidence interval above zero identifies a candidate worth further review, not an automatic deployment. Check month and market stability, source completeness, multiple comparisons, and the post-training panel comparison. Recent and annual windows overlap selection or confirmation and do not independently validate the winner. See results.json for all candidate scores, monthly comparisons, DP precision/coverage, and probability calibration bins.', '',
    '## Reproduce', '', '`node scripts/two-year-walkforward.cjs` refreshes validated sources and replays. `--snapshot` uses only the frozen source; `--analyze-only` recomputes summaries from predictions.jsonl.gz. `node --test scripts/verify-two-year-walkforward.cjs` checks date exclusion, causal invariants, selection isolation and scoring.', '',
    'The gzip ledger contains one JSON record per market-day with actuals, history boundaries, every model prediction and every scored task. Decompress with Node zlib.gunzipSync to inspect or analyze. Production rankings remain unchanged.', '')
  fs.writeFileSync(path.join(OUTPUT, 'REPORT.md'), lines.join('\n'))
  console.log(`Saved report and ${ledger.length} prediction records in ${OUTPUT}`)
  console.log(JSON.stringify(report.confirmation, null, 2))
}

async function main() {
  const sourcePath = path.join(OUTPUT, 'source-snapshot.json')
  let snapshot
  if (process.argv.includes('--snapshot') || process.argv.includes('--analyze-only')) snapshot = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
  else { snapshot = await fetchSource(); fs.writeFileSync(sourcePath, JSON.stringify(snapshot, null, 2)) }
  validateSnapshot(snapshot)
  const ledgerPath = path.join(OUTPUT, 'predictions.jsonl.gz')
  const ledger = process.argv.includes('--analyze-only') ? zlib.gunzipSync(fs.readFileSync(ledgerPath)).toString('utf8').trim().split('\n').map((line) => JSON.parse(line)) : await replayWorkers(snapshot)
  if (!process.argv.includes('--analyze-only')) fs.writeFileSync(ledgerPath, zlib.gzipSync(ledger.map((row) => JSON.stringify(row)).join('\n') + '\n'))
  analyze(ledger, snapshot)
}
if (!isMainThread) {
  const snapshot = JSON.parse(fs.readFileSync(path.join(OUTPUT, 'source-snapshot.json'), 'utf8'))
  validateSnapshot(snapshot)
  const ledger = replay(snapshot, [workerData.market])
  parentPort.postMessage(zlib.gzipSync(ledger.map((row) => JSON.stringify(row)).join('\n') + '\n'))
} else if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1 })
module.exports = { scopedRows, validateSnapshot, toRecord, START, END }
