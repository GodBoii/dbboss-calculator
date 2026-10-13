const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const zlib = require('node:zlib')
require('../research/dp_panel_v3/ts-loader.cjs')
const { rankPanelsTop10Model } = require('../src/lib/predictor/panel-top10-model.ts')
const { buildV2OpenRanking, buildV2CloseRanking } = require('../src/lib/sutta-model/v2-recency.ts')
const { PANELS, kind } = require('./lib/two-year-walkforward.cjs')
const { NAMES, portfolios, selectWinners } = require('./lib/panel-portfolio.cjs')
const { toRecord } = require('./two-year-walkforward.cjs')

const ROOT = path.resolve(__dirname, '..')
const OUTPUT = path.join(ROOT, 'research/panel_portfolio_v1')
const SOURCE = path.join(ROOT, 'research/two_year_walkforward_v1/source-snapshot.json')
const COMPARATOR = path.join(ROOT, 'research/two_year_walkforward_v1/predictions.jsonl.gz')
const START = '2024-10-09'
const END = '2026-10-08'
const SELECT_START = '2026-07-03'
const SELECT_END = '2026-08-31'
const TEST_START = '2026-09-01'
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')

function validateSnapshot(snapshot) {
  if (snapshot.start !== START || snapshot.end !== END || !snapshot.records || typeof snapshot.records !== 'object') throw new Error('Wrong source scope')
  for (const [market, rows] of Object.entries(snapshot.records)) {
    if (!Array.isArray(rows) || !rows.length) throw new Error(`${market}: missing rows`)
    let previous = ''
    for (const row of rows) {
      if (typeof row.isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.isoDate)) throw new Error(`${market}: invalid date`)
      const date = new Date(`${row.isoDate}T00:00:00Z`)
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== row.isoDate || DAYS[date.getUTCDay()] !== row.day) throw new Error(`${market}: invalid calendar date/day`)
      if (row.isoDate < START || row.isoDate > END || row.isoDate <= previous) throw new Error(`${market}: unordered, duplicate or out-of-scope date`)
      if (!PANELS.includes(row.openPanel) || !PANELS.includes(row.closePanel)) throw new Error(`${market}: invalid panel`)
      previous = row.isoDate
    }
  }
}

function candidatePrediction(market, prior, targetDate, day, knownOpen, production) {
  if (prior.some((row) => row.isoDate < START || row.isoDate >= targetDate)) throw new Error('History crosses prediction boundary')
  const records = prior.map((row) => toRecord(market, row))
  const date = new Date(`${targetDate}T06:30:00Z`)
  const openRanking = buildV2OpenRanking(records, market, date)
  const closeRanking = buildV2CloseRanking(records, market, date)
  if (!openRanking || !closeRanking) throw new Error('Insufficient Sutta history')
  const result = {}
  for (const side of ['open', 'closeLive']) {
    const order = rankPanelsTop10Model(records, side === 'open' ? 'open' : 'close', day, side === 'open' ? null : knownOpen)
    if (!order) throw new Error('Insufficient panel history')
    const ranking = side === 'open' ? openRanking : closeRanking
    if (JSON.stringify(order.slice(0, 10)) !== JSON.stringify(production[side].panels)) throw new Error(`${market}/${targetDate}/${side}: production panel parity failed`)
    if (JSON.stringify(ranking.slice(0, 6).map((pick) => pick.sutta)) !== JSON.stringify(production[side].suttas)) throw new Error(`${market}/${targetDate}/${side}: production Sutta parity failed`)
    result[side] = portfolios({ order, suttas: ranking.map((pick) => pick.sutta), avoid: production[side === 'open' ? 'open' : 'close'].avoid })
  }
  return result
}

function replay(snapshot, comparator) {
  validateSnapshot(snapshot)
  const ledger = []
  const keys = new Set()
  for (const row of comparator) {
    if (row.date < SELECT_START || row.date > END) continue
    const key = `${row.market}|${row.date}`
    if (keys.has(key)) throw new Error(`Duplicate comparator target: ${key}`)
    keys.add(key)
    const history = snapshot.records[row.market]
    if (!history) throw new Error(`Missing source market: ${row.market}`)
    const target = history.find((event) => event.isoDate === row.date)
    if (!target || target.openPanel !== row.actual.openPanel || target.closePanel !== row.actual.closePanel) throw new Error(`Comparator outcome mismatch: ${key}`)
    const prior = history.filter((event) => event.isoDate < row.date)
    const picks = candidatePrediction(row.market, prior, row.date, target.day, target.openPanel, row.predictions.production)
    const hits = Object.fromEntries(['open', 'closeLive'].map((side) => [side,
      Object.fromEntries(NAMES.map((name) => [name, Number(picks[side][name].includes(row.actual[side === 'open' ? 'openPanel' : 'closePanel']))])),
    ]))
    ledger.push({ date: row.date, market: row.market, history: { first: prior[0].isoDate, last: prior.at(-1).isoDate, count: prior.length }, actual: row.actual, picks, hits })
  }
  const expected = Object.entries(snapshot.records).flatMap(([market, rows]) => rows.slice(180).filter((row) => row.isoDate >= SELECT_START).map((row) => `${market}|${row.isoDate}`))
  if (expected.length !== keys.size || expected.some((key) => !keys.has(key))) throw new Error('Comparator targets do not cover source targets')
  return ledger.sort((a, b) => a.date.localeCompare(b.date) || a.market.localeCompare(b.market))
}

function interval(rows, side, candidate, iterations = 6000) {
  const groups = new Map()
  let gained = 0, lost = 0
  for (const row of rows) {
    const difference = row.hits[side][candidate] - row.hits[side].production
    if (difference > 0) gained++
    if (difference < 0) lost++
    const day = groups.get(row.date) ?? { n: 0, difference: 0 }
    day.n++
    day.difference += difference
    groups.set(row.date, day)
  }
  if (!groups.size) return { gained, lost, dates: 0, lift: null, interval95: null, interval975: null }
  const days = [...groups.values()]
  let seed = 1729
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const samples = Array.from({ length: iterations }, () => {
    let n = 0, difference = 0
    for (let i = 0; i < days.length; i++) {
      const day = days[Math.floor(random() * days.length)]
      n += day.n
      difference += day.difference
    }
    return difference / n
  }).sort((a, b) => a - b)
  const bounds = (alpha) => [samples[Math.floor(iterations * alpha / 2)], samples[Math.min(iterations - 1, Math.floor(iterations * (1 - alpha / 2)))]]
  return { gained, lost, dates: days.length, lift: (gained - lost) / rows.length, interval95: bounds(0.05), interval975: bounds(0.025) }
}

function summary(rows, winners) {
  return Object.fromEntries(['open', 'closeLive'].map((side) => {
    const candidates = Object.fromEntries(NAMES.map((name) => [name, {
      hits: rows.reduce((total, row) => total + row.hits[side][name], 0), n: rows.length,
      rate: rows.length ? rows.reduce((total, row) => total + row.hits[side][name], 0) / rows.length : null,
    }]))
    const actualKey = side === 'open' ? 'openPanel' : 'closePanel'
    const byKind = Object.fromEntries(['SP', 'DP', 'TP'].map((panelKind) => {
      const subset = rows.filter((row) => kind(row.actual[actualKey]) === panelKind)
      return [panelKind, { n: subset.length, productionHits: subset.reduce((n, row) => n + row.hits[side].production, 0), candidateHits: subset.reduce((n, row) => n + row.hits[side][winners[side]], 0) }]
    }))
    return [side, { winner: winners[side], candidates, paired: interval(rows, side, winners[side]), byKind }]
  }))
}

function analyze(ledger) {
  const winners = selectWinners(ledger, SELECT_START, SELECT_END)
  const later = ledger.filter((row) => row.date >= TEST_START)
  return {
    scope: { historyStart: START, end: END, selectionStart: SELECT_START, selectionEnd: SELECT_END, laterStart: TEST_START, panelWeightFitEnd: '2026-07-02', retrospective: true },
    winners, selection: summary(ledger.filter((row) => row.date <= SELECT_END), winners), later: summary(later, winners),
    exploratory: { postHoc: true, openDiversification: interval(later, 'open', 'overlap_1'), closeAvoidPenalty: interval(later, 'closeLive', 'avoid_penalty_10') },
    recent30: summary(later.filter((row) => row.date >= '2026-09-09'), winners),
    perMarket: Object.fromEntries([...new Set(later.map((row) => row.market))].sort().map((market) => [market, summary(later.filter((row) => row.market === market), winners)])),
  }
}

function report(results) {
  const pct = (value) => value === null ? 'N/A' : `${(100 * value).toFixed(2)}%`
  const points = (value) => `${(100 * value).toFixed(2)} pp`
  const lines = ['# Ten-panel portfolio experiment', '',
    'Exploratory retrospective test using the frozen two-year source. Panel weights were fitted through July 2. Selection is July 3 through August 31; later evaluation is September 1 through October 8. Earlier studies inspected overlapping dates, so the later block is not an untouched holdout. Every prediction returns ten distinct legal panels. Production panel and Sutta parity passed on every scored event.', '',
    `Source SHA-256: \`${results.audit.sourceSHA256}\`. Comparator SHA-256: \`${results.audit.comparatorSHA256}\`. Saved ${results.audit.events} market-days.`, '',
    'Close after Open receives only the target Open panel. Avoid-pair candidates use the ordinary prior-only Close avoid list, including no-safe-call rows. They are experiments, not approved avoidance calls.', '',
    '| Side | Frozen choice | Selection production | Selection choice | Later production | Later choice | Gained / lost | 97.5% paired interval |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |']
  for (const side of ['open', 'closeLive']) {
    const selection = results.selection[side], later = results.later[side], winner = results.winners[side]
    const rate = (value) => `${pct(value.rate)} (${value.hits}/${value.n})`
    lines.push(`| ${side} | ${winner} | ${rate(selection.candidates.production)} | ${rate(selection.candidates[winner])} | ${rate(later.candidates.production)} | ${rate(later.candidates[winner])} | ${later.paired.gained} / ${later.paired.lost} | ${later.paired.interval975.map(points).join(' to ')} |`)
  }
  lines.push('', 'The two 97.5% date-clustered bootstrap intervals use Bonferroni family coverage for two frozen task choices. They do not correct for reuse of previously inspected data or establish future accuracy. Production wins selection ties.', '', '| Candidate | Open selection | Open later | Live Close selection | Live Close later |', '| --- | ---: | ---: | ---: | ---: |')
  for (const name of NAMES) lines.push(`| ${name} | ${pct(results.selection.open.candidates[name].rate)} | ${pct(results.later.open.candidates[name].rate)} | ${pct(results.selection.closeLive.candidates[name].rate)} | ${pct(results.later.closeLive.candidates[name].rate)} |`)
  lines.push('', '| Side | Actual kind | Later outcomes | Production hits | Frozen-choice hits |', '| --- | --- | ---: | ---: | ---: |')
  for (const side of ['open', 'closeLive']) for (const [panelKind, value] of Object.entries(results.later[side].byKind)) lines.push(`| ${side} | ${panelKind} | ${value.n} | ${value.productionHits} | ${value.candidateHits} |`)
  lines.push('', '| Market | Outcomes | Open production / choice | Live Close production / choice |', '| --- | ---: | ---: | ---: |')
  for (const [market, value] of Object.entries(results.perMarket)) lines.push(`| ${market} | ${value.open.candidates.production.n} | ${pct(value.open.candidates.production.rate)} / ${pct(value.open.candidates[results.winners.open].rate)} | ${pct(value.closeLive.candidates.production.rate)} / ${pct(value.closeLive.candidates[results.winners.closeLive].rate)} |`)
  const decisions = ['open', 'closeLive'].map((side) => `${side}: ${results.winners[side]} ${results.later[side].paired.lift > 0 ? 'gained' : 'lost'} ${Math.abs(results.later[side].paired.gained - results.later[side].paired.lost)} net hits on the later block`)
  lines.push('', `Frozen selection result: ${decisions.join('; ')}.`, '',
    'Two ideas noticed after looking at the later results are worth future testing. Open diversification shares at most one distinct digit between greedy picks, then fills from the original order. It hit 29/381 versus production 26/381, with a descriptive 95% gain interval of ' + results.exploratory.openDiversification.interval95.map(points).join(' to ') + '. The soft Close avoided-digit penalty hit 29/381 versus 23/381, with an interval of ' + results.exploratory.closeAvoidPenalty.interval95.map(points).join(' to ') + '. Both intervals include a loss. These are post-hoc leads, not substitute winners or evidence for promotion.', '',
    'Reserving DP slots did produce some DP hits, but it displaced SP hits. None of the pure DP allocations beat production overall on the later block. The zero-DP-hit blind spot alone does not justify reserving slots.', '',
    'Production is unchanged. Any apparent advantage needs a frozen prospective comparison before promotion. Source coverage is inherited from the saved snapshot; this report makes no claim about October 9 onward or missing market results.', '', 'Run `node scripts/panel-portfolio-research.cjs`. Verify with `node --test scripts/verify-panel-portfolio.cjs`.', '')
  return lines.join('\n')
}

function main() {
  const snapshot = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))
  const comparator = zlib.gunzipSync(fs.readFileSync(COMPARATOR)).toString('utf8').trim().split('\n').map((line) => JSON.parse(line))
  const ledger = replay(snapshot, comparator)
  const bytes = zlib.gzipSync(ledger.map((row) => JSON.stringify(row)).join('\n') + '\n')
  const results = analyze(ledger)
  const files = ['scripts/panel-portfolio-research.cjs', 'scripts/lib/panel-portfolio.cjs', 'scripts/lib/two-year-walkforward.cjs', 'scripts/two-year-walkforward.cjs', 'research/panel_portfolio_v1/PROTOCOL.md', 'research/dp_panel_v3/ts-loader.cjs', 'src/lib/db.ts', 'src/lib/prediction-contract.ts', 'src/lib/predictor/panel-top10-model.ts', 'src/lib/predictor/panel-utils.ts', 'src/lib/sutta-model/v2-recency.ts']
  results.audit = { generatedAt: new Date().toISOString(), events: ledger.length, sourceSHA256: hash(fs.readFileSync(SOURCE)), comparatorSHA256: hash(fs.readFileSync(COMPARATOR)), ledgerSHA256: hash(bytes), files: Object.fromEntries(files.map((file) => [file, hash(fs.readFileSync(path.join(ROOT, file)))])) }
  fs.mkdirSync(OUTPUT, { recursive: true })
  fs.writeFileSync(path.join(OUTPUT, 'predictions.jsonl.gz'), bytes)
  fs.writeFileSync(path.join(OUTPUT, 'results.json'), JSON.stringify(results, null, 2) + '\n')
  fs.writeFileSync(path.join(OUTPUT, 'REPORT.md'), report(results))
  console.log(JSON.stringify({ events: ledger.length, winners: results.winners, later: Object.fromEntries(['open', 'closeLive'].map((side) => [side, results.later[side].paired])) }, null, 2))
}

if (require.main === module) main()
module.exports = { validateSnapshot, candidatePrediction, replay, analyze, interval }
