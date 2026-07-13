import { getRecordISODate, type PanelRecord } from "../db";
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
import {
  preservePanelPrefix,
  rerankOpenPanelsByProfile,
  rerankPanelsByFrequencyBlend,
  rerankPanelsByProfile,
} from "./panel-profile";
import { computeStats } from "./stats";
import { computeDpKindContext } from "./dp-kind-context";
import {
  buildOperatorContext,
  mergeOperatorIntoDpContext,
} from "./operator-psychology";
import { applyPrecisionKindOverride } from "./precision-kind-overrides";
import {
  CLOSE_SCORE_TUNING,
  CURRENT_SCORE_TUNING,
  OPEN_SCORE_TUNING,
  buildDpDigitFocus,
  buildKindPrediction,
  boostDoublePanelFocusPicks,
  scoreDoublePanelsForPosition,
  scorePanelsForPosition,
} from "./scoring";

const CLOSE_LAG3_PROFILE_MARKETS = new Set([
  "Milan Day",
  "Rajdhani Day",
  "Kalyan",
  "Sridevi Night",
  "Main Bazar",
]);

function previousMainBazarPanels(
  allMarketsRecords: Record<string, PanelRecord[]>,
  analysisDate: Date,
): string[] {
  const targetISO = analysisDate.toISOString().slice(0, 10);
  const previous = (allMarketsRecords["Main Bazar"] ?? [])
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item): item is { record: PanelRecord; isoDate: string } =>
      Boolean(item.isoDate && item.isoDate < targetISO),
    )
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    .at(-1)?.record;
  return previous
    ? [previous.openPanel, previous.closePanel].filter((panel) => panel?.length === 3)
    : [];
}

export function analyzeMarket(
  marketName: string,
  records: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  analysisDate = new Date(),
  options: { useOpenPanelProfile?: boolean } = {},
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
  const openOperatorContext = buildOperatorContext({
    marketName,
    entries: openEntries,
    suttaDroughts: combinedSuttaDroughts,
    position: "open",
    analysisDate,
  });
  const closeOperatorContext = buildOperatorContext({
    marketName,
    entries: closeEntries,
    suttaDroughts: closeSuttaDroughts,
    position: "close",
    analysisDate,
  });

  const openDpKindContext = mergeOperatorIntoDpContext(computeDpKindContext(
    marketName,
    openEntries,
    closeEntries,
    allMarketsRecords,
    todayDayName,
    false,
    analysisDate,
  ), openOperatorContext);
  const closeDpKindContext = mergeOperatorIntoDpContext(computeDpKindContext(
    marketName,
    openEntries,
    closeEntries,
    allMarketsRecords,
    todayDayName,
    true,
    analysisDate,
  ), closeOperatorContext);

  // ── 8. Score panels for Open and Close (pure historical scoring, no dpBias in scores) ─
  // The dpBias is applied only inside buildKindPrediction (reranking for kind decision)
  // so individual panel recommendations stay stable and unaffected.
  const openCtx = {
    ...baseCtx,
    suttaDroughts: combinedSuttaDroughts,
    calibration: calibration.open,
    operatorPanelAdjustments: openOperatorContext.panelAdjustments,
  };
  const closeCtx = {
    ...baseCtx,
    suttaDroughts: closeSuttaDroughts,
    calibration: calibration.close,
    operatorPanelAdjustments: closeOperatorContext.panelAdjustments,
  };

  const scoredOpenPicks = scorePanelsForPosition(
    openEntries,
    openCtx,
    undefined,
    OPEN_SCORE_TUNING,
  );
  const openPicks = options.useOpenPanelProfile === false
    ? scoredOpenPicks
    : rerankOpenPanelsByProfile(scoredOpenPicks, openEntries);
  let openPanelPicks = openPicks;
  if (marketName === "Sridevi") {
    openPanelPicks = rerankPanelsByProfile(scoredOpenPicks, openEntries, {
      externalPanels: previousMainBazarPanels(allMarketsRecords, analysisDate),
      externalRelation: "overlap",
      oppositeWeight: 0.25,
    });
  } else if (marketName === "Sridevi Night") {
    openPanelPicks = rerankPanelsByProfile(scoredOpenPicks, openEntries, {
      oppositeWeight: 0.5,
    });
  } else if (marketName === "Madhur Night") {
    openPanelPicks = preservePanelPrefix(
      openPicks,
      rerankPanelsByProfile(scoredOpenPicks, openEntries, { oppositeWeight: 0.75 }),
      3,
    );
  } else if (marketName === "Milan Night") {
    openPanelPicks = rerankPanelsByProfile(scoredOpenPicks, openEntries, {
      sourceRelation: "overlap",
      oppositeWeight: -0.35,
    });
  }
  const scoredClosePicks = scorePanelsForPosition(
    closeEntries,
    closeCtx,
    undefined,
    CLOSE_SCORE_TUNING,
  );
  const closePicks = scoredClosePicks;
  let closePanelPicks = CLOSE_LAG3_PROFILE_MARKETS.has(marketName)
    ? rerankPanelsByProfile(scoredClosePicks, closeEntries, { sourceLag: 3 })
    : scoredClosePicks;
  if (marketName === "Sridevi") {
    closePanelPicks = rerankPanelsByProfile(scoredClosePicks, closeEntries, {
      oppositeWeight: 0,
      structureWeight: 0.35,
      transitionWeight: 0.45,
    });
  } else if (marketName === "Time Bazar") {
    closePanelPicks = preservePanelPrefix(
      scoredClosePicks,
      rerankPanelsByFrequencyBlend(scoredClosePicks, closeEntries),
      10,
    );
  } else if (marketName === "Milan Day") {
    closePanelPicks = rerankPanelsByProfile(scoredClosePicks, closeEntries, {
      sourceRelation: "overlap",
    });
  } else if (marketName === "Madhur Night") {
    closePanelPicks = preservePanelPrefix(
      scoredClosePicks,
      rerankPanelsByProfile(scoredClosePicks, closeEntries, { sourceLag: 7 }),
      3,
    );
  } else if (marketName === "Rajdhani Night") {
    closePanelPicks = preservePanelPrefix(
      scoredClosePicks,
      rerankPanelsByProfile(scoredClosePicks, closeEntries, { sourceLag: 3 }),
      3,
    );
  }
  const openDpPicks = boostDoublePanelFocusPicks(
    scoreDoublePanelsForPosition(
      openEntries,
      openCtx,
      CURRENT_SCORE_TUNING,
      "open",
    ),
    openDpKindContext,
  );
  const closeDpPicks = boostDoublePanelFocusPicks(
    scoreDoublePanelsForPosition(
      closeEntries,
      closeCtx,
      CLOSE_SCORE_TUNING,
      "close",
    ),
    closeDpKindContext,
  );

  const topPicks = scorePanelsForPosition(
    allPanelEntries,
    {
      ...baseCtx,
      suttaDroughts: combinedSuttaDroughts,
      calibration: calibration.open,
      operatorPanelAdjustments: openOperatorContext.panelAdjustments,
    },
    undefined,
    OPEN_SCORE_TUNING,
  );

  const openKindPrediction = applyPrecisionKindOverride({
    marketName,
    side: "open",
    records,
    allMarketsRecords,
    analysisDate,
    basePrediction: buildKindPrediction(
      openPicks,
      openDpKindContext,
      1.25,
    ),
    dpContext: openDpKindContext,
  });
  const closeKindPrediction = applyPrecisionKindOverride({
    marketName,
    side: "close",
    records,
    allMarketsRecords,
    analysisDate,
    basePrediction: buildKindPrediction(
      scoredClosePicks,
      closeDpKindContext,
      1.3,
    ),
    dpContext: closeDpKindContext,
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
    openPanelPicks: openPanelPicks.slice(0, 30),
    closePicks: closePicks.slice(0, 30),
    closePanelPicks: closePanelPicks.slice(0, 30),
    openDpPicks: openDpPicks.slice(0, 30),
    closeDpPicks: closeDpPicks.slice(0, 30),
    openDpDigitFocus: buildDpDigitFocus(openDpPicks),
    closeDpDigitFocus: buildDpDigitFocus(closeDpPicks),
    openKindPrediction,
    closeKindPrediction,
    openDpKindContext,
    closeDpKindContext,
    openOperatorContext,
    closeOperatorContext,
    totalRecordsAnalysed: allPanelEntries.length,
    totalDraws: records.length,
    stats,
  };
}
