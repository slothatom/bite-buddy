import { describe, it, expect, beforeEach } from 'vitest'

/**
 * Finding the household at sign-in.
 *
 * Three outcomes, and each needs a different screen: in one (the app), invited
 * to one (join it, then the app), and neither (the screen to start one). The
 * fourth, the database refusing to answer, must keep a cached household rather
 * than throw the people away, or a phone in a tunnel forgets who lives there.
 */

const db = {
  members: [] as Record<string, unknown>[],
  membersError: null as { message: string } | null,
  acceptError: null as { code?: string; message: string } | null,
  onAccept: () => {},
  rpcs: [] as string[],
}

const client = {
  rpc: async (name: string) => {
    db.rpcs.push(name)
    if (name === 'accept_invite') {
      if (db.acceptError) return { data: null, error: db.acceptError }
      db.onAccept()
    }
    return { data: null, error: null }
  },
  from: (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      order: () => chain,
      maybeSingle: async () => ({ data: { id: 'h1', name: 'Home' }, error: null }),
      then: (fn: (r: unknown) => unknown) => Promise.resolve(fn(
        table === 'household_members'
          ? { data: db.membersError ? null : db.members, error: db.membersError }
          : { data: [], error: null },
      )),
    }
    return chain
  },
}

const { connectHousehold, useHousehold, peopleFrom } = await import('./useHousehold')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
connectHousehold(client as any, true)

const row = (user: string, key: string, role = 'admin') => ({
  household_id: 'h1', user_id: user, role, person_key: key,
  display_name: key[0].toUpperCase() + key.slice(1), email: `${key}@example.com`, created_at: user,
})

beforeEach(() => {
  db.members = []
  db.membersError = null
  db.acceptError = null
  db.onAccept = () => {}
  db.rpcs = []
  useHousehold.getState().clear()
})

describe('load', () => {
  it('reads the household and its people', async () => {
    db.members = [row('u1', 'arany'), row('u2', 'oli', 'editor')]
    await useHousehold.getState().load('u1')

    const s = useHousehold.getState()
    expect(s.status).toBe('member')
    expect(s.household).toEqual({ id: 'h1', name: 'Home' })
    expect(s.members.map((m) => m.personKey)).toEqual(['arany', 'oli'])
    expect(db.rpcs).toEqual([])
  })

  it('accepts a waiting invite, then reads the household it joined', async () => {
    db.onAccept = () => { db.members = [row('u1', 'arany'), row('u9', 'new', 'viewer')] }
    await useHousehold.getState().load('u9')

    expect(db.rpcs).toEqual(['accept_invite'])
    expect(useHousehold.getState().status).toBe('member')
  })

  it('says "none" when nobody has invited this account, so it can start a household', async () => {
    db.acceptError = { code: 'P0002', message: 'No invitation' }
    await useHousehold.getState().load('u9')

    expect(useHousehold.getState().status).toBe('none')
    expect(useHousehold.getState().household).toBeNull()
  })

  it('keeps the cached household when the database cannot be reached', async () => {
    db.members = [row('u1', 'arany')]
    await useHousehold.getState().load('u1')
    db.membersError = { message: 'Failed to fetch' }
    await useHousehold.getState().load('u1')

    expect(useHousehold.getState().members).toHaveLength(1)
    expect(useHousehold.getState().household?.id).toBe('h1')
  })

  it('starts clean for a different account', async () => {
    db.members = [row('u1', 'arany')]
    await useHousehold.getState().load('u1')
    db.acceptError = { code: 'P0002', message: 'No invitation' }
    db.members = []
    await useHousehold.getState().load('u2')

    expect(useHousehold.getState().members).toEqual([])
    expect(useHousehold.getState().userId).toBe('u2')
  })
})

describe('switching household', () => {
  it('forgets what was agreed with the old one, and only then', async () => {
    const { useSyncState } = await import('../lib/rows/store')
    db.members = [row('u1', 'arany')]

    useSyncState.setState({ tables: { weights: { rows: { w1: 'x' }, watermark: '2026-08-01' } } })
    useHousehold.setState({ syncedFor: 'h1' })
    await useHousehold.getState().load('u1')
    expect(useSyncState.getState().tables.weights).toBeDefined()

    useHousehold.setState({ syncedFor: 'h-old' })
    await useHousehold.getState().load('u1')
    expect(useSyncState.getState().tables).toEqual({})
    expect(useHousehold.getState().syncedFor).toBe('h1')
  })
})

describe('peopleFrom', () => {
  it('is the members when there are some, and one "Me" when there are none', () => {
    expect(peopleFrom([])).toEqual([{ id: 'me', name: 'Me' }])
  })
})
