import { runMarketBacktest, type BacktestReport } from "./backtest"
import { buildSuttaAccuracyReport, type SuttaAccuracyReport } from "./sutta-accuracy"
import type { PanelRecord } from "./db"

export interface MetricsRequest { market: string; records: PanelRecord[]; allMarkets: Record<string,PanelRecord[]>; copyCount: number }
export type MetricsResponse = {kind:"ready"; backtest:BacktestReport|null; accuracy:SuttaAccuracyReport|null} | {kind:"error";message:string}
self.onmessage = (event: MessageEvent<MetricsRequest>) => {
  const {market,records,allMarkets,copyCount} = event.data
  try {
    const backtest = runMarketBacktest(market,records,allMarkets,{days:30})
    const accuracy = buildSuttaAccuracyReport(market,records,allMarkets,copyCount)
    self.postMessage({kind:"ready",backtest,accuracy} satisfies MetricsResponse)
  } catch (error) {
    self.postMessage({kind:"error",message:error instanceof Error ? error.message : "Historical metrics could not finish."} satisfies MetricsResponse)
  }
}
