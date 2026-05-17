/**
 * Game-Theory Prediction Engine — TypeScript port of advanced_predictor.py
 *
 * Core Philosophy (from analysis.md):
 * The Satta Matka system operates on Parimutuel Liability Minimization.
 * The operator's ledger ALGORITHMICALLY selects the lowest-liability outcome
 * to maximize house profit, while strategically dropping enough "winners" to
 * keep the public addicted.
 *
 * Six active strategies (in order of application):
 *  1. Anti-Triple Rule          — Triples occur at 0.23% vs expected 4.5%. Hard suppress.
 *  2. Market Volume Tier        — High volume = operator can afford more winners.
 *  3. Temporal Payday Cycle     — Paydays (1-5): popular numbers bait new money.
 *                                 Month-end (25-31): operator is extracting.
 *  4. Chronological Liquidity   — If Milan Day had a sequence, Kalyan is punished.
 *  5. Honey-Pot Drought         — > 30 draws without sequence = trap is imminent.
 *  6. Sutta Saturation          — Sutta missing > 8 draws gets a -30 pt penalty.
 */

import type { PanelRecord } from './db'

// ─── Market Config ────────────────────────────────────────────────────────────

export const HIGH_VOLUME_MARKETS = [
  'Kalyan',
  'Milan Day',
  'Main Bombay',
  'Milan Night',
  'Kalyan Morning',
]

// Per analysis.md §4: previous market results spill into the next market
const LIQUIDITY_FLOW_MAP: Record<string, string> = {
  Kalyan: 'Milan Day',
  'Main Bombay': 'Kalyan',
  'Milan Night': 'Rajdhani Day',
  'Rajdhani Night': 'Milan Day',
  'Time Bazar': 'Kalyan Morning',
  'Madhur Day': 'Madhur Morning',
}

// Per analysis.md §2: volume tier multiplier for penalty weight
const VOL_MULTIPLIER: Record<string, number> = {
  high: 0.6,   // Can afford some winners
  medium: 0.8,
  low: 1.0,    // Predatory — strict adherence to low liability
}

const HIGH_VOL_SET = new Set(HIGH_VOLUME_MARKETS)
const MEDIUM_VOL_SET = new Set(['Rajdhani Day', 'Rajdhani Night', 'Time Bazar', 'Madhur Day', 'Madhur Morning'])

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
  suttaDroughts: Record<string, number>   // sutta digit → draws since last seen
  saturatedSuttas: string[]               // suttas penalised (drought > 8)
  topPicks: PanelPick[]
  totalRecordsAnalysed: number
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
    baseFreqScore: number
    seqPenalty: number
    luckyPenalty: number
    triplePenalty: number
    saturationPenalty: number
  }
}

export interface MarketStats {
  totalRecords: number
  sequenceCount: number
  sequenceRate: number   // %
  tripleCount: number
  tripleRate: number     // %
  topPanels: Array<{ panel: string; count: number }>
  suttaDistribution: Record<string, number>   // sutta → count
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
  // "Lucky digits" (7, 8, 9) are extremely popular with the public; house suppresses them
  return panel.split('').filter((d) => ['7', '8', '9'].includes(d)).length
}

/** Generate all 220 unique Matka panels (SP: all-different digit combos, sorted ascending with 0 as 10) */
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

// ─── Core Analysis ───────────────────────────────────────────────────────────

/**
 * Compute market statistics from raw records.
 * This is the "data_analyzer.py" logic ported to TypeScript.
 */
export function computeStats(records: PanelRecord[]): MarketStats {
  const panelCounts: Record<string, number> = {}
  const suttaDistribution: Record<string, number> = {}
  let sequenceCount = 0
  let tripleCount = 0

  for (const rec of records) {
    const p = rec.panel
    panelCounts[p] = (panelCounts[p] ?? 0) + 1
    const s = String(rec.sutta)
    suttaDistribution[s] = (suttaDistribution[s] ?? 0) + 1
    if (isSequential(p)) sequenceCount++
    if (isTriple(p)) tripleCount++
  }

  const total = records.length

  const topPanels = Object.entries(panelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([panel, count]) => ({ panel, count }))

  return {
    totalRecords: total,
    sequenceCount,
    sequenceRate: total > 0 ? (sequenceCount / total) * 100 : 0,
    tripleCount,
    tripleRate: total > 0 ? (tripleCount / total) * 100 : 0,
    topPanels,
    suttaDistribution,
  }
}

/**
 * Full Game-Theory prediction run for a single market.
 * allMarketsRecords is needed for liquidity flow correlation.
 */
export function analyzeMarket(
  marketName: string,
  records: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>
): PredictionResult | null {
  if (records.length === 0) return null

  const stats = computeStats(records)

  // ── 1. Volume Tier ────────────────────────────────────────────────────────
  const tier = HIGH_VOL_SET.has(marketName)
    ? 'High'
    : MEDIUM_VOL_SET.has(marketName)
    ? 'Medium'
    : 'Low'
  const volMultiplier = VOL_MULTIPLIER[tier.toLowerCase()]

  // ── 2. Temporal Payday Cycle ──────────────────────────────────────────────
  const today = new Date().getDate()
  let temporalMode: 'Payday' | 'Month-End' | 'Normal'
  let temporalMultiplier: number

  if (today >= 1 && today <= 5) {
    temporalMode = 'Payday'
    temporalMultiplier = 1.2  // Public has money → house sets honey-pots
  } else if (today >= 25) {
    temporalMode = 'Month-End'
    temporalMultiplier = 0.7  // Public is broke → house becomes "generous" to keep hooks in
  } else {
    temporalMode = 'Normal'
    temporalMultiplier = 1.0
  }

  // ── 3. Honey-Pot Drought Detection ────────────────────────────────────────
  // Count how many consecutive records (from the end) have NOT been sequences.
  // If > 30, a honey-pot trap is mathematically imminent (per analysis.md §5).
  let recordsSinceLastSequence = 0
  for (let i = records.length - 1; i >= 0; i--) {
    if (isSequential(records[i].panel)) break
    recordsSinceLastSequence++
  }

  // Calculate average drought length across all historical sequences
  const droughts: number[] = []
  let currentDrought = 0
  for (const rec of records) {
    if (isSequential(rec.panel)) {
      if (currentDrought > 0) droughts.push(currentDrought)
      currentDrought = 0
    } else {
      currentDrought++
    }
  }
  const averageDroughtLength = droughts.length > 0
    ? droughts.reduce((a, b) => a + b, 0) / droughts.length
    : 21  // Fallback: analysis.md shows average is ~21 draws for Kalyan

  const honeyPotAlert = recordsSinceLastSequence > Math.max(30, averageDroughtLength * 1.4)

  // ── 4. Sutta Saturation ───────────────────────────────────────────────────
  // Find how many draws ago each sutta (0-9) was last seen.
  // Gamblers bet on "overdue" suttas → house actively avoids them → we penalise them.
  const suttaDroughts: Record<string, number> = {}
  for (let s = 0; s <= 9; s++) suttaDroughts[String(s)] = 1000 // default: not seen

  for (let i = records.length - 1; i >= 0; i--) {
    const sKey = String(records[i].sutta)
    const drought = (records.length - 1) - i
    if (suttaDroughts[sKey] === 1000) {
      suttaDroughts[sKey] = drought
    }
    // Once all 10 suttas are found we can stop
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
      const lastSourcePanel = sourceRecords[sourceRecords.length - 1].panel
      if (isSequential(lastSourcePanel) || isTriple(lastSourcePanel)) {
        // Source market just dropped a popular number.
        // Public won big and will chase it here → house will brutally penalise popular numbers.
        liquidityMultiplier = 1.5
        liquiditySourceHadPopular = true
      } else {
        // Source had a hard/random result → public is scared → house is slightly relaxed.
        liquidityMultiplier = 0.9
      }
    }
  }

  // ── 6. Score Every Panel ──────────────────────────────────────────────────
  const freqCounts: Record<string, number> = {}
  for (const rec of records) {
    freqCounts[rec.panel] = (freqCounts[rec.panel] ?? 0) + 1
  }
  const maxFreq = Math.max(...Object.values(freqCounts), 1)

  const topPicks: PanelPick[] = []

  for (const panel of ALL_PANELS) {
    const freq = freqCounts[panel] ?? 0

    // Base score: 100 for never-seen, decays as it becomes more frequent
    const freqScore = freq === 0 ? 100 : Math.max(0, 100 - (freq / maxFreq) * 100)

    // Sequential penalty (or BONUS during honey-pot)
    let seqPenalty = 0
    const panelIsSeq = isSequential(panel)
    if (panelIsSeq) {
      if (honeyPotAlert) {
        seqPenalty = -50  // INVERT: the trap is set → give sequences a bonus
      } else {
        seqPenalty = 40 * volMultiplier * temporalMultiplier * liquidityMultiplier
      }
    }

    // Lucky-digit (7, 8, 9) penalty: public loves these → house avoids them
    const luckyPenalty = countLuckyDigits(panel) * 15 * volMultiplier * temporalMultiplier * liquidityMultiplier

    // Triple penalty: occurs at 0.23% vs expected 4.5% → near-zero probability
    const panelIsTriple = isTriple(panel)
    const triplePenalty = panelIsTriple
      ? 50 * volMultiplier * temporalMultiplier * liquidityMultiplier
      : 0

    // Sutta saturation penalty
    const panelSutta = calculateSutta(panel)
    const saturationPenalty = saturatedSuttas.includes(String(panelSutta)) ? 30 : 0

    // Final weighted score (normalised to 0-100 range)
    const rawScore =
      freqScore * 0.4 -
      seqPenalty * 0.2 -
      luckyPenalty * 0.15 -
      triplePenalty * 0.15 -
      saturationPenalty

    const finalScore = Math.max(0, Math.min(100, rawScore + 20))

    topPicks.push({
      panel,
      sutta: panelSutta,
      score: Math.round(finalScore * 100) / 100,
      isHoneyPotPick: honeyPotAlert && panelIsSeq,
      isSequential: panelIsSeq,
      isTriple: panelIsTriple,
      breakdown: {
        baseFreqScore: Math.round(freqScore * 0.4 * 100) / 100,
        seqPenalty: Math.round(seqPenalty * 0.2 * 100) / 100,
        luckyPenalty: Math.round(luckyPenalty * 0.15 * 100) / 100,
        triplePenalty: Math.round(triplePenalty * 0.15 * 100) / 100,
        saturationPenalty,
      },
    })
  }

  // Sort by score descending
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
    topPicks: topPicks.slice(0, 30), // Return top 30 picks for UI
    totalRecordsAnalysed: records.length,
    stats,
  }
}
