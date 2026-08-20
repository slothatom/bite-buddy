import { describe, expect, it } from 'vitest'
import type { Food, Recipe } from '../types'
import {
  atwaterCalories, buildContext, calorieDrift, componentsNutrients,
  recipePerServing, recipeTotal, scaleNutrients, addNutrients,
  reportNutrients, saltFromSodium, sodiumFromSalt,
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

  it('does not mark a nutrient nobody knew — there is no figure to qualify', () => {
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
