import type { FlatEntry } from "./data";
import { calculateSutta, getPanelKind } from "./panel-utils";
import type { PanelPick } from "./types";

function increment<K>(counts: Map<K, number>, key: K): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

/**
 * Rank Open panels by a smoothed market profile and the opposite digits of the
 * previous Open panel. This is intentionally Open-only: the equivalent Close
 * model failed the final chronological holdout.
 */
export function rerankOpenPanelsByProfile(
  picks: PanelPick[],
  entries: FlatEntry[],
): PanelPick[] {
  if (picks.length === 0 || entries.length === 0) return picks;

  const panelCounts = new Map<string, number>();
  const positionCounts = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
  const pairCounts = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
  const suttaCounts = new Map<number, number>();
  const kindCounts = new Map<string, number>();

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
  }

  const previousPanel = entries.at(-1)?.panel ?? "";
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
    const profileScore =
      Math.log(longCount + 1.5) +
      0.45 * positionProfile +
      0.25 * pairProfile +
      0.25 * suttaProfile +
      0.2 * kindProfile +
      0.35 * oppositeOverlap;

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

