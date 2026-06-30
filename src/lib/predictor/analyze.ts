import type { PanelRecord } from "../db";
import type { PredictionResult } from "./types";
import { getMarketCalibration } from "./calibration";
import {
  HIGH_VOL_SET,
  LIQUIDITY_FLOW_MAP,
  MEDIUM_VOL_SET,
  VOL_MULTIPLIER,
} from "./market-config";
import { isSequential, isTriple } from "./panel-utils";
import { computeSuttaDroughts, countSuttaSignals, getSuttaSignal } from "./sutta-signals";
import { flattenRecords } from "./data";
import { computeStats } from "./stats";
import { computeDpKindContext } from "./dp-kind-context";
import {
  CLOSE_SCORE_TUNING,
  CURRENT_SCORE_TUNING,
  buildKindPrediction,
  scoreDoublePanelsForPosition,
  scorePanelsForPosition,
} from "./scoring";

export function analyzeMarket(
  marketName: string,
  records: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  analysisDate = new Date(),
): PredictionResult | null {
  if (records.length === 0) return null;

  const stats = computeStats(records);
  const calibration = getMarketCalibration(marketName);
  const allPanelEntries = flattenRecords(records);
  if (allPanelEntries.length === 0) return null;

  // Split into position-specific entries
  const openEntries = allPanelEntries.filter((e) => e.type === "open");
  const closeEntries = allPanelEntries.filter((e) => e.type === "close");

  // ── 1. Volume Tier ────────────────────────────────────────────────────────
  const tier = HIGH_VOL_SET.has(marketName)
    ? "High"
    : MEDIUM_VOL_SET.has(marketName)
      ? "Medium"
      : "Low";
  const volMultiplier = VOL_MULTIPLIER[tier.toLowerCase()];

  // ── 2. Temporal Payday Cycle (FIXED DIRECTION) ────────────────────────────
  const today = analysisDate.getDate();
  let temporalMode: "Payday" | "Month-End" | "Normal";
  let temporalMultiplier: number;

  if (today >= 1 && today <= 5) {
    temporalMode = "Payday";
    temporalMultiplier = 0.7;
  } else if (today >= 25) {
    temporalMode = "Month-End";
    temporalMultiplier = 1.3;
  } else {
    temporalMode = "Normal";
    temporalMultiplier = 1.0;
  }

  // ── 3. Honey-Pot Drought Detection ────────────────────────────────────────
  let recordsSinceLastSequence = 0;
  for (let i = allPanelEntries.length - 1; i >= 0; i--) {
    if (isSequential(allPanelEntries[i].panel)) break;
    recordsSinceLastSequence++;
  }

  const droughts: number[] = [];
  let currentDrought = 0;
  for (const entry of allPanelEntries) {
    if (isSequential(entry.panel)) {
      if (currentDrought > 0) droughts.push(currentDrought);
      currentDrought = 0;
    } else {
      currentDrought++;
    }
  }
  const averageDroughtLength =
    droughts.length > 0
      ? droughts.reduce((a, b) => a + b, 0) / droughts.length
      : 21;

  const honeyPotAlert =
    recordsSinceLastSequence > Math.max(30, averageDroughtLength * 1.4);

  // ── 4. Sutta Saturation ───────────────────────────────────────────────────
  const combinedSuttaDroughts = computeSuttaDroughts(allPanelEntries);
  const openSuttaDroughts = computeSuttaDroughts(openEntries);
  const closeSuttaDroughts = computeSuttaDroughts(closeEntries);

  const saturatedSuttas = Object.entries(closeSuttaDroughts)
    .filter(([, d]) => getSuttaSignal(d).state === "danger")
    .map(([s]) => s);

  // ── 5. Liquidity Flow Correlation ─────────────────────────────────────────
  let liquidityMultiplier = 1.0;
  const liquiditySourceMarket = LIQUIDITY_FLOW_MAP[marketName] ?? null;
  let liquiditySourceHadPopular = false;

  if (liquiditySourceMarket) {
    const sourceRecords = allMarketsRecords[liquiditySourceMarket] ?? [];
    if (sourceRecords.length > 0) {
      const lastRec = sourceRecords[sourceRecords.length - 1];
      const lastOpen = lastRec.openPanel;
      const lastClose = lastRec.closePanel;
      if (
        (lastOpen && (isSequential(lastOpen) || isTriple(lastOpen))) ||
        (lastClose && (isSequential(lastClose) || isTriple(lastClose)))
      ) {
        liquidityMultiplier = 1.5;
        liquiditySourceHadPopular = true;
      } else {
        liquidityMultiplier = 0.9;
      }
    }
  }

  // ── 6. Build scoring context ──────────────────────────────────────────────
  const todayDayName = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][analysisDate.getDay()];

  const baseCtx = {
    honeyPotAlert,
    volMultiplier,
    temporalMultiplier,
    liquidityMultiplier,
    todayDayName,
  };

  // ── 7. Compute DP kind context (research-backed signals for SP/DP bias) ────────
  const openDpKindContext = computeDpKindContext(
    marketName,
    openEntries,
    closeEntries,
    allMarketsRecords,
    todayDayName,
    false,
  );
  const closeDpKindContext = computeDpKindContext(
    marketName,
    openEntries,
    closeEntries,
    allMarketsRecords,
    todayDayName,
    true,
  );

  // ── 8. Score panels for Open and Close (pure historical scoring, no dpBias in scores) ─
  // The dpBias is applied only inside buildKindPrediction (reranking for kind decision)
  // so individual panel recommendations stay stable and unaffected.
  const openCtx = {
    ...baseCtx,
    suttaDroughts: combinedSuttaDroughts,
    calibration: calibration.open,
  };
  const closeCtx = {
    ...baseCtx,
    suttaDroughts: closeSuttaDroughts,
    calibration: calibration.close,
  };

  const openPicks = scorePanelsForPosition(openEntries, openCtx);
  const closePicks = scorePanelsForPosition(
    closeEntries,
    closeCtx,
    undefined,
    CLOSE_SCORE_TUNING,
  );
  const openDpPicks = scoreDoublePanelsForPosition(
    openEntries,
    openCtx,
    CURRENT_SCORE_TUNING,
    "open",
  );
  const closeDpPicks = scoreDoublePanelsForPosition(
    closeEntries,
    closeCtx,
    CLOSE_SCORE_TUNING,
    "close",
  );

  const topPicks = scorePanelsForPosition(allPanelEntries, {
    ...baseCtx,
    suttaDroughts: combinedSuttaDroughts,
    calibration: calibration.open,
  });

  return {
    market: marketName,
    analysisDateISO: analysisDate.toISOString(),
    analysisDayName: todayDayName,
    calibration,
    volumeTier: tier,
    temporalMode,
    temporalMultiplier,
    liquidityMultiplier,
    liquiditySourceMarket,
    liquiditySourceHadPopular,
    honeyPotAlert,
    recordsSinceLastSequence,
    averageDroughtLength: Math.round(averageDroughtLength * 10) / 10,
    combinedSuttaDroughts,
    openSuttaDroughts,
    closeSuttaDroughts,
    suttaDroughts: closeSuttaDroughts,
    saturatedSuttas,
    suttaSignalCounts: countSuttaSignals(closeSuttaDroughts),
    topPicks: topPicks.slice(0, 30),
    openPicks: openPicks.slice(0, 30),
    closePicks: closePicks.slice(0, 30),
    openDpPicks: openDpPicks.slice(0, 30),
    closeDpPicks: closeDpPicks.slice(0, 30),
    openKindPrediction: buildKindPrediction(
      openPicks,
      openDpKindContext.dpBias,
    ),
    closeKindPrediction: buildKindPrediction(
      closePicks,
      closeDpKindContext.dpBias,
    ),
    openDpKindContext,
    closeDpKindContext,
    totalRecordsAnalysed: allPanelEntries.length,
    totalDraws: records.length,
    stats,
  };
}
