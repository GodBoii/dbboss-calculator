// These twelve sources are the fitted DP model's inputs. Adding a selectable
// market must not change the pool or make its feed a dependency of other markets.
export const POOLED_ANALYSIS_MARKETS: readonly string[] = [
  "Sridevi", "Time Bazar", "Madhur Day", "Milan Day", "Rajdhani Day", "Kalyan",
  "Sridevi Night", "Kalyan Night", "Madhur Night", "Milan Night", "Rajdhani Night", "Main Bazar",
]

export const DAY_MARKETS = [
  "Sridevi", "Time Bazar", "Madhur Day", "Milan Day", "Rajdhani Day", "Supreme Day", "Kalyan",
]

export const NIGHT_MARKETS = [
  "Sridevi Night", "Kalyan Night", "Madhur Night", "Supreme Night", "Milan Night", "Rajdhani Night", "Main Bazar",
]

export const ANALYSIS_MARKET_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  [...DAY_MARKETS, ...NIGHT_MARKETS].map(name => [
    name, `https://dpboss.tax/panel-chart-record/${name.toLowerCase().replaceAll(" ", "-")}.php`,
  ]),
)

export function getAnalysisMarketIssue(market: string): string | null {
  // November 3 audit: the preferred chart stops on October 18; a second chart
  // disagrees on 39 completed dates. Fresh HTTP timestamps cannot clear this.
  if (market === "Supreme Night") {
    return "Supreme Night predictions are unavailable while conflicting historical result dates are verified. Other markets remain available."
  }
  return null
}
