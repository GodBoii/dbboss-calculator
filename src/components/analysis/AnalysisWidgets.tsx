import type {
  DpDigitFocus,
  JodiCalibration,
  ModelCalibration,
  PanelKind,
  PanelKindPrediction,
  PanelPick,
} from "@/lib/predictor"

export function formatPicksForCopy(picks: PanelPick[], _header: string): string {
  return picks.map((p) => p.panel).join("-")
}

export function formatDpDigitFocusForCopy(focus: DpDigitFocus, _header: string): string {
  return focus.digits.join("-")
}

function levelLabel(level: ModelCalibration["level"]) {
  if (level === "strong") return "Strong"
  if (level === "fair") return "Fair"
  return "Weak"
}

export function ConfidenceBadge({ label, model }: { label: string; model: ModelCalibration | JodiCalibration }) {
  const jodiStrength = "strength" in model ? model.strength : null
  return (
    <div className={`confidence-badge confidence-badge--${model.level}`}>
      <div className="confidence-badge-head">
        <span className="confidence-label">{label}</span>
        <span className="confidence-level">{levelLabel(model.level)}</span>
      </div>
      <div className="confidence-metrics">
        <span>Panel {model.panel30.toFixed(1)}%</span>
        <span>Sutta {model.sutta30.toFixed(1)}%</span>
      </div>
      {jodiStrength !== null && (
        <div className="confidence-foot">Jodi strength {(jodiStrength * 100).toFixed(0)}%</div>
      )}
    </div>
  )
}

// ─── CopyButton Component ────────────────────────────────────────────────────
function kindColor(kind: PanelKind) {
  if (kind === "DP") return "#60a5fa"
  return "#4ade80"
}

export function KindForecastCard({ label, prediction }: { label: string; prediction: PanelKindPrediction }) {
  const kinds: PanelKind[] = ["SP", "DP"]
  const confidenceLevel = prediction.confidence >= 45 ? "strong" : prediction.confidence >= 38 ? "fair" : "weak"
  const topSignals = prediction.dpSignals.slice(0, 2)
  const totalTop30 = Math.max(1, kinds.reduce((sum, kind) => sum + prediction.top30Counts[kind], 0))
  const title = label.replace(" Kind Forecast", "").replace(" Kind", "")

  return (
    <div className={`kind-forecast-card confidence-badge--${confidenceLevel}`}>
      <div className="kind-forecast-head">
        <span className="kind-forecast-label">{title}</span>
        <span className="kind-forecast-pill" style={{ color: kindColor(prediction.predictedKind) }}>
          {prediction.predictedKind}
        </span>
      </div>

      <div className="kind-forecast-primary">
        <span className="kind-forecast-confidence">{prediction.confidence.toFixed(1)}%</span>
        <span className="kind-forecast-dp">DP est {prediction.estimatedDpRate.toFixed(1)}%</span>
      </div>

      <div className="kind-mix" aria-label={`${title} SP DP mix`}>
        {kinds.map((kind) => (
          <div key={kind} className="kind-mix-row">
            <span className="kind-mix-label" style={{ color: kindColor(kind) }}>{kind}</span>
            <span className="kind-mix-track">
              <span
                className="kind-mix-fill"
                style={{
                  width: `${(prediction.top30Counts[kind] / totalTop30) * 100}%`,
                  background: kindColor(kind),
                }}
              />
            </span>
            <span className="kind-mix-count">{prediction.top30Counts[kind]}</span>
          </div>
        ))}
      </div>

      <div className="kind-forecast-meta">Bias {prediction.dpBias.toFixed(2)}x</div>

      {topSignals.length > 0 && (
        <details className="kind-forecast-signals">
          <summary>Signals</summary>
          <p>{topSignals.join(" | ")}</p>
        </details>
      )}
    </div>
  )
}

export function CopyButton({ label, isCopied, onClick }: { label: string; isCopied: boolean; onClick: () => void }) {
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
export function DpFocusSection({
  title,
  copyLabel,
  picks,
  isCopied,
  onCopy,
  getScoreColor,
}: {
  title: string
  copyLabel: string
  copyKey: string
  picks: PanelPick[]
  isCopied: boolean
  onCopy: () => void
  getScoreColor: (s: number) => string
}) {
  if (!picks.length) return null

  return (
    <div style={{ marginTop: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <h4 className="stat-section-title" style={{ margin: 0 }}>{title}</h4>
          <p className="picks-hint" style={{ margin: "4px 0 0" }}>
            DP-only ranking from the same scoring model
          </p>
        </div>
        <CopyButton label={copyLabel} isCopied={isCopied} onClick={onCopy} />
      </div>
      <PicksList picks={picks} getScoreColor={getScoreColor} />
    </div>
  )
}

export function DpDigitFocusSection({
  title,
  copyLabel,
  focus,
  isCopied,
  onCopy,
  description = "Two-number DP focus from the DP model",
}: {
  title: string
  copyLabel: string
  copyKey: string
  focus: DpDigitFocus | null
  isCopied: boolean
  onCopy: () => void
  description?: string
}) {
  if (!focus) return null

  return (
    <div style={{ marginTop: "18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", gap: "12px" }}>
        <div>
          <h4 className="stat-section-title" style={{ margin: 0 }}>{title}</h4>
          <p className="picks-hint" style={{ margin: "4px 0 0" }}>
            {description}
          </p>
        </div>
        <CopyButton label={copyLabel} isCopied={isCopied} onClick={onCopy} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "10px",
          marginBottom: "10px",
        }}
      >
        {focus.digits.map((digit, index) => (
          <div
            key={`${digit}-${index}`}
            className="hero-pick"
            style={{
              minHeight: "92px",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span className="hero-rank">#{index + 1}</span>
            <span className="hero-panel" style={{ fontSize: "34px", lineHeight: 1 }}>{digit}</span>
            <span className="hero-sutta">Digit</span>
          </div>
        ))}
      </div>

      <p className="picks-hint" style={{ margin: 0 }}>
        Pair strength {focus.confidence.toFixed(1)}% from top {focus.depth} DP candidates
      </p>
    </div>
  )
}

export function PicksList({ picks, getScoreColor }: { picks: PanelPick[]; getScoreColor: (s: number) => string }) {
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
            <span className="hero-sutta" style={{ color: kindColor(pick.kind) }}>{pick.kind}</span>
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
        {picks.map((pick, i) => (
          <div key={pick.panel} className="pick-row">
            <span className="pick-rank text-muted">#{i + 1}</span>
            <span className="pick-panel">{pick.panel}</span>
            <span className="pick-sutta" style={{ color: kindColor(pick.kind) }}>{pick.kind}</span>
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
