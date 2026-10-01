import { getRecordISODate, type PanelRecord } from "../db";
import { ALL_PANELS, isSequential } from "./panel-utils";
import type { PanelPick } from "./types";

/**
 * Top-10 exact-panel ranker (research/panel_top10_v1).
 *
 * A conditional-logit model over all 220 panels. Every feature is computed from
 * the selected market's own complete draws (the same 28-month window the app
 * stores), so the ranking does not depend on which other markets are cached.
 *
 * - Open: always used.
 * - Close: used only once today's Open panel is known ("close_live"). The
 *   pre-Open Close variant did not beat production in walk-forward testing, so
 *   callers keep the existing Close ranking until Open is declared.
 *
 * Weights are fit on targets dated <= 2026-07-02. Features are standardised
 * with the stored mean/std, mirroring research/panel_top10_v1/research2.py.
 */

export const TOP10_MODEL_VERSION = "panel-top10-v1";

type FeatureName =
  | "dp" | "tp" | "seq" | "kind_share"
  | "cnt" | "cnt120" | "cnt_other" | "gap" | "gap3" | "gap10"
  | "digit" | "pair" | "sum_share"
  | "sutta" | "sutta_gap" | "wd_sutta" | "wd_cnt"
  | "prev_same_ov" | "prev_other_ov" | "prev_same_cut" | "prev_other_cut" | "cond_sutta";

interface LinearModel {
  features: FeatureName[];
  weights: number[];
  mean: number[];
  std: number[];
}

const FEATURES: FeatureName[] = [
  "dp", "tp", "seq", "kind_share",
  "cnt", "cnt120", "cnt_other", "gap", "gap3", "gap10",
  "digit", "pair", "sum_share",
  "sutta", "sutta_gap", "wd_sutta", "wd_cnt",
  "prev_same_ov", "prev_other_ov", "prev_same_cut", "prev_other_cut", "cond_sutta",
];

const OPEN_MODEL: LinearModel = {
  features: FEATURES,
  weights: [
    -0.136562, -0.326024, 0.001425, 0.388507, 0.026206, -0.002723, 0.065321, 0.003587,
    -0.010596, -0.01726, 0.014865, 0.040617, 0.015131, 0.005421, -0.063361, -0.025462,
    -0.009768, -0.002162, 0.003713, 0.010001, 0.007442, -0.003556,
  ],
  mean: [
    0.409091, 0.045455, 0.036364, -0.993652, 1.178962, 0.333073, 1.178366, 4.871007,
    0.018052, 0.048808, -6.917703, -12.223618, -3.127477, -2.311598, 1.892286, -2.340586,
    0.294925, 0.684367, 0.689367, 0.684367, 0.689367, -0.033569,
  ],
  std: [
    0.491667, 0.2083, 0.187194, 1.197887, 0.653783, 0.428093, 0.653633, 1.268138,
    0.133142, 0.215467, 0.154506, 0.785015, 0.738953, 0.136814, 1.018346, 0.284604,
    0.411661, 0.664177, 0.665545, 0.664177, 0.665545, 0.28626,
  ],
};

const CLOSE_LIVE_MODEL: LinearModel = {
  features: FEATURES,
  weights: [
    -0.14149, -0.142758, -0.011996, 0.55383, 0.020771, -0.030794, 0.020001, -0.004645,
    -0.020175, -0.022524, 0.010007, 0.055423, 0.022094, 0.001259, 0.01787, -0.011012,
    -0.009439, 0.0028, -0.026189, -0.001023, -0.003875, 0.020138,
  ],
  mean: [
    0.409091, 0.045455, 0.036364, -1.001381, 1.178366, 0.333473, 1.178962, 4.870113,
    0.018074, 0.048925, -6.917647, -12.231627, -3.125678, -2.310009, 1.856074, -2.343403,
    0.29482, 0.689367, 0.684367, 0.689367, 0.684367, -0.038442,
  ],
  std: [
    0.491667, 0.2083, 0.187194, 1.203391, 0.653633, 0.427384, 0.653783, 1.270043,
    0.13322, 0.215713, 0.153752, 0.79949, 0.740597, 0.123436, 0.993675, 0.298339,
    0.41206, 0.665545, 0.664177, 0.665545, 0.664177, 0.305539,
  ],
};

const PANEL_COUNT = ALL_PANELS.length;
const PANEL_INDEX = new Map(ALL_PANELS.map((panel, index) => [panel, index]));

interface PanelGeometry {
  digits: number[];
  sorted: number[];
  digitSet: number[];
  cutSet: number[];
  kind: 0 | 1 | 2; // 0 SP, 1 DP, 2 TP
  sutta: number;
  sum: number;
  seq: boolean;
}

const GEOMETRY: PanelGeometry[] = ALL_PANELS.map((panel) => {
  const digits = panel.split("").map(Number);
  const unique = [...new Set(digits)];
  return {
    digits,
    sorted: [...digits].sort((a, b) => a - b),
    digitSet: unique,
    cutSet: unique.map((digit) => (digit + 5) % 10),
    kind: unique.length === 3 ? 0 : unique.length === 2 ? 1 : 2,
    sutta: (digits[0] + digits[1] + digits[2]) % 10,
    sum: digits[0] + digits[1] + digits[2],
    seq: isSequential(panel),
  };
});

function overlap(set: number[], other: number[]): number {
  let count = 0;
  for (const digit of set) if (other.includes(digit)) count++;
  return count;
}

interface Draw {
  open: number;
  close: number;
  day: string;
}

/** Complete, legal draws in chronological order. */
function completeDraws(records: PanelRecord[]): Draw[] {
  return records
    .map((record, order) => ({ record, order, iso: getRecordISODate(record) ?? "" }))
    .filter(({ record }) => PANEL_INDEX.has(record.openPanel) && PANEL_INDEX.has(record.closePanel))
    .sort((a, b) => a.iso.localeCompare(b.iso) || a.order - b.order)
    .map(({ record }) => ({
      open: PANEL_INDEX.get(record.openPanel)!,
      close: PANEL_INDEX.get(record.closePanel)!,
      day: record.day,
    }));
}

/**
 * Today's Open panel when the latest record has a declared Open and no Close
 * yet (the chart publishes Open hours before Close).
 */
export function findDeclaredOpenPanel(records: PanelRecord[]): string | null {
  const dated = records
    .map((record, order) => ({ record, order, iso: getRecordISODate(record) ?? "" }))
    .sort((a, b) => a.iso.localeCompare(b.iso) || a.order - b.order);
  const latest = dated.at(-1);
  if (!latest) return null;
  const { record } = latest;
  if (PANEL_INDEX.has(record.openPanel) && !PANEL_INDEX.has(record.closePanel)) {
    return record.openPanel;
  }
  return null;
}

function bincount(values: number[], size: number): Float64Array {
  const counts = new Float64Array(size);
  for (const value of values) counts[value]++;
  return counts;
}

function lastSeenGap(values: number[], size: number): Float64Array {
  const n = values.length;
  const gaps = new Float64Array(size).fill(n + 1);
  for (let i = 0; i < n; i++) gaps[values[i]] = n - 1 - i;
  return gaps;
}

/**
 * Score all 220 panels. Returns panel strings ordered best-first, or null when
 * history is too short (< 50 complete draws) for the model.
 */
export function rankPanelsTop10Model(
  records: PanelRecord[],
  side: "open" | "close",
  dayName: string,
  todayOpenPanel: string | null = null,
): string[] | null {
  const draws = completeDraws(records);
  const n = draws.length;
  if (n < 50) return null;
  if (side === "close" && (!todayOpenPanel || !PANEL_INDEX.has(todayOpenPanel))) return null;

  const model = side === "open" ? OPEN_MODEL : CLOSE_LIVE_MODEL;
  const own = draws.map((draw) => (side === "open" ? draw.open : draw.close));
  const other = draws.map((draw) => (side === "open" ? draw.close : draw.open));

  const cnt = bincount(own, PANEL_COUNT);
  const cnt120 = bincount(own.slice(-120), PANEL_COUNT);
  const cntOther = bincount(other, PANEL_COUNT);
  const gap = lastSeenGap(own, PANEL_COUNT);

  const kinds = bincount(own.map((p) => GEOMETRY[p].kind), 3);
  const digitCounts = new Float64Array(10);
  const pairCounts = new Float64Array(100);
  const sumCounts = new Float64Array(28);
  for (const p of own) {
    const g = GEOMETRY[p];
    for (const digit of g.digits) digitCounts[digit]++;
    const [a, b, c] = g.sorted;
    pairCounts[a * 10 + b]++;
    pairCounts[a * 10 + c]++;
    pairCounts[b * 10 + c]++;
    sumCounts[g.sum]++;
  }
  const ownSuttas = own.map((p) => GEOMETRY[p].sutta);
  const suttaCounts = bincount(ownSuttas, 10);
  const suttaGap = lastSeenGap(ownSuttas, 10);

  const weekdaySuttas: number[] = [];
  const weekdayPanels: number[] = [];
  draws.forEach((draw, index) => {
    if (draw.day !== dayName) return;
    weekdaySuttas.push(ownSuttas[index]);
    weekdayPanels.push(own[index]);
  });
  const wdSuttaCounts = bincount(weekdaySuttas, 10);
  const wdCounts = bincount(weekdayPanels, PANEL_COUNT);

  const prevSame = GEOMETRY[own[n - 1]];
  let prevOther: PanelGeometry;
  const condCounts = new Float64Array(10);
  if (side === "open") {
    // Previous Close -> next Open sutta transition.
    prevOther = GEOMETRY[draws[n - 1].close];
    const now = prevOther.sutta;
    for (let i = 0; i < n - 1; i++) {
      if (GEOMETRY[draws[i].close].sutta === now) condCounts[GEOMETRY[draws[i + 1].open].sutta]++;
    }
  } else {
    // Same-day Open sutta -> Close sutta (the Jodi relationship).
    prevOther = GEOMETRY[PANEL_INDEX.get(todayOpenPanel!)!];
    const now = prevOther.sutta;
    for (const draw of draws) {
      if (GEOMETRY[draw.open].sutta === now) condCounts[GEOMETRY[draw.close].sutta]++;
    }
  }
  const condTotal = condCounts.reduce((sum, value) => sum + value, 0);
  const wdTotal = wdSuttaCounts.reduce((sum, value) => sum + value, 0);

  const scored = ALL_PANELS.map((panel, index) => {
    const g = GEOMETRY[index];
    const [a, b, c] = g.sorted;
    const suttaShare = Math.log((suttaCounts[g.sutta] + 1) / (n + 10));
    const values: Record<FeatureName, number> = {
      dp: g.kind === 1 ? 1 : 0,
      tp: g.kind === 2 ? 1 : 0,
      seq: g.seq ? 1 : 0,
      kind_share: Math.log((kinds[g.kind] + 1) / (n + 3)),
      cnt: Math.log1p(cnt[index]),
      cnt120: Math.log1p(cnt120[index]),
      cnt_other: Math.log1p(cntOther[index]),
      gap: Math.log1p(gap[index]),
      gap3: gap[index] <= 3 ? 1 : 0,
      gap10: gap[index] <= 10 ? 1 : 0,
      digit: g.digits.reduce((sum, digit) => sum + Math.log((digitCounts[digit] + 1) / (3 * n + 10)), 0),
      pair:
        Math.log((pairCounts[a * 10 + b] + 0.5) / (3 * n + 27.5)) +
        Math.log((pairCounts[a * 10 + c] + 0.5) / (3 * n + 27.5)) +
        Math.log((pairCounts[b * 10 + c] + 0.5) / (3 * n + 27.5)),
      sum_share: Math.log((sumCounts[g.sum] + 1) / (n + 28)),
      sutta: suttaShare,
      sutta_gap: Math.log1p(suttaGap[g.sutta]),
      wd_sutta: Math.log((wdSuttaCounts[g.sutta] + 1) / (wdTotal + 10)),
      wd_cnt: Math.log1p(wdCounts[index]),
      prev_same_ov: overlap(g.digitSet, prevSame.digitSet),
      prev_other_ov: overlap(g.digitSet, prevOther.digitSet),
      prev_same_cut: overlap(g.digitSet, prevSame.cutSet),
      prev_other_cut: overlap(g.digitSet, prevOther.cutSet),
      cond_sutta: Math.log((condCounts[g.sutta] + 2) / (condTotal + 20)) - suttaShare,
    };
    let score = 0;
    model.features.forEach((feature, f) => {
      score += model.weights[f] * ((values[feature] - model.mean[f]) / model.std[f]);
    });
    return { panel, index, score };
  });

  scored.sort((x, y) => y.score - x.score || x.index - y.index);
  return scored.map((item) => item.panel);
}

/**
 * Reorder existing PanelPick objects by the model's panel order, keeping the
 * incoming score envelope so displayed scores stay on the familiar 0-100 scale.
 */
export function applyPanelOrder(picks: PanelPick[], order: string[] | null): PanelPick[] {
  if (!order || picks.length === 0) return picks;
  const byPanel = new Map(picks.map((pick) => [pick.panel, pick]));
  const envelope = picks.map((pick) => pick.score).sort((a, b) => b - a);
  const ranked = order
    .map((panel) => byPanel.get(panel))
    .filter((pick): pick is PanelPick => Boolean(pick));
  return ranked.map((pick, index) => ({ ...pick, score: envelope[index] ?? pick.score }));
}
