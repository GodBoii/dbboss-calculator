import type { PanelRecord } from "../db"
import { getRecordISODate } from "../db"
import { digitRates, rankStatisticalSuttas, smoothedRate } from "./shared"
import type { SuttaPick } from "./types"

type OpenTop6Model = "calendar-date" | "calendar-date-sridevi-kind"

const OPEN_TOP6_MODELS: Partial<Record<string, OpenTop6Model>> = {
  "Time Bazar": "calendar-date",
  "Madhur Day": "calendar-date",
  "Rajdhani Day": "calendar-date",
  "Sridevi Night": "calendar-date",
  "Kalyan Night": "calendar-date",
  "Milan Night": "calendar-date-sridevi-kind",
  "Rajdhani Night": "calendar-date",
  "Main Bazar": "calendar-date",
}

export function buildOpenTop6Model(input: {
  marketName: string
  records: PanelRecord[]
  droughts: Record<string, number>
  count: number
  targetDate: Date
  allMarketsRecords?: Record<string, PanelRecord[]>
}): SuttaPick[] | null {
  const { marketName, records, droughts, count, targetDate, allMarketsRecords = {} } = input
  if (count !== 6) return null
  const model = OPEN_TOP6_MODELS[marketName]
  if (!model) return null
  const openRecords = records.filter((record) => record.openPanel && record.openSutta >= 0)
  if (openRecords.length < 50) return null

  const dayOfMonth = targetDate.getDate()
  const counts = Array(10).fill(0) as number[]
  let total = 0
  for (const record of openRecords) {
    const isoDate = getRecordISODate(record)
    if (!isoDate || new Date(`${isoDate}T12:00:00`).getDate() !== dayOfMonth) continue
    counts[record.openSutta]++
    total++
  }
  const calendarRows = counts.map((observed, sutta) => ({
    sutta,
    score: smoothedRate(observed, total, 3),
  }))
  if (model === "calendar-date-sridevi-kind") {
    const targetISO = targetDate.toISOString().slice(0, 10)
    const source = (allMarketsRecords["Sridevi Night"] ?? []).find(
      (record) => getRecordISODate(record) === targetISO,
    )
    if (source?.openPanel?.length === 3) {
      const kindAnchor = new Set(source.openPanel).size % 10
      const long = digitRates(openRecords.map((record) => record.openSutta))
      const currentOrder = rankStatisticalSuttas(calendarRows, droughts, 10)
      const challengerOrder = rankStatisticalSuttas(
        long.map((rate, sutta) => ({
          sutta,
          score: rate + (sutta === kindAnchor ? 0.045 : 0),
        })),
        droughts,
        10,
      )
      const hybridOrder = currentOrder.slice(0, 4)
      for (const pick of challengerOrder) {
        if (!hybridOrder.some((existing) => existing.sutta === pick.sutta)) hybridOrder.push(pick)
      }
      return rankStatisticalSuttas(
        hybridOrder.map((pick, index) => ({ sutta: pick.sutta, score: 10 - index })),
        droughts,
        count,
      )
    }
  }
  return rankStatisticalSuttas(calendarRows, droughts, count)
}
