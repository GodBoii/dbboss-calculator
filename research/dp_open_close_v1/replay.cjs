// Exact production kind path, without unrelated panel-ranking work.
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
require('../dp_panel_v3/ts-loader.cjs')
const { flattenRecords } = require('../../src/lib/predictor/data.ts')
const { computeSuttaDroughts } = require('../../src/lib/predictor/sutta-signals.ts')
const { computeDpKindContext } = require('../../src/lib/predictor/dp-kind-context.ts')
const { buildOperatorContext, mergeOperatorIntoDpContext } = require('../../src/lib/predictor/operator-psychology.ts')
const { buildKindPrediction } = require('../../src/lib/predictor/scoring.ts')
const { applyPrecisionKindOverride } = require('../../src/lib/predictor/precision-kind-overrides.ts')
const { historicalCutoffISO } = require('../../src/lib/prediction-contract.ts')
const { getRecordISODate } = require('../../src/lib/db.ts')
const { getVerifiedDpCalls } = require('../../src/lib/verified-dp-call.ts')
const { MARKET_TIMINGS } = require('../../src/lib/market-schedule.ts')

const HERE = __dirname
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const isDp = (panel) => /^\d{3}$/.test(panel) && new Set(panel).size === 2
const sutta = (panel) => panel ? [...panel].reduce((sum, digit) => sum + Number(digit), 0) % 10 : -1
function addDays(iso, offset) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}
function toRecord(row) {
  const weekday = new Date(`${row.date}T00:00:00Z`).getUTCDay()
  const monday = addDays(row.date, -((weekday + 6) % 7))
  return {
    id: `${row.market}|${row.date}`, market: row.market,
    dateRangeStart: monday.split('-').reverse().join('/'),
    dateRangeEnd: addDays(monday, 6).split('-').reverse().join('/'), day: DAYS[weekday],
    openPanel: row.open, closePanel: row.close, openSutta: sutta(row.open), closeSutta: sutta(row.close),
    jodi: row.open && row.close ? `${sutta(row.open)}${sutta(row.close)}` : '', savedAt: 0,
  }
}
function partialOpen(row) {
  return { ...toRecord(row), closePanel: '', closeSutta: -1, jodi: '' }
}
function kindPrediction(market, records, allRecords, date) {
  const entries = flattenRecords(records)
  const openEntries = entries.filter((entry) => entry.type === 'open')
  const closeEntries = entries.filter((entry) => entry.type === 'close')
  const operator = buildOperatorContext({ marketName: market, entries: closeEntries,
    suttaDroughts: computeSuttaDroughts(closeEntries), position: 'close', analysisDate: date })
  const context = mergeOperatorIntoDpContext(computeDpKindContext(
    market, openEntries, closeEntries, allRecords, DAYS[date.getDay()], true, date,
  ), operator)
  return applyPrecisionKindOverride({ marketName: market, side: 'close', records,
    allMarketsRecords: allRecords, analysisDate: date,
    basePrediction: buildKindPrediction([], context, 1.3), dpContext: context })
}
function loadRows() {
  const source = fs.readFileSync(path.join(HERE, 'source.csv.gz'))
  const sourceAudit = JSON.parse(fs.readFileSync(path.join(HERE, 'source-audit.json'), 'utf8'))
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), sourceAudit.sourceHash)
  const lines = zlib.gunzipSync(source).toString('utf8').trim().split('\n')
  assert.equal(lines.shift(), 'date,market,open,close')
  const keys = new Set()
  return lines.map((line) => {
    const [date, market, open, close, extra] = line.split(',')
    assert.equal(extra, undefined)
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(date >= '2016-01-01' && date <= '2026-10-08')
    assert.ok(MARKET_TIMINGS[market])
    assert.ok((!open || /^\d{3}$/.test(open)) && (!close || /^\d{3}$/.test(close)))
    const key = `${market}|${date}`
    assert.ok(!keys.has(key), `Duplicate source ${key}`)
    keys.add(key)
    return { date, market, open, close, record: toRecord({ date, market, open, close }) }
  })
}
function main() {
  const rows = loadRows()
  const byMarket = Object.fromEntries(Object.keys(MARKET_TIMINGS).map((market) => [market,
    rows.filter((row) => row.market === market).sort((a, b) => a.date.localeCompare(b.date))]))
  const dates = [...new Set(rows.map((row) => row.date))].filter((date) => date >= '2023-07-01' &&
    ![0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())).sort()
  const parityDates = new Set(['2023-07-03', '2025-12-31', '2026-10-08'])
  const ledger = []
  let parityChecks = 0
  const { analyzeMarket } = require('../../src/lib/predictor.ts')
  for (const date of dates) {
    const cutoff = historicalCutoffISO(date)
    const prior = Object.fromEntries(Object.entries(byMarket).map(([market, history]) => [market,
      history.filter((row) => row.date >= cutoff && row.date < date).map((row) => row.record)]))
    for (const [market, history] of Object.entries(byMarket)) {
      const row = history.find((item) => item.date === date)
      if (!row?.close || prior[market].length < 180) continue
      const own = row.open ? [...prior[market], partialOpen(row)] : prior[market]
      const all = { ...prior, [market]: own }
      const analysisDate = new Date(`${date}T06:30:00Z`)
      const prediction = kindPrediction(market, own, all, analysisDate)
      assert.equal(getVerifiedDpCalls().close, null)
      assert.ok(own.every((record) => record !== row.record))
      if (parityDates.has(date)) {
        const full = analyzeMarket(market, own, all, analysisDate)
        assert.ok(full)
        for (const key of ['estimatedDpRate', 'predictedKind', 'confidence', 'dpBias']) {
          assert.equal(prediction[key], full.closeKindPrediction[key], `${market}/${date}: ${key}`)
        }
        parityChecks++
      }
      ledger.push({ date, market, open: row.open, close: row.close, actualDp: isDp(row.close),
        raw: prediction.estimatedDpRate / 100, legacyKindCall: prediction.predictedKind === 'DP',
        verifiedCall: false, historyStart: cutoff, historyLast: getRecordISODate(prior[market].at(-1)) })
    }
    if (date.endsWith('-01')) console.log(`Production kind replay ${date}: ${ledger.length} closes`)
  }
  assert.ok(parityChecks >= 24, 'Insufficient parity samples')
  const output = ledger.map((row) => JSON.stringify(row)).join('\n') + '\n'
  fs.writeFileSync(path.join(HERE, 'production.jsonl.gz'), zlib.gzipSync(output, { mtime: 0 }))
  const codeFiles = ['db.ts', 'prediction-contract.ts', 'verified-dp-call.ts', 'market-schedule.ts',
    ...fs.readdirSync(path.join(HERE, '../../src/lib/predictor')).filter((file) => file.endsWith('.ts')).map((file) => `predictor/${file}`)]
  const hashes = Object.fromEntries(codeFiles.map((file) => [file, crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(HERE, '../../src/lib', file))).digest('hex')]))
  fs.writeFileSync(path.join(HERE, 'replay-audit.json'), JSON.stringify({ outcomes: ledger.length,
    parityChecks, productionCodeHashes: hashes, verifiedGate: 'always abstains' }, null, 2) + '\n')
  console.log(`Saved ${ledger.length} outcomes; ${parityChecks} full-analyze parity checks passed`)
}
if (require.main === module) main()
module.exports = { kindPrediction, partialOpen, toRecord, loadRows }
