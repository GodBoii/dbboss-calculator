import { buildCombinedAnalysis, type CombinedAnalysis } from "./combined-prediction"
import { buildCombinedSuttaAccuracy, type CombinedSuttaAccuracy } from "./combined-accuracy"
import { runMarketBacktest, type BacktestReport } from "./backtest"
import type { PanelRecord } from "./db"
import { toIstIsoDate } from "./sutta-model/v2-recency"

export interface CombinedRequest {
  market: string
  records: PanelRecord[]
  allMarkets: Record<string, PanelRecord[]>
  analysisDateISO: string
  knownOpenSutta: number | null
  knownOpenPanel: string | null
  copyCount: number
}

export type CombinedResponse = { kind: "live"; analysis: CombinedAnalysis }
  | { kind: "metrics"; backtest: BacktestReport | null; accuracy: CombinedSuttaAccuracy | null }
  | { kind: "error"; message: string }

self.onmessage = (event: MessageEvent<CombinedRequest>) => {
  const request = event.data
  try {
    const live = buildCombinedAnalysis(request.market, request.records, request.allMarkets, new Date(request.analysisDateISO), request.knownOpenSutta, request.knownOpenPanel)
    self.postMessage({ kind: "live", analysis: live } satisfies CombinedResponse)
    if (live.status !== "ready") return
    const knownCache = new Map<string, CombinedAnalysis>()
    const backtest = runMarketBacktest(request.market, request.records, request.allMarkets, {
      days: 30, minTrainingRecords: 180,
      predictor: (market, records, all, date, options) => {
        const panel = options?.knownOpenPanel ?? null
        const combined = buildCombinedAnalysis(market, records, all, date, null, panel)
        const target = toIstIsoDate(date ?? new Date())
        knownCache.set(target, combined)
        return combined.status === "ready" ? combined.prediction : null
      },
      adjustJodi: (analysis, prediction) => ({ ...analysis, adjustedClosePicks: prediction.closePicks, adjustedClosePanelPicks: prediction.closePanelPicks, adjustedCloseDpPicks: prediction.closeDpPicks, adjustedCloseDpDigitFocus: prediction.closeDpDigitFocus, kindPrediction: prediction.closeKindPrediction }),
    })
    const accuracy = buildCombinedSuttaAccuracy(request.market, request.records, request.allMarkets, request.copyCount, knownCache)
    self.postMessage({ kind: "metrics", backtest, accuracy } satisfies CombinedResponse)
  } catch (error) {
    self.postMessage({ kind: "error", message: error instanceof Error ? error.message : "V2 analysis could not finish." } satisfies CombinedResponse)
  }
}
