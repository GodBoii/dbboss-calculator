import type { PanelRecord } from "../db";

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

export type { FlatEntry };
export { flattenRecords };

