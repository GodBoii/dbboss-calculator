"use client";

import { useState, useMemo } from "react";

export default function DBBossCalculator() {
  const [mode, setMode] = useState<"SP" | "DP" | "TP" | null>("SP");
  const [selectedSuttas, setSelectedSuttas] = useState<number[]>([]);
  const [additionalInput1, setAdditionalInput1] = useState("");
  const [additionalInput2, setAdditionalInput2] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const toggleSutta = (s: number) => {
    setSelectedSuttas(prev => 
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const results = useMemo(() => {
    let res: string[] = [];
    if (!mode) return [];

    // In Satta Matka, digits are sorted in ascending order where 0 is treated as 10 (highest)
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

          // sameCount: 0 -> SP (120), 1 -> DP (90), 3 -> TP (10)
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

    // Apply Common 1 filter (Result must contain at least one of these digits)
    if (additionalInput1.trim().length > 0) {
      const filterDigits = additionalInput1.match(/\d/g);
      if (filterDigits) {
        res = res.filter(patti => filterDigits.some(d => patti.includes(d)));
      }
    }

    // Apply Common 2 filter (Narrow down further from Common 1 result)
    if (additionalInput2.trim().length > 0) {
      const filterDigits = additionalInput2.match(/\d/g);
      if (filterDigits) {
        res = res.filter(patti => filterDigits.some(d => patti.includes(d)));
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
    <main className="w-full max-w-[480px] mx-auto flex flex-col items-center animate-fade-in-up" style={{animationDelay: "100ms"}}>
      <h1 className="text-3xl font-bold mb-6 mt-4 text-center" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
        DBboss Calculator
      </h1>

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

      <div className="glass-panel" style={{animationDelay: "200ms"}}>
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
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              className={`glass-button !p-2 !rounded-lg text-lg ${selectedSuttas.includes(num) ? "active" : ""}`}
              onClick={() => toggleSutta(num)}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{animationDelay: "300ms"}}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Common Inputs</h2>
          {(additionalInput1 || additionalInput2) && (
            <button 
              onClick={() => { setAdditionalInput1(""); setAdditionalInput2(""); }}
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
              onChange={(e) => setAdditionalInput1(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Common 2</label>
            <input 
              type="tel"
              className="glass-input"
              placeholder="Enter more digits..."
              value={additionalInput2}
              onChange={(e) => setAdditionalInput2(e.target.value.replace(/\D/g, ""))}
            />
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{animationDelay: "400ms", marginBottom: "40px"}}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Results 
            <span className="text-sm bg-white/10 px-3 py-1 rounded-full">{results.length}</span>
          </h2>
          {results.length > 0 && (
            <button 
              onClick={handleCopy}
              className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded text-white transition-colors flex items-center gap-1 font-medium"
            >
              {isCopied ? "✓ Copied" : "📋 Copy"}
            </button>
          )}
        </div>
        
        {results.length > 0 ? (
          <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {results.map(res => (
              <span key={res} className="bg-white/10 border border-white/20 px-3 py-1.5 rounded-md font-medium text-sm text-center min-w-[48px]">
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
    </main>
  );
}
