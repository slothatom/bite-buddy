import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import type { PantryItem } from '../types'

/**
 * What is already in the cupboard.
 *
 * The shopping list was built from the plan alone, which is the right starting
 * point and the wrong finishing one: a week of real cooking comes out as forty
 * lines, most of which are salt, oil, and the half bag of lentils from last
 * time. A list you have to read past is a list you stop reading.
 *
 * This is not stock control and must not become it. Marking something is one
 * tap and means "we have this"; a quantity is optional and only exists because
 * "200 g of the 500 g you need" is a genuinely different answer from "we have
 * lentils". Nothing here is ever decremented automatically. The cupboard is in
 * your kitchen and the app has never seen it.
 */
interface PantryStore {
  items: PantryItem[]

  /** Marks something as had. Marking twice updates rather than duplicates. */
  keep: (item: Omit<PantryItem, 'updatedAt'>) => void
  /** Stops claiming to have it. */
  drop: (foodId: string) => void
  toggleStaple: (foodId: string) => void
  has: (foodId: string) => PantryItem | undefined
}

export const usePantryStore = create<PantryStore>()(
  persist(
    (set, get) => ({
      items: [],

      keep: (item) =>
        set((s) => {
          const updatedAt = new Date().toISOString()
          const existing = s.items.find((i) => i.foodId === item.foodId)
          if (!existing) return { items: [...s.items, { ...item, updatedAt }] }
          return {
            items: s.items.map((i) =>
              (i.foodId === item.foodId ? { ...i, ...item, updatedAt } : i)),
          }
        }),

      drop: (foodId) => set((s) => ({ items: s.items.filter((i) => i.foodId !== foodId) })),

      toggleStaple: (foodId) =>
        set((s) => {
          const existing = s.items.find((i) => i.foodId === foodId)
          const updatedAt = new Date().toISOString()
          if (!existing) return { items: [...s.items, { foodId, staple: true, updatedAt }] }
          return {
            items: s.items.map((i) =>
              (i.foodId === foodId ? { ...i, staple: !i.staple, updatedAt } : i)),
          }
        }),

      has: (foodId) => get().items.find((i) => i.foodId === foodId),
    }),
    {
      name: 'bite-buddy-pantry',
      version: SCHEMA_VERSION,
      storage: safeStorage<PantryStore>(),
      migrate: upgradeThrough<PantryStore>(SCHEMA_VERSION, {
        // Did not exist at either earlier version; nothing to bring forward.
        1: (state) => state,
        2: (state) => state,
      }),
      partialize: (s) => ({ items: s.items }) as PantryStore,
    },
  ),
)

/**
 * The cupboard as a lookup.
 *
 * Built outside the store selector: a selector that builds a value hands back a
 * new one on every call, zustand compares by identity, and the screen re-renders
 * until React gives up. That mistake cost the portions feature its first run.
 */
export function usePantry(): Map<string, PantryItem> {
  const items = usePantryStore((s) => s.items)
  return useMemo(() => new Map(items.map((i) => [i.foodId, i])), [items])
}

export function usePantryItems(): PantryItem[] {
  return usePantryStore((s) => s.items)
}
