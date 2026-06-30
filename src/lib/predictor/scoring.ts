import type { ModelCalibration, PanelKind, PanelKindPrediction, PanelPick } from "./types";
import type { FlatEntry } from "./data";
import {
  ALL_PANELS,
  DOUBLE_PANELS,
  calculateSutta,
  countLuckyDigits,
  getPanelKind,
  isDoublePanel,
  isSequential,
  isTriple,
  LUCKY_DIGIT_PENALTY_POINTS,
} from "./panel-utils";
import { getSuttaSignal } from "./sutta-signals";

interface ScoringContext {
  honeyPotAlert: boolean;
  volMultiplier: number;
  temporalMultiplier: number;
  liquidityMultiplier: number;
  suttaDroughts: Record<string, number>;
  todayDayName: string;
  calibration: ModelCalibration;
}

type RecencyMode = "current" | "older-heavy";

interface ScoreTuning {
  recencyMode: RecencyMode;
  useDayBoost: boolean;
  cooldownShort: number;
  cooldownMedium: number;
  seqPenaltyBase: number;
  triplePenaltyBase: number;
  luckyDigitPenaltyBase: number;
  suttaPenalty: {
    fresh: number;
    warming: number;
    danger: number;
    dangerHigh: number;
    cooling: number;
    snapback: number;
    unknown: number;
  };
}

const CURRENT_SCORE_TUNING: ScoreTuning = {
  recencyMode: "current",
  useDayBoost: true,
  cooldownShort: 40,
  cooldownMedium: 20,
  seqPenaltyBase: 35,
  triplePenaltyBase: 50,
  luckyDigitPenaltyBase: LUCKY_DIGIT_PENALTY_POINTS,
  suttaPenalty: {
    fresh: 0,
    warming: 10,
    danger: 30,
    dangerHigh: 35,
    cooling: 10,
    snapback: -25,
    unknown: 0,
  },
};

const OPEN_SCORE_TUNING: ScoreTuning = {
  ...CURRENT_SCORE_TUNING,
  suttaPenalty: {
    fresh: 0,
    warming: 0,
    danger: 0,
    dangerHigh: 0,
    cooling: 0,
    snapback: 0,
    unknown: 0,
  },
};

const CLOSE_SCORE_TUNING: ScoreTuning = {
  ...CURRENT_SCORE_TUNING,
  useDayBoost: false,
  suttaPenalty: {
    fresh: 0,
    warming: -5,
    danger: -10,
    dangerHigh: -10,
    cooling: -15,
    snapback: -25,
    unknown: 0,
  },
};

const JODI_SCORE_TUNING = CLOSE_SCORE_TUNING;
const JODI_SAMPLE_DENOMINATOR = 500;
const JODI_STRENGTH_SCALE = 0.5;
type DpScoreProfile = "open" | "close";

function getRecencyScore(lastSeen: number, mode: RecencyMode): number {
  if (mode === "older-heavy") {
    if (lastSeen <= 3) return 0;
    if (lastSeen <= 8) return 20;
    if (lastSeen <= 20) return 50;
    if (lastSeen <= 50) return 75;
    if (lastSeen <= 100) return 90;
    return 80;
  }

  if (lastSeen <= 3) return 5;
  if (lastSeen <= 8) return 30;
  if (lastSeen <= 20) return 60;
  if (lastSeen <= 50) return 85;
  if (lastSeen <= 100) return 70;
  return 50;
}

function getCloseDpRecencyScore(lastSeen: number): number {
  if (lastSeen <= 3) return 0;
  if (lastSeen <= 8) return 20;
  if (lastSeen <= 20) return 50;
  if (lastSeen <= 50) return 85;
  if (lastSeen <= 100) return 90;
  return 80;
}

function getTunedSuttaPenalty(drought: number, tuning: ScoreTuning): number {
  const state = getSuttaSignal(drought).state;
  if (state === "danger" && drought > 12) return tuning.suttaPenalty.dangerHigh;
  return tuning.suttaPenalty[state] ?? 0;
}

function getLastSeenGap(
  entries: FlatEntry[],
  predicate: (entry: FlatEntry) => boolean,
): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (predicate(entries[i])) return entries.length - 1 - i;
  }
  return 1000;
}

function getDoublePanelDigit(panel: string): string | null {
  if (!isDoublePanel(panel)) return null;
  const counts: Record<string, number> = {};
  for (const digit of panel) counts[digit] = (counts[digit] ?? 0) + 1;
  return Object.entries(counts).find(([, count]) => count === 2)?.[0] ?? null;
}

function countDayDpSignals(entries: FlatEntry[], dayName: string) {
  const repeatedDigitCounts: Record<string, number> = {};
  const suttaCounts: Record<string, number> = {};
  let total = 0;

  for (const entry of entries) {
    if (entry.day !== dayName || !isDoublePanel(entry.panel)) continue;
    const digit = getDoublePanelDigit(entry.panel);
    if (digit !== null)
      repeatedDigitCounts[digit] = (repeatedDigitCounts[digit] ?? 0) + 1;
    suttaCounts[String(entry.sutta)] =
      (suttaCounts[String(entry.sutta)] ?? 0) + 1;
    total++;
  }

  return { repeatedDigitCounts, suttaCounts, total };
}

// ─── DP Kind Context (research-backed signals) ───────────────────────────────

/**
 * Computes a DP/SP bias multiplier from research-backed statistical patterns:
 *
 *  1. Weekday bias — Sunday suppresses DP to 18%, Tuesday boosts to 27%.
 *  2. Sutta-3 blind-spot fix — when prev close sutta=3 the predictor
 *     historically misses DPs at 68.2% rate. We apply a +40% DP boost.
 *  3. Market-specific digit triggers (30-day walk-forward validated):
 *       Kalyan prev-close dpDigit=8          → 60% DP   (30 support)
 *       Night markets prev-open dpDigit=3    → 70.4% DP (27 support)
 *       Milan Day prev-close dpDigit=1       → 54.2% DP (24 support)
 *       Sridevi Night prev-open dpDigit=2    → 55% DP   (20 support)
 *       Madhur Day prev-open dpDigit=8       → 56% DP   (25 support)
 *       Time Bazar + Sridevi open dpDigit=6  → 57.1% DP (21 support)
 *  4. Double digit echo — prev-open dpDigit=2 + prev-close dpDigit=4 → 66.7%.
 *  5. Source market digit triggers (liquidity flow chain).
 *  6. Night→Day DP count: prev night had exactly 1 open DP → 65.2% for day.
 *  7. 2-year structural shift: day DP up 4%, night close DP down 4%.
 */

function buildKindPrediction(
  picks: PanelPick[],
  dpBias: number = 1.0,
): PanelKindPrediction {
  // Re-rank using effective scores (dpBias applied to DP panels only)
  const reranked = picks
    .map((p) => ({
      ...p,
      effectiveScore: p.kind === "DP" ? p.score * dpBias : p.score,
    }))
    .sort((a, b) => b.effectiveScore - a.effectiveScore);

  const top30 = reranked.slice(0, 30);
  const top30Counts: Record<PanelKind, number> = { SP: 0, DP: 0 };
  const scores: Record<PanelKind, number> = { SP: 0, DP: 0 };

  top30.forEach((pick, index) => {
    const rankWeight = top30.length - index;
    scores[pick.kind] += Math.max(1, pick.effectiveScore) * rankWeight;
    top30Counts[pick.kind]++;
  });

  // Structural expected DP count in top30 = (90 / 220) * 30 ≈ 12.27
  // Predict DP only when STRONG signals are present (dpBias ≥ 1.50).
  // This threshold was chosen so that mild, broad signals (e.g., just the
  // night→day 1-DP warm-up = ×1.28 × ×1.04 structural = 1.33) remain SP,
  // while confirmed multi-signal situations (sutta-3 + digit trigger
  // ≥ 1.50) flip to DP. At the 1.50 level the actual DP probability in
  // the research data was consistently above 55-70%.
  const expectedDpInTop30 = (90 / 220) * 30; // ≈ 12.27
  const dpThresholdReached =
    top30Counts.DP > expectedDpInTop30 && dpBias >= 1.4;
  const predictedKind: PanelKind = dpThresholdReached ? "DP" : "SP";

  const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);

  return {
    predictedKind,
    confidence:
      totalScore > 0
        ? Math.round((scores[predictedKind] / totalScore) * 1000) / 10
        : 0,
    scores: {
      SP: Math.round(scores.SP * 10) / 10,
      DP: Math.round(scores.DP * 10) / 10,
    },
    top30Counts,
  };
}

/**
 * Score all 220 panels against a set of position-specific entries.
 * This is the core scoring function, called separately for Open and Close positions.
 */
function scorePanelsForPosition(
  entries: FlatEntry[],
  ctx: ScoringContext,
  jodiSuttaPenalties?: Record<number, number>,
  tuning: ScoreTuning = CURRENT_SCORE_TUNING,
): PanelPick[] {
  if (entries.length === 0) return [];

  // Build recency lookup from position-specific entries
  const panelLastSeen: Record<string, number> = {};
  for (let i = entries.length - 1; i >= 0; i--) {
    const p = entries[i].panel;
    if (!(p in panelLastSeen)) {
      panelLastSeen[p] = entries.length - 1 - i;
    }
  }

  // Day-of-week sutta distribution
  const daySuttaCounts: Record<string, number> = {};
  let dayTotalCount = 0;
  for (const entry of entries) {
    if (entry.day === ctx.todayDayName) {
      const s = String(entry.sutta);
      daySuttaCounts[s] = (daySuttaCounts[s] ?? 0) + 1;
      dayTotalCount++;
    }
  }

  const picks: PanelPick[] = [];

  for (const panel of ALL_PANELS) {
    const lastSeen = panelLastSeen[panel] ?? Infinity;
    const panelSutta = calculateSutta(panel);
    const panelIsSeq = isSequential(panel);
    const panelIsTriple = isTriple(panel);
    const panelKind = getPanelKind(panel);

    // --- A) Recency Score ---
    const recencyScore = getRecencyScore(lastSeen, tuning.recencyMode);

    // --- B) Cooldown Penalty ---
    const cooldownPenalty =
      lastSeen <= 3
        ? tuning.cooldownShort
        : lastSeen <= 5
          ? tuning.cooldownMedium
          : 0;

    // --- C) Sequential penalty (or BONUS during honey-pot) ---
    let seqPenalty = 0;
    if (panelIsSeq) {
      if (ctx.honeyPotAlert) {
        seqPenalty = -40;
      } else {
        seqPenalty =
          tuning.seqPenaltyBase *
          ctx.volMultiplier *
          ctx.temporalMultiplier *
          ctx.liquidityMultiplier;
      }
    }

    // --- D) Lucky-digit penalty ---
    const luckyPenalty =
      countLuckyDigits(panel) *
      tuning.luckyDigitPenaltyBase *
      ctx.volMultiplier *
      ctx.temporalMultiplier *
      ctx.liquidityMultiplier;

    // --- E) Triple penalty ---
    const triplePenalty = panelIsTriple
      ? tuning.triplePenaltyBase *
        ctx.volMultiplier *
        ctx.temporalMultiplier *
        ctx.liquidityMultiplier
      : 0;

    // --- F) Sutta pressure (position-specific rubber-band curve) ---
    const suttaDrought = ctx.suttaDroughts[String(panelSutta)] ?? 0;
    const saturationPenalty = getTunedSuttaPenalty(suttaDrought, tuning);

    // --- G) Day-of-week boost ---
    let dayBoost = 0;
    if (tuning.useDayBoost && dayTotalCount > 20) {
      const suttaDayRate =
        (daySuttaCounts[String(panelSutta)] ?? 0) / dayTotalCount;
      const expectedRate = 0.1;
      if (suttaDayRate > expectedRate * 1.3) {
        dayBoost = 10 * (suttaDayRate / expectedRate);
      }
    }

    // --- H) Jodi penalty (only for Close panels with Jodi model active) ---
    const jodiPenalty = jodiSuttaPenalties?.[panelSutta] ?? 0;

    // --- Final Score ---
    const rawScore =
      recencyScore -
      cooldownPenalty -
      seqPenalty -
      luckyPenalty -
      triplePenalty -
      saturationPenalty +
      dayBoost -
      jodiPenalty;

    const finalScore = Math.max(0, Math.min(100, rawScore));

    picks.push({
      panel,
      sutta: panelSutta,
      kind: panelKind,
      score: Math.round(finalScore * 100) / 100,
      isHoneyPotPick: ctx.honeyPotAlert && panelIsSeq,
      isSequential: panelIsSeq,
      isTriple: panelIsTriple,
      breakdown: {
        recencyScore: Math.round(recencyScore * 100) / 100,
        seqPenalty: Math.round(seqPenalty * 100) / 100,
        luckyPenalty: Math.round(luckyPenalty * 100) / 100,
        triplePenalty: Math.round(triplePenalty * 100) / 100,
        saturationPenalty: Math.round(saturationPenalty * 100) / 100,
        cooldownPenalty,
        dayBoost: Math.round(dayBoost * 100) / 100,
        jodiPenalty: Math.round(jodiPenalty * 100) / 100,
      },
    });
  }

  picks.sort((a, b) => b.score - a.score);
  return picks;
}

// ─── Core Analysis ───────────────────────────────────────────────────────────

function scoreDoublePanelsForPosition(
  entries: FlatEntry[],
  ctx: ScoringContext,
  tuning: ScoreTuning,
  profile: DpScoreProfile,
): PanelPick[] {
  if (entries.length === 0) return [];

  const daySignals = countDayDpSignals(entries, ctx.todayDayName);
  const picks: PanelPick[] = [];

  for (const panel of DOUBLE_PANELS) {
    const panelSutta = calculateSutta(panel);
    const repeatedDigit = getDoublePanelDigit(panel);
    const panelGap = getLastSeenGap(entries, (entry) => entry.panel === panel);
    const digitGap =
      repeatedDigit === null
        ? 1000
        : getLastSeenGap(
            entries,
            (entry) =>
              isDoublePanel(entry.panel) &&
              getDoublePanelDigit(entry.panel) === repeatedDigit,
          );
    const suttaGap = getLastSeenGap(
      entries,
      (entry) => isDoublePanel(entry.panel) && entry.sutta === panelSutta,
    );
    const panelIsSeq = isSequential(panel);
    const panelIsTriple = isTriple(panel);

    const recencyScore =
      profile === "close"
        ? getCloseDpRecencyScore(panelGap)
        : getRecencyScore(panelGap, tuning.recencyMode);
    const cooldownPenalty =
      panelGap <= 3
        ? tuning.cooldownShort
        : panelGap <= 5
          ? tuning.cooldownMedium
          : 0;

    let seqPenalty = 0;
    if (panelIsSeq) {
      seqPenalty = ctx.honeyPotAlert
        ? -40
        : tuning.seqPenaltyBase *
          ctx.volMultiplier *
          ctx.temporalMultiplier *
          ctx.liquidityMultiplier;
    }

    const triplePenalty = panelIsTriple
      ? tuning.triplePenaltyBase *
        ctx.volMultiplier *
        ctx.temporalMultiplier *
        ctx.liquidityMultiplier
      : 0;
    const saturationPenalty = 0;
    const repeatedDigitScore = getRecencyScore(digitGap, "current");
    const dpSuttaScore = getRecencyScore(suttaGap, "current");
    const dayRepeatedBoost =
      daySignals.total > 20 && repeatedDigit !== null
        ? (daySignals.repeatedDigitCounts[repeatedDigit] ?? 0) *
          (profile === "open" ? 1.2 : 0.4)
        : 0;
    const daySuttaBoost =
      daySignals.total > 20
        ? (daySignals.suttaCounts[String(panelSutta)] ?? 0) *
          (profile === "open" ? 0.8 : 0.3)
        : 0;
    const dpDigitCooldown = digitGap <= 1 ? (profile === "close" ? 8 : 15) : 0;
    const dpOverlay =
      profile === "open"
        ? dayRepeatedBoost + daySuttaBoost
        : repeatedDigitScore * 0.25 +
          dpSuttaScore * 0.2 +
          dayRepeatedBoost +
          daySuttaBoost;

    const rawScore =
      recencyScore +
      dpOverlay -
      cooldownPenalty -
      seqPenalty -
      triplePenalty -
      saturationPenalty -
      dpDigitCooldown;

    const finalScore = Math.max(0, Math.min(100, rawScore));

    picks.push({
      panel,
      sutta: panelSutta,
      kind: "DP",
      score: Math.round(finalScore * 100) / 100,
      isHoneyPotPick: ctx.honeyPotAlert && panelIsSeq,
      isSequential: panelIsSeq,
      isTriple: panelIsTriple,
      breakdown: {
        recencyScore: Math.round(recencyScore * 100) / 100,
        seqPenalty: Math.round(seqPenalty * 100) / 100,
        luckyPenalty: 0,
        triplePenalty: Math.round(triplePenalty * 100) / 100,
        saturationPenalty: Math.round(saturationPenalty * 100) / 100,
        cooldownPenalty: cooldownPenalty + dpDigitCooldown,
        dayBoost: Math.round((dayRepeatedBoost + daySuttaBoost) * 100) / 100,
        jodiPenalty: 0,
      },
    });
  }

  picks.sort((a, b) => b.score - a.score);
  return picks;
}

export type { ScoringContext, ScoreTuning, DpScoreProfile };
export {
  CURRENT_SCORE_TUNING,
  OPEN_SCORE_TUNING,
  CLOSE_SCORE_TUNING,
  JODI_SCORE_TUNING,
  JODI_SAMPLE_DENOMINATOR,
  JODI_STRENGTH_SCALE,
  getRecencyScore,
  getCloseDpRecencyScore,
  getTunedSuttaPenalty,
  getLastSeenGap,
  countDayDpSignals,
  buildKindPrediction,
  scorePanelsForPosition,
  scoreDoublePanelsForPosition,
};

