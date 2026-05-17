/**
 * Game-Theory Prediction Engine v2
 *
 * Core Philosophy (from analysis.md):
 * The Satta Matka system operates on Parimutuel Liability Minimization.
 * The operator's ledger ALGORITHMICALLY selects the lowest-liability outcome.
 *
 * v2 Changes:
 *  - Works with new Open/Close/Jodi schema
 *  - Fixed temporal multiplier direction (was inverted)
 *  - Recency-based scoring instead of raw lifetime frequency
 *  - Recent-repeat cooldown (panels from last 5 draws get massive penalty)
 *  - Graduated sutta saturation (drought length matters)
 *  - Day-of-week sutta boosting
 */

import type { PanelRecord } from './db'

// ─── Market Config ────────────────────────────────────────────────────────────

export const HIGH_VOLUME_MARKETS = [
  'Sridevi', 'Time Bazar', 'Madhur Day', 'Milan Day', 'Rajdhani Day', 'Kalyan',
  'Sridevi Night', 'Madhur Night', 'Milan Night', 'Rajdhani Night', 'Main Bombay',
]

const LIQUIDITY_FLOW_MAP: Record<string, string> = {
  'Time Bazar':    'Sridevi',
  'Madhur Day':    'Time Bazar',
  'Milan Day':     'Madhur Day',
  'Rajdhani Day':  'Milan Day',
  'Kalyan':        'Rajdhani Day',
  'Sridevi Night': 'Kalyan',
  'Madhur Night':  'Sridevi Night',
  'Milan Night':   'Madhur Night',
  'Rajdhani Night':'Milan Night',
  'Main Bombay':   'Rajdhani Night',
}

const VOL_MULTIPLIER: Record<string, number> = {
  high: 0.6,
  medium: 0.8,
  low: 1.0,
}

const HIGH_VOL_SET = new Set(HIGH_VOLUME_MARKETS)
const MEDIUM_VOL_SET = new Set([
  'Time Bazar', 'Madhur Day', 'Rajdhani Day',
  'Sridevi Night', 'Madhur Night', 'Kalyan Night', 'Rajdhani Night',
])

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PredictionResult {
  market: string
  volumeTier: 'High' | 'Medium' | 'Low'
  temporalMode: 'Payday' | 'Month-End' | 'Normal'
  temporalMultiplier: number
  liquidityMultiplier: number
  liquiditySourceMarket: string | null
  liquiditySourceHadPopular: boolean
  honeyPotAlert: boolean
  recordsSinceLastSequence: number
  averageDroughtLength: number
  suttaDroughts: Record<string, number>
  saturatedSuttas: string[]
  topPicks: PanelPick[]
  totalRecordsAnalysed: number
  totalDraws: number
  stats: MarketStats
}

export interface PanelPick {
  panel: string
  sutta: number
  score: number
  isHoneyPotPick: boolean
  isSequential: boolean
  isTriple: boolean
  breakdown: {
    recencyScore: number
    seqPenalty: number
    luckyPenalty: number
    triplePenalty: number
    saturationPenalty: number
    cooldownPenalty: number
    dayBoost: number
  }
}

export interface MarketStats {
  totalRecords: number
  totalDraws: number
  sequenceCount: number
  sequenceRate: number
  tripleCount: number
  tripleRate: number
  jodiCount: number
  topOpenPanels: Array<{ panel: string; count: number }>
  topClosePanels: Array<{ panel: string; count: number }>
  topJodis: Array<{ jodi: string; count: number }>
  suttaDistribution: Record<string, number>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isSequential(panel: string): boolean {
  if (panel.length !== 3) return false
  try {
    const d1 = parseInt(panel[0])
    const d2 = parseInt(panel[1])
    const d3 = parseInt(panel[2])
    if (d2 === d1 + 1 && d3 === d2 + 1) return true
    if (d2 === d1 - 1 && d3 === d2 - 1) return true
    if (['890', '901', '012', '789'].includes(panel)) return true
  } catch {
    // ignore
  }
  return false
}

export function isTriple(panel: string): boolean {
  return panel.length === 3 && panel[0] === panel[1] && panel[1] === panel[2]
}

export function calculateSutta(panel: string): number {
  return (parseInt(panel[0]) + parseInt(panel[1]) + parseInt(panel[2])) % 10
}

function countLuckyDigits(panel: string): number {
  return panel.split('').filter((d) => ['7', '8', '9'].includes(d)).length
}

/** Generate all 220 unique Matka panels */
function generateAllPanels(): string[] {
  const panels: string[] = []
  const ord = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
  for (let i = 0; i < 10; i++) {
    for (let j = i; j < 10; j++) {
      for (let k = j; k < 10; k++) {
        panels.push(`${ord[i]}${ord[j]}${ord[k]}`)
      }
    }
  }
  return panels
}

const ALL_PANELS = generateAllPanels()

/** Flatten records into a chronological list of individual panels (both Open & Close) */
interface FlatEntry {
  panel: string
  sutta: number
  type: 'open' | 'close'
  day: string
  index: number
}

function flattenRecords(records: PanelRecord[]): FlatEntry[] {
  const entries: FlatEntry[] = []
  let idx = 0
  for (const rec of records) {
    if (rec.openPanel) {
      entries.push({ panel: rec.openPanel, sutta: rec.openSutta, type: 'open', day: rec.day, index: idx++ })
    }
    if (rec.closePanel) {
      entries.push({ panel: rec.closePanel, sutta: rec.closeSutta, type: 'close', day: rec.day, index: idx++ })
    }
  }
  return entries
}

// ─── Core Analysis ───────────────────────────────────────────────────────────

export function computeStats(records: PanelRecord[]): MarketStats {
  const openCounts: Record<string, number> = {}
  const closeCounts: Record<string, number> = {}
  const jodiCounts: Record<string, number> = {}
  const suttaDistribution: Record<string, number> = {}
  let sequenceCount = 0
  let tripleCount = 0
  let jodiTotal = 0

  for (const rec of records) {
    if (rec.openPanel) {
      openCounts[rec.openPanel] = (openCounts[rec.openPanel] ?? 0) + 1
      const s = String(rec.openSutta)
      suttaDistribution[s] = (suttaDistribution[s] ?? 0) + 1
      if (isSequential(rec.openPanel)) sequenceCount++
      if (isTriple(rec.openPanel)) tripleCount++
    }
    if (rec.closePanel) {
      closeCounts[rec.closePanel] = (closeCounts[rec.closePanel] ?? 0) + 1
      const s = String(rec.closeSutta)
      suttaDistribution[s] = (suttaDistribution[s] ?? 0) + 1
      if (isSequential(rec.closePanel)) sequenceCount++
      if (isTriple(rec.closePanel)) tripleCount++
    }
    if (rec.jodi) {
      jodiCounts[rec.jodi] = (jodiCounts[rec.jodi] ?? 0) + 1
      jodiTotal++
    }
  }

  const totalPanels = Object.values(openCounts).reduce((a, b) => a + b, 0)
    + Object.values(closeCounts).reduce((a, b) => a + b, 0)

  const topOpen = Object.entries(openCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([panel, count]) => ({ panel, count }))
  const topClose = Object.entries(closeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([panel, count]) => ({ panel, count }))
  const topJodis = Object.entries(jodiCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([jodi, count]) => ({ jodi, count }))

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
  }
}

/**
 * Full Game-Theory prediction run for a single market.
 */
export function analyzeMarket(
  marketName: string,
  records: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>
): PredictionResult | null {
  if (records.length === 0) return null

  const stats = computeStats(records)
  const allPanelEntries = flattenRecords(records)
  if (allPanelEntries.length === 0) return null

  // ── 1. Volume Tier ────────────────────────────────────────────────────────
  const tier = HIGH_VOL_SET.has(marketName) ? 'High'
    : MEDIUM_VOL_SET.has(marketName) ? 'Medium' : 'Low'
  const volMultiplier = VOL_MULTIPLIER[tier.toLowerCase()]

  // ── 2. Temporal Payday Cycle (FIXED DIRECTION) ────────────────────────────
  // Payday (1-5): operator drops honey-pots → REDUCE penalty on sequences
  // Month-end (25-31): operator extracts → INCREASE penalty on sequences
  const today = new Date().getDate()
  let temporalMode: 'Payday' | 'Month-End' | 'Normal'
  let temporalMultiplier: number

  if (today >= 1 && today <= 5) {
    temporalMode = 'Payday'
    temporalMultiplier = 0.7   // REDUCE penalties → sequences more likely
  } else if (today >= 25) {
    temporalMode = 'Month-End'
    temporalMultiplier = 1.3   // INCREASE penalties → operator is extracting
  } else {
    temporalMode = 'Normal'
    temporalMultiplier = 1.0
  }

  // ── 3. Honey-Pot Drought Detection ────────────────────────────────────────
  let recordsSinceLastSequence = 0
  for (let i = allPanelEntries.length - 1; i >= 0; i--) {
    if (isSequential(allPanelEntries[i].panel)) break
    recordsSinceLastSequence++
  }

  const droughts: number[] = []
  let currentDrought = 0
  for (const entry of allPanelEntries) {
    if (isSequential(entry.panel)) {
      if (currentDrought > 0) droughts.push(currentDrought)
      currentDrought = 0
    } else {
      currentDrought++
    }
  }
  const averageDroughtLength = droughts.length > 0
    ? droughts.reduce((a, b) => a + b, 0) / droughts.length
    : 21

  const honeyPotAlert = recordsSinceLastSequence > Math.max(30, averageDroughtLength * 1.4)

  // ── 4. Sutta Saturation (GRADUATED) ───────────────────────────────────────
  const suttaDroughts: Record<string, number> = {}
  for (let s = 0; s <= 9; s++) suttaDroughts[String(s)] = 1000

  for (let i = allPanelEntries.length - 1; i >= 0; i--) {
    const sKey = String(allPanelEntries[i].sutta)
    const drought = (allPanelEntries.length - 1) - i
    if (suttaDroughts[sKey] === 1000) {
      suttaDroughts[sKey] = drought
    }
    if (Object.values(suttaDroughts).every((v) => v < 1000)) break
  }

  const saturatedSuttas = Object.entries(suttaDroughts)
    .filter(([, d]) => d > 8)
    .map(([s]) => s)

  // ── 5. Liquidity Flow Correlation ─────────────────────────────────────────
  let liquidityMultiplier = 1.0
  const liquiditySourceMarket = LIQUIDITY_FLOW_MAP[marketName] ?? null
  let liquiditySourceHadPopular = false

  if (liquiditySourceMarket) {
    const sourceRecords = allMarketsRecords[liquiditySourceMarket] ?? []
    if (sourceRecords.length > 0) {
      const lastRec = sourceRecords[sourceRecords.length - 1]
      const lastOpen = lastRec.openPanel
      const lastClose = lastRec.closePanel
      if ((lastOpen && (isSequential(lastOpen) || isTriple(lastOpen))) ||
          (lastClose && (isSequential(lastClose) || isTriple(lastClose)))) {
        liquidityMultiplier = 1.5
        liquiditySourceHadPopular = true
      } else {
        liquidityMultiplier = 0.9
      }
    }
  }

  // ── 6. Build lookup tables for scoring ────────────────────────────────────

  // Recency: how many draws ago each panel was last seen
  const panelLastSeen: Record<string, number> = {}
  for (let i = allPanelEntries.length - 1; i >= 0; i--) {
    const p = allPanelEntries[i].panel
    if (!(p in panelLastSeen)) {
      panelLastSeen[p] = (allPanelEntries.length - 1) - i
    }
  }

  // Day-of-week sutta distribution (for today's day)
  const todayDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
  const daySuttaCounts: Record<string, number> = {}
  let dayTotalCount = 0
  for (const entry of allPanelEntries) {
    if (entry.day === todayDayName) {
      const s = String(entry.sutta)
      daySuttaCounts[s] = (daySuttaCounts[s] ?? 0) + 1
      dayTotalCount++
    }
  }

  // ── 7. Score Every Panel ──────────────────────────────────────────────────
  const topPicks: PanelPick[] = []

  for (const panel of ALL_PANELS) {
    const lastSeen = panelLastSeen[panel] ?? Infinity
    const panelSutta = calculateSutta(panel)
    const panelIsSeq = isSequential(panel)
    const panelIsTriple = isTriple(panel)

    // --- A) Recency Score (replaces raw frequency) ---
    // Panels seen very recently will repeat almost never. Panels unseen for
    // a moderate window are in the operator's "safe zone".
    let recencyScore: number
    if (lastSeen <= 3) recencyScore = 5         // Just appeared → near-impossible repeat
    else if (lastSeen <= 8) recencyScore = 30   // Still cooling
    else if (lastSeen <= 20) recencyScore = 60  // Warming up
    else if (lastSeen <= 50) recencyScore = 85  // Prime territory
    else if (lastSeen <= 100) recencyScore = 70 // Getting stale
    else recencyScore = 50                       // Very cold or never seen

    // --- B) Cooldown Penalty (hard suppress recent panels) ---
    const cooldownPenalty = lastSeen <= 3 ? 40 : lastSeen <= 5 ? 20 : 0

    // --- C) Sequential penalty (or BONUS during honey-pot) ---
    let seqPenalty = 0
    if (panelIsSeq) {
      if (honeyPotAlert) {
        seqPenalty = -40  // BONUS: trap is set
      } else {
        seqPenalty = 35 * volMultiplier * temporalMultiplier * liquidityMultiplier
      }
    }

    // --- D) Lucky-digit penalty ---
    const luckyPenalty = countLuckyDigits(panel) * 10 * volMultiplier * temporalMultiplier * liquidityMultiplier

    // --- E) Triple penalty ---
    const triplePenalty = panelIsTriple
      ? 50 * volMultiplier * temporalMultiplier * liquidityMultiplier
      : 0

    // --- F) Sutta saturation (GRADUATED by drought length) ---
    const suttaDrought = suttaDroughts[String(panelSutta)] ?? 0
    let saturationPenalty = 0
    if (suttaDrought > 20) saturationPenalty = 40      // Extreme drought
    else if (suttaDrought > 12) saturationPenalty = 30  // Heavy drought
    else if (suttaDrought > 8) saturationPenalty = 20   // Moderate drought
    // Under 8: no penalty (sutta is fresh)

    // --- G) Day-of-week boost ---
    let dayBoost = 0
    if (dayTotalCount > 20) { // only if we have enough data for this day
      const suttaDayRate = (daySuttaCounts[String(panelSutta)] ?? 0) / dayTotalCount
      const expectedRate = 0.1  // 10% baseline (1 in 10 suttas)
      if (suttaDayRate > expectedRate * 1.3) {
        dayBoost = 10 * (suttaDayRate / expectedRate)  // Proportional boost
      }
    }

    // --- Final Score ---
    const rawScore = recencyScore
      - cooldownPenalty
      - seqPenalty
      - luckyPenalty
      - triplePenalty
      - saturationPenalty
      + dayBoost

    const finalScore = Math.max(0, Math.min(100, rawScore))

    topPicks.push({
      panel,
      sutta: panelSutta,
      score: Math.round(finalScore * 100) / 100,
      isHoneyPotPick: honeyPotAlert && panelIsSeq,
      isSequential: panelIsSeq,
      isTriple: panelIsTriple,
      breakdown: {
        recencyScore: Math.round(recencyScore * 100) / 100,
        seqPenalty: Math.round(seqPenalty * 100) / 100,
        luckyPenalty: Math.round(luckyPenalty * 100) / 100,
        triplePenalty: Math.round(triplePenalty * 100) / 100,
        saturationPenalty,
        cooldownPenalty,
        dayBoost: Math.round(dayBoost * 100) / 100,
      },
    })
  }

  topPicks.sort((a, b) => b.score - a.score)

  return {
    market: marketName,
    volumeTier: tier,
    temporalMode,
    temporalMultiplier,
    liquidityMultiplier,
    liquiditySourceMarket,
    liquiditySourceHadPopular,
    honeyPotAlert,
    recordsSinceLastSequence,
    averageDroughtLength: Math.round(averageDroughtLength * 10) / 10,
    suttaDroughts,
    saturatedSuttas,
    topPicks: topPicks.slice(0, 30),
    totalRecordsAnalysed: allPanelEntries.length,
    totalDraws: records.length,
    stats,
  }
}
