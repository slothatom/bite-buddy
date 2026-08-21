import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import type { Portion, PortionStorage } from '../types'

/**
 * What is already cooked and waiting to be eaten.
 *
 * The dietician's plans are built on cooking once and eating three times, and
 * the app had no way to say so. A batch was a meal you retyped on each of the
 * days it covered, and the shopping list bought its ingredients again every
 * time, so the one habit the plans are organised around was the one the app
 * made harder.
 *
 * Two things live here and they are the same thing: a batch you cooked on
 * purpose, and what was left over from dinner. They differ only in how they
 * read, so they differ only in a label.
 *
 * This is deliberately not an inventory. Nobody weighs what they took out of
 * the tub, and an app that insisted would be wrong within a day and annoying
 * within two. `servings` is a count you can always overrule, it is allowed to
 * be wrong, and nothing anywhere refuses to work because it disagrees with the
 * fridge.
 */
interface PortionStore {
  portions: Portion[]

  addPortion: (portion: Portion) => void
  updatePortion: (id: string, updates: Partial<Portion>) => void
  removePortion: (id: string) => void
  /**
   * Takes `servings` out of a portion, never below zero.
   *
   * Returns what was actually taken, which can be less than asked for when the
   * tub turns out to be emptier than the app thought. The caller decides what
   * to do about that; planning a meal goes ahead either way, because you are
   * describing something you are going to eat, not filing a stock movement.
   */
  takeFrom: (id: string, servings: number) => number
  /** Puts servings back, for a meal you planned from the fridge and then did not eat. */
  returnTo: (id: string, servings: number) => void
}

export const usePortionStore = create<PortionStore>()(
  persist(
    (set, get) => ({
      portions: [],

      addPortion: (portion) =>
        set((s) => ({ portions: [...s.portions, portion].sort(byMadeOn) })),

      updatePortion: (id, updates) =>
        set((s) => ({
          portions: s.portions.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      removePortion: (id) =>
        set((s) => ({ portions: s.portions.filter((p) => p.id !== id) })),

      takeFrom: (id, servings) => {
        const portion = get().portions.find((p) => p.id === id)
        if (!portion) return 0
        const taken = Math.min(portion.servings, Math.max(0, servings))
        set((s) => ({
          portions: s.portions.map((p) =>
            (p.id === id ? { ...p, servings: round(p.servings - taken) } : p)),
        }))
        return taken
      },

      returnTo: (id, servings) =>
        set((s) => ({
          portions: s.portions.map((p) =>
            (p.id === id ? { ...p, servings: round(p.servings + Math.max(0, servings)) } : p)),
        })),
    }),
    {
      name: 'bite-buddy-portions',
      version: SCHEMA_VERSION,
      storage: safeStorage<PortionStore>(),
      migrate: upgradeThrough<PortionStore>(SCHEMA_VERSION, {
        // Nothing to bring forward: this store did not exist at either version.
        1: (state) => state,
        2: (state) => state,
      }),
      partialize: (s) => ({ portions: s.portions }) as PortionStore,
    },
  ),
)

/** Halves and thirds are real, so this keeps one decimal rather than rounding to tubs. */
function round(n: number): number {
  return Math.max(0, Math.round(n * 10) / 10)
}

const byMadeOn = (a: Portion, b: Portion) => a.madeOn.localeCompare(b.madeOn)

/**
 * What is actually available.
 *
 * An empty portion is kept rather than deleted, so that a plan already pointing
 * at it still resolves and still shows what you ate. It is simply not offered
 * again.
 *
 * The filtering deliberately happens outside the store selector. A selector
 * that builds an array returns a new one on every call, and zustand compares
 * what it gets back by identity, so the screen re-renders, re-selects, and
 * re-renders again until React gives up. It cost this feature its first run.
 */
export function useAvailablePortions(storage?: PortionStorage): Portion[] {
  const portions = usePortionStore((s) => s.portions)
  return useMemo(
    () => portions.filter((p) => p.servings > 0 && (!storage || p.storage === storage)),
    [portions, storage],
  )
}

/** Everything, including the empty ones, for anything that resolves an id. */
export function useAllPortions(): Portion[] {
  return usePortionStore((s) => s.portions)
}

/**
 * How old something is, in days.
 *
 * Used to sort what is offered and to say "cooked on Sunday" rather than to
 * decide anything. The app does not throw food away on your behalf.
 */
export function ageInDays(portion: Portion, today = new Date()): number {
  const made = new Date(portion.madeOn + 'T12:00:00')
  return Math.max(0, Math.round((today.getTime() - made.getTime()) / 86_400_000))
}
