import type { PanelRecord } from "../db";
import type { FlatEntry } from "./data";
import type { DpKindContext, OperatorContext, PanelPick } from "./types";
import {
  ALL_PANELS,
  calculateSutta,
  countLuckyDigits,
  getPanelKind,
  isDoublePanel,
  isSequential,
  isTriple,
} from "./panel-utils";
import { getSuttaSignal } from "./sutta-signals";

type Position = "open" | "close";

interface OperatorContextInput {
  marketName: string;
  entries: FlatEntry[];
  suttaDroughts: Record<string, number>;
  position: Position;
  analysisDate: Date;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function panelParityShape(panel: string): "EEE" | "OOO" | "MIXED" {
  const evenCount = panel.split("").filter((digit) => Number(digit) % 2 === 0).length;
  if (evenCount === 3) return "EEE";
  if (evenCount === 0) return "OOO";
  return "MIXED";
}

function buildLastSeenMap(entries: FlatEntry[]): Record<string, number> {
  const lastSeen: Record<string, number> = {};
  for (let i = entries.length - 1; i >= 0; i--) {
    const panel = entries[i].panel;
    if (!(panel in lastSeen)) lastSeen[panel] = entries.length - 1 - i;
  }
  return lastSeen;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * p)];
}

function computeDpGapProfile(entries: FlatEntry[]) {
  const gaps: number[] = [];
  let currentGap = 0;

  for (const entry of entries) {
    if (isDoublePanel(entry.panel)) {
      gaps.push(currentGap);
      currentGap = 0;
    } else {
      currentGap++;
    }
  }

  return {
    currentGap,
    p90Gap: percentile(gaps, 0.9),
  };
}

function marketPressureMultiplier(marketName: string, position: Position): number {
  if (marketName === "Main Bazar" && position === "close") return 1.15;
  if (marketName === "Madhur Day" && position === "open") return 0.9;
  if (marketName.includes("Night") && position === "close") return 1.1;
  return 1;
}

function buildOperatorContext({
  marketName,
  entries,
  suttaDroughts,
  position,
  analysisDate,
}: OperatorContextInput): OperatorContext {
  const panelCounts: Record<string, number> = {};
  for (const entry of entries) {
    panelCounts[entry.panel] = (panelCounts[entry.panel] ?? 0) + 1;
  }

  const lastSeen = buildLastSeenMap(entries);
  const expectedPanelCount = Math.max(1, entries.length / ALL_PANELS.length);
  const pressureScale = marketPressureMultiplier(marketName, position);
  const adjustments: Record<string, number> = {};
  const signals: string[] = [];

  for (const panel of ALL_PANELS) {
    const count = panelCounts[panel] ?? 0;
    const panelSutta = calculateSutta(panel);
    const gap = lastSeen[panel] ?? Infinity;
    const z = (count - expectedPanelCount) / Math.sqrt(expectedPanelCount);
    let adjustment = 0;

    // Operators need believable results. Historically comfortable panels get a
    // tiny boost, while never-seen panels are treated as too dead-obvious.
    if (z > 1) adjustment += clamp(z * 1.7, 0, 5);
    else if (count === 0 && entries.length > 300) adjustment -= 4;
    else if (z < -1.25) adjustment -= 1.5;

    // Public-chase proxy: very fresh winners and very droughty suttas are likely
    // overbet, so the operator utility model avoids making them large favorites.
    if (gap <= 3) adjustment -= 5;
    else if (gap <= 8) adjustment -= 2;

    const drought = suttaDroughts[String(panelSutta)] ?? 0;
    const suttaState = getSuttaSignal(drought).state;
    if (suttaState === "snapback") adjustment -= 4 * pressureScale;
    else if (suttaState === "cooling") adjustment -= 2 * pressureScale;
    else if (suttaState === "danger" && drought > 12) adjustment -= 1.5 * pressureScale;

    // Popular-looking results are not impossible, but they carry public
    // liability. Keep this mild so camouflage wins can still surface.
    if (isTriple(panel)) adjustment -= 6;
    else if (isSequential(panel)) adjustment -= 2;
    adjustment -= countLuckyDigits(panel) * 0.8;

    adjustments[panel] = round(clamp(adjustment, -12, 8));
  }

  const recent = entries.slice(-12);
  const recentDpCount = recent.filter((entry) => isDoublePanel(entry.panel)).length;
  const recentDpRate = recent.length > 0 ? recentDpCount / recent.length : 0;
  const dpGap = computeDpGapProfile(entries);
  let dpBiasMultiplier = 1;
  let mood: OperatorContext["mood"] = "balanced";

  if (recent.length >= 8 && recentDpRate <= 0.12) {
    dpBiasMultiplier *= 1.08;
    mood = "hooking";
    signals.push("Operator hook pressure: recent DP scarcity (x1.08)");
  } else if (recent.length >= 8 && recentDpRate >= 0.42) {
    dpBiasMultiplier *= 0.9;
    mood = "defensive";
    signals.push("Operator defensive pressure: recent DP cluster (x0.90)");
  }

  if (dpGap.p90Gap !== null && dpGap.currentGap >= dpGap.p90Gap) {
    dpBiasMultiplier *= 1.05;
    signals.push(`DP retention gap >= p90 (${dpGap.currentGap}/${dpGap.p90Gap}, x1.05)`);
  }

  const date = analysisDate.getDate();
  if (date >= 1 && date <= 5) {
    mood = mood === "hooking" ? "hooking" : "defensive";
    signals.push("Payday book pressure: avoid obvious public bait");
  } else if (date >= 25) {
    signals.push("Month-end liquidity: camouflage band favored");
  }

  dpBiasMultiplier = round(clamp(dpBiasMultiplier, 0.82, 1.16));

  return {
    panelAdjustments: adjustments,
    dpBiasMultiplier,
    signals,
    mood,
  };
}

function mergeOperatorIntoDpContext(
  dpContext: DpKindContext,
  operatorContext: OperatorContext,
): DpKindContext {
  const dpBias = clamp(dpContext.dpBias * operatorContext.dpBiasMultiplier, 0.4, 2);
  return {
    ...dpContext,
    dpBias,
    signals: [
      ...dpContext.signals,
      ...operatorContext.signals.map((signal) => `Operator: ${signal}`),
    ],
  };
}

function applyKnownOpenOperatorReaction(
  picks: PanelPick[],
  openPanel: string | null,
): PanelPick[] {
  if (!openPanel || openPanel.length !== 3) return picks;

  const openFirst = openPanel[0];
  const openMiddle = openPanel[1];
  const openLast = openPanel[2];
  const openShape = panelParityShape(openPanel);

  return picks
    .map((pick) => {
      const sharesFirst = pick.panel.includes(openFirst);
      const sharesMiddle = pick.panel.includes(openMiddle);
      const sharesLast = pick.panel.includes(openLast);
      const closeShape = panelParityShape(pick.panel);
      let adjustment = 0;

      if (!sharesFirst && !sharesLast) adjustment += 10;
      else if (sharesFirst && sharesLast) adjustment -= 28;
      else adjustment -= 8;

      if (sharesMiddle) adjustment -= pick.kind === "DP" ? 6 : 3;

      if (openShape === "OOO" && closeShape === "EEE") {
        adjustment += pick.kind === "DP" ? 14 : 5;
      } else if (openShape === "EEE" && closeShape === "EEE") {
        adjustment += pick.kind === "DP" ? 8 : 3;
      }

      const score = Math.max(0, Math.min(100, pick.score + adjustment));
      return {
        ...pick,
        score: round(score),
        breakdown: {
          ...pick.breakdown,
          operatorAdjustment: round((pick.breakdown.operatorAdjustment ?? 0) + adjustment),
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}

export {
  applyKnownOpenOperatorReaction,
  buildOperatorContext,
  mergeOperatorIntoDpContext,
};
