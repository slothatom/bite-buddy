import { describe, expect, it } from 'vitest'
import type { DayPlan, Food, PlannedMeal, Recipe } from '../types'
import {
  atwaterCalories, buildContext, calorieDrift, componentsNutrients, dayEaten, dayProgress, dayLabel, reportDay,
  recipePerServing, recipeTotal, scaleNutrients, addNutrients,
  reportNutrients, saltFromSodium, sodiumFromSalt, weekEaten,
} from './nutrition'

function food(id: string, per100g: Food['per100g']): Food {
  return {
    id, names: { en: id }, aliases: [], category: 'pantry', medTier: 'daily',
    state: 'as-sold', per100g, units: [], source: 'curated',
  }
}

const OIL = food('oil', { calories: 884, protein: 0, carbs: 0, fat: 100 })
const OATS = food('oats', { calories: 380, protein: 13, carbs: 68, fat: 6.5, fiber: 10 })
const MILK = food('milk', { calories: 47, protein: 3.4, carbs: 4.8, fat: 1.5 })

const PORRIDGE: Recipe = {
  id: 'porridge', name: { en: 'Porridge' }, emoji: '🥣', servings: 2,
  components: [
    { kind: 'food', foodId: 'oats', grams: 80 },
    { kind: 'food', foodId: 'milk', grams: 200 },
  ],
  steps: [], tags: [], prepMinutes: 0, cookMinutes: 0, createdAt: '2022-01-01T00:00:00.000Z',
}

/** A meal that references the batch dish rather than restating its ingredients. */
const BREAKFAST: Recipe = {
  id: 'breakfast', name: { en: 'Breakfast' }, emoji: '🌅', servings: 1,
  components: [
    { kind: 'recipe', recipeId: 'porridge', servings: 1 },
    { kind: 'food', foodId: 'oil', grams: 5 },
  ],
  steps: [], tags: [], prepMinutes: 0, cookMinutes: 0, createdAt: '2022-01-01T00:00:00.000Z',
}

const ctx = buildContext([OIL, OATS, MILK], [PORRIDGE, BREAKFAST])

describe('component nutrition', () => {
  it('scales a food by its weight', () => {
    const n = componentsNutrients([{ kind: 'food', foodId: 'oil', grams: 5 }], ctx)
    expect(n.calories).toBeCloseTo(44.2, 1)
    expect(n.fat).toBeCloseTo(5, 1)
  })

  it('sums the whole batch, then divides by servings', () => {
    const total = recipeTotal(PORRIDGE, ctx)
    expect(total.calories).toBeCloseTo(380 * 0.8 + 47 * 2, 1)
    expect(recipePerServing(PORRIDGE, ctx).calories).toBeCloseTo(total.calories / 2, 1)
  })

  it('resolves a nested recipe to one serving of it, not the whole batch', () => {
    // This is the batch-cook case: one portion of a two-portion dish.
    const n = recipePerServing(BREAKFAST, ctx)
    expect(n.calories).toBeCloseTo(recipePerServing(PORRIDGE, ctx).calories + 44.2, 1)
  })

  it('carries fibre through nesting', () => {
    expect(recipePerServing(BREAKFAST, ctx).fiber).toBeCloseTo(4, 1)
  })

  it('returns zero for an unknown reference rather than throwing', () => {
    expect(componentsNutrients([{ kind: 'food', foodId: 'nope', grams: 100 }], ctx).calories).toBe(0)
    expect(componentsNutrients([{ kind: 'recipe', recipeId: 'nope', servings: 1 }], ctx).calories).toBe(0)
  })
})

describe('cycle safety', () => {
  it('does not recurse forever when a recipe contains itself', () => {
    const loop: Recipe = {
      ...PORRIDGE, id: 'loop', name: { en: 'Loop' },
      components: [{ kind: 'recipe', recipeId: 'loop', servings: 1 }],
    }
    const looped = buildContext([OIL], [loop])
    expect(() => recipePerServing(loop, looped)).not.toThrow()
    expect(recipePerServing(loop, looped).calories).toBe(0)
  })
})

describe('atwater', () => {
  it('counts fibre at 2 kcal/g rather than 4', () => {
    // Plain 4/4/9 would call spinach 30% mis-keyed; it is not.
    const spinach = { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2 }
    expect(atwaterCalories(spinach)).toBeCloseTo(25.2, 1)
    expect(calorieDrift(spinach)).toBeLessThan(0.12)
  })

  it('still catches a genuinely wrong value', () => {
    const wrong = { calories: 546, protein: 7.8, carbs: 45.9, fat: 31.3, fiber: 11 }
    expect(calorieDrift(wrong)).toBeGreaterThan(0.12)
  })

  it('handles fibre exceeding carbs without going negative', () => {
    expect(atwaterCalories({ calories: 10, protein: 0, carbs: 2, fat: 0, fiber: 5 })).toBeGreaterThanOrEqual(0)
  })
})

describe('arithmetic helpers', () => {
  it('adds and scales without losing optional micronutrients', () => {
    const a = { calories: 100, protein: 5, carbs: 10, fat: 2, fiber: 3 }
    const b = { calories: 50, protein: 2, carbs: 5, fat: 1 }
    expect(addNutrients(a, b)).toMatchObject({ calories: 150, protein: 7, fiber: 3 })
    expect(scaleNutrients(a, 2)).toMatchObject({ calories: 200, fiber: 6 })
  })
})

describe('unknown is not zero', () => {
  const ctx = buildContext(
    [
      {
        id: 'knows-fibre', names: { en: 'Knows fibre' }, aliases: [], category: 'grains',
        medTier: 'daily', state: 'as-sold', units: [], source: 'curated',
        per100g: { calories: 100, protein: 5, carbs: 20, fat: 1, fiber: 4, sodium: 200 },
      },
      {
        id: 'says-nothing', names: { en: 'Says nothing' }, aliases: [], category: 'grains',
        medTier: 'daily', state: 'as-sold', units: [], source: 'curated',
        per100g: { calories: 100, protein: 5, carbs: 20, fat: 1 },
      },
    ],
    [],
  )

  it('leaves a nutrient nobody mentioned out of the total entirely', () => {
    // Not zero: a food whose source said nothing about zinc has not told you
    // there is no zinc in it.
    const total = componentsNutrients([{ kind: 'food', foodId: 'says-nothing', grams: 100 }], ctx)
    expect(total.fiber).toBeUndefined()
    expect(total.zinc).toBeUndefined()
  })

  it('still adds up what is known, because a floor is worth having', () => {
    const total = componentsNutrients([
      { kind: 'food', foodId: 'knows-fibre', grams: 100 },
      { kind: 'food', foodId: 'says-nothing', grams: 100 },
    ], ctx)
    expect(total.fiber).toBe(4)
  })

  it('marks a total as partial when only some ingredients knew', () => {
    const report = reportNutrients([
      { kind: 'food', foodId: 'knows-fibre', grams: 100 },
      { kind: 'food', foodId: 'says-nothing', grams: 100 },
    ], ctx)

    expect(report.total.fiber).toBe(4)
    expect(report.partial).toContain('fiber')
    expect(report.partial).toContain('sodium')
  })

  it('does not mark a total partial when everyone agreed', () => {
    const report = reportNutrients([
      { kind: 'food', foodId: 'knows-fibre', grams: 50 },
      { kind: 'food', foodId: 'knows-fibre', grams: 50 },
    ], ctx)

    expect(report.total.fiber).toBe(4)
    expect(report.partial).toEqual([])
  })

  it('does not mark a nutrient nobody knew, there is no figure to qualify', () => {
    const report = reportNutrients([{ kind: 'food', foodId: 'says-nothing', grams: 100 }], ctx)
    expect(report.partial).not.toContain('fiber')
  })
})

describe('salt and sodium are one number', () => {
  it('converts sodium to salt the way a label does', () => {
    expect(saltFromSodium(1000)).toBeCloseTo(2.5, 5)
    expect(saltFromSodium(400)).toBeCloseTo(1, 5)
  })

  it('goes back again without drift', () => {
    expect(sodiumFromSalt(2.5)).toBeCloseTo(1000, 5)
    expect(saltFromSodium(sodiumFromSalt(1.7))).toBeCloseTo(1.7, 5)
  })

  it('keeps unknown sodium unknown rather than calling it no salt', () => {
    expect(saltFromSodium(undefined)).toBeUndefined()
  })
})

describe('what a day amounted to', () => {
  const day = (meals: PlannedMeal[]): DayPlan => ({ date: '2026-08-29', meals })
  const meal = (id: string, grams: number, outcome?: PlannedMeal['outcome']): PlannedMeal => ({
    id, slot: 'lunch', outcome,
    entries: [{ kind: 'food', foodId: 'oats', grams }],
  })

  it('totals the plan while nothing has been said', () => {
    const { nutrients, recorded } = dayEaten(day([meal('a', 100), meal('b', 100)]), ctx)

    expect(recorded).toBe(false)
    expect(nutrients.calories).toBeGreaterThan(0)
  })

  it('leaves a meal nobody has spoken about in the total', () => {
    const both = dayEaten(day([meal('a', 100), meal('b', 100)]), ctx).nutrients
    const one = dayEaten(day([meal('a', 100, 'eaten'), meal('b', 100)]), ctx)

    // Ticking breakfast at eight used to drop dinner, still hours away and
    // untouched, out of the day: 580 kcal reported as 294 with "1,106
    // remaining". "Not yet" is not "no".
    expect(one.recorded).toBe(true)
    expect(one.nutrients.calories).toBeCloseTo(both.calories, 5)
  })

  it('counts a skipped meal as neither eaten nor planned', () => {
    const { nutrients, recorded } = dayEaten(day([meal('a', 100, 'skipped')]), ctx)

    expect(recorded).toBe(true)
    expect(nutrients.calories).toBe(0)
  })

  it('drops only what was skipped, and keeps the rest', () => {
    const one = dayEaten(day([meal('a', 100)]), ctx).nutrients
    const mixed = dayEaten(day([
      meal('a', 100, 'eaten'), meal('b', 100, 'skipped'), meal('c', 100),
    ]), ctx)

    // Eaten plus still to come, without the one that was skipped.
    expect(mixed.nutrients.calories).toBeCloseTo(one.calories * 2, 5)
  })
})

/**
 * The badge over a day said one of two words for four different situations,
 * and was wrong in two of them: an empty day announced itself PLANNED, and a
 * day with one meal skipped and nothing eaten announced itself EATEN.
 */
describe('how far through a day is', () => {
  const day = (meals: PlannedMeal[]): DayPlan => ({ date: '2026-08-29', meals })
  const meal = (id: string, outcome?: PlannedMeal['outcome']): PlannedMeal => ({
    id, slot: 'lunch', outcome,
    entries: [{ kind: 'food', foodId: 'oats', grams: 100 }],
  })

  it('says nothing at all about a day with nothing on it', () => {
    expect(dayProgress(day([])).state).toBe('empty')
    expect(dayLabel(dayProgress(day([])))).toBeNull()
    expect(dayLabel(dayProgress(undefined))).toBeNull()
  })

  it('calls a day nobody has touched a plan', () => {
    expect(dayLabel(dayProgress(day([meal('a'), meal('b')])))).toBe('planned')
  })

  it('counts the way through, rather than picking one of two words', () => {
    expect(dayLabel(dayProgress(day([meal('a', 'eaten'), meal('b'), meal('c')]))))
      .toBe('1 of 3 eaten')
  })

  it('does not call a day eaten when everything on it was skipped', () => {
    expect(dayLabel(dayProgress(day([meal('a', 'skipped')])))).toBe('skipped')
  })

  it('calls a finished day eaten', () => {
    expect(dayLabel(dayProgress(day([meal('a', 'eaten'), meal('b', 'skipped')])))).toBe('eaten')
  })
})

describe('what a stretch of days amounted to', () => {
  const meal = (id: string, grams: number, outcome?: PlannedMeal['outcome']): PlannedMeal => ({
    id, slot: 'lunch', outcome,
    entries: [{ kind: 'food', foodId: 'oats', grams }],
  })

  const PLAN: DayPlan[] = [
    { date: '2026-08-24', meals: [meal('a', 100, 'eaten'), meal('b', 100, 'skipped')] },
    { date: '2026-08-25', meals: [meal('c', 100), meal('d', 100)] },
    { date: '2026-08-26', meals: [] },
  ]
  const DATES = ['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27']

  it('says which days are records and which are still intentions', () => {
    const { recorded, planned } = weekEaten(DATES, PLAN, ctx)

    // A week presented as one number is a blend of the two, and every screen
    // that summed a week used to present exactly that without saying so.
    expect(recorded).toBe(1)
    expect(planned).toBe(1)
  })

  it('reads a ticked day as what was eaten and an untouched one as the plan', () => {
    const { days } = weekEaten(DATES, PLAN, ctx)
    const [ticked, untouched] = days

    expect(ticked.recorded).toBe(true)
    expect(untouched.recorded).toBe(false)
    // The skipped half of the first day is gone; both halves of the second stand.
    expect(ticked.nutrients.calories).toBeCloseTo(untouched.nutrients.calories / 2, 5)
  })

  it('gives a date with nothing on it back rather than dropping it', () => {
    const { days } = weekEaten(DATES, PLAN, ctx)

    // The chart has a bar per day and needs the empty ones to keep their place.
    expect(days.map((d) => d.date)).toEqual(DATES)
    expect(days[2].any).toBe(false)
    expect(days[3].any).toBe(false)
  })
})

describe('how honest a total is', () => {
  const KNOWS = food('knows-all', { calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 5, sodium: 10 })
  const SILENT = food('silent', { calories: 100, protein: 1, carbs: 1, fat: 1 })

  const DISH: Recipe = {
    id: 'dish', name: { en: 'Dish' }, emoji: '🍲', servings: 1,
    prepMinutes: 0, cookMinutes: 0, createdAt: '2026-01-01T00:00:00.000Z',
    components: [
      { kind: 'food', foodId: 'knows-all', grams: 100 },
      { kind: 'food', foodId: 'silent', grams: 100 },
    ],
    steps: [], tags: [],
  }
  const deep = buildContext([KNOWS, SILENT], [DISH])

  it('sees through a nested recipe to the ingredient that said nothing', () => {
    // One top-level component, two ingredients, one of them silent. Counted per
    // component this claimed a complete fibre figure, and since almost every
    // planner entry is a recipe reference, that hid nearly every partial total
    // in the app.
    const report = reportNutrients([{ kind: 'recipe', recipeId: 'dish', servings: 1 }], deep)

    expect(report.partial).toContain('fiber')
    expect(report.partial).toContain('sodium')
  })

  it('says nothing is partial when every ingredient knows', () => {
    const report = reportNutrients([{ kind: 'food', foodId: 'knows-all', grams: 100 }], deep)
    expect(report.partial).toEqual([])
  })

  it('reports a day, which is meals of entries rather than components', () => {
    const day: DayPlan = {
      date: '2026-08-29',
      meals: [
        { id: 'a', slot: 'lunch', entries: [{ kind: 'food', foodId: 'knows-all', grams: 100 }] },
        { id: 'b', slot: 'dinner', entries: [{ kind: 'food', foodId: 'silent', grams: 100 }] },
      ],
    }

    const report = reportDay(day, deep)

    expect(report.sources).toBe(2)
    expect(report.partial).toContain('fiber')
    // The figure is still shown, because "at least this much" is worth having.
    expect(report.total.fiber).toBeCloseTo(5, 5)
  })
})
