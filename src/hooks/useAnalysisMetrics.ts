import { useEffect, useMemo, useState } from "react"
import type { AnalysisVersion } from "@/lib/combined-prediction"
import type { PanelRecord } from "@/lib/db"
import type { PredictionResult } from "@/lib/predictor"
import type { MetricsRequest, MetricsResponse } from "@/lib/analysis-metrics.worker"

export function useAnalysisMetrics(version: AnalysisVersion, base: PredictionResult|null, records:PanelRecord[], allMarkets:Record<string,PanelRecord[]>, copyCount:number) {
  const request = useMemo<MetricsRequest|null>(() => version === "v1" && base ? {market:base.market,records,allMarkets,copyCount} : null,[version,base,records,allMarkets,copyCount])
  const [state,setState] = useState<{request:MetricsRequest;response:MetricsResponse}|null>(null)
  useEffect(() => {
    if (!request) return
    let active = true
    let worker: Worker | undefined
    const fail = () => { if (active) setState({request,response:{kind:"error",message:"Historical metrics could not finish. Analyze again to retry."}}) }
    try {
      worker = new Worker(new URL("../lib/analysis-metrics.worker.ts",import.meta.url))
      worker.onmessage = (event:MessageEvent<MetricsResponse>) => { if(active) setState({request,response:event.data}) }
      worker.onerror = fail
      worker.postMessage(request)
    } catch { queueMicrotask(fail) }
    return () => { active=false;worker?.terminate() }
  },[request])
  const response = request && state?.request===request ? state.response : null
  return {backtest:response?.kind==="ready" ? response.backtest : null, accuracy:response?.kind==="ready" ? response.accuracy : null,
    error:response?.kind==="error" ? response.message : null,pending:request!==null && response===null}
}
