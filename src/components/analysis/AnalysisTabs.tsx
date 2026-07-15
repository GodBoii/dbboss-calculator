import type { Dispatch, ReactNode, SetStateAction } from "react"
import type { JodiAnalysis, PredictionResult } from "@/lib/predictor"
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

export { BetCopyDesk } from "./BetCopyDesk"
export {
  buildCloseSuttaRanking,
  buildCloseSuttaSet,
  buildJodis,
  buildOpenSuttaRanking,
  buildOpenSuttaSet,
  buildTopSuttaSet,
  getSuttaSourceMarketNames,
} from "@/lib/sutta-model/production"
export type { CopySuttaPick } from "@/lib/sutta-model/production"

type ActiveTab = "picks" | "stats" | "intel"
type PicksSubTab = "open" | "close" | "jodi"
type AnalysisIconKind = "predictions" | "stats" | "breakdown" | "open" | "close" | "jodi"

function AnalysisIcon({ kind, size = 16 }: { kind: AnalysisIconKind; size?: number }) {
  const paths: Record<AnalysisIconKind, ReactNode> = {
    predictions: <path d="M5 2h6v2.2A3 3 0 0 1 8 7.3a3 3 0 0 1-3-3.1V2Zm0 1H2.5v1.2A2.8 2.8 0 0 0 5.4 7M11 3h2.5v1.2A2.8 2.8 0 0 1 10.6 7M8 7.5V11m-2 2h4m-5 1h6" />,
    stats: <path d="M2.5 13.5h11M4 11V7m4 4V3m4 8V5" />,
    breakdown: <><circle cx="4" cy="4" r="1.5" /><circle cx="12" cy="5" r="1.5" /><circle cx="7" cy="12" r="1.5" /><path d="m5.4 4.3 5.1.5M4.8 5.3l1.5 5.3m4.8-4.2-3 4.4" /></>,
    open: <path d="M3 11 8 6l3 3 2-2M9 4h4v4" />,
    close: <path d="m3 5 5 5 3-3 2 2M9 12h4V8" />,
    jodi: <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2.5" /><path d="M8 1v2m0 10v2M1 8h2m10 0h2" /></>,
  }

  return (
    <svg className="analysis-tab-icon" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[kind]}
    </svg>
  )
}

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
      ? result.openPanelPicks
      : effectivePicksSubTab === "jodi" && jodiResult
        ? jodiResult.adjustedClosePicks
        : result.closePanelPicks
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
                      {tab === "picks" && <><AnalysisIcon kind="predictions" /> Predictions</>}
                      {tab === "stats" && <><AnalysisIcon kind="stats" /> Stats</>}
                      {tab === "intel" && <><AnalysisIcon kind="breakdown" /> Breakdown</>}
                    </button>
                  ))}
                </div>
    
                {/* â”€â”€ PREDICTIONS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                {activeTab === "picks" && (
                  <div className="picks-section">
                    {/* Sub-tab navigation: Open | Close | Jodi Close */}
                    <div className="tab-nav" style={{ marginBottom: "12px", gap: "4px" }}>
                      <button
                        className={`tab-btn ${picksSubTab === "open" ? "active" : ""}`}
                        onClick={() => setPicksSubTab("open")}
                        style={{ fontSize: "12px", padding: "6px 12px" }}
                      ><AnalysisIcon kind="open" /> Open</button>
                      <button
                        className={`tab-btn ${picksSubTab === "close" ? "active" : ""}`}
                        onClick={() => setPicksSubTab("close")}
                        style={{ fontSize: "12px", padding: "6px 12px" }}
                      ><AnalysisIcon kind="close" /> Close</button>
                      <button
                        className={`tab-btn ${picksSubTab === "jodi" ? "active" : ""}`}
                        onClick={() => setPicksSubTab("jodi")}
                        style={{
                          fontSize: "12px", padding: "6px 12px",
                          opacity: jodiResult ? 1 : 0.4,
                        }}
                        disabled={!jodiResult}
                      ><AnalysisIcon kind="jodi" /> Jodi Close</button>
                    </div>

                    {/* â”€â”€ Open Picks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    {picksSubTab === "open" && (
                      <>
                        <KindForecastCard label="Open Kind Forecast" prediction={result.openKindPrediction} />
                        <div className="picks-hint-row">
                          <p className="picks-hint" style={{ margin: 0 }}>
                            Open panel predictions - scored against Open-position history only
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
                                formatPicksForCopy(result.openPanelPicks, `${selectedMarket} - Open Picks`)
                              )
                            }
                          />
                        </div>
                        <PicksList picks={result.openPanelPicks} getScoreColor={getScoreColor} />
                        <DpFocusSection
                          title="Open DP Focus"
                          copyLabel="Copy Open DP"
                          copyKey="open-dp"
                          picks={result.openDpPicks}
                          isCopied={copyingKey === "open-dp"}
                          onCopy={() =>
                            handleCopy(
                              "open-dp",
                              formatPicksForCopy(result.openDpPicks, `${selectedMarket} - Open DP Picks`)
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
                                `${selectedMarket} - Open DP Numbers`
                              )
                            )
                          }
                        />
                      </>
                    )}
    
                    {/* â”€â”€ Close Picks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
                    {picksSubTab === "close" && (
                      <>
                        <KindForecastCard label="Close Kind Forecast" prediction={result.closeKindPrediction} />
                        <div className="picks-hint-row">
                          <p className="picks-hint" style={{ margin: 0 }}>
                            Close panel predictions - scored against Close-position history only
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
                                formatPicksForCopy(result.closePanelPicks, `${selectedMarket} - Close Picks`)
                              )
                            }
                          />
                        </div>
                        <PicksList picks={result.closePanelPicks} getScoreColor={getScoreColor} />
                        <DpFocusSection
                          title="Close DP Focus"
                          copyLabel="Copy Close DP"
                          copyKey="close-dp"
                          picks={result.closeDpPicks}
                          isCopied={copyingKey === "close-dp"}
                          onCopy={() =>
                            handleCopy(
                              "close-dp",
                              formatPicksForCopy(result.closeDpPicks, `${selectedMarket} - Close DP Picks`)
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
                                `${selectedMarket} - Close DP Numbers`
                              )
                            )
                          }
                        />
                      </>
                    )}
    
                    {/* â”€â”€ Jodi-Adjusted Close Picks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                                  `${selectedMarket} - Jodi Close (Open Sutta=${jodiResult.openSutta})`
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
                                `${selectedMarket} - Jodi Close DP (Open Sutta=${jodiResult.openSutta})`
                              )
                            )
                          }
                          description="Two-number DP focus from the Jodi-adjusted DP model"
                        />
                      </>
                    )}
    
                    {picksSubTab === "jodi" && !jodiResult && (
                      <div style={{ textAlign: "center", padding: "30px 16px", color: "rgba(255,255,255,0.4)" }}>
                        <p style={{ marginBottom: "8px", display: "flex", justifyContent: "center" }}><AnalysisIcon kind="jodi" size={32} /></p>
                        <p>Enter today&apos;s Open result above to unlock Jodi-adjusted Close predictions</p>
                      </div>
                    )}
                  </div>
                )}
    
                {/* â”€â”€ STATS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                          <span className="freq-count">{count}&times;</span>
                        </div>
                      ))}
                    </div>
    
                    <div className="stat-divider" />
                    <h4 className="stat-section-title">Top Close Panels</h4>
                    <div className="freq-grid">
                      {result.stats.topClosePanels.map(({ panel, count }) => (
                        <div key={panel} className="freq-item">
                          <span className="freq-panel">{panel}</span>
                          <span className="freq-count">{count}&times;</span>
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
                              <span className="freq-count">{count}&times;</span>
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
    
                {/* â”€â”€ INTEL / BREAKDOWN TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
