/* eslint-disable no-console */
// Evaluates the pre-specified v2 rule model against production on identical rows,
// and checks that its driving effects were already present before the 90-day test window.
//   Open : rank digits by how recently they appeared as this market's open (most recent first).
//   Close: push previous close and previous open to the bottom, rank the rest by fewest
//          close appearances in the last 30 draws (cold-first).
//   Jodi : 6 x 6 grid of the two lists.
const fs = require("fs")
const path = require("path")
const R = require("./sutta-v2-research.cjs")
const { DATA, MARKETS, tieBreak, zeros, addDays, zScore } = R

const ROOT = path.resolve(__dirname, "..")
const ANCHOR = process.argv[2] || "2026-10-01"
const TEST_START = addDays(ANCHOR, -89)
const LEDGER = path.join(ROOT, "backtest_reports", "2026-10-01", "production-model-window-report.json")

function openOrder(hist, tb) {
  const s = zeros(10).map(() => -1e6)
  for (let i = hist.length - 1; i >= 0; i--) { const d = hist[i].o; if (s[d] === -1e6) s[d] = -(hist.length - i) }
  return s.map((v, d) => [v + tb[d], d]).sort((a, b) => b[0] - a[0]).map((x) => x[1])
}
function closeOrder(hist, tb) {
  const p = hist.at(-1)
  const c30 = zeros(10)
  for (let i = Math.max(0, hist.length - 30); i < hist.length; i++) c30[hist[i].c]++
  const s = c30.map((c, d) => -c - (d === p.c ? 100 : 0) - (d === p.o ? 100 : 0))
  return s.map((v, d) => [v + tb[d], d]).sort((a, b) => b[0] - a[0]).map((x) => x[1])
}

// ---- 1. effects before vs inside the test window
const eff = {}
for (const m of MARKETS) {
  const h = DATA[m]
  for (let i = 1; i < h.length; i++) {
    const seg = h[i].d < TEST_START ? "before" : "test"
    for (const [k, v] of [["o=prevO", h[i].o === h[i - 1].o], ["c=prevC", h[i].c === h[i - 1].c], ["c=prevO", h[i].c === h[i - 1].o]]) {
      eff[k] ||= { before: [0, 0], test: [0, 0] }
      eff[k][seg][1]++; if (v) eff[k][seg][0]++
    }
  }
}
console.log(`=== Driving effects before ${TEST_START} vs inside 90-day test window (expected 10%) ===`)
for (const [k, v] of Object.entries(eff)) {
  console.log(`  ${k.padEnd(8)} before ${(100 * v.before[0] / v.before[1]).toFixed(2)}% (n=${v.before[1]}, z=${zScore(v.before[0], v.before[1], 0.1).toFixed(2)})  test ${(100 * v.test[0] / v.test[1]).toFixed(2)}% (n=${v.test[1]}, z=${zScore(v.test[0], v.test[1], 0.1).toFixed(2)})`)
}

// ---- 2. walk-forward v2 rows
const prod = new Map()
for (const r of JSON.parse(fs.readFileSync(LEDGER, "utf8")).ledger) if (!prod.has(`${r.market}|${r.isoDate}`)) prod.set(`${r.market}|${r.isoDate}`, r.prediction)
const rows = []
for (const m of MARKETS) {
  const h = DATA[m]
  for (let i = 180; i < h.length; i++) {
    const r = h[i], hist = h.slice(0, i), tb = tieBreak(`${m}|${r.d}`)
    const o6 = openOrder(hist, tb).slice(0, 6), c6 = closeOrder(hist, tb).slice(0, 6)
    const jodis = o6.flatMap((a) => c6.map((b) => `${a}${b}`))
    rows.push({ m, d: r.d, o: r.o, c: r.c, o6, c6, jodis, p: prod.get(`${m}|${r.d}`) })
  }
}

const out = {}
function line(label, h, n, base) { return `${label} ${(100 * h / n).toFixed(1)}% (${h}/${n}, z=${zScore(h, n, base).toFixed(2)})` }
for (const [name, off] of [["7d", -6], ["30d", -29], ["90d", -89]]) {
  const sel = rows.filter((r) => r.d >= addDays(ANCHOR, off) && r.d <= ANCHOR && r.p)
  const n = sel.length
  const c = (f) => sel.reduce((a, r) => a + (f(r) ? 1 : 0), 0)
  const res = {
    n,
    v2: { open: c((r) => r.o6.includes(r.o)), close: c((r) => r.c6.includes(r.c)), jodi: c((r) => r.jodis.includes(`${r.o}${r.c}`)) },
    prod: { open: c((r) => r.p.openSuttas.includes(r.o)), close: c((r) => r.p.closeSuttas.includes(r.c)), jodi: c((r) => r.p.jodis.includes(`${r.o}${r.c}`)) },
  }
  out[name] = res
  console.log(`\n${name} (identical ${n} rows)`)
  for (const k of ["open", "close", "jodi"]) {
    const base = k === "jodi" ? 0.36 : 0.6
    console.log(`  ${k.padEnd(5)} ${line("production", res.prod[k], n, base)} | ${line("v2", res.v2[k], n, base)}`)
  }
}
// full walk-forward + per market for v2 only
const full = rows
const blocks = {}
for (const r of full) {
  const q = r.d.slice(0, 7) < "2025-07" ? "2024H2-2025H1" : r.d.slice(0, 7) < "2026-01" ? "2025H2" : r.d < TEST_START ? "2026H1(pre-test)" : "test90"
  blocks[q] ||= { n: 0, o: 0, c: 0, j: 0 }
  blocks[q].n++; blocks[q].o += r.o6.includes(r.o); blocks[q].c += r.c6.includes(r.c); blocks[q].j += r.jodis.includes(`${r.o}${r.c}`)
}
console.log("\n=== v2 by period (walk-forward) ===")
for (const [k, b] of Object.entries(blocks)) console.log(`  ${k.padEnd(18)} n=${b.n} open ${(100 * b.o / b.n).toFixed(1)}% close ${(100 * b.c / b.n).toFixed(1)}% jodi ${(100 * b.j / b.n).toFixed(1)}%`)
fs.writeFileSync(path.join(ROOT, "scratch", "sutta-v2-final-eval.json"), JSON.stringify({ anchor: ANCHOR, effects: eff, windows: out, blocks }, null, 1))
