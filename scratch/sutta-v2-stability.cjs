/* eslint-disable no-console */
// Stability check for the effects surfaced by sutta-v2-research.cjs.
// Reports elementary repeat/avoid rates and candidate models per chronological block and per market.
const R = require("./sutta-v2-research.cjs")
const { DATA, MARKETS, tieBreak, topK, rankVector, zeros, mod10 } = R

const MIN_TRAIN = 180
const blocks = [["2024-11", "2025-03"], ["2025-03", "2025-07"], ["2025-07", "2025-11"], ["2025-11", "2026-03"], ["2026-03", "2026-07"], ["2026-07", "2026-10-02"]]

// ---- elementary effects: P(x_t == y_{t-1}) vs 10%
const eff = { "o=prevO": [0, 0], "o=prevC": [0, 0], "c=prevC": [0, 0], "c=prevO": [0, 0], "c=o (double)": [0, 0], "o in prev 3 opens": [0, 0], "c in prev 3 closes": [0, 0] }
for (const m of MARKETS) {
  const h = DATA[m]
  for (let i = 3; i < h.length; i++) {
    const r = h[i], p = h[i - 1]
    const add = (k, v) => { eff[k][1]++; if (v) eff[k][0]++ }
    add("o=prevO", r.o === p.o); add("o=prevC", r.o === p.c); add("c=prevC", r.c === p.c); add("c=prevO", r.c === p.o); add("c=o (double)", r.c === r.o)
    add("o in prev 3 opens", new Set([h[i - 1].o, h[i - 2].o, h[i - 3].o]).has(r.o))
    add("c in prev 3 closes", new Set([h[i - 1].c, h[i - 2].c, h[i - 3].c]).has(r.c))
  }
}
console.log("=== Elementary effects (all markets, full history) ===")
for (const [k, [h, n]] of Object.entries(eff)) {
  // expected for "in prev 3": 1 - 0.9^3 approx when 3 distinct... use empirical expectation via shuffle-free approx 0.271
  const p0 = k.includes("prev 3") ? 0.271 : 0.1
  console.log(`${k.padEnd(20)} ${(100 * h / n).toFixed(2)}% (n=${n}) expected ~${(p0 * 100).toFixed(1)}% z=${R.zScore(h, n, p0).toFixed(2)}`)
}

// ---- candidate models
function recencyRank(hist, key) {
  const s = zeros(10).map(() => -1e9)
  for (let i = hist.length - 1; i >= 0; i--) { const d = hist[i][key]; if (s[d] === -1e9) s[d] = -(hist.length - i) }
  return s
}
function ewma(hist, key, a) { const s = zeros(10); for (const r of hist) { for (let d = 0; d < 10; d++) s[d] *= 1 - a; s[r[key]] += a } return s }
function cnt(hist, key, n) { const s = zeros(10); for (let i = Math.max(0, hist.length - n); i < hist.length; i++) s[hist[i][key]]++; return s }
const neg = (v) => v.map((x) => -x)
function borda(vectors, tb) { const t = zeros(10); for (const v of vectors) { const r = rankVector(v, tb); for (let d = 0; d < 10; d++) t[d] += r[d] } return t }

const MODELS = {
  open: {
    recentGap: (h) => recencyRank(h, "o"),
    ewmaFast: (h) => ewma(h, "o", 0.1),
    hot30: (h) => cnt(h, "o", 30),
    recencyBorda: (h, tb) => borda([recencyRank(h, "o"), ewma(h, "o", 0.1), cnt(h, "o", 30)], tb),
  },
  close: {
    avoidLast: (h) => { const s = zeros(10); s[h.at(-1).c] = -1; s[h.at(-1).o] -= 0.5; return s },
    avoidLastClose: (h) => { const s = zeros(10); s[h.at(-1).c] = -1; return s },
    avoidLastOpen: (h) => { const s = zeros(10); s[h.at(-1).o] = -1; return s },
    cold30: (h) => neg(cnt(h, "c", 30)),
    ewmaCold: (h) => neg(ewma(h, "c", 0.1)),
    coldBorda: (h, tb) => borda([neg(cnt(h, "c", 30)), neg(ewma(h, "c", 0.1)), (() => { const s = zeros(10); s[h.at(-1).c] = -1; s[h.at(-1).o] -= 0.5; return s })()], tb),
  },
}

const tally = {} // tally[side][model][block|market] = [h,n]
function add(side, model, key, hit) {
  tally[side] ||= {}; tally[side][model] ||= {}; tally[side][model][key] ||= [0, 0]
  tally[side][model][key][1]++; if (hit) tally[side][model][key][0]++
}
for (const m of MARKETS) {
  const h = DATA[m]
  for (let i = MIN_TRAIN; i < h.length; i++) {
    const r = h[i], hist = h.slice(0, i), tb = tieBreak(`${m}|${r.d}`)
    const block = blocks.findIndex(([a, b]) => r.d >= a && r.d < b)
    const preds = {}
    for (const side of ["open", "close"]) {
      preds[side] = {}
      for (const [name, fn] of Object.entries(MODELS[side])) {
        const top = topK(fn(hist, tb), tb)
        preds[side][name] = top
        const hit = top.includes(side === "open" ? r.o : r.c)
        add(side, name, `B${block}`, hit); add(side, name, m, hit); add(side, name, "ALL", hit)
      }
    }
    for (const on of Object.keys(MODELS.open)) for (const cn of Object.keys(MODELS.close)) {
      const hit = preds.open[on].includes(r.o) && preds.close[cn].includes(r.c)
      add("jodi", `${on} x ${cn}`, `B${block}`, hit); add("jodi", `${on} x ${cn}`, m, hit); add("jodi", `${on} x ${cn}`, "ALL", hit)
    }
  }
}
for (const side of ["open", "close", "jodi"]) {
  const base = side === "jodi" ? 0.36 : 0.6
  console.log(`\n=== ${side}: per chronological block (B0..B5) and ALL; random ${base * 100}% ===`)
  const models = Object.entries(tally[side]).sort((a, b) => b[1].ALL[0] - a[1].ALL[0]).slice(0, side === "jodi" ? 6 : 10)
  for (const [name, t] of models) {
    const cells = blocks.map((_, b) => t[`B${b}`] ? `${(100 * t[`B${b}`][0] / t[`B${b}`][1]).toFixed(1)}` : "-").join(" ")
    const [hh, n] = t.ALL
    const marketsAbove = MARKETS.filter((m) => t[m] && t[m][0] / t[m][1] > base).length
    console.log(`  ${name.padEnd(30)} ALL ${(100 * hh / n).toFixed(1)}% z=${R.zScore(hh, n, base).toFixed(2)} | blocks ${cells} | markets>base ${marketsAbove}/12`)
  }
}
