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
  estimatedDpRate: number;
  dpBias: number;
  dpSignals: string[];
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
  adjustedCloseDpDigitFocus: DpDigitFocus | null;
  kindPrediction: PanelKindPrediction;
  totalMatchingDraws: number;
}

export interface DpDigitFocus {
  digits: [string, string];
  pairKey: string;
  score: number;
  confidence: number;
  depth: number;
  supportPanels: string[];
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

