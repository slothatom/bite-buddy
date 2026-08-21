import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../../store/persist'
import type { SyncSnapshotByTable, TableSnapshot } from './types'

/**
 * What this device and the server last agreed on, per table.
 *
 * Persisted, and that is the point rather than an optimisation. It is how a
 * deletion survives being closed: local state says what exists now, and only a
 * record of what existed last time can tell "you deleted this" apart from "this
 * was never here". Losing it is not dangerous, everything is simply sent again
 * and re-agreed, which is why it can live in ordinary storage alongside the
 * data it describes.
 *
 * Deliberately not part of `SCHEMA_VERSION`: this is bookkeeping about the
 * data, not data, and throwing it away costs nothing but a round trip.
 */
interface SyncStateStore {
  tables: SyncSnapshotByTable
  snapshotFor: (table: string) => TableSnapshot
  remember: (table: string, snapshot: TableSnapshot) => void
  forgetEverything: () => void
}

const EMPTY: TableSnapshot = { rows: {} }

export const useSyncState = create<SyncStateStore>()(
  persist(
    (set, get) => ({
      tables: {},
      snapshotFor: (table) => get().tables[table] ?? EMPTY,
      remember: (table, snapshot) =>
        set((s) => ({ tables: { ...s.tables, [table]: snapshot } })),
      forgetEverything: () => set({ tables: {} }),
    }),
    {
      name: 'bite-buddy-sync-state',
      version: 1,
      storage: safeStorage<SyncStateStore>(),
      partialize: (s) => ({ tables: s.tables }) as SyncStateStore,
    },
  ),
)
