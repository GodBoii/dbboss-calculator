import { getRecordsByMarket, normalizeRecords, replaceHistorySnapshot, type PanelRecord } from "./db"
import { isMarketHistoryFresh } from "./market-history-freshness"
import { getRecordISODate } from "./db"
import { historicalCutoffISO } from "./prediction-contract"
import { indiaISODate } from "./india-time"
import { ANALYSIS_MARKET_URLS, POOLED_ANALYSIS_MARKETS, getAnalysisMarketIssue } from "./analysis-markets"

export const MARKET_URLS = ANALYSIS_MARKET_URLS

function additionalMarketHistoryIssue(records: PanelRecord[], market: string, now: Date): string | null {
  if (POOLED_ANALYSIS_MARKETS.includes(market)) return null
  const latestComplete = records.findLast(row => row.openPanel && row.closePanel)
  const completedISO = latestComplete ? getRecordISODate(latestComplete) : null
  if (completedISO && Date.parse(indiaISODate(now)) - Date.parse(completedISO) < 3*86400000 && isMarketHistoryFresh(records,market,now)) return null
  return `${market} history is not current. Latest completed result: ${completedISO ?? "unavailable"}. Predictions are unavailable until the source updates.`
}

/** Refresh the fitted pool plus the selected market, never unrelated new feeds. */
export async function loadAnalysisHistory(forceRefresh: boolean, signal: AbortSignal, selectedMarket?: string) {
  signal.throwIfAborted()
  if (selectedMarket && !Object.hasOwn(MARKET_URLS, selectedMarket)) throw new Error("Unknown analysis market.")
  const issue = selectedMarket ? getAnalysisMarketIssue(selectedMarket) : null
  if (issue) throw new Error(issue)
  const names = [...POOLED_ANALYSIS_MARKETS]
  if (selectedMarket && !names.includes(selectedMarket)) names.push(selectedMarket)
  const cached = Object.fromEntries(await Promise.all(names.map(async name => {
    try { return [name, await getRecordsByMarket(name)] as const }
    catch { return [name, []] as const } // Invalid legacy history must be re-fetched.
  })))
  signal.throwIfAborted()
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  signal.addEventListener("abort",abort,{once:true})
  const timeout = setTimeout(() => controller.abort(new Error("History requests timed out. Retry when your connection is stable.")),45_000)
  let histories: Record<string,PanelRecord[]>
  try {
    histories = {}
    let next = 0
    async function consume() {
      while (next < names.length) {
        const market = names[next++]
        // Unique URL also bypasses fallback entries held by the previous service worker.
        const url = `/api/scrape?url=${encodeURIComponent(MARKET_URLS[market])}&market=${encodeURIComponent(market)}&fresh=${Date.now()}`
        const response = await fetch(url,{signal:controller.signal,cache:"no-store"})
        if (!response.ok) throw new Error(`Could not refresh ${market}. Saved history was kept. Retry Fresh Data.`)
        const body: unknown = await response.json()
        if (!body || typeof body !== "object" || !("panels" in body) || !("scrapedAt" in body) || typeof body.scrapedAt !== "string") throw new Error(`Invalid ${market} history response.`)
        const fetchedAt = Date.parse(body.scrapedAt)
        if (!Number.isFinite(fetchedAt) || Math.abs(Date.now()-fetchedAt) > 5*60*1000) throw new Error(`${market} returned an old history snapshot. Retry Fresh Data.`)
        const records = normalizeRecords(body.panels,market,fetchedAt)
        if (records.length < 50) throw new Error(`${market} returned too little history. Saved history was kept.`)
        const newest = getRecordISODate(records[records.length-1])
        const oldest = getRecordISODate(records[0])
        if (!newest || !oldest || oldest > new Date(Date.parse(`${historicalCutoffISO(newest)}T00:00:00Z`)+7*86400000).toISOString().slice(0,10)) throw new Error(`${market} returned a truncated history window. Saved history was kept.`)
        const historyIssue = additionalMarketHistoryIssue(records,market,new Date())
        if (historyIssue) throw new Error(historyIssue)
        histories[market] = records
      }
    }
    await Promise.all(Array.from({length:4},consume))
    signal.throwIfAborted()
  } catch (error) {
    controller.abort()
    signal.throwIfAborted()
    const now = new Date()
    const fresh = names.every(name => isMarketHistoryFresh(cached[name],name,now) && !additionalMarketHistoryIssue(cached[name],name,now))
    if (!forceRefresh && fresh) return {histories:cached,notice:"Using the complete saved history snapshot. Network refresh was unavailable."}
    throw error
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener("abort",abort)
  }
  await replaceHistorySnapshot(histories)
  signal.throwIfAborted()
  const oldHistory = Object.entries(histories).flatMap(([market,rows]) => {
    const latest = rows.findLast(row => row.openPanel && row.closePanel)
    const iso = latest ? getRecordISODate(latest) : null
    const current = indiaISODate(new Date(rows[rows.length-1].savedAt))
    return iso && Date.parse(current)-Date.parse(iso) >= 3*86400000 ? [`${market}: ${iso}`] : []
  })
  return {histories,notice:oldHistory.length ? `Latest completed history from the source: ${oldHistory.join("; ")}.` : ""}
}
