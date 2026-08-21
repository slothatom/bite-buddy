import { describe, it, expect } from 'vitest'
import { readDraft, resolveIngredients, componentsFrom } from './recipeDraft'
import { buildFoodIndex } from './foodSearch'
import type { Food } from '../types'

/**
 * Reading a model's reply.
 *
 * The point of these is not that the assistant is bad, it is that a reply is
 * data from a stranger and the only defence that works is checking. Every test
 * here is a thing that would otherwise reach a screen: an invented category, a
 * weight that is not a number, an ingredient matched to the wrong food.
 */

const now = '2026-08-21T10:00:00.000Z'
const food = (id: string, en: string, aliases: string[] = []): Food => ({
  id, names: { en }, aliases, category: 'pantry', medTier: 'daily', state: 'as-sold',
  per100g: { calories: 100, protein: 5, carbs: 10, fat: 2 },
  units: [], source: 'curated', createdAt: now,
})

const FOODS = [food('lentils', 'Lentils'), food('onion', 'Onion'), food('oil', 'Olive oil')]
const INDEX = buildFoodIndex(FOODS)

const good = {
  name: 'Lentil stew', emoji: '🍲', servings: 4, prepMinutes: 10, cookMinutes: 30,
  category: 'stew', mealTypes: ['lunch', 'dinner'], quickFilters: ['one-pan'],
  ingredients: [
    { foodId: 'lentils', name: 'red lentils', grams: 300 },
    { foodId: '', name: 'coriander', grams: 10 },
  ],
  steps: ['Soften the onion.', 'Add everything else.'],
  note: '',
}

describe('reading the reply', () => {
  it('takes a well-formed draft as it is', () => {
    const draft = readDraft(good)!
    expect(draft.name).toBe('Lentil stew')
    expect(draft.servings).toBe(4)
    expect(draft.mealTypes).toEqual(['lunch', 'dinner'])
    expect(draft.steps).toHaveLength(2)
  })

  it('refuses anything without a name, which is not a recipe', () => {
    expect(readDraft({ ...good, name: '' })).toBeUndefined()
    expect(readDraft('a recipe')).toBeUndefined()
    expect(readDraft(null)).toBeUndefined()
  })

  it('drops a category the app has never heard of', () => {
    // Left empty rather than guessed at: a wrong shelf is quiet and lasting.
    expect(readDraft({ ...good, category: 'brunch-vibes' })?.category).toBeUndefined()
  })

  it('drops filters and meal types it invented', () => {
    const draft = readDraft({
      ...good, quickFilters: ['one-pan', 'gluten-free'], mealTypes: ['lunch', 'elevenses'],
    })!
    expect(draft.quickFilters).toEqual(['one-pan'])
    expect(draft.mealTypes).toEqual(['lunch'])
  })

  it('drops an ingredient with no weight rather than showing a zero', () => {
    const draft = readDraft({
      ...good,
      ingredients: [
        { foodId: 'lentils', name: 'lentils', grams: 300 },
        { foodId: '', name: 'salt', grams: 'a pinch' },
        { foodId: '', name: '', grams: 50 },
      ],
    })!
    expect(draft.ingredients.map((i) => i.name)).toEqual(['lentils'])
  })

  it('falls back rather than failing on missing numbers', () => {
    const draft = readDraft({ ...good, servings: null, prepMinutes: 'ten' })!
    expect(draft.servings).toBe(1)
    expect(draft.prepMinutes).toBe(0)
  })
})

describe('finding the foods', () => {
  it('uses the id it was given', () => {
    const draft = readDraft(good)!
    const resolved = resolveIngredients(draft, FOODS, INDEX)
    expect(resolved[0]).toMatchObject({ foodId: 'lentils', matched: 'given' })
  })

  it('searches by name when the id is missing or wrong', () => {
    const draft = readDraft({
      ...good, ingredients: [{ foodId: 'not-a-food', name: 'olive oil', grams: 20 }],
    })!
    const resolved = resolveIngredients(draft, FOODS, INDEX)
    expect(resolved[0]).toMatchObject({ foodId: 'oil', matched: 'searched' })
  })

  it('leaves an ingredient unmatched rather than picking something else', () => {
    // A wrong match is a wrong number nobody will ever notice. An unmatched
    // line is a question somebody can answer in two taps.
    const draft = readDraft({
      ...good, ingredients: [{ foodId: '', name: 'quince paste', grams: 30 }],
    })!
    const resolved = resolveIngredients(draft, FOODS, INDEX)
    expect(resolved[0].matched).toBe('none')
    expect(resolved[0].food).toBeUndefined()
    expect(resolved[0].name).toBe('quince paste')
    expect(resolved[0].grams).toBe(30)
  })

  it('builds components only from what resolved', () => {
    const draft = readDraft(good)!
    const components = componentsFrom(resolveIngredients(draft, FOODS, INDEX))
    expect(components).toEqual([{ kind: 'food', foodId: 'lentils', grams: 300 }])
  })
})

describe('what it never carries', () => {
  it('has nowhere to put a calorie', () => {
    // Nutrition comes from the food database, always. A model cannot put a
    // number on a screen about what you eat, because there is no field for one.
    const draft = readDraft({ ...good, calories: 450, protein: 20 })!
    expect(JSON.stringify(draft)).not.toContain('450')
    expect(Object.keys(draft)).not.toContain('calories')
  })
})
