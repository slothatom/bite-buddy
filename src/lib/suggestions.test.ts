import { describe, it, expect } from 'vitest'
import type { DayPlan, Food, Recipe } from '../types'
import { buildContext } from './nutrition'
import { dominantCategory, pick, suggest } from './suggestions'

const food = (id: string, category: Food['category']): Food => ({
  id, names: { en: id }, aliases: [], category, medTier: 'daily', state: 'as-sold',
  per100g: { calories: 100, protein: 5, carbs: 10, fat: 3 }, units: [], source: 'curated',
})

const recipe = (id: string, components: Recipe['components']): Recipe => ({
  id, name: { en: id }, emoji: '🍽️', servings: 1, prepMinutes: 0, cookMinutes: 0,
  components, steps: [], tags: [], sourceLine: 'from a plan', createdAt: '2026-01-01',
})

const FOODS = [
  food('lentils', 'legumes'),
  food('salmon', 'fish-seafood'),
  food('beef', 'red-meat'),
  food('carrot', 'vegetables'),
]

const RECIPES = [
  recipe('lentil stew', [{ kind: 'food', foodId: 'lentils', grams: 200 }]),
  recipe('salmon dinner', [{ kind: 'food', foodId: 'salmon', grams: 200 }]),
  recipe('beef stew', [{ kind: 'food', foodId: 'beef', grams: 300 }]),
]

const ctx = buildContext(FOODS, RECIPES)

const day = (date: string, recipeId?: string): DayPlan => ({
  date,
  meals: recipeId
    ? [{ id: `${date}-1`, slot: 'dinner', entries: [{ kind: 'recipe', recipeId, servings: 1 }] }]
    : [],
})

describe('what a dish is mostly made of', () => {
  it('is the category with the most grams in it', () => {
    expect(dominantCategory(RECIPES[0], ctx)).toBe('legumes')
    expect(dominantCategory(RECIPES[1], ctx)).toBe('fish-seafood')
  })
})

describe('choosing the same idea all day', () => {
  it('depends on the seed, not on when it is asked', () => {
    const items = ['a', 'b', 'c', 'd']
    expect(pick(items, '2026-08-20')).toBe(pick(items, '2026-08-20'))
    expect(pick([], 'anything')).toBeUndefined()
  })
})

describe('ideas for the week', () => {
  const days = [day('2026-08-17', 'beef stew'), day('2026-08-18', 'beef stew')]

  it('offers one of your own dishes for what the week is short of', () => {
    const found = suggest({ days, recipes: RECIPES, ctx, today: '2026-08-17' })
    const gaps = found.filter((s) => s.kind === 'gap')
    expect(gaps.length).toBeGreaterThan(0)
    // Whatever it suggests is a recipe that exists and is not already planned.
    for (const g of gaps) {
      if (!g.recipeId) continue
      expect(RECIPES.map((r) => r.id)).toContain(g.recipeId)
      expect(g.recipeId).not.toBe('beef stew')
    }
  })

  it('says when there is more of something than the guide allows', () => {
    // 600 g of red meat against one 100 g serving a week.
    const found = suggest({ days, recipes: RECIPES, ctx, today: '2026-08-17' })
    expect(found.some((s) => s.kind === 'limit')).toBe(true)
  })

  it('points at the first empty day that has not happened yet', () => {
    const withGap = [...days, day('2026-08-19')]
    const found = suggest({ days: withGap, recipes: RECIPES, ctx, today: '2026-08-17' })
    const empty = found.find((s) => s.kind === 'unplanned')
    expect(empty?.id).toBe('empty-2026-08-19')
  })

  it('leaves yesterday alone', () => {
    // Suggesting you plan a day that has already been is not a suggestion.
    const found = suggest({
      days: [day('2026-08-15'), day('2026-08-20', 'beef stew')],
      recipes: RECIPES, ctx, today: '2026-08-18',
    })
    expect(found.some((s) => s.kind === 'unplanned')).toBe(false)
  })

  it('gives the same answer twice for the same day', () => {
    const a = suggest({ days, recipes: RECIPES, ctx, today: '2026-08-17' })
    const b = suggest({ days, recipes: RECIPES, ctx, today: '2026-08-17' })
    expect(a).toEqual(b)
  })
})
