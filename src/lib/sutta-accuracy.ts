import { getRecordISODate, type PanelRecord } from './db'
import { analyzeMarket, computeJodiAnalysis, buildContextFromResult } from './predictor'
import { buildOpenSuttaSet, buildCloseSuttaSet, buildJodis } from './sutta-model'

export type SuttaAccuracyReport = {
  drawsTested: number
  startDate: string
  endDate: string
  open: { hits: number; accuracy: number; label: string }
  close: { hits: number; accuracy: number; label: string }
  adjustedClose: { hits: number; accuracy: number; label: string }
  jodi: { hits: number; accuracy: number; label: string }
  adjustedJodi: { hits: number; accuracy: number; label: string }
}

function buildPriorMarkets(
  marketName: string,
  priorRecords: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  isoDate: string,
): Record<string, PanelRecord[]> {
  const priorMarkets: Record<string, PanelRecord[]> = {}

  Object.entries(allMarketsRecords).forEach(([name, marketRecords]) => {
    priorMarkets[name] = marketRecords.filter((record) => {
      const recordISO = getRecordISODate(record)
      return recordISO !== null && recordISO < isoDate
    })
  })

  priorMarkets[marketName] = priorRecords
  return priorMarkets
}

function buildEventAwareSuttaMarkets(
  marketName: string,
  priorRecords: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  isoDate: string,
): Record<string, PanelRecord[]> {
  const eventAwareMarkets: Record<string, PanelRecord[]> = {}

  Object.entries(allMarketsRecords).forEach(([name, marketRecords]) => {
    eventAwareMarkets[name] = name === marketName
      ? priorRecords
      : marketRecords.filter((record) => {
        const recordISO = getRecordISODate(record)
        return recordISO !== null && recordISO <= isoDate
      })
  })

  eventAwareMarkets[marketName] = priorRecords
  return eventAwareMarkets
}

function accuracyMetric(correct: number, total: number) {
  const accuracy = total ? (correct / total) * 100 : 0
  return {
    hits: correct,
    accuracy,
    label: `${accuracy.toFixed(1)}% (${correct}/${total})`,
  }
}

export function buildSuttaAccuracyReport(
  marketName: string,
  records: PanelRecord[],
  allMarketsRecords: Record<string, PanelRecord[]>,
  copyCount: number,
): SuttaAccuracyReport | null {
  const datedRecords = records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item): item is { record: PanelRecord; isoDate: string } => Boolean(item.isoDate))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))

  if (datedRecords.length <= 50) return null

  const endDate = datedRecords.at(-1)?.isoDate
  if (!endDate) return null
  const startDateValue = new Date(`${endDate}T00:00:00Z`)
  startDateValue.setUTCDate(startDateValue.getUTCDate() - 6)
  const startDate = startDateValue.toISOString().slice(0, 10)
  const testRecords = datedRecords.filter((item) => item.isoDate >= startDate && item.isoDate <= endDate)
  const totals = { open: 0, close: 0, adjustedClose: 0, jodi: 0, adjustedJodi: 0 }
  const correct = { open: 0, close: 0, adjustedClose: 0, jodi: 0, adjustedJodi: 0 }
  let drawsTested = 0

  for (const { record, isoDate } of testRecords) {
    const priorRecords = datedRecords
      .filter((item) => item.isoDate < isoDate)
      .map((item) => item.record)

    if (priorRecords.length < 50) continue

    const targetDate = new Date(`${isoDate}T12:00:00+05:30`)
    const priorMarkets = buildPriorMarkets(marketName, priorRecords, allMarketsRecords, isoDate)
    const eventAwareSuttaMarkets = buildEventAwareSuttaMarkets(marketName, priorRecords, allMarketsRecords, isoDate)
    const prediction = analyzeMarket(marketName, priorRecords, priorMarkets, targetDate)
    if (!prediction) continue
    drawsTested++

    const openSuttas = buildOpenSuttaSet(
      prediction.openPicks,
      prediction.openSuttaDroughts,
      priorRecords,
      copyCount,
      marketName,
      targetDate,
      eventAwareSuttaMarkets,
    )
    const closeSuttas = buildCloseSuttaSet(
      prediction.closePicks,
      prediction.closeSuttaDroughts,
      priorRecords,
      copyCount,
      marketName,
      null,
      eventAwareSuttaMarkets,
      targetDate,
    )

    if (record.openPanel && record.openSutta >= 0) {
      totals.open++
      if (openSuttas.some((item) => item.sutta === record.openSutta)) correct.open++
    }

    if (record.closePanel && record.closeSutta >= 0) {
      totals.close++
      if (closeSuttas.some((item) => item.sutta === record.closeSutta)) correct.close++

      if (record.openSutta >= 0) {
        const jodiAnalysis = computeJodiAnalysis(
          record.openSutta,
          record.openPanel || null,
          priorRecords,
          buildContextFromResult(prediction),
          prediction.closeDpKindContext,
        )
        const jodiAdjustedCloseSuttas = buildCloseSuttaSet(
          jodiAnalysis.adjustedClosePicks,
          prediction.closeSuttaDroughts,
          priorRecords,
          copyCount,
          marketName,
          record.openSutta,
          eventAwareSuttaMarkets,
          targetDate,
        )

        totals.adjustedClose++
        if (jodiAdjustedCloseSuttas.some((item) => item.sutta === record.closeSutta)) {
          correct.adjustedClose++
        }
        totals.adjustedJodi++
        if (buildJodis(openSuttas, jodiAdjustedCloseSuttas).includes(record.jodi)) correct.adjustedJodi++
      }
    }

    if (record.jodi) {
      totals.jodi++
      if (buildJodis(openSuttas, closeSuttas).includes(record.jodi)) correct.jodi++
    }
  }

  return {
    drawsTested,
    startDate,
    endDate,
    open: accuracyMetric(correct.open, totals.open),
    close: accuracyMetric(correct.close, totals.close),
    adjustedClose: accuracyMetric(correct.adjustedClose, totals.adjustedClose),
    jodi: accuracyMetric(correct.jodi, totals.jodi),
    adjustedJodi: accuracyMetric(correct.adjustedJodi, totals.adjustedJodi),
  }
}

