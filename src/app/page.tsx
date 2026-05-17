"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";

// Lazy-load AnalysisSection so the calculator loads instantly
const AnalysisSection = dynamic(() => import("@/components/AnalysisSection"), {
  ssr: false,
  loading: () => (
    <div className="glass-panel" style={{ textAlign: "center", padding: "40px 24px", color: "rgba(255,255,255,0.4)" }}>
      Loading Analysis Engine…
    </div>
  ),
});

type Tab = "calculator" | "analysis";

export default function DBBossApp() {
  const [activeTab, setActiveTab] = useState<Tab>("calculator");

  return (
    <main
      className="w-full max-w-[480px] mx-auto flex flex-col items-center animate-fade-in-up"
      style={{ animationDelay: "100ms" }}
    >
      {/* ── App Header ──────────────────────────────────────────────────── */}
      <h1
        className="text-3xl font-bold mb-2 mt-4 text-center"
        style={{ textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
      >
        DBboss
      </h1>

      {/* ── Tab Navigation ──────────────────────────────────────────────── */}
      <div className="top-tab-nav">
        <button
          id="tab-calculator"
          className={`top-tab-btn ${activeTab === "calculator" ? "active" : ""}`}
          onClick={() => setActiveTab("calculator")}
        >
          🧮 Calculator
        </button>
        <button
          id="tab-analysis"
          className={`top-tab-btn ${activeTab === "analysis" ? "active" : ""}`}
          onClick={() => setActiveTab("analysis")}
        >
          🔮 Analysis
        </button>
      </div>

      {/* ── Calculator Tab ──────────────────────────────────────────────── */}
      {activeTab === "calculator" && <CalculatorSection />}

      {/* ── Analysis Tab ────────────────────────────────────────────────── */}
      {activeTab === "analysis" && <AnalysisSection />}
    </main>
  );
}

// ─── Calculator (original logic, unchanged) ───────────────────────────────────
function CalculatorSection() {
  const [mode, setMode] = useState<"SP" | "DP" | "TP" | null>("SP");
  const [selectedSuttas, setSelectedSuttas] = useState<number[]>([]);
  const [additionalInput1, setAdditionalInput1] = useState("");
  const [additionalInput2, setAdditionalInput2] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const toggleSutta = (s: number) => {
    setSelectedSuttas((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const results = useMemo(() => {
    let res: string[] = [];
    if (!mode) return [];

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
          if (selectedSuttas.length > 0 && !selectedSuttas.includes(sum)) {
            continue;
          }

          res.push(`${d1}${d2}${d3}`);
        }
      }
    }

    if (additionalInput1.trim().length > 0) {
      const filterDigits = additionalInput1.match(/\d/g);
      if (filterDigits) {
        res = res.filter((patti) => filterDigits.some((d) => patti.includes(d)));
      }
    }

    if (additionalInput2.trim().length > 0) {
      const filterDigits = additionalInput2.match(/\d/g);
      if (filterDigits) {
        res = res.filter((patti) => filterDigits.some((d) => patti.includes(d)));
      }
    }

    return res;
  }, [mode, selectedSuttas, additionalInput1, additionalInput2]);

  const handleCopy = async () => {
    if (results.length === 0) return;
    const textToCopy = results.join("-");
    await navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <>
      <div className="glass-panel">
        <h2 className="text-lg font-semibold mb-4">Select Mode</h2>
        <div className="grid grid-cols-3 gap-3">
          <button
            className={`glass-button !px-2 ${mode === "SP" ? "active" : ""}`}
            onClick={() => setMode("SP")}
          >
            SP
          </button>
          <button
            className={`glass-button !px-2 ${mode === "DP" ? "active" : ""}`}
            onClick={() => setMode("DP")}
          >
            DP
          </button>
          <button
            className={`glass-button !px-2 ${mode === "TP" ? "active" : ""}`}
            onClick={() => setMode("TP")}
          >
            TP
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ animationDelay: "200ms" }}>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Sutta</h2>
          {selectedSuttas.length > 0 && (
            <button
              onClick={() => setSelectedSuttas([])}
              className="glass-button !text-xs !py-1.5 !px-3 !bg-white/5 hover:!bg-white/10 !border-white/20"
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-sm text-white/60 mb-4">Select values (0-9)</p>
        <div className="grid grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              className={`glass-button !p-2 !rounded-lg text-lg ${
                selectedSuttas.includes(num) ? "active" : ""
              }`}
              onClick={() => toggleSutta(num)}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ animationDelay: "300ms" }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Common Inputs</h2>
          {(additionalInput1 || additionalInput2) && (
            <button
              onClick={() => {
                setAdditionalInput1("");
                setAdditionalInput2("");
              }}
              className="glass-button !text-xs !py-1.5 !px-3 !bg-white/5 hover:!bg-white/10 !border-white/20"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-white/80">Common 1</label>
            <input
              type="tel"
              className="glass-input"
              placeholder="Enter digits to filter..."
              value={additionalInput1}
              onChange={(e) =>
                setAdditionalInput1(e.target.value.replace(/\D/g, ""))
              }
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Common 2</label>
            <input
              type="tel"
              className="glass-input"
              placeholder="Enter more digits..."
              value={additionalInput2}
              onChange={(e) =>
                setAdditionalInput2(e.target.value.replace(/\D/g, ""))
              }
            />
          </div>
        </div>
      </div>

      <div
        className="glass-panel"
        style={{ animationDelay: "400ms", marginBottom: "40px" }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Results
            <span className="text-sm bg-white/10 px-3 py-1 rounded-full">
              {results.length}
            </span>
          </h2>
          {results.length > 0 && (
            <button
              onClick={handleCopy}
              className={`glass-button !text-xs !py-1.5 !px-3 flex items-center gap-1 ${
                isCopied
                  ? "active"
                  : "!bg-white/5 hover:!bg-white/10 !border-white/20"
              }`}
            >
              {isCopied ? "✓ Copied" : "📋 Copy"}
            </button>
          )}
        </div>

        {results.length > 0 ? (
          <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {results.map((res) => (
              <span
                key={res}
                className="bg-white/10 border border-white/20 px-3 py-1.5 rounded-md font-medium text-sm text-center min-w-[48px]"
              >
                {res}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-white/50 text-sm">
            No numbers match the selected criteria.
          </div>
        )}
      </div>
    </>
  );
}
