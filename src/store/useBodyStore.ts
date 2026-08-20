import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import { useMemo } from 'react'
import type { WeightEntry, BodyMeasurement } from '../types'
import { isPersonId } from '../lib/people'

/**
 * Weight and measurements, per person.
 *
 * This is the one store that is not shared. Two people eat the same dinners -
 * hence one week, one grocery list, one library, but two waists averaged into
 * a single trend line is a graph of nothing. Every entry carries the id of
 * whoever it belongs to, and the screen shows one person at a time.
 *
 * The rows still sync, because both of you should be able to log from either
 * phone and not lose anything when one is lost. Shared storage, separate
 * histories.
 */
interface BodyStore {
  weightEntries: WeightEntry[]
  measurements: BodyMeasurement[]
  addWeightEntry: (entry: WeightEntry) => void
  removeWeightEntry: (id: string) => void
  addMeasurement: (m: BodyMeasurement) => void
  removeMeasurement: (id: string) => void
  latestWeight: () => WeightEntry | undefined
  /** Stamps entries logged before the app knew about people. */
  claimUnassigned: (memberId: string) => void
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

      claimUnassigned: (memberId) =>
        set((s) => ({
          weightEntries: s.weightEntries.map((e) =>
            (isPersonId(e.memberId) ? e : { ...e, memberId })),
          measurements: s.measurements.map((m) =>
            (isPersonId(m.memberId) ? m : { ...m, memberId })),
        })),
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

/**
 * One person's entries, oldest first.
 *
 * Anything stamped with something that is not one of the two people, an
 * account id from before this changed, or nothing at all, belongs to nobody.
 * Those are never folded into a history silently; the screen offers to claim
 * them instead.
 */
export function useWeightFor(memberId: string | undefined): WeightEntry[] {
  const entries = useBodyStore((s) => s.weightEntries)
  return useMemo(
    () => entries.filter((e) => e.memberId === memberId).sort((a, b) => a.date.localeCompare(b.date)),
    [entries, memberId],
  )
}

export function useMeasurementsFor(memberId: string | undefined): BodyMeasurement[] {
  const measurements = useBodyStore((s) => s.measurements)
  return useMemo(
    () => measurements.filter((m) => m.memberId === memberId).sort((a, b) => a.date.localeCompare(b.date)),
    [measurements, memberId],
  )
}

/** How many entries belong to nobody yet, for offering to claim them. */
export function useUnassignedCount(): number {
  const { weightEntries, measurements } = useBodyStore()
  return useMemo(
    () => weightEntries.filter((e) => !isPersonId(e.memberId)).length
      + measurements.filter((m) => !isPersonId(m.memberId)).length,
    [weightEntries, measurements],
  )
}
