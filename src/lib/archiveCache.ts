import type { PlanArchive } from '../data/archiveFormat'

/**
 * The plan archive, kept on this device between visits.
 *
 * IndexedDB rather than localStorage: the archive is close to a megabyte, and
 * localStorage is a few megabytes shared with every store this app persists.
 * One database, one object store, one record. Nothing else needs to be in it,
 * so there is no library: the whole of IndexedDB this app uses is below.
 *
 * Every function settles rather than throws. A browser without IndexedDB, a
 * private window that refuses it, a quota: in all of those the app carries on
 * and fetches the archive again next time, which is what it would have done
 * with no cache at all.
 */

const DB_NAME = 'bite-buddy-archive'
const STORE = 'archive'
const KEY = 'current'

export interface CachedArchive {
  /** The household it was downloaded for. Null for one loaded from a file on a local copy. */
  householdId: string | null
  /** When the database last changed it, to tell whether there is a newer one. */
  updatedAt: string | null
  data: PlanArchive
}

function available(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('blocked'))
  })
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(request.result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  }))
}

export async function readCachedArchive(): Promise<CachedArchive | null> {
  if (!available()) return null
  try {
    const value = await run<CachedArchive | undefined>('readonly', (s) => s.get(KEY))
    return value && typeof value === 'object' && 'data' in value ? value : null
  } catch {
    return null
  }
}

export async function writeCachedArchive(cached: CachedArchive): Promise<void> {
  if (!available()) return
  try {
    await run('readwrite', (s) => s.put(cached, KEY))
  } catch {
    // Not kept, so it is downloaded again next time. Nothing else changes.
  }
}

/** Forgets the archive on this device: on sign-out, so a shared phone keeps none of it. */
export async function clearCachedArchive(): Promise<void> {
  if (!available()) return
  try {
    await run('readwrite', (s) => s.delete(KEY))
  } catch {
    // Fall through to deleting the whole database, which works even when the
    // store is in a state a transaction cannot open.
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(DB_NAME)
      request.onsuccess = request.onerror = request.onblocked = () => resolve()
    })
  }
}
