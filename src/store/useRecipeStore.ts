import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Recipe } from '../types'
import { SEED_RECIPES } from './seedRecipes'

interface RecipeStore {
  recipes: Recipe[]
  favoriteIds: string[]
  addRecipe: (recipe: Recipe) => void
  addRecipes: (recipes: Recipe[]) => void
  updateRecipe: (id: string, updates: Partial<Recipe>) => void
  deleteRecipe: (id: string) => void
  getRecipe: (id: string) => Recipe | undefined
  toggleFavorite: (id: string) => void
}

export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set, get) => ({
      recipes: SEED_RECIPES,
      favoriteIds: [],

      addRecipe: (recipe) =>
        set((s) => ({ recipes: [...s.recipes, recipe] })),

      addRecipes: (incoming) =>
        set((s) => {
          const existingIds = new Set(s.recipes.map((r) => r.id))
          const newOnes = incoming.filter((r) => !existingIds.has(r.id))
          return newOnes.length ? { recipes: [...s.recipes, ...newOnes] } : {}
        }),

      updateRecipe: (id, updates) =>
        set((s) => ({
          recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),

      deleteRecipe: (id) =>
        set((s) => ({
          recipes: s.recipes.filter((r) => r.id !== id),
          favoriteIds: s.favoriteIds.filter((fid) => fid !== id),
        })),

      getRecipe: (id) => get().recipes.find((r) => r.id === id),

      toggleFavorite: (id) =>
        set((s) => ({
          favoriteIds: s.favoriteIds.includes(id)
            ? s.favoriteIds.filter((fid) => fid !== id)
            : [...s.favoriteIds, id],
        })),
    }),
    { name: 'bite-buddy-recipes' }
  )
)
