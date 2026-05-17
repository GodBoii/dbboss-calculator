"use client";

import { useState, useMemo } from "react";

export default function DBBossCalculator() {
  const [mode, setMode] = useState<"SP" | "DP" | null>("SP");
  const [selectedSuttas, setSelectedSuttas] = useState<number[]>([]);
  const [additionalInput1, setAdditionalInput1] = useState("");
  const [additionalInput2, setAdditionalInput2] = useState("");

  const toggleSutta = (s: number) => {
    setSelectedSuttas(prev => 
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const results = useMemo(() => {
    const res = [];
    if (!mode) return [];

    for (let i = 100; i <= 990; i++) {
      const str = i.toString();
      if (str.length !== 3) continue;

      const d1 = parseInt(str[0]);
      const d2 = parseInt(str[1]);
      const d3 = parseInt(str[2]);

      let sameCount = 0;
      if (d1 === d2) sameCount++;
      if (d2 === d3) sameCount++;
      if (d1 === d3) sameCount++;

      // sameCount: 0 -> SP, 1 -> DP, 3 -> Excluded
      if (sameCount === 3) continue; 
      if (mode === "SP" && sameCount !== 0) continue;
      if (mode === "DP" && sameCount !== 1) continue;

      const sum = (d1 + d2 + d3) % 10;
      if (selectedSuttas.length > 0 && !selectedSuttas.includes(sum)) {
        continue;
      }

      res.push(str);
    }
    return res;
  }, [mode, selectedSuttas]);

  return (
    <main className="w-full max-w-[480px] mx-auto flex flex-col items-center animate-fade-in-up" style={{animationDelay: "100ms"}}>
      <h1 className="text-3xl font-bold mb-6 mt-4 text-center" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
        DBboss Calculator
      </h1>

      <div className="glass-panel">
        <h2 className="text-lg font-semibold mb-4">Select Mode</h2>
        <div className="grid grid-cols-2 gap-4">
          <button 
            className={`glass-button ${mode === "SP" ? "active" : ""}`}
            onClick={() => setMode("SP")}
          >
            SP Mode
          </button>
          <button 
            className={`glass-button ${mode === "DP" ? "active" : ""}`}
            onClick={() => setMode("DP")}
          >
            DP Mode
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{animationDelay: "200ms"}}>
        <h2 className="text-lg font-semibold mb-2">Sutta</h2>
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
        <h2 className="text-lg font-semibold mb-4">Additional Inputs</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-white/80">Input 1</label>
            <input 
              type="text"
              className="glass-input"
              placeholder="Enter numbers..."
              value={additionalInput1}
              onChange={(e) => setAdditionalInput1(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-white/80">Input 2</label>
            <input 
              type="text"
              className="glass-input"
              placeholder="Enter more numbers..."
              value={additionalInput2}
              onChange={(e) => setAdditionalInput2(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{animationDelay: "400ms", marginBottom: "40px"}}>
        <h2 className="text-lg font-semibold mb-4 flex justify-between items-center">
          Results 
          <span className="text-sm bg-black/30 px-3 py-1 rounded-full">{results.length}</span>
        </h2>
        
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
