import { describe, it, expect } from 'vitest'
import { kitchenNudges } from './kitchen'
import { buildContext } from './nutrition'
import type { CookSession, DayPlan, Food, GroceryItem, PantryItem, Portion, Recipe } from '../types'

const now = '2026-08-21T10:00:00.000Z'
const TODAY = '2026-08-21'

const food = (id: string, en: string): Food => ({
  id, names: { en }, aliases: [], category: 'vegetables', medTier: 'daily', state: 'as-sold',
  per100g: { calories: 50, protein: 3, carbs: 6, fat: 1 },
  units: [], source: 'curated', createdAt: now,
})

const FOODS = [food('spinach', 'Spinach'), food('lentils', 'Lentils'), food('rice', 'Rice')]

const recipe = (id: string, name: string, foodIds: string[]): Recipe => ({
  id, name: { en: name }, emoji: '🍲', servings: 4, prepMinutes: 5, cookMinutes: 20,
  components: foodIds.map((foodId) => ({ kind: 'food' as const, foodId, grams: 100 })),
  steps: [], tags: ['dinner'], createdAt: now,
})

const RECIPES = [
  recipe('stew', 'Lentil stew', ['lentils', 'spinach']),
  recipe('curry', 'Spinach curry', ['spinach', 'rice']),
  recipe('pilaf', 'Spinach pilaf', ['spinach', 'rice']),
]

const portion = (over: Partial<Portion> = {}): Portion => ({
  id: 'tub', recipeId: 'stew', servings: 2, madeOn: TODAY,
  storage: 'fridge', source: 'batch', ...over,
})

const ctx = (portions: Portion[] = []) => buildContext(FOODS, RECIPES, {}, {}, portions)

const day = (date: string, recipeIds: string[]): DayPlan => ({
  date,
  meals: recipeIds.map((id, i) => ({
    id: `${date}-${i}`, slot: 'dinner' as const,
    entries: [{ kind: 'recipe' as const, recipeId: id, servings: 1 }],
  })),
})

const find = (list: ReturnType<typeof kitchenNudges>, kind: string) =>
  list.find((n) => n.kind === kind)

describe('leftovers nobody has claimed', () => {
  it('says so when there are empty slots to eat them in', () => {
    const p = portion()
    const out = kitchenNudges({
      days: [day(TODAY, [])], ctx: ctx([p]), today: TODAY, portions: [p],
    })
    expect(find(out, 'leftovers')?.title).toContain('cooked and waiting')
  })

  it('says nothing once they are planned', () => {
    const p = portion()
    const days: DayPlan[] = [{
      date: TODAY,
      meals: [{ id: 'm', slot: 'dinner', entries: [{ kind: 'portion', portionId: 'tub', servings: 1 }] }],
    }]
    const out = kitchenNudges({ days, ctx: ctx([p]), today: TODAY, portions: [p] })
    expect(find(out, 'leftovers')).toBeUndefined()
  })

  it('mentions how long something has been sitting, without a verdict', () => {
    // The app has not seen the tub. It reports the number of days and stops.
    const p = portion({ madeOn: '2026-08-15' })
    const out = kitchenNudges({ days: [day(TODAY, ['stew'])], ctx: ctx([p]), today: TODAY, portions: [p] })
    const sitting = find(out, 'sitting')!
    expect(sitting.title).toContain('6 days')
    expect(`${sitting.title} ${sitting.detail}`).not.toMatch(/off|expired|bin|throw|waste/i)
  })

  it('leaves a fresh portion alone', () => {
    const p = portion({ madeOn: TODAY })
    const out = kitchenNudges({ days: [day(TODAY, ['stew'])], ctx: ctx([p]), today: TODAY, portions: [p] })
    expect(find(out, 'sitting')).toBeUndefined()
  })
})

describe('a cook session coming up', () => {
  const session: CookSession = {
    id: 's1', date: '2026-08-22', time: '18:00', recipeIds: ['stew'],
    label: 'Batch', completed: false,
  }

  it('says what is not in the house', () => {
    const out = kitchenNudges({ days: [], ctx: ctx(), today: TODAY, sessions: [session] })
    const cooking = find(out, 'cooking')!
    expect(cooking.title).toContain('tomorrow')
    expect(cooking.detail).toMatch(/Lentils|Spinach/)
  })

  it('says everything is in when the cupboard covers it', () => {
    const pantry = new Map<string, PantryItem>(
      ['lentils', 'spinach'].map((id) => [id, { foodId: id, staple: true, updatedAt: now }]))
    const out = kitchenNudges({ days: [], ctx: ctx(), today: TODAY, sessions: [session], pantry })
    expect(find(out, 'cooking')?.detail).toContain('is in')
  })

  it('does not mention one that is a fortnight away', () => {
    const far = { ...session, date: '2026-09-10' }
    const out = kitchenNudges({ days: [], ctx: ctx(), today: TODAY, sessions: [far] })
    expect(find(out, 'cooking')).toBeUndefined()
  })

  it('ignores one already cooked', () => {
    const out = kitchenNudges({
      days: [], ctx: ctx(), today: TODAY, sessions: [{ ...session, completed: true }],
    })
    expect(find(out, 'cooking')).toBeUndefined()
  })
})

describe('a shopping list that has fallen behind', () => {
  const item = (foodId: string): GroceryItem => ({
    id: foodId, foodId, name: foodId, grams: 100, category: 'vegetables',
    checked: false, fromRecipeIds: [],
  })

  it('notices what the plan needs and the list has not got', () => {
    const out = kitchenNudges({
      days: [day(TODAY, ['stew', 'curry'])], ctx: ctx(), today: TODAY,
      groceryItems: [item('spinach')],
    })
    expect(find(out, 'shopping')?.title).toContain('missing 2')
  })

  it('says nothing when the list covers the plan', () => {
    const out = kitchenNudges({
      days: [day(TODAY, ['stew'])], ctx: ctx(), today: TODAY,
      groceryItems: [item('spinach'), item('lentils')],
    })
    expect(find(out, 'shopping')).toBeUndefined()
  })

  it('does not count what the cupboard already covers', () => {
    const pantry = new Map<string, PantryItem>([
      ['lentils', { foodId: 'lentils', staple: true, updatedAt: now }],
    ])
    const out = kitchenNudges({
      days: [day(TODAY, ['stew'])], ctx: ctx(), today: TODAY,
      groceryItems: [item('spinach')], pantry,
    })
    expect(find(out, 'shopping')).toBeUndefined()
  })

  it('stays quiet before a list exists at all', () => {
    const out = kitchenNudges({ days: [day(TODAY, ['stew'])], ctx: ctx(), today: TODAY })
    expect(find(out, 'shopping')).toBeUndefined()
  })
})

describe('something several meals want', () => {
  it('counts meals rather than grams', () => {
    const days = [day(TODAY, ['stew', 'curry', 'pilaf'])]
    const out = kitchenNudges({ days, ctx: ctx(), today: TODAY })
    expect(find(out, 'shared')?.title).toBe('3 meals this week use spinach')
  })

  it('needs three before it is worth saying', () => {
    const days = [day(TODAY, ['curry', 'pilaf'])]
    const out = kitchenNudges({ days, ctx: ctx(), today: TODAY })
    expect(find(out, 'shared')).toBeUndefined()
  })
})

describe('how much it says at once', () => {
  it('puts what needs doing today above what is merely interesting', () => {
    const p = portion({ madeOn: '2026-08-10' })
    const out = kitchenNudges({
      days: [day(TODAY, ['stew', 'curry', 'pilaf'])],
      ctx: ctx([p]), today: TODAY, portions: [p],
      sessions: [{ id: 's', date: TODAY, time: '18:00', recipeIds: ['stew'], label: '', completed: false }],
    })
    // A session today with things missing outranks a fact about spinach.
    expect(out[0].kind).toBe('cooking')
    expect(out[out.length - 1].kind).toBe('shared')
  })

  it('says nothing at all about an empty kitchen', () => {
    expect(kitchenNudges({ days: [], ctx: ctx(), today: TODAY })).toEqual([])
  })
})
