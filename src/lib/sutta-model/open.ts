import type { PanelRecord } from "../db"
import { getRecordISODate } from "../db"
import { rankStatisticalSuttas, smoothedRate } from "./shared"
import type { SuttaPick } from "./types"

type OpenTop6Model = "calendar-date"

const OPEN_TOP6_MODELS: Partial<Record<string, OpenTop6Model>> = {
  "Time Bazar": "calendar-date",
  "Madhur Day": "calendar-date",
  "Rajdhani Day": "calendar-date",
  "Sridevi Night": "calendar-date",
  "Kalyan Night": "calendar-date",
  "Milan Night": "calendar-date",
  "Rajdhani Night": "calendar-date",
  "Main Bazar": "calendar-date",
}

export function buildOpenTop6Model(input: {
  marketName: string
  records: PanelRecord[]
  droughts: Record<string, number>
  count: number
  targetDate: Date
}): SuttaPick[] | null {
  const { marketName, records, droughts, count, targetDate } = input
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
  return rankStatisticalSuttas(
    counts.map((observed, sutta) => ({ sutta, score: smoothedRate(observed, total, 3) })),
    droughts,
    count,
  )
}
