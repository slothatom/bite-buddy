import { describe, it, expect } from 'vitest'
import { mergeMealPlan, mergeStore } from './merge'
import type { DayPlan, PlannedMeal } from '../types'

/**
 * The bug these exist for: you add Thursday's dinner, the other person adds
 * Friday's lunch, and whoever saves second erases the other's day. Everything
 * below is a variation on that.
 */

const meal = (id: string): PlannedMeal => ({ id, slot: 'dinner', entries: [] })

const day = (date: string, meals: PlannedMeal[], updatedAt?: string): DayPlan =>
  ({ date, meals, ...(updatedAt ? { updatedAt } : {}) })

const at = (minute: number) => `2026-08-20T10:${String(minute).padStart(2, '0')}:00.000Z`

describe('mergeMealPlan', () => {
  it('keeps both edits when they are on different days', () => {
    const local = { plan: [day('2026-08-20', [meal('mine')], at(5)), day('2026-08-21', [], at(1))] }
    const remote = { plan: [day('2026-08-20', [], at(1)), day('2026-08-21', [meal('theirs')], at(4))] }

    // The copies last agreed at :03, each day moved on exactly one side since.
    const { merged, conflicts } = mergeMealPlan(local, remote, Date.parse(at(3)))
    const days = merged.plan as DayPlan[]

    expect(days.find((d) => d.date === '2026-08-20')?.meals).toEqual([meal('mine')])
    expect(days.find((d) => d.date === '2026-08-21')?.meals).toEqual([meal('theirs')])
    expect(conflicts).toEqual([])
  })

  it('takes the newer version when the same day changed on both sides', () => {
    const local = { plan: [day('2026-08-20', [meal('mine')], at(2))] }
    const remote = { plan: [day('2026-08-20', [meal('theirs')], at(9))] }

    const { merged, conflicts } = mergeMealPlan(local, remote, Date.parse(at(0)))
    expect((merged.plan as DayPlan[])[0].meals).toEqual([meal('theirs')])
    // Losing an edit is allowed; losing it silently is not.
    expect(conflicts).toEqual(['2026-08-20'])
  })

  it('prefers the local edit on a tie', () => {
    const local = { plan: [day('2026-08-20', [meal('mine')], at(5))] }
    const remote = { plan: [day('2026-08-20', [meal('theirs')], at(5))] }

    const { merged } = mergeMealPlan(local, remote)
    // An edit vanishing under your own cursor is worse than one vanishing
    // across the room.
    expect((merged.plan as DayPlan[])[0].meals).toEqual([meal('mine')])
  })

  it('does not call an identical day a conflict', () => {
    const local = { plan: [day('2026-08-20', [meal('same')], at(2))] }
    const remote = { plan: [day('2026-08-20', [meal('same')], at(8))] }

    expect(mergeMealPlan(local, remote, Date.parse(at(0))).conflicts).toEqual([])
  })

  it('does not flag a day only one person touched', () => {
    // The everyday case: you edit, they have not seen it yet. Warning here
    // would warn on every single edit.
    const local = { plan: [day('2026-08-20', [meal('mine')], at(9))] }
    const remote = { plan: [day('2026-08-20', [], at(1))] }

    expect(mergeMealPlan(local, remote, Date.parse(at(5))).conflicts).toEqual([])
  })

  it('lets any stamped day beat one from before timestamps existed', () => {
    const local = { plan: [day('2026-08-20', [meal('migrated')])] }
    const remote = { plan: [day('2026-08-20', [meal('fresh')], at(1))] }

    const { merged } = mergeMealPlan(local, remote)
    expect((merged.plan as DayPlan[])[0].meals).toEqual([meal('fresh')])
  })

  it('keeps days that only one side knows about', () => {
    const local = { plan: [day('2026-08-20', [meal('a')], at(1))] }
    const remote = { plan: [day('2026-08-25', [meal('b')], at(1))] }

    const days = mergeMealPlan(local, remote).merged.plan as DayPlan[]
    expect(days.map((d) => d.date)).toEqual(['2026-08-20', '2026-08-25'])
  })

  it('returns days in date order', () => {
    const local = { plan: [day('2026-08-22', [], at(1)), day('2026-08-20', [], at(1))] }
    const remote = { plan: [day('2026-08-21', [], at(1))] }

    const days = mergeMealPlan(local, remote).merged.plan as DayPlan[]
    expect(days.map((d) => d.date)).toEqual(['2026-08-20', '2026-08-21', '2026-08-22'])
  })

  it('takes the other side when this device has nothing', () => {
    // A fresh device joining an existing household must not blank the week.
    const { merged } = mergeMealPlan({ plan: [] }, { plan: [day('2026-08-20', [meal('theirs')], at(1))] })
    expect((merged.plan as DayPlan[])[0].meals).toEqual([meal('theirs')])
  })

  it('carries the rest of the document through', () => {
    const local = { plan: [day('2026-08-20', [], at(1))], groceryItems: [{ id: 'x' }] }
    const remote = { plan: [day('2026-08-20', [], at(1))], groceryItems: [] }

    expect(mergeMealPlan(local, remote).merged.groceryItems).toEqual([{ id: 'x' }])
  })
})

describe('mergeStore', () => {
  it('merges the meal plan, and keeps both sides of a log', () => {
    const local = { plan: [day('2026-08-20', [meal('mine')], at(9))] }
    const remote = { plan: [day('2026-08-20', [meal('theirs')], at(1))] }

    expect((mergeStore('bite-buddy-mealplan-v2', local, remote).merged as typeof local).plan[0].meals)
      .toEqual([meal('mine')])

    // This used to take the server's sessions and drop the device's, which is
    // how a cook session booked offline disappeared on the next refresh.
    const cook = mergeStore(
      'bite-buddy-cook',
      { sessions: [{ id: 'a', label: 'mine' }] },
      { sessions: [{ id: 'b', label: 'theirs' }] },
    ).merged as { sessions: { id: string }[] }
    expect(cook.sessions.map((s) => s.id).sort()).toEqual(['a', 'b'])
  })

  it('keeps a merge made on one phone when the other pushes its copy', () => {
    // The reported one. Folding fourteen weeks of duplicates together is a job
    // you do once, and taking the remote copy wholesale undid it every time
    // the other device synced.
    const local = { custom: [], hidden: [], mergedInto: { 'food-2': 'food-1' } }
    const remote = { custom: [], hidden: [], mergedInto: {} }

    expect((mergeStore('bite-buddy-foods-v2', local, remote).merged as typeof local).mergedInto)
      .toEqual({ 'food-2': 'food-1' })
  })

  it('keeps both sides of a library rather than one', () => {
    const local = {
      custom: [{ id: 'mine', names: { en: 'Kefir' } }],
      hidden: ['food-a'],
      mergedInto: { x: 'y' },
    }
    const remote = {
      custom: [{ id: 'theirs', names: { en: 'Skyr' } }],
      hidden: ['food-b'],
      mergedInto: { p: 'q' },
    }

    const merged = mergeStore('bite-buddy-recipes-v2', local, remote).merged as typeof local
    expect(merged.custom.map((f) => f.id).sort()).toEqual(['mine', 'theirs'])
    expect([...merged.hidden].sort()).toEqual(['food-a', 'food-b'])
    expect(merged.mergedInto).toEqual({ x: 'y', p: 'q' })
  })

  it('lets this device win when both edited the same entry', () => {
    const local = { custom: [{ id: 'r1', name: 'mine' }] }
    const remote = { custom: [{ id: 'r1', name: 'theirs' }] }

    const merged = mergeStore('bite-buddy-recipes-v2', local, remote).merged as typeof local
    expect(merged.custom).toEqual([{ id: 'r1', name: 'mine' }])
  })

  it('falls back to the remote copy for anything that is not an object', () => {
    expect(mergeStore('bite-buddy-mealplan-v2', null, { plan: [] }).merged).toEqual({ plan: [] })
  })
})
