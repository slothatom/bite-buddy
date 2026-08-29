import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import { planMerge, planUnmerge, foldedInto } from '../lib/mergeRecipes'
import type { Recipe } from '../types'
import { ALL_RECIPES } from '../data'

interface RecipeStore {
  /** Recipes the user created or edited; the imported library stays in code. */
  custom: Recipe[]
  hidden: string[]
  favouriteIds: string[]
  /**
   * "This recipe is really that one", written as loser id → winner id.
   *
   * A merge hides nothing and deletes nothing: every lookup resolves through
   * this map, so a day you already planned, or one of the fourteen archived
   * weeks, which live in code and cannot be rewritten, still finds a recipe.
   */
  mergedInto: Record<string, string>

  addRecipe: (recipe: Recipe) => void
  updateRecipe: (id: string, updates: Partial<Recipe>) => void
  removeRecipe: (id: string) => void
  /** Throws away your edits to a built-in recipe and brings the original back. */
  revertRecipe: (id: string) => void
  toggleFavourite: (id: string) => void

  /** Folds `loserIds` into `winnerId`. Reversible, and loses no references. */
  mergeRecipes: (winnerId: string, loserIds: string[]) => void
  /** Brings back everything that was merged into `winnerId`. */
  unmergeRecipe: (winnerId: string) => void
  /** Puts a deleted recipe back in the library, edits and all. */
  restoreRecipe: (id: string) => void
}

/** True for the 228 recipes that ship with the app, as opposed to your own. */
export function isBuiltIn(id: string): boolean {
  return ALL_RECIPES.some((r) => r.id === id)
}

export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set) => ({
      custom: [],
      hidden: [],
      favouriteIds: [],
      mergedInto: {},

      addRecipe: (recipe) => set((s) => ({ custom: [...s.custom, recipe] })),

      updateRecipe: (id, updates) =>
        set((s) => {
          const existing = s.custom.find((r) => r.id === id)
          if (existing) {
            return { custom: s.custom.map((r) => (r.id === id ? { ...r, ...updates } : r)) }
          }
          const base = ALL_RECIPES.find((r) => r.id === id)
          if (!base) return {}
          return { custom: [...s.custom, { ...base, ...updates }] }
        }),

      /**
       * Deleting takes a recipe out of the library without destroying it.
       *
       * Nothing is dropped, and that is deliberate. A recipe you deleted may
       * still be named by a day you planned in March, and the plan stores an id
       * rather than a copy, so throwing the recipe away turned that day's
       * dinner into a blank worth zero calories, quietly rewriting your own
       * history. It goes on the hidden list instead: gone from every list,
       * search, picker and filter, still resolvable by anything that already
       * refers to it, and restorable.
       *
       * The favourite goes, because a star you cannot see is a star you cannot
       * clear. Ingredients are untouched, other recipes use them.
       */
      removeRecipe: (id) =>
        set((s) => ({
          hidden: [...new Set([...s.hidden, id])],
          favouriteIds: s.favouriteIds.filter((f) => f !== id),
        })),

      revertRecipe: (id) =>
        set((s) => ({
          // For a built-in this throws away your edits; for a recipe of your
          // own there is nothing underneath, so it only un-deletes.
          custom: isBuiltIn(id) ? s.custom.filter((r) => r.id !== id) : s.custom,
          hidden: s.hidden.filter((h) => h !== id),
        })),

      restoreRecipe: (id) => set((s) => ({ hidden: s.hidden.filter((h) => h !== id) })),

      toggleFavourite: (id) =>
        set((s) => ({
          favouriteIds: s.favouriteIds.includes(id)
            ? s.favouriteIds.filter((f) => f !== id)
            : [...s.favouriteIds, id],
        })),

      mergeRecipes: (winnerId, loserIds) =>
        set((s) => {
          const mergedInto = planMerge(s.mergedInto, winnerId, loserIds)
          const folded = new Set(Object.keys(mergedInto))

          // A star on a version that is no longer shown would be a favourite you
          // cannot see or clear, so it moves to the one that survived.
          const hadStar = s.favouriteIds.some((id) => folded.has(id) || id === winnerId)
          const favouriteIds = s.favouriteIds.filter((id) => !folded.has(id))

          return {
            mergedInto,
            favouriteIds: hadStar && !favouriteIds.includes(winnerId)
              ? [...favouriteIds, winnerId]
              : favouriteIds,
          }
        }),

      unmergeRecipe: (winnerId) =>
        set((s) => ({ mergedInto: planUnmerge(s.mergedInto, winnerId) })),
    }),
    {
      name: 'bite-buddy-recipes-v2',
      version: SCHEMA_VERSION,
      storage: safeStorage<RecipeStore>(),
      migrate: upgradeThrough<RecipeStore>(SCHEMA_VERSION, {
        // v1 → v2: this store's shape did not change. Only the meal plan gained
        // a field, and discarding everything else over that would cost the user
        // their foods, recipes and logs for nothing.
        1: (state) => state,
        // v2 → v3: XP left the user profile; nothing here changed either.
        2: (state) => state,
      }),
    },
  ),
)

/** The library as it stands, with your edits applied. Deleted ones included. */
export function libraryWith(custom: Recipe[]): Recipe[] {
  const overridden = new Set(custom.map((r) => r.id))
  return [...ALL_RECIPES.filter((r) => !overridden.has(r.id)), ...custom]
}

/**
 * What you can actually browse: the library, minus what you deleted and what
 * you merged away. Exported so nothing has to reimplement it, a second copy of
 * this rule in a test is a second copy that can drift out of step with the app.
 */
export function visibleRecipes(state: Pick<RecipeStore, 'custom' | 'hidden' | 'mergedInto'>): Recipe[] {
  const hiddenSet = new Set(state.hidden)
  return libraryWith(state.custom)
    .filter((r) => !hiddenSet.has(r.id) && !(r.id in state.mergedInto))
}

export function useRecipes(): Recipe[] {
  // See useFoods: a fresh array per render made every downstream useMemo a lie.
  const custom = useRecipeStore((s) => s.custom)
  const hidden = useRecipeStore((s) => s.hidden)
  const mergedInto = useRecipeStore((s) => s.mergedInto)

  // Deleted and merged-away recipes both leave the library and both keep
  // resolving, see useResolvableRecipes.
  return useMemo(() => visibleRecipes({ custom, hidden, mergedInto }), [custom, hidden, mergedInto])
}

/**
 * Everything a saved plan might still name, deleted recipes included.
 *
 * This is what the nutrition context is built from. A day you planned in March
 * stores a recipe id, not a copy of the recipe, so deleting that recipe must not
 * be able to reach back and blank the day, the historical record stays whole
 * even though the recipe is gone from every list you can browse.
 */
export function useResolvableRecipes(): Recipe[] {
  const custom = useRecipeStore((s) => s.custom)
  return useMemo(() => libraryWith(custom), [custom])
}

/** The ids of recipes you deleted, for marking them where they still appear. */
export function useDeletedIds(): Set<string> {
  const hidden = useRecipeStore((s) => s.hidden)
  return useMemo(() => new Set(hidden), [hidden])
}

/** The deleted recipes themselves, for offering them back. */
export function useDeletedRecipes(): Recipe[] {
  const custom = useRecipeStore((s) => s.custom)
  const hidden = useRecipeStore((s) => s.hidden)
  return useMemo(() => {
    const hiddenSet = new Set(hidden)
    return libraryWith(custom).filter((r) => hiddenSet.has(r.id))
  }, [custom, hidden])
}

/** What was folded into this recipe, for showing an undo next to it. */
export function useMergedInto(winnerId: string): string[] {
  const mergedInto = useRecipeStore((s) => s.mergedInto)
  return useMemo(() => foldedInto(mergedInto, winnerId), [mergedInto, winnerId])
}
