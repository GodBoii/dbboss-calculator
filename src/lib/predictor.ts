/**
 * Game-Theory Prediction Engine v3
 *
 * Core Philosophy (from analysis.md):
 * The Satta Matka system operates on Parimutuel Liability Minimization.
 * The operator's ledger ALGORITHMICALLY selects the lowest-liability outcome.
 *
 * v3 Changes:
 *  - Separate Open vs Close predictions (different statistical distributions)
 *  - Jodi Dependency Model: real-time Close prediction using known Open result
 *  - Extracted scoring into reusable helper function
 *  - Rubber-band sutta saturation (extreme drought = bonus)
 */

import type { PanelRecord } from "./db";

// ─── Market Config ────────────────────────────────────────────────────────────

export const HIGH_VOLUME_MARKETS = [
  "Sridevi",
  "Time Bazar",
  "Madhur Day",
  "Milan Day",
  "Rajdhani Day",
  "Kalyan",
  "Sridevi Night",
  "Madhur Night",
  "Milan Night",
  "Rajdhani Night",
  "Main Bazar",
];

// Night markets set — used for weekday and cross-session DP signals
const NIGHT_MARKET_NAMES = new Set([
  "Sridevi Night",
  "Madhur Night",
  "Milan Night",
  "Rajdhani Night",
  "Main Bazar",
]);

/**
 * Weekday DP bias multipliers derived from 13-year historical data (42,548 panels).
 * Sunday: 18.2% open / 18.7% close  vs 24.4% baseline — structural suppression.
 * Tuesday: 26.8% open / 25.6% close — peak day (payday-overflow effect).
 * Saturday close: 21.4% — end-of-week liquidity drop.
 */
const WEEKDAY_DP_BIAS_OPEN: Record<string, number> = {
  Sunday: 0.75, // 18.2% / 24.4%
  Monday: 1.07, // 26.2% / 24.4%
  Tuesday: 1.1, // 26.8% / 24.4%
  Wednesday: 1.04, // 25.5% / 24.4%
  Thursday: 1.0,
  Friday: 1.0,
  Saturday: 1.0,
};
const WEEKDAY_DP_BIAS_CLOSE: Record<string, number> = {
  Sunday: 0.77, // 18.7% / 24.4%
  Monday: 1.0,
  Tuesday: 1.05, // 25.6% / 24.4%
  Wednesday: 1.0,
  Thursday: 0.98,
  Friday: 0.96,
  Saturday: 0.88, // 21.4% / 24.4%
};

const LIQUIDITY_FLOW_MAP: Record<string, string> = {
  "Time Bazar": "Sridevi",
  "Madhur Day": "Time Bazar",
  "Milan Day": "Madhur Day",
  "Rajdhani Day": "Milan Day",
  Kalyan: "Rajdhani Day",
  "Sridevi Night": "Kalyan",
  "Madhur Night": "Sridevi Night",
  "Milan Night": "Madhur Night",
  "Rajdhani Night": "Milan Night",
  "Main Bazar": "Rajdhani Night",
};

const VOL_MULTIPLIER: Record<string, number> = {
  high: 0.6,
  medium: 0.8,
  low: 1.0,
};

const HIGH_VOL_SET = new Set(HIGH_VOLUME_MARKETS);
const MEDIUM_VOL_SET = new Set([
  "Time Bazar",
  "Madhur Day",
  "Rajdhani Day",
  "Sridevi Night",
  "Madhur Night",
  "Rajdhani Night",
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PredictionResult {
  market: string;
  analysisDateISO: string;
  analysisDayName: string;
  calibration: MarketCalibration;
  volumeTier: "High" | "Medium" | "Low";
  temporalMode: "Payday" | "Month-End" | "Normal";
  temporalMultiplier: number;
  liquidityMultiplier: number;
  liquiditySourceMarket: string | null;
  liquiditySourceHadPopular: boolean;
  honeyPotAlert: boolean;
  recordsSinceLastSequence: number;
  averageDroughtLength: number;
  combinedSuttaDroughts: Record<string, number>;
  openSuttaDroughts: Record<string, number>;
  closeSuttaDroughts: Record<string, number>;
  suttaDroughts: Record<string, number>;
  saturatedSuttas: string[];
  suttaSignalCounts: Record<SuttaSignalState, number>;
  topPicks: PanelPick[];
  openPicks: PanelPick[];
  closePicks: PanelPick[];
  openDpPicks: PanelPick[];
  closeDpPicks: PanelPick[];
  openKindPrediction: PanelKindPrediction;
  closeKindPrediction: PanelKindPrediction;
  openDpKindContext: DpKindContext;
  closeDpKindContext: DpKindContext;
  totalRecordsAnalysed: number;
  totalDraws: number;
  stats: MarketStats;
}

/**
 * Contextual DP/SP bias computed from proven statistical patterns.
 * dpBias > 1.0 → more DP likely; < 1.0 → more SP likely.
 */
export interface DpKindContext {
  /** Final multiplier applied to DP panel scores before kind prediction. */
  dpBias: number;
  /** Weekday component of the bias. */
  weekdayBias: number;
  /** Human-readable list of active signals and their multipliers. */
  signals: string[];
}

export type PanelKind = "SP" | "DP";

export interface PanelKindPrediction {
  predictedKind: PanelKind;
  confidence: number;
  scores: Record<PanelKind, number>;
  top30Counts: Record<PanelKind, number>;
}

export interface PanelPick {
  panel: string;
  sutta: number;
  kind: PanelKind;
  score: number;
  isHoneyPotPick: boolean;
  isSequential: boolean;
  isTriple: boolean;
  breakdown: {
    recencyScore: number;
    seqPenalty: number;
    luckyPenalty: number;
    triplePenalty: number;
    saturationPenalty: number;
    cooldownPenalty: number;
    dayBoost: number;
    jodiPenalty: number;
  };
}

export interface JodiAnalysis {
  openSutta: number;
  openPanel: string | null;
  calibration: MarketCalibration["jodi"];
  jodiStrength: number;
  jodiFrequencies: Array<{
    jodi: string;
    closeSutta: number;
    count: number;
    percentage: number;
    ratio: number;
    edge: "favored" | "avoid" | "neutral";
  }>;
  favoredCloseSuttas: number[];
  avoidedCloseSuttas: number[];
  blacklistedCloseSuttas: number[];
  safeCloseSuttas: number[];
  closeSuttaPenalties: Record<number, number>;
  adjustedClosePicks: PanelPick[];
  adjustedCloseDpPicks: PanelPick[];
  kindPrediction: PanelKindPrediction;
  totalMatchingDraws: number;
}

export type SuttaSignalState =
  "fresh" | "warming" | "danger" | "cooling" | "snapback" | "unknown";

export interface SuttaSignal {
  state: SuttaSignalState;
  label: string;
  scorePenalty: number;
  color: string;
  description: string;
}

export interface MarketStats {
  totalRecords: number;
  totalDraws: number;
  sequenceCount: number;
  sequenceRate: number;
  tripleCount: number;
  tripleRate: number;
  jodiCount: number;
  topOpenPanels: Array<{ panel: string; count: number }>;
  topClosePanels: Array<{ panel: string; count: number }>;
  topJodis: Array<{ jodi: string; count: number }>;
  suttaDistribution: Record<string, number>;
}

export type CalibrationLevel = "weak" | "fair" | "strong";

export interface ModelCalibration {
  panel30: number;
  sutta30: number;
  level: CalibrationLevel;
  suttaLevel: CalibrationLevel;
  scoreBias: number;
  recencyScale: number;
  suttaPressureScale: number;
  popularPenaltyScale: number;
}

export interface JodiCalibration extends ModelCalibration {
  strength: number;
}

export interface MarketCalibration {
  open: ModelCalibration;
  close: ModelCalibration;
  jodi: JodiCalibration;
}

function levelFromPanel30(panel30: number): CalibrationLevel {
  if (panel30 >= 18) return "strong";
  if (panel30 >= 14.5) return "fair";
  return "weak";
}

function levelFromSutta30(sutta30: number): CalibrationLevel {
  if (sutta30 >= 74) return "strong";
  if (sutta30 >= 68) return "fair";
  return "weak";
}

function makeModelCalibration(
  panel30: number,
  sutta30: number,
  overrides: Partial<
    Pick<
      ModelCalibration,
      | "scoreBias"
      | "recencyScale"
      | "suttaPressureScale"
      | "popularPenaltyScale"
    >
  > = {},
): ModelCalibration {
  return {
    panel30,
    sutta30,
    level: levelFromPanel30(panel30),
    suttaLevel: levelFromSutta30(sutta30),
    scoreBias: overrides.scoreBias ?? 0,
    recencyScale: overrides.recencyScale ?? 1,
    suttaPressureScale: overrides.suttaPressureScale ?? 1,
    popularPenaltyScale: overrides.popularPenaltyScale ?? 1,
  };
}

function makeJodiCalibration(
  panel30: number,
  sutta30: number,
  strength: number,
  overrides: Partial<
    Pick<
      ModelCalibration,
      | "scoreBias"
      | "recencyScale"
      | "suttaPressureScale"
      | "popularPenaltyScale"
    >
  > = {},
): JodiCalibration {
  return {
    ...makeModelCalibration(panel30, sutta30, overrides),
    strength,
  };
}

const DEFAULT_MARKET_CALIBRATION: MarketCalibration = {
  open: makeModelCalibration(14.6, 71.5),
  close: makeModelCalibration(15.0, 72.1),
  jodi: makeJodiCalibration(16.1, 67.1, 0.8),
};

const MARKET_CALIBRATIONS: Record<string, MarketCalibration> = {
  Sridevi: {
    open: makeModelCalibration(12.4, 69.5, {
      recencyScale: 0.96,
      suttaPressureScale: 0.95,
    }),
    close: makeModelCalibration(12.4, 75.7, {
      recencyScale: 0.94,
      suttaPressureScale: 1.08,
    }),
    jodi: makeJodiCalibration(14.1, 70.6, 0.55),
  },
  "Time Bazar": {
    open: makeModelCalibration(16.6, 70.9, { recencyScale: 1.03 }),
    close: makeModelCalibration(16.6, 66.9, {
      recencyScale: 1.04,
      suttaPressureScale: 0.92,
    }),
    jodi: makeJodiCalibration(16.6, 66.2, 0.85),
  },
  "Madhur Day": {
    open: makeModelCalibration(15.3, 75.7, { suttaPressureScale: 1.05 }),
    close: makeModelCalibration(15.8, 75.7, { suttaPressureScale: 1.05 }),
    jodi: makeJodiCalibration(18.1, 67.2, 1.0),
  },
  "Milan Day": {
    open: makeModelCalibration(16.6, 63.6, {
      recencyScale: 1.04,
      suttaPressureScale: 0.86,
    }),
    close: makeModelCalibration(13.9, 69.5, {
      recencyScale: 0.96,
      suttaPressureScale: 0.98,
    }),
    jodi: makeJodiCalibration(14.6, 64.9, 0.7),
  },
  "Rajdhani Day": {
    open: makeModelCalibration(17.2, 72.8, { recencyScale: 1.04 }),
    close: makeModelCalibration(13.2, 70.9, {
      recencyScale: 0.94,
      suttaPressureScale: 1.02,
    }),
    jodi: makeJodiCalibration(11.9, 70.9, 0.35),
  },
  Kalyan: {
    open: makeModelCalibration(12.6, 66.2, {
      recencyScale: 0.96,
      suttaPressureScale: 0.92,
    }),
    close: makeModelCalibration(14.6, 68.9),
    jodi: makeJodiCalibration(14.6, 65.6, 0.65),
  },
  "Sridevi Night": {
    open: makeModelCalibration(17.5, 72.9, { recencyScale: 1.04 }),
    close: makeModelCalibration(15.8, 72.9),
    jodi: makeJodiCalibration(15.8, 61.0, 0.55),
  },
  "Madhur Night": {
    open: makeModelCalibration(9.9, 73.7, {
      recencyScale: 0.9,
      suttaPressureScale: 1.06,
    }),
    close: makeModelCalibration(15.1, 80.9, { suttaPressureScale: 1.12 }),
    jodi: makeJodiCalibration(17.1, 71.7, 1.05),
  },
  "Milan Night": {
    open: makeModelCalibration(10.7, 76.0, {
      recencyScale: 0.9,
      suttaPressureScale: 1.12,
    }),
    close: makeModelCalibration(22.7, 71.3, { recencyScale: 1.1 }),
    jodi: makeJodiCalibration(23.3, 65.3, 1.15),
  },
  "Rajdhani Night": {
    open: makeModelCalibration(17.6, 73.6, { recencyScale: 1.04 }),
    close: makeModelCalibration(15.2, 69.6),
    jodi: makeJodiCalibration(17.6, 69.6, 0.95),
  },
  "Main Bazar": {
    open: makeModelCalibration(15.3, 69.4),
    close: makeModelCalibration(14.5, 69.4),
    jodi: makeJodiCalibration(17.7, 62.9, 0.85),
  },
};

export function getMarketCalibration(marketName: string): MarketCalibration {
  return MARKET_CALIBRATIONS[marketName] ?? DEFAULT_MARKET_CALIBRATION;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isSequential(panel: string): boolean {
  if (panel.length !== 3) return false;
  try {
    const d1 = parseInt(panel[0]);
    const d2 = parseInt(panel[1]);
    const d3 = parseInt(panel[2]);
    if (d2 === d1 + 1 && d3 === d2 + 1) return true;
    if (d2 === d1 - 1 && d3 === d2 - 1) return true;
    if (["890", "901", "012", "789"].includes(panel)) return true;
  } catch {
    // ignore
  }
  return false;
}

export function isTriple(panel: string): boolean {
  return panel.length === 3 && panel[0] === panel[1] && panel[1] === panel[2];
}

export function isDoublePanel(panel: string): boolean {
  return panel.length === 3 && new Set(panel.split("")).size === 2;
}

export function getPanelKind(panel: string): PanelKind {
  const uniqueCount = new Set(panel.split("")).size;
  if (uniqueCount === 2) return "DP";
  return "SP";
}

export function calculateSutta(panel: string): number {
  return (parseInt(panel[0]) + parseInt(panel[1]) + parseInt(panel[2])) % 10;
}

function countLuckyDigits(panel: string): number {
  return panel.split("").filter((d) => ["7", "8", "9"].includes(d)).length;
}

const LUCKY_DIGIT_PENALTY_POINTS = 0;

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
      color: "#fb923c",
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

/** Generate all 220 unique Matka panels */
function generateAllPanels(): string[] {
  const panels: string[] = [];
  const ord = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  for (let i = 0; i < 10; i++) {
    for (let j = i; j < 10; j++) {
      for (let k = j; k < 10; k++) {
        panels.push(`${ord[i]}${ord[j]}${ord[k]}`);
      }
    }
  }
  return panels;
}

const ALL_PANELS = generateAllPanels();
const DOUBLE_PANELS = ALL_PANELS.filter(isDoublePanel);

/** Flatten records into a chronological list of individual panels (both Open & Close) */
interface FlatEntry {
  panel: string;
  sutta: number;
  type: "open" | "close";
  day: string;
  index: number;
}

function flattenRecords(records: PanelRecord[]): FlatEntry[] {
  const entries: FlatEntry[] = [];
  let idx = 0;
  for (const rec of records) {
    if (rec.openPanel) {
      entries.push({
        panel: rec.openPanel,
        sutta: rec.openSutta,
        type: "open",
        day: rec.day,
        index: idx++,
      });
    }
    if (rec.closePanel) {
      entries.push({
        panel: rec.closePanel,
        sutta: rec.closeSutta,
        type: "close",
        day: rec.day,
        index: idx++,
      });
    }
  }
  return entries;
}

// ─── Scoring Context (shared between Open/Close/Jodi) ────────────────────────

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
function computeDpKindContext(
  marketName: string,
  openEntries: FlatEntry[],
  closeEntries: FlatEntry[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  todayDayName: string,
  isClose: boolean,
): DpKindContext {
  const signals: string[] = [];

  // ── 1. Weekday bias ────────────────────────────────────────────────────────
  const weekdayBias = isClose
    ? (WEEKDAY_DP_BIAS_CLOSE[todayDayName] ?? 1.0)
    : (WEEKDAY_DP_BIAS_OPEN[todayDayName] ?? 1.0);
  if (weekdayBias < 0.9)
    signals.push(`${todayDayName} DP suppression (×${weekdayBias})`);
  else if (weekdayBias > 1.05)
    signals.push(`${todayDayName} DP boost (×${weekdayBias})`);

  let dpBias = weekdayBias;

  // ── 2. Prev close sutta=3 blind-spot fix ──────────────────────────────────
  const lastCloseEntry =
    closeEntries.length > 0 ? closeEntries[closeEntries.length - 1] : null;
  if (lastCloseEntry?.sutta === 3) {
    dpBias *= 1.4;
    signals.push("Prev close sutta=3 blind-spot (×1.40)");
  }

  // ── 3. Market-specific DP digit triggers ──────────────────────────────────
  const lastOpenDpEntry = [...openEntries]
    .reverse()
    .find((e) => isDoublePanel(e.panel));
  const lastCloseDpEntry = [...closeEntries]
    .reverse()
    .find((e) => isDoublePanel(e.panel));
  const lastOpenDpDigit = lastOpenDpEntry
    ? getDoublePanelDigit(lastOpenDpEntry.panel)
    : null;
  const lastCloseDpDigit = lastCloseDpEntry
    ? getDoublePanelDigit(lastCloseDpEntry.panel)
    : null;

  if (marketName === "Kalyan" && lastCloseDpDigit === "8") {
    dpBias *= 1.3;
    signals.push("Kalyan prev-close digit-8 trigger (×1.30)");
  } else if (NIGHT_MARKET_NAMES.has(marketName) && lastOpenDpDigit === "3") {
    dpBias *= 1.4;
    signals.push(
      `${marketName} prev-open digit-3 trigger (×1.40, night gold rule)`,
    );
  } else if (marketName === "Milan Day" && lastCloseDpDigit === "1") {
    dpBias *= 1.2;
    signals.push("Milan Day prev-close digit-1 trigger (×1.20)");
  } else if (marketName === "Sridevi Night" && lastOpenDpDigit === "2") {
    dpBias *= 1.2;
    signals.push("Sridevi Night prev-open digit-2 trigger (×1.20)");
  } else if (marketName === "Madhur Day" && lastOpenDpDigit === "8") {
    dpBias *= 1.2;
    signals.push("Madhur Day prev-open digit-8 trigger (×1.20)");
  }

  // ── 4. Double digit echo: open=2 + close=4 → 66.7% DP ────────────────────
  if (lastOpenDpDigit === "2" && lastCloseDpDigit === "4") {
    dpBias *= 1.3;
    signals.push("Double digit echo open=2, close=4 (×1.30)");
  }

  // ── 5. Source market digit triggers (liquidity chain) ─────────────────────
  const sourceMarket = LIQUIDITY_FLOW_MAP[marketName];
  if (sourceMarket) {
    const sourceRecs = allMarketsRecords[sourceMarket];
    if (sourceRecs && sourceRecs.length > 0) {
      const lastSrc = sourceRecs[sourceRecs.length - 1];
      const srcOpenDpDigit =
        lastSrc.openPanel && isDoublePanel(lastSrc.openPanel)
          ? getDoublePanelDigit(lastSrc.openPanel)
          : null;
      const srcCloseDpDigit =
        lastSrc.closePanel && isDoublePanel(lastSrc.closePanel)
          ? getDoublePanelDigit(lastSrc.closePanel)
          : null;

      // Time Bazar: Sridevi prev-open dpDigit=6 → 57.1% (21 support)
      if (marketName === "Time Bazar" && srcOpenDpDigit === "6") {
        dpBias *= 1.25;
        signals.push("Time Bazar: Sridevi prev-open digit-6 (×1.25)");
      }
      // Night markets: source prev-open dpDigit=3 fires alongside same-market trigger
      if (NIGHT_MARKET_NAMES.has(marketName) && srcOpenDpDigit === "3") {
        dpBias *= 1.2;
        signals.push(`Source prev-open digit-3 (night boost ×1.20)`);
      }
      // Madhur Night: Sridevi Night prev-open dpDigit=1 → 53.3% (30 support)
      if (marketName === "Madhur Night" && srcOpenDpDigit === "1") {
        dpBias *= 1.15;
        signals.push("Madhur Night: Sridevi Night prev-open digit-1 (×1.15)");
      }
      // General: source prev-close digit 0 or 5 has moderate DP cascade effect
      if (srcCloseDpDigit === "0" || srcCloseDpDigit === "5") {
        dpBias *= 1.08;
        signals.push(
          `Source prev-close digit-${srcCloseDpDigit} cascade (×1.08)`,
        );
      }
    }
  }

  // ── 6. Night→Day DP count signal ──────────────────────────────────────────
  // nightToDay.openDpCount=1 → 65.2% DP for day markets (23 support, strong)
  if (!NIGHT_MARKET_NAMES.has(marketName)) {
    let prevNightOpenDpCount = 0;
    for (const nm of NIGHT_MARKET_NAMES) {
      const nmRecs = allMarketsRecords[nm];
      if (!nmRecs || nmRecs.length === 0) continue;
      const lastNm = nmRecs[nmRecs.length - 1];
      if (lastNm.openPanel && isDoublePanel(lastNm.openPanel))
        prevNightOpenDpCount++;
    }
    if (prevNightOpenDpCount === 1) {
      dpBias *= 1.28;
      signals.push(
        "Night→Day: prev night 1 open DP — key warm-up signal (×1.28)",
      );
    } else if (prevNightOpenDpCount === 0) {
      dpBias *= 0.9;
      signals.push(
        "Night→Day: prev night 0 open DPs — dry-night signal (×0.90)",
      );
    }
  }

  // ── 7. 2-year structural shift compensation ────────────────────────────────
  // Day DP rates are UP ~4.5% in last 2 years; night close DOWN ~4.6%.
  if (!NIGHT_MARKET_NAMES.has(marketName)) {
    dpBias *= 1.04;
    signals.push("2yr structural: day DP up (×1.04)");
  } else if (isClose) {
    dpBias *= 0.96;
    signals.push("2yr structural: night close DP down (×0.96)");
  }

  dpBias = Math.max(0.4, Math.min(2.0, dpBias));

  return { dpBias, weekdayBias, signals };
}

/**
 * Build a SP/DP kind prediction from a sorted panel pick list.
 *
 * When dpBias = 1.0 (no signal), uses the raw top-30 to compute a
 * weighted SP vs DP score.  SP naturally dominates because there are more
 * SP panels and they tend to score higher (correct default behaviour).
 *
 * When dpBias > 1.0 (DP signals have fired), we re-rank the full pick
 * list by giving every DP panel an effectiveScore = score * dpBias and
 * count how many DPs land in the re-ranked top 30.  If that count
 * exceeds the structural DP proportion (~12 out of 30, i.e. 90/220*30)
 * we predict DP.  A dpBias of ~1.35-1.40 is the natural inflection
 * point where strong signals (digit-3 night rule at 70% DP, sutta=3
 * blind-spot at 68% DP, Kalyan digit-8 at 60% DP) cross the threshold.
 *
 * When dpBias < 1.0 (suppression signals), we lower the DP panels
 * further so SP is even more favoured (Sunday, dry-night, etc.).
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

export function computeStats(records: PanelRecord[]): MarketStats {
  const openCounts: Record<string, number> = {};
  const closeCounts: Record<string, number> = {};
  const jodiCounts: Record<string, number> = {};
  const suttaDistribution: Record<string, number> = {};
  let sequenceCount = 0;
  let tripleCount = 0;
  let jodiTotal = 0;

  for (const rec of records) {
    if (rec.openPanel) {
      openCounts[rec.openPanel] = (openCounts[rec.openPanel] ?? 0) + 1;
      const s = String(rec.openSutta);
      suttaDistribution[s] = (suttaDistribution[s] ?? 0) + 1;
      if (isSequential(rec.openPanel)) sequenceCount++;
      if (isTriple(rec.openPanel)) tripleCount++;
    }
    if (rec.closePanel) {
      closeCounts[rec.closePanel] = (closeCounts[rec.closePanel] ?? 0) + 1;
      const s = String(rec.closeSutta);
      suttaDistribution[s] = (suttaDistribution[s] ?? 0) + 1;
      if (isSequential(rec.closePanel)) sequenceCount++;
      if (isTriple(rec.closePanel)) tripleCount++;
    }
    if (rec.jodi) {
      jodiCounts[rec.jodi] = (jodiCounts[rec.jodi] ?? 0) + 1;
      jodiTotal++;
    }
  }

  const totalPanels =
    Object.values(openCounts).reduce((a, b) => a + b, 0) +
    Object.values(closeCounts).reduce((a, b) => a + b, 0);

  const topOpen = Object.entries(openCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([panel, count]) => ({ panel, count }));
  const topClose = Object.entries(closeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([panel, count]) => ({ panel, count }));
  const topJodis = Object.entries(jodiCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([jodi, count]) => ({ jodi, count }));

  return {
    totalRecords: totalPanels,
    totalDraws: records.length,
    sequenceCount,
    sequenceRate: totalPanels > 0 ? (sequenceCount / totalPanels) * 100 : 0,
    tripleCount,
    tripleRate: totalPanels > 0 ? (tripleCount / totalPanels) * 100 : 0,
    jodiCount: jodiTotal,
    topOpenPanels: topOpen,
    topClosePanels: topClose,
    topJodis,
    suttaDistribution,
  };
}

/**
 * Full Game-Theory prediction run for a single market.
 * Returns separate Open and Close picks.
 */
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

// ─── Jodi Dependency Model ──────────────────────────────────────────────────

/**
 * Real-time Close prediction based on known Open result.
 *
 * After the Open draw (e.g., 3:45 PM for Kalyan), the Open Sutta is known.
 * The close model can use empirical Open-to-Close follow-through after
 * today's Open Sutta is known.
 *
 * This function:
 * 1. Finds historical Jodi distribution for the given Open Sutta
 * 2. Identifies favored and weak Close Suttas for that Open Sutta
 * 3. Scales the adjustment by market-level Jodi reliability
 * 4. Re-scores Close panels with Jodi-aware adjustments
 */
export function computeJodiAnalysis(
  openSutta: number,
  openPanel: string | null,
  records: PanelRecord[],
  ctx: ScoringContext,
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
    adjustedCloseDpPicks: adjustedPicks
      .filter((pick) => isDoublePanel(pick.panel))
      .slice(0, 30),
    kindPrediction: buildKindPrediction(adjustedPicks),
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
