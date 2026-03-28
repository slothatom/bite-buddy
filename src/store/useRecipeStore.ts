import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Recipe } from '../types'
import { SEED_RECIPES } from './seedRecipes'

interface RecipeStore {
  recipes: Recipe[]
  addRecipe: (recipe: Recipe) => void
  updateRecipe: (id: string, updates: Partial<Recipe>) => void
  deleteRecipe: (id: string) => void
  getRecipe: (id: string) => Recipe | undefined
}

export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set, get) => ({
      recipes: SEED_RECIPES,

      addRecipe: (recipe) =>
        set((s) => ({ recipes: [...s.recipes, recipe] })),

      updateRecipe: (id, updates) =>
        set((s) => ({
          recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),

      deleteRecipe: (id) =>
        set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) })),

      getRecipe: (id) => get().recipes.find((r) => r.id === id),
    }),
    { name: 'bite-buddy-recipes' }
  )
)
