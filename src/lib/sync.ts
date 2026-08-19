/**
 * Keeping the two of you looking at the same week.
 *
 * The app's stores stay exactly as they are — local-first, writing to
 * localStorage. This layer sits beside them: it pushes every local change up as
 * a document, and applies anything the other person changes as it arrives.
 *
 * Three things worth knowing about the design:
 *
 *  - **Documents, not tables.** Each store is one `app_state` row holding what
 *    a backup would contain. The app's own model stays the authority and this
 *    file stays small. The cost is last-write-wins per store, which with two
 *    people is rare and — because realtime pushes changes immediately — visible
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

const PUSH_DELAY_MS = 800

export type SyncState = 'off' | 'connecting' | 'live' | 'error'

export interface SyncSnapshot {
  state: SyncState
  at: Date | null
}

let applying = false
const listeners = new Set<() => void>()
let lastSyncedAt: Date | null = null

// One frozen object, replaced only when something actually changes. React's
// useSyncExternalStore compares snapshots by identity, so returning a fresh
// object per read would re-render forever.
let snapshot: SyncSnapshot = { state: 'off', at: null }

function announce(state: SyncState, at: Date | null = lastSyncedAt) {
  lastSyncedAt = at
  if (snapshot.state === state && snapshot.at === at) return
  snapshot = { state, at }
  for (const fn of listeners) fn()
}

export function syncSnapshot(): SyncSnapshot {
  return snapshot
}

export function onSyncChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function applyRemote(key: StoreKey, data: unknown, schema: number) {
  const store = STORES.find((s) => s.name === key)
  // A row written by a newer version of the app would be misread rather than
  // rejected, which is the one outcome worth refusing outright.
  if (!store || schema !== SCHEMA_VERSION || typeof data !== 'object' || data === null) return
  applying = true
  try {
    store.write(data as object)
  } finally {
    applying = false
  }
}

/**
 * Starts syncing, and returns a function that stops it.
 *
 * Call once a session exists. Safe to call when Supabase is not configured —
 * it does nothing and reports `off`.
 */
export function startSync(userId: string): () => void {
  const db = supabase
  if (!db) {
    announce('off', null)
    return () => {}
  }

  announce('connecting', null)
  const timers = new Map<StoreKey, ReturnType<typeof setTimeout>>()
  const unsubscribers: Array<() => void> = []
  let stopped = false

  // 1. Take whatever the household already has before pushing anything, so a
  //    fresh device joins the existing state instead of overwriting it.
  const pullAll = async () => {
    const { data, error } = await db.from('app_state').select('key, data, schema')
    if (error) {
      announce('error', null)
      return false
    }
    for (const row of data ?? []) applyRemote(row.key as StoreKey, row.data, row.schema)
    return true
  }

  const push = (key: StoreKey) => {
    const store = STORES.find((s) => s.name === key)
    if (!store) return
    void db
      .from('app_state')
      .upsert(
        {
          key,
          data: JSON.parse(JSON.stringify(store.read())) as unknown,
          schema: SCHEMA_VERSION,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: 'key' },
      )
      .then(({ error }) => announce(error ? 'error' : 'live', error ? lastSyncedAt : new Date()))
  }

  void pullAll().then((ok) => {
    if (stopped || !ok) return

    // 2. Push local changes, debounced.
    for (const store of STORES) {
      const key = store.name as StoreKey
      unsubscribers.push(
        store.subscribe(() => {
          if (applying) return
          clearTimeout(timers.get(key))
          timers.set(key, setTimeout(() => push(key), PUSH_DELAY_MS))
        }),
      )
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
          applyRemote(row.key as StoreKey, row.data, row.schema ?? -1)
          announce('live', new Date())
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') announce('live', new Date())
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') announce('error')
      })

    unsubscribers.push(() => void db.removeChannel(channel))
  })

  return () => {
    stopped = true
    for (const t of timers.values()) clearTimeout(t)
    for (const off of unsubscribers) off()
    announce('off', null)
  }
}
