import { supabase } from './supabase'
import { STORES } from '../store/registry'
import { PushQueue } from './pushQueue'
import { RowSync } from './rows/engine'
import { ROW_TABLES } from './rows/tables'
import { localChanges } from './rows/diff'
import { useSyncState } from './rows/store'
import type { SyncRow } from './rows/types'

/**
 * Keeping the two of you looking at the same week.
 *
 * The stores stay exactly as they are: local-first, writing to localStorage,
 * the only thing any screen reads. This layer sits beside them and moves rows.
 *
 * It used to move documents, one per store, and that shape caused the failure
 * that made this app briefly unusable. A document says what exists, so a write
 * is all or nothing, a deletion cannot be expressed, and merging two of them
 * can only replace or union. A pull at startup handed the device the server's
 * copy of everything, and anything typed in that had not been delivered went
 * with it. Rows do not have that property: the unit of change is one thing, a
 * deletion is a fact with a timestamp, and two people editing different meals
 * on the same day are not in each other's way at all.
 *
 * Three things worth knowing about what is left here:
 *
 *  - **A remote apply must not echo.** Rows written by this device are ignored
 *    when they come back, or two open phones talk to each other forever.
 *  - **Rounds are debounced.** Typing in a field changes a store on every
 *    keystroke; the network does not need to hear each one.
 *  - **A refused write stays owed.** The record of what has been agreed is only
 *    advanced once the server has accepted something.
 */

export type SyncState = 'off' | 'connecting' | 'live' | 'error'

export interface SyncSnapshot {
  state: SyncState
  at: Date | null
  /** Rows changed here that the server has not accepted yet. */
  unsaved: number
  /**
   * Things both of you changed since your copies last agreed. One version won;
   * this is how the other person's loss becomes visible rather than silent.
   */
  conflicts: string[]
  /**
   * What the server said when it last refused something, verbatim.
   *
   * "Can't reach the server" covers a train tunnel and a row-level security
   * policy that will refuse every write until somebody changes it, and those
   * need very different reactions.
   */
  lastError: string | null
}

const listeners = new Set<() => void>()

// One frozen object, replaced only when something actually changes. React's
// useSyncExternalStore compares snapshots by identity, so returning a fresh
// object per read would re-render forever.
let snapshot: SyncSnapshot = {
  state: 'off', at: null, unsaved: 0, conflicts: [], lastError: null,
}

function announce(next: Partial<SyncSnapshot>) {
  const merged = { ...snapshot, ...next }
  if (
    merged.state === snapshot.state && merged.at === snapshot.at &&
    merged.unsaved === snapshot.unsaved && merged.conflicts.join() === snapshot.conflicts.join() && merged.lastError === snapshot.lastError
  ) return
  snapshot = merged
  for (const fn of listeners) fn()
}

export function syncSnapshot(): SyncSnapshot {
  return snapshot
}

export function onSyncChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Dismisses the notice once you have looked at what it points to. */
export function acknowledgeConflicts(): void {
  announce({ conflicts: [] })
}

/** How much this device is holding that the server has not accepted. */
export function owedRows(): number {
  const now = new Date().toISOString()
  return ROW_TABLES.reduce((total, table) => {
    const snap = useSyncState.getState().snapshotFor(table.table)
    return total + localChanges(table.read(), snap, now).send.length
  }, 0)
}

/** What to call a contested row on screen, without leaking table names. */
function describe(table: string, row: SyncRow): string {
  const what = table === 'plan_meals' ? 'a meal'
    : table === 'recipes' ? 'a recipe'
    : table === 'foods' ? 'a food'
    : table === 'grocery_items' ? 'a shopping list line'
    : table === 'cook_sessions' ? 'a cook session'
    : table === 'settings' ? 'your targets'
    : 'an entry'
  return row.day ? `${what} on ${row.day}` : what
}

/**
 * Starts syncing, and returns a function that stops it.
 *
 * Call once a session exists. Safe to call when Supabase is not configured: it
 * does nothing and reports `off`.
 */
export function startSync(userId: string): () => void {
  const db = supabase
  if (!db) {
    announce({ state: 'off', at: null, unsaved: 0, lastError: null })
    return () => {}
  }

  announce({ state: 'connecting', at: null })
  let stopped = false
  const unsubscribers: Array<() => void> = []

  const engine = new RowSync(db, ROW_TABLES, userId, {
    onError: (message) => announce({ state: 'error', lastError: message }),
    onDelivered: () => announce({ lastError: null }),
    onContested: (table, rows) =>
      announce({
        conflicts: [...new Set([...snapshot.conflicts, ...rows.map((r) => describe(table, r))])],
      }),
  })

  // Delivery, retries and "what is still unsaved" live in the queue, which
  // rejects rather than swallowing, so a failed round stays owed.
  const queue = new PushQueue({
    push: async () => {
      if (!(await engine.round())) throw new Error('round failed')
    },
    onChange: (s) => announce({
      unsaved: owedRows(),
      state: s.pending.length && s.failures ? 'error' : s.pending.length ? snapshot.state : 'live',
      at: s.pending.length ? snapshot.at : new Date(),
    }),
  })

  /** One name, because a round covers every table anyway. */
  const EVERYTHING = 'rows'

  void (async () => {
    // The first round: take what the household has, then offer what is here.
    // Both directions matter on a device that has been offline.
    if (stopped) return
    queue.mark(EVERYTHING)

    if (stopped) return
    unsubscribers.push(engine.watch())

    // Any local change is a reason to go round again. The registry is still
    // the one list of stores, so a store added there is synced without anybody
    // remembering to come back here.
    for (const store of STORES) {
      unsubscribers.push(store.subscribe(() => { if (!stopped) queue.mark(EVERYTHING) }))
    }

    announce({ state: 'live', at: new Date() })
  })()

  // Anything that suggests the network is back, or that the tab is about to go
  // away, is a reason to stop waiting out the backoff and try now.
  const retryNow = () => void queue.flush()
  const onVisible = () => { if (document.visibilityState === 'visible') retryNow() }

  window.addEventListener('online', retryNow)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pagehide', retryNow)
  unsubscribers.push(() => {
    window.removeEventListener('online', retryNow)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('pagehide', retryNow)
  })

  return () => {
    stopped = true
    engine.stop()
    queue.stop()
    for (const off of unsubscribers) off()
    announce({ state: 'off', at: null, unsaved: 0 })
  }
}
