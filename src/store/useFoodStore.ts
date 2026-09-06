import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import type { Food } from '../types'
import { FOODS } from '../data'
import { planMerge, planUnmerge, foldedInto } from '../lib/mergeRecipes'

interface FoodStore {
  /** Foods the user added or edited. The curated list stays in code. */
  custom: Food[]
  /** Ids of curated foods the user has hidden. */
  hidden: string[]
  /**
   * Duplicates folded into the food that was kept.
   *
   * The same ingredient arrives more than once: once curated, once from USDA,
   * once from a barcode, and three yogurts with the same numbers are three
   * ways to get the same line wrong. Merging is a note saying which one is
   * real, never a deletion: your plans and recipes already name the others by
   * id, and every lookup follows the note. Undoing it puts them all back.
   */
  mergedInto: Record<string, string>

  addFood: (food: Food) => void
  updateFood: (id: string, updates: Partial<Food>) => void
  removeFood: (id: string) => void
  restoreFood: (id: string) => void
  /** Folds duplicates into `winnerId`. Nothing is deleted. */
  mergeFoods: (winnerId: string, loserIds: string[]) => void
  /** Puts everything folded into `winnerId` back. */
  unmergeFood: (winnerId: string) => void
  /** Throws away your edits to a curated food and brings the original back. */
  revertFood: (id: string) => void
}

/** True for the foods that ship with the app, as opposed to your own. */
export function isCuratedFood(id: string): boolean {
  return FOODS.some((f) => f.id === id)
}

export const useFoodStore = create<FoodStore>()(
  persist(
    (set) => ({
      custom: [],
      hidden: [],
      mergedInto: {},

      addFood: (food) => set((s) => ({ custom: [...s.custom, food] })),

      updateFood: (id, updates) =>
        set((s) => {
          const existing = s.custom.find((f) => f.id === id)
          if (existing) {
            return { custom: s.custom.map((f) => (f.id === id ? { ...f, ...updates } : f)) }
          }
          // Editing a curated food forks it into the user's own list.
          const base = FOODS.find((f) => f.id === id)
          if (!base) return {}
          return { custom: [...s.custom, { ...base, ...updates, source: 'custom' as const }] }
        }),

      /**
       * Deleting a food takes it out of the library without destroying it.
       *
       * Same reason as recipes, and it bites harder here: a food is named by
       * every recipe that uses it *and* directly by the snack lines in your
       * plan, "150 g apple, 10 g cashews" is two food references, not a recipe.
       * Dropping the food would blank all of them at once. It goes on the hidden
       * list instead: gone from the library, from search and from every picker,
       * still resolvable by anything that already refers to it.
       */
      removeFood: (id) =>
        set((s) => ({ hidden: [...new Set([...s.hidden, id])] })),

      restoreFood: (id) => set((s) => ({ hidden: s.hidden.filter((h) => h !== id) })),

      mergeFoods: (winnerId, loserIds) =>
        set((s) => ({ mergedInto: planMerge(s.mergedInto, winnerId, loserIds) })),

      unmergeFood: (winnerId) =>
        set((s) => ({ mergedInto: planUnmerge(s.mergedInto, winnerId) })),

      revertFood: (id) =>
        set((s) => ({
          // For a curated food this throws away your edits; for one of your own
          // there is nothing underneath, so it only un-deletes.
          custom: isCuratedFood(id) ? s.custom.filter((f) => f.id !== id) : s.custom,
          hidden: s.hidden.filter((h) => h !== id),
        })),
    }),
    {
      name: 'bite-buddy-foods-v2',
      version: SCHEMA_VERSION,
      storage: safeStorage<FoodStore>(),
      migrate: upgradeThrough<FoodStore>(SCHEMA_VERSION, {
        // v1 → v2: this store's shape did not change. Only the meal plan gained
        // a field, and discarding everything else over that would cost the user
        // their foods, recipes and logs for nothing.
        1: (state) => state,
        // v2 → v3: XP left the user profile; nothing here changed either.
        2: (state) => state,
        // v3 → v4: the two numbered snack slots became one. Nothing in this
        // store holds a slot, so there is nothing to bring forward.
        3: (state) => state,
      }),
    },
  ),
)

/** The library as it stands, with your edits applied. Deleted ones included. */
export function foodLibraryWith(custom: Food[]): Food[] {
  const overridden = new Set(custom.map((f) => f.id))
  return [...FOODS.filter((f) => !overridden.has(f.id)), ...custom]
}

/**
 * What you can browse. Exported so nothing reimplements the rule, a second
 * copy of it is a copy that drifts the moment the rule changes.
 */
export function visibleFoods(state: Pick<FoodStore, 'custom' | 'hidden' | 'mergedInto'>): Food[] {
  const hiddenSet = new Set(state.hidden)
  return foodLibraryWith(state.custom)
    .filter((f) => !hiddenSet.has(f.id) && !(f.id in state.mergedInto))
}

/**
 * The effective food list: curated foods, with user edits taking precedence and
 * deleted entries removed.
 */
export function useFoods(): Food[] {
  // Memoised on the two arrays it derives from. Without this the result is a
  // new array on every render, which defeats every useMemo downstream that
  // takes it as a dependency, including the nutrition context, which was
  // being rebuilt on every render despite a comment saying otherwise.
  const custom = useFoodStore((s) => s.custom)
  const hidden = useFoodStore((s) => s.hidden)
  const mergedInto = useFoodStore((s) => s.mergedInto)

  return useMemo(() => visibleFoods({ custom, hidden, mergedInto }), [custom, hidden, mergedInto])
}

/**
 * Everything a saved plan or a recipe might still name, deleted foods included.
 * This is what the nutrition context is built from.
 */
export function useResolvableFoods(): Food[] {
  const custom = useFoodStore((s) => s.custom)
  return useMemo(() => foodLibraryWith(custom), [custom])
}

/** Everything folded into this food, what undoing the merge would bring back. */
export function useFoodsMergedInto(winnerId: string): string[] {
  const mergedInto = useFoodStore((s) => s.mergedInto)
  return useMemo(() => foldedInto(mergedInto, winnerId), [mergedInto, winnerId])
}

/** The foods you deleted, for offering them back. */
export function useDeletedFoods(): Food[] {
  const custom = useFoodStore((s) => s.custom)
  const hidden = useFoodStore((s) => s.hidden)
  return useMemo(() => {
    const hiddenSet = new Set(hidden)
    return foodLibraryWith(custom).filter((f) => hiddenSet.has(f.id))
  }, [custom, hidden])
}
