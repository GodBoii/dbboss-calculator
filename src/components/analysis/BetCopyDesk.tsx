import type { CopySuttaPick } from "@/lib/sutta-model/production"
import { CopyButton } from "./AnalysisWidgets"

function formatSuttasForCopy(suttas: CopySuttaPick[]): string {
  return [...suttas]
    .sort((a, b) => a.rank - b.rank || b.probabilityPct - a.probabilityPct || a.sutta - b.sutta)
    .map((item) => item.sutta)
    .join("-")
}

const MIN_COPY_COUNT = 1
const MAX_COPY_COUNT = 10

export function BetCopyDesk({
  copyCount,
  onCopyCountChange,
  openSuttas,
  closeSuttas,
  jodis,
  copyingKey,
  handleCopy,
}: {
  copyCount: number
  onCopyCountChange: (count: number) => void
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
            {`Fixed Top-${copyCount} contract, highest model score first.`}
          </p>
        </div>
        <div className="copy-count-control" aria-label="Top sutta count">
          <button
            type="button"
            className="copy-count-btn"
            aria-label="Decrease count"
            disabled={copyCount <= MIN_COPY_COUNT}
            onClick={() => onCopyCountChange(Math.max(MIN_COPY_COUNT, copyCount - 1))}
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_COPY_COUNT}
            max={MAX_COPY_COUNT}
            value={copyCount}
            readOnly
            className="copy-count-input"
            aria-label="Top count"
          />
          <button
            type="button"
            className="copy-count-btn"
            aria-label="Increase count"
            disabled={copyCount >= MAX_COPY_COUNT}
            onClick={() => onCopyCountChange(Math.min(MAX_COPY_COUNT, copyCount + 1))}
          >
            +
          </button>
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
        <span className="jodi-preview-label">{copyCount}x{copyCount} Jodi grid</span>
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
          label={`${copyCount * copyCount}-Jodi Grid`}
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
