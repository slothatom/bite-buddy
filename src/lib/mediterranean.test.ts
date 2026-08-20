import { describe, it, expect } from 'vitest'
import { gramsByCategory, scoreWeek, SERVING_GOALS, LIMIT_CATEGORIES } from './mediterranean'
import { buildContext } from './nutrition'
import type { DayPlan, Food, Recipe } from '../types'

/**
 * The serving goals are the one place the app makes a judgement about whether
 * you ate well, so a wrong number here is worse than no number: it is a
 * confident wrong answer. Every case below is one where the arithmetic could be
 * quietly off — nested recipes, part-planned weeks, the categories where less
 * is the goal.
 */

const food = (id: string, category: Food['category']): Food => ({
  id,
  names: { en: id },
  aliases: [],
  category,
  medTier: 'daily',
  state: 'raw',
  per100g: { calories: 50, protein: 1, carbs: 5, fat: 1 },
  units: [],
  source: 'curated',
})

const FOODS: Food[] = [
  food('spinach', 'vegetables'),
  food('carrot', 'vegetables'),
  food('apple', 'fruits'),
  food('lentils', 'legumes'),
  food('beef', 'red-meat'),
  food('water', 'beverages'),
]

const stew: Recipe = {
  id: 'stew',
  name: { en: 'Lentil stew' },
  emoji: '🥘',
  servings: 2,
  prepMinutes: 0,
  cookMinutes: 0,
  components: [
    { kind: 'food', foodId: 'lentils', grams: 180 },
    { kind: 'food', foodId: 'spinach', grams: 160 },
  ],
  steps: [],
  tags: [],
  createdAt: '2026-08-20T00:00:00.000Z',
}

const ctx = buildContext(FOODS, [stew])

const day = (date: string, entries: DayPlan['meals'][number]['entries']): DayPlan => ({
  date,
  meals: entries.length ? [{ id: `m-${date}`, slot: 'lunch', entries }] : [],
})

describe('gramsByCategory', () => {
  it('adds up foods across days and meals', () => {
    const days = [
      day('2026-08-20', [{ kind: 'food', foodId: 'spinach', grams: 100 }]),
      day('2026-08-21', [{ kind: 'food', foodId: 'carrot', grams: 50 }]),
    ]
    expect(gramsByCategory(days, ctx).get('vegetables')).toBe(150)
  })

  it('resolves a nested recipe and scales it by servings', () => {
    // One serving of a two-serving stew is half its ingredients.
    const days = [day('2026-08-20', [{ kind: 'recipe', recipeId: 'stew', servings: 1 }])]
    const totals = gramsByCategory(days, ctx)

    expect(totals.get('legumes')).toBe(90)
    expect(totals.get('vegetables')).toBe(80)
  })

  it('does not count water towards anything', () => {
    const days = [day('2026-08-20', [
      { kind: 'food', foodId: 'water', grams: 500 },
      { kind: 'food', foodId: 'spinach', grams: 80 },
    ])]
    const totals = gramsByCategory(days, ctx)

    expect(totals.get('beverages')).toBeUndefined()
    expect(totals.get('vegetables')).toBe(80)
  })

  it('ignores a component whose food no longer exists', () => {
    const days = [day('2026-08-20', [{ kind: 'food', foodId: 'deleted', grams: 100 }])]
    expect(gramsByCategory(days, ctx).size).toBe(0)
  })

  it('is empty for an unplanned week rather than throwing', () => {
    expect(gramsByCategory([day('2026-08-20', [])], ctx).size).toBe(0)
  })
})

describe('scoreWeek', () => {
  it('scales daily goals to the days actually planned', () => {
    // Three vegetable servings a day, but only two days planned, so the target
    // is six servings — not twenty-one. Scoring a part-planned week against a
    // full one would make every Wednesday look like a failure.
    const days = [
      day('2026-08-20', [{ kind: 'food', foodId: 'spinach', grams: 240 }]),
      day('2026-08-21', [{ kind: 'food', foodId: 'carrot', grams: 240 }]),
      day('2026-08-22', []),
    ]
    const veg = scoreWeek(days, ctx).find((g) => g.category === 'vegetables')!

    expect(veg.expected).toBe(6)
    expect(veg.servings).toBe(6)
    expect(veg.ratio).toBe(1)
  })

  it('leaves weekly goals alone whatever the week looks like', () => {
    const days = [day('2026-08-20', [{ kind: 'food', foodId: 'lentils', grams: 270 }])]
    const legumes = scoreWeek(days, ctx).find((g) => g.category === 'legumes')!

    expect(legumes.expected).toBe(3)
    expect(legumes.servings).toBe(3)
  })

  it('marks the categories where less is the point', () => {
    const days = [day('2026-08-20', [{ kind: 'food', foodId: 'beef', grams: 300 }])]
    const meat = scoreWeek(days, ctx).find((g) => g.category === 'red-meat')!

    expect(meat.isLimit).toBe(true)
    // Three times the weekly limit — the ratio has to keep going past 1 or
    // there is no way to tell "at the limit" from "well over it".
    expect(meat.ratio).toBe(3)
  })

  it('reports zero rather than dividing by zero on an empty week', () => {
    const scores = scoreWeek([day('2026-08-20', [])], ctx)
    expect(scores.every((g) => g.servings === 0)).toBe(true)
    expect(scores.every((g) => Number.isFinite(g.ratio))).toBe(true)
  })

  it('covers every goal the guide states, every time', () => {
    expect(scoreWeek([day('2026-08-20', [])], ctx)).toHaveLength(SERVING_GOALS.length)
  })

  it('agrees with itself about which categories are limits', () => {
    for (const goal of scoreWeek([day('2026-08-20', [])], ctx)) {
      expect(goal.isLimit).toBe(LIMIT_CATEGORIES.includes(goal.category))
    }
  })
})
