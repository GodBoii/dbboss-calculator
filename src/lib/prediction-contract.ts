export const HISTORICAL_LOOKBACK_MONTHS = 28
export const SUTTA_PREDICTION_COUNT = 6
export const JODI_GRID_COUNT = SUTTA_PREDICTION_COUNT ** 2
export const PANEL_PREDICTION_COUNT = 40

/**
 * Return an inclusive calendar-month cutoff. Calendar months are intentional:
 * a fixed day count drifts between 27 and 28 months as month lengths change.
 */
export function historicalCutoffISO(
  anchorISO: string,
  months = HISTORICAL_LOOKBACK_MONTHS,
): string {
  const anchor = new Date(`${anchorISO}T00:00:00Z`)
  if (Number.isNaN(anchor.getTime())) throw new Error(`Invalid history anchor: ${anchorISO}`)
  const targetDay = anchor.getUTCDate()
  anchor.setUTCDate(1)
  anchor.setUTCMonth(anchor.getUTCMonth() - months)
  const monthEnd = new Date(Date.UTC(
    anchor.getUTCFullYear(),
    anchor.getUTCMonth() + 1,
    0,
  )).getUTCDate()
  anchor.setUTCDate(Math.min(targetDay, monthEnd))
  return anchor.toISOString().slice(0, 10)
}
