import type { PersistStorage, StorageValue } from 'zustand/middleware'

/**
 * Persistence guardrails.
 *
 * All of this app's data lives in localStorage, which means three failure modes
 * that are silent by default:
 *
 *  1. **Storage is unavailable.** Safari private browsing and locked-down
 *     embedded webviews throw on write. Unhandled, that takes down the render.
 *  2. **Storage is full.** A large recipe library plus a year of plans can hit
 *     the ~5 MB quota. The write throws and the user's last change vanishes
 *     with no indication.
 *  3. **The stored shape is stale.** A model change turns old data into
 *     something the app misreads rather than rejects, which is worse than
 *     losing it.
 *
 * `SCHEMA_VERSION` addresses the third: bump it whenever a store's persisted
 * shape changes incompatibly, and old state is discarded rather than
 * misinterpreted.
 */

export const SCHEMA_VERSION = 1

/** Set when a write has failed, so the UI can tell the user their data isn't saving. */
let storageFailed: string | null = null

export function storageFailure(): string | null {
  return storageFailed
}

const listeners = new Set<(reason: string | null) => void>()

export function onStorageFailure(fn: (reason: string | null) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function reportFailure(reason: string) {
  if (storageFailed === reason) return
  storageFailed = reason
  for (const fn of listeners) fn(reason)
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

/**
 * A JSON storage that degrades instead of throwing.
 *
 * A failed read yields no stored state, so the store falls back to its
 * defaults. A failed write is recorded and surfaced once, rather than
 * propagating out of a `set()` call and unmounting the tree.
 */
export function safeStorage<T>(): PersistStorage<T | undefined> {
  return {
    getItem: (name): StorageValue<T | undefined> | null => {
      try {
        const raw = localStorage.getItem(name)
        return raw ? (JSON.parse(raw) as StorageValue<T>) : null
      } catch {
        // Corrupt JSON is not recoverable and not worth surfacing: the store
        // falls back to defaults, which is the same as a first run.
        return null
      }
    },

    setItem: (name, value) => {
      try {
        localStorage.setItem(name, JSON.stringify(value))
      } catch (e) {
        reportFailure(
          isQuotaError(e)
            ? 'Browser storage is full, so recent changes were not saved. Export your data and clear some space.'
            : 'This browser is blocking storage, so changes will not be saved between visits.',
        )
      }
    },

    removeItem: (name) => {
      try {
        localStorage.removeItem(name)
      } catch {
        // Nothing useful to do; the entry stays until storage recovers.
      }
    },
  }
}

/**
 * Discards persisted state written by an older, incompatible schema.
 *
 * Returning `undefined` makes zustand fall back to the store's initial state,
 * which is the honest outcome: better a clean slate than data read under the
 * wrong assumptions.
 */
export function discardOlderThan<T>(current: number) {
  return (persisted: unknown, version: number): T | undefined => {
    if (version === current) return persisted as T
    return undefined
  }
}
