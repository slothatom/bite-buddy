import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * The path every saved change takes to the other phone.
 *
 * This is the one part of the app whose failures are invisible from inside it.
 * A store that stops persisting shows up the moment you reload; a change that
 * never leaves looks exactly like one that did, until the other person opens
 * their copy a week later and it is missing a Tuesday.
 *
 * The rules about which version of a row wins live in rows/diff.ts and are
 * tested there without a network. What is pinned here is the wiring: a device
 * takes what the household has before it sends anything, a local change reaches
 * the server, an arriving change is not bounced straight back, and a refused
 * write stays owed rather than being quietly forgotten.
 */

const upsert = vi.fn()
const select = vi.fn()
const gt = vi.fn()
const on = vi.fn()
const subscribe = vi.fn()
const removeChannel = vi.fn()

vi.mock('./supabase', () => ({
  isConfigured: true,
  redirectUrl: () => 'https://example.test/',
  supabase: {
    from: () => ({ upsert, select }),
    channel: () => ({ on, subscribe }),
    removeChannel,
  },
}))

/**
 * A DOM small enough for what sync touches.
 *
 * The suite runs in node, and sync listens for `online`, `visibilitychange` and
 * `pagehide` so a failed round gets another go the moment the network or the
 * tab comes back. Pulling in a whole browser for three listeners is a heavier
 * dependency than the thing being tested.
 */
const listeners = { window: new Map<string, Set<() => void>>(), document: new Map<string, Set<() => void>>() }

function fakeTarget(bucket: Map<string, Set<() => void>>) {
  return {
    addEventListener: (type: string, fn: () => void) => {
      if (!bucket.has(type)) bucket.set(type, new Set())
      bucket.get(type)!.add(fn)
    },
    removeEventListener: (type: string, fn: () => void) => { bucket.get(type)?.delete(fn) },
  }
}

Object.assign(globalThis, {
  window: fakeTarget(listeners.window),
  document: { ...fakeTarget(listeners.document), visibilityState: 'visible' },
})

const { startSync, syncSnapshot, owedRows } = await import('./sync')
const { useSyncState } = await import('./rows/store')
const { ROW_TABLES } = await import('./rows/tables')
const { useMealPlanStore } = await import('../store/useMealPlanStore')
const { useBodyStore } = await import('../store/useBodyStore')

/** Every row the app sent, whichever table it was for. */
function sent() {
  return upsert.mock.calls.flatMap(([rows]) => rows as { id: string; deleted_at?: string }[])
}

/** Waits for the queue's debounce and the promises around it to settle. */
async function settle(ms = 1_500) {
  await vi.advanceTimersByTimeAsync(ms)
}

const weight = (id: string, kg: number) => ({
  id, date: '2026-08-20', weight: kg, unit: 'kg' as const, memberId: 'arany',
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()

  upsert.mockResolvedValue({ error: null })
  gt.mockResolvedValue({ data: [], error: null })
  select.mockReturnValue({
    gt,
    then: (fn: (r: unknown) => unknown) => Promise.resolve(fn({ data: [], error: null })),
  })
  on.mockImplementation(() => ({ subscribe }))
  subscribe.mockReturnValue({})

  useSyncState.setState({ tables: {} })
  useMealPlanStore.setState({ plan: [], groceryItems: [] })
  useBodyStore.setState({ weightEntries: [], measurements: [] })
})

afterEach(() => { vi.useRealTimers() })

describe('joining a household', () => {
  it('takes what is already there', async () => {
    select.mockReturnValue({
      gt,
      then: (fn: (r: unknown) => unknown) => Promise.resolve(fn({
        data: [{
          id: 'theirs',
          day: '2026-08-18',
          data: weight('theirs', 61),
          member_id: 'oli',
          updated_at: '2026-08-20T10:00:00.000Z',
        }],
        error: null,
      })),
    })

    const stop = startSync('me')
    await settle()

    expect(useBodyStore.getState().weightEntries.map((w) => w.id)).toContain('theirs')
    stop()
  })

  it('offers what this device holds, even when nothing has changed since it opened', async () => {
    // The queue only knows about edits made while it is running, and it lives
    // in memory. Without a round at startup, a device holding something the
    // server never got would never offer it again.
    useBodyStore.setState({ weightEntries: [weight('w1', 72)] })

    const stop = startSync('me')
    await settle()

    expect(sent().map((r) => r.id)).toContain('w1')
    stop()
  })
})

describe('a local change', () => {
  it('reaches the server, stamped with who wrote it', async () => {
    const stop = startSync('me')
    await settle()

    useBodyStore.setState({ weightEntries: [weight('w1', 72)] })
    await settle()

    const row = upsert.mock.calls
      .flatMap(([rows]) => rows as { id: string; updated_by?: string }[])
      .find((r) => r.id === 'w1')
    expect(row?.updated_by).toBe('me')
    stop()
  })

  it('is still owed while the server is refusing it', async () => {
    upsert.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } })

    const stop = startSync('me')
    await settle()
    useBodyStore.setState({ weightEntries: [weight('w1', 72)] })
    await settle(5_000)

    expect(syncSnapshot().lastError).toContain('row-level security')
    expect(owedRows()).toBeGreaterThan(0)
    // And it is still here. A refused write must never look like a saved one.
    expect(useBodyStore.getState().weightEntries).toHaveLength(1)
    stop()
  })

  it('stops going anywhere once sync is stopped', async () => {
    const stop = startSync('me')
    await settle()
    stop()

    upsert.mockClear()
    useBodyStore.setState({ weightEntries: [weight('w2', 71)] })
    await settle()

    expect(upsert).not.toHaveBeenCalled()
  })

  it('says a deletion out loud rather than simply forgetting', async () => {
    // The whole reason for rows. Under documents this was the absence of an
    // entry in a list, and an absence cannot be told apart from silence.
    useBodyStore.setState({ weightEntries: [weight('w1', 72), weight('w2', 71)] })

    const stop = startSync('me')
    await settle()
    upsert.mockClear()

    useBodyStore.setState({ weightEntries: [weight('w1', 72)] })
    await settle()

    const tombstone = sent().find((r) => r.id === 'w2')
    expect(tombstone?.deleted_at).toBeTruthy()
    stop()
  })
})

describe('what gets synced at all', () => {
  it('covers every kind of thing the app stores', async () => {
    const tables = ROW_TABLES.map((t) => t.table)
    expect(tables).toEqual(expect.arrayContaining([
      'plan_meals', 'grocery_items', 'recipes', 'foods',
      'weights', 'measurements', 'workouts', 'steps', 'sleep',
      'portions', 'pantry', 'cook_sessions', 'settings',
    ]))
  })

  it('has something to call each of them out loud', async () => {
    // A banner offering to remove "21 of 21 grocery_items" is a column name
    // wearing a sentence. Every table needs a name a person would use, and a
    // new table must not be able to reach a screen without one.
    const { whatTheyAre } = await import('./sync')
    for (const table of ROW_TABLES.map((t) => t.table)) {
      expect(whatTheyAre(table), table).not.toBe('entries')
      expect(whatTheyAre(table), table).not.toContain('_')
    }
  })
})
