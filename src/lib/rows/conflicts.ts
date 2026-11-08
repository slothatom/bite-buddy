import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage } from '../../store/persist'
import type { RowTable, SyncRow } from './types'

/**
 * Edits that lost, kept so they can be brought back.
 *
 * When both of you change the same thing before your copies meet, the rule in
 * diff.ts is local-first: the version on this device stays and is sent, and the
 * other person's is overwritten. That rule is fine; doing it silently was not.
 * The banner used to say "the later edit was kept", which was not what
 * happened, and their version was gone with nothing to show for it.
 *
 * Now their version is kept here, persisted so a reload does not lose it, until
 * somebody chooses: keep mine (dismiss) or use theirs (restore).
 */

export interface Conflict {
  /** `${table}:${id}`, so a second clash on the same row replaces the first. */
  key: string
  table: string
  id: string
  /** What to call it on screen: "a meal on Tuesday 10 Nov". */
  label: string
  /** The other person's version, exactly as the server had it. */
  theirs: SyncRow
  /** When this device noticed. */
  at: string
}

/** Enough to review a busy day; older ones fall off rather than pile up. */
export const MAX_CONFLICTS = 50

interface ConflictStore {
  items: Conflict[]
  add: (table: string, rows: SyncRow[], now?: Date) => void
  remove: (key: string) => void
  clear: () => void
}

export const useConflicts = create<ConflictStore>()(
  persist(
    (set) => ({
      items: [],
      add: (table, rows, now = new Date()) => set((s) => {
        const fresh = rows.map((theirs): Conflict => ({
          key: `${table}:${theirs.id}`,
          table,
          id: theirs.id,
          label: describe(table, theirs),
          theirs,
          at: now.toISOString(),
        }))
        const keys = new Set(fresh.map((c) => c.key))
        return { items: [...fresh, ...s.items.filter((c) => !keys.has(c.key))].slice(0, MAX_CONFLICTS) }
      }),
      remove: (key) => set((s) => ({ items: s.items.filter((c) => c.key !== key) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'bite-buddy-conflicts',
      version: 1,
      storage: safeStorage<ConflictStore>(),
      partialize: (s) => ({ items: s.items }) as ConflictStore,
    },
  ),
)

/**
 * Puts the other person's version back on this device.
 *
 * Only local state changes here. It then differs from what was last agreed, so
 * the next round sends it like any other edit, and the other device takes it.
 * A version that was a deletion deletes.
 */
export function restoreTheirs(table: RowTable, conflict: Conflict): void {
  const rows = table.read().filter((row) => row.id !== conflict.id)
  if (!conflict.theirs.deleted_at) rows.push({ ...conflict.theirs })
  table.apply(rows)
}

const KIND: Record<string, string> = {
  plan_meals: 'a meal',
  recipes: 'a recipe',
  foods: 'a food',
  grocery_items: 'a shopping list line',
  cook_sessions: 'a cook session',
  settings: 'your targets',
}

/** What to call a row on screen, without leaking table names. */
export function describe(table: string, row: SyncRow): string {
  const what = KIND[table] ?? 'an entry'
  const day = row.day ? formatDay(row.day) : null
  return day ? `${what} on ${day}` : what
}

function formatDay(day: string): string | null {
  const date = new Date(`${day.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}
