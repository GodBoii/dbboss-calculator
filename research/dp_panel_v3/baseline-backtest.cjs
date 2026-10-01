// Walk-forward backtest of the CURRENT production DP outputs:
//   - openDpPicks / closeDpPicks (DP-only ranked list, app shows 30)
//   - openDpDigitFocus / closeDpDigitFocus (2-digit DP pair)
//   - open/close kind prediction (SP vs DP call)
// For every draw date D in the last 90 days, the model sees only records dated
// < D (all markets), trimmed to the app's 28-month lookback. Output: ledger.
require('./ts-loader.cjs')
const fs = require('fs')
const path = require('path')
const { analyzeMarket } = require('../../src/lib/predictor.ts')
const { getRecordISODate } = require('../../src/lib/backtest.ts')
const { historicalCutoffISO } = require('../../src/lib/prediction-contract.ts')

const DAYS = parseInt(process.argv[2] || '90', 10)
const OUT = process.argv[3] || 'baseline-ledger.json'
// --open-aware: include today's same-market record with the Close blanked,
// i.e. the state the app is in after the Open is published.
const OPEN_AWARE = process.argv.includes('--open-aware')
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')).markets

const dated = {}
let endDate = ''
for (const [m, recs] of Object.entries(data)) {
  dated[m] = recs
    .map((r) => ({ r, d: getRecordISODate(r) }))
    .filter((x) => x.d)
    .sort((a, b) => a.d.localeCompare(b.d))
  const last = dated[m].at(-1)?.d
  if (last && last > endDate) endDate = last
}
const start = new Date(`${endDate}T00:00:00Z`)
start.setUTCDate(start.getUTCDate() - DAYS + 1)
const startDate = start.toISOString().slice(0, 10)

const isDp = (p) => p && p.length === 3 && new Set(p).size === 2
const pairOf = (p) => [...new Set(p)].sort().join('')

function priorFor(isoDate) {
  const prev = new Date(`${isoDate}T00:00:00Z`)
  prev.setUTCDate(prev.getUTCDate() - 1)
  const cutoff = historicalCutoffISO(prev.toISOString().slice(0, 10))
  const out = {}
  for (const [m, rows] of Object.entries(dated)) {
    out[m] = rows.filter((x) => x.d < isoDate && x.d >= cutoff).map((x) => x.r)
  }
  return out
}

const ledger = []
const t0 = Date.now()
const dates = [...new Set(Object.values(dated).flatMap((rows) => rows.map((x) => x.d)))]
  .filter((d) => d >= startDate && d <= endDate)
  .sort()

for (const isoDate of dates) {
  const prior = priorFor(isoDate)
  for (const [market, rows] of Object.entries(dated)) {
    const today = rows.find((x) => x.d === isoDate)
    if (!today || prior[market].length < 50) continue
    let own = prior[market]
    let all = prior
    if (OPEN_AWARE && today.r.openPanel) {
      own = [...own, { ...today.r, closePanel: '', closeSutta: -1, jodi: '' }]
      all = { ...prior, [market]: own }
    }
    const pred = analyzeMarket(market, own, all, new Date(`${isoDate}T12:00:00`))
    if (!pred) continue
    for (const side of ['open', 'close']) {
      const actual = side === 'open' ? today.r.openPanel : today.r.closePanel
      if (!actual || actual.length !== 3) continue
      const picks = side === 'open' ? pred.openDpPicks : pred.closeDpPicks
      const focus = side === 'open' ? pred.openDpDigitFocus : pred.closeDpDigitFocus
      const kind = side === 'open' ? pred.openKindPrediction : pred.closeKindPrediction
      const dp = isDp(actual)
      ledger.push({
        date: isoDate, market, side, actual, dp,
        rank: dp ? (picks.findIndex((p) => p.panel === actual) + 1 || null) : null,
        picks: picks.map((p) => p.panel),
        focus: focus ? focus.pairKey : null,
        kind: kind.predictedKind,
      })
    }
  }
}
console.error(`Computed ${ledger.length} outcomes in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
fs.writeFileSync(path.join(__dirname, OUT), JSON.stringify({ endDate, startDate, ledger }))
console.log(`Saved ledger ${startDate}..${endDate}`)
