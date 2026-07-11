"use client"

import { useState, useCallback, useMemo, useRef } from "react"
import {
  HIGH_VOLUME_MARKETS,
  analyzeMarket,
  computeJodiAnalysis,
  buildContextFromResult,
  calculateSutta,
  type PanelPick,
  type PredictionResult,
  type JodiAnalysis,
} from "@/lib/predictor"
import { runMarketBacktest, runSuttaBacktest7d, type BacktestReport, type SuttaBacktest7dResult } from "@/lib/backtest"
import {
  saveRecords,
  getRecordsByMarket,
  getRecordISODate,
  clearMarket,
  RECENT_HISTORY_DAYS,
  type PanelRecord,
} from "@/lib/db"
import {
  AnalysisTabs,
  BetCopyDesk,
  buildCloseSuttaRanking,
  buildCloseSuttaSet,
  buildJodis,
  buildOpenSuttaRanking,
  buildOpenSuttaSet,
} from "./analysis/AnalysisTabs"
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
  'Kalyan Night':   'https://dpbossss.boston/panel-chart-record/kalyan-night.php',
  'Madhur Night':   'https://dpbossss.boston/panel-chart-record/madhur-night.php',
  'Milan Night':    'https://dpbossss.boston/panel-chart-record/milan-night.php',
  'Rajdhani Night': 'https://dpbossss.boston/panel-chart-record/rajdhani-night.php',
  'Main Bazar':     'https://dpbossss.boston/panel-chart-record/main-bazar.php',
}

const DAY_MARKETS   = ['Sridevi', 'Time Bazar', 'Madhur Day', 'Milan Day', 'Rajdhani Day', 'Kalyan']
const NIGHT_MARKETS = ['Sridevi Night', 'Kalyan Night', 'Madhur Night', 'Milan Night', 'Rajdhani Night', 'Main Bazar']



type LoadingState = "idle" | "fetching" | "analyzing" | "done" | "error"
type AvoidDigitPick = {
  digit: number
  exposure: number
  exposurePct: number
}

type AvoidDigitCall = {
  digits: AvoidDigitPick[]
  isCallable: boolean
  confidenceLabel: string
}

type SuttaAccuracyReport = {
  open: string
  close: string
  jodiAdjustedClose: string
  jodi: string
}

function buildPriorMarkets(
  marketName: string,
  priorRecords: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  isoDate: string,
): Record<string, PanelRecord[]> {
  const priorMarkets: Record<string, PanelRecord[]> = {}

  Object.entries(allMarketsRecords).forEach(([name, marketRecords]) => {
    priorMarkets[name] = marketRecords.filter((record) => {
      const recordISO = getRecordISODate(record)
      return recordISO !== null && recordISO < isoDate
    })
  })

  priorMarkets[marketName] = priorRecords
  return priorMarkets
}

function accuracyPercent(correct: number, total: number): string {
  if (!total) return "0.0%"
  return `${((correct / total) * 100).toFixed(1)}%`
}

function buildSuttaAccuracyReport(
  marketName: string,
  records: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  copyCount: number,
): SuttaAccuracyReport | null {
  const datedRecords = records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item): item is { record: PanelRecord; isoDate: string } => Boolean(item.isoDate))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))

  if (datedRecords.length <= 50) return null

  const testRecords = datedRecords.slice(-7)
  const totals = { open: 0, close: 0, jodiAdjustedClose: 0, jodi: 0 }
  const correct = { open: 0, close: 0, jodiAdjustedClose: 0, jodi: 0 }

  for (const { record, isoDate } of testRecords) {
    const priorRecords = datedRecords
      .filter((item) => item.isoDate < isoDate)
      .map((item) => item.record)

    if (priorRecords.length < 50) continue

    const targetDate = new Date(`${isoDate}T12:00:00`)
    const priorMarkets = buildPriorMarkets(marketName, priorRecords, allMarketsRecords, isoDate)
    const prediction = analyzeMarket(marketName, priorRecords, priorMarkets, targetDate)
    if (!prediction) continue

    const openSuttas = buildOpenSuttaSet(
      prediction.openPicks,
      prediction.openSuttaDroughts,
      priorRecords,
      copyCount,
      marketName,
      targetDate,
    )
    const closeSuttas = buildCloseSuttaSet(
      prediction.closePicks,
      prediction.closeSuttaDroughts,
      priorRecords,
      copyCount,
      marketName,
      null,
      priorMarkets,
      targetDate,
    )

    if (record.openPanel && record.openSutta >= 0) {
      totals.open++
      if (openSuttas.some((item) => item.sutta === record.openSutta)) correct.open++
    }

    if (record.closePanel && record.closeSutta >= 0) {
      totals.close++
      if (closeSuttas.some((item) => item.sutta === record.closeSutta)) correct.close++

      if (record.openSutta >= 0) {
        const jodiAnalysis = computeJodiAnalysis(
          record.openSutta,
          record.openPanel || null,
          priorRecords,
          buildContextFromResult(prediction),
          prediction.closeDpKindContext,
        )
        const jodiAdjustedCloseSuttas = buildCloseSuttaSet(
          jodiAnalysis.adjustedClosePicks,
          prediction.closeSuttaDroughts,
          priorRecords,
          copyCount,
          marketName,
          record.openSutta,
          priorMarkets,
          targetDate,
        )

        totals.jodiAdjustedClose++
        if (jodiAdjustedCloseSuttas.some((item) => item.sutta === record.closeSutta)) {
          correct.jodiAdjustedClose++
        }
      }
    }

    if (record.jodi) {
      totals.jodi++
      if (buildJodis(openSuttas, closeSuttas).includes(record.jodi)) correct.jodi++
    }
  }

  return {
    open: accuracyPercent(correct.open, totals.open),
    close: accuracyPercent(correct.close, totals.close),
    jodiAdjustedClose: accuracyPercent(correct.jodiAdjustedClose, totals.jodiAdjustedClose),
    jodi: accuracyPercent(correct.jodi, totals.jodi),
  }
}

function buildAvoidDigits(picks: PanelPick[], count = 2): AvoidDigitPick[] {
  const exposure = Array(10).fill(0) as number[]

  picks.slice(0, 30).forEach((pick, index) => {
    const rankWeight = Math.max(1, 30 - index)
    const scoreWeight = Math.max(1, pick.score)
    const uniqueDigits = new Set(
      pick.panel
        .split("")
        .map(Number)
        .filter((digit) => Number.isInteger(digit)),
    )

    uniqueDigits.forEach((digit) => {
      if (digit >= 0 && digit <= 9) exposure[digit] += rankWeight * scoreWeight
    })
  })

  const maxExposure = Math.max(...exposure, 1)

  return exposure
    .map((value, digit) => ({
      digit,
      exposure: value,
      exposurePct: Math.round((value / maxExposure) * 100),
    }))
    .sort((a, b) => a.exposure - b.exposure || a.digit - b.digit)
    .slice(0, count)
}

function buildAvoidDigitCall(picks: PanelPick[]): AvoidDigitCall {
  return {
    digits: buildAvoidDigits(picks, 2),
    isCallable: false,
    confidenceLabel: "No safe call",
  }
}

function AvoidDigitColumn({ label, call }: { label: string; call: AvoidDigitCall }) {
  return (
    <div className={`avoid-digit-column ${call.isCallable ? "avoid-digit-column--call" : "avoid-digit-column--blocked"}`}>
      <div className="avoid-digit-column-head">
        <span className="avoid-digit-label">{label}</span>
        <span className={`avoid-digit-meta ${call.isCallable ? "avoid-digit-meta--call" : "avoid-digit-meta--blocked"}`}>
          {call.confidenceLabel}
        </span>
      </div>
      <div className="avoid-digit-row">
        {call.digits.map((item) => (
          <div key={`${label}-${item.digit}`} className="avoid-digit-chip">
            <span className="avoid-digit-number">{item.digit}</span>
            <span className="avoid-digit-pressure">{item.exposurePct}% seen</span>
          </div>
        ))}
      </div>
      {!call.isCallable && (
        <p className="avoid-digit-status">
          Research gate blocked this avoid pair.
        </p>
      )}
    </div>
  )
}

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
  const [activeTab, setActiveTab] = useState<"picks" | "stats" | "intel">("picks")
  const [picksSubTab, setPicksSubTab] = useState<"open" | "close" | "jodi">("open")
  const [suttaSignalView, setSuttaSignalView] = useState<"open" | "close">("open")
  const [suttaCopyExpanded, setSuttaCopyExpanded] = useState(false)
  const [copyCount, setCopyCount] = useState(4)
  const [openSuttaInput, setOpenSuttaInput] = useState<number | null>(null)
  const [openPanelInput, setOpenPanelInput] = useState("")
  const [jodiResult, setJodiResult] = useState<JodiAnalysis | null>(null)
  const [backtestReport, setBacktestReport] = useState<BacktestReport | null>(null)
  const [suttaBacktest, setSuttaBacktest] = useState<SuttaBacktest7dResult | null>(null)
  const [cachedRecords, setCachedRecords] = useState<PanelRecord[]>([])
  const [allMarketsRecords, setAllMarketsRecords] = useState<Record<string, PanelRecord[]>>({})
  const cachedRecordsRef = useRef<PanelRecord[]>([])
  const allMarketsRecordsRef = useRef<Record<string, PanelRecord[]>>({})

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
      setCachedRecords([])
      setAllMarketsRecords({})
      setActiveTab("picks")
      setPicksSubTab("open")
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
        allMarketsRecordsRef.current = allMarketsRecords
        setCachedRecords(records)
        setAllMarketsRecords(allMarketsRecords)
        const prediction = analyzeMarket(selectedMarket, records, allMarketsRecords)
        if (!prediction) throw new Error("Not enough data to generate predictions.")

        setBacktestReport(runMarketBacktest(selectedMarket, records, allMarketsRecords, { days: 30 }))
        setSuttaBacktest(runSuttaBacktest7d(selectedMarket, records, allMarketsRecords, {
          buildOpenSuttaSet: buildOpenSuttaSet as (...args: unknown[]) => { sutta: number }[],
          buildCloseSuttaSet: buildCloseSuttaSet as (...args: unknown[]) => { sutta: number }[],
          buildJodis: buildJodis as (o: { sutta: number }[], c: { sutta: number }[]) => string[],
        }))
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
    haptic()
    setSession(s)
    setSelectedMarket(s === "day" ? "Kalyan" : "Main Bazar")
    setResult(null)
    setBacktestReport(null)
    setCachedRecords([])
    setJodiResult(null)
    setActiveTab("picks")
    setPicksSubTab("open")
    setLoadingState("idle")
  }

  const activeMarkets = session === "day" ? DAY_MARKETS : NIGHT_MARKETS
  const isNight = session === "night"
  const openSuttaRanking = useMemo(
    () => result
      ? buildOpenSuttaRanking(
          result.openPicks,
          result.openSuttaDroughts,
          cachedRecords,
          selectedMarket,
        )
      : [],
    [result, cachedRecords, selectedMarket],
  )
  const closeSuttaRanking = useMemo(
    () => result
      ? buildCloseSuttaRanking(
          jodiResult?.adjustedClosePicks ?? result.closePicks,
          result.closeSuttaDroughts,
          cachedRecords,
          selectedMarket,
          openSuttaInput,
          allMarketsRecords,
        )
      : [],
    [result, jodiResult, cachedRecords, selectedMarket, openSuttaInput, allMarketsRecords],
  )
  const openCopySuttas = useMemo(() => openSuttaRanking.slice(0, copyCount), [openSuttaRanking, copyCount])
  const closeCopySuttas = useMemo(() => closeSuttaRanking.slice(0, copyCount), [closeSuttaRanking, copyCount])
  const generatedJodis = useMemo(
    () => buildJodis(openCopySuttas, closeCopySuttas),
    [openCopySuttas, closeCopySuttas],
  )
  const openAvoidCall = useMemo(
    () => (result ? buildAvoidDigitCall(result.openPicks) : { digits: [], isCallable: false, confidenceLabel: "No safe call" }),
    [result],
  )
  const closeAvoidCall = useMemo(
    () => (result ? buildAvoidDigitCall(jodiResult?.adjustedClosePicks ?? result.closePicks) : { digits: [], isCallable: false, confidenceLabel: "No safe call" }),
    [result, jodiResult],
  )
  const suttaAccuracyReport = useMemo(
    () => result
      ? buildSuttaAccuracyReport(selectedMarket, cachedRecords, allMarketsRecords, copyCount)
      : null,
    [result, selectedMarket, cachedRecords, allMarketsRecords, copyCount],
  )

  const renderSuttaSignalList = (
    label: string,
    ranking: typeof openSuttaRanking,
  ) => (
    <div className="sutta-signal-panel">
      <div className="sutta-signal-panel-head">
        <span className="sutta-signal-panel-title">{label}</span>
        <span className="sutta-signal-panel-subtitle">highest model score first</span>
      </div>
      <div className="sutta-signal-list">
        {ranking.map((prediction) => {
          const width = Math.max(8, Math.min(100, prediction.score))
          return (
            <div key={`${label}-${prediction.sutta}`} className="sutta-signal-row">
              <span className="sutta-signal-rank">#{prediction.rank}</span>
              <span className="sutta-signal-digit">{prediction.sutta}</span>
              <div className="sutta-signal-bar-track">
                <div
                  className="sutta-signal-bar-fill"
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="sutta-signal-model">
                Score {prediction.score.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )

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
            <ConfidenceBadge label="Open" model={result.calibration.open} liveSuttaAcc={suttaBacktest?.openSuttaAcc} />
            <ConfidenceBadge label="Close" model={result.calibration.close} liveSuttaAcc={suttaBacktest?.closeSuttaAcc} />
            <ConfidenceBadge label="Jodi" model={result.calibration.jodi} liveSuttaAcc={suttaBacktest?.jodiAcc} />
          </div>

          <div className="confidence-strip kind-forecast-strip glass-panel">
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
            <div className="intel-compact-panel glass-panel">
              <div className="intel-compact-header">
                <h3 className="intel-card-title">Market Intelligence</h3>
                <span className="intel-compact-count">3 signals</span>
              </div>

              <details className="intel-detail">
                <summary className="intel-summary-row">
                  <span className="intel-summary-title">
                    <span className="intel-icon">📅</span>
                    Temporal Signal
                  </span>
                  <span className={`intel-badge intel-badge--compact ${getTemporalBadgeColor(result.temporalMode)}`}>
                    {result.temporalMode}
                  </span>
                </summary>
                <p className="intel-desc intel-detail-copy">
                  {result.temporalMode === "Payday" &&
                    "Public has fresh salary. Operator drops popular 'honey-pot' sequences as bait to hook new players. Penalties REDUCED. Multiplier: 0.7×"}
                  {result.temporalMode === "Month-End" &&
                    "Public is broke. Operator squeezes remaining bettors with hard, unpopular numbers. Penalties INCREASED. Multiplier: 1.3×"}
                  {result.temporalMode === "Normal" &&
                    "Mid-month cycle. Standard liability-minimization mode. Multiplier: 1.0×"}
                </p>
              </details>

              <details className="intel-detail">
                <summary className="intel-summary-row">
                  <span className="intel-summary-title">
                    <span className="intel-icon">💧</span>
                    Liquidity Flow
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
                        ? `${result.liquiditySourceMarket} just dropped a sequence. Public won big and will chase here. House will brutally wipe popular numbers. Multiplier: 1.5×`
                        : `${result.liquiditySourceMarket} had a hard result. Public is cautious. House is slightly more relaxed. Multiplier: 0.9×`}
                    </p>
                  </>
                ) : (
                  <p className="intel-desc intel-detail-copy intel-muted">No source market tracked for {result.market}.</p>
                )}
              </details>

              <details className="intel-detail">
                <summary className="intel-summary-row intel-summary-row--drought">
                  <span className="intel-summary-title">
                    <span className="intel-icon">🌵</span>
                    Sequence
                  </span>
                  <span className="drought-summary">
                    <span className="drought-summary-text">{result.recordsSinceLastSequence} / avg {result.averageDroughtLength}</span>
                    <span className="drought-bar-container drought-bar-container--compact">
                      <span
                        className="drought-bar-fill"
                        style={{
                          width: `${Math.min(100, (result.recordsSinceLastSequence / Math.max(result.averageDroughtLength * 2, 1)) * 100)}%`,
                          background: result.honeyPotAlert
                            ? "linear-gradient(90deg, #f97316, #ef4444)"
                            : "linear-gradient(90deg, #22c55e, #facc15)",
                        }}
                      />
                    </span>
                  </span>
                </summary>
                <div className="drought-stats drought-stats--compact">
                  <span className="drought-current">{result.recordsSinceLastSequence} draws</span>
                  <span className="drought-avg">avg: {result.averageDroughtLength}</span>
                </div>
                <p className="intel-desc intel-detail-copy">
                  {result.honeyPotAlert
                    ? "⚠️ Critical drought. Trap is mathematically imminent."
                    : result.recordsSinceLastSequence > result.averageDroughtLength
                    ? "Getting hot — above average drought length."
                    : "Within normal drought range."}
                </p>
              </details>
            </div>
          </div>

          {/* ── Sutta Saturation Map ──────────────────────────────────────── */}
          <div className="analysis-signal-safety-stack">
          <div className="glass-panel">
            <div className="section-header">
              <span className="section-icon">🎰</span>
              <div>
                <h3 className="section-title">Sutta Signal Map</h3>
                <p className="section-subtitle">
                  Open and Close are ranked separately by model score.
                </p>
              </div>
            </div>

            <div className="sutta-signal-switch" aria-label="Sutta signal position">
              <button
                type="button"
                className={`sutta-signal-switch-btn ${suttaSignalView === "open" ? "sutta-signal-switch-btn--active" : ""}`}
                onClick={() => {
                  haptic()
                  setSuttaSignalView("open")
                }}
              >
                Open
              </button>
              <button
                type="button"
                className={`sutta-signal-switch-btn ${suttaSignalView === "close" ? "sutta-signal-switch-btn--active" : ""}`}
                onClick={() => {
                  haptic()
                  setSuttaSignalView("close")
                }}
              >
                Close
              </button>
            </div>

            <div className="sutta-signal-layout">
              {suttaSignalView === "open"
                ? renderSuttaSignalList("Open Sutta", openSuttaRanking)
                : renderSuttaSignalList(
                    openSuttaInput === null ? "Close Sutta" : "Adjusted Close Sutta",
                    closeSuttaRanking,
                  )}
            </div>

            {suttaAccuracyReport && (
              <div className="confidence-strip glass-panel" style={{ marginTop: "12px" }}>
                <div className="status-item">
                  <span className="status-label">Open accuracy</span>
                  <span className="status-value">{suttaAccuracyReport.open}</span>
                </div>
                <div className="status-divider" />
                <div className="status-item">
                  <span className="status-label">Close accuracy</span>
                  <span className="status-value">{suttaAccuracyReport.close}</span>
                </div>
                <div className="status-divider" />
                <div className="status-item">
                  <span className="status-label">Jodi accuracy</span>
                  <span className="status-value">{suttaAccuracyReport.jodi}</span>
                </div>
              </div>
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
              <div className="sutta-map-tools">
                <BetCopyDesk
                  copyCount={copyCount}
                  setCopyCount={setCopyCount}
                  openSuttas={openCopySuttas}
                  closeSuttas={closeCopySuttas}
                  jodis={generatedJodis}
                  copyingKey={copyingKey}
                  handleCopy={handleCopy}
                />
              </div>
            )}
          </div>

          {/* ── Jodi Dependency Model Input ────────────────────────────────── */}
          <div className="glass-panel avoid-digit-panel">
            <div className="section-header">
              <span className="section-icon">🚫</span>
              <div>
                <h3 className="section-title">2-Digit Avoid Safety Gate</h3>
                <p className="section-subtitle">
                  Strict all-clear check for {selectedMarket}
                </p>
              </div>
            </div>

            <div className="avoid-digit-grid">
              <AvoidDigitColumn label="Open" call={openAvoidCall} />
              <AvoidDigitColumn label={jodiResult ? "Close (Jodi adjusted)" : "Close"} call={closeAvoidCall} />
            </div>

            <p className="avoid-digit-note">
              The pair is actionable only when both digits clear the strict research gate. Current research blocks calls below the verified threshold.
            </p>
          </div>
          </div>

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
