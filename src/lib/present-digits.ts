import { getRecordISODate, type PanelRecord } from "./db"

export const PRESENT_DIGITS_MODEL_ID = "present-digits-joint-coappearance-v1"
export const PRESENT_DIGITS_MIN_HISTORY = 180
export const PRESENT_DIGITS_LOOKBACK = 180
export const PRESENT_DIGITS_RELIABILITY_WINDOW = 120
export const PRESENT_DIGITS_TARGET_ACCURACY = 0.7

type Side = "open" | "close"

const DIGITS = Array.from({ length: 10 }, (_, digit) => digit)
const PAIRS = DIGITS.flatMap((left) =>
  DIGITS.filter((right) => left < right).map(
    (right) => [left, right] as [number, number],
  ),
)

export interface PresentDigitProbability {
  digit: number
  appearanceProbability: number
}

export interface PresentDigitSidePrediction {
  side: Side
  status: "RESEARCH_ONLY" | "TARGET_REACHED"
  predictedDigits: [number, number]
  jointProbability: number
  digitProbabilities: PresentDigitProbability[]
  historicalReliability: number
  reliabilitySample: number
  wilson95: [number, number]
  supportingModels: Array<{
    name: string
    role: "selected" | "rejected-by-ablation"
  }>
}

export interface PresentDigitsPrediction {
  modelId: typeof PRESENT_DIGITS_MODEL_ID
  market: string
  targetDate: string
  historyUsed: number
  targetAccuracy: typeof PRESENT_DIGITS_TARGET_ACCURACY
  open: PresentDigitSidePrediction
  close: PresentDigitSidePrediction
}

interface SeriesRow {
  isoDate: string
  openPanel: string
  closePanel: string
}

function panelFor(row: SeriesRow, side: Side) {
  return side === "open" ? row.openPanel : row.closePanel
}

function maskFor(panel: string) {
  return [...panel].reduce((mask, value) => {
    const digit = Number(value)
    return Number.isInteger(digit) ? mask | (1 << digit) : mask
  }, 0)
}

function pairHit(pair: [number, number], mask: number) {
  return Boolean(mask & (1 << pair[0])) && Boolean(mask & (1 << pair[1]))
}

function wilson(successes: number, total: number): [number, number] {
  if (!total) return [0, 1]
  const z = 1.959963984540054
  const rate = successes / total
  const denominator = 1 + (z * z) / total
  const center = (rate + (z * z) / (2 * total)) / denominator
  const margin =
    (z *
      Math.sqrt((rate * (1 - rate) + (z * z) / (4 * total)) / total)) /
    denominator
  return [Math.max(0, center - margin), Math.min(1, center + margin)]
}

function forecastPair(masks: number[], end: number) {
  const start = Math.max(0, end - PRESENT_DIGITS_LOOKBACK)
  const counts = PAIRS.map((pair) =>
    masks.slice(start, end).reduce(
      (hits, mask) => hits + Number(pairHit(pair, mask)),
      0,
    ),
  )
  const selectedIndex = counts.reduce(
    (best, count, index) => count > counts[best] ? index : best,
    0,
  )
  return {
    pair: PAIRS[selectedIndex],
    probability: (counts[selectedIndex] + 0.05 * 20) / (end - start + 20),
  }
}

function buildSide(rows: SeriesRow[], side: Side): PresentDigitSidePrediction {
  const masks = rows.map((row) => maskFor(panelFor(row, side)))
  const targetIndex = rows.length
  const forecast = forecastPair(masks, targetIndex)
  const reliabilityStart = Math.max(
    PRESENT_DIGITS_MIN_HISTORY,
    targetIndex - PRESENT_DIGITS_RELIABILITY_WINDOW,
  )
  let hits = 0
  for (let index = reliabilityStart; index < targetIndex; index += 1) {
    hits += Number(pairHit(forecastPair(masks, index).pair, masks[index]))
  }
  const sample = targetIndex - reliabilityStart
  const reliability = sample ? hits / sample : 0
  const digitWindow = masks.slice(
    Math.max(0, targetIndex - PRESENT_DIGITS_LOOKBACK),
  )
  const digitProbabilities = DIGITS.map((digit) => ({
    digit,
    appearanceProbability:
      (digitWindow.reduce(
        (count, mask) => count + Number(Boolean(mask & (1 << digit))),
        0,
      ) + 0.27 * 20) /
      (digitWindow.length + 20),
  }))
  const range = wilson(hits, sample)

  return {
    side,
    status:
      range[0] >= PRESENT_DIGITS_TARGET_ACCURACY
        ? "TARGET_REACHED"
        : "RESEARCH_ONLY",
    predictedDigits: forecast.pair,
    jointProbability: forecast.probability,
    digitProbabilities,
    historicalReliability: reliability,
    reliabilitySample: sample,
    wilson95: range,
    supportingModels: [
      { name: "180-draw joint co-appearance", role: "selected" },
      { name: "avoid appearance marginals", role: "rejected-by-ablation" },
      { name: "panel recency", role: "rejected-by-ablation" },
      { name: "sutta conditioning", role: "rejected-by-ablation" },
      { name: "SP/DP kind conditioning", role: "rejected-by-ablation" },
    ],
  }
}

export function buildPresentDigitsPredictionFromPanels(
  market: string,
  records: PanelRecord[],
  targetDate = new Date(),
): PresentDigitsPrediction | null {
  const targetISO = targetDate.toISOString().slice(0, 10)
  const rows = records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter(
      (item): item is { record: PanelRecord; isoDate: string } =>
        item.isoDate !== null && item.isoDate < targetISO,
    )
    .sort((left, right) => left.isoDate.localeCompare(right.isoDate))
    .map(({ record, isoDate }) => ({
      isoDate,
      openPanel: record.openPanel,
      closePanel: record.closePanel,
    }))

  if (rows.length < PRESENT_DIGITS_MIN_HISTORY) return null
  return {
    modelId: PRESENT_DIGITS_MODEL_ID,
    market,
    targetDate: targetISO,
    historyUsed: rows.length,
    targetAccuracy: PRESENT_DIGITS_TARGET_ACCURACY,
    open: buildSide(rows, "open"),
    close: buildSide(rows, "close"),
  }
}
