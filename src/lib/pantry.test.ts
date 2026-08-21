import { describe, it, expect } from 'vitest'
import { stillNeeded, availability, availabilityLabel, mealAvailability } from './pantry'
import { buildContext } from './nutrition'
import type { Food, PantryItem, Recipe } from '../types'

const now = '2026-08-21T10:00:00.000Z'
const item = (over: Partial<PantryItem> & { foodId: string }): PantryItem =>
  ({ updatedAt: now, ...over })

const food = (id: string): Food => ({
  id, names: { en: id }, aliases: [], category: 'pantry', medTier: 'daily',
  state: 'as-sold', per100g: { calories: 100, protein: 5, carbs: 10, fat: 2 },
  units: [], source: 'curated', createdAt: now,
})

describe('what still needs buying', () => {
  it('everything, when the cupboard has none of it', () => {
    expect(stillNeeded(500, undefined)).toBe(500)
  })

  it('nothing, when you have it and did not say how much', () => {
    // Which is what anybody means when they say they have olive oil.
    expect(stillNeeded(500, item({ foodId: 'oil' }))).toBe(0)
  })

  it('the shortfall, when you did say', () => {
    // The case that earns the field: 200 g of the 500 g a week needs is a
    // different answer from "we have lentils".
    expect(stillNeeded(500, item({ foodId: 'lentils', grams: 200 }))).toBe(300)
  })

  it('nothing when you have more than enough', () => {
    expect(stillNeeded(100, item({ foodId: 'rice', grams: 900 }))).toBe(0)
  })

  it('nothing at all for a staple, whatever the amount', () => {
    expect(stillNeeded(9_999, item({ foodId: 'salt', staple: true }))).toBe(0)
  })
})

describe('how much of a recipe you could make', () => {
  const foods = [food('lentils'), food('onion'), food('oil'), food('water')]
  const recipe: Recipe = {
    id: 'stew', name: { en: 'Lentil stew' }, emoji: '🍲', servings: 4,
    prepMinutes: 5, cookMinutes: 30,
    components: [
      { kind: 'food', foodId: 'lentils', grams: 300 },
      { kind: 'food', foodId: 'onion', grams: 150 },
      { kind: 'food', foodId: 'oil', grams: 20 },
      { kind: 'food', foodId: 'water', grams: 800 },
    ],
    steps: [], tags: [], createdAt: now,
  }
  const ctx = buildContext(foods, [recipe])

  it('is nothing with an empty cupboard', () => {
    const a = availability(recipe, ctx, new Map())
    expect(a.ratio).toBe(0)
    expect(a.missing).toEqual(['lentils', 'onion', 'oil'])
  })

  it('ignores water, the way the shopping list does', () => {
    const a = availability(recipe, ctx, new Map())
    expect(a.missing).not.toContain('water')
    expect(a.have).not.toContain('water')
  })

  it('counts a staple as had', () => {
    const pantry = new Map([['oil', item({ foodId: 'oil', staple: true })]])
    expect(availability(recipe, ctx, pantry).have).toEqual(['oil'])
  })

  it('does not count a part-full bag as had', () => {
    const pantry = new Map([['lentils', item({ foodId: 'lentils', grams: 100 })]])
    const a = availability(recipe, ctx, pantry)
    expect(a.missing).toContain('lentils')
  })

  it('says so when you have everything', () => {
    const pantry = new Map(['lentils', 'onion', 'oil'].map((id) => [id, item({ foodId: id })]))
    const a = availability(recipe, ctx, pantry)
    expect(a.missing).toEqual([])
    expect(availabilityLabel(a)).toBe('You have everything')
  })
})

describe('how it reads', () => {
  it('names a small number and stops counting at a large one', () => {
    expect(availabilityLabel({ have: ['a', 'b'], missing: ['c'], ratio: 2 / 3 }))
      .toBe('Missing one thing')
    expect(availabilityLabel({ have: ['a', 'b'], missing: ['c', 'd'], ratio: 0.5 }))
      .toBe('Missing 2 things')
    expect(availabilityLabel({ have: ['a'], missing: ['b', 'c', 'd'], ratio: 0.25 }))
      .toBe('Missing most of it')
  })

  it('never tells you whether to cook it', () => {
    // The app can see a list of ingredients. Whether two missing things is a
    // lot depends on which two, and you are the one who can see them.
    const said = availabilityLabel({ have: [], missing: ['a', 'b'], ratio: 0 })
    expect(said).not.toMatch(/can't|cannot|don't|impossible|skip/i)
  })
})

describe('whether a planned meal can be cooked tonight', () => {
  const recipe: Recipe = {
    id: 'stew', name: { en: 'Lentil stew' }, emoji: '🍲', servings: 4,
    prepMinutes: 5, cookMinutes: 30,
    components: [
      { kind: 'food', foodId: 'lentils', grams: 300 },
      { kind: 'food', foodId: 'onion', grams: 150 },
    ],
    steps: [], tags: [], createdAt: now,
  }
  const ctx = buildContext([food('lentils'), food('onion'), food('oil')], [recipe], {}, {}, [
    { id: 'tub', recipeId: 'stew', servings: 2, madeOn: '2026-08-20', storage: 'fridge', source: 'batch' },
  ])

  it('names what is not in, rather than counting it', () => {
    const pantry = new Map([['lentils', item({ foodId: 'lentils' })]])
    const state = mealAvailability([{ kind: 'recipe', recipeId: 'stew', servings: 1 }], ctx, pantry)
    expect(state.ready).toBe(false)
    expect(state.missing).toEqual(['onion'])
  })

  it('is ready when the cupboard covers all of it', () => {
    const pantry = new Map([
      ['lentils', item({ foodId: 'lentils' })],
      ['onion', item({ foodId: 'onion' })],
    ])
    const state = mealAvailability([{ kind: 'recipe', recipeId: 'stew', servings: 1 }], ctx, pantry)
    expect(state).toEqual({ ready: true, missing: [] })
  })

  it('asks nothing of something already cooked', () => {
    // A portion in the fridge needs no ingredients. That is the whole point of
    // having cooked it, and checking it would report the stew twice.
    const state = mealAvailability([{ kind: 'portion', portionId: 'tub', servings: 1 }], ctx, new Map())
    expect(state).toEqual({ ready: true, missing: [] })
  })

  it('checks a weighed food on its own', () => {
    const state = mealAvailability([{ kind: 'food', foodId: 'oil', grams: 10 }], ctx, new Map())
    expect(state.missing).toEqual(['oil'])
  })
})
