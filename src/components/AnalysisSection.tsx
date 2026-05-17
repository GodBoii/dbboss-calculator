"use client"

import { useState, useCallback } from "react"
import {
  HIGH_VOLUME_MARKETS,
  analyzeMarket,
  isSequential,
  type PredictionResult,
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
  'Sridevi':       'https://dpbosss.net.in/sridevi-penal-chart-record.php',
  'Time Bazar':    'https://dpbosss.net.in/time-bazar-panel.php',
  'Madhur Day':    'https://dpbosss.net.in/madhur-day-panel-chart.php',
  'Milan Day':     'https://dpbosss.net.in/milan-day-panel.php',
  'Rajdhani Day':  'https://dpbosss.net.in/rajdhani-day-panel-chart.php',
  'Kalyan':        'https://dpbosss.net.in/kalyan-panel-chart.php',
  // Night session
  'Sridevi Night': 'https://dpbosss.net.in/sridevi-night-panel-chart.php',
  'Madhur Night':  'https://dpbosss.net.in/madhuri-night-panel-chart.php',  // note: "madhuri"
  'Milan Night':   'https://dpbosss.net.in/milan-night-panel.php',
  'Rajdhani Night':'https://dpbosss.net.in/rajdhani-night-panel.php',
  'Main Bombay':   'https://dpbosss.net.in/main-bombay-panel-chart.php',    // late-night anchor
  'Main Bazar':    'https://dpbosss.net.in/main-bombay-panel-chart.php',
}

const DAY_MARKETS   = ['Sridevi', 'Time Bazar', 'Madhur Day', 'Milan Day', 'Rajdhani Day', 'Kalyan']
const NIGHT_MARKETS = ['Sridevi Night', 'Madhur Night', 'Milan Night', 'Rajdhani Night', 'Main Bombay']



type LoadingState = "idle" | "fetching" | "analyzing" | "done" | "error"

// ─── Component ────────────────────────────────────────────────────────────────
export default function AnalysisSection() {
  const [selectedMarket, setSelectedMarket] = useState<string>("Kalyan")
  const [loadingState, setLoadingState] = useState<LoadingState>("idle")
  const [loadingMessage, setLoadingMessage] = useState("")
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [cachedCount, setCachedCount] = useState<number | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [activeTab, setActiveTab] = useState<"picks" | "stats" | "intel">("picks")

  const fetchAndAnalyze = useCallback(
    async (forceRefresh = false) => {
      setLoadingState("fetching")
      setErrorMsg("")
      setResult(null)

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

  return (
    <section className="analysis-section">
      {/* ── Market Selector ─────────────────────────────────────────── */}
      <div className="glass-panel">
        <div className="section-header">
          <span className="section-icon">🎯</span>
          <div>
            <h2 className="section-title">Select Market</h2>
            <p className="section-subtitle">Tap a market to load &amp; analyze it</p>
          </div>
        </div>

        {/* ☀️ Day Session */}
        <div className="market-session-label">☀️ Day Session</div>
        <div className="market-grid">
          {DAY_MARKETS.map((market) => (
            <button
              key={market}
              id={`market-${market.replace(/\s+/g, "-").toLowerCase()}`}
              className={`market-btn ${selectedMarket === market ? "active" : ""}`}
              onClick={() => {
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

        {/* 🌙 Night Session */}
        <div className="market-session-label" style={{ marginTop: "14px" }}>🌙 Night Session</div>
        <div className="market-grid">
          {NIGHT_MARKETS.map((market) => (
            <button
              key={market}
              id={`market-${market.replace(/\s+/g, "-").toLowerCase()}`}
              className={`market-btn market-btn-night ${selectedMarket === market ? "active" : ""}`}
              onClick={() => {
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
                  "Public has fresh salary. Operator baits them with popular 'honey-pot' sequences. Penalty multiplier: 1.2×"}
                {result.temporalMode === "Month-End" &&
                  "Public is broke. Operator extracts final chips with hard, unpopular numbers. Penalty multiplier: 0.7×"}
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
                  {tab === "picks" && "🏆 Top Picks"}
                  {tab === "stats" && "📊 Stats"}
                  {tab === "intel" && "🧠 Breakdown"}
                </button>
              ))}
            </div>

            {/* ── TOP PICKS TAB ─────────────────────────────────────────── */}
            {activeTab === "picks" && (
              <div className="picks-section">
                <p className="picks-hint">
                  Top-scored panels — higher score = lower operator liability = safer to play
                </p>

                {/* Top 3 Hero Picks */}
                <div className="hero-picks">
                  {result.topPicks.slice(0, 3).map((pick, i) => (
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
                  {result.topPicks.slice(3).map((pick, i) => (
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
                    </div>
                  ))}
                </div>
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
