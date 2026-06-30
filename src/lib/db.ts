/**
 * IndexedDB persistence layer for DBBoss Analysis.
 *
 * v2: Each record stores a COMPLETE draw — Open Panel, Jodi, Close Panel.
 *     Previous v1 data is auto-dropped on upgrade (user re-scrapes once).
 */

export interface PanelRecord {
  id: string // `${market}|${dateRangeStart}|${day}`
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
}

const DB_NAME = 'dbboss_v2'
const DB_VERSION = 1
const STORE_NAME = 'panels'
export const RECENT_HISTORY_DAYS = 730

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

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result)
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error)
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
  const cleaned = dateStr.replace(/-/g, '/')
  const parts = cleaned.split('/')
  if (parts.length !== 3) return null
  const day = parseInt(parts[0]) || 0
  const month = parseInt(parts[1]) || 0
  let year = parseInt(parts[2]) || 0
  if (year < 100) year += 2000
  if (!day || !month || !year) return null
  return new Date(Date.UTC(year, month - 1, day))
}

export function getRecordISODate(record: Pick<PanelRecord, 'dateRangeStart' | 'day'>): string | null {
  const start = parsePanelDate(record.dateRangeStart)
  if (!start) return null
  return toISODate(addDays(start, DAY_OFFSETS[record.day] ?? 0))
}

function cutoffISO(days: number, anchor = new Date()): string {
  const cutoff = new Date(anchor)
  cutoff.setUTCDate(cutoff.getUTCDate() - days + 1)
  return toISODate(cutoff)
}

export function filterRecordsByRecentHistory(records: PanelRecord[], days = RECENT_HISTORY_DAYS): PanelRecord[] {
  const dated = records
    .map((record) => ({ record, isoDate: getRecordISODate(record) }))
    .filter((item): item is { record: PanelRecord; isoDate: string } => Boolean(item.isoDate))

  if (dated.length === 0) return records

  const newestISO = dated.reduce((max, item) => item.isoDate > max ? item.isoDate : max, dated[0].isoDate)
  const anchor = new Date(`${newestISO}T00:00:00Z`)
  const minISO = cutoffISO(days, anchor)
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
  const recentRecords = filterRecordsByRecentHistory(records)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const record of recentRecords) {
      store.put(record)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = (e) => reject((e.target as IDBTransaction).error)
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
      resolve(filterRecordsByRecentHistory(records))
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
