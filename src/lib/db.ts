import {
  HISTORICAL_LOOKBACK_MONTHS,
  historicalCutoffISO,
} from './prediction-contract'

/**
 * IndexedDB persistence layer for DBBoss Analysis.
 *
 * v2: Each record stores a COMPLETE draw — Open Panel, Jodi, Close Panel.
 *     Previous v1 data is auto-dropped on upgrade (user re-scrapes once).
 */

export interface PanelRecord {
  id: string // `${market}|${ISO calendar date}`; legacy ids are normalized on read.
  market: string
  dateRangeStart: string
  dateRangeEnd: string
  day: string
  openPanel: string
  openSutta: number
  jodi: string
  closePanel: string
  closeSutta: number
  savedAt: number // epoch ms
  sourceJodi?: string // Retain a contradictory source value for diagnosis.
}

const DB_NAME = 'dbboss_v2'
const DB_VERSION = 1
const STORE_NAME = 'panels'

/** @deprecated Prefer HISTORICAL_LOOKBACK_MONTHS; retained for API compatibility. */
export const RECENT_HISTORY_DAYS = 853
export { HISTORICAL_LOOKBACK_MONTHS }

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME)
      }
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      store.createIndex('market', 'market', { unique: false })
      store.createIndex('savedAt', 'savedAt', { unique: false })
    }

    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); dbPromise = null }
      resolve(db)
    }
    request.onerror = () => { dbPromise = null; reject(request.error) }
    request.onblocked = () => { dbPromise = null; reject(new Error('Close other app tabs and retry opening saved history.')) }
  })

  return dbPromise
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

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Parse DD/MM/YYYY into a UTC date. */
export function parsePanelDate(dateStr: string): Date | null {
  // Handle formats: "DD/MM/YYYY", "DD-MM-YYYY", "DD/MM/YY"
  const match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(dateStr)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  let year = Number(match[3])
  if (year < 100) year += 2000
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null
}

export function getRecordISODate(record: Pick<PanelRecord, 'dateRangeStart' | 'day'>): string | null {
  const start = parsePanelDate(record.dateRangeStart)
  if (!start || !Object.hasOwn(DAY_OFFSETS, record.day)) return null
  return toISODate(addDays(start, DAY_OFFSETS[record.day]))
}

export class HistoryValidationError extends Error {
  constructor(public readonly market: string, message: string) { super(message); this.name = 'HistoryValidationError' }
}

/** Validate network/storage data, merge agreeing partials, and reject ambiguity. */
export function normalizeRecords(input: unknown, market: string, fetchedAt?: number): PanelRecord[] {
  const fail = (reason: string): never => { throw new HistoryValidationError(market, reason) }
  if (!Array.isArray(input)) return fail(`Invalid ${market} history response.`)
  const byDate = new Map<string, PanelRecord>()
  const legal = (panel: string) => /^\d{3}$/.test(panel) && [...panel].every((d,i,a) => i === 0 || (Number(a[i-1]) || 10) <= (Number(d) || 10))
  const sum = (panel: string) => panel ? [...panel].reduce((n,d) => n + Number(d),0) % 10 : -1
  for (const row of input) {
    if (!row || typeof row !== 'object' || row.market !== market) return fail(`Invalid market in ${market} history.`)
    if (typeof row.dateRangeStart !== 'string' || typeof row.day !== 'string' || typeof row.openPanel !== 'string' || typeof row.closePanel !== 'string') return fail(`Malformed ${market} history row.`)
    const iso = getRecordISODate(row)
    if (!iso) return fail(`Invalid ${market} history date or weekday.`)
    if ((!row.openPanel && !row.closePanel) || (row.openPanel && !legal(row.openPanel)) || (row.closePanel && !legal(row.closePanel))) return fail(`Invalid ${market} panel on ${iso}.`)
    const previous = byDate.get(iso)
    if (previous && ((previous.openPanel && row.openPanel && previous.openPanel !== row.openPanel) || (previous.closePanel && row.closePanel && previous.closePanel !== row.closePanel))) return fail(`Conflicting ${market} history on ${iso}`)
    const openPanel = row.openPanel || previous?.openPanel || ''
    const closePanel = row.closePanel || previous?.closePanel || ''
    const openSutta = sum(openPanel), closeSutta = sum(closePanel)
    const jodi = openPanel && closePanel ? `${openSutta}${closeSutta}` : ''
    const savedAt = fetchedAt ?? row.savedAt
    if (!Number.isFinite(savedAt) || savedAt < 0) return fail(`Invalid ${market} history timestamp.`)
    const sourceJodi = typeof row.sourceJodi === 'string' ? row.sourceJodi
      : typeof row.jodi === 'string' && row.jodi && row.jodi !== jodi ? row.jodi : previous?.sourceJodi
    const record: PanelRecord = {id:`${market}|${iso}`,market,dateRangeStart:row.dateRangeStart,
      dateRangeEnd:typeof row.dateRangeEnd === 'string' ? row.dateRangeEnd : row.dateRangeStart,
      day:row.day,openPanel,closePanel,openSutta,closeSutta,jodi,savedAt}
    if (sourceJodi) record.sourceJodi = sourceJodi
    byDate.set(iso, record)
  }
  return [...byDate.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([,row]) => row)
}

/** Validate the whole response before opening the atomic replacement transaction. */
export async function replaceHistorySnapshot(histories: Record<string, PanelRecord[]>): Promise<void> {
  const normalized = Object.entries(histories).map(([market,rows]) => {
    const records = filterRecordsByRecentHistory(normalizeRecords(rows, market))
    if (records.length === 0) throw new HistoryValidationError(market, `No ${market} history was returned. Saved data was kept.`)
    return [market,records] as const
  })
  const db = await openDB()
  return new Promise((resolve,reject) => {
    const tx = db.transaction(STORE_NAME,'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const [market,rows] of normalized) {
      const request = store.index('market').openCursor(IDBKeyRange.only(market))
      request.onsuccess = () => {
        try {
          const cursor = request.result
          if (cursor) { cursor.delete(); cursor.continue() }
          else for (const record of rows) store.put(record)
        } catch (error) { tx.abort(); reject(error) }
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('History replacement failed. Previous data was kept.'))
  })
}

export function filterRecordsByRecentHistory(
  records: PanelRecord[],
  months = HISTORICAL_LOOKBACK_MONTHS,
): PanelRecord[] {
  const dated = records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item): item is { record: PanelRecord; isoDate: string } => Boolean(item.isoDate))

  if (dated.length === 0) return records

  const newestISO = dated.reduce((max, item) => item.isoDate > max ? item.isoDate : max, dated[0].isoDate)
  const minISO = historicalCutoffISO(newestISO, months)
  return dated
    .filter((item) => item.isoDate >= minISO)
    .map((item) => item.record)
}

/** Parse DD/MM/YYYY into a sortable number (YYYYMMDD). */
function dateToSortKey(dateStr: string): number {
  const date = parsePanelDate(dateStr)
  if (!date) return 0
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate()
}

/** Store an array of panel records (upserts by id). */
export async function saveRecords(records: PanelRecord[]): Promise<void> {
  const db = await openDB()
  const markets = [...new Set(records.map(row => row.market))]
  const recentRecords = markets.flatMap(market => filterRecordsByRecentHistory(normalizeRecords(records.filter(row => row.market === market), market)))
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    try { for (const record of recentRecords) store.put(record) }
    catch (error) { tx.abort(); reject(error) }
    tx.oncomplete = () => resolve()
    tx.onerror = (e) => reject((e.target as IDBTransaction).error)
    tx.onabort = () => reject(tx.error ?? new Error('History write was aborted.'))
  })
}

/** Retrieve all records for a given market, sorted chronologically (oldest first). */
export async function getRecordsByMarket(market: string): Promise<PanelRecord[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('market')
    const request = index.getAll(IDBKeyRange.only(market))
    request.onsuccess = () => {
      const records = request.result as PanelRecord[]
      // Sort chronologically by date then by day-of-week order
      const dayOrder: Record<string, number> = {
        Monday: 0, Tuesday: 1, Wednesday: 2, Thursday: 3,
        Friday: 4, Saturday: 5, Sunday: 6,
      }
      records.sort((a, b) => {
        const dateA = dateToSortKey(a.dateRangeStart)
        const dateB = dateToSortKey(b.dateRangeStart)
        if (dateA !== dateB) return dateA - dateB
        return (dayOrder[a.day] ?? 9) - (dayOrder[b.day] ?? 9)
      })
      try { resolve(filterRecordsByRecentHistory(normalizeRecords(records, market))) }
      catch (error) { reject(error) }
    }
    request.onerror = (e) => reject((e.target as IDBRequest).error)
  })
}

/** How many records do we have for this market? */
export async function getRecordCount(market: string): Promise<number> {
  const records = await getRecordsByMarket(market)
  return records.length
}

/** Delete all records for a market (force re-scrape). */
export async function clearMarket(market: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('market')
    const request = index.openCursor(IDBKeyRange.only(market))
    request.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = (e) => reject((e.target as IDBTransaction).error)
  })
}
