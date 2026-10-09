/* eslint-disable no-console, @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const crypto = require('node:crypto')
const { createCalibration, calibrate, observe } = require('./lib/walkforward-confidence.cjs')
const { pairedInterval } = require('./lib/two-year-walkforward.cjs')

const OUTPUT = path.resolve(__dirname, '../research/two_year_walkforward_v1')
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex')
const report = JSON.parse(fs.readFileSync(path.join(OUTPUT, 'results.json'), 'utf8'))
const bytes = fs.readFileSync(path.join(OUTPUT, 'predictions.jsonl.gz'))
if (sha(bytes) !== report.ledgerSHA256) throw new Error('Input ledger hash mismatch')
const rows = zlib.gunzipSync(bytes).toString('utf8').trim().split('\n').map((line) => JSON.parse(line)).sort((a, b) => a.date.localeCompare(b.date) || a.market.localeCompare(b.market))
const tasks = ['openPanel', 'closePanel', 'openSutta', 'closeSutta', 'openAvoid', 'closeAvoid']
const states = Object.fromEntries(tasks.map((task) => [task, createCalibration()]))
const ledger = []

for (let start = 0; start < rows.length;) {
  let end = start + 1
  while (end < rows.length && rows[end].date === rows[start].date) end++
  // Every market on a date is predicted before any outcome from that date
  // updates calibration. This also excludes unavailable same-day markets.
  for (const row of rows.slice(start, end)) {
    if (row.date < report.scope.start || row.date > report.scope.end) throw new Error('Out-of-scope calibration event')
    for (const task of tasks) {
      const side = task.startsWith('open') ? 'open' : 'close'
      const field = `${task.slice(side.length).toLowerCase()}Confidence`
      const name = report.winners[task]
      const raw = row.predictions[name][side][field]
      const adjusted = calibrate(states[task], raw)
      const hit = row.scores[name][task]
      if (row.date >= report.scope.testStart) ledger.push({
        date: row.date, market: row.market, task, candidate: name, raw, calibrated: adjusted.probability, priorPredictions: adjusted.priorPredictions, hit,
        scores: { production: { probabilityBrier: (raw - hit) ** 2 }, calibration: { probabilityBrier: (adjusted.probability - hit) ** 2 } },
      })
    }
  }
  for (const row of rows.slice(start, end)) {
    for (const task of tasks) {
      const side = task.startsWith('open') ? 'open' : 'close'
      const field = `${task.slice(side.length).toLowerCase()}Confidence`
      const name = report.winners[task]
      observe(states[task], row.predictions[name][side][field], row.scores[name][task])
    }
  }
  start = end
}

const results = {
  inputLedgerSHA256: report.ledgerSHA256,
  method: 'beta confidence bins; 120 prior predictions per bin; 20 raw-probability pseudo-observations; update after whole date; frozen candidate identities from pre-test selection',
  limitation: 'Follow-up hypothesis conceived after inspecting the first study. This is an exploratory retrospective confidence correction, not untouched confirmation or a ranking improvement.',
  tasks: Object.fromEntries(tasks.map((task) => {
    const selected = ledger.filter((row) => row.task === task)
    const mean = (field) => selected.reduce((sum, row) => sum + row[field], 0) / selected.length
    return [task, {
      n: selected.length, candidate: report.winners[task], observed: mean('hit'), rawMean: mean('raw'), calibratedMean: mean('calibrated'),
      rawBrier: selected.reduce((sum, row) => sum + row.scores.production.probabilityBrier, 0) / selected.length,
      calibratedBrier: selected.reduce((sum, row) => sum + row.scores.calibration.probabilityBrier, 0) / selected.length,
      ...pairedInterval(selected, 'probabilityBrier', 'calibration'),
    }]
  })),
}
fs.writeFileSync(path.join(OUTPUT, 'confidence-results.json'), JSON.stringify(results, null, 2))
fs.writeFileSync(path.join(OUTPUT, 'confidence-predictions.jsonl.gz'), zlib.gzipSync(ledger.map((row) => JSON.stringify(row)).join('\n') + '\n'))
const header = '| Task | Actual hit rate | Raw mean confidence | Corrected mean confidence | Raw Brier | Corrected Brier | Reduction 95% interval |'
const lines = [
  '# Historical confidence correction', '', results.limitation, '',
  'No older outcomes are used. Each target confidence correction uses only earlier prediction outcomes from the two-year replay. The bin needs 120 earlier observations and shrinks its observed hit rate toward the raw probability with 20 pseudo-observations. All markets on a date are scored before that date updates calibration. Candidate identities remain those selected before April 9. Picks and hit rates are unchanged.', '',
  header, '| --- | --- | --- | --- | --- | --- | --- |',
  ...Object.entries(results.tasks).map(([task, value]) => `| ${task} | ${(100 * value.observed).toFixed(2)}% | ${(100 * value.rawMean).toFixed(2)}% | ${(100 * value.calibratedMean).toFixed(2)}% | ${value.rawBrier.toFixed(5)} | ${value.calibratedBrier.toFixed(5)} | ${value.interval95.map((n) => n.toFixed(5)).join(' to ')} |`), '',
  'Intervals resample whole dates and are not corrected for multiple tasks. The correction is implemented as a separate research module, not a production confidence change. It measures confidence reliability rather than finding more winning numbers.', '',
  'Reproduce with `node scripts/two-year-confidence-audit.cjs`. All raw and corrected probabilities, outcomes and prior-bin counts are stored in confidence-predictions.jsonl.gz. Run `node --test scripts/verify-two-year-confidence.cjs` to check earlier-date-only updates against the saved ledger.', '',
]
fs.writeFileSync(path.join(OUTPUT, 'CONFIDENCE_REPORT.md'), lines.join('\n'))
console.log(JSON.stringify(results.tasks, null, 2))
