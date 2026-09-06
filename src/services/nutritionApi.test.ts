import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchFoods, lookupBarcode, worthOffering } from './nutritionApi'
import type { NutritionResult } from './nutritionApi'

/**
 * These cover the failure paths, not the happy one.
 *
 * Both lookups used to return an empty array whatever went wrong, so being
 * rate-limited, being offline and genuinely finding nothing were the same
 * outcome on screen: "no results". That sends you off to type in numbers the
 * database already had.
 */

function mockFetch(handler: (url: string) => Response | Promise<Response> | never) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => handler(String(input))))
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

afterEach(() => vi.unstubAllGlobals())

describe('searchFoods', () => {
  it('reports rate limiting rather than calling it "no results"', async () => {
    // The USDA allows about 30 requests an hour without your own key.
    mockFetch((url) => (url.includes('nal.usda.gov') ? json({}, 429) : json({ products: [] })))

    const { results, problems } = await searchFoods('oats')
    expect(results).toEqual([])
    expect(problems).toContainEqual({ source: 'usda', reason: 'rate-limited' })
  })

  it('reports being offline', async () => {
    mockFetch(() => { throw new TypeError('Failed to fetch') })

    const { problems } = await searchFoods('oats')
    expect(problems.map((p) => p.reason)).toEqual(['offline', 'offline'])
  })

  it('distinguishes a server being down from either', async () => {
    mockFetch(() => json({}, 503))

    const { problems } = await searchFoods('oats')
    expect(problems.every((p) => p.reason === 'unavailable')).toBe(true)
  })

  it('keeps results from the source that worked, and still says the other failed', async () => {
    mockFetch((url) =>
      url.includes('nal.usda.gov')
        ? json({ foods: [{ description: 'Oats, raw', foodNutrients: [{ nutrientId: 1008, value: 389 }] }] })
        : json({}, 500))

    const { results, problems } = await searchFoods('oats')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Oats, raw')
    // A partial answer that looks complete is the quiet version of the same bug.
    expect(problems).toEqual([{ source: 'openfoodfacts', reason: 'unavailable' }])
  })

  it('an empty answer from both sources is not a problem, just no matches', async () => {
    mockFetch((url) => (url.includes('nal.usda.gov') ? json({ foods: [] }) : json({ products: [] })))

    const { results, problems } = await searchFoods('nonsense')
    expect(results).toEqual([])
    expect(problems).toEqual([])
  })
})

describe('lookupBarcode', () => {
  it('separates an unknown product from an unreachable server', async () => {
    mockFetch(() => json({ status: 0 }))
    expect(await lookupBarcode('5901234123457')).toEqual({ found: false, reason: 'unknown-product' })

    mockFetch(() => { throw new TypeError('Failed to fetch') })
    expect(await lookupBarcode('5901234123457')).toEqual({ found: false, reason: 'offline' })
  })

  it('returns the product when it is known', async () => {
    mockFetch(() => json({
      status: 1,
      product: { product_name: 'Oat milk', nutriments: { 'energy-kcal_100g': 46, proteins_100g: 1 } },
    }))

    const result = await lookupBarcode('5901234123457')
    expect(result.found).toBe(true)
    if (result.found) expect(result.food.name).toBe('Oat milk')
  })
})

/*
 * Every fixture here states an energy figure, including the ones testing salt
 * and micronutrients that do not look at it.
 *
 * Not decoration: `searchFoods` drops a result with no energy, because a 0
 * kcal ingredient does not fail loudly, it silently zeroes the recipe it is
 * added to. A fixture without one is a food the picker would never offer, so
 * testing anything else about it would be testing a row nobody can reach.
 */
describe('what comes back from a source', () => {
  const usdaFood = {
    fdcId: 171077,
    description: 'Chicken, broilers or fryers, breast, meat only, raw',
    foodNutrients: [
      { nutrientId: 1008, value: 114 },
      { nutrientId: 1003, value: 21.2 },
      { nutrientId: 1005, value: 0 },
      { nutrientId: 1004, value: 2.59 },
      { nutrientId: 1093, value: 45 },   // sodium mg
      { nutrientId: 1095, value: 0.68 }, // zinc
      { nutrientId: 1178, value: 0.21 }, // B12
      { nutrientId: 1090, value: 27 },   // magnesium
    ],
  }

  it('keeps the source, its id and its own name for the food', async () => {
    // Without these the same ingredient gets fetched again every time, and a
    // wrong number cannot be traced back to whoever said it.
    mockFetch((url) => (url.includes('nal.usda.gov')
      ? json({ foods: [usdaFood] })
      : json({ products: [] })))

    const { results } = await searchFoods('chicken breast')
    expect(results[0].source).toBe('usda')
    expect(results[0].externalId).toBe('171077')
    expect(results[0].sourceName).toContain('Chicken')
    expect(results[0].basePortion).toEqual({ amount: 100, unit: 'g' })
  })

  it('keeps the micronutrients the source happened to have', async () => {
    mockFetch((url) => (url.includes('nal.usda.gov')
      ? json({ foods: [usdaFood] })
      : json({ products: [] })))

    const { results } = await searchFoods('chicken breast')
    expect(results[0].micros?.zinc).toBeCloseTo(0.7, 1)
    expect(results[0].micros?.vitaminB12).toBeCloseTo(0.21, 2)
    expect(results[0].micros?.magnesium).toBe(27)
  })

  it('leaves out a nutrient the source never mentioned', async () => {
    // Not zero. The response says nothing about vitamin D, which is not the
    // same as saying there is none.
    mockFetch((url) => (url.includes('nal.usda.gov')
      ? json({ foods: [usdaFood] })
      : json({ products: [] })))

    const { results } = await searchFoods('chicken breast')
    expect(results[0].micros).not.toHaveProperty('vitaminD')
    expect(results[0].micros?.vitaminD).toBeUndefined()
  })

  it('does not read a reported zero as missing', async () => {
    // Chicken really does have no carbohydrate, and the source said so.
    mockFetch((url) => (url.includes('nal.usda.gov')
      ? json({ foods: [usdaFood] })
      : json({ products: [] })))

    const { results } = await searchFoods('chicken breast')
    expect(results[0].per100g.carbs).toBe(0)
  })

  it('puts USDA first, because it is the reference for a generic ingredient', async () => {
    mockFetch((url) => (url.includes('nal.usda.gov')
      ? json({ foods: [usdaFood] })
      : json({ products: [{ code: '123', product_name: 'Chicken thing', nutriments: { 'energy-kcal_100g': 120 } }] })))

    const { results } = await searchFoods('chicken')
    expect(results[0].source).toBe('usda')
    expect(results.at(-1)?.source).toBe('openfoodfacts')
  })

  it('turns a European salt figure into sodium, and remembers it was salt', async () => {
    mockFetch((url) => (url.includes('nal.usda.gov')
      ? json({ foods: [] })
      : json({ products: [{ code: '5000112637922', product_name: 'Yogurt', nutriments: { 'energy-kcal_100g': 61, salt_100g: 0.25 } }] })))

    const { results } = await searchFoods('yogurt')
    expect(results[0].micros?.sodium).toBe(100)
    expect(results[0].saltAsGiven).toEqual({ kind: 'salt', value: 0.25, unit: 'g' })
  })

  it('prefers a stated sodium over a stated salt', async () => {
    mockFetch((url) => (url.includes('nal.usda.gov')
      ? json({ foods: [] })
      : json({ products: [{ code: '1', product_name: 'Thing', nutriments: { 'energy-kcal_100g': 200, salt_100g: 1, sodium_100g: 0.2 } }] })))

    const { results } = await searchFoods('thing')
    expect(results[0].micros?.sodium).toBe(200)
    expect(results[0].saltAsGiven?.kind).toBe('sodium')
  })

  it('converts the units Open Food Facts reports in grams', async () => {
    mockFetch((url) => (url.includes('nal.usda.gov')
      ? json({ foods: [] })
      : json({ products: [{ code: '1', product_name: 'Cereal', nutriments: {
          'energy-kcal_100g': 379,
          calcium_100g: 0.12,        // 120 mg
          'vitamin-d_100g': 0.0000042, // 4.2 mcg
        } }] })))

    const { results } = await searchFoods('cereal')
    expect(results[0].micros?.calcium).toBe(120)
    expect(results[0].micros?.vitaminD).toBeCloseTo(4.2, 1)
  })

  it('keeps the barcode as the id of a scanned product', async () => {
    mockFetch(() => json({ status: 1, product: { product_name: 'Scanned thing', nutriments: {} } }))

    const outcome = await lookupBarcode('5000112637922')
    expect(outcome.found).toBe(true)
    if (outcome.found) expect(outcome.food.externalId).toBe('5000112637922')
  })
})

describe('rounding on the way in', () => {
  it('does not round a micronutrient away to nothing', async () => {
    // B12 arrives in micrograms and a portion holds a fraction of one. Rounding
    // to a whole number turned a reported 0.21 into 0, a value the source had,
    // thrown away between the API and the food.
    mockFetch((url) => (url.includes('nal.usda.gov')
      ? json({ foods: [] })
      : json({ products: [{ code: '1', product_name: 'Milk', nutriments: {
          'energy-kcal_100g': 64,
          'vitamin-b12_100g': 0.00000045, // 0.45 mcg
          'vitamin-d_100g': 0.0000012,    // 1.2 mcg
          zinc_100g: 0.0004,              // 0.4 mg
        } }] })))

    const { results } = await searchFoods('milk')
    expect(results[0].micros?.vitaminB12).toBeCloseTo(0.45, 2)
    expect(results[0].micros?.vitaminD).toBeCloseTo(1.2, 1)
    expect(results[0].micros?.zinc).toBeCloseTo(0.4, 1)
  })
})

describe('a search result with no energy figure', () => {
  const result = (calories: number): NutritionResult => ({
    name: 'Chicken, breast, boneless, skinless, raw',
    source: 'usda',
    basePortion: { amount: 100, unit: 'g' },
    per100g: { calories, protein: 22.5, carbs: 0, fat: 2.6 },
  })

  it('is not offered as an ingredient', () => {
    // USDA returns rows stating a handful of nutrients and no energy. They
    // reached the picker reading 0 kcal, and adding one silently zeroed the
    // recipe, then the day, then the week.
    expect(worthOffering(result(0))).toBe(false)
  })

  it('leaves the ones that do state it alone', () => {
    expect(worthOffering(result(120))).toBe(true)
  })
})
