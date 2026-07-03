import type { PanelRecord } from "../db";
import type { DpDigitFocus, DpKindContext, JodiAnalysis, JodiCalibration, PanelPick, PredictionResult } from "./types";
import type { FlatEntry } from "./data";
import type { ScoringContext } from "./scoring";
import { VOL_MULTIPLIER } from "./market-config";
import { isDoublePanel } from "./panel-utils";
import { applyKnownOpenOperatorReaction } from "./operator-psychology";
import {
  JODI_SAMPLE_DENOMINATOR,
  JODI_SCORE_TUNING,
  JODI_STRENGTH_SCALE,
  buildKindPrediction,
  scorePanelsForPosition,
} from "./scoring";

function getDoublePanelDigitPair(panel: string): [string, string] | null {
  if (!isDoublePanel(panel)) return null;

  const counts: Record<string, number> = {};
  for (const digit of panel) counts[digit] = (counts[digit] ?? 0) + 1;

  const digits = Object.keys(counts);
  if (digits.length !== 2) return null;

  return digits.sort() as [string, string];
}

function buildDpDigitFocus(picks: PanelPick[], depth = 15): DpDigitFocus | null {
  const pairScores = new Map<
    string,
    {
      digits: [string, string];
      score: number;
      supportPanels: string[];
    }
  >();

  for (const [index, pick] of picks.slice(0, depth).entries()) {
    const digits = getDoublePanelDigitPair(pick.panel);
    if (!digits) continue;

    const pairKey = digits.join("");
    const rankWeight = depth - index;
    const weightedScore = pick.score * rankWeight;
    const current = pairScores.get(pairKey) ?? {
      digits,
      score: 0,
      supportPanels: [],
    };

    current.score += weightedScore;
    if (!current.supportPanels.includes(pick.panel)) {
      current.supportPanels.push(pick.panel);
    }
    pairScores.set(pairKey, current);
  }

  const ranked = [...pairScores.entries()].sort((a, b) => b[1].score - a[1].score);
  const winner = ranked[0];
  if (!winner) return null;

  const totalScore = ranked.reduce((sum, [, item]) => sum + item.score, 0);
  const [, item] = winner;

  return {
    digits: item.digits,
    pairKey: winner[0],
    score: Math.round(item.score * 10) / 10,
    confidence: totalScore > 0 ? Math.round((item.score / totalScore) * 1000) / 10 : 0,
    depth,
    supportPanels: item.supportPanels.slice(0, 4),
  };
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

  const adjustedPicks = applyKnownOpenOperatorReaction(
    scorePanelsForPosition(
      closeEntries,
      ctx,
      closeSuttaPenalties,
      JODI_SCORE_TUNING,
    ),
    openPanel,
  );

  const adjustedCloseDpPicks = adjustedPicks.filter((pick) => isDoublePanel(pick.panel));
  const adjustedCloseDpDigitFocus = buildDpDigitFocus(adjustedCloseDpPicks);

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
    adjustedCloseDpDigitFocus,
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
    operatorPanelAdjustments: result.closeOperatorContext.panelAdjustments,
  };
}


