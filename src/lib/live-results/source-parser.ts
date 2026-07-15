import { createHash } from "node:crypto";

import type { ParsedSourceResult } from "./types";

const RESULT_PATTERN = /\b(\d{3})\s*-\s*(\d{2}|\d|\*{1,2})\s*(?:-\s*(\d{3}|\*{3}))?/;

function textOnly(value: string) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function digitForPanel(panel: string) {
  return [...panel].reduce((sum, digit) => sum + Number(digit), 0) % 10;
}

export function normalizeSourceValue(value: string): ParsedSourceResult | null {
  const match = textOnly(value).match(RESULT_PATTERN);
  if (!match) return null;

  const [, openPanel, middle, finalPanel] = match;
  const openDigit = digitForPanel(openPanel);

  if (!finalPanel || finalPanel.includes("*")) {
    const statedOpenDigit = Number(middle.slice(0, 1));
    if (!Number.isInteger(statedOpenDigit) || statedOpenDigit !== openDigit) return null;
    return {
      marketName: "",
      rawValue: `${openPanel}-${openDigit}`,
      phase: "open",
      openPanel,
      openDigit,
      jodi: null,
      closePanel: null,
      closeDigit: null,
    };
  }

  if (!/^\d{2}$/.test(middle)) return null;
  const closeDigit = digitForPanel(finalPanel);
  if (Number(middle[0]) !== openDigit || Number(middle[1]) !== closeDigit) return null;

  return {
    marketName: "",
    rawValue: `${openPanel}-${middle}-${finalPanel}`,
    phase: "close",
    openPanel,
    openDigit,
    jodi: middle,
    closePanel: finalPanel,
    closeDigit,
  };
}

export function parseHomepageResults(html: string) {
  const results = new Map<string, ParsedSourceResult>();
  const headingPattern = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  const headings = [...html.matchAll(headingPattern)];

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const marketName = textOnly(heading[1]).toUpperCase();
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? Math.min(html.length, start + 1800);
    const parsed = normalizeSourceValue(html.slice(start, end));
    if (parsed && !results.has(marketName)) {
      results.set(marketName, { ...parsed, marketName });
    }
  }

  return results;
}

export function sourceHash(marketId: string, date: string, value: string) {
  return createHash("sha256").update(`${marketId}|${date}|${value}`).digest("hex");
}
