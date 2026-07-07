import type { PanelRecord } from "../db";
import { getRecordISODate } from "../db";
import type { DpKindContext, PanelKind, PanelKindPrediction } from "./types";
import { getDoublePanelDigit, getPanelKind, isDoublePanel } from "./panel-utils";

type Side = "open" | "close";
type ConflictMode = "baseline" | "SP" | "DP";

interface PrecisionModelConfig {
  threshold: number;
  conflict: ConflictMode;
  dpRules: string[][];
  spRules: string[][];
}

const MARKET_SEQUENCE = [
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

const PRECISION_MODELS: Record<string, PrecisionModelConfig> = {
  "Rajdhani Day|close": {
    threshold: 2,
    conflict: "baseline",
    dpRules: [["sameDate.Milan Day.open.last=8", "sameWeek1.prev.middle=6"]],
    spRules: [
      ["prevDate.nightDpCount=6"],
      ["sameDate.openKnown.firstLast=18"],
      ["prevDate.any.Main Bazar.close.dpDigit=9"],
      ["sameDate.Time Bazar.close.middle=1"],
      ["sameDate.Time Bazar.close.dpDigit=1"],
      ["sameDate.Time Bazar.close.middle=1", "sameDate.Time Bazar.close.dpDigit=1"],
      ["sameDate.Time Bazar.close.firstLast=47"],
      ["sameWeek1.prev.first=4", "sameWeek1.prev.sutta=9"],
      ["sameDate.Time Bazar.close.firstLast=47", "sameDate.Time Bazar.close.last=7"],
      ["sameDate.Time Bazar.close.dpDigit=4"],
      ["prevDate.any.Rajdhani Night.open.dpDigit=9"],
      ["prevDate.any.Sridevi.close.dpDigit=5"],
    ],
  },
  "Kalyan|close": {
    threshold: 1.7,
    conflict: "baseline",
    dpRules: [],
    spRules: [],
  },
  "Milan Night|open": {
    threshold: 1.7,
    conflict: "baseline",
    dpRules: [
      ["sameDate.Madhur Night.close.firstLast=39"],
      ["prevDate.any.Madhur Day.open.dpDigit=5"],
      ["sameDate.Kalyan Night.close.middle=2"],
    ],
    spRules: [
      ["sameDate.Kalyan.close.first=4", "prevDay.close.oddEven=OOE"],
      ["sameDate.Kalyan.close.middle=8", "sameWeek2.prev.lowHigh=LLH"],
      ["sameDate.Sridevi Night.close.firstLast=30", "sameDate.Sridevi Night.close.lowHigh=LHL"],
      ["sameWeek2.prev.firstLast=15"],
      ["sameDate.Madhur Night.open.firstLast=20", "sameDate.Madhur Night.open.oddEven=EOE"],
      ["sameDate.Rajdhani Day.open.middle=6"],
      ["sameDate.Madhur Night.close.oddEven=EEE", "prevDay.close.oddEven=OOE"],
      ["prevDate.any.Rajdhani Night.open.dpDigit=9"],
      ["prevDate.any.Main Bazar.close.sutta=0"],
      ["prevDate.any.Sridevi.close.dpDigit=5"],
      ["prevDate.any.Time Bazar.close.dpDigit=4"],
      ["prevDate.any.Sridevi Night.open.sutta=7"],
    ],
  },
  "Rajdhani Night|close": {
    threshold: 1.35,
    conflict: "SP",
    dpRules: [
      ["sameDate.Kalyan Night.open.sutta=4", "sameDate.Madhur Night.open.kind=DP"],
      ["sameWeek2.prev.oddEven=EEO"],
    ],
    spRules: [
      ["sameDate.Kalyan Night.open.sumBand=high", "sameWeek1.prev.sumBand=high"],
      ["sameWeek2.prev.firstLast=20"],
      ["model.signal=Operator: Regime TRAP: recent close-chase risk, OGI 40/100 (x0.94)", "sameSide.last5Dp=3"],
      ["sameDate.Kalyan Night.open.sutta=3", "sameWeek1.prev.sumBand=high"],
      ["sameDatePrevMonth.prev.sutta=5"],
      ["sameDate.Milan Night.close.sutta=2"],
      ["sameDate.Sridevi Night.open.oddEven=OEO", "sameDate.Sridevi Night.open.first=1"],
      ["sameDate.Kalyan Night.close.sutta=6"],
      ["sameDate.Madhur Night.close.oddEven=EEE"],
      ["sameDate.Kalyan Night.open.lowHigh=HHH", "sameDate.Kalyan Night.open.first=6"],
      ["sameDate.Kalyan Night.open.sumBand=high", "sameDate.Kalyan Night.open.first=6"],
      ["sameDate.Kalyan Night.open.sutta=1"],
    ],
  },
  "Main Bazar|open": {
    threshold: 1.85,
    conflict: "baseline",
    dpRules: [["sameDate.Milan Night.close.first=3", "sameDate.Kalyan Night.close.last=8"]],
    spRules: [
      ["sameDate.Milan Night.close.firstLast=27"],
      ["prevDay.close.oddEven=OEE", "sameDate.Rajdhani Night.close.middle=5"],
      ["sameDate.Rajdhani Night.close.middle=5", "sameWeek2.prev.last=9"],
      ["sameDate.Kalyan Night.close.last=5", "sameDate.Kalyan Night.close.lowHigh=LLH"],
      ["sameDate.Kalyan Night.close.last=5"],
      ["sameWeek1.prev.firstLast=20"],
      ["sameDate.Kalyan Night.close.middle=4", "sameDate.Kalyan Night.close.lowHigh=LLH"],
      ["sameDatePrevMonth.prev.sutta=6"],
    ],
  },
};

function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function previousDateISO(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function panelFor(record: PanelRecord, side: Side): string {
  return side === "open" ? record.openPanel : record.closePanel;
}

function eventFromRecord(record: PanelRecord, side: Side) {
  const panel = panelFor(record, side);
  if (!panel || panel.length !== 3) return null;
  const sum = panel.split("").reduce((total, digit) => total + Number(digit), 0);
  return {
    panel,
    kind: getPanelKind(panel),
    sutta: sum % 10,
    first: panel[0],
    middle: panel[1],
    last: panel[2],
    firstLast: `${panel[0]}${panel[2]}`,
    sumBand: sum <= 10 ? "low" : sum <= 17 ? "mid" : "high",
    lowHigh: panel.split("").map((digit) => Number(digit) <= 4 ? "L" : "H").join(""),
    oddEven: panel.split("").map((digit) => Number(digit) % 2 ? "O" : "E").join(""),
    dpDigit: isDoublePanel(panel) ? getDoublePanelDigit(panel) : null,
  };
}

function addPanelFeatures(features: Set<string>, prefix: string, record: PanelRecord | null, side: Side): void {
  if (!record) return;
  const event = eventFromRecord(record, side);
  if (!event) return;
  features.add(`${prefix}.kind=${event.kind}`);
  features.add(`${prefix}.sutta=${event.sutta}`);
  features.add(`${prefix}.first=${event.first}`);
  features.add(`${prefix}.middle=${event.middle}`);
  features.add(`${prefix}.last=${event.last}`);
  features.add(`${prefix}.firstLast=${event.firstLast}`);
  features.add(`${prefix}.sumBand=${event.sumBand}`);
  features.add(`${prefix}.lowHigh=${event.lowHigh}`);
  features.add(`${prefix}.oddEven=${event.oddEven}`);
  if (event.dpDigit !== null) features.add(`${prefix}.dpDigit=${event.dpDigit}`);
}

function dated(records: PanelRecord[]) {
  return records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item): item is { record: PanelRecord; isoDate: string } => Boolean(item.isoDate))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

function latestRecordOnDate(records: PanelRecord[] | undefined, isoDate: string): PanelRecord | null {
  if (!records) return null;
  for (let i = records.length - 1; i >= 0; i--) {
    if (getRecordISODate(records[i]) === isoDate) return records[i];
  }
  return null;
}

function buildPrecisionFeatures(
  marketName: string,
  side: Side,
  records: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  analysisDate: Date,
  dpContext: DpKindContext,
): Set<string> {
  const targetISO = toLocalISODate(analysisDate);
  const features = new Set<string>();
  const marketRows = dated(records).filter((item) => item.isoDate < targetISO);
  const sameSideRows = marketRows.filter((item) => panelFor(item.record, side));
  const previousRecord = marketRows[marketRows.length - 1]?.record ?? null;
  const previousDate = previousDateISO(targetISO);

  addPanelFeatures(features, "prevDay.open", previousRecord, "open");
  addPanelFeatures(features, "prevDay.close", previousRecord, "close");

  const sameWeek = sameSideRows.filter((item) => item.record.day === [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][analysisDate.getDay()]).reverse();
  addPanelFeatures(features, "sameWeek1.prev", sameWeek[0]?.record ?? null, side);
  addPanelFeatures(features, "sameWeek2.prev", sameWeek[1]?.record ?? null, side);

  const sameDatePrevMonth = [...sameSideRows]
    .reverse()
    .find((item) => item.isoDate.slice(8, 10) === targetISO.slice(8, 10));
  addPanelFeatures(features, "sameDatePrevMonth.prev", sameDatePrevMonth?.record ?? null, side);

  const recentSameSide = sameSideRows.slice(-5);
  features.add(`sameSide.last5Dp=${recentSameSide.filter((item) => isDoublePanel(panelFor(item.record, side))).length}`);

  const previousNightDpCount = MARKET_SEQUENCE
    .filter((name) => name.includes("Night") || name === "Main Bazar")
    .flatMap((name) => {
      const record = latestRecordOnDate(allMarketsRecords[name], previousDate);
      return record ? [record.openPanel, record.closePanel] : [];
    })
    .filter((panel) => panel && isDoublePanel(panel)).length;
  features.add(`prevDate.nightDpCount=${Math.min(previousNightDpCount, 6)}`);

  for (const name of MARKET_SEQUENCE) {
    const sameDateRecord = latestRecordOnDate(allMarketsRecords[name], targetISO);
    addPanelFeatures(features, `sameDate.${name}.open`, sameDateRecord, "open");
    addPanelFeatures(features, `sameDate.${name}.close`, sameDateRecord, "close");

    const prevDateRecord = latestRecordOnDate(allMarketsRecords[name], previousDate);
    for (const prevSide of ["open", "close"] as const) {
      const event = prevDateRecord ? eventFromRecord(prevDateRecord, prevSide) : null;
      if (event?.dpDigit !== null && event?.dpDigit !== undefined) {
        features.add(`prevDate.any.${name}.${prevSide}.dpDigit=${event.dpDigit}`);
      }
      if (event) features.add(`prevDate.any.${name}.${prevSide}.sutta=${event.sutta}`);
    }
  }

  if (side === "close") {
    const sameDateTarget = latestRecordOnDate(allMarketsRecords[marketName] ?? records, targetISO);
    addPanelFeatures(features, "sameDate.openKnown", sameDateTarget, "open");
  }

  for (const signal of dpContext.signals) {
    features.add(`model.signal=${signal.replace(/\|/g, "/")}`);
  }

  return features;
}

function rulesFire(features: Set<string>, rules: string[][]): boolean {
  return rules.some((parts) => parts.every((part) => features.has(part)));
}

function predictionConfidence(predictedKind: PanelKind, dpBias: number): { confidence: number; estimatedDpRate: number } {
  const estimatedDpRate = Math.max(5, Math.min(70, Math.round(24.4 * dpBias * 10) / 10));
  return {
    estimatedDpRate,
    confidence: predictedKind === "DP" ? estimatedDpRate : Math.round((100 - estimatedDpRate) * 10) / 10,
  };
}

function applyPrecisionKindOverride({
  marketName,
  side,
  records,
  allMarketsRecords,
  analysisDate,
  basePrediction,
  dpContext,
}: {
  marketName: string;
  side: Side;
  records: PanelRecord[];
  allMarketsRecords: Record<string, PanelRecord[]>;
  analysisDate: Date;
  basePrediction: PanelKindPrediction;
  dpContext: DpKindContext;
}): PanelKindPrediction {
  const config = PRECISION_MODELS[`${marketName}|${side}`];
  if (!config) return basePrediction;

  const features = buildPrecisionFeatures(marketName, side, records, allMarketsRecords, analysisDate, dpContext);
  const dpFires = rulesFire(features, config.dpRules);
  const spFires = rulesFire(features, config.spRules);

  let predictedKind: PanelKind;
  if (dpFires && !spFires) predictedKind = "DP";
  else if (spFires && !dpFires) predictedKind = "SP";
  else if (dpFires && spFires) {
    predictedKind = config.conflict === "baseline" ? basePrediction.predictedKind : config.conflict;
  } else {
    predictedKind = dpContext.dpBias >= config.threshold ? "DP" : "SP";
  }

  const { confidence, estimatedDpRate } = predictionConfidence(predictedKind, dpContext.dpBias);
  return {
    ...basePrediction,
    predictedKind,
    confidence,
    estimatedDpRate,
    dpSignals: [
      ...basePrediction.dpSignals,
      `Precision model: ${marketName} ${side}, threshold ${config.threshold}`,
    ],
  };
}

export { applyPrecisionKindOverride };
