import { getRecordISODate, type PanelRecord } from "./db"

export const ABSENT_DIGITS_V2_MODEL_ID = "absent-digits-complementary-online-v2"
export const ABSENT_DIGITS_V2_CALIBRATION_ID = "local-beta-w240-s80-v1"
export const ABSENT_DIGITS_MODEL_ID = "absent-digits-guarded-market-routing-v3"
export const ABSENT_DIGITS_CALIBRATION_ID = "guarded-route-beta-w240-s80-v1"
export const ABSENT_DIGITS_APPEARANCE_BLEND = 0.75
export const ABSENT_DIGITS_MIN_HISTORY = 180
export const ABSENT_DIGITS_HISTORY_LIMIT = 730
export const ABSENT_DIGITS_CONFIDENCE_WINDOW = 240
export const ABSENT_DIGITS_ROUTE_BLEND = 0.35
export const ABSENT_DIGITS_ROUTE_WINDOW = 80
export const ABSENT_DIGITS_ROUTE_RECENT_WINDOW = 40
export const ABSENT_DIGITS_ROUTE_MIN_HISTORY = 60
export const ABSENT_DIGITS_ROUTE_MIN_NET_HITS = 2

const DIGITS = Array.from({ length: 10 }, (_, digit) => digit)
const PAIRS = DIGITS.flatMap((a) =>
  DIGITS.filter((b) => a < b).map((b) => [a, b] as const),
)
const DAY_CODES: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}
const EMA_DECAY = 0.97
const WEIGHT_ETA = 35
const RANDOM_PAIR_BASE = 0.506

type Side = "open" | "close"
type CallStatus = "CALL" | "NO_SAFE_CALL"
type RuntimeMode = "v2" | "v3"
type RouteModelName =
  | "lag_panel_repeat_15"
  | "frequency_saturation_w90"
  | "frequency_hot_w5"
  | "lag_opposite_7"
  | "lag_jodi_transition_1"
  | "position_markov"
  | "frequency_hot_w90"

interface RouteModelSpec {
  name: RouteModelName
}

const MARKET_SIDE_ROUTE_MODELS: Record<
  string,
  Partial<Record<Side, RouteModelSpec>>
> = {
  "Time Bazar": {
    close: { name: "lag_panel_repeat_15" },
  },
  "Milan Day": {
    open: { name: "frequency_saturation_w90" },
    close: { name: "frequency_hot_w5" },
  },
  "Rajdhani Day": {
    close: { name: "lag_opposite_7" },
  },
  Kalyan: {
    close: { name: "lag_jodi_transition_1" },
  },
  "Kalyan Night": {
    open: { name: "position_markov" },
    close: { name: "frequency_saturation_w90" },
  },
  "Main Bazar": {
    close: { name: "frequency_hot_w90" },
  },
}

export interface AbsentDigitRecord {
  isoDate: string
  day: string
  openPanel: string
  closePanel: string
}

export interface AbsentDigitProbability {
  digit: number
  appearanceProbability: number
  absenceProbability: number
}

export interface AbsentDigitContributor {
  family: "appearance" | "absence"
  name: string
  weight: number
}

export interface AbsentDigitSidePrediction {
  side: Side
  status: CallStatus
  candidateAvoidDigits: [number, number]
  appearanceFamilyPair: [number, number]
  absenceFamilyPair: [number, number]
  familyAgreement: boolean
  digitProbabilities: AbsentDigitProbability[]
  mostLikelyDigits: number[]
  confidence: number
  confidenceSample: number
  historicalReliability: number
  reliabilitySample: number
  wilson95: [number, number]
  supportingModels: AbsentDigitContributor[]
  routeModel: "baseline_v2" | RouteModelName
  routeModelApplied: boolean
  routeGuard: {
    historySample: number
    netHits: number
    recentNetHits: number
  }
}

export interface AbsentDigitsPrediction {
  modelId: typeof ABSENT_DIGITS_MODEL_ID | typeof ABSENT_DIGITS_V2_MODEL_ID
  calibrationId:
    | typeof ABSENT_DIGITS_CALIBRATION_ID
    | typeof ABSENT_DIGITS_V2_CALIBRATION_ID
  market: string
  targetDate: string
  appearanceBlendWeight: typeof ABSENT_DIGITS_APPEARANCE_BLEND
  minimumHistory: typeof ABSENT_DIGITS_MIN_HISTORY
  historyUsed: number
  open: AbsentDigitSidePrediction
  close: AbsentDigitSidePrediction
}

interface SeriesRow {
  date: string
  day: string
  openPanel: string
  closePanel: string
}

interface ExpertState {
  appearance: Record<string, number>
  absence: Record<string, number>
}

interface SeriesForecast {
  digitProbability: number[]
  appearanceWeights: Record<string, number>
  absenceWeights: Record<string, number>
  appearancePairIndex: number
  absencePairIndex: number
  blendPairIndex: number
  familyAgreement: boolean
  selectedDigitProbability: number[]
  selectedPairIndex: number
  routeModel: "baseline_v2" | RouteModelName
  routeModelApplied: boolean
  routeGuard: {
    historySample: number
    netHits: number
    recentNetHits: number
  }
}

interface HistoricalForecast {
  hit: boolean
}

interface RouteHistoricalForecast {
  baselineHit: boolean
  candidateHit: boolean
}

function panelMask(panel: string): number {
  let mask = 0
  for (const value of panel) {
    const digit = Number(value)
    if (Number.isInteger(digit) && digit >= 0 && digit <= 9) {
      mask |= 1 << digit
    }
  }
  return mask
}

function panelFor(row: SeriesRow, side: Side) {
  return side === "open" ? row.openPanel : row.closePanel
}

function emptyMatrix(rows: number, columns: number) {
  return Array.from({ length: rows }, () => Array(columns).fill(0) as number[])
}

function cumulative(matrix: number[][]) {
  const columns = matrix[0]?.length ?? 0
  const prefix = emptyMatrix(matrix.length + 1, columns)
  for (let row = 0; row < matrix.length; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      prefix[row + 1][column] = prefix[row][column] + matrix[row][column]
    }
  }
  return prefix
}

function cumulativeVector(values: number[]) {
  const prefix = Array(values.length + 1).fill(0) as number[]
  for (let index = 0; index < values.length; index += 1) {
    prefix[index + 1] = prefix[index] + values[index]
  }
  return prefix
}

function rangeVector(prefix: number[][], start: number, end: number) {
  return prefix[end].map((value, index) => value - prefix[start][index])
}

function smoothedVector(
  prefix: number[][],
  start: number,
  end: number,
  prior: number | number[],
  strength: number,
  total = end - start,
) {
  const count = rangeVector(prefix, start, end)
  return count.map((value, index) => {
    const priorValue = Array.isArray(prior) ? prior[index] : prior
    return (value + priorValue * strength) / (total + strength)
  })
}

function normalizeWeights(losses: Record<string, number>) {
  const best = Math.min(...Object.values(losses))
  const raw = Object.fromEntries(
    Object.entries(losses).map(([name, loss]) => [
      name,
      Math.exp(-WEIGHT_ETA * (loss - best)),
    ]),
  )
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0)
  return Object.fromEntries(
    Object.entries(raw).map(([name, value]) => [name, value / total]),
  )
}

function weightedVectors(
  predictions: Record<string, number[]>,
  weights: Record<string, number>,
) {
  const length = Object.values(predictions)[0].length
  return Array.from({ length }, (_, index) =>
    Object.entries(predictions).reduce(
      (sum, [name, values]) => sum + weights[name] * values[index],
      0,
    ),
  )
}

function digitBrier(probabilities: number[], mask: number) {
  return (
    probabilities.reduce(
      (sum, probability, digit) =>
        sum + (probability - Number(Boolean(mask & (1 << digit)))) ** 2,
      0,
    ) / DIGITS.length
  )
}

function pairBrier(probabilities: number[], mask: number) {
  return (
    probabilities.reduce((sum, probability, index) => {
      const [a, b] = PAIRS[index]
      const actual = Number(!(mask & (1 << a)) && !(mask & (1 << b)))
      return sum + (probability - actual) ** 2
    }, 0) / PAIRS.length
  )
}

function pairHit(pairIndex: number, mask: number) {
  const [a, b] = PAIRS[pairIndex]
  return !(mask & (1 << a)) && !(mask & (1 << b))
}

function betaRate(hits: number, total: number, prior: number, strength: number) {
  return (hits + prior * strength) / (total + strength)
}

function wilson(successes: number, total: number): [number, number] {
  if (total <= 0) return [0, 1]
  const z = 1.959963984540054
  const p = successes / total
  const denominator = 1 + (z * z) / total
  const center = (p + (z * z) / (2 * total)) / denominator
  const margin =
    (z *
      Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) /
    denominator
  return [Math.max(0, center - margin), Math.min(1, center + margin)]
}

function updateEma(
  current: Record<string, number>,
  observed: Record<string, number>,
) {
  for (const [name, value] of Object.entries(observed)) {
    current[name] = EMA_DECAY * current[name] + (1 - EMA_DECAY) * value
  }
}

function pairValue(pairIndex: number): [number, number] {
  const [a, b] = PAIRS[pairIndex]
  return [a, b]
}

function rankedContributors(
  family: "appearance" | "absence",
  weights: Record<string, number>,
) {
  return Object.entries(weights)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([name, weight]) => ({ family, name, weight }))
}

function clampProbability(value: number) {
  return Math.max(0.01, Math.min(0.95, value))
}

function panelDigits(panel: string) {
  return [...panel]
    .map(Number)
    .filter((digit) => Number.isInteger(digit) && digit >= 0 && digit <= 9)
}

function panelSutta(panel: string) {
  return panelDigits(panel).reduce((sum, digit) => sum + digit, 0) % 10
}

function rowJodi(row: SeriesRow) {
  return `${panelSutta(row.openPanel)}${panelSutta(row.closePanel)}`
}

function digitSet(mask: number) {
  return new Set(DIGITS.filter((digit) => Boolean(mask & (1 << digit))))
}

function appearanceFromIndices(
  digitMatrix: number[][],
  indices: number[],
  prior: number[],
  strength: number,
) {
  const counts = Array(10).fill(0) as number[]
  for (const index of indices) {
    for (const digit of DIGITS) counts[digit] += digitMatrix[index][digit]
  }
  return counts.map(
    (count, digit) =>
      (count + prior[digit] * strength) / (indices.length + strength),
  )
}

function anchorDigits(
  prior: number[],
  anchoredDigits: Set<number>,
  bonus = 0.06,
) {
  return prior.map((value, digit) =>
    clampProbability(value + (anchoredDigits.has(digit) ? bonus : 0)),
  )
}

function pairForLowestAppearance(probabilities: number[]) {
  const selected = [...DIGITS]
    .sort(
      (left, right) =>
        probabilities[left] - probabilities[right] || left - right,
    )
    .slice(0, 2)
    .sort((left, right) => left - right)
  return PAIRS.findIndex(
    ([left, right]) => left === selected[0] && right === selected[1],
  )
}

function buildRouteCandidateProbability(
  spec: RouteModelSpec,
  rows: SeriesRow[],
  side: Side,
  index: number,
  masks: number[],
  digitMatrix: number[][],
  digitPrefix: number[][],
) {
  const longStart = Math.max(0, index - ABSENT_DIGITS_HISTORY_LIMIT)
  const long = smoothedVector(
    digitPrefix,
    longStart,
    index,
    Array(10).fill(0.27) as number[],
    36,
  )

  const recentFrequency = (window: number) =>
    smoothedVector(
      digitPrefix,
      Math.max(0, index - window),
      index,
      long,
      12,
    )

  switch (spec.name) {
    case "frequency_hot_w5":
      return recentFrequency(5)
    case "frequency_hot_w90":
      return recentFrequency(90)
    case "frequency_saturation_w90":
      return recentFrequency(90).map((value, digit) =>
        clampProbability(2 * long[digit] - value),
      )
    case "lag_panel_repeat_15": {
      const source = digitSet(masks[index - 15])
      return anchorDigits(long, source)
    }
    case "lag_opposite_7": {
      const source = new Set(
        [...digitSet(masks[index - 7])].map((digit) => (digit + 5) % 10),
      )
      return anchorDigits(long, source)
    }
    case "lag_jodi_transition_1": {
      const sourceJodi = rowJodi(rows[index - 1])
      const selected = []
      for (let candidate = Math.max(1, longStart); candidate < index; candidate += 1) {
        if (rowJodi(rows[candidate - 1]) === sourceJodi) selected.push(candidate)
      }
      return appearanceFromIndices(digitMatrix, selected, long, 45)
    }
    case "position_markov": {
      const previous = panelDigits(panelFor(rows[index - 1], side))
      const combined = Array(10).fill(0) as number[]
      for (let position = 0; position < 3; position += 1) {
        const selected = []
        for (
          let candidate = Math.max(1, longStart);
          candidate < index;
          candidate += 1
        ) {
          const candidatePrevious = panelDigits(
            panelFor(rows[candidate - 1], side),
          )
          if (candidatePrevious[position] === previous[position]) {
            selected.push(candidate)
          }
        }
        const rates = appearanceFromIndices(digitMatrix, selected, long, 24)
        for (const digit of DIGITS) combined[digit] += rates[digit] / 3
      }
      return combined
    }
  }
}

function routeGuard(history: RouteHistoricalForecast[]) {
  const selected = history.slice(-ABSENT_DIGITS_ROUTE_WINDOW)
  const recent = selected.slice(-ABSENT_DIGITS_ROUTE_RECENT_WINDOW)
  const netHits = selected.reduce(
    (sum, row) => sum + Number(row.candidateHit) - Number(row.baselineHit),
    0,
  )
  const recentNetHits = recent.reduce(
    (sum, row) => sum + Number(row.candidateHit) - Number(row.baselineHit),
    0,
  )
  return {
    applied:
      selected.length >= ABSENT_DIGITS_ROUTE_MIN_HISTORY &&
      netHits >= ABSENT_DIGITS_ROUTE_MIN_NET_HITS &&
      recentNetHits >= 0,
    historySample: selected.length,
    netHits,
    recentNetHits,
  }
}

function buildSidePrediction(
  rows: SeriesRow[],
  side: Side,
  market: string,
  mode: RuntimeMode,
): AbsentDigitSidePrediction {
  const targetIndex = rows.length - 1
  const masks = rows.map((row, index) =>
    index === targetIndex ? 0 : panelMask(panelFor(row, side)),
  )
  const digitMatrix = emptyMatrix(rows.length, DIGITS.length)
  const pairMatrix = emptyMatrix(rows.length, PAIRS.length)
  for (let row = 0; row < targetIndex; row += 1) {
    for (const digit of DIGITS) {
      digitMatrix[row][digit] = Number(Boolean(masks[row] & (1 << digit)))
    }
    for (let pairIndex = 0; pairIndex < PAIRS.length; pairIndex += 1) {
      pairMatrix[row][pairIndex] = Number(pairHit(pairIndex, masks[row]))
    }
  }

  const digitPrefix = cumulative(digitMatrix)
  const pairPrefix = cumulative(pairMatrix)
  const dayCodes = rows.map((row) => DAY_CODES[row.day] ?? 0)
  const weekdayDigitPrefix: number[][][] = []
  const weekdayPairPrefix: number[][][] = []
  const weekdayCountPrefix: number[][] = []
  for (let dayCode = 0; dayCode < 7; dayCode += 1) {
    const selected = dayCodes.map((value) => Number(value === dayCode))
    weekdayCountPrefix.push(cumulativeVector(selected))
    weekdayDigitPrefix.push(
      cumulative(
        digitMatrix.map((values, index) =>
          values.map((value) => value * selected[index]),
        ),
      ),
    )
    weekdayPairPrefix.push(
      cumulative(
        pairMatrix.map((values, index) =>
          values.map((value) => value * selected[index]),
        ),
      ),
    )
  }

  const previousKind = Array(rows.length).fill(0) as number[]
  for (let index = 1; index < rows.length; index += 1) {
    const unique = masks[index - 1].toString(2).replace(/0/g, "").length
    previousKind[index] = unique === 1 ? 0 : unique === 2 ? 1 : 2
  }
  const kindDigitPrefix: number[][][] = []
  const kindCountPrefix: number[][] = []
  for (let kind = 0; kind < 3; kind += 1) {
    const selected = previousKind.map((value) => Number(value === kind))
    kindCountPrefix.push(cumulativeVector(selected))
    kindDigitPrefix.push(
      cumulative(
        digitMatrix.map((values, index) =>
          values.map((value) => value * selected[index]),
        ),
      ),
    )
  }

  const previousPairAbsent = emptyMatrix(rows.length, PAIRS.length)
  for (let index = 1; index < rows.length; index += 1) {
    previousPairAbsent[index] = [...pairMatrix[index - 1]]
  }
  const previousAbsentPrefix = cumulative(previousPairAbsent)
  const previousAbsentHitPrefix = cumulative(
    previousPairAbsent.map((values, row) =>
      values.map((value, pairIndex) => value * pairMatrix[row][pairIndex]),
    ),
  )

  const losses: ExpertState = {
    appearance: {
      appearance_long: 0.2,
      appearance_30: 0.2,
      appearance_90: 0.2,
      appearance_weekday: 0.2,
      appearance_prev_kind: 0.2,
    },
    absence: {
      absence_long: 0.25,
      absence_30: 0.25,
      absence_90: 0.25,
      absence_weekday: 0.25,
      absence_transition: 0.25,
    },
  }
  const historical: HistoricalForecast[] = []
  const routeHistorical: RouteHistoricalForecast[] = []
  const routeSpec =
    mode === "v3" ? MARKET_SIDE_ROUTE_MODELS[market]?.[side] : undefined
  let targetForecast: SeriesForecast | null = null

  for (let index = ABSENT_DIGITS_MIN_HISTORY; index <= targetIndex; index += 1) {
    const longStart = Math.max(0, index - ABSENT_DIGITS_HISTORY_LIMIT)
    const base = smoothedVector(
      digitPrefix,
      longStart,
      index,
      Array(10).fill(0.27) as number[],
      30,
    )
    const dayCode = dayCodes[index]
    const weekdayTotal =
      weekdayCountPrefix[dayCode][index] -
      weekdayCountPrefix[dayCode][longStart]
    const weekdayDigits = rangeVector(
      weekdayDigitPrefix[dayCode],
      longStart,
      index,
    ).map(
      (value, digit) => (value + base[digit] * 18) / (weekdayTotal + 18),
    )
    const weekdayPairs = rangeVector(
      weekdayPairPrefix[dayCode],
      longStart,
      index,
    ).map(
      (value) => (value + RANDOM_PAIR_BASE * 18) / (weekdayTotal + 18),
    )
    const kind = previousKind[index]
    const kindTotal =
      kindCountPrefix[kind][index] - kindCountPrefix[kind][longStart]
    const kindDigits = rangeVector(
      kindDigitPrefix[kind],
      longStart,
      index,
    ).map((value, digit) => (value + base[digit] * 20) / (kindTotal + 20))

    const appearanceExperts: Record<string, number[]> = {
      appearance_long: base,
      appearance_30: smoothedVector(
        digitPrefix,
        Math.max(0, index - 30),
        index,
        base,
        12,
      ),
      appearance_90: smoothedVector(
        digitPrefix,
        Math.max(0, index - 90),
        index,
        base,
        12,
      ),
      appearance_weekday: weekdayDigits,
      appearance_prev_kind: kindDigits,
    }
    const longPairs = smoothedVector(
      pairPrefix,
      longStart,
      index,
      RANDOM_PAIR_BASE,
      30,
    )
    const stateOneTotal = rangeVector(
      previousAbsentPrefix,
      longStart,
      index,
    )
    const stateOneHits = rangeVector(
      previousAbsentHitPrefix,
      longStart,
      index,
    )
    const allHits = rangeVector(pairPrefix, longStart, index)
    const windowTotal = index - longStart
    const transition = PAIRS.map((_, pairIndex) => {
      const previousState = Boolean(previousPairAbsent[index][pairIndex])
      const total = previousState
        ? stateOneTotal[pairIndex]
        : windowTotal - stateOneTotal[pairIndex]
      const hits = previousState
        ? stateOneHits[pairIndex]
        : allHits[pairIndex] - stateOneHits[pairIndex]
      return (hits + RANDOM_PAIR_BASE * 20) / (total + 20)
    })
    const absenceExperts: Record<string, number[]> = {
      absence_long: longPairs,
      absence_30: smoothedVector(
        pairPrefix,
        Math.max(0, index - 30),
        index,
        RANDOM_PAIR_BASE,
        12,
      ),
      absence_90: smoothedVector(
        pairPrefix,
        Math.max(0, index - 90),
        index,
        RANDOM_PAIR_BASE,
        12,
      ),
      absence_weekday: weekdayPairs,
      absence_transition: transition,
    }

    const appearanceWeights = normalizeWeights(losses.appearance)
    const absenceWeights = normalizeWeights(losses.absence)
    const digitProbability = weightedVectors(
      appearanceExperts,
      appearanceWeights,
    )
    const rawAppearancePairs = PAIRS.map(
      ([a, b]) => (1 - digitProbability[a]) * (1 - digitProbability[b]),
    )
    const correctedAppearancePairs = rawAppearancePairs.map(
      (value, pairIndex) => {
        const [a, b] = PAIRS[pairIndex]
        const independent = Math.max(
          1e-6,
          (1 - base[a]) * (1 - base[b]),
        )
        const dependence = Math.max(
          0.75,
          Math.min(1.25, longPairs[pairIndex] / independent),
        )
        return Math.max(0, Math.min(1, value * dependence))
      },
    )
    const absenceProbability = weightedVectors(
      absenceExperts,
      absenceWeights,
    )
    const appearancePairIndex = correctedAppearancePairs.reduce(
      (best, value, pairIndex) =>
        value > correctedAppearancePairs[best] ? pairIndex : best,
      0,
    )
    const absencePairIndex = absenceProbability.reduce(
      (best, value, pairIndex) =>
        value > absenceProbability[best] ? pairIndex : best,
      0,
    )
    const blendScores = correctedAppearancePairs.map(
      (value, pairIndex) =>
        ABSENT_DIGITS_APPEARANCE_BLEND * value +
        (1 - ABSENT_DIGITS_APPEARANCE_BLEND) *
          absenceProbability[pairIndex],
    )
    const blendPairIndex = blendScores.reduce(
      (best, value, pairIndex) =>
        value > blendScores[best] ? pairIndex : best,
      0,
    )
    const routeCandidateProbability = routeSpec
      ? buildRouteCandidateProbability(
          routeSpec,
          rows,
          side,
          index,
          masks,
          digitMatrix,
          digitPrefix,
        )
      : digitProbability
    const adjustedRouteProbability = digitProbability.map(
      (value, digit) =>
        (1 - ABSENT_DIGITS_ROUTE_BLEND) * value +
        ABSENT_DIGITS_ROUTE_BLEND * routeCandidateProbability[digit],
    )
    const routePairIndex = pairForLowestAppearance(adjustedRouteProbability)
    const guard = routeSpec
      ? routeGuard(routeHistorical)
      : {
          applied: false,
          historySample: 0,
          netHits: 0,
          recentNetHits: 0,
        }
    const selectedPairIndex =
      routeSpec && guard.applied ? routePairIndex : blendPairIndex
    const selectedDigitProbability =
      routeSpec && guard.applied
        ? adjustedRouteProbability
        : digitProbability
    const forecast: SeriesForecast = {
      digitProbability,
      appearanceWeights,
      absenceWeights,
      appearancePairIndex,
      absencePairIndex,
      blendPairIndex,
      familyAgreement: appearancePairIndex === absencePairIndex,
      selectedDigitProbability,
      selectedPairIndex,
      routeModel: routeSpec?.name ?? "baseline_v2",
      routeModelApplied: Boolean(routeSpec && guard.applied),
      routeGuard: {
        historySample: guard.historySample,
        netHits: guard.netHits,
        recentNetHits: guard.recentNetHits,
      },
    }

    if (index === targetIndex) {
      targetForecast = forecast
      continue
    }

    const actualMask = masks[index]
    const baselineHit = pairHit(blendPairIndex, actualMask)
    const candidateHit = pairHit(routePairIndex, actualMask)
    historical.push({ hit: pairHit(selectedPairIndex, actualMask) })
    if (routeSpec) routeHistorical.push({ baselineHit, candidateHit })
    updateEma(
      losses.appearance,
      Object.fromEntries(
        Object.entries(appearanceExperts).map(([name, probabilities]) => [
          name,
          digitBrier(probabilities, actualMask),
        ]),
      ),
    )
    updateEma(
      losses.absence,
      Object.fromEntries(
        Object.entries(absenceExperts).map(([name, probabilities]) => [
          name,
          pairBrier(probabilities, actualMask),
        ]),
      ),
    )
  }

  if (!targetForecast) {
    throw new Error("Unable to build absent-digits forecast")
  }
  const confidenceRows = historical.slice(-ABSENT_DIGITS_CONFIDENCE_WINDOW)
  const confidenceHits = confidenceRows.filter((row) => row.hit).length
  const confidence = betaRate(
    confidenceHits,
    confidenceRows.length,
    RANDOM_PAIR_BASE,
    80,
  )
  const reliabilityRows = historical.slice(-120)
  const reliabilityHits = reliabilityRows.filter((row) => row.hit).length
  const sample = reliabilityRows.length
  const historicalReliability = sample ? reliabilityHits / sample : 0
  const interval = wilson(reliabilityHits, sample)
  const status: CallStatus =
    sample >= 30 && interval[0] >= 0.8 ? "CALL" : "NO_SAFE_CALL"
  const rankedDigits = [...DIGITS].sort(
    (left, right) =>
      targetForecast.selectedDigitProbability[right] -
        targetForecast.selectedDigitProbability[left] || left - right,
  )

  return {
    side,
    status,
    candidateAvoidDigits: pairValue(targetForecast.selectedPairIndex),
    appearanceFamilyPair: pairValue(targetForecast.appearancePairIndex),
    absenceFamilyPair: pairValue(targetForecast.absencePairIndex),
    familyAgreement: targetForecast.familyAgreement,
    digitProbabilities: DIGITS.map((digit) => ({
      digit,
      appearanceProbability: targetForecast.selectedDigitProbability[digit],
      absenceProbability: 1 - targetForecast.selectedDigitProbability[digit],
    })),
    mostLikelyDigits: rankedDigits.slice(0, 5),
    confidence,
    confidenceSample: confidenceRows.length,
    historicalReliability,
    reliabilitySample: sample,
    wilson95: interval,
    supportingModels: [
      ...rankedContributors("appearance", targetForecast.appearanceWeights),
      ...rankedContributors("absence", targetForecast.absenceWeights),
    ],
    routeModel: targetForecast.routeModel,
    routeModelApplied: targetForecast.routeModelApplied,
    routeGuard: targetForecast.routeGuard,
  }
}

function normalizeRows(
  records: readonly AbsentDigitRecord[],
  targetDate: string,
) {
  const cutoff = new Date(`${targetDate}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - ABSENT_DIGITS_HISTORY_LIMIT + 1)
  const cutoffISO = cutoff.toISOString().slice(0, 10)
  const valid = records
    .filter(
      (record) =>
        record.isoDate < targetDate &&
        record.isoDate >= cutoffISO &&
        /^\d{3}$/.test(record.openPanel) &&
        /^\d{3}$/.test(record.closePanel),
    )
    .sort((left, right) => left.isoDate.localeCompare(right.isoDate))
  const deduplicated = new Map(valid.map((record) => [record.isoDate, record]))
  return [...deduplicated.values()]
}

function buildAbsentDigitsPredictionInternal(
  market: string,
  records: readonly AbsentDigitRecord[],
  targetDate: string,
  targetDay: string,
  mode: RuntimeMode,
): AbsentDigitsPrediction | null {
  const historical = normalizeRows(records, targetDate)
  if (historical.length < ABSENT_DIGITS_MIN_HISTORY) return null
  const rows: SeriesRow[] = [
    ...historical.map((record) => ({
      date: record.isoDate,
      day: record.day,
      openPanel: record.openPanel,
      closePanel: record.closePanel,
    })),
    {
      date: targetDate,
      day: targetDay,
      openPanel: "",
      closePanel: "",
    },
  ]
  const isV3 = mode === "v3"
  return {
    modelId: isV3 ? ABSENT_DIGITS_MODEL_ID : ABSENT_DIGITS_V2_MODEL_ID,
    calibrationId: isV3
      ? ABSENT_DIGITS_CALIBRATION_ID
      : ABSENT_DIGITS_V2_CALIBRATION_ID,
    market,
    targetDate,
    appearanceBlendWeight: ABSENT_DIGITS_APPEARANCE_BLEND,
    minimumHistory: ABSENT_DIGITS_MIN_HISTORY,
    historyUsed: historical.length,
    open: buildSidePrediction(rows, "open", market, mode),
    close: buildSidePrediction(rows, "close", market, mode),
  }
}

export function buildAbsentDigitsPrediction(
  market: string,
  records: readonly AbsentDigitRecord[],
  targetDate: string,
  targetDay: string,
) {
  return buildAbsentDigitsPredictionInternal(
    market,
    records,
    targetDate,
    targetDay,
    "v3",
  )
}

export function buildAbsentDigitsPredictionV3(
  market: string,
  records: readonly AbsentDigitRecord[],
  targetDate: string,
  targetDay: string,
) {
  return buildAbsentDigitsPredictionInternal(
    market,
    records,
    targetDate,
    targetDay,
    "v3",
  )
}

export function buildAbsentDigitsPredictionV2(
  market: string,
  records: readonly AbsentDigitRecord[],
  targetDate: string,
  targetDay: string,
) {
  return buildAbsentDigitsPredictionInternal(
    market,
    records,
    targetDate,
    targetDay,
    "v2",
  )
}

function istTarget(dateValue: Date) {
  const shifted = new Date(dateValue.getTime() + 330 * 60 * 1000)
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]
  return {
    isoDate: shifted.toISOString().slice(0, 10),
    day: names[shifted.getUTCDay()],
  }
}

export function buildAbsentDigitsPredictionFromPanels(
  market: string,
  records: readonly PanelRecord[],
  analysisDate = new Date(),
) {
  const target = istTarget(analysisDate)
  const normalized = records
    .map((record) => ({
      isoDate: getRecordISODate(record),
      day: record.day,
      openPanel: record.openPanel,
      closePanel: record.closePanel,
    }))
    .filter(
      (
        record,
      ): record is {
        isoDate: string
        day: string
        openPanel: string
        closePanel: string
      } => Boolean(record.isoDate),
    )
  return buildAbsentDigitsPrediction(
    market,
    normalized,
    target.isoDate,
    target.day,
  )
}
