import type { CopySuttaPick } from "@/lib/sutta-model/production"
import { CopyButton } from "./AnalysisWidgets"
import { SUTTA_PREDICTION_COUNT } from "@/lib/prediction-contract"

function formatSuttasForCopy(suttas: CopySuttaPick[]): string {
  return [...suttas]
    .sort((a, b) => a.rank - b.rank || b.probabilityPct - a.probabilityPct || a.sutta - b.sutta)
    .map((item) => item.sutta)
    .join("-")
}

export function BetCopyDesk({
  copyCount,
  openSuttas,
  closeSuttas,
  jodis,
  copyingKey,
  handleCopy,
}: {
  copyCount: number
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
          <p className="picks-hint bet-copy-hint">
            {`Fixed Top-${SUTTA_PREDICTION_COUNT} contract, highest model score first.`}
          </p>
        </div>
        <div className="copy-count-control" aria-label="Fixed top sutta count">
          <input
            type="number"
            inputMode="numeric"
            min={SUTTA_PREDICTION_COUNT}
            max={SUTTA_PREDICTION_COUNT}
            value={copyCount}
            readOnly
            className="copy-count-input"
            aria-label="Top count"
          />
        </div>
      </div>

      <div className="bet-copy-summary">
        <span>Open {openSuttas.length}</span>
        <span>Close {closeSuttas.length}</span>
        <span>Jodi grid {jodis.length}</span>
      </div>

      <div className="bet-copy-grid">
        <SuttaCopyGroup label="Open Sutta" suttas={openSuttas} />
        <SuttaCopyGroup label="Close Sutta" suttas={closeSuttas} />
      </div>

      <div className="jodi-preview">
        <span className="jodi-preview-label">{SUTTA_PREDICTION_COUNT}x{SUTTA_PREDICTION_COUNT} Jodi grid</span>
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
          label={`${SUTTA_PREDICTION_COUNT * SUTTA_PREDICTION_COUNT}-Jodi Grid`}
          isCopied={copyingKey === "bet-jodi"}
          onClick={() => handleCopy("bet-jodi", jodis.join("-"))}
        />
      </div>
    </div>
  )
}
function SuttaCopyGroup({ label, suttas }: { label: string; suttas: CopySuttaPick[] }) {
  const rankedSuttas = [...suttas].sort(
    (a, b) => a.rank - b.rank || b.probabilityPct - a.probabilityPct || a.sutta - b.sutta,
  )
  return (
    <div className="sutta-copy-group">
      <span className="sutta-copy-label">{label}</span>
      <div className="sutta-copy-chips">
        {rankedSuttas.map((item) => (
          <span
            key={item.sutta}
            className="sutta-copy-chip"
            title={`Rank #${item.rank} - model score ${item.score.toFixed(1)}`}
          >
            <span className="sutta-copy-number">{item.sutta}</span>
            <span className="sutta-copy-score">{item.score.toFixed(1)}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
