const ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
const PANELS = ORDER.flatMap((a, i) => ORDER.slice(i).flatMap((b, j) => ORDER.slice(i + j).map((c) => `${a}${b}${c}`)))
const INDEX = new Map(PANELS.map((panel, i) => [panel, i]))
const PAIRS = Array.from({ length: 10 }, (_, a) => Array.from({ length: 9 - a }, (_, b) => [a, a + b + 1])).flat()
const NAMES = ['frequency_all', 'frequency_30', 'frequency_90', 'frequency_180', 'decay_45', 'pooled_50', 'weekday_20', 'transition_20']
const sutta = (panel) => [...panel].reduce((sum, digit) => sum + Number(digit), 0) % 10
const kind = (panel) => ['TP', 'DP', 'SP'][new Set(panel).size - 1]
const normalize = (values) => { const total = values.reduce((a, b) => a + b, 0); return values.map((value) => value / total) }
const rank = (values) => values.map((value, i) => ({ value, i })).sort((a, b) => b.value - a.value || a.i - b.i).map(({ i }) => i)

function distribution(rows, side, halfLife = null) {
  const counts = Array(PANELS.length).fill(1 / PANELS.length)
  rows.forEach((row, i) => { counts[INDEX.get(row[`${side}Panel`])] += halfLife ? 2 ** (-(rows.length - 1 - i) / halfLife) : 1 })
  return normalize(counts)
}

function blendConditional(base, rows, side, strength) {
  const counts = base.map((value) => value * strength)
  for (const row of rows) counts[INDEX.get(row[`${side}Panel`])] += 1
  return normalize(counts)
}

function summarizeDistribution(probabilities) {
  const digit = Array(10).fill(0)
  let dpProbability = 0
  probabilities.forEach((probability, i) => {
    digit[sutta(PANELS[i])] += probability
    if (kind(PANELS[i]) === 'DP') dpProbability += probability
  })
  const absent = PAIRS.map((pair) => probabilities.reduce((sum, probability, i) => sum + (pair.every((digit) => !PANELS[i].includes(String(digit))) ? probability : 0), 0))
  const panelIDs = rank(probabilities).slice(0, 10)
  const suttas = rank(digit).slice(0, 6)
  const pairID = rank(absent)[0]
  return {
    panels: panelIDs.map((i) => PANELS[i]), suttas, avoid: PAIRS[pairID], dpProbability,
    panelConfidence: panelIDs.reduce((sum, i) => sum + probabilities[i], 0),
    suttaConfidence: suttas.reduce((sum, i) => sum + digit[i], 0), avoidConfidence: absent[pairID],
  }
}

function predictions(prior, pooled, weekday, knownOpen = null) {
  const result = Object.fromEntries(NAMES.map((name) => [name, {}]))
  for (const side of ['open', 'close']) {
    const base = distribution(prior, side)
    const previousSutta = sutta(prior.at(-1)[`${side}Panel`])
    const matchingTransitions = prior.filter((_, i) => i > 0 && sutta(prior[i - 1][`${side}Panel`]) === previousSutta)
    const pooledBase = distribution(pooled, side)
    const variants = {
      frequency_all: base,
      frequency_30: distribution(prior.slice(-30), side),
      frequency_90: distribution(prior.slice(-90), side),
      frequency_180: distribution(prior.slice(-180), side),
      decay_45: distribution(prior, side, 45),
      pooled_50: blendConditional(pooledBase, prior, side, 50),
      weekday_20: blendConditional(base, prior.filter((row) => row.day === weekday), side, 20),
      transition_20: blendConditional(base, matchingTransitions, side, 20),
    }
    for (const name of NAMES) {
      result[name][side] = summarizeDistribution(variants[name])
      if (side === 'close' && knownOpen !== null) {
        const matching = prior.filter((row) => sutta(row.openPanel) === sutta(knownOpen))
        result[name].closeLive = summarizeDistribution(blendConditional(variants[name], matching, 'close', 20))
      }
    }
  }
  return result
}

function score(actual, prediction) {
  const result = {}
  for (const side of ['open', 'close', 'closeLive']) {
    const panel = actual[side === 'open' ? 'openPanel' : 'closePanel']
    const pick = prediction[side]
    if (!pick) continue
    result[`${side}Panel`] = Number(pick.panels.includes(panel))
    result[`${side}Sutta`] = Number(pick.suttas.includes(sutta(panel)))
    if (side !== 'closeLive') {
      result[`${side}Avoid`] = Number(pick.avoid.every((digit) => !panel.includes(String(digit))))
      result[`${side}DpBrier`] = (pick.dpProbability - Number(kind(panel) === 'DP')) ** 2
    }
  }
  result.jodi = result.openSutta * result.closeSutta
  return result
}

function selectWinners(ledger, start, end) {
  const rows = ledger.filter((row) => row.date >= start && row.date <= end)
  if (!rows.length) throw new Error('No selection events')
  const tasks = Object.keys(rows[0].scores[NAMES[0]])
  return Object.fromEntries(tasks.map((task) => {
    const values = NAMES.map((name) => ({ name, value: rows.reduce((sum, row) => sum + row.scores[name][task], 0) / rows.length }))
    values.sort((a, b) => task.endsWith('Brier') ? a.value - b.value || a.name.localeCompare(b.name) : b.value - a.value || a.name.localeCompare(b.name))
    return [task, values[0].name]
  }))
}

function pairedInterval(rows, task, candidate, iterations = 3000) {
  const lowerIsBetter = task.endsWith('Brier')
  const grouped = new Map()
  for (const row of rows) {
    const day = grouped.get(row.date) || { n: 0, difference: 0 }
    day.n++
    const difference = row.scores[candidate][task] - row.scores.production[task]
    day.difference += lowerIsBetter ? -difference : difference
    grouped.set(row.date, day)
  }
  const days = [...grouped.values()]
  if (!days.length) return { lift: null, interval95: null }
  let seed = 1729
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const samples = Array.from({ length: iterations }, () => {
    let difference = 0, n = 0
    for (let i = 0; i < days.length; i++) { const day = days[Math.floor(random() * days.length)]; difference += day.difference; n += day.n }
    return difference / n
  }).sort((a, b) => a - b)
  return { lift: days.reduce((sum, day) => sum + day.difference, 0) / rows.length, interval95: [samples[Math.floor(iterations * 0.025)], samples[Math.floor(iterations * 0.975)]], dates: days.length }
}

module.exports = { PANELS, INDEX, NAMES, sutta, kind, predictions, score, selectWinners, pairedInterval }
