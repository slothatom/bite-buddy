import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Food } from '../types'
import { FOODS } from '../data'

interface FoodStore {
  /** Foods the user added or edited. The curated list stays in code. */
  custom: Food[]
  /** Ids of curated foods the user has hidden. */
  hidden: string[]

  addFood: (food: Food) => void
  updateFood: (id: string, updates: Partial<Food>) => void
  removeFood: (id: string) => void
  restoreFood: (id: string) => void
}

export const useFoodStore = create<FoodStore>()(
  persist(
    (set) => ({
      custom: [],
      hidden: [],

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

      removeFood: (id) =>
        set((s) =>
          s.custom.some((f) => f.id === id)
            ? { custom: s.custom.filter((f) => f.id !== id) }
            : { hidden: [...new Set([...s.hidden, id])] },
        ),

      restoreFood: (id) => set((s) => ({ hidden: s.hidden.filter((h) => h !== id) })),
    }),
    { name: 'bite-buddy-foods-v2' },
  ),
)

/**
 * The effective food list: curated foods, with user edits taking precedence and
 * hidden entries removed.
 */
export function useFoods(): Food[] {
  const { custom, hidden } = useFoodStore()
  const overridden = new Set(custom.map((f) => f.id))
  const hiddenSet = new Set(hidden)
  return [
    ...FOODS.filter((f) => !overridden.has(f.id) && !hiddenSet.has(f.id)),
    ...custom,
  ]
}
