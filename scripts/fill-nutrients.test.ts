import { describe, it, expect } from 'vitest'
import type { Food } from '../src/types/index.js'
import { pick, type Candidate } from './fill-nutrients.js'

/**
 * Choosing between ten USDA rows.
 *
 * This is the whole of the script that decides what number ends up in the app,
 * and the first run that reached USDA at all got it wrong in a way worth
 * keeping a test about: rolled oats came back with 413 mg of sodium, cooked
 * lentils with 238. Both are real figures belonging to a different food, and
 * both would have been reported against a daily salt target as fact.
 */

const food = (over: Partial<Food> = {}): Food => ({
  id: 'x', names: { en: 'X' }, aliases: [],
  category: 'grains', medTier: 'daily', state: 'dry',
  per100g: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  units: [], source: 'curated',
  ...over,
} as Food)

/** A USDA row carrying both figures, so only the description is in question. */
const row = (description: string, fdcId = 1): Candidate => ({
  fdcId,
  description,
  foodNutrients: [{ nutrientId: 1079, value: 5 }, { nutrientId: 1093, value: 2 }],
})

describe('picking the row the dietician meant', () => {
  it('will not take the tin when the plan says you boiled it', () => {
    // "linte fiartă". USDA ranks the canned row first for a bare "lentils",
    // and canned lentils carry a hundred times the sodium of boiled ones.
    const chosen = pick(
      [row('Lentils, canned', 1), row('Lentils, mature seeds, cooked, boiled, without salt', 2)],
      food({ state: 'cooked' }),
    )
    expect(chosen?.fdcId).toBe(2)
  })

  it('refuses a salted row outright rather than ranking it lower', () => {
    // Nothing else on offer. No number is better than a wrong one, and the app
    // already knows how to say a figure is not known.
    expect(pick([row('Peanut butter, with salt')], food())).toBeUndefined()
    expect(pick([row('Oats, instant, fortified')], food())).toBeUndefined()
  })

  it('matches the state the food is stored in', () => {
    const rows = [row('Chickpeas, cooked, boiled', 1), row('Chickpeas, raw', 2)]
    expect(pick(rows, food({ state: 'cooked' }))?.fdcId).toBe(1)
    expect(pick(rows, food({ state: 'raw' }))?.fdcId).toBe(2)
  })

  it('skips a row that answers neither question', () => {
    // The first run matched garlic to a row with no fibre and no sodium in it
    // and gave up on garlic entirely, rather than reading the next row down.
    const empty: Candidate = { fdcId: 1, description: 'Garlic, raw', foodNutrients: [] }
    expect(pick([empty, row('Garlic, raw', 2)], food({ state: 'raw' }))?.fdcId).toBe(2)
  })

  it('falls back to USDA\'s own order once the salted rows are gone', () => {
    // No description says "raw" or "boiled". Relevance is a fair answer at
    // that point; it was only ever wrong because the tin outranked the bag.
    const chosen = pick([row('Telemea cheese', 7), row('Cheese, white, brined', 8)], food())
    expect(chosen?.fdcId).toBe(7)
  })

  it('has nothing to say about an empty answer', () => {
    expect(pick([], food())).toBeUndefined()
  })
})
