import { describe, expect, it } from 'vitest'
import { getRangeDates, getWeekDates, useMealPlanStore } from './useMealPlanStore'

/**
 * The week shape is the one piece of date handling that is easy to get subtly
 * wrong and hard to notice.
 */
describe('getWeekDates', () => {
  it('runs Monday to Sunday by default', () => {
    // 2026-08-16 is a Sunday, so it is the last day of the week that began
    // on Monday the 10th, not the first day of a new one.
    const week = getWeekDates(new Date('2026-08-16T12:00:00'))
    expect(week[0]).toBe('2026-08-10')
    expect(week[6]).toBe('2026-08-16')
  })

  it('returns the same week for every day inside it', () => {
    const from = getWeekDates(new Date('2026-08-10T12:00:00'))
    const to = getWeekDates(new Date('2026-08-16T12:00:00'))
    expect(from).toEqual(to)
  })

  it('honours a different week start', () => {
    // The dietician's own weeks ran Wednesday to Tuesday.
    expect(getWeekDates(new Date('2026-08-16T12:00:00'), 3)[0]).toBe('2026-08-12')
    expect(getWeekDates(new Date('2026-08-16T12:00:00'), 0)[0]).toBe('2026-08-16')
  })

  it('always returns seven consecutive dates', () => {
    const week = getWeekDates(new Date('2026-02-27T12:00:00'))
    expect(week).toHaveLength(7)
    for (let i = 1; i < week.length; i++) {
      const gap = Date.parse(week[i]) - Date.parse(week[i - 1])
      expect(gap).toBe(86_400_000)
    }
  })

  it('does not shift the day across a daylight-saving boundary', () => {
    // Europe/Bucharest springs forward on 2026-03-29; midday anchoring keeps
    // each date on its own day regardless of the local offset.
    const week = getWeekDates(new Date('2026-03-30T12:00:00'))
    expect(new Set(week).size).toBe(7)
  })
})

describe('getRangeDates', () => {
  it('gives seven days for a week and fourteen for a fortnight', () => {
    expect(getRangeDates('2026-08-10', 'week')).toHaveLength(7)

    const fortnight = getRangeDates('2026-08-10', 'fortnight')
    expect(fortnight).toHaveLength(14)
    expect(fortnight[0]).toBe('2026-08-10')
    expect(fortnight[13]).toBe('2026-08-23')
  })

  it('pads a month out to whole weeks', () => {
    // August 2026 starts on a Saturday, so a Monday-start grid begins on
    // 27 July and runs to 6 September: six whole weeks.
    const month = getRangeDates('2026-08-10', 'month')
    expect(month.length % 7).toBe(0)
    expect(month[0]).toBe('2026-07-27')
    expect(month[month.length - 1]).toBe('2026-09-06')
    expect(month).toContain('2026-08-01')
    expect(month).toContain('2026-08-31')
  })

  it('follows the week start you chose', () => {
    // Wednesday, the day every one of the dietician's plans begins on.
    expect(getRangeDates('2026-08-12', 'month', 3)[0]).toBe('2026-07-29')
  })
})

describe('planning beyond the week on screen', () => {
  it('keeps a day you planned when the window moves off it', () => {
    // This lost work: the plan held exactly the seven days on screen, so
    // stepping to the next fortnight threw the one you had just filled in.
    const store = useMealPlanStore.getState()
    store.goToWeek(new Date('2026-08-10T12:00:00'), 1)
    store.addEntry('2026-08-12', 'lunch', { kind: 'food', foodId: 'food-apple', grams: 150 })

    store.goToWeek(new Date('2026-09-07T12:00:00'), 1)
    expect(useMealPlanStore.getState().plan.find((d) => d.date === '2026-08-12')?.meals)
      .toHaveLength(1)

    // And an empty day nobody is looking at is not kept forever.
    expect(useMealPlanStore.getState().plan.some((d) => d.date === '2026-08-13')).toBe(false)
  })

  it('creates a day that the window has never shown, rather than doing nothing', () => {
    const store = useMealPlanStore.getState()
    store.goToWeek(new Date('2026-08-10T12:00:00'), 1)
    store.addEntry('2026-11-03', 'dinner', { kind: 'food', foodId: 'food-apple', grams: 100 })

    expect(useMealPlanStore.getState().plan.find((d) => d.date === '2026-11-03')?.meals)
      .toHaveLength(1)
  })
})

describe('rearranging a week', () => {
  /** A clean plan with one meal, so each test starts from the same place. */
  function planWith(): { date: string; mealId: string } {
    useMealPlanStore.setState({ plan: [] })
    const store = useMealPlanStore.getState()
    store.goToWeek(new Date('2026-08-10T12:00:00'), 1)
    store.addEntry('2026-08-12', 'lunch', { kind: 'food', foodId: 'food-apple', grams: 150 })
    const day = useMealPlanStore.getState().plan.find((d) => d.date === '2026-08-12')!
    return { date: '2026-08-12', mealId: day.meals[0].id }
  }

  function mealsOn(date: string) {
    return useMealPlanStore.getState().plan.find((d) => d.date === date)?.meals ?? []
  }

  it('moves a meal to another day, leaving nothing behind', () => {
    const { date, mealId } = planWith()
    useMealPlanStore.getState().moveMeal(date, mealId, '2026-08-13')

    expect(mealsOn('2026-08-12')).toHaveLength(0)
    expect(mealsOn('2026-08-13')).toHaveLength(1)
    expect(mealsOn('2026-08-13')[0].slot).toBe('lunch')
  })

  it('moves a meal to another slot on the same day', () => {
    const { date, mealId } = planWith()
    useMealPlanStore.getState().moveMeal(date, mealId, date, 'dinner')

    expect(mealsOn(date)).toHaveLength(1)
    expect(mealsOn(date)[0].slot).toBe('dinner')
  })

  it('duplicates a meal without the two becoming one', () => {
    // Sharing an id would mean removing the copy removed the original too.
    const { date, mealId } = planWith()
    useMealPlanStore.getState().duplicateMeal(date, mealId, '2026-08-14', 'dinner')

    expect(mealsOn(date)).toHaveLength(1)
    expect(mealsOn('2026-08-14')).toHaveLength(1)
    expect(mealsOn('2026-08-14')[0].id).not.toBe(mealId)

    useMealPlanStore.getState().removeMeal('2026-08-14', mealsOn('2026-08-14')[0].id)
    expect(mealsOn(date)).toHaveLength(1)
  })

  it('swaps two meals, each taking the other slot as well as the other day', () => {
    const { date, mealId } = planWith()
    const store = useMealPlanStore.getState()
    store.addEntry('2026-08-14', 'dinner', { kind: 'food', foodId: 'food-banana', grams: 120 })
    const other = mealsOn('2026-08-14')[0]

    store.swapMeals({ date, mealId }, { date: '2026-08-14', mealId: other.id })

    const lunch = mealsOn(date)[0]
    const dinner = mealsOn('2026-08-14')[0]
    expect(lunch.slot).toBe('lunch')
    expect(dinner.slot).toBe('dinner')
    expect(lunch.entries).toEqual(other.entries)
    expect(dinner.entries).toEqual([{ kind: 'food', foodId: 'food-apple', grams: 150 }])
  })

  it('does nothing when the meal is not there', () => {
    const { date } = planWith()
    const before = JSON.stringify(useMealPlanStore.getState().plan)
    useMealPlanStore.getState().moveMeal(date, 'no-such-meal', '2026-08-13')
    expect(JSON.stringify(useMealPlanStore.getState().plan)).toBe(before)
  })
})
