import { describe, it, expect, beforeEach } from 'vitest'
import { describe as label, restoreTheirs, useConflicts, MAX_CONFLICTS } from './conflicts'
import { applyRemote, snapshotOf } from './diff'
import type { RowTable, SyncRow } from './types'

function fakeTable(name: string, state: { rows: SyncRow[] }): RowTable {
  return {
    table: name,
    read: () => state.rows.map((r) => ({ ...r })),
    apply: (rows) => { state.rows = rows.map((r) => ({ ...r })) },
  }
}

beforeEach(() => useConflicts.setState({ items: [] }))

describe('what a clash is called', () => {
  it('names the day as a day, not a date string', () => {
    // The old banner handed "a meal on 2026-11-10" to a date parser.
    expect(label('plan_meals', { id: 'm', day: '2026-11-10' })).toBe('a meal on Tuesday 10 Nov')
  })

  it('copes with a timestamp-shaped day and with none at all', () => {
    expect(label('plan_meals', { id: 'm', day: '2026-11-10T00:00:00.000Z' })).toBe('a meal on Tuesday 10 Nov')
    expect(label('recipes', { id: 'r' })).toBe('a recipe')
    expect(label('mystery', { id: 'x', day: 'not a day' })).toBe('an entry')
  })
})

describe('the other person\'s version', () => {
  const agreed: SyncRow = { id: 'm', day: '2026-11-10', data: { kcal: 400 } }
  const mine: SyncRow = { ...agreed, data: { kcal: 450 } }
  const theirs: SyncRow = { ...agreed, data: { kcal: 520 }, updated_at: '2026-11-10T09:00:00Z' }

  it('is reported when both sides moved, and this device keeps its own', () => {
    const { rows, contested } = applyRemote([mine], [theirs], snapshotOf([agreed]), new Set(['m']))
    expect(contested).toEqual([theirs])
    expect(rows).toEqual([mine])
  })

  it('is kept until somebody chooses, and a second clash on the same row replaces the first', () => {
    useConflicts.getState().add('plan_meals', [theirs])
    useConflicts.getState().add('plan_meals', [{ ...theirs, data: { kcal: 600 } }])
    const items = useConflicts.getState().items
    expect(items).toHaveLength(1)
    expect(items[0].theirs.data).toEqual({ kcal: 600 })
  })

  it('does not pile up forever', () => {
    const many = Array.from({ length: MAX_CONFLICTS + 5 }, (_, i) => ({ id: `r${i}` }))
    useConflicts.getState().add('recipes', many)
    expect(useConflicts.getState().items).toHaveLength(MAX_CONFLICTS)
  })

  it('can be restored, replacing this device\'s version', () => {
    const state = { rows: [mine, { id: 'other', data: 1 }] }
    useConflicts.getState().add('plan_meals', [theirs])
    restoreTheirs(fakeTable('plan_meals', state), useConflicts.getState().items[0])
    expect(state.rows.find((r) => r.id === 'm')?.data).toEqual({ kcal: 520 })
    expect(state.rows.find((r) => r.id === 'other')).toBeTruthy()
  })

  it('restores a deletion as a deletion', () => {
    const state = { rows: [mine] }
    useConflicts.getState().add('plan_meals', [{ ...theirs, deleted_at: '2026-11-10T09:00:00Z' }])
    restoreTheirs(fakeTable('plan_meals', state), useConflicts.getState().items[0])
    expect(state.rows).toEqual([])
  })
})
