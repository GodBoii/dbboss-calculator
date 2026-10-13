const { PANELS, sutta, kind } = require('./two-year-walkforward.cjs')

const NAMES = [
  'production', 'dp_1', 'dp_2', 'dp_3', 'sutta_6', 'sutta_8',
  'sutta_penalty_2', 'sutta_penalty_5', 'sutta_penalty_10',
  'avoid_hard', 'avoid_penalty_10', 'overlap_2', 'overlap_1',
  'sutta_6_dp_1', 'sutta_6_dp_2',
]
const PANEL_SET = new Set(PANELS)

function validateOrder(order) {
  if (order.length !== PANELS.length || new Set(order).size !== PANELS.length || order.some((panel) => !PANEL_SET.has(panel))) {
    throw new Error('Expected a complete order of 220 distinct legal panels')
  }
}

function reserveDp(order, slots) {
  const dp = order.filter((panel) => kind(panel) === 'DP').slice(0, slots)
  const other = order.filter((panel) => kind(panel) !== 'DP').slice(0, 10 - slots)
  const selected = new Set([...dp, ...other])
  if (selected.size !== 10) throw new Error('Insufficient panels for DP allocation')
  return order.filter((panel) => selected.has(panel))
}

function diversify(order, maximum) {
  const selected = []
  const sets = []
  for (const panel of order) {
    const digits = new Set(panel)
    if (sets.every((other) => [...digits].filter((digit) => other.has(digit)).length <= maximum)) {
      selected.push(panel)
      sets.push(digits)
      if (selected.length === 10) return selected
    }
  }
  return [...selected, ...order.filter((panel) => !selected.includes(panel))].slice(0, 10)
}

/** Inputs describe predictions only. No actual target panel enters this function. */
function portfolios({ order, suttas, avoid }) {
  validateOrder(order)
  if (suttas.length !== 10 || new Set(suttas).size !== 10 || suttas.some((digit) => !Number.isInteger(digit) || digit < 0 || digit > 9)) {
    throw new Error('Expected a complete Sutta ranking')
  }
  if (avoid.length !== 2 || new Set(avoid).size !== 2 || avoid.some((digit) => !Number.isInteger(digit) || digit < 0 || digit > 9)) {
    throw new Error('Expected two distinct avoided digits')
  }
  const allowed = (count) => order.filter((panel) => suttas.slice(0, count).includes(sutta(panel)))
  const rerank = (penalty) => order
    .map((panel, rank) => ({ panel, rank, score: rank + penalty(panel) }))
    .sort((a, b) => a.score - b.score || a.rank - b.rank)
    .slice(0, 10).map((row) => row.panel)
  const result = {
    production: order.slice(0, 10),
    dp_1: reserveDp(order, 1), dp_2: reserveDp(order, 2), dp_3: reserveDp(order, 3),
    sutta_6: allowed(6).slice(0, 10), sutta_8: allowed(8).slice(0, 10),
    avoid_hard: order.filter((panel) => avoid.every((digit) => !panel.includes(String(digit)))).slice(0, 10),
    avoid_penalty_10: rerank((panel) => 10 * avoid.filter((digit) => panel.includes(String(digit))).length),
    overlap_2: diversify(order, 2), overlap_1: diversify(order, 1),
    sutta_6_dp_1: reserveDp(allowed(6), 1), sutta_6_dp_2: reserveDp(allowed(6), 2),
  }
  for (const penalty of [2, 5, 10]) result[`sutta_penalty_${penalty}`] = rerank((panel) => penalty * suttas.indexOf(sutta(panel)))
  for (const name of NAMES) {
    if (result[name].length !== 10 || new Set(result[name]).size !== 10) throw new Error(`${name}: wrong panel count`)
  }
  return result
}

function selectWinners(rows, start, end) {
  const selection = rows.filter((row) => row.date >= start && row.date <= end)
  if (!selection.length) throw new Error('No selection events')
  return Object.fromEntries(['open', 'closeLive'].map((side) => {
    const counts = NAMES.map((name) => ({ name, hits: selection.reduce((total, row) => total + row.hits[side][name], 0) }))
    // Stable sort preserves production-first ordering on ties.
    counts.sort((a, b) => b.hits - a.hits)
    return [side, counts[0].name]
  }))
}

module.exports = { NAMES, portfolios, selectWinners }
