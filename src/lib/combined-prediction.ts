import { getRecordISODate, type PanelRecord } from "./db"
import { historicalCutoffISO } from "./prediction-contract"
import { analyzeMarket } from "./predictor/analyze"
import { ALL_PANELS, DOUBLE_PANELS, calculateSutta } from "./predictor/panel-utils"
import { scorePanelsTop10Model } from "./predictor/panel-top10-model"
import { predictDpPanels } from "./predictor/dp-panel-model"
import { buildDpDigitFocus, buildKindPrediction } from "./predictor/scoring"
import type { PanelPick, PredictionResult } from "./predictor/types"
import { buildCloseSuttaRanking, buildOpenSuttaRanking } from "./sutta-model/production"
import { toIstIsoDate } from "./sutta-model/v2-recency"
import type { SuttaPick } from "./sutta-model/types"
import { buildAbsentDigitsPredictionFromPanels } from "./absent-digits"
import { buildPresentDigitsPredictionFromPanels } from "./present-digits"
import { COMBINED_POLICY, type CombinedChannel, type CombinedEndpoint, type CombinationWeights } from "./combined-policy"

export type AnalysisVersion = "v1" | "v2"
const LEGAL = new Set(ALL_PANELS)
const PANEL_INDEX = new Map(ALL_PANELS.map((panel, i) => [panel, i]))
const PAIRS = Array.from({ length: 10 }, (_, a) => Array.from({ length: 9 - a }, (_, offset) => [a, a + offset + 1])).flat()
const DIGITS = ALL_PANELS.map((panel) => [...new Set([...panel].map(Number))])
const SUTTAS = ALL_PANELS.map(calculateSutta)

export interface CombinedSide {
  panelPicks: PanelPick[]
  spPicks: PanelPick[]
  dpPicks: PanelPick[]
  rankedPanels: PanelPick[]
  suttas: SuttaPick[]
  presentDigits: number[]
  absentDigits: number[]
}

export type CombinedAnalysis = {
  status: "ready"
  targetDate: string
  prediction: PredictionResult
  open: CombinedSide
  close: CombinedSide
  knownOpenSutta: number | null
} | { status: "unavailable"; reason: string }

function probabilities(scores: number[]) {
  const maximum = Math.max(...scores)
  const weights = scores.map((score) => Math.exp(score - maximum))
  const total = weights.reduce((sum, value) => sum + value, 0)
  return weights.map((value) => value / total)
}

function logit(value: number) {
  const p = Math.max(1e-6, Math.min(1 - 1e-6, value))
  return Math.log(p) - Math.log1p(-p)
}

function priorHistory(records: PanelRecord[], target: string): PanelRecord[] {
  const cutoff = historicalCutoffISO(target)
  const dated = new Map<string, PanelRecord>()
  for (const row of records) {
    const iso = getRecordISODate(row)
    if (!iso || iso >= target || iso < cutoff || !LEGAL.has(row.openPanel) || !LEGAL.has(row.closePanel)) continue
    const existing = dated.get(iso)
    if (existing && (existing.openPanel !== row.openPanel || existing.closePanel !== row.closePanel)) {
      throw new Error(`Conflicting ${row.market} history on ${iso}`)
    }
    const openSutta = calculateSutta(row.openPanel)
    const closeSutta = calculateSutta(row.closePanel)
    dated.set(iso, { ...row, openSutta, closeSutta, jodi: `${openSutta}${closeSutta}` })
  }
  return [...dated.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row)
}

function suttaProbabilities(picks: SuttaPick[]) {
  const values = Array<number>(10).fill(0)
  for (const pick of picks) values[pick.sutta] = pick.probabilityPct / 100
  return values
}

/** A declared panel is unordered; canonical spelling puts zero last. */
function canonicalPanel(value: string | null) {
  if (!value || !/^\d{3}$/.test(value)) return null
  return [...value].sort((a, b) => (Number(a) || 10) - (Number(b) || 10)).join("")
}

export function buildCombinedAnalysis(
  market: string,
  records: PanelRecord[],
  allMarkets: Record<string, PanelRecord[]>,
  analysisDate = new Date(),
  knownOpenSutta: number | null = null,
  knownOpenPanel: string | null = null,
): CombinedAnalysis {
  let target = toIstIsoDate(analysisDate)
  const explicitOpen = knownOpenSutta !== null || knownOpenPanel !== null
  const today = records.find((row) => getRecordISODate(row) === target)
  if (!explicitOpen && today && LEGAL.has(today.openPanel) && LEGAL.has(today.closePanel)) {
    target = new Date(Date.parse(`${target}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)
  }
  const declaredPanel = explicitOpen ? canonicalPanel(knownOpenPanel)
    : today && getRecordISODate(today) === target && LEGAL.has(today.openPanel) && !LEGAL.has(today.closePanel) ? today.openPanel : null
  const declaredSutta = declaredPanel ? calculateSutta(declaredPanel) : knownOpenSutta
  if (declaredSutta !== null && (!Number.isInteger(declaredSutta) || declaredSutta < 0 || declaredSutta > 9)) {
    return { status: "unavailable", reason: "Enter an Open Sutta from 0 to 9." }
  }
  const date = new Date(`${target}T12:00:00+05:30`)
  let prior: PanelRecord[]
  const priorMarkets: Record<string, PanelRecord[]> = {}
  try {
    prior = priorHistory(records, target)
    for (const [name, history] of Object.entries(allMarkets)) priorMarkets[name] = priorHistory(history, target)
  } catch (error) {
    return { status: "unavailable", reason: error instanceof Error ? error.message : "Unable to validate combined history." }
  }
  priorMarkets[market] = prior
  if (prior.length < 180) return { status: "unavailable", reason: `V2 requires 180 completed draws. ${prior.length} are available.` }
  const base = analyzeMarket(market, prior, priorMarkets, date, { knownOpenPanel: null, includeFullPanelRankings: true })
  const absent = buildAbsentDigitsPredictionFromPanels(market, prior, date)
  const present = buildPresentDigitsPredictionFromPanels(market, prior, date)
  const dp = predictDpPanels(market, prior, priorMarkets, date, { includeProbabilities: true })
  if (!base?.panelRankings || !absent || !present || !dp?.probabilities) {
    return { status: "unavailable", reason: "Not enough complete model inputs for V2." }
  }
  const dpProbabilities = dp.probabilities
  const baseResult = base
  const fullRankings = base.panelRankings
  const absentInputs = absent
  const presentInputs = present
  const openSutta = suttaProbabilities(buildOpenSuttaRanking([], {}, prior, market, date))
  const closeSutta = suttaProbabilities(buildCloseSuttaRanking([], {}, prior, market, null, {}, date))
  const conditionalCounts = Array.from({ length: 10 }, () => Array<number>(10).fill(0))
  const closeCounts = Array<number>(10).fill(0)
  for (const row of prior) { conditionalCounts[row.openSutta][row.closeSutta]++; closeCounts[row.closeSutta]++ }
  const conditional = conditionalCounts.map((row) => {
    const n = row.reduce((sum, value) => sum + value, 0)
    return row.map((count, s) => (count + 100 * (closeCounts[s] + 2) / (prior.length + 20)) / (n + 100))
  })
  const preConditional = closeSutta.map((_, c) => openSutta.reduce((sum, p, o) => sum + p * conditional[o][c], 0))

  function buildSide(channel: CombinedChannel): CombinedSide {
    const side = channel === "open" ? "open" : "close"
    const templates = new Map(fullRankings[side].map((pick) => [pick.panel, pick]))
    const raw = scorePanelsTop10Model(prior, side, baseResult.analysisDayName, channel === "close_known" ? declaredPanel : null)
    const baselineScores = Array<number>(220).fill(0)
    if (raw) for (const row of raw) {
      const index = PANEL_INDEX.get(row.panel)
      if (index === undefined) throw new Error(`Illegal combined panel: ${row.panel}`)
      baselineScores[index] = row.score
    }
    else fullRankings[side].forEach((pick, rank) => {
      const index = PANEL_INDEX.get(pick.panel)
      if (index === undefined) throw new Error(`Illegal combined panel: ${pick.panel}`)
      baselineScores[index] = -rank / 40
    })
    const q = probabilities(baselineScores)
    const nativeSutta = side === "open" ? openSutta : closeSutta
    const conditioned = channel === "open" ? openSutta : declaredSutta === null ? preConditional : conditional[declaredSutta]
    let dedicatedDp = dpProbabilities[side]
    if (side === "close" && declaredPanel) {
      const partial: PanelRecord = { ...prior[prior.length - 1], dateRangeStart: `${target.slice(8)}/${target.slice(5, 7)}/${target.slice(0, 4)}`, day: baseResult.analysisDayName, openPanel: declaredPanel, openSutta: calculateSutta(declaredPanel), closePanel: "", closeSutta: -1, jodi: "" }
      // dateRangeStart must be the week's Monday, matching the storage contract.
      const monday = new Date(`${target}T00:00:00Z`)
      monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7)
      partial.dateRangeStart = `${String(monday.getUTCDate()).padStart(2, "0")}/${String(monday.getUTCMonth() + 1).padStart(2, "0")}/${monday.getUTCFullYear()}`
      partial.id = `${market}|${partial.dateRangeStart}|${partial.day}`
      partial.dateRangeEnd = target
      dedicatedDp = predictDpPanels(market, [...prior, partial], priorMarkets, date, { includeProbabilities: true })?.probabilities?.close ?? dedicatedDp
    }
    function distribution(endpoint: CombinedEndpoint) {
      const policy = COMBINED_POLICY[channel][endpoint]
      const selected = policy.markets[market] ?? policy.weights
      const weights: CombinationWeights = channel === "close_known" && !declaredPanel
        ? { ...selected, conditional_close: Math.max(.25, selected.conditional_close) } : selected
      const adjusted = [...q]
      const dpMass = ALL_PANELS.reduce((sum, panel, i) => sum + (new Set(panel).size === 2 ? q[i] : 0), 0)
      DOUBLE_PANELS.forEach((panel, d) => {
        const index = PANEL_INDEX.get(panel)
        if (index !== undefined) adjusted[index] = (1 - weights.dp_blend) * adjusted[index] + weights.dp_blend * dpMass * dedicatedDp[d]
      })
      const suttaMass = Array<number>(10).fill(0)
      const digitMass = Array<number>(10).fill(0)
      adjusted.forEach((p, i) => { suttaMass[SUTTAS[i]] += p; for (const d of DIGITS[i]) digitMass[d] += p })
      return probabilities(adjusted.map((p, i) => {
        const digits = DIGITS[i]
        const appearance = digits.reduce((sum, d) => sum + logit(absentInputs[side].digitProbabilities[d].appearanceProbability) - logit(digitMass[d]), 0)
        return Math.log(p) + weights.sutta * Math.log(nativeSutta[SUTTAS[i]] / suttaMass[SUTTAS[i]])
          + weights.appearance * appearance
          + Math.log(weights.avoid_multiplier) * absentInputs[side].candidateAvoidDigits.filter((d) => digits.includes(d)).length
          + Math.log(weights.present_multiplier) * presentInputs[side].predictedDigits.filter((d) => digits.includes(d)).length
          + weights.conditional_close * Math.log(conditioned[SUTTAS[i]] / suttaMass[SUTTAS[i]])
      }))
    }
    function ranked(p: number[], kind?: "SP" | "DP") {
      return ALL_PANELS.map((panel, index) => ({ panel, index, probability: p[index] }))
        .filter(({ panel }) => !kind || new Set(panel).size === (kind === "SP" ? 3 : 2))
        .sort((a, b) => b.probability - a.probability || a.index - b.index)
        .map(({ panel, probability }) => {
          const template = templates.get(panel)
          if (!template) throw new Error(`Missing combined panel template: ${panel}`)
          return { ...template, score: Math.min(100, 50 * probability * ALL_PANELS.length), breakdown: { ...template.breakdown } }
        })
    }
    const full = distribution("sp30")
    const suttaMass = Array<number>(10).fill(0)
    full.forEach((p, i) => { suttaMass[SUTTAS[i]] += p })
    const suttas = suttaMass.map((p, sutta) => ({ sutta, probabilityPct: p * 100, score: p * 100, rank: 0 }))
      .sort((a, b) => b.score - a.score || a.sutta - b.sutta).map((pick, index) => ({ ...pick, rank: index + 1 }))
    const pair = (absentPair: boolean) => {
      let best = PAIRS[0], maximum = -1
      for (const candidate of PAIRS) {
        const probability = full.reduce((sum, p, i) => sum + (candidate.every((d) => DIGITS[i].includes(d) !== absentPair) ? p : 0), 0)
        if (probability > maximum) { maximum = probability; best = candidate }
      }
      return [...best]
    }
    return { panelPicks: ranked(distribution("all10")).slice(0, 10), spPicks: ranked(full, "SP").slice(0, 30), dpPicks: ranked(distribution("dp20"), "DP").slice(0, 20), rankedPanels: ranked(full), suttas, presentDigits: pair(false), absentDigits: pair(true) }
  }
  const open = buildSide("open")
  const close = buildSide(declaredSutta === null ? "close_pre" : "close_known")
  const prediction: PredictionResult = { ...base, openPanelPicks: open.panelPicks, closePanelPicks: close.panelPicks,
    openPicks: open.rankedPanels, closePicks: close.rankedPanels,
    openDpPicks: open.dpPicks, closeDpPicks: close.dpPicks,
    openDpDigitFocus: buildDpDigitFocus(open.dpPicks), closeDpDigitFocus: buildDpDigitFocus(close.dpPicks),
    openKindPrediction: buildKindPrediction(open.rankedPanels), closeKindPrediction: buildKindPrediction(close.rankedPanels),
    declaredOpenPanel: declaredPanel, closePanelModel: declaredPanel ? "top10-with-open" : "legacy-pre-open" }
  return { status: "ready", targetDate: target, prediction, open, close, knownOpenSutta: declaredSutta }
}
