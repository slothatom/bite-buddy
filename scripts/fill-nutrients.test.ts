import { describe, it, expect } from 'vitest'
import type { Food } from '../src/types/index.js'
import { pick, resembles, type Candidate } from './fill-nutrients.js'

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

/**
 * The wrong matches from the run of 6 September, each with USDA's real figures.
 *
 * Every one of these was accepted on its description alone and would have put
 * a number for a different food into the app. They are kept as a set because
 * the failure was never one bad match, it was a search answering a different
 * question from the one asked, over and over.
 */
describe('a row that is a different food entirely', () => {
  const usda = (description: string, kcal: number, p: number, c: number, f: number): Candidate => ({
    fdcId: 1,
    description,
    foodNutrients: [
      { nutrientId: 1008, value: kcal }, { nutrientId: 1003, value: p },
      { nutrientId: 1005, value: c }, { nutrientId: 1004, value: f },
      { nutrientId: 1079, value: 1 }, { nutrientId: 1093, value: 1 },
    ],
  })

  const ours = (kcal: number, p: number, c: number, f: number) =>
    food({ per100g: { calories: kcal, protein: p, carbs: c, fat: f } })

  const cases: [string, Candidate, Food][] = [
    // Water is nought calories and water spinach is nineteen. No amount of
    // string matching reaches that; one look at the macros does.
    ['water vs water spinach', usda('Water convolvulus, raw', 19, 2.6, 3.1, 0.2), ours(0, 0, 0, 0)],
    ['milk vs milk crackers', usda('Crackers, milk', 450, 8, 70, 14), ours(64, 3.3, 4.8, 3.6)],
    ['apple vs rose-apple', usda('Rose-apples, raw', 25, 0.6, 5.7, 0.3), ours(52, 0.3, 13.8, 0.2)],
    ['orange vs orange peel', usda('Orange peel, raw', 97, 1.5, 25, 0.2), ours(47, 0.9, 11.8, 0.1)],
    ['grapes vs grape leaves', usda('Grape leaves, raw', 93, 5.6, 17.3, 2.1), ours(69, 0.7, 18.1, 0.2)],
    ['beef vs corned beef', usda('Beef, cured, corned beef', 251, 18, 0.5, 19), ours(158, 21.2, 0, 8.1)],
    ['goat cheese vs goat meat', usda('Game meat, goat, raw', 109, 20.6, 0, 2.3), ours(364, 21.6, 2.5, 29.8)],
  ]

  for (const [name, candidate, mine] of cases) {
    it(`refuses ${name}`, () => {
      expect(resembles(candidate, mine)).toBe(false)
      expect(pick([candidate], mine)).toBeUndefined()
    })
  }

  it('still takes the row that is the food', () => {
    // The check has to let the right answer through, or it is just a way of
    // importing nothing.
    const broccoli = usda('Broccoli, raw', 34, 2.8, 6.6, 0.4)
    expect(resembles(broccoli, ours(34, 2.8, 6.6, 0.4))).toBe(true)
    expect(pick([broccoli], ours(34, 2.8, 6.6, 0.4))?.description).toBe('Broccoli, raw')
  })

  it('forgives a table disagreeing with a table', () => {
    // The library's figures come from European composition tables and USDA's
    // do not, so they differ in the first decimal place all the time. That is
    // not evidence of a different food.
    const salmon = usda('Fish, salmon, chinook, raw', 179, 19.9, 0, 10.4)
    expect(resembles(salmon, ours(185, 20.5, 0, 11.0))).toBe(true)
  })

  it('says nothing either way about a figure USDA left out', () => {
    const noEnergy: Candidate = {
      fdcId: 1,
      description: 'Cheese, feta',
      foodNutrients: [{ nutrientId: 1003, value: 14.2 }, { nutrientId: 1093, value: 917 }],
    }
    expect(resembles(noEnergy, ours(264, 14.2, 4.1, 21.3))).toBe(true)
  })
})
