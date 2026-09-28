import { getRecordISODate, type PanelRecord } from "./db"
import { MARKET_TIMINGS } from "./market-schedule"
import { historicalCutoffISO } from "./prediction-contract"

const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000
const RESULT_GRACE_MINUTES = 10

function indiaDateAndMinute(now: Date): { isoDate: string; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  const year = value("year")
  const month = value("month")
  const day = value("day")
  const hour = Number(value("hour"))
  const minute = Number(value("minute"))
  if (!year || !month || !day || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("Could not read current market time in Asia/Kolkata")
  }
  return { isoDate: `${year}-${month}-${day}`, minute: hour * 60 + minute }
}

function previousISODate(isoDate: string): string {
  const previous = new Date(`${isoDate}T00:00:00Z`)
  previous.setUTCDate(previous.getUTCDate() - 1)
  return previous.toISOString().slice(0, 10)
}

function usuallyClosedThisWeekday(dates: string[], marketDate: string): boolean {
  const target = new Date(`${marketDate}T00:00:00Z`)
  const cutoff = new Date(target)
  cutoff.setUTCDate(cutoff.getUTCDate() - 84)
  const cutoffISO = cutoff.toISOString().slice(0, 10)
  const recent = dates.filter((date) => date >= cutoffISO && date < marketDate)
  return recent.length >= 30
    && !recent.some((date) => new Date(`${date}T00:00:00Z`).getUTCDay() === target.getUTCDay())
}

/** A six-hour-old snapshot must still contain results already due today. */
export function isMarketHistoryFresh(records: PanelRecord[], marketName: string, now: Date): boolean {
  const newestSavedAt = records.reduce((max, record) => Math.max(max, record.savedAt ?? 0), 0)
  const dates = records.map(getRecordISODate).filter((date): date is string => date !== null).sort()
  const newestDate = dates.at(-1)
  const requiredStart = newestDate ? historicalCutoffISO(newestDate) : null
  const startTolerance = requiredStart ? new Date(`${requiredStart}T00:00:00Z`) : null
  startTolerance?.setUTCDate(startTolerance.getUTCDate() + 7)
  const coversWindow = Boolean(
    dates[0] && startTolerance && dates[0] <= startTolerance.toISOString().slice(0, 10),
  )
  if (records.length <= 50 || !coversWindow || newestSavedAt <= 0 || now.getTime() - newestSavedAt >= CACHE_MAX_AGE_MS) {
    return false
  }

  const timing = MARKET_TIMINGS[marketName]
  if (!timing) return true
  const india = indiaDateAndMinute(now)
  let marketDate = india.isoDate
  let marketMinute = india.minute
  // Keep checking the prior market date until its next Open begins.
  if (timing.closeMinutes >= 1440 && marketMinute < timing.openMinutes) {
    marketDate = previousISODate(marketDate)
    marketMinute += 1440
  }
  if (usuallyClosedThisWeekday(dates, marketDate)) return true
  const today = records.findLast((record) => getRecordISODate(record) === marketDate)
  if (marketMinute >= timing.openMinutes + RESULT_GRACE_MINUTES && !/^\d{3}$/.test(today?.openPanel ?? "")) {
    return false
  }
  if (marketMinute >= timing.closeMinutes + RESULT_GRACE_MINUTES && !/^\d{3}$/.test(today?.closePanel ?? "")) {
    return false
  }
  return true
}
