import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
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
      }),
    },
  ),
)

/**
 * The effective food list: curated foods, with user edits taking precedence and
 * hidden entries removed.
 */
export function useFoods(): Food[] {
  // Memoised on the two arrays it derives from. Without this the result is a
  // new array on every render, which defeats every useMemo downstream that
  // takes it as a dependency — including the nutrition context, which was
  // being rebuilt on every render despite a comment saying otherwise.
  const custom = useFoodStore((s) => s.custom)
  const hidden = useFoodStore((s) => s.hidden)

  return useMemo(() => {
    const overridden = new Set(custom.map((f) => f.id))
    const hiddenSet = new Set(hidden)
    return [
      ...FOODS.filter((f) => !overridden.has(f.id) && !hiddenSet.has(f.id)),
      ...custom,
    ]
  }, [custom, hidden])
}
