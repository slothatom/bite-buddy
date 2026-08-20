/**
 * Keeping the two of you looking at the same week.
 *
 * The app's stores stay exactly as they are, local-first, writing to
 * localStorage. This layer sits beside them: it pushes every local change up as
 * a document, and applies anything the other person changes as it arrives.
 *
 * Three things worth knowing about the design:
 *
 *  - **Documents, not tables.** Each store is one `app_state` row holding what
 *    a backup would contain. The app's own model stays the authority and this
 *    file stays small. The cost is last-write-wins per store, which with two
 *    people is rare and, because realtime pushes changes immediately, visible
 *    when it happens.
 *  - **A remote apply must not echo.** Writing a store triggers its subscriber,
 *    which would push straight back up. `applying` suppresses that for the
 *    duration of the write.
 *  - **Pushes are debounced.** Typing in a field updates the store on every
 *    keystroke; the network does not need to hear about each one.
 */
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { SCHEMA_VERSION } from '../store/persist'
import { STORES, type StoreKey } from '../store/registry'
import { PushQueue } from './pushQueue'
import { mergeStore } from './merge'

export type SyncState = 'off' | 'connecting' | 'live' | 'error'

export interface SyncSnapshot {
  state: SyncState
  at: Date | null
  /** Stores changed here that the server has not accepted yet. */
  unsaved: number
  /** Set when a row was written by a version of the app this one cannot read. */
  schemaMismatch: boolean
  /**
   * Days both of you changed since your copies last agreed. One version won;
   * this is how the other person's loss becomes visible rather than silent.
   */
  conflicts: string[]
}

let applying = false
const listeners = new Set<() => void>()

// One frozen object, replaced only when something actually changes. React's
// useSyncExternalStore compares snapshots by identity, so returning a fresh
// object per read would re-render forever.
let snapshot: SyncSnapshot = { state: 'off', at: null, unsaved: 0, schemaMismatch: false, conflicts: [] }

function announce(next: Partial<SyncSnapshot>) {
  const merged = { ...snapshot, ...next }
  if (
    merged.state === snapshot.state && merged.at === snapshot.at &&
    merged.unsaved === snapshot.unsaved && merged.schemaMismatch === snapshot.schemaMismatch &&
    merged.conflicts.join() === snapshot.conflicts.join()
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

/** When the local copy and the server last agreed, per store. */
const agreedAt = new Map<StoreKey, number>()

/**
 * What happened to a row that arrived from the server.
 *
 * `diverged` is the only one that has to go back up: the merge produced
 * something the sender does not have, their days plus ours. `same` means what
 * we now hold is exactly what they sent, and pushing that back would start a
 * conversation with no end, their write waking ours, ours waking theirs.
 */
type Applied = 'refused' | 'same' | 'diverged'

function applyRemote(key: StoreKey, data: unknown, schema: number): Applied {
  const store = STORES.find((s) => s.name === key)
  if (!store || typeof data !== 'object' || data === null) return 'refused'

  // A row written by a different version of the app would be misread rather
  // than rejected, the one outcome worth refusing outright. Refusing silently
  // is not good enough though: the two devices then disagree forever with
  // nothing on screen to say why, so this surfaces.
  if (schema !== SCHEMA_VERSION) {
    announce({ schemaMismatch: true, state: 'error' })
    return 'refused'
  }

  // Merge rather than overwrite. The week is combined a day at a time, so an
  // edit of theirs no longer erases a different day of yours.
  const { merged, conflicts } = mergeStore(key, store.read(), data, agreedAt.get(key))
  agreedAt.set(key, Date.now())

  applying = true
  try {
    store.write(merged as object)
  } finally {
    applying = false
  }

  if (conflicts.length) {
    announce({ conflicts: [...new Set([...snapshot.conflicts, ...conflicts])] })
  }

  return same(merged, data) ? 'same' : 'diverged'
}

/**
 * Whether the merge changed anything, compared as the database stores it.
 *
 * Both sides are serialised before comparing because that is the form the row
 * takes: a key order difference is not a difference the server would ever see,
 * and neither is a `Date` that becomes the same string.
 */
function same(merged: unknown, remote: unknown): boolean {
  try {
    return JSON.stringify(merged) === JSON.stringify(remote)
  } catch {
    return false
  }
}

/** Dismisses the conflict notice once you have looked at the days involved. */
export function acknowledgeConflicts(): void {
  announce({ conflicts: [] })
}

/**
 * Starts syncing, and returns a function that stops it.
 *
 * Call once a session exists. Safe to call when Supabase is not configured -
 * it does nothing and reports `off`.
 */
export function startSync(userId: string): () => void {
  const db = supabase
  if (!db) {
    announce({ state: 'off', at: null, unsaved: 0 })
    return () => {}
  }

  announce({ state: 'connecting', at: null })
  let stopped = false
  const unsubscribers: Array<() => void> = []

  // Delivery, retries and "what is still unsaved" all live in the queue. It
  // rejects rather than swallowing, so a failed push stays pending.
  const queue = new PushQueue({
    push: async (key) => {
      const store = STORES.find((s) => s.name === key)
      if (!store) return
      const { error } = await db.from('app_state').upsert(
        {
          key,
          data: JSON.parse(JSON.stringify(store.read())) as unknown,
          schema: SCHEMA_VERSION,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: 'key' },
      )
      if (error) throw new Error(error.message)
    },
    onChange: (s) => announce({
      unsaved: s.pending.length,
      state: s.pending.length && s.failures ? 'error' : snapshot.state === 'error' && !s.pending.length ? 'live' : snapshot.state,
      at: s.pending.length ? snapshot.at : new Date(),
    }),
  })

  // 1. Take whatever the household already has before pushing anything, so a
  //    fresh device joins the existing state instead of overwriting it.
  const pullAll = async () => {
    const { data, error } = await db.from('app_state').select('key, data, schema')
    if (error) {
      announce({ state: 'error' })
      return false
    }
    for (const row of data ?? []) applyRemote(row.key as StoreKey, row.data, row.schema)
    return true
  }

  void pullAll().then((ok) => {
    if (stopped || !ok) return

    // 2. Mark local changes; the queue decides when they go.
    for (const store of STORES) {
      const key = store.name as StoreKey
      unsubscribers.push(store.subscribe(() => {
        if (applying) return
        queue.mark(key)
      }))
    }

    // 3. Apply the other person's changes as they land.
    const channel = db
      .channel('app_state')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_state' },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const row = payload.new as { key?: string; data?: unknown; schema?: number; updated_by?: string }
          if (!row?.key || row.updated_by === userId) return
          const applied = applyRemote(row.key as StoreKey, row.data, row.schema ?? -1)
          // Only a merge that produced something neither side has, our days
          // plus theirs, has to go back; otherwise their device keeps a week
          // missing ours. Sending back a row identical to the one that just
          // arrived would instead have the two phones answering each other
          // every second for as long as both are open.
          if (applied === 'diverged') queue.mark(row.key as StoreKey)
          // A refusal has already said why, and it outranks "live".
          if (applied !== 'refused') announce({ state: 'live', at: new Date() })
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') announce({ state: 'live', at: new Date() })
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') announce({ state: 'error' })
      })

    unsubscribers.push(() => void db.removeChannel(channel))
  })

  // 4. Anything that suggests the network is back, or that the tab is about to
  //    go away, is a reason to stop waiting out the backoff and try now.
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
    queue.stop()
    for (const off of unsubscribers) off()
    announce({ state: 'off', at: null, unsaved: 0 })
  }
}
