import type { Market, ResultPhase } from "./types";

export const RESULT_TIMEZONE = "Asia/Kolkata" as const;

function partsAt(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RESULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function indiaDate(date = new Date()) {
  const parts = partsAt(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function minuteOfDay(date: Date) {
  const parts = partsAt(date);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function minutesFrom(target: number, current: number) {
  return ((current - target + 720) % 1440) - 720;
}

function timeToMinute(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function activePhase(market: Market, now = new Date()): ResultPhase | null {
  const current = minuteOfDay(now);
  const open = timeToMinute(market.open_time);
  const close = timeToMinute(market.close_time);

  // Keep a completed market eligible for the rest of the IST day. This lets
  // the monitor recover after a deployment or outage that missed its open.
  if (current >= close - 10) return "close";
  if (current >= open - 10) return "open";

  // Night-market close results can arrive shortly after midnight and belong
  // to the previous IST result date.
  const closeDelta = minutesFrom(close, current);
  if (close >= 20 * 60 && closeDelta >= 0 && closeDelta <= 120) return "close";
  return null;
}

export function resultDateForMarket(market: Market, phase: ResultPhase, now = new Date()) {
  const close = timeToMinute(market.close_time);
  const current = minuteOfDay(now);
  const belongsToPreviousDay = phase === "close" && close >= 20 * 60 && current < 3 * 60;
  return indiaDate(belongsToPreviousDay ? new Date(now.getTime() - 86_400_000) : now);
}
