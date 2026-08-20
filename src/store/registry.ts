/**
 * Every persisted store, reduced to the three operations that anything
 * treating "all the user's data" as one thing needs: read it, write it, and be
 * told when it changes.
 *
 * This exists because the stores hold six different shapes. Put in one list
 * without this, every call site fights a union of six incompatible `setState`
 * signatures. Backup and sync both work off it, so adding a store means adding
 * it here and nowhere else.
 */
import { useMealPlanStore } from './useMealPlanStore'
import { useUserStore } from './useUserStore'
import { useRecipeStore } from './useRecipeStore'
import { useFoodStore } from './useFoodStore'
import { useBodyStore } from './useBodyStore'
import { useCookStore } from './useCookStore'

export interface PersistedStore {
  /** The store's persist key — also its key in a backup file and in the database. */
  name: string | undefined
  read: () => unknown
  write: (state: object) => void
  subscribe: (fn: () => void) => () => void
  /**
   * Brings state written by an older version forward, or returns undefined if
   * it cannot. This is the store's own persistence migration, reused: a backup
   * file and a localStorage entry are the same shape, so an old backup should
   * restore for exactly the same reason an old device keeps its data.
   */
  upgrade: (state: unknown, fromVersion: number) => unknown
}

function persisted<T extends object>(store: {
  getState: () => T
  setState: (partial: Partial<T>) => void
  subscribe: (fn: (state: T) => void) => () => void
  persist: {
    getOptions: () => {
      name?: string
      partialize?: (state: T) => unknown
      migrate?: (state: unknown, version: number) => unknown
    }
  }
}): PersistedStore {
  const { name, partialize, migrate } = store.persist.getOptions()
  return {
    name,
    read: () => (partialize ? partialize(store.getState()) : store.getState()),
    write: (state) => store.setState(state as Partial<T>),
    subscribe: (fn) => store.subscribe(() => fn()),
    upgrade: (state, fromVersion) => (migrate ? migrate(state, fromVersion) : state),
  }
}

export const STORES: PersistedStore[] = [
  persisted(useMealPlanStore), persisted(useUserStore), persisted(useRecipeStore),
  persisted(useFoodStore), persisted(useBodyStore), persisted(useCookStore),
]

export type StoreKey = string
