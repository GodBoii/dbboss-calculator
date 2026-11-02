import { getRecordISODate, type PanelRecord } from "./db"
import type { CombinedChannel } from "./combined-policy"
import { ALL_PANELS, calculateSutta } from "./predictor/panel-utils"

// Fixed retrospective recipes, not the adaptive research controllers.
// The start date reproduces the research feature history; older draws still
// train the unchanged underlying production models.
const FEATURE_HISTORY_START = "2026-07-04"
const SUPPORTED_ANALYSIS_START = "2026-09-08"
const PANEL_DIGITS = ALL_PANELS.map((panel) => [...new Set([...panel].map(Number))])
const PANEL_SUTTAS = ALL_PANELS.map(calculateSutta)

type SelectiveOutputs = {
  kind: "sridevi-open"
  panel: number[]
  sp: number[]
  dp: number[]
  absent: number[]
} | {
  kind: "rajdhani-night-close-sp"
  sp: number[]
}

function adjust(base: readonly number[], scores: readonly number[], strength: number): number[] {
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length
  const centered = scores.map((score) => score - mean)
  const deviation = Math.max(1e-6, Math.sqrt(centered.reduce((sum, score) => sum + score * score, 0) / scores.length))
  const logits = base.map((probability, index) => Math.log(probability)
    + strength * Math.max(-4, Math.min(4, centered[index] / deviation)))
  const maximum = Math.max(...logits)
  const weights = logits.map((value) => Math.exp(value - maximum))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return weights.map((weight) => weight / total)
}

function recentDigitScores(panels: readonly string[], count: number): number[] {
  const history = panels.slice(-count)
  const frequencies = Array<number>(10).fill(0)
  for (const panel of history) {
    for (const digit of new Set([...panel].map(Number))) frequencies[digit] += 1 / history.length
  }
  return PANEL_DIGITS.map((digits) => digits.reduce((sum, digit) => sum + frequencies[digit], 0))
}

/** Resolve only the approved outputs; Sutta/Jodi and full rankings are excluded. */
export function buildSelectiveCombinedOutputs(
  market: string,
  channel: CombinedChannel,
  records: readonly PanelRecord[],
  baselineSp30: readonly number[],
  targetDate: string,
): SelectiveOutputs | null {
  const sridevi = market === "Sridevi" && channel === "open"
  const rajdhani = market === "Rajdhani Night" && channel === "close_pre"
  if ((!sridevi && !rajdhani) || targetDate < SUPPORTED_ANALYSIS_START) return null
  if (baselineSp30.length !== ALL_PANELS.length || baselineSp30.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Selective combined outputs require a positive legal-panel distribution")
  }
  // Records have already been validated, deduplicated, sorted and cut off by
  // buildCombinedAnalysis. Never accept the target draw as a feature.
  const history = records.filter((row) => {
    const iso = getRecordISODate(row)
    return iso !== null && iso >= FEATURE_HISTORY_START && iso < targetDate
  })
  if (!history.length) return null
  if (sridevi) {
    const panels = history.map((row) => row.openPanel)
    const digit90 = adjust(baselineSp30, recentDigitScores(panels, 90), -0.5)
    return {
      kind: "sridevi-open",
      panel: adjust(baselineSp30, recentDigitScores(panels, 7), 0.25),
      sp: digit90,
      dp: digit90,
      absent: digit90,
    }
  }
  const recent = history.slice(-30)
  const frequencies = Array<number>(10).fill(0)
  for (const row of recent) frequencies[calculateSutta(row.closePanel)] += 1 / recent.length
  return { kind: "rajdhani-night-close-sp", sp: adjust(baselineSp30, PANEL_SUTTAS.map((sutta) => frequencies[sutta]), -1) }
}
