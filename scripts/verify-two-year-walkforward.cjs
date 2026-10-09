const test = require('node:test')
const assert = require('node:assert/strict')
const { PANELS, NAMES, predictions, score, kind, selectWinners, pairedInterval } = require('./lib/two-year-walkforward.cjs')
const { scopedRows, toRecord, START, END } = require('./two-year-walkforward.cjs')
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const crypto = require('node:crypto')

const row = (isoDate, openPanel = '123', closePanel = '112') => ({ isoDate, day: 'Monday', openPanel, closePanel })

test('220 unique legal panels, with TP separate from DP', () => {
  assert.equal(PANELS.length, 220)
  assert.equal(new Set(PANELS).size, 220)
  assert.equal(kind('111'), 'TP')
  assert.equal(kind('112'), 'DP')
  assert.equal(kind('123'), 'SP')
})

test('cutoff excludes older, current-day, future and incomplete rows', () => {
  const raw = [row('2024-10-08'), row(START), row(END), row('2026-10-09'), row('2026-10-10'), row('2025-02-03', '***')].map((r) => toRecord('Sridevi', r))
  const result = scopedRows(raw, 'Sridevi')
  assert.deepEqual(result.rows.map((r) => r.isoDate), [START, END])
  assert.deepEqual(result.excluded, { outsideWindow: 3, incompleteOrInvalid: 1, duplicates: 0 })
})

test('conflicting duplicates fail rather than choosing a result', () => {
  assert.throws(() => scopedRows([toRecord('Sridevi', row(START)), toRecord('Sridevi', row(START, '124'))], 'Sridevi'), /Conflicting panels/)
})

test('only known Open changes live Close predictions; ordinary predictions stay identical', () => {
  const prior = Array.from({ length: 180 }, (_, i) => row('2025-01-01', i % 2 ? '123' : '112', i % 2 ? '456' : '111'))
  const a = predictions(prior, prior, 'Monday', '123')
  const b = predictions(prior, prior, 'Monday', '112')
  for (const name of NAMES) {
    assert.deepEqual(a[name].open, b[name].open)
    assert.deepEqual(a[name].close, b[name].close)
    assert.equal(a[name].open.panels.length, 10)
    assert.equal(a[name].open.suttas.length, 6)
    assert.equal(new Set(a[name].open.panels).size, 10)
    assert.ok(a[name].open.dpProbability >= 0 && a[name].open.dpProbability <= 1)
  }
  assert.notDeepEqual(a.frequency_all.closeLive, b.frequency_all.closeLive)
})

test('changing excluded future and old outcomes cannot change candidate predictions', () => {
  const raw = [row('2024-10-08'), row(START), row('2025-01-01'), row('2026-10-09')]
  const permitted = (values) => scopedRows(values.map((r) => toRecord('Sridevi', r)), 'Sridevi').rows.filter((r) => r.isoDate < '2025-02-01')
  const before = permitted(raw)
  const after = permitted(raw.map((r) => r.isoDate < START || r.isoDate > END ? { ...r, openPanel: '999', closePanel: '000' } : r))
  assert.deepEqual(predictions(before, before, 'Monday'), predictions(after, after, 'Monday'))
})

test('scoring requires exact panel, both absent digits, and TP never counts as DP', () => {
  const actual = row('2025-01-01', '111', '123')
  const prediction = { open: { panels: ['111'], suttas: [3], avoid: [1, 2], dpProbability: 0 }, close: { panels: ['124'], suttas: [6], avoid: [4, 5], dpProbability: 0 } }
  assert.deepEqual(score(actual, prediction), { openPanel: 1, openSutta: 1, openAvoid: 0, openDpBrier: 0, closePanel: 0, closeSutta: 1, closeAvoid: 1, closeDpBrier: 0, jodi: 1 })
})

test('later outcomes cannot choose the frozen winner', () => {
  const scores = (winner) => Object.fromEntries(NAMES.map((name) => [name, { openPanel: Number(name === winner), openDpBrier: Number(name !== winner) }]))
  const selection = { date: '2025-10-09', scores: scores('frequency_30') }
  const future = { date: '2026-04-09', scores: scores('frequency_90') }
  assert.deepEqual(selectWinners([selection, future], '2025-10-09', '2026-04-08'), { openPanel: 'frequency_30', openDpBrier: 'frequency_30' })
})

test('paired bootstrap resamples dates, is reproducible, and orients Brier improvement correctly', () => {
  const rows = ['2026-04-09', '2026-04-09', '2026-04-10'].map((date) => ({ date, scores: { production: { openDpBrier: 0.3 }, frequency_all: { openDpBrier: 0.2 } } }))
  const value = pairedInterval(rows, 'openDpBrier', 'frequency_all', 100)
  assert.equal(value.dates, 2)
  assert.ok(Math.abs(value.lift - 0.1) < 1e-12)
  assert.deepEqual(value, pairedInterval(rows, 'openDpBrier', 'frequency_all', 100))
})

const output = path.resolve(__dirname, '../research/two_year_walkforward_v1')
const ledgerPath = path.join(output, 'predictions.jsonl.gz')
test('saved replay obeys history bounds and reproduces all scores and selection', { skip: !fs.existsSync(ledgerPath) }, () => {
  const bytes = fs.readFileSync(ledgerPath)
  const ledger = zlib.gunzipSync(bytes).toString('utf8').trim().split('\n').map((line) => JSON.parse(line))
  const report = JSON.parse(fs.readFileSync(path.join(output, 'results.json'), 'utf8'))
  const snapshot = JSON.parse(fs.readFileSync(path.join(output, 'source-snapshot.json'), 'utf8'))
  const seen = new Set()
  for (const event of ledger) {
    const key = `${event.market}|${event.date}`
    assert.ok(!seen.has(key)); seen.add(key)
    assert.ok(event.date >= START && event.date <= END)
    const permitted = snapshot.records[event.market].filter((row) => row.isoDate < event.date)
    assert.equal(permitted.length, event.history.count)
    assert.equal(permitted[0].isoDate, event.history.first)
    assert.equal(permitted.at(-1).isoDate, event.history.last)
    assert.ok(event.history.first >= START && event.history.last < event.date && event.history.count >= 180)
    assert.equal(event.history.pooledCount, Object.values(snapshot.records).flatMap((rows) => rows.filter((row) => row.isoDate < event.date)).length)
    for (const [name, bundle] of Object.entries(event.predictions)) assert.deepEqual(score(event.actual, bundle), event.scores[name])
  }
  assert.equal(ledger.length, report.ledgerEvents)
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), report.ledgerSHA256)
  assert.deepEqual(selectWinners(ledger, report.scope.selectionStart, report.scope.selectionEnd), report.winners)
  const testRows = ledger.filter((row) => row.date >= report.scope.testStart)
  assert.equal(testRows.length, report.confirmation.n)
  for (const [task, name] of Object.entries(report.winners)) {
    assert.equal(testRows.reduce((sum, event) => sum + event.scores[name][task], 0) / testRows.length, report.confirmation.tasks[task].challenger)
  }
  for (const market of Object.keys(snapshot.records)) {
    const event = ledger.filter((row) => row.market === market).at(-1)
    const prior = snapshot.records[market].filter((row) => row.isoDate < event.date)
    const pooled = Object.values(snapshot.records).flatMap((rows) => rows.filter((row) => row.isoDate < event.date))
    const target = snapshot.records[market].find((row) => row.isoDate === event.date)
    const reproduced = predictions(prior, pooled, target.day, event.actual.openPanel)
    for (const name of NAMES) assert.deepEqual(reproduced[name], event.predictions[name])
  }
})
