/* eslint-disable no-console */
// Sutta v2 research harness.
//  Part A: predictability audit (chi-square tests on the full history).
//  Part B: strict walk-forward test of many candidate strategies plus online
//          meta-selectors. Every prediction for date D uses only rows dated
//          before D for the same market and, for other markets, only results
//          published before the target market's OPEN time on D.
// Usage: node scratch/sutta-v2-research.cjs [anchorDate]
const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "scratch", "sutta-v2-history.json"), "utf8"))
const LEDGER_FILE = path.join(ROOT, "backtest_reports", "2026-10-01", "production-model-window-report.json")
const OUT_JSON = path.join(ROOT, "scratch", "sutta-v2-research-output.json")
const MIN_TRAIN = 180
const K = 6

const TIMING = {
  Sridevi: [695, 755], "Time Bazar": [790, 850], "Madhur Day": [810, 870], "Rajdhani Day": [905, 1025],
  "Milan Day": [910, 1030], Kalyan: [945, 1065], "Sridevi Night": [1155, 1215], "Madhur Night": [1230, 1350],
  "Milan Night": [1265, 1385], "Rajdhani Night": [1295, 1425], "Kalyan Night": [1305, 1425], "Main Bazar": [1320, 1450],
}
const MARKETS = Object.keys(DATA)

// ---------------------------------------------------------------- stats utils
function gammaLnApprox(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -0.000005395239384953]
  let y = x
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5)
  let ser = 1.000000000190015
  for (const v of c) ser += v / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}
function gammaQ(a, x) {
  // upper regularized incomplete gamma
  if (x < a + 1) {
    let sum = 1 / a, del = sum, ap = a
    for (let n = 0; n < 500; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - gammaLnApprox(a))
  }
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a); b += 2
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d; const del = d * c; h *= del
    if (Math.abs(del - 1) < 1e-12) break
  }
  return Math.exp(-x + a * Math.log(x) - gammaLnApprox(a)) * h
}
function chiUniform(counts) {
  const n = counts.reduce((a, b) => a + b, 0), e = n / counts.length
  const chi = counts.reduce((s, c) => s + ((c - e) ** 2) / e, 0)
  return { n, chi: +chi.toFixed(2), df: counts.length - 1, p: +gammaQ((counts.length - 1) / 2, chi / 2).toFixed(4) }
}
function chiIndependence(table) {
  const R = table.length, C = table[0].length
  const rs = table.map((r) => r.reduce((a, b) => a + b, 0))
  const cs = Array.from({ length: C }, (_, j) => table.reduce((s, r) => s + r[j], 0))
  const n = rs.reduce((a, b) => a + b, 0)
  let chi = 0
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
    const e = (rs[i] * cs[j]) / n
    if (e > 0) chi += ((table[i][j] - e) ** 2) / e
  }
  const df = (R - 1) * (C - 1)
  return { n, chi: +chi.toFixed(2), df, p: +gammaQ(df / 2, chi / 2).toFixed(4) }
}
const zeros = (n) => new Array(n).fill(0)
const mat = () => Array.from({ length: 10 }, () => zeros(10))
const mod10 = (x) => ((x % 10) + 10) % 10
const pct = (h, n) => (n ? `${((100 * h) / n).toFixed(1)}%` : "N/A")
const zScore = (h, n, p) => (n ? (h / n - p) / Math.sqrt((p * (1 - p)) / n) : 0)

// ---------------------------------------------------------------- Part A audit
function audit() {
  const pooled = { open: zeros(10), close: zeros(10), diff: zeros(10), oc: mat(), oo: mat(), cc: mat(), co: mat(), sum: zeros(10) }
  const perMarket = {}
  for (const m of MARKETS) {
    const rows = DATA[m]
    const a = { open: zeros(10), close: zeros(10), diff: zeros(10), oc: mat(), oo: mat(), cc: mat() }
    rows.forEach((r, i) => {
      a.open[r.o]++; a.close[r.c]++; a.diff[mod10(r.c - r.o)]++; a.oc[r.o][r.c]++
      pooled.open[r.o]++; pooled.close[r.c]++; pooled.diff[mod10(r.c - r.o)]++; pooled.oc[r.o][r.c]++
      pooled.sum[mod10(r.o + r.c)]++
      if (i > 0) {
        const p = rows[i - 1]
        a.oo[p.o][r.o]++; a.cc[p.c][r.c]++
        pooled.oo[p.o][r.o]++; pooled.cc[p.c][r.c]++; pooled.co[p.c][r.o]++
      }
    })
    perMarket[m] = {
      n: rows.length,
      open: chiUniform(a.open).p, close: chiUniform(a.close).p, diff: chiUniform(a.diff).p,
      openCloseIndep: chiIndependence(a.oc).p, openMarkov: chiIndependence(a.oo).p, closeMarkov: chiIndependence(a.cc).p,
    }
  }
  // cross-market: earliest-available same-day neighbour's open vs target open
  const crossTable = mat()
  for (const m of MARKETS) {
    const prevMarket = MARKETS.filter((x) => TIMING[x][1] < TIMING[m][0]).sort((x, y) => TIMING[y][1] - TIMING[x][1])[0]
    if (!prevMarket) continue
    const byDate = new Map(DATA[prevMarket].map((r) => [r.d, r]))
    for (const r of DATA[m]) { const s = byDate.get(r.d); if (s) crossTable[s.c][r.o]++ }
  }
  return {
    pooled: {
      open: chiUniform(pooled.open), close: chiUniform(pooled.close), jodiDiff: chiUniform(pooled.diff), jodiSum: chiUniform(pooled.sum),
      openCloseIndep: chiIndependence(pooled.oc), openMarkov: chiIndependence(pooled.oo), closeMarkov: chiIndependence(pooled.cc),
      prevCloseToOpen: chiIndependence(pooled.co), prevMarketCloseToOpen: chiIndependence(crossTable),
      openCounts: pooled.open, closeCounts: pooled.close, diffCounts: pooled.diff,
    },
    perMarket,
  }
}

// ---------------------------------------------------------------- strategies
// Each strategy returns a length-10 score vector (higher = more likely).
function counts(hist, key, from = 0) {
  const c = zeros(10)
  for (let i = from; i < hist.length; i++) c[hist[i][key]]++
  return c
}
function lastSeenGap(hist, key) {
  const g = zeros(10).map(() => hist.length + 1)
  for (let i = hist.length - 1; i >= 0; i--) { const d = hist[i][key]; if (g[d] > hist.length) g[d] = hist.length - i }
  return g
}
const neg = (v) => v.map((x) => -x)
function condCounts(hist, key, condKey, condValue, lagKey = condKey) {
  // counts of hist[i][key] where hist[i-1][condKey] == condValue
  const c = zeros(10)
  for (let i = 1; i < hist.length; i++) if (hist[i - 1][lagKey] === condValue) c[hist[i][key]]++
  return c
}
function deltaCounts(hist, key, baseKey) {
  // distribution of (x_t - base_{t-1}) mod 10
  const c = zeros(10)
  for (let i = 1; i < hist.length; i++) c[mod10(hist[i][key] - hist[i - 1][baseKey])]++
  return c
}
function shift(c, base) {
  const s = zeros(10)
  for (let d = 0; d < 10; d++) s[d] = c[mod10(d - base)]
  return s
}
function ewma(hist, key, alpha) {
  const s = zeros(10)
  for (const r of hist) { for (let d = 0; d < 10; d++) s[d] *= 1 - alpha; s[r[key]] += alpha }
  return s
}
function panelDigitPresence(panel) {
  const s = zeros(10)
  for (const ch of panel) s[Number(ch)] = 1
  return s
}

function buildStrategies(side) {
  const key = side === "open" ? "o" : "c"
  const other = side === "open" ? "c" : "o"
  const S = {
    hotAll: (x) => counts(x.hist, key),
    hot30: (x) => counts(x.hist, key, x.hist.length - 30),
    hot60: (x) => counts(x.hist, key, x.hist.length - 60),
    hot120: (x) => counts(x.hist, key, x.hist.length - 120),
    cold30: (x) => neg(counts(x.hist, key, x.hist.length - 30)),
    cold60: (x) => neg(counts(x.hist, key, x.hist.length - 60)),
    cold120: (x) => neg(counts(x.hist, key, x.hist.length - 120)),
    coldAll: (x) => neg(counts(x.hist, key)),
    ewmaFast: (x) => ewma(x.hist, key, 0.1),
    ewmaFastCold: (x) => neg(ewma(x.hist, key, 0.1)),
    dueGap: (x) => lastSeenGap(x.hist, key),
    recentGap: (x) => neg(lastSeenGap(x.hist, key)),
    markovSame: (x) => condCounts(x.hist, key, key, x.hist.at(-1)[key]),
    markovOther: (x) => condCounts(x.hist, key, other, x.hist.at(-1)[other]),
    antiMarkovSame: (x) => neg(condCounts(x.hist, key, key, x.hist.at(-1)[key])),
    deltaSame: (x) => shift(deltaCounts(x.hist, key, key), x.hist.at(-1)[key]),
    deltaOther: (x) => shift(deltaCounts(x.hist, key, other), x.hist.at(-1)[other]),
    weekday: (x) => { const c = zeros(10); for (const r of x.hist) if (r.wd === x.wd) c[r[key]]++; return c },
    weekdayCold: (x) => { const c = zeros(10); for (const r of x.hist) if (r.wd === x.wd) c[r[key]]--; return c },
    avoidLast: (x) => { const s = zeros(10); s[x.hist.at(-1)[key]] = -1; s[x.hist.at(-1)[other]] -= 0.5; return s },
    lastPanelDigits: (x) => panelDigitPresence(side === "open" ? x.hist.at(-1).op : x.hist.at(-1).cp),
    avoidLastPanelDigits: (x) => neg(panelDigitPresence(side === "open" ? x.hist.at(-1).op : x.hist.at(-1).cp)),
    sameDayHot: (x) => { const s = zeros(10); for (const d of x.sameDay) s[d]++; return s },
    sameDayCold: (x) => { const s = zeros(10); for (const d of x.sameDay) s[d]--; return s },
    sameDayLastOpp: (x) => { const s = zeros(10); if (x.sameDay.length) s[mod10(x.sameDay.at(-1) + 5)] = 1; return s },
    sameDayLastSame: (x) => { const s = zeros(10); if (x.sameDay.length) s[x.sameDay.at(-1)] = 1; return s },
    sameDayCrossCond: (x) => {
      // learned: P(target | latest earlier same-day source digit) from this market's history
      const s = zeros(10)
      if (!x.sameDay.length || !x.crossCond) return s
      const row = x.crossCond[x.sameDay.at(-1)]
      for (let d = 0; d < 10; d++) s[d] = row[d]
      return s
    },
  }
  return S
}

// Deterministic tiny tie-breaker so ties do not systematically favour low digits.
function tieBreak(seed) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  const t = zeros(10)
  for (let d = 0; d < 10; d++) { h ^= d + 1; h = Math.imul(h, 16777619); t[d] = ((h >>> 0) % 100000) / 1e12 }
  return t
}
function topK(scores, tb, k = K) {
  return scores.map((s, d) => [s + tb[d], d]).sort((a, b) => b[0] - a[0]).slice(0, k).map((p) => p[1])
}
function rankVector(scores, tb) {
  // Borda points: best digit gets 9, worst 0
  const order = scores.map((s, d) => [s + tb[d], d]).sort((a, b) => b[0] - a[0])
  const r = zeros(10)
  order.forEach(([, d], i) => { r[d] = 9 - i })
  return r
}

// ---------------------------------------------------------------- walk-forward
function buildEvents() {
  // events: every completed draw with its date and the digits visible before each market's open.
  const byDate = new Map()
  for (const m of MARKETS) for (const r of DATA[m]) {
    if (!byDate.has(r.d)) byDate.set(r.d, {})
    byDate.get(r.d)[m] = r
  }
  return byDate
}
function sameDayVisible(byDate, date, market) {
  // digits from other markets published before this market's open, in time order
  const day = byDate.get(date) || {}
  const t0 = TIMING[market][0]
  const ev = []
  for (const [m, r] of Object.entries(day)) {
    if (m === market) continue
    if (TIMING[m][0] < t0) ev.push([TIMING[m][0], r.o])
    if (TIMING[m][1] < t0) ev.push([TIMING[m][1], r.c])
  }
  return ev.sort((a, b) => a[0] - b[0]).map((e) => e[1])
}

function run() {
  const byDate = buildEvents()
  const sides = ["open", "close"]
  const strategies = { open: buildStrategies("open"), close: buildStrategies("close") }
  const names = Object.keys(strategies.open)
  const rows = [] // one per (market, date) prediction
  for (const m of MARKETS) {
    const hist = DATA[m].map((r) => ({ ...r, wd: new Date(`${r.d}T12:00:00Z`).getUTCDay() }))
    // cross-market conditional table (latest same-day source digit -> target), learned incrementally
    const crossCond = { open: mat(), close: mat() }
    for (let i = 0; i < hist.length; i++) {
      const r = hist[i]
      const sameDay = sameDayVisible(byDate, r.d, m)
      if (i >= MIN_TRAIN) {
        const ctx = { hist: hist.slice(0, i), wd: r.wd, sameDay }
        const tb = tieBreak(`${m}|${r.d}`)
        const row = { m, d: r.d, o: r.o, c: r.c, preds: {}, ranks: {}, scores: {} }
        for (const side of sides) {
          ctx.crossCond = crossCond[side]
          row.preds[side] = {}; row.ranks[side] = {}; row.scores[side] = {}
          for (const n of names) {
            const s = strategies[side][n](ctx)
            row.preds[side][n] = topK(s, tb)
            row.ranks[side][n] = rankVector(s, tb)
          }
        }
        // direct jodi strategies need the joint history
        row.jodi = jodiStrategies(ctx, tb)
        row.tb = tb
        rows.push(row)
      }
      if (sameDay.length) { crossCond.open[sameDay.at(-1)][r.o]++; crossCond.close[sameDay.at(-1)][r.c]++ }
    }
  }
  return { rows, names }
}

function jodiStrategies(ctx, tb) {
  const h = ctx.hist
  const jc = zeros(100), oc = zeros(10), cGivenO = mat(), diff = zeros(10)
  for (const r of h) { jc[r.o * 10 + r.c]++; oc[r.o]++; cGivenO[r.o][r.c]++; diff[mod10(r.c - r.o)]++ }
  const n = h.length
  const recent = zeros(100)
  for (let i = Math.max(0, n - 120); i < n; i++) recent[h[i].o * 10 + h[i].c]++
  const last = h.at(-1)
  const out = {}
  const pick = (score) => score.map((s, j) => [s + tb[j % 10] * (1 + Math.floor(j / 10)), j]).sort((a, b) => b[0] - a[0]).slice(0, 36).map((p) => String(p[1]).padStart(2, "0"))
  out.jodiHotAll = pick(jc)
  out.jodiColdAll = pick(jc.map((x) => -x))
  out.jodiCold120 = pick(recent.map((x) => -x))
  out.jodiOpenDiff = pick(jc.map((_, j) => ((oc[Math.floor(j / 10)] + 1) / (n + 10)) * ((diff[mod10((j % 10) - Math.floor(j / 10))] + 1) / (n + 10))))
  out.jodiOpenCond = pick(jc.map((_, j) => { const o = Math.floor(j / 10); return ((oc[o] + 1) / (n + 10)) * ((cGivenO[o][j % 10] + 1) / (oc[o] + 10)) }))
  // avoid repeating last jodi, its reverse, and same-digit doubles
  out.jodiAvoidRecent = pick(jc.map((_, j) => {
    const o = Math.floor(j / 10), c = j % 10
    let s = -recent[j]
    if (o === last.o && c === last.c) s -= 5
    if (o === last.c && c === last.o) s -= 3
    return s
  }))
  return out
}

// ---------------------------------------------------------------- meta selectors
function evaluate({ rows, names }) {
  // index rows by market in date order (already), and globally by date
  const sides = ["open", "close"]
  const byMarket = {}
  for (const r of rows) (byMarket[r.m] ||= []).push(r)
  for (const r of rows) {
    r.hit = {}
    for (const side of sides) {
      const actual = side === "open" ? r.o : r.c
      r.hit[side] = Object.fromEntries(names.map((n) => [n, r.preds[side][n].includes(actual) ? 1 : 0]))
    }
    const jodi = `${r.o}${r.c}`
    r.jodiHit = Object.fromEntries(Object.entries(r.jodi).map(([n, list]) => [n, list.includes(jodi) ? 1 : 0]))
  }
  const metaWindows = [60, 120, 250, 500]
  const sortedRows = [...rows].sort((a, b) => a.d.localeCompare(b.d) || a.m.localeCompare(b.m))

  // per-market rolling selector + hedge + borda
  for (const m of MARKETS) {
    const list = byMarket[m] || []
    const hedgeW = { open: Object.fromEntries(names.map((n) => [n, 1])), close: Object.fromEntries(names.map((n) => [n, 1])) }
    const eta = 0.05
    list.forEach((r, i) => {
      r.meta = r.meta || { open: {}, close: {} }
      for (const side of sides) {
        const actual = side === "open" ? r.o : r.c
        for (const W of metaWindows) {
          const past = list.slice(Math.max(0, i - W), i)
          let best = names[0], bestScore = -1
          if (past.length >= 30) for (const n of names) {
            const s = past.reduce((a, p) => a + p.hit[side][n], 0)
            if (s > bestScore) { bestScore = s; best = n }
          }
          r.meta[side][`marketBest${W}`] = past.length >= 30 ? r.preds[side][best] : r.preds[side].hotAll
        }
        // hedge-weighted borda
        const agg = zeros(10)
        const wsum = Object.values(hedgeW[side]).reduce((a, b) => a + b, 0)
        for (const n of names) for (let d = 0; d < 10; d++) agg[d] += (hedgeW[side][n] / wsum) * r.ranks[side][n][d]
        r.meta[side].marketHedge = topK(agg, r.tb)
        // equal-weight borda of all strategies
        const eq = zeros(10)
        for (const n of names) for (let d = 0; d < 10; d++) eq[d] += r.ranks[side][n][d]
        r.meta[side].bordaAll = topK(eq, r.tb)
        // update hedge
        for (const n of names) hedgeW[side][n] *= Math.exp(eta * (r.hit[side][n] - 0.6))
        const mx = Math.max(...Object.values(hedgeW[side]))
        for (const n of names) hedgeW[side][n] /= mx
        void actual
      }
    })
  }

  // pooled (all markets) rolling selector, uses only rows dated strictly before the target date
  for (const side of sides) {
    for (const W of [500, 1500, 3000]) {
      const cum = []
      const totals = Object.fromEntries(names.map((n) => [n, 0]))
      const queue = []
      let idx = 0
      const dates = [...new Set(sortedRows.map((r) => r.d))]
      for (const d of dates) {
        while (idx < sortedRows.length && sortedRows[idx].d < d) {
          const p = sortedRows[idx++]
          queue.push(p)
          for (const n of names) totals[n] += p.hit[side][n]
          if (queue.length > W) { const q = queue.shift(); for (const n of names) totals[n] -= q.hit[side][n] }
        }
        const best = names.reduce((b, n) => (totals[n] > totals[b] ? n : b), names[0])
        for (const r of sortedRows) if (r.d === d) r.meta[side][`pooledBest${W}`] = queue.length >= 200 ? r.preds[side][best] : r.preds[side].hotAll
        cum.push(best)
      }
    }
  }

  // jodi metas: grid of each open/close meta + direct jodi strategies + per-market best direct jodi
  const jodiNames = Object.keys(rows[0].jodi)
  for (const m of MARKETS) {
    const list = byMarket[m] || []
    list.forEach((r, i) => {
      r.jodiMeta = {}
      for (const metaName of Object.keys(r.meta.open)) {
        const grid = []
        for (const o of r.meta.open[metaName]) for (const c of r.meta.close[metaName]) grid.push(`${o}${c}`)
        r.jodiMeta[`grid:${metaName}`] = grid
      }
      for (const n of names) {
        const grid = []
        for (const o of r.preds.open[n]) for (const c of r.preds.close[n]) grid.push(`${o}${c}`)
        r.jodiMeta[`grid:${n}`] = grid
      }
      for (const n of jodiNames) r.jodiMeta[`direct:${n}`] = r.jodi[n]
      const past = list.slice(Math.max(0, i - 250), i)
      let best = jodiNames[0], bs = -1
      for (const n of jodiNames) { const s = past.reduce((a, p) => a + p.jodiHit[n], 0); if (s > bs) { bs = s; best = n } }
      r.jodiMeta["direct:marketBest250"] = r.jodi[best]
    })
  }
  return rows
}

// ---------------------------------------------------------------- reporting
function summarize(rows, filter) {
  const sel = rows.filter(filter)
  const res = { n: sel.length, open: {}, close: {}, jodi: {} }
  if (!sel.length) return res
  const sides = ["open", "close"]
  for (const side of sides) {
    const keys = [...Object.keys(sel[0].preds[side]).map((k) => `s:${k}`), ...Object.keys(sel[0].meta[side]).map((k) => `m:${k}`)]
    for (const k of keys) {
      const [t, n] = [k.slice(0, 1), k.slice(2)]
      let h = 0
      for (const r of sel) {
        const actual = side === "open" ? r.o : r.c
        const list = t === "s" ? r.preds[side][n] : r.meta[side][n]
        if (list.includes(actual)) h++
      }
      res[side][k] = h
    }
  }
  for (const k of Object.keys(sel[0].jodiMeta)) {
    let h = 0
    for (const r of sel) if (r.jodiMeta[k].includes(`${r.o}${r.c}`)) h++
    res.jodi[k] = h
  }
  return res
}

function productionBaseline(anchor) {
  if (!fs.existsSync(LEDGER_FILE)) return null
  const rep = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"))
  const map = new Map()
  for (const r of rep.ledger) if (!map.has(`${r.market}|${r.isoDate}`)) map.set(`${r.market}|${r.isoDate}`, r)
  void anchor
  return map
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10)
}

function main() {
  const anchor = process.argv[2] || "2026-10-01"
  const A = audit()
  console.log("=== Part A: predictability audit (pooled, all markets, full history) ===")
  for (const [k, v] of Object.entries(A.pooled)) if (v && v.p !== undefined) console.log(`${k.padEnd(22)} n=${v.n} chi2=${v.chi} df=${v.df} p=${v.p}`)
  console.log("open counts ", A.pooled.openCounts.join(" "))
  console.log("close counts", A.pooled.closeCounts.join(" "))
  console.log("diff counts ", A.pooled.diffCounts.join(" "))
  console.log("per-market p-values (open, close, diff, o/c indep, open markov, close markov):")
  for (const [m, v] of Object.entries(A.perMarket)) console.log(`  ${m.padEnd(15)} n=${v.n} ${v.open} ${v.close} ${v.diff} ${v.openCloseIndep} ${v.openMarkov} ${v.closeMarkov}`)

  console.time("walk-forward")
  const result = run()
  console.timeEnd("walk-forward")
  const rows = evaluate(result)
  const prod = productionBaseline(anchor)

  const windows = [
    ["7d", (r) => r.d >= addDays(anchor, -6) && r.d <= anchor],
    ["30d", (r) => r.d >= addDays(anchor, -29) && r.d <= anchor],
    ["90d", (r) => r.d >= addDays(anchor, -89) && r.d <= anchor],
    ["full", () => true],
    ["pre90", (r) => r.d < addDays(anchor, -89)],
  ]
  const summaries = {}
  for (const [name, f] of windows) summaries[name] = summarize(rows, f)

  const show = (name, side, base) => {
    const s = summaries[name]
    const entries = Object.entries(s[side]).sort((a, b) => b[1] - a[1])
    console.log(`\n--- ${side} top-${side === "jodi" ? 36 : 6}, window ${name}, n=${s.n}, random=${(base * 100).toFixed(0)}% ---`)
    for (const [k, h] of entries.slice(0, 12)) console.log(`  ${k.padEnd(34)} ${pct(h, s.n).padStart(6)}  z=${zScore(h, s.n, base).toFixed(2)}`)
    const worst = entries.at(-1)
    console.log(`  (worst) ${worst[0]} ${pct(worst[1], s.n)}`)
  }
  for (const w of ["full", "pre90", "90d"]) { show(w, "open", 0.6); show(w, "close", 0.6); show(w, "jodi", 0.36) }

  // production comparison on identical rows
  if (prod) {
    console.log("\n=== Production vs candidates on identical rows ===")
    for (const [name, f] of windows.slice(0, 3)) {
      const sel = rows.filter(f).filter((r) => prod.has(`${r.m}|${r.d}`))
      let po = 0, pc = 0, pj = 0
      for (const r of sel) {
        const p = prod.get(`${r.m}|${r.d}`).prediction
        if (p.openSuttas.includes(r.o)) po++
        if (p.closeSuttas.includes(r.c)) pc++
        if (p.jodis.includes(`${r.o}${r.c}`)) pj++
      }
      console.log(`${name}: n=${sel.length} production open ${pct(po, sel.length)} close ${pct(pc, sel.length)} jodi ${pct(pj, sel.length)}`)
    }
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify({ anchor, audit: A, summaries }, null, 1))
  console.log(`\nSaved ${OUT_JSON}`)
}

if (require.main === module) main()
module.exports = { DATA, MARKETS, TIMING, buildStrategies, sameDayVisible, buildEvents, tieBreak, topK, rankVector, addDays, zScore, pct, mod10, zeros }
