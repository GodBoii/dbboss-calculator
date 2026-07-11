import { getSuttaSignal } from "../predictor"
import type { SuttaPick } from "./types"

export function applyRankProbabilities(items: SuttaPick[]): SuttaPick[] {
  if (items.length === 0) return []
  // Convert the model score into a conservative relative rating. Temperature
  // limits overconfidence while ensuring that the displayed rating and rank
  // are produced from the same score.
  const maxScore = Math.max(...items.map((item) => item.score))
  const weights = items.map((item) => Math.exp((item.score - maxScore) / 100))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return items.map((item, index) => ({
    ...item,
    rank: index + 1,
    probabilityPct: (weights[index] / total) * 100,
  }))
}

export function smoothedRate(observed: number, total: number, alpha = 2) {
  return (observed + alpha) / (total + alpha * 10)
}

export function rankStatisticalSuttas(
  rows: Array<{ sutta: number; score: number }>,
  droughts: Record<string, number>,
  count: number,
): SuttaPick[] {
  const ranked = rows
    .map((row) => {
      const signal = getSuttaSignal(droughts[String(row.sutta)] ?? 1000)
      return {
        sutta: row.sutta,
        rank: 0,
        score: row.score * 100,
        probabilityPct: 0,
        signalColor: signal.color,
        signalLabel: signal.label,
        signalState: signal.state,
        isFresh: signal.state === "fresh",
        isSnapback: signal.state === "snapback",
      }
    })
    .sort((a, b) => b.score - a.score || a.sutta - b.sutta)
  return applyRankProbabilities(ranked).slice(0, count)
}

export function digitRates(values: number[], alpha = 2) {
  const counts = Array(10).fill(0) as number[]
  for (const value of values) {
    if (value >= 0 && value <= 9) counts[value]++
  }
  return counts.map((observed) => smoothedRate(observed, values.length, alpha))
}
