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

    // It does send, once, after the pull: the device offers whatever it holds
    // so that anything never delivered gets a go. What it must never send is
    // the empty plan it started with.
    const plan = upsert.mock.calls
      .map(([row]) => row as { key: string; data: { plan?: unknown[] } })
      .filter((r) => r.key === PLAN_KEY)
    expect(plan.every((r) => (r.data.plan ?? []).length === 1)).toBe(true)
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

    // The last body write, not the first: the device also offers what it held
    // at startup, and that one predates this edit.
    const rows = upsert.mock.calls.map(([row]) => row as Record<string, unknown>)
    const body = rows.filter((r) => String(r.key).includes('body')).at(-1)
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
    // This device held nothing, so the merge produced exactly what they sent.
    // Sending that back would be an echo, and two open phones would talk to
    // each other for as long as they were both open.
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


/**
 * The bug behind "everything disappears when I refresh".
 *
 * Every store except the week, the recipes and the foods used to take the
 * server's copy of itself whole. The pull runs at startup, before anything
 * typed in on this device has been delivered, so the server's copy replaced the
 * device's: a weight logged while the push was failing was gone the next time
 * the app opened, and a refresh looked like it emptied the app.
 */
describe('a pull must not delete what only this device has', () => {
  const BODY_KEY = 'bite-buddy-body'

  function weight(id: string, date: string, kg: number, memberId: string) {
    return { id, date, weight: kg, unit: 'kg' as const, memberId }
  }

  it('keeps a weight the server has never heard of', async () => {
    select.mockResolvedValue({
      data: [{
        key: BODY_KEY,
        schema: SCHEMA_VERSION,
        data: { weightEntries: [weight('w1', '2026-08-01', 73, 'arany')], measurements: [] },
      }],
      error: null,
    })
    useBodyStore.setState({
      weightEntries: [weight('w1', '2026-08-01', 73, 'arany'), weight('w2', '2026-08-20', 72.4, 'arany')],
      measurements: [],
    })

    const stop = startSync('me')
    await settle()

    expect(useBodyStore.getState().weightEntries.map((w) => w.id)).toContain('w2')
    stop()
  })

  it('keeps an edit the server refused, across a restart', async () => {
    // A policy that turns down every write, a paused project, a wrong key: the
    // push fails every time. The device must still hold the change, and a
    // restart must not hand it back to the server's older copy.
    select.mockResolvedValue({
      data: [{ key: BODY_KEY, schema: SCHEMA_VERSION, data: { weightEntries: [], measurements: [] } }],
      error: null,
    })
    upsert.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } })

    const stop = startSync('me')
    await settle()
    useBodyStore.setState({ weightEntries: [weight('w9', '2026-08-21', 71.8, 'arany')], measurements: [] })
    await settle(5_000)
    stop()

    expect(useBodyStore.getState().weightEntries).toHaveLength(1)

    const again = startSync('me')
    await settle()
    again()

    expect(
      useBodyStore.getState().weightEntries,
      'a weight that never reached the server was erased by the server on restart',
    ).toHaveLength(1)
  })

  it('says what the server said, rather than only that something went wrong', async () => {
    select.mockResolvedValue({ data: [], error: null })
    upsert.mockResolvedValue({ error: { message: 'new row violates row-level security policy' } })

    const stop = startSync('me')
    await settle()
    useBodyStore.setState({ weightEntries: [weight('w1', '2026-08-21', 70, 'arany')], measurements: [] })
    await settle(5_000)

    expect(syncSnapshot().lastError).toContain('row-level security')
    stop()
  })

  it('keeps both peoples rows and sends the union back', async () => {
    select.mockResolvedValue({
      data: [{
        key: BODY_KEY,
        schema: SCHEMA_VERSION,
        data: { weightEntries: [weight('oli-1', '2026-08-18', 61, 'oli')], measurements: [] },
      }],
      error: null,
    })
    useBodyStore.setState({
      weightEntries: [weight('arany-1', '2026-08-19', 72, 'arany')],
      measurements: [],
    })

    const stop = startSync('me')
    await settle()

    expect(useBodyStore.getState().weightEntries.map((w) => w.id).sort())
      .toEqual(['arany-1', 'oli-1'])

    const sent = upsert.mock.calls
      .map(([row]) => row as { key: string; data: { weightEntries: { id: string }[] } })
      .filter((r) => r.key === BODY_KEY)
      .at(-1)
    expect(sent?.data.weightEntries.map((w) => w.id).sort()).toEqual(['arany-1', 'oli-1'])
    stop()
  })

  it('offers what is on the device even when nothing has changed since it opened', async () => {
    // The queue only knows about edits made while it is running, and it lives
    // in memory. Without this, a device holding data the server never got would
    // never offer it again.
    select.mockResolvedValue({ data: [], error: null })
    useBodyStore.setState({ weightEntries: [weight('w1', '2026-08-19', 72, 'arany')], measurements: [] })

    const stop = startSync('me')
    await settle()

    expect(upsert.mock.calls.some(([row]) => (row as { key: string }).key === BODY_KEY)).toBe(true)
    stop()
  })
})
