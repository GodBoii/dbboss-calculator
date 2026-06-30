export const HIGH_VOLUME_MARKETS = [
  "Sridevi",
  "Time Bazar",
  "Madhur Day",
  "Milan Day",
  "Rajdhani Day",
  "Kalyan",
  "Sridevi Night",
  "Kalyan Night",
  "Madhur Night",
  "Milan Night",
  "Rajdhani Night",
  "Main Bazar",
];

// Night markets set — used for weekday and cross-session DP signals
const NIGHT_MARKET_NAMES = new Set([
  "Sridevi Night",
  "Kalyan Night",
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
  "Kalyan Night": "Kalyan",
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
  "Kalyan Night",
  "Madhur Night",
  "Rajdhani Night",
]);


export {
  NIGHT_MARKET_NAMES,
  WEEKDAY_DP_BIAS_OPEN,
  WEEKDAY_DP_BIAS_CLOSE,
  LIQUIDITY_FLOW_MAP,
  VOL_MULTIPLIER,
  HIGH_VOL_SET,
  MEDIUM_VOL_SET,
};

