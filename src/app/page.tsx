"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import ProfilePanel from "@/components/ProfilePanel";

const AnalysisSection = dynamic(() => import("@/components/AnalysisSection"), {
  ssr: false,
  loading: () => (
    <div className="loading-placeholder">
      <div className="loading-placeholder-spinner" />
      <span>Loading Analysis Engine…</span>
    </div>
  ),
});

type Tab = "calculator" | "analysis";

export default function DBBossApp() {
  const [activeTab, setActiveTab] = useState<Tab>("calculator");
  const [profileOpen, setProfileOpen] = useState(false);

  const haptic = (ms = 8) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  };

  return (
    <div className="app-shell">
      {/* ── Fixed Top Header ──────────────────────────────────────── */}
      <header className="app-header">
        <div className="app-brand">
          <div className="app-brand-mark">◈</div>
          <span className="app-brand-name">DBboss</span>
        </div>

        <button
          className="app-profile-btn"
          onClick={() => { haptic(); setProfileOpen(true); }}
          aria-label="Open profile and settings"
          id="btn-profile"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 17c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      {/* ── Sticky Tab Bar ─────────────────────────────────────────── */}
      <nav className="app-tab-bar">
        <button
          id="tab-calculator"
          className={`app-tab-btn ${activeTab === "calculator" ? "app-tab-btn--active" : ""}`}
          onClick={() => { haptic(); setActiveTab("calculator"); }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="app-tab-icon">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M5 6h2M5 9h2M5 12h2M9 6h2M9 9h2M9 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <rect x="4.5" y="3.5" width="7" height="2" rx="0.5" fill="currentColor" opacity="0.4"/>
          </svg>
          Calculator
        </button>
        <button
          id="tab-analysis"
          className={`app-tab-btn ${activeTab === "analysis" ? "app-tab-btn--active" : ""}`}
          onClick={() => { haptic(); setActiveTab("analysis"); }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="app-tab-icon">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M8 4v4l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 8h1M13 8h1M8 2v1M8 13v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          Analysis
        </button>
      </nav>

      {/* ── Scrollable Content ──────────────────────────────────────── */}
      <main className="app-content">
        {activeTab === "calculator" && <CalculatorSection />}
        {activeTab === "analysis" && <AnalysisSection />}
      </main>

      {/* ── Profile Side Panel ──────────────────────────────────────── */}
      <ProfilePanel isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

// ─── Calculator Section ───────────────────────────────────────────────────────
function CalculatorSection() {
  const [mode, setMode] = useState<"SP" | "DP" | "TP">("SP");
  const [selectedSuttas, setSelectedSuttas] = useState<number[]>([]);
  const [common1, setCommon1] = useState("");
  const [common2, setCommon2] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const haptic = (ms = 8) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  };

  const toggleSutta = (s: number) => {
    haptic();
    setSelectedSuttas((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const results = useMemo(() => {
    let res: string[] = [];
    const orderedDigits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

    for (let i = 0; i < 10; i++) {
      for (let j = i; j < 10; j++) {
        for (let k = j; k < 10; k++) {
          const d1 = orderedDigits[i];
          const d2 = orderedDigits[j];
          const d3 = orderedDigits[k];
          let sameCount = 0;
          if (d1 === d2) sameCount++;
          if (d2 === d3) sameCount++;
          if (d1 === d3) sameCount++;
          if (mode === "SP" && sameCount !== 0) continue;
          if (mode === "DP" && sameCount !== 1) continue;
          if (mode === "TP" && sameCount !== 3) continue;
          const sum = (d1 + d2 + d3) % 10;
          if (selectedSuttas.length > 0 && !selectedSuttas.includes(sum)) continue;
          res.push(`${d1}${d2}${d3}`);
        }
      }
    }

    if (common1.trim()) {
      const digits = common1.match(/\d/g);
      if (digits) res = res.filter((p) => digits.some((d) => p.includes(d)));
    }
    if (common2.trim()) {
      const digits = common2.match(/\d/g);
      if (digits) res = res.filter((p) => digits.some((d) => p.includes(d)));
    }

    return res;
  }, [mode, selectedSuttas, common1, common2]);

  const handleCopy = async () => {
    if (!results.length) return;
    haptic(12);
    await navigator.clipboard.writeText(results.join("-"));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const hasFilters = selectedSuttas.length > 0 || common1 || common2;

  return (
    <div className="calc-page">
      {/* ── Configure Card ───────────────────────────────────── */}
      <div className="card calc-configure-card">
        {/* Mode segment */}
        <div className="calc-section-label">Mode</div>
        <div className="calc-mode-strip">
          {(["SP", "DP", "TP"] as const).map((m) => (
            <button
              key={m}
              id={`mode-${m.toLowerCase()}`}
              className={`calc-mode-btn ${mode === m ? "calc-mode-btn--active" : ""}`}
              onClick={() => { haptic(); setMode(m); }}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="calc-divider" />

        {/* Sutta grid */}
        <div className="calc-section-row">
          <span className="calc-section-label" style={{ margin: 0 }}>Sutta</span>
          {selectedSuttas.length > 0 && (
            <button className="calc-clear-btn" onClick={() => { haptic(); setSelectedSuttas([]); }}>
              Clear
            </button>
          )}
        </div>
        <div className="calc-sutta-grid">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              className={`calc-sutta-btn ${selectedSuttas.includes(n) ? "calc-sutta-btn--active" : ""}`}
              onClick={() => toggleSutta(n)}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="calc-divider" />

        {/* Common Filters — collapsible */}
        <button
          className="calc-filters-toggle"
          onClick={() => { haptic(); setFiltersExpanded((v) => !v); }}
        >
          <span className="calc-section-label" style={{ margin: 0 }}>
            Common Filters
            {(common1 || common2) && (
              <span className="calc-filter-dot" />
            )}
          </span>
          <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            style={{ transform: filtersExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {filtersExpanded && (
          <div className="calc-filters-body">
            <div className="calc-input-group">
              <label className="calc-input-label">Common 1</label>
              <input
                type="tel"
                className="calc-input"
                placeholder="e.g. 1 3 7"
                value={common1}
                onChange={(e) => setCommon1(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="calc-input-group">
              <label className="calc-input-label">Common 2</label>
              <input
                type="tel"
                className="calc-input"
                placeholder="e.g. 2 5 9"
                value={common2}
                onChange={(e) => setCommon2(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            {(common1 || common2) && (
              <button
                className="calc-clear-btn"
                style={{ alignSelf: "flex-start" }}
                onClick={() => { haptic(); setCommon1(""); setCommon2(""); }}
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Results Card ─────────────────────────────────────── */}
      <div className="card calc-results-card">
        <div className="calc-results-header">
          <div className="calc-results-title-row">
            <h2 className="calc-results-title">Results</h2>
            <div className="calc-results-count-badge">
              {results.length}
            </div>
          </div>
          <button
            className={`calc-copy-btn ${isCopied ? "calc-copy-btn--done" : ""} ${!results.length ? "calc-copy-btn--disabled" : ""}`}
            onClick={handleCopy}
            disabled={!results.length}
          >
            {isCopied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="#34D399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4" y="1" width="9" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1 4.5v7A1.5 1.5 0 002.5 13h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                Copy All
              </>
            )}
          </button>
        </div>

        {results.length > 0 ? (
          <div className="calc-results-grid">
            {results.map((r) => (
              <span key={r} className="calc-result-chip">{r}</span>
            ))}
          </div>
        ) : (
          <div className="calc-results-empty">
            <span>∅</span>
            <p>No panels match the selected criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
