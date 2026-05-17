/**
 * IndexedDB persistence layer for DBBoss Analysis.
 *
 * Architecture rationale:
 * - Data is stored entirely on the USER'S device (no server database needed).
 * - Survives page refreshes; user does not need to re-scrape every visit.
 * - On Vercel free tier this means ZERO database costs.
 * - The DB is lazy-initialised on first use.
 */

export interface PanelRecord {
  // Composite key
  id: string // `${market}|${dateRangeStart}|${day}`
  market: string
  dateRangeStart: string
  dateRangeEnd: string
  day: string
  panel: string
  sutta: number
  d1: number
  d2: number
  d3: number
  savedAt: number // epoch ms
}

const DB_NAME = 'dbboss_v1'
const DB_VERSION = 1
const STORE_NAME = 'panels'

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('market', 'market', { unique: false })
        store.createIndex('savedAt', 'savedAt', { unique: false })
      }
    }

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result)
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error)
  })

  return dbPromise
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
    request.onsuccess = () => resolve(request.result as PanelRecord[])
    request.onerror = (e) => reject((e.target as IDBRequest).error)
  })
}

/** How many records do we have for this market? Used to decide if we need to (re)scrape. */
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
