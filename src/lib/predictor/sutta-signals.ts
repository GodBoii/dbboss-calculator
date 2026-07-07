import type { FlatEntry } from "./data";
import type { SuttaSignal, SuttaSignalState } from "./types";

export function getSuttaSignal(drought: number): SuttaSignal {
  if (drought >= 1000) {
    return {
      state: "unknown",
      label: "Unknown",
      scorePenalty: 0,
      color: "#6b7280",
      description: "Not enough history for this sutta.",
    };
  }
  if (drought > 20) {
    return {
      state: "snapback",
      label: "Snapback",
      scorePenalty: -25,
      color: "#60a5fa",
      description:
        "Extreme drought. The model treats this separately from normal danger.",
    };
  }
  if (drought > 15) {
    return {
      state: "cooling",
      label: "Cooling",
      scorePenalty: 10,
      color: "#facc15",
      description: "Pressure may be fading, but the signal is still cautious.",
    };
  }
  if (drought > 8) {
    return {
      state: "danger",
      label: "Danger",
      scorePenalty: drought > 12 ? 35 : 30,
      color: "#f87171",
      description: "Mid-range drought. Historically this was the risky zone.",
    };
  }
  if (drought > 4) {
    return {
      state: "warming",
      label: "Warming",
      scorePenalty: 10,
      color: "#facc15",
      description: "Early pressure is building.",
    };
  }
  return {
    state: "fresh",
    label: "Fresh",
    scorePenalty: 0,
    color: "#4ade80",
    description: "Recently seen. No drought pressure penalty.",
  };
}

function computeSuttaDroughts(entries: FlatEntry[]): Record<string, number> {
  const suttaDroughts: Record<string, number> = {};
  for (let s = 0; s <= 9; s++) suttaDroughts[String(s)] = 1000;

  for (let i = entries.length - 1; i >= 0; i--) {
    const sKey = String(entries[i].sutta);
    const drought = entries.length - 1 - i;
    if (suttaDroughts[sKey] === 1000) {
      suttaDroughts[sKey] = drought;
    }
    if (Object.values(suttaDroughts).every((v) => v < 1000)) break;
  }

  return suttaDroughts;
}

function countSuttaSignals(
  droughts: Record<string, number>,
): Record<SuttaSignalState, number> {
  const counts: Record<SuttaSignalState, number> = {
    fresh: 0,
    warming: 0,
    danger: 0,
    cooling: 0,
    snapback: 0,
    unknown: 0,
  };

  for (const drought of Object.values(droughts)) {
    counts[getSuttaSignal(drought).state]++;
  }

  return counts;
}


export { computeSuttaDroughts, countSuttaSignals };

