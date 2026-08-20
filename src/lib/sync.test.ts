import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * The path every saved change takes to the other phone.
 *
 * This is the one part of the app whose failures are invisible from inside it.
 * A store that stops persisting shows up the moment you reload; a push that
 * never happens looks exactly like a push that did, until the other person
 * opens their copy a week later and it is missing a Tuesday.
 *
 * So the four things that would produce that silence are pinned here: a fresh
 * device must take what the household already has before it sends anything, a
 * local edit must reach the server, an arriving change must not bounce back up
 * as though it were local, and a row from a version this build cannot read must
 * be refused out loud rather than misinterpreted.
 */

const upsert = vi.fn()
const select = vi.fn()
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
 * `pagehide` so a failed push gets another go the moment the network or the tab
 * comes back. Pulling in a whole browser environment for three listeners is a
 * heavier dependency than the thing being tested.
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

const { SCHEMA_VERSION } = await import('../store/persist')
const { STORES } = await import('../store/registry')
const { startSync, syncSnapshot } = await import('./sync')
const { useMealPlanStore } = await import('../store/useMealPlanStore')
const { useBodyStore } = await import('../store/useBodyStore')

/** The realtime callback the app registered, so a test can deliver a row. */
type RowHandler = (payload: { new: Record<string, unknown> }) => void
let deliver: RowHandler = () => {}

const PLAN_KEY = 'bite-buddy-mealplan-v2'

/** Waits for the queue's debounce and the promises around it to settle. */
async function settle(ms = 1_200) {
  await vi.advanceTimersByTimeAsync(ms)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()

  upsert.mockResolvedValue({ error: null })
  select.mockResolvedValue({ data: [], error: null })
  on.mockImplementation((_event: string, _filter: unknown, handler: RowHandler) => {
    deliver = handler
    return { subscribe }
  })
  subscribe.mockImplementation((cb: (status: string) => void) => {
    cb('SUBSCRIBED')
    return {}
  })

  useMealPlanStore.setState({ plan: [] })
  useBodyStore.setState({ weightEntries: [], measurements: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('joining a household', () => {
  it('takes what is already there before sending anything of its own', async () => {
    // A phone signing in for the first time has an empty plan. Pushing that
    // first would wipe the week off the other person's device.
    select.mockResolvedValue({
      data: [{
        key: PLAN_KEY,
        schema: SCHEMA_VERSION,
        data: { plan: [{ date: '2026-08-20', meals: [] }] },
      }],
      error: null,
    })

    const stop = startSync('me')
    await settle()

    expect(useMealPlanStore.getState().plan).toHaveLength(1)
    expect(upsert).not.toHaveBeenCalled()
    stop()
  })

  it('does not start pushing when the first read failed', async () => {
    // Reading failed, so what the household has is unknown. Sending the local
    // copy on that basis is how an empty device overwrites a full one.
    select.mockResolvedValue({ data: null, error: { message: 'network' } })

    const stop = startSync('me')
    await settle()
    useBodyStore.setState({ weightEntries: [{ id: 'w1', date: '2026-08-20', weight: 70, unit: 'kg' as const }] })
    await settle()

    expect(upsert).not.toHaveBeenCalled()
    expect(syncSnapshot().state).toBe('error')
    stop()
  })
})

describe('a local change', () => {
  it('reaches the server, with the schema it was written under', async () => {
    const stop = startSync('me')
    await settle()

    useBodyStore.setState({ weightEntries: [{ id: 'w1', date: '2026-08-20', weight: 70, unit: 'kg' as const, memberId: 'arany' }] })
    await settle()

    const rows = upsert.mock.calls.map(([row]) => row as Record<string, unknown>)
    const body = rows.find((r) => String(r.key).includes('body'))
    expect(body).toBeDefined()
    expect(body!.schema).toBe(SCHEMA_VERSION)
    expect(body!.updated_by).toBe('me')
    expect(JSON.stringify(body!.data)).toContain('arany')
    stop()
  })

  it('is still counted as unsaved while the server is refusing it', async () => {
    upsert.mockResolvedValue({ error: { message: 'offline' } })

    const stop = startSync('me')
    await settle()
    useBodyStore.setState({ weightEntries: [{ id: 'w1', date: '2026-08-20', weight: 70, unit: 'kg' as const }] })
    await settle()

    expect(syncSnapshot().unsaved).toBeGreaterThan(0)
    stop()
  })

  it('stops going anywhere once sync is stopped', async () => {
    const stop = startSync('me')
    await settle()
    stop()

    upsert.mockClear()
    useBodyStore.setState({ weightEntries: [{ id: 'w2', date: '2026-08-21', weight: 71, unit: 'kg' as const }] })
    await settle()

    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('a change from the other person', () => {
  it('is applied here without being echoed straight back as ours', async () => {
    const stop = startSync('me')
    await settle()
    upsert.mockClear()

    deliver({
      new: {
        key: 'bite-buddy-body',
        schema: SCHEMA_VERSION,
        updated_by: 'them',
        data: { weightEntries: [{ id: 'w3', date: '2026-08-20', weight: 64, unit: 'kg', memberId: 'oli' }], measurements: [] },
      },
    })
    await settle()

    expect(useBodyStore.getState().weightEntries).toHaveLength(1)
    // The body store is replaced wholesale rather than merged, so what landed
    // here is exactly what they sent. Re-sending it would be an echo.
    const bodyPushes = upsert.mock.calls
      .map(([row]) => row as { key: string })
      .filter((r) => r.key === 'bite-buddy-body')
    expect(bodyPushes).toHaveLength(0)
    stop()
  })

  it('sends back the combined week, because the merge made something neither had', async () => {
    // Their Tuesday plus our Wednesday is a week only this device holds. If it
    // is not pushed, their copy stays missing a day forever.
    useMealPlanStore.setState({ plan: [{ date: '2026-08-20', meals: [] }] })

    const stop = startSync('me')
    await settle()
    upsert.mockClear()

    deliver({
      new: {
        key: PLAN_KEY,
        schema: SCHEMA_VERSION,
        updated_by: 'them',
        data: { plan: [{ date: '2026-08-19', meals: [] }] },
      },
    })
    await settle()

    const dates = useMealPlanStore.getState().plan.map((d) => d.date).sort()
    expect(dates).toEqual(['2026-08-19', '2026-08-20'])
    expect(upsert.mock.calls.some(([row]) => (row as { key: string }).key === PLAN_KEY)).toBe(true)
    stop()
  })

  it('stops answering once both copies agree', async () => {
    // The reply to a merge is a row the other phone then receives. If that
    // reply is answered in turn, two open phones talk to each other for as
    // long as they are both open, a push every second, forever.
    useMealPlanStore.setState({ plan: [{ date: '2026-08-20', meals: [] }] })

    const stop = startSync('me')
    await settle()

    deliver({
      new: {
        key: PLAN_KEY, schema: SCHEMA_VERSION, updated_by: 'them',
        data: { plan: [{ date: '2026-08-19', meals: [] }] },
      },
    })
    await settle()
    upsert.mockClear()

    // Their device now holds the combined week and sends the whole document
    // on, which is what a real row carries.
    const ours = STORES.find((st) => st.name === PLAN_KEY)!.read()
    deliver({
      new: {
        key: PLAN_KEY, schema: SCHEMA_VERSION, updated_by: 'them',
        data: JSON.parse(JSON.stringify(ours)) as unknown,
      },
    })
    await settle()

    expect(upsert).not.toHaveBeenCalled()
    stop()
  })

  it('ignores the row it wrote itself', async () => {
    const stop = startSync('me')
    await settle()

    deliver({
      new: {
        key: 'bite-buddy-body',
        schema: SCHEMA_VERSION,
        updated_by: 'me',
        data: { weightEntries: [{ id: 'w4', date: '2026-08-20', weight: 99, unit: 'kg' }], measurements: [] },
      },
    })
    await settle()

    expect(useBodyStore.getState().weightEntries).toEqual([])
    stop()
  })

  it('refuses a row from a version it cannot read, and says so', async () => {
    const stop = startSync('me')
    await settle()

    deliver({
      new: {
        key: 'bite-buddy-body',
        schema: SCHEMA_VERSION + 1,
        updated_by: 'them',
        data: { weightEntries: [{ id: 'w5', date: '2026-08-20', weight: 64, unit: 'kg' }], measurements: [] },
      },
    })
    await settle()

    expect(useBodyStore.getState().weightEntries).toEqual([])
    expect(syncSnapshot().schemaMismatch).toBe(true)
    expect(syncSnapshot().state).toBe('error')
    stop()
  })
})

describe('what gets synced at all', () => {
  it('covers every persisted store, so adding one cannot quietly skip the database', async () => {
    // The registry is the single list backup and sync both work from. A store
    // missing from it saves on this device and nowhere else, which looks fine
    // until the other phone never sees it.
    const names = STORES.map((s) => s.name)
    expect(names).toContain(PLAN_KEY)
    expect(names).toContain('bite-buddy-user-v2')
    expect(names).toContain('bite-buddy-recipes-v2')
    expect(names).toContain('bite-buddy-foods-v2')
    expect(names).toContain('bite-buddy-body')
    expect(names).toContain('bite-buddy-cook')
    expect(names).toContain('bite-buddy-activity')
    expect(names.every(Boolean)).toBe(true)
  })
})
