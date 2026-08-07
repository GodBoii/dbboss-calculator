export interface MarketTiming {
  openMinutes: number
  closeMinutes: number
}

export type MarketSide = "open" | "close"

export const MARKET_TIMINGS: Record<string, MarketTiming> = {
  Sridevi: { openMinutes: 11 * 60 + 35, closeMinutes: 12 * 60 + 35 },
  "Time Bazar": { openMinutes: 13 * 60 + 10, closeMinutes: 14 * 60 + 10 },
  "Madhur Day": { openMinutes: 13 * 60 + 30, closeMinutes: 14 * 60 + 30 },
  "Rajdhani Day": { openMinutes: 15 * 60 + 5, closeMinutes: 17 * 60 + 5 },
  "Milan Day": { openMinutes: 15 * 60 + 10, closeMinutes: 17 * 60 + 10 },
  Kalyan: { openMinutes: 15 * 60 + 45, closeMinutes: 17 * 60 + 45 },
  "Sridevi Night": { openMinutes: 19 * 60 + 15, closeMinutes: 20 * 60 + 15 },
  "Madhur Night": { openMinutes: 20 * 60 + 30, closeMinutes: 22 * 60 + 30 },
  "Milan Night": { openMinutes: 21 * 60 + 5, closeMinutes: 23 * 60 + 5 },
  "Rajdhani Night": { openMinutes: 21 * 60 + 35, closeMinutes: 23 * 60 + 45 },
  "Kalyan Night": { openMinutes: 21 * 60 + 45, closeMinutes: 23 * 60 + 45 },
  "Main Bazar": { openMinutes: 22 * 60, closeMinutes: 24 * 60 + 10 },
}

export function marketEventMinutes(marketName: string, side: MarketSide) {
  const timing = MARKET_TIMINGS[marketName]
  if (!timing) return null
  return side === "open" ? timing.openMinutes : timing.closeMinutes
}

export function isMarketEventEarlier(
  sourceMarket: string,
  sourceSide: MarketSide,
  targetMarket: string,
  targetSide: MarketSide,
) {
  const sourceMinutes = marketEventMinutes(sourceMarket, sourceSide)
  const targetMinutes = marketEventMinutes(targetMarket, targetSide)
  if (sourceMinutes === null || targetMinutes === null) return false
  return sourceMinutes < targetMinutes
}
