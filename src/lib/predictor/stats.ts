import type { PanelRecord } from "../db";
import type { MarketStats } from "./types";
import { isSequential, isTriple } from "./panel-utils";

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

