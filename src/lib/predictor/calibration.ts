import type {
  CalibrationLevel,
  JodiCalibration,
  MarketCalibration,
  ModelCalibration,
} from "./types";

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
  open: makeModelCalibration(15.4, 94.9),
  close: makeModelCalibration(15.0, 72.1),
  jodi: makeJodiCalibration(16.1, 67.1, 0.8),
};

const MARKET_CALIBRATIONS: Record<string, MarketCalibration> = {
  Sridevi: {
    open: makeModelCalibration(13.2, 89.0, {
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
    open: makeModelCalibration(17.9, 98.7, { recencyScale: 1.03 }),
    close: makeModelCalibration(16.6, 66.9, {
      recencyScale: 1.04,
      suttaPressureScale: 0.92,
    }),
    jodi: makeJodiCalibration(16.6, 66.2, 0.85),
  },
  "Madhur Day": {
    open: makeModelCalibration(13.2, 95.6, { suttaPressureScale: 1.05 }),
    close: makeModelCalibration(15.8, 75.7, { suttaPressureScale: 1.05 }),
    jodi: makeJodiCalibration(18.1, 67.2, 1.0),
  },
  "Milan Day": {
    open: makeModelCalibration(20.5, 96.2, {
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
    open: makeModelCalibration(16.7, 96.2, { recencyScale: 1.04 }),
    close: makeModelCalibration(13.2, 70.9, {
      recencyScale: 0.94,
      suttaPressureScale: 1.02,
    }),
    jodi: makeJodiCalibration(11.9, 70.9, 0.35),
  },
  Kalyan: {
    open: makeModelCalibration(24.4, 93.6, {
      recencyScale: 0.96,
      suttaPressureScale: 0.92,
    }),
    close: makeModelCalibration(14.6, 68.9),
    jodi: makeJodiCalibration(14.6, 65.6, 0.65),
  },
  "Sridevi Night": {
    open: makeModelCalibration(14.3, 94.5, { recencyScale: 1.04 }),
    close: makeModelCalibration(15.8, 72.9),
    jodi: makeJodiCalibration(15.8, 61.0, 0.55),
  },
  "Madhur Night": {
    open: makeModelCalibration(21.8, 98.7, {
      recencyScale: 0.9,
      suttaPressureScale: 1.06,
    }),
    close: makeModelCalibration(15.1, 80.9, { suttaPressureScale: 1.12 }),
    jodi: makeJodiCalibration(17.1, 71.7, 1.05),
  },
  "Milan Night": {
    open: makeModelCalibration(3.8, 93.6, {
      recencyScale: 0.9,
      suttaPressureScale: 1.12,
    }),
    close: makeModelCalibration(22.7, 71.3, { recencyScale: 1.1 }),
    jodi: makeJodiCalibration(23.3, 65.3, 1.15),
  },
  "Rajdhani Night": {
    open: makeModelCalibration(12.3, 96.9, { recencyScale: 1.04 }),
    close: makeModelCalibration(15.2, 69.6),
    jodi: makeJodiCalibration(17.6, 69.6, 0.95),
  },
  "Main Bazar": {
    open: makeModelCalibration(10.9, 92.2),
    close: makeModelCalibration(14.5, 69.4),
    jodi: makeJodiCalibration(17.7, 62.9, 0.85),
  },
};

export function getMarketCalibration(marketName: string): MarketCalibration {
  return MARKET_CALIBRATIONS[marketName] ?? DEFAULT_MARKET_CALIBRATION;
}


