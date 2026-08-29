import { describe, it, expect } from 'vitest'
import { throughLens, lensReady, LENSES, LENS_ORDER } from './discovery'
import { buildContext } from './nutrition'
import { ALL_RECIPES, FOODS as LIBRARY, TIMES_PLANNED } from '../data'
import type { DayPlan, Food, PantryItem, Recipe, Targets } from '../types'

const now = '2026-08-21T10:00:00.000Z'
const TODAY = '2026-08-21'

const food = (id: string): Food => ({
  id, names: { en: id }, aliases: [], category: 'pantry', medTier: 'daily', state: 'as-sold',
  per100g: { calories: 100, protein: 5, carbs: 10, fat: 2 },
  units: [], source: 'curated', createdAt: now,
})

const FOODS = [food('lentils'), food('spinach'), food('rice'), food('cream')]

function recipe(over: Partial<Recipe> & { id: string }): Recipe {
  return {
    name: { en: over.id }, emoji: '🍲', servings: 2, prepMinutes: 10, cookMinutes: 20,
    components: [{ kind: 'food', foodId: 'rice', grams: 100 }],
    steps: [], tags: ['dinner'], createdAt: now, ...over,
  }
}

// 100 kcal per 100 g, so grams are calories.
const RECIPES = [
  recipe({ id: 'toast', prepMinutes: 2, cookMinutes: 3, components: [{ kind: 'food', foodId: 'rice', grams: 100 }] }),
  recipe({ id: 'salad', prepMinutes: 10, cookMinutes: 0, components: [{ kind: 'food', foodId: 'spinach', grams: 200 }] }),
  recipe({ id: 'stew', prepMinutes: 20, cookMinutes: 40, servings: 6, components: [
    { kind: 'food', foodId: 'lentils', grams: 300 }, { kind: 'food', foodId: 'spinach', grams: 100 },
  ] }),
  recipe({ id: 'gratin', prepMinutes: 15, cookMinutes: 45, servings: 4, components: [
    { kind: 'food', foodId: 'cream', grams: 400 },
  ] }),
]

const ctx = buildContext(FOODS, RECIPES)
const item = (foodId: string, over: Partial<PantryItem> = {}): [string, PantryItem] =>
  [foodId, { foodId, updatedAt: now, ...over }]

const base = { recipes: RECIPES, ctx, today: TODAY }
const ids = (list: Recipe[]) => list.map((r) => r.id)

describe('quick tonight', () => {
  it('keeps only what is on the table within twenty minutes, quickest first', () => {
    expect(ids(throughLens('quick', base))).toEqual(['toast', 'salad'])
  })
})

describe('from the cupboard', () => {
  it('shows only what you can make outright', () => {
    const pantry = new Map([item('spinach'), item('rice')])
    // The stew wants lentils too, so it is not offered. Both of these have one
    // ingredient apiece, so the tie falls to the id, which keeps it stable.
    expect(ids(throughLens('have', { ...base, pantry }))).toEqual(['salad', 'toast'])
  })

  it('shows nothing when the cupboard is empty, rather than everything', () => {
    expect(throughLens('have', base)).toEqual([])
    expect(lensReady('have', base)).toBe(false)
  })
})

describe('use it up', () => {
  it('offers what uses the thing with the nearest date', () => {
    const pantry = new Map([
      item('cream', { useBy: '2026-08-23' }),
      item('lentils', { useBy: '2026-09-30' }),
    ])
    expect(ids(throughLens('use-first', { ...base, pantry }))).toEqual(['gratin', 'stew'])
  })

  it('says nothing when nothing has a date on it', () => {
    const pantry = new Map([item('cream')])
    expect(throughLens('use-first', { ...base, pantry })).toEqual([])
    expect(lensReady('use-first', { ...base, pantry })).toBe(false)
  })
})

describe('not lately', () => {
  const plan: DayPlan[] = [
    { date: '2026-08-20', meals: [{ id: 'a', slot: 'dinner', entries: [{ kind: 'recipe', recipeId: 'stew', servings: 1 }] }] },
    { date: '2026-06-01', meals: [{ id: 'b', slot: 'dinner', entries: [{ kind: 'recipe', recipeId: 'gratin', servings: 1 }] }] },
  ]

  it('drops what you had yesterday and keeps what you had in June', () => {
    const out = ids(throughLens('not-lately', { ...base, plan }))
    expect(out).not.toContain('stew')
    expect(out).toContain('gratin')
  })

  it('puts what you have never planned first', () => {
    const out = ids(throughLens('not-lately', { ...base, plan }))
    expect(out.indexOf('toast')).toBeLessThan(out.indexOf('gratin'))
  })
})

describe('fits today', () => {
  const targets: Targets = { calories: 600, protein: 40, carbs: 60, fat: 20, source: 'manual' }

  // Per serving: toast 50, stew 67, salad 100, gratin 100.
  it('offers the biggest thing that still fits, first', () => {
    // Nothing planned, so the whole 600 is going spare and everything fits.
    // The order is what matters: closest to filling the day comes first.
    const out = ids(throughLens('fits', { ...base, targets }))
    expect(out[0]).toBe('gratin')
    expect(out[out.length - 1]).toBe('toast')
  })

  it('shrinks as the day fills up', () => {
    // 11 rounds of toast is 550 kcal, leaving 50: only another toast fits.
    const plan: DayPlan[] = [{
      date: TODAY,
      meals: [{ id: 'm', slot: 'lunch', entries: [{ kind: 'recipe', recipeId: 'toast', servings: 11 }] }],
    }]
    expect(ids(throughLens('fits', { ...base, targets, plan }))).toEqual(['toast'])
  })

  it('offers nothing once the day is spent', () => {
    const plan: DayPlan[] = [{
      date: TODAY,
      meals: [{ id: 'm', slot: 'lunch', entries: [{ kind: 'recipe', recipeId: 'gratin', servings: 6 }] }],
    }]
    expect(throughLens('fits', { ...base, targets, plan })).toEqual([])
  })

  it('cannot answer without a target, and says so rather than guessing', () => {
    expect(throughLens('fits', base)).toEqual([])
    expect(lensReady('fits', base)).toBe(false)
  })
})

describe('worth a batch', () => {
  it('keeps what plainly makes a crowd, even with no record behind it', () => {
    expect(ids(throughLens('batch', base))).toEqual(['stew', 'gratin'])
  })

  it('counts a smaller pot the plans kept coming back to', () => {
    // Two servings is a batch in a house of two. What makes it worth cooking is
    // that it was cooked again, which the plans record and a recipe of your own
    // does not.
    const soup = recipe({ id: 'soup', servings: 2, timesPlanned: 5 })
    const once = recipe({ id: 'once', servings: 2, timesPlanned: 1 })
    const input = { ...base, recipes: [...RECIPES, soup, once], ctx: buildContext(FOODS, [...RECIPES, soup, once]) }

    expect(ids(throughLens('batch', input))).toEqual(['soup', 'stew', 'gratin'])
  })

  it('leaves alone a single serving, however often it was eaten', () => {
    // Fried eggs turn up in seven of the plans' meals. Nobody batch-cooks them.
    const eggs = recipe({ id: 'eggs', servings: 1, timesPlanned: 7 })
    const input = { ...base, recipes: [eggs], ctx: buildContext(FOODS, [eggs]) }

    expect(ids(throughLens('batch', input))).toEqual([])
  })
})

describe('the shipped library, through the batch lens', () => {
  const shipped = throughLens('batch', {
    recipes: ALL_RECIPES,
    ctx: buildContext(LIBRARY, ALL_RECIPES),
    today: TODAY,
  })

  it('never offers fried eggs, however many mornings they turn up on', () => {
    // Seven of the 481 meals are built on them, which is more than any soup in
    // the library. Repetition on its own is not the question: nobody cooks a
    // batch of fried eggs on Sunday and eats them on Wednesday.
    expect(TIMES_PLANNED['dish-fried-eggs']).toBeGreaterThanOrEqual(5)
    expect(ids(shipped)).not.toContain('dish-fried-eggs')
  })

  it('offers nothing that makes a single serving', () => {
    // The rule that keeps the eggs out. Thirty-six things in the library were
    // cooked three times or more, and most of them are one plate each time.
    for (const r of shipped) {
      expect(r.servings, `${r.name.en} makes ${r.servings}`).toBeGreaterThanOrEqual(2)
    }
  })

  it('still has plenty to say', () => {
    expect(shipped.length).toBeGreaterThan(10)
  })
})

describe('every lens', () => {
  it('explains itself in a sentence', () => {
    for (const lens of LENS_ORDER) {
      expect(LENSES[lens].rule.length, `${lens} has no rule`).toBeGreaterThan(10)
      expect(LENSES[lens].rule).toMatch(/first\.$/)
    }
  })

  it('is stable, so the same library sorts the same way twice', () => {
    for (const lens of LENS_ORDER) {
      const pantry = new Map([item('rice'), item('spinach', { useBy: '2026-08-30' })])
      const targets: Targets = { calories: 900, protein: 40, carbs: 60, fat: 20, source: 'manual' }
      const args = { ...base, pantry, targets }
      expect(throughLens(lens, args)).toEqual(throughLens(lens, args))
    }
  })
})
