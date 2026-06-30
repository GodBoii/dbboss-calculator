import type { PanelRecord } from "../db";
import type { DpKindContext, JodiAnalysis, JodiCalibration, PanelPick, PredictionResult } from "./types";
import type { FlatEntry } from "./data";
import type { ScoringContext } from "./scoring";
import { VOL_MULTIPLIER } from "./market-config";
import { isDoublePanel } from "./panel-utils";
import {
  JODI_SAMPLE_DENOMINATOR,
  JODI_SCORE_TUNING,
  JODI_STRENGTH_SCALE,
  buildKindPrediction,
  scorePanelsForPosition,
} from "./scoring";

function applyOpenPanelCleanFilter(picks: PanelPick[], openPanel: string | null): PanelPick[] {
  if (!openPanel || openPanel.length !== 3) return picks;

  const openFirst = openPanel[0];
  const openLast = openPanel[2];

  return picks
    .map((pick) => {
      const sharesFirst = pick.panel.includes(openFirst);
      const sharesLast = pick.panel.includes(openLast);
      let adjustment = 0;

      if (!sharesFirst && !sharesLast) adjustment = 18;
      else if (sharesFirst && sharesLast) adjustment = -45;
      else adjustment = -14;

      const score = Math.max(0, Math.min(100, pick.score + adjustment));
      return {
        ...pick,
        score: Math.round(score * 100) / 100,
        breakdown: {
          ...pick.breakdown,
          dayBoost: Math.round((pick.breakdown.dayBoost + adjustment) * 100) / 100,
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function computeJodiAnalysis(
  openSutta: number,
  openPanel: string | null,
  records: PanelRecord[],
  ctx: ScoringContext,
  dpKindContext?: DpKindContext,
): JodiAnalysis {
  const jodiCalibration = ctx.calibration as JodiCalibration;
  const jodiStrength = (jodiCalibration.strength ?? 0.8) * JODI_STRENGTH_SCALE;

  // 1. Count Close Sutta distribution when Open Sutta matches
  const closeSuttaCounts: Record<number, number> = {};
  for (let s = 0; s <= 9; s++) closeSuttaCounts[s] = 0;
  let totalMatches = 0;

  for (const rec of records) {
    if (rec.openSutta === openSutta && rec.jodi && rec.closeSutta >= 0) {
      closeSuttaCounts[rec.closeSutta] =
        (closeSuttaCounts[rec.closeSutta] ?? 0) + 1;
      totalMatches++;
    }
  }

  // 2. Build Jodi frequency table
  const avgCount = totalMatches > 0 ? totalMatches / 10 : 0;
  const sampleWeight = Math.min(1, totalMatches / JODI_SAMPLE_DENOMINATOR);
  const jodiFrequencies: JodiAnalysis["jodiFrequencies"] = [];

  for (let cs = 0; cs <= 9; cs++) {
    const count = closeSuttaCounts[cs];
    jodiFrequencies.push({
      jodi: `${openSutta}${cs}`,
      closeSutta: cs,
      count,
      percentage:
        totalMatches > 0 ? Math.round((count / totalMatches) * 1000) / 10 : 0,
      ratio: avgCount > 0 ? Math.round((count / avgCount) * 100) / 100 : 1,
      edge: "neutral",
    });
  }
  jodiFrequencies.sort((a, b) => b.count - a.count);

  // 3. Compute each Close Sutta's empirical Open-to-Close adjustment.
  const closeSuttaPenalties: Record<number, number> = {};
  const blacklisted: number[] = [];
  const safe: number[] = [];

  for (let cs = 0; cs <= 9; cs++) {
    const ratio = avgCount > 0 ? closeSuttaCounts[cs] / avgCount : 1;

    if (ratio > 1.5) {
      // Strong historical follow-through for this Close Sutta.
      closeSuttaPenalties[cs] = -24 * sampleWeight * jodiStrength;
      safe.push(cs);
    } else if (ratio > 1.2) {
      // Moderate historical follow-through for this Close Sutta.
      closeSuttaPenalties[cs] = -12 * sampleWeight * jodiStrength;
      safe.push(cs);
    } else if (ratio < 0.6) {
      // Rare historical follow-through for this Close Sutta.
      closeSuttaPenalties[cs] = 24 * sampleWeight * jodiStrength;
      blacklisted.push(cs);
    } else if (ratio < 0.8) {
      closeSuttaPenalties[cs] = 12 * sampleWeight * jodiStrength;
      blacklisted.push(cs);
    } else {
      closeSuttaPenalties[cs] = 0;
    }
  }

  for (const frequency of jodiFrequencies) {
    frequency.edge = safe.includes(frequency.closeSutta)
      ? "favored"
      : blacklisted.includes(frequency.closeSutta)
        ? "avoid"
        : "neutral";
  }

  // 4. Get Close-only entries and re-score with Jodi penalties
  const closeEntries: FlatEntry[] = [];
  let idx = 0;
  for (const rec of records) {
    if (rec.closePanel) {
      closeEntries.push({
        panel: rec.closePanel,
        sutta: rec.closeSutta,
        type: "close",
        day: rec.day,
        index: idx++,
      });
    }
  }

  const adjustedPicks = scorePanelsForPosition(
    closeEntries,
    ctx,
    closeSuttaPenalties,
    JODI_SCORE_TUNING,
  );

  const adjustedCloseDpPicks = applyOpenPanelCleanFilter(
    adjustedPicks.filter((pick) => isDoublePanel(pick.panel)),
    openPanel,
  );

  return {
    openSutta,
    openPanel,
    calibration: jodiCalibration,
    jodiStrength,
    jodiFrequencies,
    favoredCloseSuttas: safe,
    avoidedCloseSuttas: blacklisted,
    blacklistedCloseSuttas: blacklisted,
    safeCloseSuttas: safe,
    closeSuttaPenalties,
    adjustedClosePicks: adjustedPicks.slice(0, 30),
    adjustedCloseDpPicks: adjustedCloseDpPicks.slice(0, 30),
    kindPrediction: buildKindPrediction(adjustedPicks, dpKindContext ?? 1.0, 1.3),
    totalMatchingDraws: totalMatches,
  };
}

/**
 * Helper: build a ScoringContext from a PredictionResult.
 * Useful for calling computeJodiAnalysis from the UI after analyzeMarket.
 */
export function buildContextFromResult(
  result: PredictionResult,
): ScoringContext {
  const tier = result.volumeTier.toLowerCase();
  return {
    honeyPotAlert: result.honeyPotAlert,
    volMultiplier: VOL_MULTIPLIER[tier] ?? 1.0,
    temporalMultiplier: result.temporalMultiplier,
    liquidityMultiplier: result.liquidityMultiplier,
    suttaDroughts: result.closeSuttaDroughts,
    todayDayName: result.analysisDayName,
    calibration: result.calibration.jodi,
  };
}


