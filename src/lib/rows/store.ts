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
      /*
       * v1 → v2 throws the bookkeeping away once, on purpose.
       *
       * Until the fix in `localChanges`, a row whose id came back from the dead
       * was written without mentioning `deleted_at`, and an upsert only writes
       * the columns it is given, so the server kept calling it deleted while
       * this device called it alive. Those rows are still poisoned, and the fix
       * alone does not reach them: they match the agreed snapshot, so nothing
       * resends them, and the next pull that meets the tombstone removes them.
       *
       * Forgetting what was agreed makes the next round re-send every live row,
       * this time saying null, which clears the tombstones. It costs one round
       * trip and cannot lose anything: deletions are computed from this
       * snapshot, so an empty one produces no deletions at all.
       */
      version: 2,
      migrate: () => ({ tables: {} }) as SyncStateStore,
      storage: safeStorage<SyncStateStore>(),
      partialize: (s) => ({ tables: s.tables }) as SyncStateStore,
    },
  ),
)
