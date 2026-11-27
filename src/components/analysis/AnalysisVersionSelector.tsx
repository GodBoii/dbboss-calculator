import type { AnalysisVersion } from "@/lib/combined-prediction"

export function AnalysisVersionSelector({ version, onChange, disabled }: {
  version: AnalysisVersion; onChange: (version: AnalysisVersion) => void; disabled: boolean
}) {
  return <div className="analysis-version-control">
    <div className="analysis-version-buttons" role="group" aria-label="Analysis version">
      <button id="analysis-v1" type="button" aria-pressed={version === "v1"} disabled={disabled} onClick={() => onChange("v1")}>
        <strong>V1</strong><span>Current analysis</span>
      </button>
      <button id="analysis-v2" type="button" aria-pressed={version === "v2"} disabled={disabled} onClick={() => onChange("v2")}>
        <strong>V2</strong><span>Combined predictions</span>
      </button>
    </div>
    {version === "v2" && <p className="analysis-version-description">V2 is experimental. Its accuracy is still being evaluated.</p>}
  </div>
}
