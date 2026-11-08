import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RowSync } from './engine'
import { useSyncState } from './store'
import { snapshotOf } from './diff'
import type { RowTable, SyncRow } from './types'

/**
 * The engine against a database that answers, refuses, and forgets.
 *
 * The rules about what wins live in diff.ts and are tested there. What is
 * tested here is the part that only goes wrong in the world: the order of pull
 * and push, what happens when a write is turned down, and whether a device
 * stops talking when it is told to.
 */

/** A table backed by a plain array, so a test can be the app. */
function fakeTable(name: string, state: { rows: SyncRow[] }): RowTable {
  return {
    table: name,
    read: () => state.rows.map((r) => ({ ...r })),
    apply: (rows) => { state.rows = rows.map((r) => ({ ...r })) },
  }
}

/**
 * The part of a PostgREST query the engine uses: gte, the keyset `or`, order
 * by (updated_at, id), and a row limit like the server's own cap.
 */
function fakeQuery(all: () => SyncRow[], refuse?: string) {
  const preds: ((r: SyncRow) => boolean)[] = []
  let cap = Infinity
  const q = {
    gte: (_col: string, value: string) => { preds.push((r) => (r.updated_at ?? '') >= value); return q },
    or: (filter: string) => {
      const m = /^updated_at\.gt\.(".*?"),and\(updated_at\.eq\.".*?",id\.gt\.(".*?")\)$/.exec(filter)
      if (!m) throw new Error(`unexpected filter ${filter}`)
      const at = JSON.parse(m[1]) as string
      const id = JSON.parse(m[2]) as string
      preds.push((r) => (r.updated_at ?? '') > at || ((r.updated_at ?? '') === at && r.id > id))
      return q
    },
    order: () => q,
    limit: (n: number) => { cap = n; return q },
    then: (fn: (r: unknown) => unknown) => {
      const data = all()
        .filter((r) => preds.every((p) => p(r)))
        .sort((a, b) => (a.updated_at ?? '').localeCompare(b.updated_at ?? '') || a.id.localeCompare(b.id))
        .slice(0, cap)
      return Promise.resolve(fn({ data, error: refuse ? { message: refuse } : null }))
    },
  }
  return q
}

/** A database that holds rows and can be made to refuse. */
function fakeDb(server: Map<string, SyncRow>, opts: { refuse?: string } = {}) {
  const upserted: SyncRow[][] = []
  const db = {
    upserted,
    selects: 0,
    from: () => ({
      select: () => {
        db.selects++
        return fakeQuery(() => [...server.values()], opts.refuse)
      },
      upsert: async (rows: SyncRow[]) => {
        if (opts.refuse) return { error: { message: opts.refuse } }
        upserted.push(rows)
        for (const row of rows) server.set(row.id, { ...row, updated_at: row.updated_at ?? '2026-08-21T12:00:00.000Z' })
        return { error: null }
      },
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  }
  return db
}

beforeEach(() => {
  useSyncState.setState({ tables: {} })
})

describe('a round', () => {
  it('takes what the household has before sending anything', async () => {
    const server = new Map<string, SyncRow>([
      ['theirs', { id: 'theirs', data: { v: 1 }, updated_at: '2026-08-21T10:00:00.000Z' }],
    ])
    const state = { rows: [{ id: 'mine', data: { v: 1 } }] }
    const db = fakeDb(server)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(db as any, [fakeTable('t', state)], 'me')
    await sync.round()

    expect(state.rows.map((r) => r.id).sort()).toEqual(['mine', 'theirs'])
    expect([...server.keys()].sort()).toEqual(['mine', 'theirs'])
  })

  it('sends nothing at all when nothing has changed', async () => {
    const server = new Map<string, SyncRow>()
    const state = { rows: [{ id: 'a', data: { v: 1 } }] }
    const db = fakeDb(server)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(db as any, [fakeTable('t', state)], 'me')
    await sync.round()
    await sync.round()

    expect(db.upserted).toHaveLength(1)
  })

  it('keeps a refused write pending rather than pretending it landed', async () => {
    const state = { rows: [{ id: 'a', data: { v: 1 } }] }
    const refusing = fakeDb(new Map(), { refuse: 'new row violates row-level security policy' })
    const said: string[] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(refusing as any, [fakeTable('t', state)], 'me', {
      onError: (m) => said.push(m),
    })
    const ok = await sync.round()

    expect(ok).toBe(false)
    expect(said.join()).toContain('row-level security')
    // The row is still on the device, and still owed to the server.
    expect(state.rows).toHaveLength(1)

    const server = new Map<string, SyncRow>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const later = new RowSync(fakeDb(server) as any, [fakeTable('t', state)], 'me')
    await later.round()
    expect([...server.keys()]).toEqual(['a'])
  })

  it('sends a deletion, and does not send it twice', async () => {
    const server = new Map<string, SyncRow>()
    const state = { rows: [{ id: 'a', data: { v: 1 } }, { id: 'b', data: { v: 1 } }] }
    const db = fakeDb(server)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(db as any, [fakeTable('t', state)], 'me')

    await sync.round()
    state.rows = state.rows.filter((r) => r.id !== 'b')
    await sync.round()

    expect(server.get('b')?.deleted_at).toBeTruthy()

    db.upserted.length = 0
    await sync.round()
    expect(db.upserted).toHaveLength(0)
  })

  it('stops talking the moment it is told to', async () => {
    const server = new Map<string, SyncRow>()
    const state = { rows: [{ id: 'a', data: { v: 1 } }] }
    const db = fakeDb(server)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(db as any, [fakeTable('t', state)], 'me')

    sync.stop()
    await sync.round()

    expect(db.upserted).toHaveLength(0)
  })
})

describe('the watermark', () => {
  it('asks only for what changed after the first time', async () => {
    const server = new Map<string, SyncRow>([
      ['a', { id: 'a', data: { v: 1 }, updated_at: '2026-08-21T10:00:00.000Z' }],
    ])
    const state = { rows: [] as SyncRow[] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(fakeDb(server) as any, [fakeTable('t', state)], 'me')

    await sync.round()
    expect(useSyncState.getState().snapshotFor('t').watermark).toBe('2026-08-21T10:00:00.000Z')
  })

  it('reads every page, not just the first thousand rows', async () => {
    // 2,500 rows, many sharing a stamp, as one bulk write produces.
    const server = new Map<string, SyncRow>(
      Array.from({ length: 2500 }, (_, i) => {
        const id = `w${String(i).padStart(4, '0')}`
        const at = `2026-08-21T10:${String(Math.floor(i / 100)).padStart(2, '0')}:00.000Z`
        return [id, { id, data: { v: i }, updated_at: at }] as const
      }),
    )
    const state = { rows: [] as SyncRow[] }
    const db = fakeDb(server)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(db as any, [fakeTable('t', state)], 'me')

    await sync.round()

    expect(state.rows).toHaveLength(2500)
    expect(db.selects).toBe(3)
    expect(useSyncState.getState().snapshotFor('t').watermark).toBe('2026-08-21T10:24:00.000Z')
  })

  it('still finds a row that committed with a stamp older than the watermark', async () => {
    const server = new Map<string, SyncRow>([
      ['a', { id: 'a', data: { v: 1 }, updated_at: '2026-08-21T10:00:30.000Z' }],
    ])
    const state = { rows: [] as SyncRow[] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(fakeDb(server) as any, [fakeTable('t', state)], 'me')
    await sync.round()

    // A slow transaction stamped before `a` but committed after the pull.
    server.set('late', { id: 'late', data: { v: 2 }, updated_at: '2026-08-21T10:00:10.000Z' })
    await sync.round()

    expect(state.rows.map((r) => r.id).sort()).toEqual(['a', 'late'])
  })

  it('does not report rows it already had as news', async () => {
    const server = new Map<string, SyncRow>([
      ['a', { id: 'a', data: { v: 1 }, updated_at: '2026-08-21T10:00:00.000Z' }],
    ])
    const state = { rows: [] as SyncRow[] }
    const applied = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(fakeDb(server) as any, [fakeTable('t', state)], 'me', { onApplied: applied })
    await sync.round()
    await sync.round()

    expect(applied).toHaveBeenCalledTimes(1)
  })
})

describe('a device that has lost its own storage', () => {
  it('refuses to publish that as everybody deleting everything', async () => {
    // Local state empty, the record of what used to exist intact: from in here
    // that is indistinguishable from deleting all of it, and publishing it
    // faithfully would take the other person's copy down too.
    const server = new Map<string, SyncRow>()
    const state = {
      rows: Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, data: { v: i } })),
    }
    const db = fakeDb(server)
    const held: { table: string }[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(db as any, [fakeTable('t', state)], 'me', { onHeldBack: (h) => held.push(h) })

    await sync.round()
    expect(server.size).toBe(12)

    state.rows = []
    db.upserted.length = 0
    const ok = await sync.round()

    expect(ok).toBe(false)
    expect(db.upserted).toHaveLength(0)
    expect(server.size).toBe(12)
    expect(held.map((h) => h.table)).toEqual(['t'])
  })

  it('says what it is holding, so the screen can ask', async () => {
    const server = new Map<string, SyncRow>()
    const state = { rows: Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, data: { v: i } })) }
    const held: { table: string; deletions: number; known: number }[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(fakeDb(server) as any, [fakeTable('t', state)], 'me', {
      onHeldBack: (h) => held.push(h),
    })

    await sync.round()
    state.rows = []
    await sync.round()

    expect(held).toEqual([{ table: 't', deletions: 12, known: 12 }])
  })

  it('sends them once the person says they meant it', async () => {
    // Emptying a shopping list of twenty-one things looks exactly like a wiped
    // browser from in here, and only the person holding the phone knows which.
    const server = new Map<string, SyncRow>()
    const state = { rows: Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, data: { v: i } })) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(fakeDb(server) as any, [fakeTable('t', state)], 'me')

    await sync.round()
    state.rows = []
    expect(await sync.round()).toBe(false)

    sync.allowDeletions('t')
    expect(await sync.round()).toBe(true)
    expect(server.get('r0')?.deleted_at).toBeTruthy()
  })

  it('spends that answer once rather than remembering it', async () => {
    // Agreeing to empty a list today must not wave through a lost browser
    // tomorrow, so the permission covers the push it was given for.
    const server = new Map<string, SyncRow>()
    const state = { rows: Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, data: { v: i } })) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(fakeDb(server) as any, [fakeTable('t', state)], 'me')

    await sync.round()
    state.rows = []
    sync.allowDeletions('t')
    await sync.round()

    // A second wholesale deletion, this time unannounced.
    state.rows = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, data: { v: i } }))
    await sync.round()
    state.rows = []
    expect(await sync.round()).toBe(false)
  })

  it('keeps the question up while another table goes through', async () => {
    // The banner's answer button hangs off this. Clearing the question because
    // some unrelated table delivered would take the only way out away.
    const server = new Map<string, SyncRow>()
    const held = { rows: Array.from({ length: 12 }, (_, i) => ({ id: `h${i}`, data: { v: i } })) }
    const other = { rows: [{ id: 'o1', data: { v: 1 } }] }
    const delivered: string[] = []
    const sync = new RowSync(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeDb(server) as any,
      [fakeTable('held', held), fakeTable('other', other)],
      'me',
      { onDelivered: (t) => delivered.push(t) },
    )

    await sync.round()
    delivered.length = 0

    held.rows = []
    other.rows = [...other.rows, { id: 'o2', data: { v: 2 } }]
    await sync.round()

    expect(delivered).toEqual(['other'])
  })

  it('lets an ordinary handful of deletions through', async () => {
    const server = new Map<string, SyncRow>()
    const state = {
      rows: Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, data: { v: i } })),
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(fakeDb(server) as any, [fakeTable('t', state)], 'me')

    await sync.round()
    state.rows = state.rows.slice(0, 9)
    await sync.round()

    expect(server.get('r11')?.deleted_at).toBeTruthy()
  })
})

describe('live changes', () => {
  /** A database whose realtime channel can be fired by hand. */
  function liveDb() {
    let handler: ((payload: { new: SyncRow }) => void) | undefined
    const db = {
      ...fakeDb(new Map()),
      channel: () => ({
        on: (_e: string, _f: unknown, fn: (payload: { new: SyncRow }) => void) => {
          handler = fn
          return { subscribe: () => ({}) }
        },
      }),
    }
    return { db, fire: (row: SyncRow) => handler?.({ new: row }) }
  }

  it("arrive from your own other device, not only from the other person's", async () => {
    const state = { rows: [{ id: 'a', data: { v: 1 } }] as SyncRow[] }
    useSyncState.getState().remember('t', snapshotOf(state.rows))
    const { db, fire } = liveDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(db as any, [fakeTable('t', state)], 'me')
    sync.watch()

    // Same account, written on the laptop.
    fire({ id: 'a', data: { v: 2 }, updated_by: 'me', updated_at: '2026-11-08T10:00:00Z' })
    expect(state.rows[0].data).toEqual({ v: 2 })
  })

  it('skip an echo of what this device already holds, even before its push is recorded', async () => {
    // Edited here; the push has gone out but has not been remembered yet.
    const state = { rows: [{ id: 'a', data: { v: 2 } }] as SyncRow[] }
    useSyncState.getState().remember('t', snapshotOf([{ id: 'a', data: { v: 1 } }]))
    const contested = vi.fn()
    const applied = vi.fn()
    const { db, fire } = liveDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(db as any, [fakeTable('t', state)], 'me', { onContested: contested, onApplied: applied })
    sync.watch()

    fire({ id: 'a', data: { v: 2 }, updated_by: 'me', updated_at: '2026-11-08T10:00:00Z' })
    expect(contested).not.toHaveBeenCalled()
    expect(applied).not.toHaveBeenCalled()
  })

  it('skip the echo of a deletion made here', async () => {
    const state = { rows: [] as SyncRow[] }
    useSyncState.getState().remember('t', snapshotOf([{ id: 'a', data: { v: 1 } }]))
    const contested = vi.fn()
    const { db, fire } = liveDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sync = new RowSync(db as any, [fakeTable('t', state)], 'me', { onContested: contested })
    sync.watch()

    fire({ id: 'a', deleted_at: '2026-11-08T10:00:00Z', updated_by: 'me' })
    expect(contested).not.toHaveBeenCalled()
    expect(state.rows).toEqual([])
  })
})

describe('households', () => {
  it('writes every row to its household, matched on (household_id, id)', async () => {
    const server = new Map<string, SyncRow>()
    const state = { rows: [{ id: 'profile', data: { v: 1 } }] }
    const db = fakeDb(server)
    const options: unknown[] = []
    const from = db.from
    db.from = () => {
      const t = from()
      return {
        ...t,
        upsert: async (rows: SyncRow[], opts?: unknown) => { options.push(opts); return t.upsert(rows) },
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await new RowSync(db as any, [fakeTable('settings', state)], 'u1', {}, 'h1').round()

    expect(db.upserted[0][0]).toMatchObject({ id: 'profile', household_id: 'h1', updated_by: 'u1' })
    expect(options[0]).toEqual({ onConflict: 'household_id,id' })
  })

  it('does not hand the household column to the app, or treat it as a change', async () => {
    // The app's rows never carry it. Kept on the way in, every row from the
    // server would fingerprint differently from the same row read locally.
    const server = new Map<string, SyncRow>([
      ['a', { id: 'a', data: { v: 1 }, household_id: 'h1', updated_at: '2026-08-21T10:00:00.000Z' }],
    ])
    const state = { rows: [] as SyncRow[] }
    const db = fakeDb(server)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const engine = new RowSync(db as any, [fakeTable('settings', state)], 'u1', {}, 'h1')

    await engine.round()
    expect(state.rows).toEqual([{ id: 'a', data: { v: 1 }, updated_at: '2026-08-21T10:00:00.000Z' }])

    await engine.round()
    expect(db.upserted).toHaveLength(0)
  })
})
