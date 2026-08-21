import { describe, it, expect, beforeEach } from 'vitest'
import { ROW_TABLES } from './tables'
import { useMealPlanStore } from '../../store/useMealPlanStore'
import { useRecipeStore } from '../../store/useRecipeStore'
import { useBodyStore } from '../../store/useBodyStore'
import type { RowTable } from './types'

/**
 * Every table has to survive its own round trip.
 *
 * Read the state, write the rows back, and the app has to be looking at what it
 * was looking at before. A field dropped in this translation is data that
 * reaches the server and never comes home, and nothing on screen would say so.
 */
function table(name: string): RowTable {
  const found = ROW_TABLES.find((t) => t.table === name)
  if (!found) throw new Error(`no table ${name}`)
  return found
}

beforeEach(() => {
  useMealPlanStore.setState({ plan: [], groceryItems: [] })
  useRecipeStore.setState({ custom: [], hidden: [], favouriteIds: [], mergedInto: {} })
  useBodyStore.setState({ weightEntries: [], measurements: [] })
})

describe('the week', () => {
  const plan = [
    {
      date: '2026-08-20',
      meals: [
        { id: 'm1', slot: 'lunch' as const, entries: [{ kind: 'food' as const, foodId: 'f1', grams: 100 }] },
        { id: 'm2', slot: 'dinner' as const, entries: [], note: 'leftovers' },
      ],
    },
    { date: '2026-08-21', meals: [{ id: 'm3', slot: 'breakfast' as const, entries: [] }] },
  ]

  it('becomes one row per meal, with the day and slot promoted', () => {
    useMealPlanStore.setState({ plan })
    const rows = table('plan_meals').read()

    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.id).sort()).toEqual(['m1', 'm2', 'm3'])
    expect(rows.find((r) => r.id === 'm1')).toMatchObject({ day: '2026-08-20', slot: 'lunch' })
  })

  it('comes back exactly as it went, notes and all', () => {
    useMealPlanStore.setState({ plan })
    const rows = table('plan_meals').read()

    useMealPlanStore.setState({ plan: [] })
    table('plan_meals').apply(rows)

    expect(useMealPlanStore.getState().plan).toEqual(plan)
  })
})

describe('the recipe library', () => {
  const recipe = {
    id: 'mine-1', name: { en: 'Beans on toast' }, emoji: '🫘', servings: 1,
    prepMinutes: 2, cookMinutes: 5, components: [], steps: [], tags: [],
    createdAt: '2026-08-20T09:00:00.000Z',
  }

  it('folds four separate lists into one row per recipe', () => {
    useRecipeStore.setState({
      custom: [recipe],
      hidden: ['shipped-9'],
      favouriteIds: ['shipped-3'],
      mergedInto: { 'dup-1': 'shipped-3' },
    })

    const rows = table('recipes').read()
    expect(rows.map((r) => r.id).sort()).toEqual(['dup-1', 'mine-1', 'shipped-3', 'shipped-9'])
    expect(rows.find((r) => r.id === 'shipped-9')?.hidden).toBe(true)
    expect(rows.find((r) => r.id === 'shipped-3')?.favourite).toBe(true)
    expect(rows.find((r) => r.id === 'dup-1')?.merged_into).toBe('shipped-3')
  })

  it('rebuilds all four from the rows', () => {
    const before = {
      custom: [recipe],
      hidden: ['shipped-9'],
      favouriteIds: ['shipped-3'],
      mergedInto: { 'dup-1': 'shipped-3' },
    }
    useRecipeStore.setState(before)
    const rows = table('recipes').read()

    useRecipeStore.setState({ custom: [], hidden: [], favouriteIds: [], mergedInto: {} })
    table('recipes').apply(rows)

    const after = useRecipeStore.getState()
    expect(after.custom).toEqual(before.custom)
    expect(after.hidden).toEqual(before.hidden)
    expect(after.favouriteIds).toEqual(before.favouriteIds)
    expect(after.mergedInto).toEqual(before.mergedInto)
  })

  it('keeps a hidden recipe hidden, which is what deleting one means', () => {
    // Under the document model this was an entry in a list, and merging two
    // lists cannot express "this one went away".
    useRecipeStore.setState({ custom: [], hidden: ['shipped-9'], favouriteIds: [], mergedInto: {} })
    const rows = table('recipes').read()
    expect(rows).toEqual([{ id: 'shipped-9', data: null, hidden: true, favourite: false, merged_into: null }])
  })
})

describe('the personal logs', () => {
  it('promote whose they are and which day, and come back whole', () => {
    const entries = [
      { id: 'w1', date: '2026-08-19', weight: 72, unit: 'kg' as const, memberId: 'arany' },
      { id: 'w2', date: '2026-08-20', weight: 61, unit: 'kg' as const, memberId: 'oli' },
    ]
    useBodyStore.setState({ weightEntries: entries })

    const rows = table('weights').read()
    expect(rows.find((r) => r.id === 'w2')).toMatchObject({ day: '2026-08-20', member_id: 'oli' })

    useBodyStore.setState({ weightEntries: [] })
    table('weights').apply(rows)
    expect(useBodyStore.getState().weightEntries).toEqual(entries)
  })
})

describe('every table', () => {
  it('reads and writes without losing what it read', () => {
    for (const t of ROW_TABLES) {
      const rows = t.read()
      expect(() => t.apply(rows), `${t.table} could not take its own rows back`).not.toThrow()
    }
  })

  it('gives every row an id, since that is what a row is', () => {
    for (const t of ROW_TABLES) {
      for (const row of t.read()) {
        expect(row.id, `${t.table} produced a row with no id`).toBeTruthy()
      }
    }
  })
})
