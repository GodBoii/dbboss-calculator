const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const crypto = require('node:crypto')
const { PANELS, kind, sutta } = require('./lib/two-year-walkforward.cjs')
const { NAMES, portfolios, selectWinners } = require('./lib/panel-portfolio.cjs')
const { validateSnapshot, candidatePrediction, analyze, interval } = require('./panel-portfolio-research.cjs')

const input = { order: PANELS, suttas: Array.from({ length: 10 }, (_, digit) => digit), avoid: [0, 1] }

test('all alternatives keep ten distinct legal panels, with exact DP and Sutta constraints', () => {
  const result = portfolios(input)
  assert.equal(NAMES.length, 15)
  for (const name of NAMES) {
    assert.equal(result[name].length, 10)
    assert.equal(new Set(result[name]).size, 10)
    assert.ok(result[name].every((panel) => PANELS.includes(panel)))
  }
  for (const count of [1, 2, 3]) assert.equal(result[`dp_${count}`].filter((panel) => kind(panel) === 'DP').length, count)
  for (const count of [1, 2]) assert.equal(result[`sutta_6_dp_${count}`].filter((panel) => kind(panel) === 'DP').length, count)
  for (const name of ['sutta_6', 'sutta_6_dp_1', 'sutta_6_dp_2']) assert.ok(result[name].every((panel) => sutta(panel) < 6))
  assert.ok(result.sutta_8.every((panel) => sutta(panel) < 8))
  assert.ok(result.avoid_hard.every((panel) => !panel.includes('0') && !panel.includes('1')))
  assert.deepEqual(result.production, PANELS.slice(0, 10))
})

test('candidate order is deterministic, preserves rank ties, and never mutates input', () => {
  const before = structuredClone(input)
  assert.deepEqual(portfolios(input), portfolios(input))
  assert.deepEqual(input, before)
})

test('invalid rankings, incomplete panel orders and repeated avoid digits fail', () => {
  assert.throws(() => portfolios({ ...input, order: PANELS.slice(0, 10) }), /220 distinct/)
  assert.throws(() => portfolios({ ...input, order: [...PANELS.slice(1), '123'] }), /220 distinct/)
  assert.throws(() => portfolios({ ...input, suttas: Array(10).fill(1) }), /Sutta ranking/)
  assert.throws(() => portfolios({ ...input, suttas: [...input.suttas.slice(1), 10] }), /Sutta ranking/)
  assert.throws(() => portfolios({ ...input, avoid: [1, 1] }), /avoided digits/)
})

test('candidate selection ignores later outcomes and gives production priority on ties', () => {
  const hits = (winner) => Object.fromEntries(['open', 'closeLive'].map((side) => [side, Object.fromEntries(NAMES.map((name) => [name, Number(name === winner)]))]))
  const rows = [{ date: '2026-07-03', hits: hits('dp_1') }, { date: '2026-09-01', hits: hits('dp_2') }]
  assert.deepEqual(selectWinners(rows, '2026-07-03', '2026-08-31'), { open: 'dp_1', closeLive: 'dp_1' })
  rows[1].hits = hits('sutta_6')
  assert.deepEqual(selectWinners(rows, '2026-07-03', '2026-08-31'), { open: 'dp_1', closeLive: 'dp_1' })
  assert.deepEqual(selectWinners([{ date: '2026-07-03', hits: hits('absent') }], '2026-07-03', '2026-08-31'), { open: 'production', closeLive: 'production' })
})

test('bootstrap resamples whole dates, reports paired wins/losses and is deterministic', () => {
  const rows = [1, 1, -1].map((difference, index) => ({ date: index < 2 ? '2026-09-01' : '2026-09-02', hits: { open: { production: Number(difference < 0), dp_1: Number(difference > 0) } } }))
  const value = interval(rows, 'open', 'dp_1', 400)
  assert.equal(value.dates, 2)
  assert.equal(value.gained, 2)
  assert.equal(value.lost, 1)
  assert.equal(value.lift, 1 / 3)
  assert.ok(value.interval975[0] <= value.interval95[0] && value.interval975[1] >= value.interval95[1])
  assert.deepEqual(interval(rows, 'open', 'dp_1', 400), value)
})

const root = path.resolve(__dirname, '..')
const output = path.join(root, 'research/panel_portfolio_v1')
const source = JSON.parse(fs.readFileSync(path.join(root, 'research/two_year_walkforward_v1/source-snapshot.json'), 'utf8'))
const comparator = zlib.gunzipSync(fs.readFileSync(path.join(root, 'research/two_year_walkforward_v1/predictions.jsonl.gz'))).toString('utf8').trim().split('\n').map((line) => JSON.parse(line))
const bytes = fs.readFileSync(path.join(output, 'predictions.jsonl.gz'))
const ledger = zlib.gunzipSync(bytes).toString('utf8').trim().split('\n').map((line) => JSON.parse(line))
const results = JSON.parse(fs.readFileSync(path.join(output, 'results.json'), 'utf8'))

test('source rejects future/old rows, duplicate dates, invalid panels and invalid calendar days', () => {
  validateSnapshot(source)
  const row = source.records.Sridevi[0]
  for (const changed of [{ ...row, isoDate: '2024-10-08' }, { ...row, isoDate: '2026-10-09' }, { ...row, isoDate: '2025-02-30' }, { ...row, day: 'Monday' }, { ...row, closePanel: '***' }]) {
    assert.throws(() => validateSnapshot({ ...source, records: { Sridevi: [changed] } }))
  }
  assert.throws(() => validateSnapshot({ ...source, records: { Sridevi: [row, row] } }))
})

test('saved results reproduce scores, date boundaries, paired summaries and hashes', () => {
  const seen = new Set()
  const old = new Map(comparator.map((row) => [`${row.market}|${row.date}`, row]))
  for (const row of ledger) {
    const key = `${row.market}|${row.date}`
    assert.ok(!seen.has(key)); seen.add(key)
    const previous = old.get(key)
    assert.deepEqual(row.actual, previous.actual)
    const history = source.records[row.market].filter((event) => event.isoDate < row.date)
    assert.deepEqual(row.history, { first: history[0].isoDate, last: history.at(-1).isoDate, count: history.length })
    assert.ok(row.date >= '2026-07-03' && row.date <= '2026-10-08')
    assert.ok(row.history.first >= '2024-10-09' && row.history.last < row.date)
    for (const side of ['open', 'closeLive']) {
      assert.deepEqual(row.picks[side].production, previous.predictions.production[side].panels)
      for (const name of NAMES) {
        assert.equal(row.picks[side][name].length, 10)
        assert.equal(new Set(row.picks[side][name]).size, 10)
        assert.equal(row.hits[side][name], Number(row.picks[side][name].includes(row.actual[side === 'open' ? 'openPanel' : 'closePanel'])))
      }
    }
  }
  assert.equal(ledger.length, results.audit.events)
  const { audit, ...summary } = results
  assert.deepEqual(analyze(ledger), summary)
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), audit.ledgerSHA256)
  for (const [file, digest] of Object.entries(audit.files)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), digest)
  for (const [file, digest] of [['source-snapshot.json', audit.sourceSHA256], ['predictions.jsonl.gz', audit.comparatorSHA256]]) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'research/two_year_walkforward_v1', file))).digest('hex'), digest)
})

test('real runtime reproduces first and last predictions in each market and rejects leaked future history', () => {
  for (const market of Object.keys(source.records)) {
    const marketRows = ledger.filter((row) => row.market === market)
    for (const row of [marketRows[0], marketRows.at(-1)]) {
      const prior = source.records[market].filter((event) => event.isoDate < row.date)
      const target = source.records[market].find((event) => event.isoDate === row.date)
      const production = comparator.find((event) => event.market === market && event.date === row.date).predictions.production
      assert.deepEqual(candidatePrediction(market, prior, row.date, target.day, target.openPanel, production), row.picks)
      assert.throws(() => candidatePrediction(market, [...prior, target], row.date, target.day, target.openPanel, production), /boundary/)
    }
  }
})
