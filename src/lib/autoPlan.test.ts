import { describe, it, expect } from 'vitest'
import { proposePlan } from './autoPlan'
import { buildContext } from './nutrition'
import type { DayPlan, Food, PantryItem, Portion, Recipe, Targets } from '../types'

/**
 * The planning assistant, which is arithmetic rather than a model.
 *
 * Which means it can be tested exactly, and should be: the whole argument for
 * doing it this way is that every proposal can be checked against the plan in
 * front of you, and a test is that check written down.
 */

const now = '2026-08-21T10:00:00.000Z'
const TARGETS: Targets = { calories: 2000, protein: 100, carbs: 200, fat: 70, source: 'manual' }

const food = (id: string, calories: number): Food => ({
  id, names: { en: id }, aliases: [], category: 'pantry', medTier: 'daily', state: 'as-sold',
  per100g: { calories, protein: 5, carbs: 10, fat: 2 }, units: [], source: 'curated', createdAt: now,
})

function recipe(id: string, tag: 'breakfast' | 'lunch' | 'dinner', grams: number): Recipe {
  return {
    id, name: { en: id }, emoji: '🍽️', servings: 1, prepMinutes: 5, cookMinutes: 10,
    components: [{ kind: 'food', foodId: 'staple', grams }],
    steps: [], tags: [tag], createdAt: now,
  }
}

const FOODS = [food('staple', 100), food('extra', 100)]

// 100 kcal per 100 g, so grams are calories and the arithmetic is readable.
const RECIPES = [
  recipe('porridge', 'breakfast', 500),
  recipe('eggs', 'breakfast', 560),
  recipe('salad', 'lunch', 700),
  recipe('soup', 'lunch', 300),
  recipe('stew', 'dinner', 560),
  recipe('pasta', 'dinner', 900),
]

const ctx = buildContext(FOODS, RECIPES)
const emptyWeek = (dates: string[]): DayPlan[] => dates.map((date) => ({ date, meals: [] }))
const DATES = ['2026-08-21', '2026-08-22', '2026-08-23']

describe('filling the empty slots', () => {
  it('fills breakfast, lunch and dinner, and leaves the snacks alone', () => {
    // Snacks in these plans are food lines rather than dishes, and proposing a
    // recipe for one would be inventing a kind of meal the plans do not have.
    const out = proposePlan({ dates: ['2026-08-21'], plan: emptyWeek(['2026-08-21']), recipes: RECIPES, ctx, targets: TARGETS })
    expect(out.map((p) => p.slot)).toEqual(['breakfast', 'lunch', 'dinner'])
  })

  it('only ever offers a dish that suits the meal', () => {
    const out = proposePlan({ dates: DATES, plan: emptyWeek(DATES), recipes: RECIPES, ctx, targets: TARGETS })
    for (const p of out) {
      const id = p.entry.kind === 'recipe' ? p.entry.recipeId : ''
      const suits = RECIPES.find((r) => r.id === id)!.tags[0]
      expect(suits).toBe(p.slot)
    }
  })

  it('leaves a slot that already has something in it', () => {
    const plan: DayPlan[] = [{
      date: '2026-08-21',
      meals: [{ id: 'm1', slot: 'lunch', entries: [{ kind: 'recipe', recipeId: 'soup', servings: 1 }] }],
    }]
    const out = proposePlan({ dates: ['2026-08-21'], plan, recipes: RECIPES, ctx, targets: TARGETS })
    expect(out.map((p) => p.slot)).toEqual(['breakfast', 'dinner'])
  })

  it('proposes the same plan twice, so it can be discussed', () => {
    // A suggestion that changes every time you look at it is one you cannot
    // talk about with the other person.
    const args = { dates: DATES, plan: emptyWeek(DATES), recipes: RECIPES, ctx, targets: TARGETS }
    expect(proposePlan(args)).toEqual(proposePlan(args))
  })
})

describe('variety', () => {
  it('does not offer the same dinner three nights running', () => {
    const out = proposePlan({ dates: DATES, plan: emptyWeek(DATES), recipes: RECIPES, ctx, targets: TARGETS })
    const dinners = out.filter((p) => p.slot === 'dinner')
      .map((p) => (p.entry.kind === 'recipe' ? p.entry.recipeId : ''))
    expect(new Set(dinners).size).toBeGreaterThan(1)
  })

  it('avoids what was eaten in the days before', () => {
    const plan: DayPlan[] = [
      { date: '2026-08-19', meals: [{ id: 'a', slot: 'dinner', entries: [{ kind: 'recipe', recipeId: 'stew', servings: 1 }] }] },
      { date: '2026-08-20', meals: [{ id: 'b', slot: 'dinner', entries: [{ kind: 'recipe', recipeId: 'stew', servings: 1 }] }] },
      { date: '2026-08-21', meals: [] },
    ]
    const out = proposePlan({ dates: ['2026-08-21'], plan, recipes: RECIPES, ctx, targets: TARGETS })
    const dinner = out.find((p) => p.slot === 'dinner')!
    expect(dinner.entry.kind === 'recipe' && dinner.entry.recipeId).not.toBe('stew')
  })
})

describe('what you already have', () => {
  const portion: Portion = {
    id: 'tub', recipeId: 'stew', servings: 1, madeOn: '2026-08-20',
    storage: 'fridge', source: 'batch',
  }
  const withPortions = buildContext(FOODS, RECIPES, {}, {}, [portion])

  it('offers the fridge first, and says so', () => {
    // It needs no shopping, no cooking and no decision, and if it is not eaten
    // it is thrown away.
    const out = proposePlan({
      dates: ['2026-08-21'], plan: emptyWeek(['2026-08-21']), recipes: RECIPES,
      ctx: withPortions, targets: TARGETS, portions: [portion],
    })
    const first = out[0]
    expect(first.entry.kind).toBe('portion')
    expect(first.why).toBe('Already in the fridge')
  })

  it('offers one portion once, however many slots are empty', () => {
    const out = proposePlan({
      dates: DATES, plan: emptyWeek(DATES), recipes: RECIPES,
      ctx: withPortions, targets: TARGETS, portions: [portion],
    })
    const fromFridge = out.filter((p) => p.entry.kind === 'portion')
    expect(fromFridge).toHaveLength(1)
  })

  it('prefers a dish the cupboard covers, and says which', () => {
    const pantry = new Map<string, PantryItem>([
      ['staple', { foodId: 'staple', staple: true, updatedAt: now }],
    ])
    const out = proposePlan({
      dates: ['2026-08-21'], plan: emptyWeek(['2026-08-21']), recipes: RECIPES,
      ctx, targets: TARGETS, pantry,
    })
    expect(out.every((p) => p.why.includes('everything'))).toBe(true)
  })
})

describe('the day it adds up to', () => {
  it('lands near the target rather than wherever it likes', () => {
    const out = proposePlan({ dates: ['2026-08-21'], plan: emptyWeek(['2026-08-21']), recipes: RECIPES, ctx, targets: TARGETS })
    const total = out.reduce((n, p) => n + p.calories, 0)
    // The three meals it fills are about 90% of a day; the snacks are the rest.
    expect(total).toBeGreaterThan(TARGETS.calories * 0.6)
    expect(total).toBeLessThan(TARGETS.calories * 1.1)
  })

  it('counts what is already on the day before proposing more', () => {
    const plan: DayPlan[] = [{
      date: '2026-08-21',
      meals: [{ id: 'm1', slot: 'lunch', entries: [{ kind: 'recipe', recipeId: 'pasta', servings: 1 }] }],
    }]
    const out = proposePlan({ dates: ['2026-08-21'], plan, recipes: RECIPES, ctx, targets: TARGETS })
    const total = 900 + out.reduce((n, p) => n + p.calories, 0)
    expect(total).toBeLessThan(TARGETS.calories * 1.2)
  })
})

describe('when it cannot help', () => {
  it('proposes nothing rather than something wrong', () => {
    // No recipes suit breakfast, so there is no honest answer and it says
    // nothing instead of offering a stew at eight in the morning.
    const out = proposePlan({
      dates: ['2026-08-21'], plan: emptyWeek(['2026-08-21']),
      recipes: [recipe('stew', 'dinner', 500)], ctx, targets: TARGETS,
    })
    expect(out.map((p) => p.slot)).toEqual(['dinner'])
  })

  it('ignores a recipe with nothing in it', () => {
    const empty: Recipe = { ...recipe('ghost', 'lunch', 0), components: [] }
    const out = proposePlan({
      dates: ['2026-08-21'], plan: emptyWeek(['2026-08-21']), recipes: [empty], ctx, targets: TARGETS,
    })
    expect(out).toEqual([])
  })
})

describe('filling only the days that are still ahead', () => {
  it('leaves days that have already happened alone', () => {
    const proposals = proposePlan({
      dates: ['2026-08-24', '2026-08-25', '2026-08-29', '2026-08-30'],
      plan: [],
      recipes: RECIPES,
      ctx,
      targets: TARGETS,
      today: '2026-08-29',
    })

    // Nobody cooks last Monday, and every proposal for one pushes a real
    // empty day further down a list people scan rather than read.
    const days = [...new Set(proposals.map((p) => p.date))].sort()
    expect(days).toEqual(['2026-08-29', '2026-08-30'])
  })

  it('still fills everything when it is not told what day it is', () => {
    const proposals = proposePlan({
      dates: ['2026-08-24', '2026-08-25'],
      plan: [], recipes: RECIPES, ctx, targets: TARGETS,
    })

    expect(proposals.length).toBeGreaterThan(0)
  })
})
