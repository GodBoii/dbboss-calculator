/**
 * DP panel ranking model v3 (conditional logit over the 90 DP panels).
 *
 * Answers: "if this Open / Close turns out to be a DP, which DP panel is it?"
 * Each DP panel gets a linear score over 19 frequency / recency / digit
 * features; softmax over the 90 panels gives a probability.
 *
 * Research: research/dp_panel_v3 (REPORT.md). Weights were fitted with a
 * pooled Open+Close conditional logit (L2=3000) on 2023-01-01..2026-07-03 for
 * the 12 app markets, using the same rolling 28-month history the app loads.
 * The Close side is open-aware: when today's Open of the same market is
 * already published it is used as an input.
 */
import { getRecordISODate, type PanelRecord } from "../db";
import { historicalCutoffISO } from "../prediction-contract";
import type { DpDigitFocus, PanelPick } from "./types";
import { DOUBLE_PANELS, calculateSutta, isSequential, isTriple } from "./panel-utils";

export const DP_PANEL_MODEL_ID = "dp-panel-clogit-v3";

const APP_MARKETS = [
  "Sridevi", "Time Bazar", "Madhur Day", "Milan Day", "Rajdhani Day", "Kalyan",
  "Sridevi Night", "Kalyan Night", "Madhur Night", "Milan Night",
  "Rajdhani Night", "Main Bazar",
];

// Frozen from research/dp_panel_v3/model-weights.json (feature order matters).
const MEAN = [-4.616057, -4.580332, -4.625029, -4.662661, -4.599024, -4.529328, -4.52044, 5.459534, 0.027888, -2.328311, -3.899947, -2.327032, -2.306061, -2.304307, 0.543501, 0.25488, 0.014775, 0.047469, 0.001642];
const STD = [0.501108, 0.37629, 0.502944, 0.527295, 0.475437, 0.252584, 0.208633, 1.432124, 0.164652, 0.231601, 0.456769, 0.227763, 0.083757, 0.058573, 0.597017, 0.489844, 0.120653, 0.212639, 0.040485];
const WEIGHTS = [-0.006593, -0.011882, -0.013257, -0.020227, 0.016735, 0.014435, 0.044095, -0.007377, -0.004938, -0.002633, 0.008221, -0.013246, 0.032457, 0.009667, -0.026294, -0.024391, -0.009549, -0.019378, -0.02119];
const F = WEIGHTS.length;

const N = DOUBLE_PANELS.length; // 90
const DP_INDEX = new Map(DOUBLE_PANELS.map((p, i) => [p, i]));
const countOf = (p: string, d: string) => p.split("").filter((x) => x === d).length;
const REP = DOUBLE_PANELS.map((p) => Number(p.split("").find((d) => countOf(p, d) === 2)));
const SUT = DOUBLE_PANELS.map(calculateSutta);
const PAIR_KEYS = DOUBLE_PANELS.map((p) => [...new Set(p.split(""))].sort().join(""));
const PAIRS = [...new Set(PAIR_KEYS)].sort();
const PAIR_IDX = PAIR_KEYS.map((k) => PAIRS.indexOf(k));
const DIGITS = DOUBLE_PANELS.map((p) => [...new Set(p.split(""))].map(Number));

interface SideSeq {
  dates: string[];
  idx: number[]; // DP index or -1
  weekday: number[]; // Monday = 0
  panels: string[];
}

export interface DpPanelPrediction {
  modelId: string;
  targetISO: string;
  openToday: string | null;
  openPicks: PanelPick[];
  closePicks: PanelPick[];
  openFocus: DpDigitFocus | null;
  closeFocus: DpDigitFocus | null;
}

function isoAddDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function mondayWeekday(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function localISO(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

const validPanel = (p: string | undefined | null): p is string => Boolean(p && /^\d{3}$/.test(p));

function datedRows(records: PanelRecord[]) {
  const byDate = new Map<string, PanelRecord>();
  for (const record of records) {
    const iso = getRecordISODate(record);
    if (iso) byDate.set(iso, record);
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function buildSeqs(rows: Array<[string, PanelRecord]>, start: string, endExcl: string) {
  const seqs: Record<"open" | "close", SideSeq> = {
    open: { dates: [], idx: [], weekday: [], panels: [] },
    close: { dates: [], idx: [], weekday: [], panels: [] },
  };
  for (const [iso, record] of rows) {
    if (iso < start || iso >= endExcl) continue;
    for (const side of ["open", "close"] as const) {
      const panel = side === "open" ? record.openPanel : record.closePanel;
      if (!validPanel(panel)) continue;
      const s = seqs[side];
      s.dates.push(iso);
      s.idx.push(DP_INDEX.get(panel) ?? -1);
      s.weekday.push(mondayWeekday(iso));
      s.panels.push(panel);
    }
  }
  return seqs;
}

function counts(seq: SideSeq, filter?: (pos: number) => boolean, weight?: (pos: number) => number) {
  const c = new Array<number>(N).fill(0);
  seq.idx.forEach((i, pos) => {
    if (i < 0 || (filter && !filter(pos))) return;
    c[i] += weight ? weight(pos) : 1;
  });
  return c;
}

function logfreq(c: number[], alpha: number): number[] {
  const total = c.reduce((a, b) => a + b, 0) + alpha * c.length;
  return c.map((v) => Math.log((v + alpha) / total));
}

function groupLog(c: number[], groups: number[], k: number): number[] {
  const g = new Array<number>(k).fill(0);
  c.forEach((v, i) => { g[groups[i]] += v; });
  const total = g.reduce((a, b) => a + b, 0) + k;
  return groups.map((gi) => Math.log((g[gi] + 1) / total));
}

function overlap(panel: string | null): number[] {
  if (!panel) return new Array<number>(N).fill(0);
  const set = new Set(panel.split("").map(Number));
  return DIGITS.map((ds) => ds.filter((d) => set.has(d)).length);
}

function featureMatrix(
  side: "open" | "close",
  own: Record<"open" | "close", SideSeq>,
  globalSide: number[],
  globalAll: number[],
  weekday: number,
  openToday: string | null,
): number[][] {
  const ms = own[side];
  const mo = own[side === "open" ? "close" : "open"];
  const n = ms.idx.length;
  const cMs = counts(ms);
  const cMo = counts(mo);
  const cMb = cMs.map((v, i) => v + cMo[i]);
  const decayed = [60, 200].map((h) => logfreq(counts(ms, undefined, (pos) => 0.5 ** ((n - 1 - pos) / h)), 0.5));
  const wd = logfreq(counts(ms, (pos) => ms.weekday[pos] === weekday), 0.5);
  const last = new Array<number>(N).fill(-1);
  ms.idx.forEach((i, pos) => { if (i >= 0) last[i] = pos; });
  const recent = new Set([...ms.panels.slice(-5), ...mo.panels.slice(-5)]);

  let prev: string | null = side === "close" && openToday ? openToday : null;
  if (!prev) {
    prev = side === "open" ? (mo.panels.at(-1) ?? null) : (ms.panels.at(-1) ?? null);
  }
  const prevOverlap = overlap(prev);
  const aware = side === "close" && openToday ? openToday : null;
  const openOverlap = overlap(aware);
  const openRep = aware && new Set(aware).size === 2
    ? Number(aware.split("").find((d) => countOf(aware, d) === 2))
    : null;
  const openSutta = aware ? calculateSutta(aware) : null;

  const cols = [
    logfreq(cMs, 1),
    decayed[0],
    decayed[1],
    wd,
    logfreq(cMb, 1),
    logfreq(globalSide, 1),
    logfreq(globalAll, 1),
    last.map((l) => Math.log1p(Math.min(l >= 0 ? n - 1 - l : 2000, 2000))),
    DOUBLE_PANELS.map((p) => (recent.has(p) ? 1 : 0)),
    groupLog(cMs, REP, 10),
    groupLog(cMs, PAIR_IDX, PAIRS.length),
    groupLog(cMs, SUT, 10),
    groupLog(globalAll, REP, 10),
    groupLog(globalAll, SUT, 10),
    prevOverlap,
    openOverlap,
    REP.map((r) => (openRep !== null && r === openRep ? 1 : 0)),
    SUT.map((s) => (openSutta !== null && s === openSutta ? 1 : 0)),
    DOUBLE_PANELS.map((p) => (aware && p === aware ? 1 : 0)),
  ];
  return DOUBLE_PANELS.map((_, i) => cols.map((col) => col[i]));
}

function rank(matrix: number[][]): { picks: PanelPick[]; probs: number[] } {
  const scores = matrix.map((row) => {
    let s = 0;
    for (let f = 0; f < F; f++) s += WEIGHTS[f] * ((row[f] - MEAN[f]) / STD[f]);
    return s;
  });
  const max = Math.max(...scores);
  const exp = scores.map((s) => Math.exp(s - max));
  const total = exp.reduce((a, b) => a + b, 0);
  const probs = exp.map((e) => e / total);
  const order = DOUBLE_PANELS.map((_, i) => i).sort((a, b) => scores[b] - scores[a] || a - b);
  const picks = order.map((i): PanelPick => {
    const panel = DOUBLE_PANELS[i];
    // 50 = uniform (1/90); each +1% relative probability lift ≈ +0.5 points.
    const display = Math.max(0, Math.min(100, 50 * probs[i] * N));
    return {
      panel,
      sutta: SUT[i],
      kind: "DP",
      score: Math.round(display * 100) / 100,
      isHoneyPotPick: false,
      isSequential: isSequential(panel),
      isTriple: isTriple(panel),
      breakdown: {
        recencyScore: 0, seqPenalty: 0, luckyPenalty: 0, triplePenalty: 0,
        saturationPenalty: 0, cooldownPenalty: 0, dayBoost: 0, jodiPenalty: 0,
      },
    };
  });
  return { picks, probs };
}

/** Digit-pair focus = pair with the highest summed DP probability. */
function pairFocus(picks: PanelPick[], probs: number[]): DpDigitFocus | null {
  const pairProb = new Array<number>(PAIRS.length).fill(0);
  probs.forEach((p, i) => { pairProb[PAIR_IDX[i]] += p; });
  let best = 0;
  for (let k = 1; k < PAIRS.length; k++) if (pairProb[k] > pairProb[best]) best = k;
  const key = PAIRS[best];
  return {
    digits: [key[0], key[1]],
    pairKey: key,
    score: Math.round(pairProb[best] * 1000) / 10,
    confidence: Math.round(pairProb[best] * 1000) / 10,
    depth: N,
    supportPanels: picks.filter((p) => PAIR_KEYS[DP_INDEX.get(p.panel)!] === key).slice(0, 4).map((p) => p.panel),
  };
}

/**
 * Rank DP panels for the next draw of `marketName`.
 *
 * Target date = the local calendar date of `analysisDate`. If that day's
 * record already has both panels, the next day is targeted instead. If it
 * only has the Open, that Open feeds the Close ranking.
 */
export function predictDpPanels(
  marketName: string,
  records: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  analysisDate = new Date(),
): DpPanelPrediction | null {
  const ownRows = datedRows(records);
  if (ownRows.length === 0) return null;

  let targetISO = localISO(analysisDate);
  const todayRecord = ownRows.find(([iso]) => iso === targetISO)?.[1];
  let openToday: string | null = null;
  if (todayRecord && validPanel(todayRecord.openPanel) && validPanel(todayRecord.closePanel)) {
    targetISO = isoAddDays(targetISO, 1);
  } else if (todayRecord && validPanel(todayRecord.openPanel)) {
    openToday = todayRecord.openPanel;
  }

  const start = historicalCutoffISO(isoAddDays(targetISO, -1));
  const own = buildSeqs(ownRows, start, targetISO);
  if (own.open.idx.length + own.close.idx.length === 0) return null;

  const globalBySide = { open: new Array<number>(N).fill(0), close: new Array<number>(N).fill(0) };
  for (const market of APP_MARKETS) {
    const rows = market === marketName ? ownRows : datedRows(allMarketsRecords[market] ?? []);
    const seqs = market === marketName ? own : buildSeqs(rows, start, targetISO);
    for (const side of ["open", "close"] as const) {
      counts(seqs[side]).forEach((v, i) => { globalBySide[side][i] += v; });
    }
  }
  const globalAll = globalBySide.open.map((v, i) => v + globalBySide.close[i]);
  const weekday = mondayWeekday(targetISO);

  const open = rank(featureMatrix("open", own, globalBySide.open, globalAll, weekday, null));
  const close = rank(featureMatrix("close", own, globalBySide.close, globalAll, weekday, openToday));

  return {
    modelId: DP_PANEL_MODEL_ID,
    targetISO,
    openToday,
    openPicks: open.picks,
    closePicks: close.picks,
    openFocus: pairFocus(open.picks, open.probs),
    closeFocus: pairFocus(close.picks, close.probs),
  };
}
