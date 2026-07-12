import type { PanelRecord } from './db'
import {
  analyzeMarket,
  buildContextFromResult,
  computeJodiAnalysis,
  getPanelKind,
  getSuttaSignal,
  type PanelKindPrediction,
  type PanelPick,
} from './predictor'

export interface BacktestBucket {
  n: number
  panelTop3: number
  panelTop6: number
  panelTop10: number
  panelTop30: number
  suttaTop3: number
  suttaTop6: number
  suttaTop10: number
  suttaTop30: number
  kindCorrect: number
  actualDp: number
  dpPredicted: number
  dpCorrect: number
  actualDanger: number
  actualSnapback: number
  averageActualRank: number | null
}

export interface BacktestReport {
  market: string
  startDate: string
  endDate: string
  drawsTested: number
  randomTop30Baseline: number
  open: BacktestBucket
  close: BacktestBucket
  jodi: BacktestBucket
  jodiMovement: {
    better: number
    worse: number
    same: number
  }
}

interface MutableBucket extends Omit<BacktestBucket, 'averageActualRank'> {
  rankSum: number
  rankSeen: number
}

const DAY_OFFSETS: Record<string, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
}

function emptyBucket(): MutableBucket {
  return {
    n: 0,
    panelTop3: 0,
    panelTop6: 0,
    panelTop10: 0,
    panelTop30: 0,
    suttaTop3: 0,
    suttaTop6: 0,
    suttaTop10: 0,
    suttaTop30: 0,
    kindCorrect: 0,
    actualDp: 0,
    dpPredicted: 0,
    dpCorrect: 0,
    actualDanger: 0,
    actualSnapback: 0,
    rankSum: 0,
    rankSeen: 0,
  }
}

function finalizeBucket(bucket: MutableBucket): BacktestBucket {
  return {
    n: bucket.n,
    panelTop3: bucket.panelTop3,
    panelTop6: bucket.panelTop6,
    panelTop10: bucket.panelTop10,
    panelTop30: bucket.panelTop30,
    suttaTop3: bucket.suttaTop3,
    suttaTop6: bucket.suttaTop6,
    suttaTop10: bucket.suttaTop10,
    suttaTop30: bucket.suttaTop30,
    kindCorrect: bucket.kindCorrect,
    actualDp: bucket.actualDp,
    dpPredicted: bucket.dpPredicted,
    dpCorrect: bucket.dpCorrect,
    actualDanger: bucket.actualDanger,
    actualSnapback: bucket.actualSnapback,
    averageActualRank: bucket.rankSeen > 0 ? bucket.rankSum / bucket.rankSeen : null,
  }
}

function parseDate(dateStr: string): Date | null {
  const cleaned = dateStr.replace(/-/g, '/')
  const parts = cleaned.split('/').map((part) => parseInt(part, 10))
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null
  const [day, month, rawYear] = parts
  const year = rawYear < 100 ? rawYear + 2000 : rawYear
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function getRecordISODate(record: PanelRecord): string | null {
  const start = parseDate(record.dateRangeStart)
  if (!start) return null
  return toISODate(addDays(start, DAY_OFFSETS[record.day] ?? 0))
}

function evaluatePickSet(
  bucket: MutableBucket,
  picks: PanelPick[],
  actualPanel: string,
  actualSutta: number,
  actualDrought: number,
  kindPrediction?: PanelKindPrediction,
) {
  if (!actualPanel || actualSutta < 0) return

  bucket.n++
  const actualKind = getPanelKind(actualPanel)
  if (actualKind === 'DP') bucket.actualDp++
  if (kindPrediction?.predictedKind === 'DP') bucket.dpPredicted++
  if (kindPrediction?.predictedKind === 'DP' && actualKind === 'DP') bucket.dpCorrect++
  if (kindPrediction && kindPrediction.predictedKind === actualKind) {
    bucket.kindCorrect++
  }

  const rank = picks.findIndex((pick) => pick.panel === actualPanel) + 1
  if (rank > 0) {
    bucket.rankSum += rank
    bucket.rankSeen++
  }

  for (const [key, size] of [
    ['Top3', 3],
    ['Top6', 6],
    ['Top10', 10],
    ['Top30', 30],
  ] as const) {
    if (picks.slice(0, size).some((pick) => pick.panel === actualPanel)) {
      bucket[`panel${key}`]++
    }
    if (picks.slice(0, size).some((pick) => pick.sutta === actualSutta)) {
      bucket[`sutta${key}`]++
    }
  }

  const signal = getSuttaSignal(actualDrought)
  if (signal.state === 'danger') bucket.actualDanger++
  if (signal.state === 'snapback') bucket.actualSnapback++
}

export function runMarketBacktest(
  market: string,
  records: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  options: { days?: number; minTrainingRecords?: number } = {},
): BacktestReport | null {
  const days = options.days ?? 30
  const minTrainingRecords = options.minTrainingRecords ?? 50
  const datedRecords = records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item): item is { record: PanelRecord; isoDate: string } => Boolean(item.isoDate))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))

  if (datedRecords.length <= minTrainingRecords) return null

  const endDate = datedRecords[datedRecords.length - 1].isoDate
  const startDateObj = new Date(`${endDate}T00:00:00`)
  startDateObj.setDate(startDateObj.getDate() - days + 1)
  const startDate = toISODate(startDateObj)

  const open = emptyBucket()
  const close = emptyBucket()
  const jodi = emptyBucket()
  const jodiMovement = { better: 0, worse: 0, same: 0 }

  for (const { record, isoDate } of datedRecords) {
    if (isoDate < startDate || isoDate > endDate) continue

    const prior = datedRecords
      .filter((item) => item.isoDate < isoDate)
      .map((item) => item.record)
    if (prior.length < minTrainingRecords) continue

    const priorAllMarkets: Record<string, PanelRecord[]> = {}
    for (const [marketName, marketRecords] of Object.entries(allMarketsRecords)) {
      priorAllMarkets[marketName] = marketRecords.filter((marketRecord) => {
        const marketISODate = getRecordISODate(marketRecord)
        return marketISODate !== null && marketISODate < isoDate
      })
    }
    priorAllMarkets[market] = prior

    const prediction = analyzeMarket(market, prior, priorAllMarkets, new Date(`${isoDate}T12:00:00`))
    if (!prediction) continue

    evaluatePickSet(
      open,
      prediction.openPicks,
      record.openPanel,
      record.openSutta,
      prediction.combinedSuttaDroughts[String(record.openSutta)] ?? 1000,
      prediction.openKindPrediction,
    )
    evaluatePickSet(
      close,
      prediction.closePanelPicks,
      record.closePanel,
      record.closeSutta,
      prediction.closeSuttaDroughts[String(record.closeSutta)] ?? 1000,
      prediction.closeKindPrediction,
    )

    if (record.openSutta >= 0 && record.closePanel) {
      const jodiResult = computeJodiAnalysis(
        record.openSutta,
        record.openPanel || null,
        prior,
        buildContextFromResult(prediction),
        prediction.closeDpKindContext,
      )
      evaluatePickSet(
        jodi,
        jodiResult.adjustedClosePicks,
        record.closePanel,
        record.closeSutta,
        prediction.closeSuttaDroughts[String(record.closeSutta)] ?? 1000,
        jodiResult.kindPrediction,
      )

      const closeRank = prediction.closePicks.findIndex((pick) => pick.panel === record.closePanel) + 1
      const jodiRank = jodiResult.adjustedClosePicks.findIndex((pick) => pick.panel === record.closePanel) + 1
      if (closeRank > 0 && jodiRank > 0) {
        if (jodiRank < closeRank) jodiMovement.better++
        else if (jodiRank > closeRank) jodiMovement.worse++
        else jodiMovement.same++
      }
    }
  }

  const drawsTested = Math.max(open.n, close.n, jodi.n)
  if (drawsTested === 0) return null

  return {
    market,
    startDate,
    endDate,
    drawsTested,
    randomTop30Baseline: 30 / 220,
    open: finalizeBucket(open),
    close: finalizeBucket(close),
    jodi: finalizeBucket(jodi),
    jodiMovement,
  }
}

// ── 7-Day Sutta Backtest ────────────────────────────────────────────────────

export interface SuttaBacktest7dResult {
  drawsTested: number
  openSuttaHits: number
  closeSuttaHits: number
  jodiHits: number
  openSuttaAcc: number   // percentage 0-100
  closeSuttaAcc: number  // percentage 0-100
  jodiAcc: number        // percentage 0-100
}

interface CopySuttaPick {
  sutta: number
  [key: string]: unknown
}

type SuttaBuilder = (...args: unknown[]) => CopySuttaPick[]
type JodiBuilder = (open: CopySuttaPick[], close: CopySuttaPick[]) => string[]

/**
 * Runs a 7-day sutta-level backtest for a single market.
 *
 * Because the sutta-set builders live in the component layer (AnalysisTabs.tsx),
 * they are injected as callbacks to avoid coupling lib → component.
 */
export function runSuttaBacktest7d(
  market: string,
  records: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  builders: {
    buildOpenSuttaSet: SuttaBuilder
    buildCloseSuttaSet: SuttaBuilder
    buildJodis: JodiBuilder
  },
  options: { days?: number; suttaCount?: number } = {},
): SuttaBacktest7dResult | null {
  const days = options.days ?? 7
  const suttaCount = options.suttaCount ?? 6

  const datedRecords = records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item): item is { record: PanelRecord; isoDate: string } => Boolean(item.isoDate))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))

  if (datedRecords.length < 50) return null

  // Use calendar days, not the last N draws. Markets can be closed on some days.
  const endDate = datedRecords.at(-1)?.isoDate
  if (!endDate) return null
  const cutoff = new Date(`${endDate}T00:00:00Z`)
  cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(0, days - 1))
  const startDate = cutoff.toISOString().slice(0, 10)
  const testRows = datedRecords.filter((item) => item.isoDate >= startDate && item.isoDate <= endDate)

  let openSuttaHits = 0
  let closeSuttaHits = 0
  let jodiHits = 0
  let drawsTested = 0

  for (const { record, isoDate } of testRows) {
    const prior = datedRecords
      .filter((item) => item.isoDate < isoDate)
      .map((item) => item.record)

    if (prior.length < 50) continue

    const priorAllMarkets: Record<string, PanelRecord[]> = {}
    for (const [mkt, mktRecords] of Object.entries(allMarketsRecords)) {
      priorAllMarkets[mkt] = mktRecords.filter((mktRecord) => {
        const mktISODate = getRecordISODate(mktRecord)
        return mktISODate !== null && mktISODate < isoDate
      })
    }
    priorAllMarkets[market] = prior

    const targetDate = new Date(`${isoDate}T12:00:00`)
    const prediction = analyzeMarket(market, prior, priorAllMarkets, targetDate)
    if (!prediction) continue

    // Build top-N open suttas
    const openSuttas: CopySuttaPick[] = builders.buildOpenSuttaSet(
      prediction.openPicks,
      prediction.openSuttaDroughts,
      prior,
      suttaCount,
      market,
      targetDate,
      allMarketsRecords,
    )

    // Build the pre-result top-N close set used by the Signal Map.
    const closeSuttas: CopySuttaPick[] = builders.buildCloseSuttaSet(
      prediction.closePicks,
      prediction.closeSuttaDroughts,
      prior,
      suttaCount,
      market,
      null,
      allMarketsRecords,
      targetDate,
    )

    const openSuttaList = openSuttas.map((p) => p.sutta)
    const closeSuttaList = closeSuttas.map((p) => p.sutta)
    const predictedJodis = builders.buildJodis(openSuttas, closeSuttas)

    drawsTested++
    if (openSuttaList.includes(record.openSutta)) openSuttaHits++
    if (closeSuttaList.includes(record.closeSutta)) closeSuttaHits++
    if (predictedJodis.includes(record.jodi)) jodiHits++
  }

  if (drawsTested === 0) return null

  return {
    drawsTested,
    openSuttaHits,
    closeSuttaHits,
    jodiHits,
    openSuttaAcc: (openSuttaHits / drawsTested) * 100,
    closeSuttaAcc: (closeSuttaHits / drawsTested) * 100,
    jodiAcc: (jodiHits / drawsTested) * 100,
  }
}
