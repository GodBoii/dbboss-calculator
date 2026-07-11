import type { PanelRecord } from "../db"
import { rankStatisticalSuttas, digitRates, smoothedRate } from "./shared"
import type { SuttaPick } from "./types"

type AdjustedCloseTop6Model =
  | "recent-30-cold"
  | "known-open"
  | "known-open-bayes"
  | "lag-7-opposite"
  | "known-open4-lag7-opposite"

const ADJUSTED_CLOSE_TOP6_MODELS: Partial<Record<string, AdjustedCloseTop6Model>> = {
  "Madhur Day": "recent-30-cold",
  "Rajdhani Day": "known-open4-lag7-opposite",
  "Kalyan Night": "known-open",
  "Madhur Night": "recent-30-cold",
  "Milan Night": "recent-30-cold",
  "Rajdhani Night": "recent-30-cold",
}

export function buildAdjustedCloseTop6Model(input: {
  marketName: string
  records: PanelRecord[]
  droughts: Record<string, number>
  count: number
  currentOpenSutta: number | null
  targetDate: Date
}): SuttaPick[] | null {
  const { marketName, records, droughts, count, currentOpenSutta, targetDate } = input
  if (count !== 6 || currentOpenSutta === null || currentOpenSutta < 0) return null
  const model = ADJUSTED_CLOSE_TOP6_MODELS[marketName]
  if (!model) return null
  const closeRecords = records.filter((record) => record.closePanel && record.closeSutta >= 0)
  if (closeRecords.length < 50) return null

  if (model === "recent-30-cold") {
    const recent = closeRecords.slice(-30)
    const counts = Array(10).fill(0) as number[]
    for (const record of recent) counts[record.closeSutta]++
    return rankStatisticalSuttas(
      counts.map((observed, sutta) => ({ sutta, score: -smoothedRate(observed, recent.length) })),
      droughts,
      count,
    )
  }

  if (model === "lag-7-opposite") {
    const values = closeRecords.map((record) => record.closeSutta)
    const lagged = values.at(-7)
    if (lagged === undefined) return null
    const anchor = (lagged + 5) % 10
    const long = digitRates(values)
    return rankStatisticalSuttas(
      long.map((rate, sutta) => ({
        sutta,
        // Shrink the seven-draw opposite echo toward the market's full
        // historical distribution. The small bonus was frozen before the
        // final 30-day audit and avoids turning one digit into a hard rule.
        score: rate + (sutta === anchor ? 0.045 : 0),
      })),
      droughts,
      count,
    )
  }

  const conditionalValues = closeRecords
    .filter((record) => record.openSutta === currentOpenSutta)
    .map((record) => record.closeSutta)
  const conditional = digitRates(conditionalValues, 1.5)
  if (model === "known-open") {
    return rankStatisticalSuttas(
      conditional.map((score, sutta) => ({ sutta, score })),
      droughts,
      count,
    )
  }

  const allValues = closeRecords.map((record) => record.closeSutta)
  const long = digitRates(allValues)
  const recent60 = digitRates(allValues.slice(-60))
  const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][targetDate.getDay()]
  const weekday = digitRates(
    closeRecords.filter((record) => record.day === dayName).map((record) => record.closeSutta),
    2.5,
  )
  const deltaCounts = Array(10).fill(0) as number[]
  for (let index = 1; index < closeRecords.length; index++) {
    deltaCounts[(closeRecords[index].closeSutta - closeRecords[index - 1].closeSutta + 10) % 10]++
  }
  const previousClose = closeRecords.at(-1)?.closeSutta ?? 0
  const deltaTotal = Math.max(1, closeRecords.length - 1)
  const conditionalWeight = Math.min(0.55, conditionalValues.length / 90)

  const bayesianRows = Array.from({ length: 10 }, (_, sutta) => ({
      sutta,
      score:
        (0.34 - conditionalWeight * 0.25) * long[sutta] +
        0.2 * recent60[sutta] +
        0.14 * weekday[sutta] +
        conditionalWeight * conditional[sutta] +
        0.12 * smoothedRate(deltaCounts[(sutta - previousClose + 10) % 10], deltaTotal),
    }))

  if (model === "known-open4-lag7-opposite") {
    const lagged = allValues.at(-7)
    if (lagged === undefined) return null
    const lagAnchor = (lagged + 5) % 10
    const lagRows = long.map((rate, sutta) => ({
      sutta,
      score: rate + (sutta === lagAnchor ? 0.045 : 0),
    }))
    const currentOrder = rankStatisticalSuttas(bayesianRows, droughts, 10)
    const lagOrder = rankStatisticalSuttas(lagRows, droughts, 10)
    const hybridOrder = currentOrder.slice(0, 4)
    for (const pick of lagOrder) {
      if (!hybridOrder.some((existing) => existing.sutta === pick.sutta)) hybridOrder.push(pick)
    }
    return rankStatisticalSuttas(
      hybridOrder.map((pick, index) => ({ sutta: pick.sutta, score: 10 - index })),
      droughts,
      count,
    )
  }

  return rankStatisticalSuttas(
    bayesianRows,
    droughts,
    count,
  )
}
