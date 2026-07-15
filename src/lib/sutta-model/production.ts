import { LIQUIDITY_FLOW_MAP, type PanelPick } from "@/lib/predictor"
import { getRecordISODate, type PanelRecord } from "@/lib/db"
import { buildAdjustedCloseTop6Model } from "./adjusted-close"
import { buildCloseTop6Model } from "./close"
import { buildJodiSet } from "./jodi"
import { buildOpenTop6Model } from "./open"
import { applyRankProbabilities } from "./shared"
import type { SuttaPick } from "./types"

export type CopySuttaPick = SuttaPick

type SuttaSelectionMode = "current" | "aggregate" | "weightedAggregate" | "weightedSnap"
type OpenSuttaStrategy =
  | "current"
  | "rankOnly"
  | "sameDate"
  | "sameDateOpposite"
  | "previousOpenDelta"
  | "gapBalanced"
  | "gapSnapback"
  | "housePrevOpenSame"
  | "housePrevOpenFlip"
  | "weightedSnap"
type CloseSuttaStrategy =
  | "currentProduction"
  | "currentUi"
  | "rankOnly"
  | "sumCooling"
  | "weightedFresh"
  | "calendarSameDate"
  | "calendarSameDateOpposite"
  | "prevCloseCond"
  | "prevOpenCond"
  | "prevJodiCond"
  | "currentOpenCond"
  | "currentOpenOpposite"
  | "currentOpenOppHouse"
  | "currentOpenSameHouse"
  | "prevCloseDelta"
  | "prevOpenDelta"
  | "sourcePrevOpenCond"
  | "rawRankOnly"
  | "rawSumCooling"
  | "rawWeightedSnap"
  | "rawCalendarSameDate"
  | "rawCalendarSameDateOpposite"
  | "rawPrevCloseCond"
  | "rawPrevOpenCond"
  | "rawPrevJodiCond"
  | "rawPrevCloseDelta"
  | "rawPrevOpenDelta"
type MarketStrategy<T> = T | T[]
type CountAwareMarketStrategy<T> = MarketStrategy<T> | {
  narrow: MarketStrategy<T>
  wide: MarketStrategy<T>
  counts?: Partial<Record<number, MarketStrategy<T>>>
}

const OPEN_SUTTA_MARKET_STRATEGY: Record<string, CountAwareMarketStrategy<OpenSuttaStrategy>> = {
  Sridevi: "current",
  "Time Bazar": "sameDate",
  "Madhur Day": "gapBalanced",
  "Milan Day": "housePrevOpenFlip",
  "Rajdhani Day": "sameDate",
  Kalyan: "rankOnly",
  "Sridevi Night": "sameDate",
  "Kalyan Night": "weightedSnap",
  "Madhur Night": "sameDateOpposite",
  "Milan Night": "sameDateOpposite",
  "Rajdhani Night": "gapBalanced",
  "Main Bazar": "housePrevOpenSame",
}

const CLOSE_SUTTA_MARKET_STRATEGY: Record<string, CountAwareMarketStrategy<CloseSuttaStrategy>> = {
  Sridevi: "currentOpenOppHouse",
  "Time Bazar": {
    narrow: "rawPrevJodiCond",
    wide: "rawPrevJodiCond",
    counts: { 2: "prevJodiCond", 5: "prevJodiCond" },
  },
  "Madhur Day": {
    narrow: ["rawPrevOpenCond", "rawPrevOpenDelta"],
    wide: ["rawPrevOpenCond", "rawPrevOpenDelta"],
    counts: { 2: "prevOpenCond" },
  },
  "Milan Day": "sumCooling",
  "Rajdhani Day": ["rawCalendarSameDateOpposite", "rawPrevOpenDelta"],
  Kalyan: ["rawCalendarSameDate", "rawPrevCloseCond"],
  "Sridevi Night": {
    narrow: ["currentProduction", "currentUi"],
    wide: ["currentProduction", "currentUi"],
    counts: { 2: "sumCooling", 8: "currentUi" },
  },
  "Kalyan Night": {
    narrow: ["currentOpenOppHouse", "currentOpenCond"],
    wide: ["currentOpenOppHouse", "currentOpenCond"],
    counts: { 8: "currentOpenCond" },
  },
  "Madhur Night": ["rawRankOnly", "rawPrevCloseCond"],
  "Milan Night": {
    narrow: ["calendarSameDateOpposite", "currentProduction"],
    wide: ["calendarSameDateOpposite", "currentProduction"],
    counts: { 8: "currentProduction" },
  },
  "Rajdhani Night": ["rawRankOnly", "rawPrevCloseCond"],
  "Main Bazar": ["rawCalendarSameDate", "rawPrevCloseCond"],
}

type SourceFormulaSide = "open" | "close"
type SourceFormulaOrigin =
  | "previousDraw"
  | "lag2"
  | "lag3"
  | "lag4"
  | "lag5"
  | "lag7"
  | "previousWeekday"
  | "previousMonthDay"
  | "sameDay"
type SourceFormulaName =
  | "source"
  | "opposite"
  | "sourceOpposite"
  | "mirrorOpposite"
  | "oppositeNearTwo"
  | "nearTwoOpposite"
  | "addThreeCycle"
  | "subtractThreeCycle"
  | "houseLowFirst"
type SourceFormulaFeature =
  | "openSutta"
  | "closeSutta"
  | "openPanel.first"
  | "openPanel.middle"
  | "openPanel.last"
  | "openPanel.outerSum"
  | "openPanel.outerDiff"
  | "openPanel.innerRightSum"
  | "openPanel.span"
  | "closePanel.first"
  | "closePanel.middle"
  | "closePanel.last"
  | "closePanel.outerSum"
  | "closePanel.outerDiff"
  | "closePanel.product"
  | "jodi.sum"
  | "jodi.diff"

interface SourceHybridRule {
  sourceMarket: string
  sourceFeature: SourceFormulaFeature
  origin: SourceFormulaOrigin
  formula: SourceFormulaName
  preserveCount?: 2 | 3 | 4
}

const OPEN_SOURCE_HYBRID_RULES: Partial<Record<string, SourceHybridRule | SourceHybridRule[]>> = {
  "Madhur Day": [
    { sourceMarket: "Milan Day", sourceFeature: "openSutta", origin: "previousDraw", formula: "sourceOpposite" },
    { sourceMarket: "Time Bazar", sourceFeature: "closePanel.first", origin: "lag2", formula: "opposite" },
  ],
  "Milan Day": [
    { sourceMarket: "Rajdhani Night", sourceFeature: "openPanel.middle", origin: "previousDraw", formula: "addThreeCycle" },
    { sourceMarket: "Main Bazar", sourceFeature: "closePanel.first", origin: "previousDraw", formula: "source" },
  ],
  Kalyan: [
    { sourceMarket: "Sridevi", sourceFeature: "openPanel.last", origin: "sameDay", formula: "addThreeCycle" },
    { sourceMarket: "Time Bazar", sourceFeature: "openPanel.outerSum", origin: "sameDay", formula: "opposite" },
  ],
  Sridevi: [
    { sourceMarket: "Milan Night", sourceFeature: "closeSutta", origin: "previousDraw", formula: "mirrorOpposite" },
    { sourceMarket: "Kalyan", sourceFeature: "openPanel.middle", origin: "previousWeekday", formula: "sourceOpposite" },
  ],
  "Sridevi Night": [
    { sourceMarket: "Madhur Day", sourceFeature: "closeSutta", origin: "sameDay", formula: "addThreeCycle" },
    { sourceMarket: "Main Bazar", sourceFeature: "openPanel.outerSum", origin: "previousDraw", formula: "source" },
    { sourceMarket: "Rajdhani Day", sourceFeature: "openPanel.first", origin: "previousDraw", formula: "opposite" },
  ],
  "Kalyan Night": [
    { sourceMarket: "Madhur Day", sourceFeature: "closePanel.outerDiff", origin: "sameDay", formula: "houseLowFirst" },
    { sourceMarket: "Kalyan Night", sourceFeature: "openSutta", origin: "lag2", formula: "source" },
  ],
  "Madhur Night": [
    { sourceMarket: "Kalyan Night", sourceFeature: "closePanel.outerSum", origin: "previousDraw", formula: "opposite" },
    { sourceMarket: "Milan Night", sourceFeature: "openPanel.outerDiff", origin: "lag3", formula: "source" },
  ],
  "Milan Night": { sourceMarket: "Madhur Night", sourceFeature: "openSutta", origin: "sameDay", formula: "sourceOpposite" },
  "Rajdhani Day": [
    { sourceMarket: "Time Bazar", sourceFeature: "openPanel.outerSum", origin: "sameDay", formula: "mirrorOpposite" },
    { sourceMarket: "Sridevi", sourceFeature: "openPanel.outerDiff", origin: "previousDraw", formula: "source" },
  ],
  "Rajdhani Night": { sourceMarket: "Main Bazar", sourceFeature: "openPanel.last", origin: "lag3", formula: "sourceOpposite" },
  "Main Bazar": [
    { sourceMarket: "Madhur Day", sourceFeature: "openPanel.first", origin: "previousDraw", formula: "source" },
    { sourceMarket: "Milan Night", sourceFeature: "closeSutta", origin: "previousWeekday", formula: "source" },
  ],
  "Time Bazar": { sourceMarket: "Madhur Night", sourceFeature: "closePanel.middle", origin: "previousWeekday", formula: "source" },
}

const CLOSE_SOURCE_HYBRID_RULES: Partial<Record<string, SourceHybridRule | SourceHybridRule[]>> = {
  Sridevi: [
    { sourceMarket: "Kalyan", sourceFeature: "openSutta", origin: "previousDraw", formula: "mirrorOpposite" },
    { sourceMarket: "Milan Night", sourceFeature: "openPanel.outerDiff", origin: "previousDraw", formula: "opposite" },
    { sourceMarket: "Time Bazar", sourceFeature: "closeSutta", origin: "lag4", formula: "source" },
  ],
  "Time Bazar": [
    { sourceMarket: "Sridevi", sourceFeature: "openSutta", origin: "sameDay", formula: "oppositeNearTwo" },
    { sourceMarket: "Time Bazar", sourceFeature: "jodi.diff", origin: "previousWeekday", formula: "opposite" },
  ],
  "Madhur Day": [
    { sourceMarket: "Main Bazar", sourceFeature: "closePanel.first", origin: "previousDraw", formula: "mirrorOpposite" },
    { sourceMarket: "Milan Night", sourceFeature: "jodi.diff", origin: "lag5", formula: "source" },
  ],
  "Milan Day": [
    { sourceMarket: "Madhur Day", sourceFeature: "closeSutta", origin: "sameDay", formula: "oppositeNearTwo" },
    { sourceMarket: "Madhur Day", sourceFeature: "openPanel.last", origin: "previousMonthDay", formula: "opposite" },
  ],
  Kalyan: [
    { sourceMarket: "Time Bazar", sourceFeature: "openSutta", origin: "sameDay", formula: "nearTwoOpposite" },
    { sourceMarket: "Main Bazar", sourceFeature: "jodi.sum", origin: "previousDraw", formula: "opposite" },
  ],
  "Sridevi Night": [
    { sourceMarket: "Sridevi", sourceFeature: "closeSutta", origin: "previousDraw", formula: "mirrorOpposite" },
    { sourceMarket: "Madhur Day", sourceFeature: "openPanel.innerRightSum", origin: "lag7", formula: "opposite" },
  ],
  "Madhur Night": [
    { sourceMarket: "Sridevi Night", sourceFeature: "openSutta", origin: "sameDay", formula: "addThreeCycle" },
    { sourceMarket: "Madhur Night", sourceFeature: "openPanel.span", origin: "lag7", formula: "opposite" },
  ],
  "Milan Night": [
    { sourceMarket: "Madhur Day", sourceFeature: "closeSutta", origin: "sameDay", formula: "addThreeCycle" },
    { sourceMarket: "Sridevi", sourceFeature: "closePanel.first", origin: "sameDay", formula: "source" },
    { sourceMarket: "Madhur Day", sourceFeature: "closePanel.outerSum", origin: "previousDraw", formula: "source" },
  ],
  "Main Bazar": [
    { sourceMarket: "Time Bazar", sourceFeature: "openSutta", origin: "sameDay", formula: "addThreeCycle" },
    { sourceMarket: "Milan Day", sourceFeature: "openPanel.outerSum", origin: "sameDay", formula: "opposite" },
    { sourceMarket: "Time Bazar", sourceFeature: "openPanel.innerRightSum", origin: "lag4", formula: "opposite" },
  ],
  "Rajdhani Day": { sourceMarket: "Madhur Day", sourceFeature: "closePanel.product", origin: "sameDay", formula: "source" },
  "Kalyan Night": { sourceMarket: "Sridevi Night", sourceFeature: "openSutta", origin: "sameDay", formula: "sourceOpposite" },
  "Rajdhani Night": {
    sourceMarket: "Madhur Night",
    sourceFeature: "closePanel.middle",
    origin: "lag2",
    formula: "subtractThreeCycle",
    preserveCount: 2,
  },
}

export function getSuttaSourceMarketNames(marketName: string) {
  const configurations = [OPEN_SOURCE_HYBRID_RULES[marketName], CLOSE_SOURCE_HYBRID_RULES[marketName]]
  const names = new Set<string>()
  for (const configuration of configurations) {
    const rules = Array.isArray(configuration) ? configuration : configuration ? [configuration] : []
    for (const rule of rules) names.add(rule.sourceMarket)
  }
  names.delete(marketName)
  return [...names]
}

const clampCopyCount = (value: number) => Math.max(1, Math.min(10, Math.trunc(value) || 1))
function compareCopySuttaPicks(a: CopySuttaPick, b: CopySuttaPick) {
  return (
    b.score - a.score ||
    a.rank - b.rank ||
    a.sutta - b.sutta
  )
}

function finalizeCopySuttaSet(items: CopySuttaPick[], count: number) {
  const ranked = [...items].sort(compareCopySuttaPicks)
  return applyRankProbabilities(ranked).slice(0, count)
}

function finalizeRawCopySuttaSet(items: CopySuttaPick[], count: number) {
  return finalizeCopySuttaSet(items, count)
}

function finalizeScoredSuttaRows(
  rows: Array<{ sutta: number; score: number }>,
  droughts: Record<string, number>,
  count: number,
) {
  return finalizeCopySuttaSet(
    rows.map((row, index) => makeCopySuttaPick(row.sutta, row.score * 100, index + 1, droughts)),
    count,
  )
}

function finalizeRawScoredSuttaRows(
  rows: Array<{ sutta: number; score: number }>,
  droughts: Record<string, number>,
  count: number,
) {
  return finalizeRawCopySuttaSet(
    rows.map((row, index) => makeCopySuttaPick(row.sutta, row.score * 100, index + 1, droughts)),
    count,
  )
}

function mergeCopySuttaSources(sources: CopySuttaPick[][], count: number) {
  const bySutta = new Map<number, CopySuttaPick>()

  sources.forEach((source, sourceIndex) => {
    const sourceBase = (sources.length - sourceIndex) * 100000
    source.forEach((item, itemIndex) => {
      const existing = bySutta.get(item.sutta)
      const sourceScore = sourceBase + (100 - itemIndex) * 1000 + item.score
      if (!existing || sourceScore > existing.score) {
        bySutta.set(item.sutta, {
          ...item,
          score: sourceScore,
          rank: Math.min(existing?.rank ?? Number.POSITIVE_INFINITY, itemIndex + 1),
        })
      }
    })
  })

  return finalizeCopySuttaSet(Array.from(bySutta.values()), count)
}

function resolveCountAwareStrategy<T>(
  strategy: CountAwareMarketStrategy<T> | undefined,
  fallback: MarketStrategy<T>,
  count: number,
): MarketStrategy<T> {
  if (!strategy) return fallback
  if (typeof strategy === "object" && !Array.isArray(strategy) && "narrow" in strategy) {
    const exact = strategy.counts?.[count]
    if (exact) return exact
    return count <= 4 ? strategy.narrow : strategy.wide
  }
  return strategy
}

export function buildTopSuttaSet(
  picks: PanelPick[],
  droughts: Record<string, number>,
  count: number,
  mode: SuttaSelectionMode = "current",
): CopySuttaPick[] {
  const bySutta = new Map<number, CopySuttaPick>()

  picks.forEach((pick, index) => {
    const existing = bySutta.get(pick.sutta)
    if (mode !== "current" && existing) {
      const rankWeight = Math.max(1, 31 - index)
      bySutta.set(pick.sutta, {
        ...existing,
        rank: Math.min(existing.rank, index + 1),
        score:
          mode === "weightedAggregate" || mode === "weightedSnap"
            ? existing.score + pick.score * rankWeight
            : existing.score + pick.score,
      })
      return
    }

    if (existing) return

    const rankWeight = Math.max(1, 31 - index)
    bySutta.set(pick.sutta, {
      sutta: pick.sutta,
      rank: index + 1,
      score: mode === "weightedAggregate" || mode === "weightedSnap" ? pick.score * rankWeight : pick.score,
      probabilityPct: 0,
    })
  })

  for (let sutta = 0; sutta <= 9; sutta++) {
    if (bySutta.has(sutta)) continue
    bySutta.set(sutta, {
      sutta,
      rank: 999,
      score: 0,
      probabilityPct: 0,
    })
  }

  const ranked = Array.from(bySutta.values())
  return finalizeCopySuttaSet(ranked, count)
}

function buildRawTopSuttaSet(
  picks: PanelPick[],
  droughts: Record<string, number>,
  count: number,
  mode: SuttaSelectionMode = "current",
): CopySuttaPick[] {
  const bySutta = new Map<number, CopySuttaPick>()

  picks.forEach((pick, index) => {
    const existing = bySutta.get(pick.sutta)
    const rankWeight = Math.max(1, 31 - index)
    if (existing) {
      bySutta.set(pick.sutta, {
        ...existing,
        rank: Math.min(existing.rank, index + 1),
        score:
          mode === "weightedAggregate" || mode === "weightedSnap"
            ? existing.score + pick.score * rankWeight
            : existing.score + pick.score,
      })
      return
    }

    bySutta.set(pick.sutta, {
      ...makeCopySuttaPick(
        pick.sutta,
        mode === "weightedAggregate" || mode === "weightedSnap" ? pick.score * rankWeight : pick.score,
        index + 1,
        droughts,
      ),
    })
  })

  for (let sutta = 0; sutta <= 9; sutta++) {
    if (!bySutta.has(sutta)) bySutta.set(sutta, makeCopySuttaPick(sutta, 0, 999, droughts))
  }

  return finalizeRawCopySuttaSet(Array.from(bySutta.values()), count)
}

function getDayNameForDate(date: Date) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()]
}

function buildRankOnlySuttaSet(
  picks: PanelPick[],
  droughts: Record<string, number>,
  count: number,
): CopySuttaPick[] {
  const selected: CopySuttaPick[] = []
  const seen = new Set<number>()

  picks.forEach((pick, index) => {
    if (seen.has(pick.sutta)) return
    seen.add(pick.sutta)
    selected.push(makeCopySuttaPick(pick.sutta, pick.score, index + 1, droughts))
  })

  for (let sutta = 0; sutta <= 9; sutta++) {
    if (seen.has(sutta)) continue
    seen.add(sutta)
    selected.push(makeCopySuttaPick(sutta, 0, 999, droughts))
  }

  return finalizeCopySuttaSet(selected, count)
}

function buildRawRankOnlySuttaSet(
  picks: PanelPick[],
  droughts: Record<string, number>,
  count: number,
): CopySuttaPick[] {
  const selected: CopySuttaPick[] = []
  const seen = new Set<number>()

  picks.forEach((pick, index) => {
    if (seen.has(pick.sutta)) return
    seen.add(pick.sutta)
    selected.push(makeCopySuttaPick(pick.sutta, pick.score, index + 1, droughts))
  })

  for (let sutta = 0; sutta <= 9; sutta++) {
    if (seen.has(sutta)) continue
    seen.add(sutta)
    selected.push(makeCopySuttaPick(sutta, 0, 999, droughts))
  }

  return finalizeRawCopySuttaSet(selected, count)
}

function makeCopySuttaPick(sutta: number, score: number, rank: number, _droughts: Record<string, number>): CopySuttaPick {
  void _droughts
  return {
    sutta,
    rank,
    score,
    probabilityPct: 0,
  }
}

function smoothedRate(count: number, total: number) {
  return (count + 1) / (total + 10)
}

function oppositeSutta(sutta: number) {
  return (sutta + 5) % 10
}

function suttaHouse(sutta: number | undefined) {
  if (sutta === undefined) return null
  return sutta >= 1 && sutta <= 5 ? "low" : "high"
}

function houseScore(sutta: number, targetHouse: "low" | "high" | null) {
  return targetHouse !== null && suttaHouse(sutta) === targetHouse ? 1 : 0
}

function mod10(value: number) {
  return ((value % 10) + 10) % 10
}

function sourceFormulaDigits(formula: SourceFormulaName, sourceSutta: number) {
  if (formula === "source") return [sourceSutta]
  if (formula === "opposite") return [sourceSutta + 5].map(mod10)
  if (formula === "sourceOpposite") return [sourceSutta, sourceSutta + 5].map(mod10)
  if (formula === "oppositeNearTwo") {
    return [sourceSutta + 5, sourceSutta + 4, sourceSutta + 6, sourceSutta, sourceSutta + 1, sourceSutta - 1].map(mod10)
  }
  if (formula === "nearTwoOpposite") {
    return [sourceSutta, sourceSutta + 1, sourceSutta - 1, sourceSutta + 2, sourceSutta - 2, sourceSutta + 5].map(mod10)
  }
  if (formula === "addThreeCycle") {
    return [sourceSutta, sourceSutta + 3, sourceSutta + 6, sourceSutta + 9, sourceSutta + 1, sourceSutta + 5].map(mod10)
  }
  if (formula === "subtractThreeCycle") {
    return [sourceSutta, sourceSutta - 3, sourceSutta - 6, sourceSutta - 9, sourceSutta - 1, sourceSutta + 5].map(mod10)
  }
  if (formula === "houseLowFirst") {
    return [sourceSutta, sourceSutta + 5, 1, 2, 3, 4].map(mod10)
  }
  return [sourceSutta, 9 - sourceSutta, sourceSutta + 5, 14 - sourceSutta, sourceSutta + 1, sourceSutta - 1].map(mod10)
}

function panelDigits(panel: string | undefined) {
  if (!panel || panel.length !== 3) return null
  const digits = panel.split("").map((part) => Number.parseInt(part, 10))
  return digits.some((digitValue) => Number.isNaN(digitValue)) ? null : digits
}

function panelDigit(panel: string | undefined, index: number) {
  const digits = panelDigits(panel)
  return digits ? digits[index] : null
}

function panelOuterSum(panel: string | undefined) {
  const digits = panelDigits(panel)
  return digits ? mod10(digits[0] + digits[2]) : null
}

function panelOuterDiff(panel: string | undefined) {
  const digits = panelDigits(panel)
  return digits ? mod10(digits[0] - digits[2]) : null
}

function panelInnerRightSum(panel: string | undefined) {
  const digits = panelDigits(panel)
  return digits ? mod10(digits[1] + digits[2]) : null
}

function panelProduct(panel: string | undefined) {
  const digits = panelDigits(panel)
  return digits ? mod10(digits[0] * digits[1] * digits[2]) : null
}

function panelSpan(panel: string | undefined) {
  const digits = panelDigits(panel)
  return digits ? Math.max(...digits) - Math.min(...digits) : null
}

function sourceFeatureValue(record: PanelRecord, feature: SourceFormulaFeature) {
  if (feature === "openSutta") return record.openSutta >= 0 && record.openSutta <= 9 ? record.openSutta : null
  if (feature === "closeSutta") return record.closeSutta >= 0 && record.closeSutta <= 9 ? record.closeSutta : null
  if (feature === "openPanel.first") return panelDigit(record.openPanel, 0)
  if (feature === "openPanel.middle") return panelDigit(record.openPanel, 1)
  if (feature === "openPanel.last") return panelDigit(record.openPanel, 2)
  if (feature === "openPanel.outerSum") return panelOuterSum(record.openPanel)
  if (feature === "openPanel.outerDiff") return panelOuterDiff(record.openPanel)
  if (feature === "openPanel.innerRightSum") return panelInnerRightSum(record.openPanel)
  if (feature === "openPanel.span") return panelSpan(record.openPanel)
  if (feature === "closePanel.first") return panelDigit(record.closePanel, 0)
  if (feature === "closePanel.middle") return panelDigit(record.closePanel, 1)
  if (feature === "closePanel.last") return panelDigit(record.closePanel, 2)
  if (feature === "closePanel.outerSum") return panelOuterSum(record.closePanel)
  if (feature === "closePanel.outerDiff") return panelOuterDiff(record.closePanel)
  if (feature === "closePanel.product") return panelProduct(record.closePanel)
  if (record.openSutta < 0 || record.openSutta > 9 || record.closeSutta < 0 || record.closeSutta > 9) return null
  if (feature === "jodi.sum") return mod10(record.openSutta + record.closeSutta)
  return mod10(record.openSutta - record.closeSutta)
}

function findSourceRecord(
  records: PanelRecord[],
  targetDate: Date,
  origin: SourceFormulaOrigin,
) {
  const targetISO = targetDate.toISOString().slice(0, 10)
  const dated = records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item): item is { record: PanelRecord; isoDate: string } => typeof item.isoDate === "string")
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))

  if (origin === "sameDay") return dated.find((item) => item.isoDate === targetISO)?.record ?? null

  const previous = dated.filter((item) => item.isoDate < targetISO)
  if (origin === "previousWeekday") {
    const targetWeekday = new Date(`${targetISO}T00:00:00Z`).getUTCDay()
    return previous
      .filter((item) => new Date(`${item.isoDate}T00:00:00Z`).getUTCDay() === targetWeekday)
      .at(-1)?.record ?? null
  }
  if (origin === "previousMonthDay") {
    const targetDayOfMonth = Number.parseInt(targetISO.slice(8, 10), 10)
    return previous
      .filter((item) => Number.parseInt(item.isoDate.slice(8, 10), 10) === targetDayOfMonth)
      .at(-1)?.record ?? null
  }

  const lag = origin === "lag2"
    ? 2
    : origin === "lag3"
      ? 3
      : origin === "lag4"
        ? 4
        : origin === "lag5"
          ? 5
          : origin === "lag7"
            ? 7
            : 1
  return previous.at(-lag)?.record ?? null
}

function applySourceHybridPromotion(input: {
  ranking: CopySuttaPick[]
  side: SourceFormulaSide
  marketName: string
  count: number
  targetDate: Date
  allMarketsRecords: Record<string, PanelRecord[]>
}): CopySuttaPick[] {
  const { ranking, side, marketName, count, targetDate, allMarketsRecords } = input
  if (count !== 6) return ranking
  const config = side === "open" ? OPEN_SOURCE_HYBRID_RULES[marketName] : CLOSE_SOURCE_HYBRID_RULES[marketName]
  const rules = Array.isArray(config) ? config : config ? [config] : []
  if (rules.length === 0) return ranking

  let current = ranking
  for (const rule of rules) {
    const sourceRecord = findSourceRecord(allMarketsRecords[rule.sourceMarket] ?? [], targetDate, rule.origin)
    if (!sourceRecord) continue
    const sourceSutta = sourceFeatureValue(sourceRecord, rule.sourceFeature)
    if (sourceSutta === null) continue

    const order = current.slice(0, rule.preserveCount ?? 4).map((pick) => pick.sutta)
    for (const sutta of sourceFormulaDigits(rule.formula, sourceSutta)) {
      if (order.length >= count) break
      if (!order.includes(sutta)) order.push(sutta)
    }
    for (const pick of current) {
      if (order.length >= count) break
      if (!order.includes(pick.sutta)) order.push(pick.sutta)
    }
    for (let sutta = 0; order.length < count && sutta <= 9; sutta++) {
      if (!order.includes(sutta)) order.push(sutta)
    }

    current = applyRankProbabilities(
      order.slice(0, count).map((sutta, index) => ({
        sutta,
        rank: index + 1,
        score: 100 - index * 5,
        probabilityPct: 0,
      })),
    )
  }
  return current
}

function buildOpenSuttaSetCore(
  picks: PanelPick[],
  droughts: Record<string, number>,
  records: PanelRecord[],
  count: number,
  marketName = "",
  targetDate = new Date(),
  allMarketsRecords: Record<string, PanelRecord[]> = {},
): CopySuttaPick[] {
  const withHybrid = (ranking: CopySuttaPick[]) => applySourceHybridPromotion({
    ranking,
    side: "open",
    marketName,
    count,
    targetDate,
    allMarketsRecords,
  })
  if (records.length < 50) return withHybrid(buildTopSuttaSet(picks, droughts, count))

  const openRecords = records.filter((record) => record.openPanel && record.openSutta >= 0)
  if (openRecords.length < 50) return withHybrid(buildTopSuttaSet(picks, droughts, count))

  const isolatedTop6 = buildOpenTop6Model({
    marketName, records, droughts, count, targetDate, allMarketsRecords,
  })
  if (isolatedTop6) return withHybrid(isolatedTop6)

  const strategy = resolveCountAwareStrategy(
    OPEN_SUTTA_MARKET_STRATEGY[marketName],
    "current",
    count,
  )
  if (strategy === "current") return withHybrid(buildTopSuttaSet(picks, droughts, count))
  if (strategy === "rankOnly") return withHybrid(buildRankOnlySuttaSet(picks, droughts, count))
  if (strategy === "weightedSnap") return withHybrid(buildTopSuttaSet(picks, droughts, count, "weightedSnap"))

  const todayDayName = getDayNameForDate(targetDate)
  const recent24 = Array(10).fill(0)
  const recent60 = Array(10).fill(0)
  const weekday = Array(10).fill(0)
  const sameDate = Array(10).fill(0)
  const sameDateOpposite = Array(10).fill(0)
  const prevOpenDelta = Array(10).fill(0)
  const total = openRecords.length
  let weekdayTotal = 0
  let sameDateTotal = 0
  const dayOfMonth = targetDate.getDate()

  for (const record of openRecords) {
    if (record.day === todayDayName) {
      weekday[record.openSutta]++
      weekdayTotal++
    }
  }

  for (const record of openRecords.slice(-24)) {
    recent24[record.openSutta]++
  }

  for (const record of openRecords.slice(-60)) {
    recent60[record.openSutta]++
  }

  for (const record of openRecords) {
    const isoDate = getRecordISODate(record)
    if (isoDate && new Date(`${isoDate}T12:00:00`).getDate() === dayOfMonth) {
      sameDate[record.openSutta]++
      sameDateOpposite[oppositeSutta(record.openSutta)]++
      sameDateTotal++
    }
  }

  for (let i = 1; i < openRecords.length; i++) {
    const previous = openRecords[i - 1].openSutta
    const current = openRecords[i].openSutta
    prevOpenDelta[(current - previous + 10) % 10]++
  }

  const previousOpen = openRecords[openRecords.length - 1].openSutta
  const previousOpenHouse = suttaHouse(previousOpen)
  const previousOpenFlipHouse =
    previousOpenHouse === "low" ? "high" : previousOpenHouse === "high" ? "low" : null

  const rows = Array.from({ length: 10 }, (_, sutta) => {
    const delta = (sutta - previousOpen + 10) % 10
    const openGap = droughts[String(sutta)] ?? 1000
    const gapBalancedBonus =
      openGap <= 2 ? 0 : openGap <= 5 ? 0 : openGap <= 12 ? 0.05 : openGap <= 25 ? 0.06 : 0
    const gapSnapbackBonus =
      openGap <= 2 ? -0.08 : openGap <= 5 ? 0 : openGap <= 12 ? 0 : openGap <= 25 ? 0.04 : 0.12

    let score = 0
    if (strategy === "sameDate") {
      score =
        0.18 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.12 * smoothedRate(weekday[sutta], weekdayTotal) +
        0.7 * smoothedRate(sameDate[sutta], sameDateTotal)
    } else if (strategy === "sameDateOpposite") {
      score =
        0.18 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.12 * smoothedRate(weekday[sutta], weekdayTotal) +
        0.7 * smoothedRate(sameDateOpposite[sutta], sameDateTotal)
    } else if (strategy === "gapBalanced") {
      score =
        0.18 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.18 * smoothedRate(recent60[sutta], Math.min(60, total)) +
        0.2 * smoothedRate(weekday[sutta], weekdayTotal) +
        gapBalancedBonus
    } else if (strategy === "gapSnapback") {
      score =
        0.18 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.16 * smoothedRate(weekday[sutta], weekdayTotal) +
        gapSnapbackBonus
    } else if (strategy === "housePrevOpenSame") {
      score =
        0.24 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.16 * smoothedRate(weekday[sutta], weekdayTotal) +
        0.6 * houseScore(sutta, previousOpenHouse)
    } else if (strategy === "housePrevOpenFlip") {
      score =
        0.24 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.16 * smoothedRate(weekday[sutta], weekdayTotal) +
        0.6 * houseScore(sutta, previousOpenFlipHouse)
    } else {
      score =
        0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.2 * smoothedRate(weekday[sutta], weekdayTotal) +
        0.55 * smoothedRate(prevOpenDelta[delta], Math.max(1, total - 1))
    }

    return { sutta, score }
  })

  return withHybrid(finalizeScoredSuttaRows(rows, droughts, count))
}

function buildCloseSuttaSetCore(
  picks: PanelPick[],
  droughts: Record<string, number>,
  records: PanelRecord[],
  count: number,
  marketName = "",
  currentOpenSutta: number | null = null,
  allMarketsRecords: Record<string, PanelRecord[]> = {},
  targetDate = new Date(),
): CopySuttaPick[] {
  const productionMode: SuttaSelectionMode = "weightedAggregate"
  const currentProduction = (strategyCount = count) => buildTopSuttaSet(picks, droughts, strategyCount, productionMode)
  const withHybrid = (ranking: CopySuttaPick[]) => applySourceHybridPromotion({
    ranking,
    side: "close",
    marketName,
    count,
    targetDate,
    allMarketsRecords,
  })

  if (records.length < 50) return withHybrid(currentProduction())

  const closeRecords = records.filter((record) => record.closePanel && record.closeSutta >= 0)
  if (closeRecords.length < 50) return withHybrid(currentProduction())

  const isolatedTop6 = currentOpenSutta === null
    ? buildCloseTop6Model({ marketName, records, droughts, count, targetDate })
    : buildAdjustedCloseTop6Model({
        marketName,
        records,
        droughts,
        count,
        currentOpenSutta,
        targetDate,
      })
  if (isolatedTop6) return withHybrid(isolatedTop6)

  const strategyConfig = resolveCountAwareStrategy(
    CLOSE_SUTTA_MARKET_STRATEGY[marketName],
    "currentProduction",
    count,
  )
  const strategies = Array.isArray(strategyConfig) ? strategyConfig : [strategyConfig]

  const todayDayName = getDayNameForDate(targetDate)
  const recent24 = Array(10).fill(0)
  const weekday = Array(10).fill(0)
  const sameDate = Array(10).fill(0)
  const sameDateOpposite = Array(10).fill(0)
  const prevCloseCond = Array(10).fill(0)
  const prevOpenCond = Array(10).fill(0)
  const prevJodiCond = Array(10).fill(0)
  const currentOpenCond = Array(10).fill(0)
  const prevCloseDelta = Array(10).fill(0)
  const prevOpenDelta = Array(10).fill(0)
  const sourcePrevOpenCond = Array(10).fill(0)
  const dayOfMonth = targetDate.getDate()
  let weekdayTotal = 0
  let sameDateTotal = 0
  let prevCloseCondTotal = 0
  let prevOpenCondTotal = 0
  let prevJodiCondTotal = 0
  let currentOpenCondTotal = 0
  let sourcePrevOpenCondTotal = 0

  for (const record of closeRecords.slice(-24)) recent24[record.closeSutta]++
  for (const record of closeRecords) {
    if (record.day === todayDayName) {
      weekday[record.closeSutta]++
      weekdayTotal++
    }
    const isoDate = getRecordISODate(record)
    if (isoDate && new Date(`${isoDate}T12:00:00`).getDate() === dayOfMonth) {
      sameDate[record.closeSutta]++
      sameDateOpposite[oppositeSutta(record.closeSutta)]++
      sameDateTotal++
    }
  }

  const previousRecord = records[records.length - 1]
  const previousClose = previousRecord?.closeSutta ?? 0
  const previousOpen = previousRecord?.openSutta
  const previousJodi = previousRecord?.jodi
  const sourceMarket = LIQUIDITY_FLOW_MAP[marketName]
  const sourceRecords = sourceMarket ? allMarketsRecords[sourceMarket] ?? [] : []
  const sourcePreviousOpen = findSourceRecord(sourceRecords, targetDate, "previousDraw")?.openSutta

  for (let i = 1; i < records.length; i++) {
    const previous = records[i - 1]
    const current = records[i]
    if (current.closeSutta < 0) continue
    if (previous.closeSutta === previousClose) {
      prevCloseCond[current.closeSutta]++
      prevCloseCondTotal++
    }
    if (previous.openSutta === previousOpen) {
      prevOpenCond[current.closeSutta]++
      prevOpenCondTotal++
    }
    if (previous.jodi === previousJodi) {
      prevJodiCond[current.closeSutta]++
      prevJodiCondTotal++
    }
    if (current.openSutta === currentOpenSutta) {
      currentOpenCond[current.closeSutta]++
      currentOpenCondTotal++
    }
    if (previous.closeSutta >= 0) prevCloseDelta[(current.closeSutta - previous.closeSutta + 10) % 10]++
    if (previous.openSutta >= 0) prevOpenDelta[(current.closeSutta - previous.openSutta + 10) % 10]++
    if (sourcePreviousOpen !== undefined && current.openSutta === sourcePreviousOpen) {
      sourcePrevOpenCond[current.closeSutta]++
      sourcePrevOpenCondTotal++
    }
  }

  const total = closeRecords.length
  const buildStrategySet = (strategy: CloseSuttaStrategy, strategyCount: number) => {
    if (strategy === "currentProduction") return currentProduction(strategyCount)
    if (strategy === "sumCooling") return buildTopSuttaSet(picks, droughts, strategyCount, "aggregate")
    if (strategy === "weightedFresh") return buildTopSuttaSet(picks, droughts, strategyCount, "weightedAggregate")
    if (strategy === "currentUi") return buildTopSuttaSet(picks, droughts, strategyCount, "current")
    if (strategy === "rankOnly") return buildRankOnlySuttaSet(picks, droughts, strategyCount)
    if (strategy === "rawSumCooling") return buildRawTopSuttaSet(picks, droughts, strategyCount, "aggregate")
    if (strategy === "rawWeightedSnap") return buildRawTopSuttaSet(picks, droughts, strategyCount, "weightedSnap")
    if (strategy === "rawRankOnly") return buildRawRankOnlySuttaSet(picks, droughts, strategyCount)
    const needsCurrentOpen =
      strategy === "currentOpenCond" ||
      strategy === "currentOpenOpposite" ||
      strategy === "currentOpenOppHouse" ||
      strategy === "currentOpenSameHouse"
    if (needsCurrentOpen && (currentOpenSutta === null || currentOpenSutta < 0)) {
      return buildTopSuttaSet(picks, droughts, strategyCount, productionMode)
    }

    const rows = Array.from({ length: 10 }, (_, sutta) => {
      let score = 0
    if (strategy === "calendarSameDate" || strategy === "rawCalendarSameDate") {
      score =
        0.2 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.1 * smoothedRate(weekday[sutta], weekdayTotal) +
        0.7 * smoothedRate(sameDate[sutta], sameDateTotal)
    } else if (strategy === "calendarSameDateOpposite" || strategy === "rawCalendarSameDateOpposite") {
      score =
        0.2 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.8 * smoothedRate(sameDateOpposite[sutta], sameDateTotal)
    } else if (strategy === "prevCloseCond" || strategy === "rawPrevCloseCond") {
      score =
        0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.15 * smoothedRate(weekday[sutta], weekdayTotal) +
        0.6 * smoothedRate(prevCloseCond[sutta], prevCloseCondTotal)
    } else if (strategy === "prevOpenCond" || strategy === "rawPrevOpenCond") {
      score =
        0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.15 * smoothedRate(weekday[sutta], weekdayTotal) +
        0.6 * smoothedRate(prevOpenCond[sutta], prevOpenCondTotal)
    } else if (strategy === "prevJodiCond" || strategy === "rawPrevJodiCond") {
      score =
        0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.75 * smoothedRate(prevJodiCond[sutta], prevJodiCondTotal)
    } else if (strategy === "currentOpenCond") {
      score =
        0.2 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.1 * smoothedRate(weekday[sutta], weekdayTotal) +
        0.7 * smoothedRate(currentOpenCond[sutta], currentOpenCondTotal)
    } else if (strategy === "currentOpenOpposite") {
      score =
        0.2 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.8 * (currentOpenSutta !== null && oppositeSutta(currentOpenSutta) === sutta ? 1 : 0)
    } else if (strategy === "currentOpenOppHouse") {
      const currentHouse = suttaHouse(currentOpenSutta ?? undefined)
      score =
        0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.75 * (currentHouse !== null && suttaHouse(sutta) !== currentHouse ? 1 : 0)
    } else if (strategy === "currentOpenSameHouse") {
      score =
        0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.75 * houseScore(sutta, suttaHouse(currentOpenSutta ?? undefined))
    } else if (strategy === "prevCloseDelta" || strategy === "rawPrevCloseDelta") {
      const delta = (sutta - previousClose + 10) % 10
      score =
        0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.2 * smoothedRate(weekday[sutta], weekdayTotal) +
        0.55 * smoothedRate(prevCloseDelta[delta], Math.max(1, total - 1))
    } else if (strategy === "prevOpenDelta" || strategy === "rawPrevOpenDelta") {
      const delta = (sutta - (previousOpen ?? 0) + 10) % 10
      score =
        0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.2 * smoothedRate(weekday[sutta], weekdayTotal) +
        0.55 * smoothedRate(prevOpenDelta[delta], Math.max(1, total - 1))
    } else if (strategy === "sourcePrevOpenCond") {
      score =
        0.25 * smoothedRate(recent24[sutta], Math.min(24, total)) +
        0.15 * smoothedRate(weekday[sutta], weekdayTotal) +
        0.6 * smoothedRate(sourcePrevOpenCond[sutta], sourcePrevOpenCondTotal)
    }

      return { sutta, score }
    })

    if (strategy.startsWith("raw")) return finalizeRawScoredSuttaRows(rows, droughts, strategyCount)
    return finalizeScoredSuttaRows(rows, droughts, strategyCount)
  }

  const sources = strategies.map((strategy) => buildStrategySet(strategy, 10))
  return withHybrid(mergeCopySuttaSources(sources, count))
}

function canonicalizeSuttaRanking(primary: CopySuttaPick[], remainder: CopySuttaPick[]) {
  const seen = new Set<number>()
  const ordered = [...primary, ...remainder]
    .filter((pick) => {
      if (seen.has(pick.sutta)) return false
      seen.add(pick.sutta)
      return true
    })
    .slice(0, 10)
    .map((pick, index) => ({ ...pick, score: 100 - index * 5 }))
  return applyRankProbabilities(ordered)
}

/** One count-independent Open model ranking. UI counters only slice this list. */
export function buildOpenSuttaRanking(
  picks: PanelPick[],
  droughts: Record<string, number>,
  records: PanelRecord[],
  marketName = "",
  targetDate = new Date(),
  allMarketsRecords: Record<string, PanelRecord[]> = {},
) {
  return canonicalizeSuttaRanking(
    buildOpenSuttaSetCore(picks, droughts, records, 6, marketName, targetDate, allMarketsRecords),
    buildOpenSuttaSetCore(picks, droughts, records, 10, marketName, targetDate, allMarketsRecords),
  )
}

export function buildOpenSuttaSet(
  picks: PanelPick[], droughts: Record<string, number>, records: PanelRecord[], count: number,
  marketName = "", targetDate = new Date(), allMarketsRecords: Record<string, PanelRecord[]> = {},
) {
  return buildOpenSuttaRanking(
    picks, droughts, records, marketName, targetDate, allMarketsRecords,
  ).slice(0, clampCopyCount(count))
}

/** One count-independent Close (or known-open adjusted Close) model ranking. */
export function buildCloseSuttaRanking(
  picks: PanelPick[], droughts: Record<string, number>, records: PanelRecord[], marketName = "",
  currentOpenSutta: number | null = null, allMarketsRecords: Record<string, PanelRecord[]> = {},
  targetDate = new Date(),
) {
  return canonicalizeSuttaRanking(
    buildCloseSuttaSetCore(picks, droughts, records, 6, marketName, currentOpenSutta, allMarketsRecords, targetDate),
    buildCloseSuttaSetCore(picks, droughts, records, 10, marketName, currentOpenSutta, allMarketsRecords, targetDate),
  )
}

export function buildCloseSuttaSet(
  picks: PanelPick[], droughts: Record<string, number>, records: PanelRecord[], count: number,
  marketName = "", currentOpenSutta: number | null = null,
  allMarketsRecords: Record<string, PanelRecord[]> = {}, targetDate = new Date(),
) {
  return buildCloseSuttaRanking(
    picks, droughts, records, marketName, currentOpenSutta, allMarketsRecords, targetDate,
  ).slice(0, clampCopyCount(count))
}

export function buildJodis(openSuttas: CopySuttaPick[], closeSuttas: CopySuttaPick[]): string[] {
  return buildJodiSet(openSuttas, closeSuttas)
}
