import { getRecordISODate, type PanelRecord } from "./db"
import { buildCombinedAnalysis, type CombinedAnalysis } from "./combined-prediction"
import { buildJodis } from "./sutta-model/production"
import { ALL_PANELS, calculateSutta } from "./predictor/panel-utils"

export interface CombinedSuttaAccuracy {
  drawsTested: number
  startDate: string
  endDate: string
  open: { hits: number; accuracy: number; label: string }
  close: { hits: number; accuracy: number; label: string }
  adjustedClose: { hits: number; accuracy: number; label: string }
  jodi: { hits: number; accuracy: number; label: string }
  adjustedJodi: { hits: number; accuracy: number; label: string }
}

export function buildCombinedSuttaAccuracy(
  market: string, records: PanelRecord[], allMarkets: Record<string, PanelRecord[]>, count: number,
  knownCache = new Map<string, CombinedAnalysis>(),
): CombinedSuttaAccuracy | null {
  const legal = new Set(ALL_PANELS)
  const dated = records.map((record) => ({ record, date: getRecordISODate(record) }))
    .filter((row): row is { record: PanelRecord; date: string } => row.date !== null && legal.has(row.record.openPanel) && legal.has(row.record.closePanel))
    .sort((a, b) => a.date.localeCompare(b.date))
  const endDate = dated.at(-1)?.date
  if (!endDate) return null
  const startDate = new Date(Date.parse(`${endDate}T12:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10)
  const totals = { open: 0, close: 0, adjustedClose: 0, jodi: 0, adjustedJodi: 0 }
  const correct = { ...totals }
  const keys = ["open", "close", "adjustedClose", "jodi", "adjustedJodi"] as const
  for (const { record, date } of dated) {
    if (date < startDate) continue
    const prior = dated.filter((row) => row.date < date).map((row) => row.record)
    if (prior.length < 180) continue
    const priorMarkets = Object.fromEntries(Object.entries(allMarkets).map(([name, rows]) => [name, rows.filter((row) => { const iso = getRecordISODate(row); return iso !== null && iso < date })]))
    priorMarkets[market] = prior
    const target = new Date(`${date}T12:00:00+05:30`)
    const pre = buildCombinedAnalysis(market, prior, priorMarkets, target)
    const known = knownCache.get(date) ?? buildCombinedAnalysis(market, prior, priorMarkets, target, record.openSutta, record.openPanel)
    if (pre.status !== "ready" || known.status !== "ready") continue
    const op = pre.open.suttas.slice(0, count), cl = pre.close.suttas.slice(0, count), adj = known.close.suttas.slice(0, count)
    const actualOpen = calculateSutta(record.openPanel), actualClose = calculateSutta(record.closePanel)
    const actualJodi = `${actualOpen}${actualClose}`
    const observations = { open: op.some((p) => p.sutta === actualOpen), close: cl.some((p) => p.sutta === actualClose), adjustedClose: adj.some((p) => p.sutta === actualClose), jodi: buildJodis(op, cl).includes(actualJodi), adjustedJodi: buildJodis(op, adj).includes(actualJodi) }
    for (const key of keys) { totals[key]++; if (observations[key]) correct[key]++ }
  }
  const metric = (key: keyof typeof totals) => {
    const accuracy = totals[key] ? 100 * correct[key] / totals[key] : 0
    return { hits: correct[key], accuracy, label: `${accuracy.toFixed(1)}% (${correct[key]}/${totals[key]})` }
  }
  return totals.open ? { drawsTested: totals.open, startDate, endDate, open: metric("open"), close: metric("close"), adjustedClose: metric("adjustedClose"), jodi: metric("jodi"), adjustedJodi: metric("adjustedJodi") } : null
}
