import type { PanelRecord } from "../db"
import { getRecordISODate } from "../db"
import { rankStatisticalSuttas, smoothedRate } from "./shared"
import type { SuttaPick } from "./types"

type CloseTop6Model = "recent-30-cold" | "calendar-date" | "delta"

const CLOSE_TOP6_MODELS: Partial<Record<string, CloseTop6Model>> = {
  "Madhur Day": "recent-30-cold",
  "Rajdhani Day": "delta",
  Kalyan: "calendar-date",
  "Sridevi Night": "recent-30-cold",
  "Kalyan Night": "recent-30-cold",
  "Madhur Night": "recent-30-cold",
  "Milan Night": "recent-30-cold",
  "Rajdhani Night": "recent-30-cold",
}

export function buildCloseTop6Model(input: {
  marketName: string
  records: PanelRecord[]
  droughts: Record<string, number>
  count: number
  targetDate: Date
}): SuttaPick[] | null {
  const { marketName, records, droughts, count, targetDate } = input
  if (count !== 6) return null
  const model = CLOSE_TOP6_MODELS[marketName]
  if (!model) return null
  const closeRecords = records.filter((record) => record.closePanel && record.closeSutta >= 0)
  if (closeRecords.length < 50) return null

  const counts = Array(10).fill(0) as number[]
  let total = 0

  if (model === "recent-30-cold") {
    const recent = closeRecords.slice(-30)
    for (const record of recent) counts[record.closeSutta]++
    return rankStatisticalSuttas(
      counts.map((observed, sutta) => ({ sutta, score: -smoothedRate(observed, recent.length) })),
      droughts,
      count,
    )
  }

  if (model === "calendar-date") {
    const dayOfMonth = targetDate.getDate()
    for (const record of closeRecords) {
      const isoDate = getRecordISODate(record)
      if (!isoDate || new Date(`${isoDate}T12:00:00`).getDate() !== dayOfMonth) continue
      counts[record.closeSutta]++
      total++
    }
    return rankStatisticalSuttas(
      counts.map((observed, sutta) => ({ sutta, score: smoothedRate(observed, total, 3) })),
      droughts,
      count,
    )
  }

  for (let index = 1; index < closeRecords.length; index++) {
    const delta = (closeRecords[index].closeSutta - closeRecords[index - 1].closeSutta + 10) % 10
    counts[delta]++
    total++
  }
  const previousClose = closeRecords.at(-1)?.closeSutta ?? 0
  return rankStatisticalSuttas(
    Array.from({ length: 10 }, (_, sutta) => ({
      sutta,
      score: smoothedRate(counts[(sutta - previousClose + 10) % 10], total),
    })),
    droughts,
    count,
  )
}

