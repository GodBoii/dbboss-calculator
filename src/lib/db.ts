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

/** Parse DD/MM/YYYY into a sortable number (YYYYMMDD). */
function dateToSortKey(dateStr: string): number {
  // Handle formats: "DD/MM/YYYY", "DD-MM-YYYY", "DD/MM/YY"
  const cleaned = dateStr.replace(/-/g, '/')
  const parts = cleaned.split('/')
  if (parts.length !== 3) return 0
  const day = parseInt(parts[0]) || 0
  const month = parseInt(parts[1]) || 0
  let year = parseInt(parts[2]) || 0
  if (year < 100) year += 2000
  return year * 10000 + month * 100 + day
}

/** Store an array of panel records (upserts by id). */
export async function saveRecords(records: PanelRecord[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const record of records) {
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
      resolve(records)
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
