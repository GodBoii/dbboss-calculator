import type { PanelRecord } from "../db";
import type { DpKindContext } from "./types";
import type { FlatEntry } from "./data";
import {
  LIQUIDITY_FLOW_MAP,
  NIGHT_MARKET_NAMES,
  WEEKDAY_DP_BIAS_CLOSE,
  WEEKDAY_DP_BIAS_OPEN,
} from "./market-config";
import { getDoublePanelDigit, isDoublePanel } from "./panel-utils";

function computeDpKindContext(
  marketName: string,
  openEntries: FlatEntry[],
  closeEntries: FlatEntry[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  todayDayName: string,
  isClose: boolean,
): DpKindContext {
  const signals: string[] = [];

  // ── 1. Weekday bias ────────────────────────────────────────────────────────
  const weekdayBias = isClose
    ? (WEEKDAY_DP_BIAS_CLOSE[todayDayName] ?? 1.0)
    : (WEEKDAY_DP_BIAS_OPEN[todayDayName] ?? 1.0);
  if (weekdayBias < 0.9)
    signals.push(`${todayDayName} DP suppression (×${weekdayBias})`);
  else if (weekdayBias > 1.05)
    signals.push(`${todayDayName} DP boost (×${weekdayBias})`);

  let dpBias = weekdayBias;

  // ── 2. Prev close sutta=3 blind-spot fix ──────────────────────────────────
  const lastCloseEntry =
    closeEntries.length > 0 ? closeEntries[closeEntries.length - 1] : null;
  if (lastCloseEntry?.sutta === 3) {
    dpBias *= 1.4;
    signals.push("Prev close sutta=3 blind-spot (×1.40)");
  }

  // ── 3. Market-specific DP digit triggers ──────────────────────────────────
  const lastOpenDpEntry = [...openEntries]
    .reverse()
    .find((e) => isDoublePanel(e.panel));
  const lastCloseDpEntry = [...closeEntries]
    .reverse()
    .find((e) => isDoublePanel(e.panel));
  const lastOpenDpDigit = lastOpenDpEntry
    ? getDoublePanelDigit(lastOpenDpEntry.panel)
    : null;
  const lastCloseDpDigit = lastCloseDpEntry
    ? getDoublePanelDigit(lastCloseDpEntry.panel)
    : null;

  if (marketName === "Kalyan" && lastCloseDpDigit === "8") {
    dpBias *= 1.3;
    signals.push("Kalyan prev-close digit-8 trigger (×1.30)");
  } else if (NIGHT_MARKET_NAMES.has(marketName) && lastOpenDpDigit === "3") {
    dpBias *= 1.4;
    signals.push(
      `${marketName} prev-open digit-3 trigger (×1.40, night gold rule)`,
    );
  } else if (marketName === "Milan Day" && lastCloseDpDigit === "1") {
    dpBias *= 1.2;
    signals.push("Milan Day prev-close digit-1 trigger (×1.20)");
  } else if (marketName === "Sridevi Night" && lastOpenDpDigit === "2") {
    dpBias *= 1.2;
    signals.push("Sridevi Night prev-open digit-2 trigger (×1.20)");
  } else if (marketName === "Madhur Day" && lastOpenDpDigit === "8") {
    dpBias *= 1.2;
    signals.push("Madhur Day prev-open digit-8 trigger (×1.20)");
  }

  // ── 4. Double digit echo: open=2 + close=4 → 66.7% DP ────────────────────
  if (lastOpenDpDigit === "2" && lastCloseDpDigit === "4") {
    dpBias *= 1.3;
    signals.push("Double digit echo open=2, close=4 (×1.30)");
  }

  // ── 5. Source market digit triggers (liquidity chain) ─────────────────────
  const sourceMarket = LIQUIDITY_FLOW_MAP[marketName];
  if (sourceMarket) {
    const sourceRecs = allMarketsRecords[sourceMarket];
    if (sourceRecs && sourceRecs.length > 0) {
      const lastSrc = sourceRecs[sourceRecs.length - 1];
      const srcOpenDpDigit =
        lastSrc.openPanel && isDoublePanel(lastSrc.openPanel)
          ? getDoublePanelDigit(lastSrc.openPanel)
          : null;
      const srcCloseDpDigit =
        lastSrc.closePanel && isDoublePanel(lastSrc.closePanel)
          ? getDoublePanelDigit(lastSrc.closePanel)
          : null;

      // Time Bazar: Sridevi prev-open dpDigit=6 → 57.1% (21 support)
      if (marketName === "Time Bazar" && srcOpenDpDigit === "6") {
        dpBias *= 1.25;
        signals.push("Time Bazar: Sridevi prev-open digit-6 (×1.25)");
      }
      // Night markets: source prev-open dpDigit=3 fires alongside same-market trigger
      if (NIGHT_MARKET_NAMES.has(marketName) && srcOpenDpDigit === "3") {
        dpBias *= 1.2;
        signals.push(`Source prev-open digit-3 (night boost ×1.20)`);
      }
      // Madhur Night: Sridevi Night prev-open dpDigit=1 → 53.3% (30 support)
      if (marketName === "Madhur Night" && srcOpenDpDigit === "1") {
        dpBias *= 1.15;
        signals.push("Madhur Night: Sridevi Night prev-open digit-1 (×1.15)");
      }
      // General: source prev-close digit 0 or 5 has moderate DP cascade effect
      if (srcCloseDpDigit === "0" || srcCloseDpDigit === "5") {
        dpBias *= 1.08;
        signals.push(
          `Source prev-close digit-${srcCloseDpDigit} cascade (×1.08)`,
        );
      }
    }
  }

  // ── 6. Night→Day DP count signal ──────────────────────────────────────────
  // nightToDay.openDpCount=1 → 65.2% DP for day markets (23 support, strong)
  if (!NIGHT_MARKET_NAMES.has(marketName)) {
    let prevNightOpenDpCount = 0;
    for (const nm of NIGHT_MARKET_NAMES) {
      const nmRecs = allMarketsRecords[nm];
      if (!nmRecs || nmRecs.length === 0) continue;
      const lastNm = nmRecs[nmRecs.length - 1];
      if (lastNm.openPanel && isDoublePanel(lastNm.openPanel))
        prevNightOpenDpCount++;
    }
    if (prevNightOpenDpCount === 1) {
      dpBias *= 1.28;
      signals.push(
        "Night→Day: prev night 1 open DP — key warm-up signal (×1.28)",
      );
    } else if (prevNightOpenDpCount === 0) {
      dpBias *= 0.9;
      signals.push(
        "Night→Day: prev night 0 open DPs — dry-night signal (×0.90)",
      );
    }
  }

  // ── 7. 2-year structural shift compensation ────────────────────────────────
  // Day DP rates are UP ~4.5% in last 2 years; night close DOWN ~4.6%.
  if (!NIGHT_MARKET_NAMES.has(marketName)) {
    dpBias *= 1.04;
    signals.push("2yr structural: day DP up (×1.04)");
  } else if (isClose) {
    dpBias *= 0.96;
    signals.push("2yr structural: night close DP down (×0.96)");
  }

  dpBias = Math.max(0.4, Math.min(2.0, dpBias));

  return { dpBias, weekdayBias, signals };
}

export { computeDpKindContext };

