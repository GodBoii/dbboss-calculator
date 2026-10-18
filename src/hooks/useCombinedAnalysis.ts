import { useEffect, useMemo, useState } from "react"
import type { CombinedAnalysis, AnalysisVersion } from "@/lib/combined-prediction"
import type { CombinedRequest, CombinedResponse } from "@/lib/combined-analysis.worker"
import type { PredictionResult } from "@/lib/predictor"
import type { PanelRecord } from "@/lib/db"
import type { BacktestReport } from "@/lib/backtest"
import type { CombinedSuttaAccuracy } from "@/lib/combined-accuracy"

type Request = Omit<CombinedRequest, "copyCount">
interface State {
  request: Request
  analysis: CombinedAnalysis | null
  backtest: BacktestReport | null
  accuracy: CombinedSuttaAccuracy | null
  metricsCount: number
  error: string | null
}

export function useCombinedAnalysis(version: AnalysisVersion, base: PredictionResult | null, records: PanelRecord[],
  allMarkets: Record<string, PanelRecord[]>, knownOpenSutta: number | null, knownOpenPanel: string | null, copyCount: number) {
  const request = useMemo<Request | null>(() => version === "v2" && base ? {
    market: base.market, records, allMarkets, analysisDateISO: base.analysisAsOfISO ?? base.analysisDateISO, knownOpenSutta, knownOpenPanel,
  } : null, [version, base, records, allMarkets, knownOpenSutta, knownOpenPanel])
  const [state, setState] = useState<State | null>(null)
  useEffect(() => {
    if (!request) return
    let active = true
    let worker: Worker
    const initial = (): State => ({ request, analysis: null, backtest: null, accuracy: null, metricsCount: copyCount, error: null })
    try { worker = new Worker(new URL("../lib/combined-analysis.worker.ts", import.meta.url)) }
    catch {
      queueMicrotask(() => { if (active) setState({ ...initial(),error:"V2 could not start on this browser. Select V1 or analyze again." }) })
      return () => { active = false }
    }
    worker.onmessage = (event: MessageEvent<CombinedResponse>) => {
      if (!active) return
      const response = event.data
      setState((previous) => {
        const current = previous?.request === request ? previous : initial()
        if (response.kind === "live") return { ...current, analysis: response.analysis, error: null }
        if (response.kind === "metrics") return { ...current, backtest: response.backtest, accuracy: response.accuracy, metricsCount: copyCount }
        return { ...current, error: response.message }
      })
    }
    worker.onerror = () => {
      if (active) setState((previous) => ({ ...(previous?.request === request ? previous : initial()), error: "V2 analysis could not finish. Select V1 or analyze again." }))
    }
    try { worker.postMessage({ ...request, copyCount } satisfies CombinedRequest) }
    catch { queueMicrotask(() => { if(active) setState({...initial(),error:"V2 inputs could not be sent. Analyze again."}) }) }
    return () => { active = false; worker.terminate() }
  }, [request, copyCount])
  const compatible = request && state && state.request.market === request.market && state.request.records === request.records
    && state.request.allMarkets === request.allMarkets && state.request.analysisDateISO === request.analysisDateISO
  const current = compatible ? state : null
  const pending = request !== null && current?.request !== request
  return { analysis: current?.analysis ?? null, backtest: current?.backtest ?? null,
    accuracy: current?.metricsCount === copyCount ? current.accuracy : null, error: pending ? null : current?.error ?? null, pending }
}
