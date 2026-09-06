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
import { useActivityStore } from './useActivityStore'
import { usePortionStore } from './usePortionStore'
import { usePantryStore } from './usePantryStore'

export interface PersistedStore {
  /** The store's persist key, also its key in a backup file and in the database. */
  name: string | undefined
  /**
   * What this holds, in the words somebody would use about their own data.
   *
   * A restore has to be able to say what it is about to replace, and
   * "bite-buddy-mealplan-v2" is not a sentence anyone can weigh a decision
   * against.
   */
  label: string
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
  /** Re-reads what is in storage, discarding this tab's copy. */
  rehydrate: () => void
}

function persisted<T extends object>(label: string, store: {
  getState: () => T
  setState: (partial: Partial<T>) => void
  subscribe: (fn: (state: T) => void) => () => void
  persist: {
    getOptions: () => {
      name?: string
      partialize?: (state: T) => unknown
      migrate?: (state: unknown, version: number) => unknown
    }
    rehydrate: () => Promise<void> | void
  }
}): PersistedStore {
  const { name, partialize, migrate } = store.persist.getOptions()
  return {
    name,
    label,
    read: () => (partialize ? partialize(store.getState()) : store.getState()),
    write: (state) => store.setState(state as Partial<T>),
    subscribe: (fn) => store.subscribe(() => fn()),
    upgrade: (state, fromVersion) => (migrate ? migrate(state, fromVersion) : state),
    rehydrate: () => { void store.persist.rehydrate() },
  }
}

export const STORES: PersistedStore[] = [
  persisted('your plan, weeks and shopping list', useMealPlanStore),
  persisted('your profile and targets', useUserStore),
  persisted('your recipes and favourites', useRecipeStore),
  persisted('your foods', useFoodStore),
  persisted('your weights and measurements', useBodyStore),
  persisted('your cooking sessions', useCookStore),
  persisted('your workouts', useActivityStore),
  persisted('what is in the fridge and freezer', usePortionStore),
  persisted('what is in the cupboard', usePantryStore),
]

export type StoreKey = string

/**
 * Keeps a second tab from overwriting the first.
 *
 * Every store writes its whole slice to localStorage on every change, and
 * nothing was listening for another tab doing the same. So two tabs each held
 * their own copy from whenever they loaded, and the next one to touch anything
 * wrote its stale whole slice over the other's work. A tab left open since the
 * morning would flatten an afternoon's shopping list, and it would look for
 * all the world like the app losing data by itself.
 *
 * The `storage` event fires only in the tabs that did not make the change,
 * which is exactly the set that needs to hear about it. A null key is the
 * whole of storage being cleared, so everything re-reads.
 *
 * This does not make two tabs safe to edit the same store at the same instant,
 * which would need a different shape of persistence entirely. It closes the
 * window from hours to milliseconds, which is the difference between a bug you
 * hit every week and one you have to try to cause.
 */
export function otherTabWrote(key: string | null): void {
  // A null key is the whole of storage being cleared, so everything re-reads.
  if (key === null) {
    for (const store of STORES) store.rehydrate()
    return
  }
  STORES.find((store) => store.name === key)?.rehydrate()
}

export function followOtherTabs(): () => void {
  const onStorage = (event: StorageEvent) => otherTabWrote(event.key)
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}
