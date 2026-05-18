"use client"

import { useState, useCallback, useRef } from "react"
import {
  HIGH_VOLUME_MARKETS,
  analyzeMarket,
  computeJodiAnalysis,
  buildContextFromResult,
  calculateSutta,
  type PredictionResult,
  type JodiAnalysis,
  type PanelPick,
} from "@/lib/predictor"
import {
  saveRecords,
  getRecordsByMarket,
  clearMarket,
  type PanelRecord,
} from "@/lib/db"

// ── Market URL Config ───────────────────────────────────────────────────
const MARKET_URLS: Record<string, string> = {
  // Day session
  'Sridevi':        'https://dpbosss.net.in/sridevi-penal-chart-record.php',
  'Time Bazar':     'https://dpbosss.net.in/time-bazar-panel.php',
  'Madhur Day':     'https://dpbosss.net.in/madhur-day-panel-chart.php',
  'Milan Day':      'https://dpbosss.net.in/milan-day-panel.php',
  'Rajdhani Day':   'https://dpbosss.net.in/rajdhani-day-panel-chart.php',
  'Kalyan':         'https://dpbosss.net.in/kalyan-panel-chart.php',
  // Night session
  'Sridevi Night':  'https://dpbosss.net.in/sridevi-night-panel-chart.php',
  'Madhur Night':   'https://dpbosss.net.in/madhuri-night-panel-chart.php',  // note: "madhuri" in slug
  'Milan Night':    'https://dpbosss.net.in/milan-night-panel.php',
  'Kalyan Night':   'https://dpbosss.net.in/kalyan-night-penal.php',
  'Rajdhani Night': 'https://dpbosss.net.in/rajdhani-night-panel.php',
  'Main Bazar':     'https://dpbosss.net.in/main-bazar-panel-chart.php',
}

const DAY_MARKETS   = ['Sridevi', 'Time Bazar', 'Madhur Day', 'Milan Day', 'Rajdhani Day', 'Kalyan']
const NIGHT_MARKETS = ['Sridevi Night', 'Madhur Night', 'Milan Night', 'Kalyan Night', 'Rajdhani Night', 'Main Bazar']



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
    defaultSession === "night" ? "Kalyan Night" : "Kalyan"
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
    const analysis = computeJodiAnalysis(sutta, panelStr, cachedRecordsRef.current, ctx)
    setJodiResult(analysis)
    setPicksSubTab("jodi")
  }, [result])

  const fetchAndAnalyze = useCallback(
    async (forceRefresh = false) => {
      setLoadingState("fetching")
      setErrorMsg("")
      setResult(null)
      setJodiResult(null)
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

        if (cached.length > 50 && !forceRefresh) {
          // We have enough cached data — skip scraping
          setLoadingMessage(`Using ${cached.length} cached records…`)
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
          setLoadingMessage(`Saving ${freshPanels.length} draws to local storage…`)
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
    if (drought === 1000) return "#6b7280"  // never seen = grey
    if (drought > 8) return "#f87171"       // saturated = red (penalised)
    if (drought > 4) return "#facc15"       // getting warm = yellow
    return "#4ade80"                         // fresh = green
  }

  const haptic = (ms = 8) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms)
  }

  const switchSession = (s: Session) => {
    haptic()
    setSession(s)
    setSelectedMarket(s === "day" ? "Kalyan" : "Kalyan Night")
    setResult(null)
    setLoadingState("idle")
    setCachedCount(null)
  }

  const activeMarkets = session === "day" ? DAY_MARKETS : NIGHT_MARKETS
  const isNight = session === "night"

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
              <span className="status-label">Draws</span>
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
                <h3 className="section-title">Sutta Drought Map</h3>
                <p className="section-subtitle">
                  Red = Saturated (public betting heavy → house will avoid) · Green = Fresh
                </p>
              </div>
            </div>
            <div className="sutta-grid">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => {
                const drought = result.suttaDroughts[String(s)] ?? 1000
                const isSat = result.saturatedSuttas.includes(String(s))
                return (
                  <div
                    key={s}
                    className={`sutta-cell ${isSat ? "sutta-saturated" : ""}`}
                    style={{ borderColor: getSuttaColor(drought) }}
                  >
                    <span className="sutta-number">{s}</span>
                    <span className="sutta-drought" style={{ color: getSuttaColor(drought) }}>
                      {drought === 1000 ? "???" : `${drought}d`}
                    </span>
                    {isSat && <span className="sutta-sat-label">SAT</span>}
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
          <div className="glass-panel tab-panel">
            <div className="tab-nav">
              {(["picks", "stats", "intel"] as const).map((tab) => (
                <button
                  key={tab}
                  id={`tab-${tab}`}
                  className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "picks" && "🏆 Predictions"}
                  {tab === "stats" && "📊 Stats"}
                  {tab === "intel" && "🧠 Breakdown"}
                </button>
              ))}
            </div>

            {/* ── PREDICTIONS TAB ────────────────────────────────────────── */}
            {activeTab === "picks" && (
              <div className="picks-section">
                {/* Sub-tab navigation: Open | Close | Jodi Close */}
                <div className="tab-nav" style={{ marginBottom: "12px", gap: "4px" }}>
                  <button
                    className={`tab-btn ${picksSubTab === "open" ? "active" : ""}`}
                    onClick={() => setPicksSubTab("open")}
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >📈 Open</button>
                  <button
                    className={`tab-btn ${picksSubTab === "close" ? "active" : ""}`}
                    onClick={() => setPicksSubTab("close")}
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >📉 Close</button>
                  <button
                    className={`tab-btn ${picksSubTab === "jodi" ? "active" : ""}`}
                    onClick={() => setPicksSubTab("jodi")}
                    style={{
                      fontSize: "12px", padding: "6px 12px",
                      opacity: jodiResult ? 1 : 0.4,
                    }}
                    disabled={!jodiResult}
                  >🎯 Jodi Close</button>
                </div>

                {/* ── Open Picks ──────────────────────────────────────────── */}
                {picksSubTab === "open" && (
                  <>
                    <div className="picks-hint-row">
                      <p className="picks-hint" style={{ margin: 0 }}>
                        Open panel predictions — scored against Open-position history only
                      </p>
                      <CopyButton
                        label="Copy Open"
                        isCopied={copyingKey === "open"}
                        onClick={() =>
                          handleCopy(
                            "open",
                            formatPicksForCopy(result.openPicks, `${selectedMarket} — Open Picks`)
                          )
                        }
                      />
                    </div>
                    <PicksList picks={result.openPicks} getScoreColor={getScoreColor} />
                  </>
                )}

                {/* ── Close Picks ─────────────────────────────────────────── */}
                {picksSubTab === "close" && (
                  <>
                    <div className="picks-hint-row">
                      <p className="picks-hint" style={{ margin: 0 }}>
                        Close panel predictions — scored against Close-position history only
                      </p>
                      <CopyButton
                        label="Copy Close"
                        isCopied={copyingKey === "close"}
                        onClick={() =>
                          handleCopy(
                            "close",
                            formatPicksForCopy(result.closePicks, `${selectedMarket} — Close Picks`)
                          )
                        }
                      />
                    </div>
                    <PicksList picks={result.closePicks} getScoreColor={getScoreColor} />
                  </>
                )}

                {/* ── Jodi-Adjusted Close Picks ──────────────────────────── */}
                {picksSubTab === "jodi" && jodiResult && (
                  <>
                    <p className="picks-hint">
                      Close predictions adjusted for Jodi liability with Open Sutta = <strong>{jodiResult.openSutta}</strong>
                    </p>

                    {/* Jodi frequency chart */}
                    <div style={{ marginBottom: "16px" }}>
                      <h4 className="stat-section-title">Jodi Liability Map</h4>
                      <p className="picks-hint" style={{ marginBottom: "8px" }}>
                        Shows how often each Jodi ({jodiResult.openSutta}X) appeared historically.
                        Popular Jodis = high liability = operator will AVOID that Close Sutta.
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        {jodiResult.jodiFrequencies.map((jf) => {
                          const isBlack = jodiResult.blacklistedCloseSuttas.includes(jf.closeSutta)
                          const isSafe = jodiResult.safeCloseSuttas.includes(jf.closeSutta)
                          return (
                            <div key={jf.jodi} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{
                                width: "28px", textAlign: "center", fontWeight: 700, fontSize: "13px",
                                color: isBlack ? "#f87171" : isSafe ? "#4ade80" : "rgba(255,255,255,0.7)",
                              }}>{jf.jodi}</span>
                              <div style={{ flex: 1, height: "16px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
                                <div style={{
                                  width: `${Math.min(100, jf.percentage * 5)}%`,
                                  height: "100%",
                                  borderRadius: "4px",
                                  background: isBlack ? "linear-gradient(90deg, #ef4444, #f87171)" : isSafe ? "linear-gradient(90deg, #22c55e, #4ade80)" : "linear-gradient(90deg, #6b7280, #9ca3af)",
                                }} />
                              </div>
                              <span style={{ width: "50px", textAlign: "right", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                                {jf.percentage}%
                              </span>
                              {isBlack && <span style={{ fontSize: "10px", color: "#f87171" }}>AVOID</span>}
                              {isSafe && <span style={{ fontSize: "10px", color: "#4ade80" }}>SAFE</span>}
                            </div>
                          )
                        })}
                      </div>
                      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px", marginTop: "6px" }}>
                        Based on {jodiResult.totalMatchingDraws} historical draws with Open Sutta = {jodiResult.openSutta}
                      </p>
                    </div>

                    {/* Blacklisted / Safe summary */}
                    <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
                      {jodiResult.blacklistedCloseSuttas.length > 0 && (
                        <div style={{ flex: 1, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "8px 12px" }}>
                          <span style={{ fontSize: "11px", color: "#f87171", fontWeight: 600 }}>🚫 BLACKLISTED CLOSE SUTTAS</span>
                          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                            {jodiResult.blacklistedCloseSuttas.map((s) => (
                              <span key={s} style={{ background: "rgba(239,68,68,0.2)", padding: "2px 8px", borderRadius: "4px", fontWeight: 700, color: "#f87171" }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {jodiResult.safeCloseSuttas.length > 0 && (
                        <div style={{ flex: 1, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "8px", padding: "8px 12px" }}>
                          <span style={{ fontSize: "11px", color: "#4ade80", fontWeight: 600 }}>✅ SAFE CLOSE SUTTAS</span>
                          <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                            {jodiResult.safeCloseSuttas.map((s) => (
                              <span key={s} style={{ background: "rgba(34,197,94,0.2)", padding: "2px 8px", borderRadius: "4px", fontWeight: 700, color: "#4ade80" }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Adjusted picks */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                      <h4 className="stat-section-title" style={{ margin: 0 }}>Jodi-Adjusted Close Panels</h4>
                      <CopyButton
                        label="Copy Jodi"
                        isCopied={copyingKey === "jodi"}
                        onClick={() =>
                          handleCopy(
                            "jodi",
                            formatPicksForCopy(
                              jodiResult.adjustedClosePicks,
                              `${selectedMarket} — Jodi Close (Open Sutta=${jodiResult.openSutta})`
                            )
                          )
                        }
                      />
                    </div>
                    <PicksList picks={jodiResult.adjustedClosePicks} getScoreColor={getScoreColor} />
                  </>
                )}

                {picksSubTab === "jodi" && !jodiResult && (
                  <div style={{ textAlign: "center", padding: "30px 16px", color: "rgba(255,255,255,0.4)" }}>
                    <p style={{ fontSize: "32px", marginBottom: "8px" }}>🎯</p>
                    <p>Enter today&apos;s Open result above to unlock Jodi-adjusted Close predictions</p>
                  </div>
                )}
              </div>
            )}

            {/* ── STATS TAB ─────────────────────────────────────────────── */}
            {activeTab === "stats" && (
              <div className="stats-section">
                <div className="stat-row">
                  <span className="stat-label">Total Draws</span>
                  <span className="stat-value">{result.stats.totalDraws.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Sequences (actual)</span>
                  <span className="stat-value stat-warn">{result.stats.sequenceRate.toFixed(2)}%</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Sequences (expected random)</span>
                  <span className="stat-value">~5.45%</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Triples (actual)</span>
                  <span className="stat-value stat-danger">{result.stats.tripleRate.toFixed(2)}%</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Triples (expected random)</span>
                  <span className="stat-value">~4.55%</span>
                </div>

                <div className="stat-divider" />
                <h4 className="stat-section-title">Top Open Panels</h4>
                <div className="freq-grid">
                  {result.stats.topOpenPanels.map(({ panel, count }) => (
                    <div key={panel} className="freq-item">
                      <span className="freq-panel">{panel}</span>
                      <span className="freq-count">{count}×</span>
                    </div>
                  ))}
                </div>

                <div className="stat-divider" />
                <h4 className="stat-section-title">Top Close Panels</h4>
                <div className="freq-grid">
                  {result.stats.topClosePanels.map(({ panel, count }) => (
                    <div key={panel} className="freq-item">
                      <span className="freq-panel">{panel}</span>
                      <span className="freq-count">{count}×</span>
                    </div>
                  ))}
                </div>

                {result.stats.topJodis.length > 0 && (
                  <>
                    <div className="stat-divider" />
                    <h4 className="stat-section-title">Top 10 Jodis</h4>
                    <div className="freq-grid">
                      {result.stats.topJodis.map(({ jodi, count }) => (
                        <div key={jodi} className="freq-item">
                          <span className="freq-panel">{jodi}</span>
                          <span className="freq-count">{count}×</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="stat-divider" />
                <h4 className="stat-section-title">Sutta Distribution</h4>
                <div className="sutta-dist">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => {
                    const count = result.stats.suttaDistribution[String(s)] ?? 0
                    const maxCount = Math.max(...Object.values(result.stats.suttaDistribution), 1)
                    return (
                      <div key={s} className="sutta-dist-row">
                        <span className="sutta-dist-label">{s}</span>
                        <div className="sutta-dist-bar-bg">
                          <div
                            className="sutta-dist-bar-fill"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className="sutta-dist-count">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── INTEL / BREAKDOWN TAB ─────────────────────────────────── */}
            {activeTab === "intel" && (
              <div className="intel-section">
                <h4 className="stat-section-title">Score Breakdown (Top 10)</h4>
                <p className="picks-hint">
                  How each penalty factor contributed to the final score
                </p>
                {result.topPicks.slice(0, 10).map((pick) => (
                  <div key={pick.panel} className="breakdown-row">
                    <div className="breakdown-header">
                      <span className="breakdown-panel">{pick.panel}</span>
                      <span className="breakdown-score" style={{ color: getScoreColor(pick.score) }}>
                        {pick.score.toFixed(1)} pts
                      </span>
                    </div>
                    <div className="breakdown-bars">
                      <div className="breakdown-item">
                        <span className="bd-label">Recency</span>
                        <div className="bd-bar-bg">
                          <div className="bd-bar-fill bd-green" style={{ width: `${pick.breakdown.recencyScore}%` }} />
                        </div>
                        <span className="bd-val">+{pick.breakdown.recencyScore.toFixed(1)}</span>
                      </div>
                      {pick.breakdown.seqPenalty !== 0 && (
                        <div className="breakdown-item">
                          <span className="bd-label">Seq {pick.breakdown.seqPenalty < 0 ? "Bonus" : "Penalty"}</span>
                          <div className="bd-bar-bg">
                            <div
                              className={`bd-bar-fill ${pick.breakdown.seqPenalty < 0 ? "bd-green" : "bd-red"}`}
                              style={{ width: `${Math.abs(pick.breakdown.seqPenalty)}%` }}
                            />
                          </div>
                          <span className="bd-val" style={{ color: pick.breakdown.seqPenalty < 0 ? "#4ade80" : "#f87171" }}>
                            {pick.breakdown.seqPenalty < 0 ? "+" : "-"}{Math.abs(pick.breakdown.seqPenalty).toFixed(1)}
                          </span>
                        </div>
                      )}
                      {pick.breakdown.luckyPenalty > 0 && (
                        <div className="breakdown-item">
                          <span className="bd-label">Lucky Penalty</span>
                          <div className="bd-bar-bg">
                            <div className="bd-bar-fill bd-orange" style={{ width: `${pick.breakdown.luckyPenalty}%` }} />
                          </div>
                          <span className="bd-val bd-orange-text">-{pick.breakdown.luckyPenalty.toFixed(1)}</span>
                        </div>
                      )}
                      {pick.breakdown.saturationPenalty > 0 && (
                        <div className="breakdown-item">
                          <span className="bd-label">Sutta Sat.</span>
                          <div className="bd-bar-bg">
                            <div className="bd-bar-fill bd-red" style={{ width: `${pick.breakdown.saturationPenalty}%` }} />
                          </div>
                          <span className="bd-val" style={{ color: "#f87171" }}>-{pick.breakdown.saturationPenalty}</span>
                        </div>
                      )}
                      {pick.breakdown.cooldownPenalty > 0 && (
                        <div className="breakdown-item">
                          <span className="bd-label">Cooldown</span>
                          <div className="bd-bar-bg">
                            <div className="bd-bar-fill bd-red" style={{ width: `${pick.breakdown.cooldownPenalty}%` }} />
                          </div>
                          <span className="bd-val" style={{ color: "#f87171" }}>-{pick.breakdown.cooldownPenalty}</span>
                        </div>
                      )}
                      {pick.breakdown.dayBoost > 0 && (
                        <div className="breakdown-item">
                          <span className="bd-label">Day Boost</span>
                          <div className="bd-bar-bg">
                            <div className="bd-bar-fill bd-green" style={{ width: `${pick.breakdown.dayBoost}%` }} />
                          </div>
                          <span className="bd-val" style={{ color: "#4ade80" }}>+{pick.breakdown.dayBoost.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
function formatPicksForCopy(picks: PanelPick[], _header: string): string {
  return picks.map((p) => p.panel).join("-")
}

// ─── CopyButton Component ────────────────────────────────────────────────────
function CopyButton({ label, isCopied, onClick }: { label: string; isCopied: boolean; onClick: () => void }) {
  return (
    <button
      className={`copy-btn ${isCopied ? "copy-btn-success" : ""}`}
      onClick={onClick}
      title={isCopied ? "Copied!" : "Copy results to clipboard"}
    >
      {isCopied ? "✅ Copied!" : `📋 ${label}`}
    </button>
  )
}

// ─── Reusable Picks List Component ─────────────────────────────────────────────
function PicksList({ picks, getScoreColor }: { picks: PanelPick[]; getScoreColor: (s: number) => string }) {
  if (!picks || picks.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.4)" }}>
        No predictions available for this position.
      </div>
    )
  }
  return (
    <>
      {/* Top 3 Hero Picks */}
      <div className="hero-picks">
        {picks.slice(0, 3).map((pick, i) => (
          <div key={pick.panel} className={`hero-pick hero-pick-${i + 1}`}>
            <span className="hero-rank">#{i + 1}</span>
            <span className="hero-panel">{pick.panel}</span>
            <span className="hero-sutta">S: {pick.sutta}</span>
            <span className="hero-score" style={{ color: getScoreColor(pick.score) }}>
              {pick.score.toFixed(1)}
            </span>
            {pick.isHoneyPotPick && <span className="honey-badge">🍯</span>}
          </div>
        ))}
      </div>

      {/* Full Picks List */}
      <div className="picks-list">
        {picks.slice(3).map((pick, i) => (
          <div key={pick.panel} className="pick-row">
            <span className="pick-rank text-muted">#{i + 4}</span>
            <span className="pick-panel">{pick.panel}</span>
            <span className="pick-sutta">S{pick.sutta}</span>
            <div className="pick-score-bar">
              <div
                className="pick-score-fill"
                style={{
                  width: `${pick.score}%`,
                  background: getScoreColor(pick.score),
                }}
              />
            </div>
            <span className="pick-score-num" style={{ color: getScoreColor(pick.score) }}>
              {pick.score.toFixed(0)}
            </span>
            {pick.isHoneyPotPick && <span className="honey-mini">🍯</span>}
            {pick.breakdown.jodiPenalty !== 0 && (
              <span style={{
                fontSize: "10px",
                color: pick.breakdown.jodiPenalty > 0 ? "#f87171" : "#4ade80",
                marginLeft: "4px",
              }}>
                {pick.breakdown.jodiPenalty > 0 ? "⛔" : "✅"}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
