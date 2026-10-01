/* eslint-disable no-console */
// Sutta v2: pooled conditional-logit model built on the repeat/avoid effects
// found by sutta-v2-stability.cjs. Strict walk-forward: weights are refit at the
// start of each month on rows dated before that month only.
// Usage: node scratch/sutta-v2-logit.cjs [anchorDate]
const fs = require("fs")
const path = require("path")
const R = require("./sutta-v2-research.cjs")
const { DATA, MARKETS, buildEvents, sameDayVisible, tieBreak, zeros, addDays, zScore } = R

const ROOT = path.resolve(__dirname, "..")
const ANCHOR = process.argv[2] || "2026-10-01"
const LEDGER_FILE = path.join(ROOT, "backtest_reports", "2026-10-01", "production-model-window-report.json")
const MIN_FEATURE_HISTORY = 30
const MIN_TRAIN = 180
const L2 = 1.0

function ewma(hist, key, a) { const s = zeros(10); for (let i = Math.max(0, hist.length - 60); i < hist.length; i++) { for (let d = 0; d < 10; d++) s[d] *= 1 - a; s[hist[i][key]] += a } return s }
function cnt(hist, key, n) { const s = zeros(10); for (let i = Math.max(0, hist.length - n); i < hist.length; i++) s[hist[i][key]]++; return s }

// Feature matrix [10][F] for one side. "same" = target side, "other" = opposite side.
const FEATURE_NAMES = ["eqPrevSame", "eqPrevOther", "inPrev2_3Same", "inPrev2_3Other", "ewmaSame", "cnt30Same", "eqSameDayLast", "sameDayShare"]
function features(hist, side, sameDay) {
  const s = side === "open" ? "o" : "c", o = side === "open" ? "c" : "o"
  const p1 = hist.at(-1), p2 = hist.at(-2), p3 = hist.at(-3)
  const ew = ewma(hist, s, 0.1), c30 = cnt(hist, s, 30)
  const sdCount = zeros(10); for (const d of sameDay) sdCount[d]++
  const sdLast = sameDay.length ? sameDay.at(-1) : -1
  return Array.from({ length: 10 }, (_, d) => [
    d === p1[s] ? 1 : 0,
    d === p1[o] ? 1 : 0,
    (d === p2[s] ? 1 : 0) + (d === p3[s] ? 1 : 0),
    (d === p2[o] ? 1 : 0) + (d === p3[o] ? 1 : 0),
    (ew[d] - 0.1) * 10,
    (c30[d] / 30 - 0.1) * 10,
    d === sdLast ? 1 : 0,
    sameDay.length ? sdCount[d] / sameDay.length - 0.1 : 0,
  ])
}
function softmax(X, w) {
  const u = X.map((f) => f.reduce((a, x, k) => a + x * w[k], 0))
  const mx = Math.max(...u)
  const e = u.map((x) => Math.exp(x - mx))
  const z = e.reduce((a, b) => a + b, 0)
  return e.map((x) => x / z)
}
function fit(samples, F, w0) {
  // Newton-Raphson on the conditional logit log-likelihood with L2 penalty.
  let w = w0 ? [...w0] : zeros(F)
  for (let iter = 0; iter < 25; iter++) {
    const g = zeros(F), H = Array.from({ length: F }, () => zeros(F))
    for (const { X, y } of samples) {
      const p = softmax(X, w)
      const mean = zeros(F)
      for (let d = 0; d < 10; d++) for (let k = 0; k < F; k++) mean[k] += p[d] * X[d][k]
      for (let k = 0; k < F; k++) g[k] += X[y][k] - mean[k]
      for (let d = 0; d < 10; d++) for (let a = 0; a < F; a++) {
        const da = X[d][a] - mean[a]
        if (da === 0) continue
        for (let b = 0; b < F; b++) H[a][b] -= p[d] * da * (X[d][b] - mean[b])
      }
    }
    for (let k = 0; k < F; k++) { g[k] -= L2 * w[k]; H[k][k] -= L2 }
    const step = solve(H.map((r) => r.map((x) => -x)), g)
    let mx = 0
    for (let k = 0; k < F; k++) { w[k] += step[k]; mx = Math.max(mx, Math.abs(step[k])) }
    if (mx < 1e-6) break
  }
  return w
}
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k] }
  }
  return M.map((r, i) => r[n] / r[i])
}

function main() {
  const byDate = buildEvents()
  // build all samples
  const samples = []
  for (const m of MARKETS) {
    const h = DATA[m]
    for (let i = MIN_FEATURE_HISTORY; i < h.length; i++) {
      const r = h[i], hist = h.slice(Math.max(0, i - 60), i)
      const sameDay = sameDayVisible(byDate, r.d, m)
      samples.push({ m, d: r.d, i, o: r.o, c: r.c, Xo: features(hist, "open", sameDay), Xc: features(hist, "close", sameDay) })
    }
  }
  samples.sort((a, b) => a.d.localeCompare(b.d))
  const months = [...new Set(samples.map((s) => s.d.slice(0, 7)))]
  const F = FEATURE_NAMES.length
  let wo = null, wc = null
  const rows = []
  const weightLog = {}
  for (const month of months) {
    const train = samples.filter((s) => s.d < `${month}-01`)
    if (train.length >= 1000) {
      wo = fit(train.map((s) => ({ X: s.Xo, y: s.o })), F, wo)
      wc = fit(train.map((s) => ({ X: s.Xc, y: s.c })), F, wc)
      weightLog[month] = { open: wo.map((x) => +x.toFixed(3)), close: wc.map((x) => +x.toFixed(3)) }
    }
    if (!wo) continue
    for (const s of samples.filter((x) => x.d.startsWith(month) && x.i >= MIN_TRAIN)) {
      const tb = tieBreak(`${s.m}|${s.d}`)
      const po = softmax(s.Xo, wo), pc = softmax(s.Xc, wc)
      const top = (p) => p.map((v, d) => [v + tb[d], d]).sort((a, b) => b[0] - a[0]).slice(0, 6).map((x) => x[1])
      const o6 = top(po), c6 = top(pc)
      const grid = []; for (const a of o6) for (const b of c6) grid.push(`${a}${b}`)
      const cells = []
      for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) cells.push([po[a] * pc[b] + tb[a] * tb[b], `${a}${b}`])
      const joint36 = cells.sort((x, y) => y[0] - x[0]).slice(0, 36).map((x) => x[1])
      rows.push({ m: s.m, d: s.d, o: s.o, c: s.c, o6, c6, grid, joint36, llo: Math.log(po[s.o]), llc: Math.log(pc[s.c]) })
    }
  }

  const prodMap = new Map()
  if (fs.existsSync(LEDGER_FILE)) for (const r of JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8")).ledger) if (!prodMap.has(`${r.market}|${r.isoDate}`)) prodMap.set(`${r.market}|${r.isoDate}`, r.prediction)

  console.log("Monthly-refit weights (latest):", FEATURE_NAMES.join(", "))
  const lastMonth = Object.keys(weightLog).at(-1)
  console.log("  open ", weightLog[lastMonth].open.join(", "))
  console.log("  close", weightLog[lastMonth].close.join(", "))

  const windows = [["7d", -6], ["30d", -29], ["90d", -89], ["full walk-forward", null]]
  const result = {}
  for (const [name, off] of windows) {
    const sel = rows.filter((r) => r.d <= ANCHOR && (off === null || r.d >= addDays(ANCHOR, off)))
    const n = sel.length
    const h = (f) => sel.reduce((a, r) => a + (f(r) ? 1 : 0), 0)
    const ho = h((r) => r.o6.includes(r.o)), hc = h((r) => r.c6.includes(r.c))
    const hg = h((r) => r.grid.includes(`${r.o}${r.c}`)), hj = h((r) => r.joint36.includes(`${r.o}${r.c}`))
    const ll = sel.reduce((a, r) => a + r.llo + r.llc, 0) / n
    const withProd = sel.filter((r) => prodMap.has(`${r.m}|${r.d}`))
    const ph = (f) => withProd.reduce((a, r) => a + (f(prodMap.get(`${r.m}|${r.d}`), r) ? 1 : 0), 0)
    const prod = withProd.length ? {
      n: withProd.length,
      open: ph((p, r) => p.openSuttas.includes(r.o)), close: ph((p, r) => p.closeSuttas.includes(r.c)), jodi: ph((p, r) => p.jodis.includes(`${r.o}${r.c}`)),
      v2open: withProd.reduce((a, r) => a + (r.o6.includes(r.o) ? 1 : 0), 0),
      v2close: withProd.reduce((a, r) => a + (r.c6.includes(r.c) ? 1 : 0), 0),
      v2jodi: withProd.reduce((a, r) => a + (r.joint36.includes(`${r.o}${r.c}`) ? 1 : 0), 0),
    } : null
    result[name] = { n, ho, hc, hg, hj, ll, prod }
    const f = (x, base) => `${(100 * x / n).toFixed(1)}% (${x}/${n}, z=${zScore(x, n, base).toFixed(2)})`
    console.log(`\n${name}: n=${n}`)
    console.log(`  v2 open  top6 ${f(ho, 0.6)}`)
    console.log(`  v2 close top6 ${f(hc, 0.6)}`)
    console.log(`  v2 jodi 6x6 grid ${f(hg, 0.36)}`)
    console.log(`  v2 jodi joint top36 ${f(hj, 0.36)}`)
    console.log(`  mean log-lik per draw (open+close) ${ll.toFixed(4)} vs uniform ${(2 * Math.log(0.1)).toFixed(4)}`)
    if (prod) console.log(`  production on same ${prod.n} rows: open ${(100 * prod.open / prod.n).toFixed(1)}% close ${(100 * prod.close / prod.n).toFixed(1)}% jodi ${(100 * prod.jodi / prod.n).toFixed(1)}%  | v2: ${(100 * prod.v2open / prod.n).toFixed(1)}% ${(100 * prod.v2close / prod.n).toFixed(1)}% ${(100 * prod.v2jodi / prod.n).toFixed(1)}%`)
  }
  fs.writeFileSync(path.join(ROOT, "scratch", "sutta-v2-logit-output.json"), JSON.stringify({ anchor: ANCHOR, featureNames: FEATURE_NAMES, weightLog, result }, null, 1))
}

main()
