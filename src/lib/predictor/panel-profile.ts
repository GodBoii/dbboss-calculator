import type { FlatEntry } from "./data";
import { calculateSutta, getPanelKind } from "./panel-utils";
import type { PanelPick } from "./types";

function increment<K>(counts: Map<K, number>, key: K): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function parityShape(panel: string): string {
  return panel.split("").map((digit) => Number(digit) % 2 === 0 ? "E" : "O").join("");
}

function houseShape(panel: string): string {
  return panel.split("").map((digit) => Number(digit) < 5 ? "L" : "H").join("");
}

function panelSpan(panel: string): number {
  const digits = panel.split("").map(Number);
  return Math.max(...digits) - Math.min(...digits);
}

function outerDifference(panel: string): number {
  return Math.abs(Number(panel[0]) - Number(panel[2]));
}

function incrementTransition<K>(counts: Map<string, number>, from: K, to: K): void {
  increment(counts, `${String(from)}>${String(to)}`);
}

function transitionCount<K>(counts: Map<string, number>, from: K, to: K): number {
  return counts.get(`${String(from)}>${String(to)}`) ?? 0;
}

/**
 * Rank Open panels by a smoothed market profile and the opposite digits of the
 * previous Open panel. This is intentionally Open-only: the equivalent Close
 * model failed the final chronological holdout.
 */
export function rerankPanelsByProfile(
  picks: PanelPick[],
  entries: FlatEntry[],
  options: {
    sourceLag?: number;
    oppositeWeight?: number;
    sourceRelation?: "overlap" | "opposite";
    externalPanels?: string[];
    externalRelation?: "overlap" | "opposite";
    structureWeight?: number;
    transitionWeight?: number;
  } = {},
): PanelPick[] {
  if (picks.length === 0 || entries.length === 0) return picks;

  const panelCounts = new Map<string, number>();
  const positionCounts = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
  const pairCounts = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
  const suttaCounts = new Map<number, number>();
  const kindCounts = new Map<string, number>();
  const parityCounts = new Map<string, number>();
  const houseCounts = new Map<string, number>();
  const spanCounts = new Map<number, number>();
  const outerDifferenceCounts = new Map<number, number>();
  const parityTransitions = new Map<string, number>();
  const houseTransitions = new Map<string, number>();
  const spanTransitions = new Map<string, number>();

  for (const entry of entries) {
    const panel = entry.panel;
    increment(panelCounts, panel);
    for (let position = 0; position < 3; position++) {
      increment(positionCounts[position], panel[position]);
    }
    increment(pairCounts[0], `${panel[0]}${panel[1]}`);
    increment(pairCounts[1], `${panel[0]}${panel[2]}`);
    increment(pairCounts[2], `${panel[1]}${panel[2]}`);
    increment(suttaCounts, entry.sutta);
    increment(kindCounts, getPanelKind(panel));
    increment(parityCounts, parityShape(panel));
    increment(houseCounts, houseShape(panel));
    increment(spanCounts, panelSpan(panel));
    increment(outerDifferenceCounts, outerDifference(panel));
  }
  for (let index = 1; index < entries.length; index++) {
    const previous = entries[index - 1].panel;
    const current = entries[index].panel;
    incrementTransition(parityTransitions, parityShape(previous), parityShape(current));
    incrementTransition(houseTransitions, houseShape(previous), houseShape(current));
    incrementTransition(spanTransitions, panelSpan(previous), panelSpan(current));
  }

  const {
    sourceLag = 1,
    oppositeWeight = 0.35,
    sourceRelation = "opposite",
    externalPanels = [],
    externalRelation = "opposite",
    structureWeight = 0,
    transitionWeight = 0,
  } = options;
  const previousPanel = entries.at(-sourceLag)?.panel ?? "";
  const scored = picks.map((pick) => {
    const panel = pick.panel;
    const longCount = panelCounts.get(panel) ?? 0;
    const positionProfile = positionCounts.reduce(
      (sum, counts, position) => sum + Math.log((counts.get(panel[position]) ?? 0) + 2),
      0,
    );
    const pairProfile =
      Math.log((pairCounts[0].get(`${panel[0]}${panel[1]}`) ?? 0) + 1) +
      Math.log((pairCounts[1].get(`${panel[0]}${panel[2]}`) ?? 0) + 1) +
      Math.log((pairCounts[2].get(`${panel[1]}${panel[2]}`) ?? 0) + 1);
    const suttaProfile = Math.log((suttaCounts.get(calculateSutta(panel)) ?? 0) + 2);
    const kindProfile = Math.log((kindCounts.get(getPanelKind(panel)) ?? 0) + 2);
    const oppositeOverlap = new Set(
      panel
        .split("")
        .filter((digit) => previousPanel.includes(String((Number(digit) + 5) % 10))),
    ).size;
    const directOverlap = new Set(
      panel.split("").filter((digit) => previousPanel.includes(digit)),
    ).size;
    const externalOverlap = externalPanels.reduce(
      (sum, sourcePanel) =>
        sum + new Set(panel.split("").filter((digit) => sourcePanel.includes(digit))).size,
      0,
    );
    const externalOpposite = externalPanels.reduce(
      (sum, sourcePanel) =>
        sum +
        new Set(
          panel
            .split("")
            .filter((digit) => sourcePanel.includes(String((Number(digit) + 5) % 10))),
        ).size,
      0,
    );
    const relationScore = externalPanels.length > 0
      ? externalRelation === "overlap" ? externalOverlap : externalOpposite
      : sourceRelation === "overlap" ? directOverlap : oppositeOverlap;
    const structureScore =
      0.3 * Math.log((parityCounts.get(parityShape(panel)) ?? 0) + 2) +
      0.3 * Math.log((houseCounts.get(houseShape(panel)) ?? 0) + 2) +
      0.2 * Math.log((spanCounts.get(panelSpan(panel)) ?? 0) + 2) +
      0.2 * Math.log((outerDifferenceCounts.get(outerDifference(panel)) ?? 0) + 2);
    const transitionScore = previousPanel
      ? 0.4 * Math.log(transitionCount(parityTransitions, parityShape(previousPanel), parityShape(panel)) + 1) +
        0.35 * Math.log(transitionCount(houseTransitions, houseShape(previousPanel), houseShape(panel)) + 1) +
        0.25 * Math.log(transitionCount(spanTransitions, panelSpan(previousPanel), panelSpan(panel)) + 1)
      : 0;
    const profileScore =
      Math.log(longCount + 1.5) +
      0.45 * positionProfile +
      0.25 * pairProfile +
      0.25 * suttaProfile +
      0.2 * kindProfile +
      oppositeWeight * relationScore +
      structureWeight * structureScore +
      transitionWeight * transitionScore;

    return { pick, longCount, profileScore };
  });

  scored.sort(
    (a, b) =>
      b.profileScore - a.profileScore ||
      b.longCount - a.longCount ||
      a.pick.panel.localeCompare(b.pick.panel),
  );

  // Retain the existing model's score envelope so this rank-only layer does
  // not manufacture higher confidence values than the calibrated scorer.
  const scoreEnvelope = picks.map((pick) => pick.score).sort((a, b) => b - a);
  return scored.map(({ pick }, index) => ({
    ...pick,
    score: scoreEnvelope[index] ?? pick.score,
  }));
}

export function rerankPanelsByFrequencyBlend(
  picks: PanelPick[],
  entries: FlatEntry[],
): PanelPick[] {
  if (picks.length === 0 || entries.length === 0) return picks;
  const longCounts = new Map<string, number>();
  const recentCounts = new Map<string, number>();
  for (const entry of entries) increment(longCounts, entry.panel);
  for (const entry of entries.slice(-60)) increment(recentCounts, entry.panel);
  const longTotal = Math.max(1, entries.length);
  const recentTotal = Math.max(1, Math.min(60, entries.length));
  const ranked = [...picks].sort((a, b) => {
    const scoreA = (longCounts.get(a.panel) ?? 0) / longTotal + 1.2 * (recentCounts.get(a.panel) ?? 0) / recentTotal;
    const scoreB = (longCounts.get(b.panel) ?? 0) / longTotal + 1.2 * (recentCounts.get(b.panel) ?? 0) / recentTotal;
    return scoreB - scoreA || (longCounts.get(b.panel) ?? 0) - (longCounts.get(a.panel) ?? 0) || a.panel.localeCompare(b.panel);
  });
  const scoreEnvelope = picks.map((pick) => pick.score).sort((a, b) => b - a);
  return ranked.map((pick, index) => ({ ...pick, score: scoreEnvelope[index] ?? pick.score }));
}

export function preservePanelPrefix(
  current: PanelPick[],
  challenger: PanelPick[],
  count: number,
): PanelPick[] {
  const prefix = current.slice(0, count);
  const panels = new Set(prefix.map((pick) => pick.panel));
  const combined = [...prefix, ...challenger.filter((pick) => !panels.has(pick.panel))];
  const scoreEnvelope = current.map((pick) => pick.score).sort((a, b) => b - a);
  return combined.map((pick, index) => ({ ...pick, score: scoreEnvelope[index] ?? pick.score }));
}

export function rerankOpenPanelsByProfile(
  picks: PanelPick[],
  entries: FlatEntry[],
): PanelPick[] {
  return rerankPanelsByProfile(picks, entries);
}
