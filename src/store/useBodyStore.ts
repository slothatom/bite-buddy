import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import type { WeightEntry, BodyMeasurement } from '../types'

interface BodyStore {
  weightEntries: WeightEntry[]
  measurements: BodyMeasurement[]
  addWeightEntry: (entry: WeightEntry) => void
  removeWeightEntry: (id: string) => void
  addMeasurement: (m: BodyMeasurement) => void
  removeMeasurement: (id: string) => void
  latestWeight: () => WeightEntry | undefined
}

export const useBodyStore = create<BodyStore>()(
  persist(
    (set, get) => ({
      weightEntries: [],
      measurements: [],

      addWeightEntry: (entry) =>
        set((s) => ({
          weightEntries: [...s.weightEntries, entry].sort((a, b) =>
            a.date.localeCompare(b.date)
          ),
        })),

      removeWeightEntry: (id) =>
        set((s) => ({ weightEntries: s.weightEntries.filter((e) => e.id !== id) })),

      addMeasurement: (m) =>
        set((s) => ({
          measurements: [...s.measurements, m].sort((a, b) =>
            a.date.localeCompare(b.date)
          ),
        })),

      removeMeasurement: (id) =>
        set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) })),

      latestWeight: () => {
        const entries = get().weightEntries
        return entries[entries.length - 1]
      },
    }),
    {
      name: 'bite-buddy-body',
      version: SCHEMA_VERSION,
      storage: safeStorage<BodyStore>(),
      migrate: upgradeThrough<BodyStore>(SCHEMA_VERSION, {
        // v1 → v2: this store's shape did not change. Only the meal plan gained
        // a field, and discarding everything else over that would cost the user
        // their foods, recipes and logs for nothing.
        1: (state) => state,
        // v2 → v3: XP left the user profile; nothing here changed either.
        2: (state) => state,
      }),
    }
  )
)
