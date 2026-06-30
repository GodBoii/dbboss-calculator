"use client"

import { useState, useCallback, useRef } from "react"
import {
  HIGH_VOLUME_MARKETS,
  analyzeMarket,
  computeJodiAnalysis,
  buildContextFromResult,
  calculateSutta,
  getSuttaSignal,
  type PredictionResult,
  type JodiAnalysis,
  type PanelPick,
  type PanelKind,
  type PanelKindPrediction,
  type ModelCalibration,
  type JodiCalibration,
} from "@/lib/predictor"
import { runMarketBacktest, type BacktestReport } from "@/lib/backtest"
import {
  saveRecords,
  getRecordsByMarket,
  clearMarket,
  RECENT_HISTORY_DAYS,
  type PanelRecord,
} from "@/lib/db"
import { AnalysisTabs } from "./analysis/AnalysisTabs"
import { ConfidenceBadge, KindForecastCard } from "./analysis/AnalysisWidgets"

// ── Market URL Config ───────────────────────────────────────────────────
const MARKET_URLS: Record<string, string> = {
  // Day session
  'Sridevi':        'https://dpbossss.boston/panel-chart-record/sridevi.php',
  'Time Bazar':     'https://dpbossss.boston/panel-chart-record/time-bazar.php',
  'Madhur Day':     'https://dpbossss.boston/panel-chart-record/madhur-day.php',
  'Milan Day':      'https://dpbossss.boston/panel-chart-record/milan-day.php',
  'Rajdhani Day':   'https://dpbossss.boston/panel-chart-record/rajdhani-day.php',
  'Kalyan':         'https://dpbossss.boston/panel-chart-record/kalyan.php',
  // Night session
  'Sridevi Night':  'https://dpbossss.boston/panel-chart-record/sridevi-night.php',
  'Madhur Night':   'https://dpbossss.boston/panel-chart-record/madhur-night.php',
  'Milan Night':    'https://dpbossss.boston/panel-chart-record/milan-night.php',
  'Rajdhani Night': 'https://dpbossss.boston/panel-chart-record/rajdhani-night.php',
  'Main Bazar':     'https://dpbossss.boston/panel-chart-record/main-bazar.php',
}

const DAY_MARKETS   = ['Sridevi', 'Time Bazar', 'Madhur Day', 'Milan Day', 'Rajdhani Day', 'Kalyan']
const NIGHT_MARKETS = ['Sridevi Night', 'Madhur Night', 'Milan Night', 'Rajdhani Night', 'Main Bazar']



type LoadingState = "idle" | "fetching" | "analyzing" | "done" | "error"

// ─── Component ────────────────────────────────────────────────────────────────
type Session = "day" | "night"

export default function AnalysisSection() {
  // Auto-detect session: night if hour >= 18 (6pm IST)
  const defaultSession: Session = (() => {
    const h = new Date().getHours()
    return h >= 18 || h < 6 ? "night" : "day"
  })()

  const [session, setSession] = useState<Session>(defaultSession)
  const [selectedMarket, setSelectedMarket] = useState<string>(
    defaultSession === "night" ? "Main Bazar" : "Kalyan"
  )
  const [loadingState, setLoadingState] = useState<LoadingState>("idle")
  const [loadingMessage, setLoadingMessage] = useState("")
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [cachedCount, setCachedCount] = useState<number | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [activeTab, setActiveTab] = useState<"picks" | "stats" | "intel">("picks")
  const [picksSubTab, setPicksSubTab] = useState<"open" | "close" | "jodi">("open")
  const [openSuttaInput, setOpenSuttaInput] = useState<number | null>(null)
  const [openPanelInput, setOpenPanelInput] = useState("")
  const [jodiResult, setJodiResult] = useState<JodiAnalysis | null>(null)
  const [backtestReport, setBacktestReport] = useState<BacktestReport | null>(null)
  const cachedRecordsRef = useRef<PanelRecord[]>([])

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
    if (!result) return
    const ctx = buildContextFromResult(result)
    const analysis = computeJodiAnalysis(sutta, panelStr, cachedRecordsRef.current, ctx, result.closeDpKindContext)
    setJodiResult(analysis)
    setPicksSubTab("jodi")
  }, [result])

  const fetchAndAnalyze = useCallback(
    async (forceRefresh = false) => {
      setLoadingState("fetching")
      setErrorMsg("")
      setResult(null)
      setJodiResult(null)
      setBacktestReport(null)
      setOpenSuttaInput(null)
      setOpenPanelInput("")

      try {
        let records: PanelRecord[]

        // ── Step 1: Check IndexedDB cache ──────────────────────────────────
        if (forceRefresh) {
          setLoadingMessage("Clearing cache…")
          await clearMarket(selectedMarket)
        }

        const cached = await getRecordsByMarket(selectedMarket)
        const newestCachedAt = cached.reduce((max, record) => Math.max(max, record.savedAt ?? 0), 0)
        const cacheIsFresh = newestCachedAt > 0 && Date.now() - newestCachedAt < 6 * 60 * 60 * 1000

        if (cached.length > 50 && cacheIsFresh && !forceRefresh) {
          // We have enough cached data — skip scraping
          setLoadingMessage(`Using ${cached.length} cached recent records (${RECENT_HISTORY_DAYS} days)…`)
          records = cached
          setCachedCount(cached.length)
        } else {
          // ── Step 2: Fetch fresh data via proxy API ─────────────────────
          setLoadingMessage("Fetching panel chart data…")
          const url = MARKET_URLS[selectedMarket]
          const apiUrl = `/api/scrape?url=${encodeURIComponent(url)}&market=${encodeURIComponent(selectedMarket)}`

          const res = await fetch(apiUrl)
          if (!res.ok) {
            const body = await res.json().catch(() => ({ error: res.statusText }))
            throw new Error(body.error ?? `HTTP ${res.status}`)
          }

          const json = await res.json()
          const freshPanels = json.panels as Array<{
            market: string
            dateRangeStart: string
            dateRangeEnd: string
            day: string
            openPanel: string
            openSutta: number
            jodi: string
            closePanel: string
            closeSutta: number
          }>

          if (!freshPanels || freshPanels.length === 0) {
            throw new Error("No draws parsed from site. Site may be down or structure changed.")
          }

          // ── Step 3: Save to IndexedDB ──────────────────────────────────
          setLoadingMessage(`Saving ${freshPanels.length} recent draws to local storage…`)
          const now = Date.now()
          const toSave: PanelRecord[] = freshPanels.map((p) => ({
            id: `${p.market}|${p.dateRangeStart}|${p.day}`,
            ...p,
            savedAt: now,
          }))
          await saveRecords(toSave)

          // Merge with any existing cached records (deduplicated by id via IndexedDB upsert)
          const allRecords = await getRecordsByMarket(selectedMarket)
          records = allRecords
          setCachedCount(records.length)
        }

        // ── Step 4: Fetch data for liquidity source market ─────────────────
        setLoadingState("analyzing")
        setLoadingMessage("Running Game-Theory analysis…")

        // Build allMarketsRecords map for liquidity correlation
        const allMarketsRecords: Record<string, PanelRecord[]> = {}
        allMarketsRecords[selectedMarket] = records

        // Load source market from IndexedDB (if we have it cached)
        for (const m of HIGH_VOLUME_MARKETS) {
          if (m !== selectedMarket) {
            const r = await getRecordsByMarket(m)
            if (r.length > 0) allMarketsRecords[m] = r
          }
        }

        // ── Step 5: Run predictor ──────────────────────────────────────────
        cachedRecordsRef.current = records
        const prediction = analyzeMarket(selectedMarket, records, allMarketsRecords)
        if (!prediction) throw new Error("Not enough data to generate predictions.")

        setBacktestReport(runMarketBacktest(selectedMarket, records, allMarketsRecords, { days: 30 }))
        setResult(prediction)
        setLoadingState("done")
      } catch (err) {
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
    if (score >= 50) return "#facc15"   // yellow
    return "#f87171"                     // red
  }

  const getSuttaColor = (drought: number) => {
    return getSuttaSignal(drought).color
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
    haptic()
    setSession(s)
    setSelectedMarket(s === "day" ? "Kalyan" : "Main Bazar")
    setResult(null)
    setBacktestReport(null)
    setLoadingState("idle")
    setCachedCount(null)
  }

  const activeMarkets = session === "day" ? DAY_MARKETS : NIGHT_MARKETS
  const isNight = session === "night"
  const displayedSuttaDroughts = result
    ? picksSubTab === "open"
      ? result.combinedSuttaDroughts
      : result.closeSuttaDroughts
    : null

  return (
    <section className="analysis-section">
      {/* ── Market Selector ─────────────────────────────────────────── */}
      <div className="glass-panel">
        <div className="section-header">
          <span className="section-icon">🎯</span>
          <div>
            <h2 className="section-title">Select Market</h2>
            <p className="section-subtitle">Choose session, then pick your market</p>
          </div>
        </div>

        {/* Session Toggle */}
        <div className="session-toggle">
          <button
            className={`session-toggle-btn session-toggle-btn--day ${!isNight ? "session-toggle-btn--active" : ""}`}
            onClick={() => switchSession("day")}
          >
            ☀️ Day
          </button>
          <button
            className={`session-toggle-btn session-toggle-btn--night ${isNight ? "session-toggle-btn--active" : ""}`}
            onClick={() => switchSession("night")}
          >
            🌙 Night
          </button>
        </div>

        {/* Filtered Market List */}
        <div className="market-grid">
          {activeMarkets.map((market) => (
            <button
              key={market}
              id={`market-${market.replace(/\s+/g, "-").toLowerCase()}`}
              className={`market-btn ${isNight ? "market-btn-night" : ""} ${selectedMarket === market ? "active" : ""}`}
              onClick={() => {
                haptic()
                setSelectedMarket(market)
                setResult(null)
                setBacktestReport(null)
                setLoadingState("idle")
                setCachedCount(null)
              }}
            >
              {market}
            </button>
          ))}
        </div>
      </div>


      {/* ── Action Buttons ────────────────────────────────────────────────── */}
      <div className="action-row">
        <button
          id="btn-analyze"
          className="analyze-btn"
          onClick={() => fetchAndAnalyze(false)}
          disabled={loadingState === "fetching" || loadingState === "analyzing"}
        >
          {loadingState === "fetching" || loadingState === "analyzing" ? (
            <span className="btn-loading">
              <span className="spinner" />
              Analyzing…
            </span>
          ) : (
            <>🔮 Analyze {selectedMarket}</>
          )}
        </button>

        {result && (
          <button
            id="btn-refresh"
            className="refresh-btn"
            onClick={() => fetchAndAnalyze(true)}
            disabled={loadingState === "fetching" || loadingState === "analyzing"}
          >
            🔄 Fresh Data
          </button>
        )}
      </div>

      {/* ── Loading State ─────────────────────────────────────────────────── */}
      {(loadingState === "fetching" || loadingState === "analyzing") && (
        <div className="glass-panel loading-panel">
          <div className="loading-steps">
            <div className={`loading-step ${loadingState === "fetching" ? "active" : "done"}`}>
              <span className="step-icon">{loadingState === "analyzing" ? "✓" : "⏳"}</span>
              <span>Fetching panel chart data</span>
            </div>
            <div className={`loading-step ${loadingState === "analyzing" ? "active" : ""}`}>
              <span className="step-icon">{loadingState === "analyzing" ? "⏳" : "○"}</span>
              <span>Running Game-Theory Engine</span>
            </div>
          </div>
          <p className="loading-msg">{loadingMessage}</p>
        </div>
      )}

      {/* ── Error State ──────────────────────────────────────────────────── */}
      {loadingState === "error" && (
        <div className="glass-panel error-panel">
          <p className="error-icon">⚠️</p>
          <p className="error-title">Analysis Failed</p>
          <p className="error-msg">{errorMsg}</p>
          <button className="retry-btn" onClick={() => fetchAndAnalyze(false)}>
            Try Again
          </button>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {result && loadingState === "done" && (
        <>
          {/* ── Status Bar ───────────────────────────────────────────────── */}
          <div className="status-bar glass-panel">
            <div className="status-item">
              <span className="status-label">2yr Draws</span>
              <span className="status-value">{result.totalDraws.toLocaleString()}</span>
            </div>
            <div className="status-divider" />
            <div className="status-item">
              <span className="status-label">Volume</span>
              <span className="status-value volume-high">{result.volumeTier}</span>
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

          <div className="confidence-strip glass-panel">
            <ConfidenceBadge label="Open" model={result.calibration.open} />
            <ConfidenceBadge label="Close" model={result.calibration.close} />
            <ConfidenceBadge label="Jodi" model={result.calibration.jodi} />
          </div>

          <div className="confidence-strip glass-panel">
            <KindForecastCard label="Open Kind" prediction={result.openKindPrediction} />
            <KindForecastCard label="Close Kind" prediction={result.closeKindPrediction} />
            {jodiResult && <KindForecastCard label="Jodi Close Kind" prediction={jodiResult.kindPrediction} />}
          </div>

          {/* ── HONEY-POT ALERT ──────────────────────────────────────────── */}
          {result.honeyPotAlert && (
            <div className="honeypot-alert glass-panel">
              <div className="honeypot-header">
                <span className="honeypot-icon">🍯</span>
                <div>
                  <h3 className="honeypot-title">HONEY-POT TRAP ALERT</h3>
                  <p className="honeypot-subtitle">
                    {result.recordsSinceLastSequence} draws without a sequence
                    (avg: {result.averageDroughtLength})
                  </p>
                </div>
              </div>
              <p className="honeypot-desc">
                The drought has significantly exceeded the historical average. Per Game-Theory,
                the operator is mathematically due to spring a sequence trap to retain addicted bettors.
                Sequential panels have been given a <strong>BONUS score</strong> this session.
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

          {/* ── Intelligence Cards ───────────────────────────────────────── */}
          <div className="intel-grid">
            {/* Temporal Card */}
            <div className="intel-card glass-panel">
              <div className="intel-card-header">
                <span className="intel-icon">📅</span>
                <h3 className="intel-card-title">Temporal Signal</h3>
              </div>
              <div className={`intel-badge ${getTemporalBadgeColor(result.temporalMode)}`}>
                {result.temporalMode === "Payday" && "🔴 PAYDAY ZONE"}
                {result.temporalMode === "Month-End" && "🟢 MONTH-END ZONE"}
                {result.temporalMode === "Normal" && "⚪ NORMAL ZONE"}
              </div>
              <p className="intel-desc">
                {result.temporalMode === "Payday" &&
                  "Public has fresh salary. Operator drops popular 'honey-pot' sequences as bait to hook new players. Penalties REDUCED. Multiplier: 0.7×"}
                {result.temporalMode === "Month-End" &&
                  "Public is broke. Operator squeezes remaining bettors with hard, unpopular numbers. Penalties INCREASED. Multiplier: 1.3×"}
                {result.temporalMode === "Normal" &&
                  "Mid-month cycle. Standard liability-minimization mode. Multiplier: 1.0×"}
              </p>
            </div>

            {/* Liquidity Card */}
            <div className="intel-card glass-panel">
              <div className="intel-card-header">
                <span className="intel-icon">💧</span>
                <h3 className="intel-card-title">Liquidity Flow</h3>
              </div>
              {result.liquiditySourceMarket ? (
                <>
                  <div className="liquidity-flow">
                    <span className="liquidity-source">{result.liquiditySourceMarket}</span>
                    <span className="liquidity-arrow">→</span>
                    <span className="liquidity-target">{result.market}</span>
                  </div>
                  <div className={`intel-badge ${result.liquiditySourceHadPopular ? "intel-danger" : "intel-safe"}`}>
                    {result.liquiditySourceHadPopular
                      ? "🔴 Source had POPULAR result"
                      : "🟢 Source had HARD result"}
                  </div>
                  <p className="intel-desc">
                    {result.liquiditySourceHadPopular
                      ? `${result.liquiditySourceMarket} just dropped a sequence. Public won big and will chase here. House will brutally wipe popular numbers. Multiplier: 1.5×`
                      : `${result.liquiditySourceMarket} had a hard result. Public is cautious. House is slightly more relaxed. Multiplier: 0.9×`}
                  </p>
                </>
              ) : (
                <p className="intel-desc intel-muted">No source market tracked for {result.market}.</p>
              )}
            </div>

            {/* Drought Card */}
            <div className="intel-card glass-panel">
              <div className="intel-card-header">
                <span className="intel-icon">🌵</span>
                <h3 className="intel-card-title">Sequence Drought</h3>
              </div>
              <div className="drought-bar-container">
                <div
                  className="drought-bar-fill"
                  style={{
                    width: `${Math.min(100, (result.recordsSinceLastSequence / Math.max(result.averageDroughtLength * 2, 1)) * 100)}%`,
                    background: result.honeyPotAlert
                      ? "linear-gradient(90deg, #f97316, #ef4444)"
                      : "linear-gradient(90deg, #22c55e, #facc15)",
                  }}
                />
              </div>
              <div className="drought-stats">
                <span className="drought-current">{result.recordsSinceLastSequence} draws</span>
                <span className="drought-avg">avg: {result.averageDroughtLength}</span>
              </div>
              <p className="intel-desc">
                {result.honeyPotAlert
                  ? "⚠️ Critical drought. Trap is mathematically imminent."
                  : result.recordsSinceLastSequence > result.averageDroughtLength
                  ? "Getting hot — above average drought length."
                  : "Within normal drought range."}
              </p>
            </div>
          </div>

          {/* ── Sutta Saturation Map ──────────────────────────────────────── */}
          <div className="glass-panel">
            <div className="section-header">
              <span className="section-icon">🎰</span>
              <div>
                <h3 className="section-title">Sutta Signal Map</h3>
                <p className="section-subtitle">
                  Red = heated risk, blue = extreme snapback, green = fresh
                </p>
              </div>
            </div>
            <div className="sutta-grid">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => {
                const drought = displayedSuttaDroughts?.[String(s)] ?? 1000
                const signal = getSuttaSignal(drought)
                const isHot = signal.state === "danger" || signal.state === "snapback"
                return (
                  <div
                    key={s}
                    className={`sutta-cell ${isHot ? "sutta-saturated" : ""}`}
                    style={{ borderColor: signal.color }}
                    title={signal.description}
                  >
                    <span className="sutta-number">{s}</span>
                    <span className="sutta-drought" style={{ color: signal.color }}>
                      {drought === 1000 ? "???" : `${drought}d`}
                    </span>
                    {isHot && <span className={`sutta-sat-label sutta-sat-label--${signal.state}`}>{signal.label}</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Jodi Dependency Model Input ────────────────────────────────── */}
          <div className="glass-panel">
            <div className="section-header">
              <span className="section-icon">🎯</span>
              <div>
                <h3 className="section-title">Jodi Model — Real-Time Close Prediction</h3>
                <p className="section-subtitle">Enter today&apos;s Open result to unlock dynamic Close predictions</p>
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label className="text-sm" style={{ color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "6px" }}>
                Open Panel (3 digits) — auto-computes Sutta
              </label>
              <input
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

            <label className="text-sm" style={{ color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "6px" }}>
              Or select Open Sutta directly
            </label>
            <div className="sutta-grid">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => (
                <button
                  key={s}
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
                ✅ Open Sutta = <strong>{openSuttaInput}</strong>
                {openPanelInput.length === 3 && <> (Panel: <strong>{openPanelInput}</strong>)</>}
                {" "}— Jodi Close predictions active
              </p>
            )}
          </div>

          {/* ── Tab Navigation ───────────────────────────────────────────── */}
          <AnalysisTabs
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

          {/* ── Empty State ──────────────────────────────────────────────────── */}
      {loadingState === "idle" && (
        <div className="empty-state glass-panel">
          <span className="empty-icon">🔮</span>
          <h3 className="empty-title">Select a market above</h3>
          <p className="empty-desc">
            The engine will scrape live panel data, store it in your device, and run the
            6-factor Game-Theory analysis to generate intelligent picks.
          </p>
          <div className="empty-facts">
            <div className="fact-item">
              <span className="fact-num">0.23%</span>
              <span className="fact-label">Actual Triple rate (vs 4.5% random)</span>
            </div>
            <div className="fact-item">
              <span className="fact-num">21</span>
              <span className="fact-label">Avg draws between sequences in Kalyan</span>
            </div>
            <div className="fact-item">
              <span className="fact-num">1.5×</span>
              <span className="fact-label">Penalty multiplier after source market popular hit</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Format picks as copyable text ──────────────────────────────────────────────
