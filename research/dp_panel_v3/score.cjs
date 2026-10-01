// Score a DP ledger for the last 7 / 30 / 90 days.
// Usage: node score.cjs <ledger.json> [label]
const fs = require('fs')

const DP_TOTAL = 90
const PAIR_TOTAL = 45
const pairOf = (p) => [...new Set(p)].sort().join('')

function windowStart(endDate, days) {
  const d = new Date(`${endDate}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days + 1)
  return d.toISOString().slice(0, 10)
}

function pct(n, d) { return d ? `${((n / d) * 100).toFixed(1)}%` : '-' }

function summarize(rows) {
  const dpRows = rows.filter((r) => r.dp)
  const hit = (n) => dpRows.filter((r) => r.picks.slice(0, n).includes(r.actual)).length
  const focusExact = dpRows.filter((r) => r.focus && pairOf(r.actual) === r.focus).length
  const focusAny = dpRows.filter((r) => r.focus && [...r.focus].some((d) => r.actual.includes(d))).length
  const dpCalls = rows.filter((r) => r.kind === 'DP')
  const dpCallHits = dpCalls.filter((r) => r.dp).length
  return {
    outcomes: rows.length,
    dp: dpRows.length,
    dpRate: pct(dpRows.length, rows.length),
    top10: hit(10), top15: hit(15), top20: hit(20), top30: hit(30),
    focusExact, focusAny,
    dpCalls: dpCalls.length, dpCallHits,
  }
}

function report(ledgerFile, label) {
  const { endDate, ledger } = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
  const out = {}
  for (const days of [7, 30, 90]) {
    const s = windowStart(endDate, days)
    for (const side of ['open', 'close', 'all']) {
      const rows = ledger.filter((r) => r.date >= s && (side === 'all' || r.side === side))
      out[`${days}d-${side}`] = summarize(rows)
    }
  }
  console.log(`\n=== ${label ?? ledgerFile} (end ${endDate}) ===`)
  console.log('window      side   DPs/outcomes  Top10      Top15      Top20      Top30      PairExact  PairAny    KindDP prec')
  for (const [key, v] of Object.entries(out)) {
    const [w, side] = key.split('-')
    const f = (n) => `${String(n).padStart(3)} ${pct(n, v.dp).padStart(6)}`
    console.log(
      `${w.padEnd(11)} ${side.padEnd(6)} ${`${v.dp}/${v.outcomes}`.padEnd(13)} ${f(v.top10)} ${f(v.top15)} ${f(v.top20)} ${f(v.top30)} ${f(v.focusExact)} ${f(v.focusAny)} ${v.dpCallHits}/${v.dpCalls} ${pct(v.dpCallHits, v.dpCalls)}`,
    )
  }
  console.log(`random: Top10 ${pct(10, DP_TOTAL)} Top15 ${pct(15, DP_TOTAL)} Top20 ${pct(20, DP_TOTAL)} Top30 ${pct(30, DP_TOTAL)} PairExact ${pct(1, PAIR_TOTAL)} PairAny 37.8%`)
  return out
}

module.exports = { report, summarize }
if (require.main === module) report(process.argv[2], process.argv[3])
