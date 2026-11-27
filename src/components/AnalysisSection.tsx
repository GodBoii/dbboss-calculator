"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import {
  analyzeMarket,
  computeJodiAnalysis,
  buildContextFromResult,
  calculateSutta,
  type PredictionResult,
  type JodiAnalysis,
} from "@/lib/predictor"
import {
  buildAbsentDigitsPredictionFromPanels,
  type AbsentDigitSidePrediction,
} from "@/lib/absent-digits"
import {
  buildPresentDigitsPredictionFromPanels,
  type PresentDigitSidePrediction,
} from "@/lib/present-digits"
import type { PanelRecord } from "@/lib/db"
import {
  buildCloseSuttaRanking,
  buildJodis,
  buildOpenSuttaRanking,
} from "@/lib/sutta-model"
import { AnalysisTabs } from "./analysis/AnalysisTabs"
import { BetCopyDesk } from "./analysis/BetCopyDesk"
import { ConfidenceBadge } from "./analysis/AnalysisWidgets"
import { getVerifiedDpCalls } from "@/lib/verified-dp-call"
import { loadAnalysisHistory } from "@/lib/analysis-history"
import { DAY_MARKETS, NIGHT_MARKETS, POOLED_ANALYSIS_MARKETS, getAnalysisMarketIssue } from "@/lib/analysis-markets"
import { indiaHour } from "@/lib/india-time"
import { useAnalysisMetrics } from "@/hooks/useAnalysisMetrics"
import { SUTTA_MODEL_VERSION } from "@/lib/app-version"
import { SUTTA_PREDICTION_COUNT } from "@/lib/prediction-contract"
import { useCombinedAnalysis } from "@/hooks/useCombinedAnalysis"
import type { AnalysisVersion } from "@/lib/combined-prediction"
import { AnalysisVersionSelector } from "./analysis/AnalysisVersionSelector"

type LoadingState = "idle" | "fetching" | "analyzing" | "done" | "error"

function AvoidDigitColumn({
  label,
  prediction,
}: {
  label: string
  prediction: AbsentDigitSidePrediction | null
}) {
  if (!prediction) {
    return (
      <div className="avoid-digit-column avoid-digit-column--blocked">
        <div className="avoid-digit-column-head">
          <span className="avoid-digit-label">{label}</span>
          <span className="avoid-digit-meta avoid-digit-meta--blocked">
            Insufficient history
          </span>
        </div>
        <p className="avoid-digit-status">
          At least 180 completed draws are required.
        </p>
      </div>
    )
  }

  const isCallable = prediction.status === "CALL"
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`

  return (
    <div className={`avoid-digit-column ${isCallable ? "avoid-digit-column--call" : "avoid-digit-column--blocked"}`}>
      <div className="avoid-digit-column-head">
        <span className="avoid-digit-label">{label}</span>
        <span className={`avoid-digit-meta ${isCallable ? "avoid-digit-meta--call" : "avoid-digit-meta--blocked"}`}>
          {isCallable ? "Research gate passed" : "No safe call"}
        </span>
      </div>
      <div className="avoid-digit-row">
        {prediction.candidateAvoidDigits.map((digit) => (
          <div key={`${label}-${digit}`} className="avoid-digit-chip">
            <span className="avoid-digit-number">{digit}</span>
          </div>
        ))}
      </div>
      <p className="digit-panel-summary">
        Recent accuracy {percent(prediction.historicalReliability)}
        <span aria-hidden="true"> · </span>
        {prediction.reliabilitySample} draws
      </p>
    </div>
  )
}

function PresentDigitColumn({
  label,
  prediction,
}: {
  label: string
  prediction: PresentDigitSidePrediction | null
}) {
  if (!prediction) {
    return (
      <div className="avoid-digit-column avoid-digit-column--blocked">
        <div className="avoid-digit-column-head">
          <span className="avoid-digit-label">{label}</span>
          <span className="avoid-digit-meta avoid-digit-meta--blocked">Insufficient history</span>
        </div>
        <p className="avoid-digit-status">At least 180 completed draws are required.</p>
      </div>
    )
  }

  const targetReached = prediction.status === "TARGET_REACHED"
  const percent = (value: number) => `${(value * 100).toFixed(1)}%`

  return (
    <div className={`avoid-digit-column ${targetReached ? "avoid-digit-column--call" : "avoid-digit-column--blocked"}`}>
      <div className="avoid-digit-column-head">
        <span className="avoid-digit-label">{label}</span>
        <span className={`avoid-digit-meta ${targetReached ? "avoid-digit-meta--call" : "avoid-digit-meta--blocked"}`}>
          {targetReached ? "Target gate passed" : "Research only"}
        </span>
      </div>
      <div className="avoid-digit-row">
        {prediction.predictedDigits.map((digit) => (
          <div key={`${label}-present-${digit}`} className="avoid-digit-chip present-digit-chip">
            <span className="avoid-digit-number">{digit}</span>
          </div>
        ))}
      </div>
      <p className="digit-panel-summary">
        Recent accuracy {percent(prediction.historicalReliability)}
        <span aria-hidden="true"> · </span>
        {prediction.reliabilitySample} draws
      </p>
    </div>
  )
}
// ─── Component ────────────────────────────────────────────────────────────────
type Session = "day" | "night"
type DigitPanelMode = "present" | "absent"

export default function AnalysisSection() {
  const verifiedDpCalls = getVerifiedDpCalls()
  // Auto-detect session: night if hour >= 18 (6pm IST)
  const defaultSession: Session = (() => {
    const h = indiaHour()
    return h >= 18 || h < 6 ? "night" : "day"
  })()

  const [session, setSession] = useState<Session>(defaultSession)
  const [selectedMarket, setSelectedMarket] = useState<string>(
    defaultSession === "night" ? "Main Bazar" : "Kalyan"
  )
  const [loadingState, setLoadingState] = useState<LoadingState>("idle")
  const [marketPickerExpanded, setMarketPickerExpanded] = useState(true)
  const [baseResult, setResult] = useState<PredictionResult | null>(null)
  const [analysisVersion, setAnalysisVersion] = useState<AnalysisVersion>("v1")
  const [errorMsg, setErrorMsg] = useState("")
  const [activeTab, setActiveTab] = useState<"picks" | "stats" | "intel">("picks")
  const [picksSubTab, setPicksSubTab] = useState<"open" | "close" | "jodi">("open")
  const [suttaSignalView, setSuttaSignalView] = useState<"open" | "close">("open")
  const [digitPanelMode, setDigitPanelMode] = useState<DigitPanelMode>("present")
  const [suttaCopyExpanded, setSuttaCopyExpanded] = useState(false)
  const [copyCount, setCopyCount] = useState(SUTTA_PREDICTION_COUNT)
  const [openSuttaInput, setOpenSuttaInput] = useState<number | null>(null)
  const [openPanelInput, setOpenPanelInput] = useState("")
  const [baseJodiResult, setJodiResult] = useState<JodiAnalysis | null>(null)
  const [cachedRecords, setCachedRecords] = useState<PanelRecord[]>([])
  const [allMarketsRecords, setAllMarketsRecords] = useState<Record<string, PanelRecord[]>>({})
  const cachedRecordsRef = useRef<PanelRecord[]>([])
  const allMarketsRecordsRef = useRef<Record<string, PanelRecord[]>>({})
  const combinedState = useCombinedAnalysis(analysisVersion, baseResult, cachedRecords, allMarketsRecords,
    openSuttaInput, openPanelInput.length === 3 ? openPanelInput : null, copyCount)
  const combined = combinedState.analysis?.status === "ready" ? combinedState.analysis : null
  const result = analysisVersion === "v2" && combined ? combined.prediction : baseResult
  const v1Metrics = useAnalysisMetrics(analysisVersion, baseResult, cachedRecords, allMarketsRecords, copyCount)
  const backtestReport = analysisVersion === "v2" ? combinedState.backtest : v1Metrics.backtest
  const requestRef = useRef<AbortController | null>(null)
  const [historyNotice, setHistoryNotice] = useState("")
  useEffect(() => () => requestRef.current?.abort(), [])
  const jodiResult = useMemo(() => analysisVersion === "v2" && combined && baseJodiResult ? {
    ...baseJodiResult, adjustedClosePicks: combined.close.rankedPanels, adjustedClosePanelPicks: combined.close.panelPicks,
    adjustedCloseDpPicks: combined.close.dpPicks, adjustedCloseDpDigitFocus: combined.prediction.closeDpDigitFocus,
    kindPrediction: combined.prediction.closeKindPrediction,
  } : baseJodiResult, [analysisVersion, combined, baseJodiResult])

  // ── Copy helpers ─────────────────────────────────────────────────────────
  const [copyingKey, setCopyingKey] = useState<string | null>(null)

  const handleCopy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyingKey(key)
      setTimeout(() => setCopyingKey(null), 1800)
    }).catch(() => {
      /* silently fail on insecure contexts */
    })
  }, [])

  // ── Jodi Model: compute when user enters Open Sutta ──────────────────────
  const runJodiModel = useCallback((sutta: number, panelStr: string | null) => {
    if (!baseResult) return
    const ctx = buildContextFromResult(baseResult)
    const analysis = computeJodiAnalysis(sutta, panelStr, cachedRecordsRef.current, ctx, baseResult.closeDpKindContext)
    setJodiResult(analysis)
    setPicksSubTab("jodi")
  }, [baseResult])

  const fetchAndAnalyze = useCallback(
    async (forceRefresh = false) => {
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller
      setHistoryNotice("")
      setLoadingState("fetching")
      setErrorMsg("")
      setResult(null)
      setJodiResult(null)
      setCachedRecords([])
      setAllMarketsRecords({})
      setActiveTab("picks")
      setPicksSubTab("open")
      setOpenSuttaInput(null)
      setOpenPanelInput("")

      try {
        const snapshot = await loadAnalysisHistory(forceRefresh, controller.signal, selectedMarket)
        if (requestRef.current !== controller) return
        const allMarketsRecords = snapshot.histories
        const records = allMarketsRecords[selectedMarket]
        setHistoryNotice(snapshot.notice)
        setLoadingState("analyzing")
        cachedRecordsRef.current = records
        allMarketsRecordsRef.current = allMarketsRecords
        setCachedRecords(records)
        setAllMarketsRecords(allMarketsRecords)
        const prediction = analyzeMarket(selectedMarket, records, allMarketsRecords)
        if (!prediction) throw new Error("Not enough data to generate predictions.")

        setResult(prediction)
        setMarketPickerExpanded(false)
        setLoadingState("done")
      } catch (err) {
        if (controller.signal.aborted || requestRef.current !== controller) return
        const msg = err instanceof Error ? err.message : "Unknown error"
        setErrorMsg(msg)
        setLoadingState("error")
      }
    },
    [selectedMarket]
  )

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const getTemporalBadgeColor = (mode: string) => {
    if (mode === "Payday") return "temporal-payday"
    if (mode === "Month-End") return "temporal-monthend"
    return "temporal-normal"
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return "#4ade80"   // green
    if (score >= 60) return "#60a5fa"   // blue
    if (score >= 50) return "#facc15"   // yellow
    return "#f87171"                     // red
  }

  const pct = (value: number, total: number) => {
    if (!total) return "0.0%"
    return `${((value / total) * 100).toFixed(1)}%`
  }
  const dpPrecision = (correct: number, predicted: number) => {
    if (!predicted) return "No DP calls"
    return `${pct(correct, predicted)} (${correct}/${predicted})`
  }

  const haptic = (ms = 8) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms)
  }

  const switchSession = (s: Session) => {
    requestRef.current?.abort()
    haptic()
    setSession(s)
    setHistoryNotice("")
    setSelectedMarket(s === "day" ? "Kalyan" : "Main Bazar")
    setResult(null)
    setCachedRecords([])
    setJodiResult(null)
    setActiveTab("picks")
    setPicksSubTab("open")
    setLoadingState("idle")
  }

  const activeMarkets = session === "day" ? DAY_MARKETS : NIGHT_MARKETS
  const isNight = session === "night"
  const isBusy = loadingState === "fetching" || loadingState === "analyzing"
  const marketIssue = getAnalysisMarketIssue(selectedMarket)
  const usesSharedDefaults = !POOLED_ANALYSIS_MARKETS.includes(selectedMarket)
  const openSuttaRanking = useMemo(
    () => analysisVersion === "v2" ? combined?.open.suttas ?? [] : result
      ? buildOpenSuttaRanking(
          result.openPicks,
          result.openSuttaDroughts,
          cachedRecords,
          selectedMarket,
          new Date(result.analysisDateISO),
          allMarketsRecords,
        )
      : [],
    [analysisVersion, combined, result, cachedRecords, selectedMarket, allMarketsRecords],
  )
  const closeSuttaRanking = useMemo(
    () => analysisVersion === "v2" ? combined?.close.suttas ?? [] : result
      ? buildCloseSuttaRanking(
          jodiResult?.adjustedClosePicks ?? result.closePicks,
          result.closeSuttaDroughts,
          cachedRecords,
          selectedMarket,
          openSuttaInput,
          allMarketsRecords,
          new Date(result.analysisDateISO),
        )
      : [],
    [analysisVersion, combined, result, jodiResult, cachedRecords, selectedMarket, openSuttaInput, allMarketsRecords],
  )
  const openCopySuttas = useMemo(() => openSuttaRanking.slice(0, copyCount), [openSuttaRanking, copyCount])
  const closeCopySuttas = useMemo(() => closeSuttaRanking.slice(0, copyCount), [closeSuttaRanking, copyCount])
  const generatedJodis = useMemo(
    () => buildJodis(openCopySuttas, closeCopySuttas),
    [openCopySuttas, closeCopySuttas],
  )
  const absentDigitsPrediction = useMemo(
    () => analysisVersion === "v1" && result
      ? buildAbsentDigitsPredictionFromPanels(
          selectedMarket,
          cachedRecords,
          new Date(result.analysisDateISO),
        )
      : null,
    [analysisVersion, result, selectedMarket, cachedRecords],
  )
  const presentDigitsPrediction = useMemo(
    () => analysisVersion === "v1" && result
      ? buildPresentDigitsPredictionFromPanels(
          selectedMarket, cachedRecords, new Date(result.analysisDateISO),
        )
      : null,
    [analysisVersion, result, selectedMarket, cachedRecords],
  )
  const suttaAccuracyReport = analysisVersion === "v2" ? combinedState.accuracy : v1Metrics.accuracy
  const displayedCloseAccuracy = openSuttaInput === null
    ? suttaAccuracyReport?.close
    : suttaAccuracyReport?.adjustedClose
  const displayedJodiAccuracy = openSuttaInput === null
    ? suttaAccuracyReport?.jodi
    : suttaAccuracyReport?.adjustedJodi

  const renderSuttaSignalList = (
    label: string,
    ranking: typeof openSuttaRanking,
  ) => (
    <ol className="sutta-ranking" role="list" aria-label={label}>
      {ranking.map((prediction) => (
        <li key={prediction.sutta}>
          <span className="sr-only">Rank {prediction.rank}, digit </span>
          <strong>{prediction.sutta}</strong>
          <span className="sutta-ranking-score">
            <span className="sr-only">Score </span>{prediction.score.toFixed(1)}
          </span>
        </li>
      ))}
    </ol>
  )

  return (
    <section className="analysis-section">
      <div className="glass-panel analysis-market-panel">
        <div className="analysis-market-heading">
          <h2 className="section-title">{marketPickerExpanded ? "Market" : selectedMarket}</h2>
          {marketPickerExpanded && (
            <div className="session-toggle" role="group" aria-label="Market session">
              <button className="session-toggle-btn" aria-pressed={!isNight} onClick={() => switchSession("day")}>
                Day
              </button>
              <button className="session-toggle-btn" aria-pressed={isNight} onClick={() => switchSession("night")}>
                Night
              </button>
            </div>
          )}
          {loadingState !== "idle" && (
            <button
              type="button"
              className="analysis-market-change"
              aria-expanded={marketPickerExpanded}
              aria-controls="analysis-market-options"
              onClick={() => setMarketPickerExpanded((expanded) => !expanded)}
            >
              {marketPickerExpanded ? "Hide markets" : "Change market"}
            </button>
          )}
        </div>

        <div id="analysis-market-options" hidden={!marketPickerExpanded}>
          <div className="market-grid" role="group" aria-label="Market">
            {activeMarkets.map((market) => (
              <button
                key={market}
                id={`market-${market.replace(/\s+/g, "-").toLowerCase()}`}
                className="market-btn"
                aria-pressed={selectedMarket === market}
                onClick={() => {
                  haptic()
                  requestRef.current?.abort()
                  setSelectedMarket(market)
                  setHistoryNotice("")
                  setResult(null)
                  setCachedRecords([])
                  setJodiResult(null)
                  setActiveTab("picks")
                  setPicksSubTab("open")
                  setLoadingState("idle")
                }}
              >
                {market}
              </button>
            ))}
          </div>
        </div>

        {marketIssue && (
          <div className="analysis-market-issue" id="market-history-issue" role="status">
            {marketIssue}
          </div>
        )}

        <div className="action-row">
          <button
            id="btn-analyze"
            className="analyze-btn"
            onClick={() => fetchAndAnalyze(false)}
            disabled={Boolean(marketIssue) || isBusy}
            aria-describedby={marketIssue ? "market-history-issue" : undefined}
          >
            {isBusy ? (
              <span className="btn-loading">
                <span className="spinner" />
                Analyzing…
              </span>
            ) : (
              marketPickerExpanded ? `Analyze ${selectedMarket}` : "Analyze again"
            )}
          </button>

          {result && (
            <button
              id="btn-refresh"
              className="refresh-btn"
              onClick={() => fetchAndAnalyze(true)}
              disabled={isBusy}
            >
              Refresh
            </button>
          )}
        </div>

        <details className="analysis-disclosure analysis-settings">
          <summary>Analysis model <span>{analysisVersion === "v1" ? "V1" : "V2 · Experimental"}</span></summary>
          <AnalysisVersionSelector version={analysisVersion} onChange={(version) => { setCopyingKey(null); setAnalysisVersion(version) }} disabled={isBusy} />
        </details>
      </div>

      {isBusy && (
        <p className="analysis-status" role="status">
          {loadingState === "fetching" ? "Loading market history…" : "Preparing predictions…"}
        </p>
      )}

      {historyNotice && (
        <details className="analysis-disclosure analysis-history">
          <summary><span role="status">Market history notice</span></summary>
          <p>{historyNotice}</p>
        </details>
      )}

      {/* ── Error State ──────────────────────────────────────────────────── */}
      {loadingState === "error" && (
        <div className="glass-panel error-panel" role="alert">
          <p className="error-title">Couldn’t run analysis</p>
          <p className="error-msg">{errorMsg}</p>
          <button className="retry-btn" onClick={() => fetchAndAnalyze(false)}>
            Try again
          </button>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {analysisVersion === "v2" && baseResult && loadingState === "done" && !combined && (
        <div className="glass-panel" role="status">
          {combinedState.error ?? (combinedState.analysis?.status === "unavailable" ? combinedState.analysis.reason : "Preparing V2 predictions…")}
        </div>
      )}
      {result && loadingState === "done" && (analysisVersion === "v1" || combined) && (
        <>
          {(verifiedDpCalls.open || verifiedDpCalls.close) && (
            <div className="confidence-strip kind-forecast-strip glass-panel">
              {verifiedDpCalls.open && (
                <div className="kind-forecast-card">
                  <div className="kind-forecast-head">
                    <span className="kind-forecast-label">Open</span>
                    <span className="kind-forecast-pill">DP</span>
                  </div>
                </div>
              )}
              {verifiedDpCalls.close && (
                <div className="kind-forecast-card">
                  <div className="kind-forecast-head">
                    <span className="kind-forecast-label">Close</span>
                    <span className="kind-forecast-pill">DP</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── HONEY-POT ALERT ──────────────────────────────────────────── */}
          {result.honeyPotAlert && (
            <div className="honeypot-alert glass-panel">
              <div className="honeypot-header">
                <span className="honeypot-icon">🍯</span>
                <div>
                  <h3 className="honeypot-title">Sequence watch</h3>
                  <p className="honeypot-subtitle">
                    {result.recordsSinceLastSequence} draws without a sequence
                    (avg: {result.averageDroughtLength})
                  </p>
                </div>
              </div>
              <p className="honeypot-desc">
                The model gives these sequence panels extra weight.
              </p>
              <div className="honeypot-picks">
                {result.topPicks
                  .filter((p) => p.isHoneyPotPick)
                  .slice(0, 5)
                  .map((p) => (
                    <span key={p.panel} className="honeypot-panel">{p.panel}</span>
                  ))}
              </div>
            </div>
          )}

          {/* ── Sutta Saturation Map ──────────────────────────────────────── */}
          <div className="analysis-signal-safety-stack">
            <div className="glass-panel">
              <h3 className="section-title analysis-sutta-title">Sutta rankings</h3>

              <div className="sutta-signal-switch" role="group" aria-label="Sutta ranking">
                <button
                  type="button"
                  className="sutta-signal-switch-btn"
                  aria-pressed={suttaSignalView === "open"}
                  onClick={() => {
                    haptic()
                    setSuttaSignalView("open")
                  }}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="sutta-signal-switch-btn"
                  aria-pressed={suttaSignalView === "close"}
                  onClick={() => {
                    haptic()
                    setSuttaSignalView("close")
                  }}
                >
                  Close
                </button>
              </div>

              {suttaSignalView === "open"
                ? renderSuttaSignalList("Open Sutta", openSuttaRanking)
                : renderSuttaSignalList(
                    openSuttaInput === null ? "Close Sutta" : "Adjusted Close Sutta",
                    closeSuttaRanking,
                  )}

              <button
                type="button"
                className="sutta-map-tools-toggle"
                onClick={() => {
                  haptic()
                  setSuttaCopyExpanded((value) => !value)
                }}
                aria-expanded={suttaCopyExpanded}
              >
                <span>Copy Sutta / Jodi</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ transform: suttaCopyExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {suttaCopyExpanded && (
                <div className="sutta-map-tools" inert={analysisVersion === "v2" && combinedState.pending ? true : undefined}>
                  <BetCopyDesk
                    copyCount={copyCount}
                    onCopyCountChange={setCopyCount}
                    openSuttas={openCopySuttas}
                    closeSuttas={closeCopySuttas}
                    jodis={generatedJodis}
                    copyingKey={copyingKey}
                    handleCopy={handleCopy}
                  />
                </div>
              )}
            </div>

            <div className={`glass-panel avoid-digit-panel digit-panel ${digitPanelMode === "present" ? "present-digit-panel" : ""}`}>
              <div className="digit-panel-toolbar">
                <h3 className="section-title">2-digit picks</h3>

                <select
                  className="digit-panel-select"
                  aria-label="Choose two-digit prediction"
                  value={digitPanelMode}
                  onChange={(event) => {
                    haptic()
                    setDigitPanelMode(event.target.value === "absent" ? "absent" : "present")
                  }}
                >
                  <option value="present">May appear</option>
                  <option value="absent">May be absent</option>
                </select>
              </div>

              <div className="avoid-digit-grid">
                {analysisVersion === "v2" && combined ? (
                  <>{(["open", "close"] as const).map((side) => <div className="avoid-digit-column" key={side}>
                    <div className="avoid-digit-column-head"><span className="avoid-digit-label">{side === "open" ? "Open" : "Close"}</span></div>
                    <div className="avoid-digit-row">{(digitPanelMode === "present" ? combined[side].presentDigits : combined[side].absentDigits).map((digit) => <div key={digit} className="avoid-digit-chip"><span className="avoid-digit-number">{digit}</span></div>)}</div>

                  </div>)}</>
                ) : digitPanelMode === "present" ? (
                  <>
                    <PresentDigitColumn label="Open" prediction={presentDigitsPrediction?.open ?? null} />
                    <PresentDigitColumn label="Close" prediction={presentDigitsPrediction?.close ?? null} />
                  </>
                ) : (
                  <>
                    <AvoidDigitColumn label="Open" prediction={absentDigitsPrediction?.open ?? null} />
                    <AvoidDigitColumn label="Close" prediction={absentDigitsPrediction?.close ?? null} />
                  </>
                )}
              </div>
            </div>
          </div>

          <details className="glass-panel analysis-disclosure analysis-open-result">
            <summary>Enter Open result{openSuttaInput !== null && <span> Sutta {openSuttaInput}</span>}</summary>

            <div style={{ marginBottom: "12px" }}>
              <label htmlFor="analysis-open-panel" className="text-sm" style={{ color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "6px" }}>
                Open panel (3 digits)
              </label>
              <input
                id="analysis-open-panel"
                type="tel"
                className="glass-input"
                placeholder="e.g. 368"
                maxLength={3}
                value={openPanelInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 3)
                  setOpenPanelInput(val)
                  if (val.length === 3) {
                    const sutta = calculateSutta(val)
                    setOpenSuttaInput(sutta)
                    runJodiModel(sutta, val)
                  } else {
                    setOpenSuttaInput(null)
                    setJodiResult(null)
                  }
                }}
              />
            </div>

            <p id="analysis-open-sutta-label" className="text-sm" style={{ color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "6px" }}>
              Or select Open Sutta
            </p>
            <div className="sutta-grid" role="group" aria-labelledby="analysis-open-sutta-label">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => (
                <button
                  key={s}
                  aria-pressed={openSuttaInput === s}
                  className={`sutta-cell ${openSuttaInput === s ? "sutta-saturated" : ""}`}
                  style={{
                    borderColor: openSuttaInput === s ? "#f59e0b" : "rgba(255,255,255,0.15)",
                    cursor: "pointer",
                    background: openSuttaInput === s ? "rgba(245,158,11,0.2)" : "transparent",
                  }}
                  onClick={() => {
                    if (openSuttaInput === s) {
                      setOpenSuttaInput(null)
                      setJodiResult(null)
                      setOpenPanelInput("")
                    } else {
                      setOpenSuttaInput(s)
                      setOpenPanelInput("")
                      runJodiModel(s, null)
                    }
                  }}
                >
                  <span className="sutta-number">{s}</span>
                </button>
              ))}
            </div>

            {openSuttaInput !== null && (
              <p style={{ color: "#f59e0b", fontSize: "13px", marginTop: "10px", textAlign: "center" }}>
                Close and Jodi predictions updated
              </p>
            )}
          </details>

          <details className="analysis-disclosure analysis-method">
            <summary>Model details</summary>
            {/* ── Status Bar ───────────────────────────────────────────────── */}
            <div className="status-bar glass-panel">
              <div className="status-item">
                <span className="status-label">2yr Draws</span>
                <span className="status-value">{result.totalDraws.toLocaleString()}</span>
              </div>
              <div className="status-divider" />
              <div className="status-item">
                <span className="status-label">Volume</span>
                <span className="status-value volume-high">{usesSharedDefaults ? "Unrated" : result.volumeTier}</span>
              </div>
              <div className="status-divider" />
              <div className="status-item">
                <span className="status-label">Mode</span>
                <span className={`status-value ${getTemporalBadgeColor(result.temporalMode)}`}>
                  {result.temporalMode}
                </span>
              </div>
              <div className="status-divider" />
              <div className="status-item">
                <span className="status-label">Seq Rate</span>
                <span className="status-value">{result.stats.sequenceRate.toFixed(2)}%</span>
              </div>
            </div>

            {analysisVersion === "v1" && <div className="confidence-strip glass-panel">
              <ConfidenceBadge label="Open" panelHits={backtestReport?.open.panelTop10} panelDraws={backtestReport?.open.n} liveSuttaAcc={suttaAccuracyReport?.open.accuracy} liveSuttaLabel={`7d Top ${copyCount}`} />
              <ConfidenceBadge label="Close" panelHits={backtestReport?.close.panelTop10} panelDraws={backtestReport?.close.n} panelLabel="Close after Open Top 10" liveSuttaAcc={displayedCloseAccuracy?.accuracy} liveSuttaLabel={`7d Top ${copyCount}`} />
              <ConfidenceBadge label="Jodi" panelHits={backtestReport?.jodi.panelTop10} panelDraws={backtestReport?.jodi.n} panelLabel="Close after Open Top 10" liveSuttaAcc={displayedJodiAccuracy?.accuracy} liveSuttaLabel={`7d Top ${copyCount}`} />
            </div>}
            {analysisVersion === "v2" && combined && <p className="analysis-version-description" role="status">
              Target date {combined.targetDate}{combinedState.pending ? " · Updating V2…" : !combinedState.accuracy && !combinedState.error ? " · Backtesting V2…" : ""}
              {combinedState.error ? ` · ${combinedState.error}` : ""}
            </p>}

            {suttaAccuracyReport && (
              <div className="confidence-strip glass-panel" style={{ marginTop: "12px" }}>
                <div className="status-item">
                  <span className="status-label">Open accuracy · Top {copyCount}</span>
                  <span className="status-value">{suttaAccuracyReport.open.label}</span>
                </div>
                <div className="status-divider" />
                <div className="status-item">
                  <span className="status-label">{openSuttaInput === null ? "Close" : "Adjusted Close"} accuracy · Top {copyCount}</span>
                  <span className="status-value">{displayedCloseAccuracy?.label}</span>
                </div>
                <div className="status-divider" />
                <div className="status-item">
                  <span className="status-label">Jodi accuracy · Top {copyCount}</span>
                  <span className="status-value">{displayedJodiAccuracy?.label}</span>
                </div>
                <div className="status-divider" />
                <div className="status-item">
                  <span className="status-label">Backtest window</span>
                  <span className="status-value">
                    {suttaAccuracyReport.startDate}–{suttaAccuracyReport.endDate} · {suttaAccuracyReport.drawsTested} draws
                  </span>
                </div>
                <div className="status-divider" />
                <div className="status-item">
                  <span className="status-label">Sutta model</span>
                  <span className="status-value">{analysisVersion === "v2" ? "V2 combined" : `Production v${SUTTA_MODEL_VERSION}`}</span>
                </div>
              </div>
            )}

          {/* ── Intelligence Cards ───────────────────────────────────────── */}
          <div className="intel-grid">
            <div className="intel-compact-panel">

              <details className="intel-detail">
                <summary className="intel-summary-row">
                  <span className="intel-summary-title">
                    <span className="intel-icon">📅</span>
                    Time of month
                  </span>
                  <span className={`intel-badge intel-badge--compact ${getTemporalBadgeColor(result.temporalMode)}`}>
                    {result.temporalMode}
                  </span>
                </summary>
                <p className="intel-desc intel-detail-copy">
                  {result.temporalMode === "Payday" &&
                    "The model reduces its penalty for popular panels to 0.7×."}
                  {result.temporalMode === "Month-End" &&
                    "The model increases its penalty for popular panels to 1.3×."}
                  {result.temporalMode === "Normal" &&
                    "The model uses its standard penalty for popular panels."}
                </p>
              </details>

              <details className="intel-detail">
                <summary className="intel-summary-row">
                  <span className="intel-summary-title">
                    <span className="intel-icon">💧</span>
                    Source market
                  </span>
                  <span className={`intel-badge intel-badge--compact ${result.liquiditySourceHadPopular ? "intel-danger" : "intel-safe"}`}>
                    {result.liquiditySourceMarket
                      ? result.liquiditySourceHadPopular ? "Popular source" : "Hard source"
                      : "No source"}
                  </span>
                </summary>
                {result.liquiditySourceMarket ? (
                  <>
                    <div className="liquidity-flow liquidity-flow--compact">
                      <span className="liquidity-source">{result.liquiditySourceMarket}</span>
                      <span className="liquidity-arrow">→</span>
                      <span className="liquidity-target">{result.market}</span>
                    </div>
                    <p className="intel-desc intel-detail-copy">
                      {result.liquiditySourceHadPopular
                        ? `The source market drew a sequence. Model multiplier 1.5×.`
                        : `The source market drew a non-sequence result. Model multiplier 0.9×.`}
                    </p>
                  </>
                ) : (
                  <p className="intel-desc intel-detail-copy intel-muted">No source market tracked for {result.market}.</p>
                )}
              </details>

              <details className="intel-detail">
                <summary className="intel-summary-row">
                  <span className="intel-summary-title">
                    <span className="intel-icon">🌵</span>
                    Sequence
                  </span>
                  <span className="drought-summary-text">{result.recordsSinceLastSequence} draws</span>
                </summary>
                <div className="drought-stats drought-stats--compact">
                  <span className="drought-current">{result.recordsSinceLastSequence} draws</span>
                  <span className="drought-avg">avg: {result.averageDroughtLength}</span>
                </div>
                <p className="intel-desc intel-detail-copy">
                  {result.honeyPotAlert
                    ? "The model gives sequence panels extra weight."
                    : result.recordsSinceLastSequence > result.averageDroughtLength
                    ? "More draws than usual since the last sequence."
                    : "Within the usual range."}
                </p>
              </details>
            </div>
          </div>
            {analysisVersion === "v1" && v1Metrics.error && (
              <p className="analysis-version-description">{v1Metrics.error}</p>
            )}
          </details>

          {/* ── Tab Navigation ───────────────────────────────────────────── */}
          <AnalysisTabs
            analysisVersion={analysisVersion}
            updatingCombined={analysisVersion === "v2" && combinedState.pending}
            combinedSpPicks={combined ? { open: combined.open.spPicks, close: combined.close.spPicks } : undefined}
            result={result}
            jodiResult={jodiResult}
            backtestReport={backtestReport}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            picksSubTab={picksSubTab}
            setPicksSubTab={setPicksSubTab}
            selectedMarket={selectedMarket}
            copyingKey={copyingKey}
            handleCopy={handleCopy}
            getScoreColor={getScoreColor}
            pct={pct}
            dpPrecision={dpPrecision}
          />
        </>
      )}

    </section>
  )
}

// ─── Format picks as copyable text ──────────────────────────────────────────────
