import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { discardOlderThan, safeStorage, SCHEMA_VERSION } from './persist'
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
      migrate: discardOlderThan<RecipeStore>(SCHEMA_VERSION),
    },
  ),
)

export function useRecipes(): Recipe[] {
  const { custom, hidden } = useRecipeStore()
  const overridden = new Set(custom.map((r) => r.id))
  const hiddenSet = new Set(hidden)
  return [
    ...ALL_RECIPES.filter((r) => !overridden.has(r.id) && !hiddenSet.has(r.id)),
    ...custom,
  ]
}
