import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import { planMerge, planUnmerge, mergedIntoRecipe } from '../lib/mergeRecipes'
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
   * this map, so a day you already planned — or one of the fourteen archived
   * weeks, which live in code and cannot be rewritten — still finds a recipe.
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
}

/** True for the 275 recipes that ship with the app, as opposed to your own. */
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
       * Deleting has to cover two cases, and used to get the overlap wrong.
       *
       * A recipe of your own is simply dropped. A built-in one cannot be, since
       * it lives in code — so it goes on the hidden list instead. The case that
       * was broken is a built-in you had edited: it exists in `custom` as an
       * override, so deleting it only removed the override and the original
       * reappeared, looking for all the world like the delete had failed. Both
       * halves now run, so an edited built-in hides like any other.
       */
      removeRecipe: (id) =>
        set((s) => ({
          custom: s.custom.filter((r) => r.id !== id),
          hidden: isBuiltIn(id) ? [...new Set([...s.hidden, id])] : s.hidden,
          favouriteIds: s.favouriteIds.filter((f) => f !== id),
        })),

      revertRecipe: (id) =>
        set((s) => ({
          custom: s.custom.filter((r) => r.id !== id),
          hidden: s.hidden.filter((h) => h !== id),
        })),

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

export function useRecipes(): Recipe[] {
  // See useFoods: a fresh array per render made every downstream useMemo a lie.
  const custom = useRecipeStore((s) => s.custom)
  const hidden = useRecipeStore((s) => s.hidden)
  const mergedInto = useRecipeStore((s) => s.mergedInto)

  return useMemo(() => {
    const overridden = new Set(custom.map((r) => r.id))
    const hiddenSet = new Set(hidden)
    // Merged-away recipes leave the library but keep resolving — see
    // useNutritionContext, which still maps their ids to what they became.
    const gone = (id: string) => hiddenSet.has(id) || id in mergedInto

    return [
      ...ALL_RECIPES.filter((r) => !overridden.has(r.id) && !gone(r.id)),
      ...custom.filter((r) => !gone(r.id)),
    ]
  }, [custom, hidden, mergedInto])
}

/** What was folded into this recipe, for showing an undo next to it. */
export function useMergedInto(winnerId: string): string[] {
  const mergedInto = useRecipeStore((s) => s.mergedInto)
  return useMemo(() => mergedIntoRecipe(mergedInto, winnerId), [mergedInto, winnerId])
}
