import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchFoods, lookupBarcode } from './nutritionApi'

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
