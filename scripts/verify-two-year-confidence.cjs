const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const { createCalibration, calibrate, observe } = require('./lib/walkforward-confidence.cjs')

test('calibration waits for support, corrects confidence, and rejects invalid input', () => {
  const state = createCalibration()
  for (let i = 0; i < 119; i++) observe(state, 0.15, Number(i < 6))
  assert.equal(calibrate(state, 0.15).probability, 0.15)
  observe(state, 0.15, 0)
  assert.equal(calibrate(state, 0.15).probability, 9 / 140)
  assert.throws(() => observe(state, 0.15, 2), /Outcome/)
  assert.throws(() => calibrate(state, NaN), /Probability/)
})

test('saved corrections use only dates before their target', () => {
  const output = path.resolve(__dirname, '../research/two_year_walkforward_v1')
  const read = (name) => zlib.gunzipSync(fs.readFileSync(path.join(output, name))).toString('utf8').trim().split('\n').map((line) => JSON.parse(line))
  const original = read('predictions.jsonl.gz')
  const corrected = read('confidence-predictions.jsonl.gz')
  const grouped = new Map()
  for (const row of corrected) {
    if (!grouped.has(row.task)) grouped.set(row.task, [])
    grouped.get(row.task).push(row)
  }
  for (const [task, rows] of grouped) {
    const candidate = rows[0].candidate
    const side = task.startsWith('open') ? 'open' : 'close'
    const field = `${task.slice(side.length).toLowerCase()}Confidence`
    const inputs = original.map((row) => ({ date: row.date, probability: row.predictions[candidate][side][field], hit: row.scores[candidate][task] })).sort((a, b) => a.date.localeCompare(b.date))
    const state = createCalibration()
    let pointer = 0
    for (const row of rows) {
      while (pointer < inputs.length && inputs[pointer].date < row.date) {
        observe(state, inputs[pointer].probability, inputs[pointer].hit)
        pointer++
      }
      const expected = calibrate(state, row.raw)
      assert.equal(expected.priorPredictions, row.priorPredictions)
      assert.equal(expected.probability, row.calibrated)
      assert.equal(row.scores.calibration.probabilityBrier, (row.calibrated - row.hit) ** 2)
    }
  }
})
