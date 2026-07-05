import type { Dispatch, SetStateAction } from "react"
import { getSuttaSignal, type JodiAnalysis, type PanelPick, type PredictionResult } from "@/lib/predictor"
import type { BacktestReport } from "@/lib/backtest"
import {
  CopyButton,
  DpDigitFocusSection,
  DpFocusSection,
  KindForecastCard,
  PicksList,
  formatDpDigitFocusForCopy,
  formatPicksForCopy,
} from "./AnalysisWidgets"

type ActiveTab = "picks" | "stats" | "intel"
type PicksSubTab = "open" | "close" | "jodi"

interface AnalysisTabsProps {
  result: PredictionResult
  jodiResult: JodiAnalysis | null
  backtestReport: BacktestReport | null
  activeTab: ActiveTab
  setActiveTab: Dispatch<SetStateAction<ActiveTab>>
  picksSubTab: PicksSubTab
  setPicksSubTab: Dispatch<SetStateAction<PicksSubTab>>
  selectedMarket: string
  copyingKey: string | null
  handleCopy: (key: string, text: string) => void
  getScoreColor: (score: number) => string
  pct: (value: number, total: number) => string
  dpPrecision: (correct: number, predicted: number) => string
}

export interface CopySuttaPick {
  sutta: number
  rank: number
  score: number
  signalColor: string
  signalLabel: string
  signalState: ReturnType<typeof getSuttaSignal>["state"]
  isFresh: boolean
  isSnapback: boolean
}

const clampCopyCount = (value: number) => Math.max(1, Math.min(10, Math.trunc(value) || 1))

export function buildTopSuttaSet(
  picks: PanelPick[],
  droughts: Record<string, number>,
  count: number,
): CopySuttaPick[] {
  const bySutta = new Map<number, CopySuttaPick>()

  picks.forEach((pick, index) => {
    if (bySutta.has(pick.sutta)) return

    const signal = getSuttaSignal(droughts[String(pick.sutta)] ?? 1000)
    bySutta.set(pick.sutta, {
      sutta: pick.sutta,
      rank: index + 1,
      score: pick.score,
      signalColor: signal.color,
      signalLabel: signal.label,
      signalState: signal.state,
      isFresh: signal.state === "fresh",
      isSnapback: signal.state === "snapback",
    })
  })

  for (let sutta = 0; sutta <= 9; sutta++) {
    if (bySutta.has(sutta)) continue
    const signal = getSuttaSignal(droughts[String(sutta)] ?? 1000)
    bySutta.set(sutta, {
      sutta,
      rank: 999,
      score: 0,
      signalColor: signal.color,
      signalLabel: signal.label,
      signalState: signal.state,
      isFresh: signal.state === "fresh",
      isSnapback: signal.state === "snapback",
    })
  }

  const ranked = Array.from(bySutta.values())
  const fresh = ranked.filter((item) => item.isFresh)
  const snapback = ranked.filter((item) => item.isSnapback)
  const selected = [...fresh]

  for (const item of snapback) {
    if (selected.length >= count) break
    if (!selected.some((selectedItem) => selectedItem.sutta === item.sutta)) {
      selected.push(item)
    }
  }

  for (const item of ranked) {
    if (selected.length >= count) break
    if (!selected.some((selectedItem) => selectedItem.sutta === item.sutta)) {
      selected.push(item)
    }
  }

  return selected.slice(0, count)
}

export function buildJodis(openSuttas: CopySuttaPick[], closeSuttas: CopySuttaPick[]): string[] {
  return openSuttas.flatMap((open) => closeSuttas.map((close) => `${open.sutta}${close.sutta}`))
}

function formatSuttasForCopy(suttas: CopySuttaPick[]): string {
  return suttas.map((item) => item.sutta).join("-")
}

export function BetCopyDesk({
  copyCount,
  setCopyCount,
  openSuttas,
  closeSuttas,
  jodis,
  copyingKey,
  handleCopy,
}: {
  copyCount: number
  setCopyCount: Dispatch<SetStateAction<number>>
  openSuttas: CopySuttaPick[]
  closeSuttas: CopySuttaPick[]
  jodis: string[]
  copyingKey: string | null
  handleCopy: (key: string, text: string) => void
}) {
  return (
    <div className="bet-copy-desk">
      <div className="bet-copy-head">
        <div>
          <h4 className="stat-section-title bet-copy-title">Bet Copy</h4>
          <p className="picks-hint bet-copy-hint">Green first, snapback next, then top rank</p>
        </div>
        <div className="copy-count-control" aria-label="Top sutta count">
          <button
            type="button"
            className="copy-count-btn"
            onClick={() => setCopyCount((value) => clampCopyCount(value - 1))}
            aria-label="Decrease top count"
          >
            -
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={copyCount}
            onChange={(event) => setCopyCount(clampCopyCount(Number(event.target.value)))}
            className="copy-count-input"
            aria-label="Top count"
          />
          <button
            type="button"
            className="copy-count-btn"
            onClick={() => setCopyCount((value) => clampCopyCount(value + 1))}
            aria-label="Increase top count"
          >
            +
          </button>
        </div>
      </div>

      <div className="bet-copy-summary">
        <span>Open {openSuttas.length}</span>
        <span>Close {closeSuttas.length}</span>
        <span>Jodi {jodis.length}</span>
      </div>

      <div className="bet-copy-grid">
        <SuttaCopyGroup label="Open Sutta" suttas={openSuttas} />
        <SuttaCopyGroup label="Close Sutta" suttas={closeSuttas} />
      </div>

      <div className="jodi-preview">
        <span className="jodi-preview-label">Jodi</span>
        <div className="jodi-chip-row">
          {jodis.slice(0, 24).map((jodi) => (
            <span key={jodi} className="jodi-chip">{jodi}</span>
          ))}
          {jodis.length > 24 && <span className="jodi-chip jodi-chip-more">+{jodis.length - 24}</span>}
        </div>
      </div>

      <div className="bet-copy-actions">
        <CopyButton
          label="Open Sutta"
          isCopied={copyingKey === "bet-open-sutta"}
          onClick={() => handleCopy("bet-open-sutta", formatSuttasForCopy(openSuttas))}
        />
        <CopyButton
          label="Close Sutta"
          isCopied={copyingKey === "bet-close-sutta"}
          onClick={() => handleCopy("bet-close-sutta", formatSuttasForCopy(closeSuttas))}
        />
        <CopyButton
          label="Top Jodi"
          isCopied={copyingKey === "bet-jodi"}
          onClick={() => handleCopy("bet-jodi", jodis.join("-"))}
        />
      </div>
    </div>
  )
}

function SuttaCopyGroup({ label, suttas }: { label: string; suttas: CopySuttaPick[] }) {
  return (
    <div className="sutta-copy-group">
      <span className="sutta-copy-label">{label}</span>
      <div className="sutta-copy-chips">
        {suttas.map((item) => (
          <span
            key={item.sutta}
            className={`sutta-copy-chip ${item.isFresh ? "sutta-copy-chip--fresh" : ""}`}
            style={{ borderColor: item.signalColor }}
            title={`Rank #${item.rank} - ${item.signalLabel} - ${item.score.toFixed(1)} pts`}
          >
            {item.sutta}
          </span>
        ))}
      </div>
    </div>
  )
}

export function AnalysisTabs({
  result,
  jodiResult,
  backtestReport,
  activeTab,
  setActiveTab,
  picksSubTab,
  setPicksSubTab,
  selectedMarket,
  copyingKey,
  handleCopy,
  getScoreColor,
  pct,
  dpPrecision,
}: AnalysisTabsProps) {
  const effectivePicksSubTab = picksSubTab === "jodi" && !jodiResult ? "close" : picksSubTab
  const activePickLabel =
    effectivePicksSubTab === "open" ? "Open" : effectivePicksSubTab === "jodi" ? "Jodi Close" : "Close"
  const activeBreakdownPicks =
    effectivePicksSubTab === "open"
      ? result.openPicks
      : effectivePicksSubTab === "jodi" && jodiResult
        ? jodiResult.adjustedClosePicks
        : result.closePicks
  const activeSequenceRate =
    effectivePicksSubTab === "open" ? result.stats.openSequenceRate : result.stats.closeSequenceRate
  const activeTripleRate =
    effectivePicksSubTab === "open" ? result.stats.openTripleRate : result.stats.closeTripleRate
  const activePanelCount =
    effectivePicksSubTab === "open" ? result.stats.openPanelCount : result.stats.closePanelCount
  const activeSuttaDistribution =
    effectivePicksSubTab === "open" ? result.stats.openSuttaDistribution : result.stats.closeSuttaDistribution
  const maxActiveSuttaCount = Math.max(...Object.values(activeSuttaDistribution), 1)

  return (
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
                        <KindForecastCard label="Open Kind Forecast" prediction={result.openKindPrediction} />
                        <div className="picks-hint-row">
                          <p className="picks-hint" style={{ margin: 0 }}>
                            Open panel predictions — scored against Open-position history only
                          </p>
                          <p className="picks-hint picks-hint-calibration">
                            Panel {result.calibration.open.panel30.toFixed(1)}% / Sutta {result.calibration.open.sutta30.toFixed(1)}%
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
                        <DpFocusSection
                          title="Open DP Focus"
                          copyLabel="Copy Open DP"
                          copyKey="open-dp"
                          picks={result.openDpPicks}
                          isCopied={copyingKey === "open-dp"}
                          onCopy={() =>
                            handleCopy(
                              "open-dp",
                              formatPicksForCopy(result.openDpPicks, `${selectedMarket} — Open DP Picks`)
                            )
                          }
                          getScoreColor={getScoreColor}
                        />
                        <DpDigitFocusSection
                          title="Open DP Numbers"
                          copyLabel="Copy Open Numbers"
                          copyKey="open-dp-numbers"
                          focus={result.openDpDigitFocus}
                          isCopied={copyingKey === "open-dp-numbers"}
                          onCopy={() =>
                            result.openDpDigitFocus &&
                            handleCopy(
                              "open-dp-numbers",
                              formatDpDigitFocusForCopy(
                                result.openDpDigitFocus,
                                `${selectedMarket} â€” Open DP Numbers`
                              )
                            )
                          }
                        />
                      </>
                    )}
    
                    {/* ── Close Picks ─────────────────────────────────────────── */}
                    {picksSubTab === "close" && (
                      <>
                        <KindForecastCard label="Close Kind Forecast" prediction={result.closeKindPrediction} />
                        <div className="picks-hint-row">
                          <p className="picks-hint" style={{ margin: 0 }}>
                            Close panel predictions — scored against Close-position history only
                          </p>
                          <p className="picks-hint picks-hint-calibration">
                            Panel {result.calibration.close.panel30.toFixed(1)}% / Sutta {result.calibration.close.sutta30.toFixed(1)}%
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
                        <DpFocusSection
                          title="Close DP Focus"
                          copyLabel="Copy Close DP"
                          copyKey="close-dp"
                          picks={result.closeDpPicks}
                          isCopied={copyingKey === "close-dp"}
                          onCopy={() =>
                            handleCopy(
                              "close-dp",
                              formatPicksForCopy(result.closeDpPicks, `${selectedMarket} — Close DP Picks`)
                            )
                          }
                          getScoreColor={getScoreColor}
                        />
                        <DpDigitFocusSection
                          title="Close DP Numbers"
                          copyLabel="Copy Close Numbers"
                          copyKey="close-dp-numbers"
                          focus={result.closeDpDigitFocus}
                          isCopied={copyingKey === "close-dp-numbers"}
                          onCopy={() =>
                            result.closeDpDigitFocus &&
                            handleCopy(
                              "close-dp-numbers",
                              formatDpDigitFocusForCopy(
                                result.closeDpDigitFocus,
                                `${selectedMarket} â€” Close DP Numbers`
                              )
                            )
                          }
                        />
                      </>
                    )}
    
                    {/* ── Jodi-Adjusted Close Picks ──────────────────────────── */}
                    {picksSubTab === "jodi" && jodiResult && (
                      <>
                        <KindForecastCard label="Jodi Close Kind Forecast" prediction={jodiResult.kindPrediction} />
                        <p className="picks-hint">
                          Close predictions adjusted by empirical Open-to-Close history for Open Sutta = <strong>{jodiResult.openSutta}</strong>
                        </p>
                        <p className="picks-hint picks-hint-calibration">
                          Panel {jodiResult.calibration.panel30.toFixed(1)}% / Sutta {jodiResult.calibration.sutta30.toFixed(1)}% / Strength {(jodiResult.jodiStrength * 100).toFixed(0)}%
                        </p>
    
                        {/* Jodi frequency chart */}
                        <div style={{ marginBottom: "16px" }}>
                          <h4 className="stat-section-title">Jodi Edge Map</h4>
                          <p className="picks-hint" style={{ marginBottom: "8px" }}>
                            Shows how often each Jodi ({jodiResult.openSutta}X) appeared historically.
                            Frequent outcomes are boosted; weak outcomes are reduced.
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {jodiResult.jodiFrequencies.map((jf) => {
                              const isBlack = jodiResult.avoidedCloseSuttas.includes(jf.closeSutta)
                              const isSafe = jodiResult.favoredCloseSuttas.includes(jf.closeSutta)
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
                                  {isBlack && <span style={{ fontSize: "10px", color: "#f87171" }}>WEAK</span>}
                                  {isSafe && <span style={{ fontSize: "10px", color: "#4ade80" }}>EDGE</span>}
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
                          {jodiResult.avoidedCloseSuttas.length > 0 && (
                            <div style={{ flex: 1, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "8px 12px" }}>
                              <span style={{ fontSize: "11px", color: "#f87171", fontWeight: 600 }}>WEAK CLOSE SUTTAS</span>
                              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                                {jodiResult.avoidedCloseSuttas.map((s) => (
                                  <span key={s} style={{ background: "rgba(239,68,68,0.2)", padding: "2px 8px", borderRadius: "4px", fontWeight: 700, color: "#f87171" }}>{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {jodiResult.favoredCloseSuttas.length > 0 && (
                            <div style={{ flex: 1, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "8px", padding: "8px 12px" }}>
                              <span style={{ fontSize: "11px", color: "#4ade80", fontWeight: 600 }}>FAVORED CLOSE SUTTAS</span>
                              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                                {jodiResult.favoredCloseSuttas.map((s) => (
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
                        <DpDigitFocusSection
                          title="Jodi Close DP Numbers"
                          copyLabel="Copy DP Numbers"
                          copyKey="jodi-dp"
                          focus={jodiResult.adjustedCloseDpDigitFocus}
                          isCopied={copyingKey === "jodi-dp"}
                          onCopy={() =>
                            jodiResult.adjustedCloseDpDigitFocus &&
                            handleCopy(
                              "jodi-dp",
                              formatDpDigitFocusForCopy(
                                jodiResult.adjustedCloseDpDigitFocus,
                                `${selectedMarket} — Jodi Close DP (Open Sutta=${jodiResult.openSutta})`
                              )
                            )
                          }
                          description="Two-number DP focus from the Jodi-adjusted DP model"
                        />
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
                      <span className="stat-label">Market</span>
                      <span className="stat-value">{result.market}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Active view</span>
                      <span className="stat-value">{activePickLabel}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Total Draws</span>
                      <span className="stat-value">{result.stats.totalDraws.toLocaleString()}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Open / Close panels</span>
                      <span className="stat-value">
                        {result.stats.openPanelCount.toLocaleString()} / {result.stats.closePanelCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">{activePickLabel} panels counted</span>
                      <span className="stat-value">{activePanelCount.toLocaleString()}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">{activePickLabel} sequences (actual)</span>
                      <span className="stat-value stat-warn">{activeSequenceRate.toFixed(2)}%</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Sequences (expected random)</span>
                      <span className="stat-value">~5.45%</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">{activePickLabel} triples (actual)</span>
                      <span className="stat-value stat-danger">{activeTripleRate.toFixed(2)}%</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Triples (expected random)</span>
                      <span className="stat-value">~4.55%</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Combined sequence / triple</span>
                      <span className="stat-value">
                        {result.stats.sequenceRate.toFixed(2)}% / {result.stats.tripleRate.toFixed(2)}%
                      </span>
                    </div>
    
                    {backtestReport && (
                      <>
                        <div className="stat-divider" />
                        <h4 className="stat-section-title">Last 30 Days Backtest</h4>
                        <p className="picks-hint">
                          {backtestReport.startDate} to {backtestReport.endDate} - {backtestReport.drawsTested} draws replayed with prior history only
                        </p>
                        <div className="stat-row">
                          <span className="stat-label">Random panel@30 baseline</span>
                          <span className="stat-value">{(backtestReport.randomTop30Baseline * 100).toFixed(1)}%</span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Open panel@30 / sutta@30</span>
                          <span className="stat-value">
                            {pct(backtestReport.open.panelTop30, backtestReport.open.n)} / {pct(backtestReport.open.suttaTop30, backtestReport.open.n)}
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Close panel@30 / sutta@30</span>
                          <span className="stat-value">
                            {pct(backtestReport.close.panelTop30, backtestReport.close.n)} / {pct(backtestReport.close.suttaTop30, backtestReport.close.n)}
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Jodi panel@30 / sutta@30</span>
                          <span className="stat-value">
                            {pct(backtestReport.jodi.panelTop30, backtestReport.jodi.n)} / {pct(backtestReport.jodi.suttaTop30, backtestReport.jodi.n)}
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Open / Close / Jodi kind hit</span>
                          <span className="stat-value">
                            {pct(backtestReport.open.kindCorrect, backtestReport.open.n)} / {pct(backtestReport.close.kindCorrect, backtestReport.close.n)} / {pct(backtestReport.jodi.kindCorrect, backtestReport.jodi.n)}
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Open DP precision</span>
                          <span className="stat-value">
                            {dpPrecision(backtestReport.open.dpCorrect, backtestReport.open.dpPredicted)}
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Close DP precision</span>
                          <span className="stat-value">
                            {dpPrecision(backtestReport.close.dpCorrect, backtestReport.close.dpPredicted)}
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Jodi DP precision</span>
                          <span className="stat-value">
                            {dpPrecision(backtestReport.jodi.dpCorrect, backtestReport.jodi.dpPredicted)}
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Actual DP rate O/C/J</span>
                          <span className="stat-value">
                            {pct(backtestReport.open.actualDp, backtestReport.open.n)} / {pct(backtestReport.close.actualDp, backtestReport.close.n)} / {pct(backtestReport.jodi.actualDp, backtestReport.jodi.n)}
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Close actual danger / snapback</span>
                          <span className="stat-value">
                            {pct(backtestReport.close.actualDanger, backtestReport.close.n)} / {pct(backtestReport.close.actualSnapback, backtestReport.close.n)}
                          </span>
                        </div>
                        <div className="stat-row">
                          <span className="stat-label">Jodi rank movement</span>
                          <span className="stat-value">
                            up {backtestReport.jodiMovement.better} / down {backtestReport.jodiMovement.worse} / same {backtestReport.jodiMovement.same}
                          </span>
                        </div>
                      </>
                    )}
    
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
                    <h4 className="stat-section-title">{activePickLabel} Sutta Distribution</h4>
                    <div className="sutta-dist">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => {
                        const count = activeSuttaDistribution[String(s)] ?? 0
                        return (
                          <div key={s} className="sutta-dist-row">
                            <span className="sutta-dist-label">{s}</span>
                            <div className="sutta-dist-bar-bg">
                              <div
                                className="sutta-dist-bar-fill"
                                style={{ width: `${(count / maxActiveSuttaCount) * 100}%` }}
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
                    <h4 className="stat-section-title">{activePickLabel} Score Breakdown (Top 10)</h4>
                    <p className="picks-hint">
                      How each penalty factor contributed to the final score
                    </p>
                    {activeBreakdownPicks.slice(0, 10).map((pick) => (
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
                          {pick.breakdown.triplePenalty > 0 && (
                            <div className="breakdown-item">
                              <span className="bd-label">Triple Penalty</span>
                              <div className="bd-bar-bg">
                                <div className="bd-bar-fill bd-red" style={{ width: `${pick.breakdown.triplePenalty}%` }} />
                              </div>
                              <span className="bd-val" style={{ color: "#f87171" }}>-{pick.breakdown.triplePenalty.toFixed(1)}</span>
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
                          {pick.breakdown.jodiPenalty !== 0 && (
                            <div className="breakdown-item">
                              <span className="bd-label">Jodi Adj.</span>
                              <div className="bd-bar-bg">
                                <div
                                  className={`bd-bar-fill ${pick.breakdown.jodiPenalty < 0 ? "bd-green" : "bd-red"}`}
                                  style={{ width: `${Math.abs(pick.breakdown.jodiPenalty)}%` }}
                                />
                              </div>
                              <span className="bd-val" style={{ color: pick.breakdown.jodiPenalty < 0 ? "#4ade80" : "#f87171" }}>
                                {pick.breakdown.jodiPenalty < 0 ? "+" : "-"}{Math.abs(pick.breakdown.jodiPenalty).toFixed(1)}
                              </span>
                            </div>
                          )}
                          {pick.breakdown.operatorAdjustment !== undefined && pick.breakdown.operatorAdjustment !== 0 && (
                            <div className="breakdown-item">
                              <span className="bd-label">Operator</span>
                              <div className="bd-bar-bg">
                                <div
                                  className={`bd-bar-fill ${pick.breakdown.operatorAdjustment > 0 ? "bd-green" : "bd-red"}`}
                                  style={{ width: `${Math.abs(pick.breakdown.operatorAdjustment)}%` }}
                                />
                              </div>
                              <span className="bd-val" style={{ color: pick.breakdown.operatorAdjustment > 0 ? "#4ade80" : "#f87171" }}>
                                {pick.breakdown.operatorAdjustment > 0 ? "+" : "-"}{Math.abs(pick.breakdown.operatorAdjustment).toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
  )
}
