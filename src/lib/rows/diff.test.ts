import { describe, it, expect } from 'vitest'
import { fingerprint, localChanges, applyRemote, snapshotOf } from './diff'
import type { SyncRow, TableSnapshot } from './types'

const empty: TableSnapshot = { rows: {} }
const NOW = '2026-08-21T10:00:00.000Z'

function row(id: string, data: unknown = { v: 1 }): SyncRow {
  return { id, data }
}

describe('fingerprint', () => {
  it('ignores the order the keys happen to be in', () => {
    // Rows come back from Postgres with columns in their own order. If that
    // changed the fingerprint, every row would look edited on every pull and
    // the two devices would push at each other forever.
    expect(fingerprint({ id: 'a', data: { x: 1, y: 2 } }))
      .toBe(fingerprint({ data: { y: 2, x: 1 }, id: 'a' }))
  })

  it('ignores when and by whom the server stamped it', () => {
    expect(fingerprint({ id: 'a', data: { v: 1 }, updated_at: NOW, updated_by: 'me' }))
      .toBe(fingerprint({ id: 'a', data: { v: 1 } }))
  })

  it('notices a real change', () => {
    expect(fingerprint(row('a', { v: 1 }))).not.toBe(fingerprint(row('a', { v: 2 })))
  })
})

describe('what to send', () => {
  it('sends everything the first time', () => {
    const { send } = localChanges([row('a'), row('b')], empty, NOW)
    expect(send.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('sends nothing when nothing has changed', () => {
    const rows = [row('a'), row('b')]
    const { send } = localChanges(rows, snapshotOf(rows), NOW)
    expect(send).toEqual([])
  })

  it('sends only the row that changed', () => {
    const before = [row('a', { v: 1 }), row('b', { v: 1 })]
    const after = [row('a', { v: 1 }), row('b', { v: 2 })]
    const { send } = localChanges(after, snapshotOf(before), NOW)
    expect(send.map((r) => r.id)).toEqual(['b'])
  })

  it('turns a row that has gone into a tombstone', () => {
    // The reason for the whole rewrite. A document can only say what exists,
    // so deleting on one phone and having the other put it back was not
    // fixable inside that shape.
    const before = [row('a'), row('b')]
    const { send } = localChanges([row('a')], snapshotOf(before), NOW)
    expect(send).toEqual([{ id: 'b', deleted_at: NOW }])
  })

  it('does not keep re-sending a deletion once it is agreed', () => {
    const before = [row('a'), row('b')]
    const first = localChanges([row('a')], snapshotOf(before), NOW)
    const second = localChanges([row('a')], first.next, NOW)
    expect(second.send).toEqual([])
  })
})

describe('what arrives from the other phone', () => {
  it('adds a row this device has never seen', () => {
    const { rows } = applyRemote([row('a')], [{ ...row('b'), updated_at: NOW }], snapshotOf([row('a')]))
    expect(rows.map((r) => r.id).sort()).toEqual(['a', 'b'])
  })

  it('applies their deletion', () => {
    const local = [row('a'), row('b')]
    const { rows } = applyRemote(local, [{ id: 'b', deleted_at: NOW, updated_at: NOW }], snapshotOf(local))
    expect(rows.map((r) => r.id)).toEqual(['a'])
  })

  it('keeps a local edit that has not been delivered yet', () => {
    // The bug that emptied the app: a pull ran at startup and replaced what was
    // on the device with the server's older copy.
    const agreed = snapshotOf([row('a', { v: 1 })])
    const local = [row('a', { v: 2 })]
    const { rows } = applyRemote(local, [{ ...row('a', { v: 1 }), updated_at: NOW }], agreed)
    expect(rows).toEqual([row('a', { v: 2 })])
  })

  it('keeps a row the server says was deleted, when this device has just edited it', () => {
    const agreed = snapshotOf([row('a', { v: 1 })])
    const local = [row('a', { v: 2 })]
    const { rows } = applyRemote(local, [{ id: 'a', deleted_at: NOW, updated_at: NOW }], agreed)
    expect(rows).toEqual([row('a', { v: 2 })])
  })

  it('takes their version of a row this device has not touched', () => {
    const local = [row('a', { v: 1 })]
    const { rows } = applyRemote(local, [{ ...row('a', { v: 9 }), updated_at: NOW }], snapshotOf(local))
    expect(rows[0].data).toEqual({ v: 9 })
  })

  it('ignores a tombstone for something it never had', () => {
    const { rows } = applyRemote([], [{ id: 'gone', deleted_at: NOW, updated_at: NOW }], empty)
    expect(rows).toEqual([])
  })

  it('moves the watermark to the newest thing it saw', () => {
    const { watermark } = applyRemote([], [
      { ...row('a'), updated_at: '2026-08-20T10:00:00.000Z' },
      { ...row('b'), updated_at: '2026-08-21T10:00:00.000Z' },
    ], empty)
    expect(watermark).toBe('2026-08-21T10:00:00.000Z')
  })

  it('never moves the watermark backwards', () => {
    const { watermark } = applyRemote([], [{ ...row('a'), updated_at: '2026-01-01T00:00:00.000Z' }], {
      rows: {}, watermark: NOW,
    })
    expect(watermark).toBe(NOW)
  })
})

describe('a deletion made here, before the server has heard', () => {
  it('is not undone by their copy still having the row', () => {
    const before = [row('a'), row('b')]
    const { next } = localChanges([row('a')], snapshotOf(before), NOW)

    const { rows } = applyRemote([row('a')], [{ ...row('b'), updated_at: NOW }], next)
    expect(rows.map((r) => r.id)).toEqual(['a'])
  })

  it('is forgotten about once their copy agrees it is gone', () => {
    const before = [row('a'), row('b')]
    const { next } = localChanges([row('a')], snapshotOf(before), NOW)

    const { rows } = applyRemote([row('a')], [{ id: 'b', deleted_at: NOW, updated_at: NOW }], next)
    expect(rows.map((r) => r.id)).toEqual(['a'])
  })
})

describe('when both of you changed the same thing', () => {
  it('keeps this device version and says that it happened', () => {
    // One of the two edits has to go. Losing it silently is the version of
    // this that makes an app untrustworthy.
    const agreed = snapshotOf([row('a', { v: 1 })])
    const local = [row('a', { v: 2 })]
    const theirs = { ...row('a', { v: 3 }), updated_at: NOW }

    const { rows, contested } = applyRemote(local, [theirs], agreed, new Set(['a']))
    expect(rows).toEqual([row('a', { v: 2 })])
    expect(contested.map((r) => r.id)).toEqual(['a'])
  })

  it('says nothing when only one side moved', () => {
    const agreed = snapshotOf([row('a', { v: 1 })])
    const { contested } = applyRemote([row('a', { v: 1 })], [{ ...row('a', { v: 3 }), updated_at: NOW }], agreed)
    expect(contested).toEqual([])
  })
})

describe('a row that has been round the database', () => {
  it('fingerprints the same as the one the app produced', () => {
    // Postgres returns every column, so a field the app leaves out comes back
    // as null. Treating that as a change means two phones push the same row at
    // each other for as long as they are both open.
    const asWritten: SyncRow = { id: 'w1', data: { weight: 72 }, day: '2026-08-19' }
    const asReturned: SyncRow = {
      id: 'w1', data: { weight: 72 }, day: '2026-08-19',
      member_id: null, deleted_at: null, merged_into: null,
      updated_at: NOW, updated_by: 'someone',
    }
    expect(fingerprint(asReturned)).toBe(fingerprint(asWritten))
  })

  it('is not sent straight back after being received', () => {
    const asReturned: SyncRow = {
      id: 'w1', data: { weight: 72 }, day: '2026-08-19',
      member_id: null, deleted_at: null, updated_at: NOW,
    }
    const { agreed } = applyRemote([], [asReturned], empty)
    const { send } = localChanges([{ id: 'w1', data: { weight: 72 }, day: '2026-08-19' }], { rows: agreed }, NOW)
    expect(send).toEqual([])
  })
})

describe('an id that comes back from the dead', () => {
  it('says so, instead of leaving the server calling it deleted', () => {
    // A grocery line's id is the food's id, so `tomatoes` is deleted and
    // re-created every time a staple leaves a list and comes back. An upsert
    // writes only the columns it is given, so a revived row that never
    // mentions `deleted_at` left the old timestamp standing: this device
    // called the row alive, the server went on calling it deleted, and the
    // next pull that reached the tombstone removed it. That is a shopping list
    // emptying itself a second after you add something to it.
    const revived = { id: 'tomatoes', data: { id: 'tomatoes', name: 'Tomatoes' } }
    const { send } = localChanges([revived], { rows: {} }, '2026-09-06T12:00:00.000Z')

    expect(send).toHaveLength(1)
    expect(send[0].deleted_at).toBeNull()
  })

  it('does not make the row look changed, so nothing is sent twice', () => {
    // `fingerprint` drops null fields, so saying it costs no extra traffic.
    const row = { id: 'tomatoes', data: { id: 'tomatoes', name: 'Tomatoes' } }
    const agreed = { rows: { tomatoes: fingerprint(row) } }

    expect(localChanges([row], agreed, '2026-09-06T12:00:00.000Z').send).toHaveLength(0)
  })
})
