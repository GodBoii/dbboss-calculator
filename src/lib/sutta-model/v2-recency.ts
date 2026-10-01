import { getRecordISODate, type PanelRecord } from "@/lib/db"
import type { SuttaPick } from "./types"

/**
 * Sutta model v2 ("recency"), selected by the walk-forward research in
 * scratch/sutta-v2-*.cjs (2024-11 to 2026-10, ~6,400 draws over 12 markets).
 *
 * Effects it relies on (pooled history):
 *   - Open repeats the previous Open slightly more than chance (~11.3% vs 10%).
 *   - Close avoids the previous Close (~8.8%) and the previous Open (~9.3%).
 *
 * Open : rank digits by how recently they appeared as this market's Open.
 * Close: push previous Close and previous Open to the bottom, then rank the rest
 *        by fewest Close appearances in the last 30 draws.
 *
 * Only completed rows dated strictly before the target date are used, so a
 * partially published row for today never leaks into the ranking.
 */

export const V2_MIN_HISTORY = 31
const CLOSE_COLD_WINDOW = 30

interface CompletedDraw {
  isoDate: string
  open: number
  close: number
}

export function toIstIsoDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function completedHistory(records: PanelRecord[], targetDate: Date): CompletedDraw[] {
  const targetIso = toIstIsoDate(targetDate)
  const byDate = new Map<string, CompletedDraw>()
  for (const record of records) {
    if (!/^\d{3}$/.test(record.openPanel ?? "")) continue
    if (!/^\d{3}$/.test(record.closePanel ?? "")) continue
    if (!/^\d{2}$/.test(record.jodi ?? "")) continue
    const isoDate = getRecordISODate(record)
    if (!isoDate || isoDate >= targetIso) continue
    if (!byDate.has(isoDate)) {
      byDate.set(isoDate, { isoDate, open: Number(record.jodi[0]), close: Number(record.jodi[1]) })
    }
  }
  return [...byDate.values()].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}

/** Deterministic tiny tie-breaker (FNV-1a), identical to the research harness. */
function tieBreak(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const out = new Array<number>(10).fill(0)
  for (let d = 0; d < 10; d++) {
    h ^= d + 1
    h = Math.imul(h, 16777619)
    out[d] = ((h >>> 0) % 100000) / 1e12
  }
  return out
}

function toRanking(scores: number[], tb: number[]): SuttaPick[] {
  return scores
    .map((score, sutta) => ({ sutta, value: score + tb[sutta] }))
    .sort((a, b) => b.value - a.value)
    .map(({ sutta }, index) => ({ sutta, rank: index + 1, score: 100 - index * 5, probabilityPct: 0 }))
}

/** Full 10-digit Open ranking, or null when history is too short. */
export function buildV2OpenRanking(records: PanelRecord[], marketName: string, targetDate: Date): SuttaPick[] | null {
  const history = completedHistory(records, targetDate)
  if (history.length < V2_MIN_HISTORY) return null
  const scores = new Array<number>(10).fill(-1e6)
  for (let i = history.length - 1; i >= 0; i--) {
    const digit = history[i].open
    if (scores[digit] === -1e6) scores[digit] = -(history.length - i)
  }
  return toRanking(scores, tieBreak(`${marketName}|${toIstIsoDate(targetDate)}`))
}

/** Full 10-digit Close ranking, or null when history is too short. */
export function buildV2CloseRanking(records: PanelRecord[], marketName: string, targetDate: Date): SuttaPick[] | null {
  const history = completedHistory(records, targetDate)
  if (history.length < V2_MIN_HISTORY) return null
  const previous = history[history.length - 1]
  const recentCloses = new Array<number>(10).fill(0)
  for (let i = Math.max(0, history.length - CLOSE_COLD_WINDOW); i < history.length; i++) {
    recentCloses[history[i].close]++
  }
  const scores = recentCloses.map((count, digit) =>
    -count - (digit === previous.close ? 100 : 0) - (digit === previous.open ? 100 : 0),
  )
  return toRanking(scores, tieBreak(`${marketName}|${toIstIsoDate(targetDate)}`))
}
