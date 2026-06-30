import type { PanelKind } from "./types";

export function isSequential(panel: string): boolean {
  if (panel.length !== 3) return false;
  try {
    const d1 = parseInt(panel[0]);
    const d2 = parseInt(panel[1]);
    const d3 = parseInt(panel[2]);
    if (d2 === d1 + 1 && d3 === d2 + 1) return true;
    if (d2 === d1 - 1 && d3 === d2 - 1) return true;
    if (["890", "901", "012", "789"].includes(panel)) return true;
  } catch {
    // ignore
  }
  return false;
}

export function isTriple(panel: string): boolean {
  return panel.length === 3 && panel[0] === panel[1] && panel[1] === panel[2];
}

export function isDoublePanel(panel: string): boolean {
  return panel.length === 3 && new Set(panel.split("")).size === 2;
}

export function getPanelKind(panel: string): PanelKind {
  const uniqueCount = new Set(panel.split("")).size;
  if (uniqueCount === 2) return "DP";
  return "SP";
}

export function calculateSutta(panel: string): number {
  return (parseInt(panel[0]) + parseInt(panel[1]) + parseInt(panel[2])) % 10;
}

function countLuckyDigits(panel: string): number {
  return panel.split("").filter((d) => ["7", "8", "9"].includes(d)).length;
}

const LUCKY_DIGIT_PENALTY_POINTS = 0;

function getDoublePanelDigit(panel: string): string | null {
  if (!isDoublePanel(panel)) return null;
  const counts: Record<string, number> = {};
  for (const digit of panel) counts[digit] = (counts[digit] ?? 0) + 1;
  return Object.entries(counts).find(([, count]) => count === 2)?.[0] ?? null;
}

function generateAllPanels(): string[] {
  const panels: string[] = [];
  const ord = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  for (let i = 0; i < 10; i++) {
    for (let j = i; j < 10; j++) {
      for (let k = j; k < 10; k++) {
        panels.push(`${ord[i]}${ord[j]}${ord[k]}`);
      }
    }
  }
  return panels;
}

const ALL_PANELS = generateAllPanels();
const DOUBLE_PANELS = ALL_PANELS.filter(isDoublePanel);

export {
  countLuckyDigits,
  getDoublePanelDigit,
  LUCKY_DIGIT_PENALTY_POINTS,
  ALL_PANELS,
  DOUBLE_PANELS,
};

