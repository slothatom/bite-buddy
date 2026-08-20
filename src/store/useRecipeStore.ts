import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import type { Recipe } from '../types'
import { ALL_RECIPES } from '../data'

interface RecipeStore {
  /** Recipes the user created or edited; the imported library stays in code. */
  custom: Recipe[]
  hidden: string[]
  favouriteIds: string[]

  addRecipe: (recipe: Recipe) => void
  updateRecipe: (id: string, updates: Partial<Recipe>) => void
  removeRecipe: (id: string) => void
  toggleFavourite: (id: string) => void
}

export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set) => ({
      custom: [],
      hidden: [],
      favouriteIds: [],

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

      removeRecipe: (id) =>
        set((s) =>
          s.custom.some((r) => r.id === id)
            ? { custom: s.custom.filter((r) => r.id !== id), favouriteIds: s.favouriteIds.filter((f) => f !== id) }
            : { hidden: [...new Set([...s.hidden, id])] },
        ),

      toggleFavourite: (id) =>
        set((s) => ({
          favouriteIds: s.favouriteIds.includes(id)
            ? s.favouriteIds.filter((f) => f !== id)
            : [...s.favouriteIds, id],
        })),
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

  return useMemo(() => {
    const overridden = new Set(custom.map((r) => r.id))
    const hiddenSet = new Set(hidden)
    return [
      ...ALL_RECIPES.filter((r) => !overridden.has(r.id) && !hiddenSet.has(r.id)),
      ...custom,
    ]
  }, [custom, hidden])
}
