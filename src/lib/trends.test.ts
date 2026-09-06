import { describe, it, expect } from 'vitest'
import type { DayPlan } from '../types'
import { buildContext } from './nutrition'
import { FOODS, ALL_RECIPES } from '../data'
import { direction, foodsEaten, smooth, spanDates, trend } from './trends'

const ctx = buildContext(FOODS, ALL_RECIPES)

const day = (date: string, grams: number, outcome?: 'eaten' | 'skipped'): DayPlan => ({
  date,
  updatedAt: new Date(0).toISOString(),
  meals: [{
    id: `m-${date}`,
    slot: 'breakfast',
    entries: [{ kind: 'food', foodId: 'apple', grams }],
    ...(outcome ? { outcome } : {}),
  }],
})

describe('the stretch a trend is read over', () => {
  it('ends today and runs backwards, oldest first', () => {
    const dates = spanDates('fortnight', '2026-09-06')
    expect(dates).toHaveLength(14)
    expect(dates[13]).toBe('2026-09-06')
    expect(dates[0]).toBe('2026-08-24')
  })
})

describe('what a stretch of days comes to', () => {
  it('averages only the days that hold something', () => {
    // An empty day is not a day you ate nothing, and dividing by it would
    // report a fortnight of two dinners as a fortnight of very little food.
    const dates = spanDates('fortnight', '2026-09-06')
    const out = trend(dates, [day('2026-09-06', 100), day('2026-09-05', 200)], ctx)

    expect(out.withFood).toHaveLength(2)
    expect(out.average?.calories).toBeCloseTo(
      (out.withFood[0].nutrients.calories + out.withFood[1].nutrients.calories) / 2, 5,
    )
  })

  it('has no average at all for a stretch with no food in it', () => {
    // Not a row of zeroes. The app knows nothing about those days.
    const out = trend(spanDates('fortnight', '2026-09-06'), [], ctx)
    expect(out.average).toBeNull()
    expect(out.withFood).toHaveLength(0)
  })

  it('says how much of it is a record and how much an intention', () => {
    const out = trend(
      spanDates('fortnight', '2026-09-06'),
      [day('2026-09-06', 100, 'eaten'), day('2026-09-05', 100)],
      ctx,
    )
    expect(out.recorded).toBe(1)
    expect(out.planned).toBe(1)
  })
})

describe('which way it is going', () => {
  it('compares the two halves and says how many days are behind each', () => {
    // Not a fitted slope. A line through twenty-eight noisy days gives a
    // number with a decimal point and no meaning.
    const dates = spanDates('fortnight', '2026-09-14')
    const plan = [
      ...dates.slice(0, 7).map((d) => day(d, 100)),
      ...dates.slice(7).map((d) => day(d, 200)),
    ]
    const out = direction(trend(dates, plan, ctx).days, (n) => n.calories)

    expect(out.earlierDays).toBe(7)
    expect(out.laterDays).toBe(7)
    expect(out.change).toBeGreaterThan(0)
  })

  it('has no change to report when one half is empty', () => {
    const dates = spanDates('fortnight', '2026-09-14')
    const out = direction(trend(dates, [day(dates[13], 100)], ctx).days, (n) => n.calories)
    expect(out.change).toBeNull()
    expect(out.earlierDays).toBe(0)
  })
})

describe('the foods a stretch is made of', () => {
  it('counts a food once for each day it turns up on', () => {
    // Days, not helpings. Olive oil is in everything and weighs nothing; a
    // roast weighs a kilo and happens once. Days is what a habit is.
    const dates = ['2026-09-05', '2026-09-06']
    const out = foodsEaten(dates, [day('2026-09-05', 100), day('2026-09-06', 150)], ctx)

    const apple = out.find((f) => f.foodId === 'apple')
    expect(apple?.days).toBe(2)
    expect(apple?.grams).toBe(250)
  })

  it('leaves out a meal you said you skipped', () => {
    // The same rule the day totals use. A skipped meal is not food you ate.
    const out = foodsEaten(['2026-09-06'], [day('2026-09-06', 100, 'skipped')], ctx)
    expect(out).toHaveLength(0)
  })

  it('walks a recipe down to what was actually bought', () => {
    // A week of the dietician's lunches should report salmon and bulgur, not
    // twelve recipe names.
    const withRecipe: DayPlan = {
      date: '2026-09-06',
      updatedAt: new Date(0).toISOString(),
      meals: [{
        id: 'm1', slot: 'lunch',
        entries: [{ kind: 'recipe', recipeId: ALL_RECIPES[0].id, servings: 1 }],
      }],
    }
    const out = foodsEaten(['2026-09-06'], [withRecipe], ctx)
    expect(out.length).toBeGreaterThan(0)
    expect(out.every((f) => FOODS.some((food) => food.id === f.foodId))).toBe(true)
  })
})

describe('the line drawn over the days', () => {
  it('rolls a mean across the window', () => {
    expect(smooth([1, 2, 3, 4, 5], 3)).toEqual([1.5, 2, 3, 4, 4.5])
  })

  it('steps over a day with nothing on it rather than reading it as nought', () => {
    // The last window is [null, 4], so it is 4: an empty day is stepped over
    // rather than pulling the mean towards zero.
    expect(smooth([2, null, 4], 3)).toEqual([2, 3, 4])
  })

  it('has nothing to say where every day in the window is empty', () => {
    expect(smooth([null, null], 3)).toEqual([null, null])
  })
})
