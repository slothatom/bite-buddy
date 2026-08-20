const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'
const OFF_BASE  = 'https://world.openfoodfacts.org'
const USDA_KEY  = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY'

export interface NutritionResult {
  name: string
  per100g: MacroPer100g
  micros?: MicroPer100g
  source: 'usda' | 'openfoodfacts'
}

export interface MacroPer100g {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface MicroPer100g {
  fiber?: number        // g
  sugar?: number        // g
  sodium?: number       // mg
  calcium?: number      // mg
  iron?: number         // mg
  vitaminC?: number     // mg
  vitaminD?: number     // mcg
  potassium?: number    // mg
  saturatedFat?: number // g
}

// USDA nutrient IDs
const N = {
  calories:     1008,
  protein:      1003,
  carbs:        1005,
  fat:          1004,
  fiber:        1079,
  sugar:        2000,
  sodium:       1093,
  calcium:      1087,
  iron:         1089,
  vitaminC:     1162,
  vitaminD:     1114,
  potassium:    1092,
  saturatedFat: 1258,
}

interface USDANutrient { nutrientId: number; value?: number }
interface USDAFood { description: string; foodNutrients: USDANutrient[] }

function parseUSDAFood(food: USDAFood): NutritionResult {
  const m: Record<number, number> = {}
  ;(food.foodNutrients ?? []).forEach((n) => { m[n.nutrientId] = n.value ?? 0 })

  const r = (v: number, d = 1) => Math.round(v * d) / d

  return {
    name: food.description,
    source: 'usda',
    per100g: {
      calories: r(m[N.calories] ?? 0),
      protein:  r(m[N.protein]  ?? 0, 10),
      carbs:    r(m[N.carbs]    ?? 0, 10),
      fat:      r(m[N.fat]      ?? 0, 10),
    },
    micros: {
      fiber:        m[N.fiber]        ? r(m[N.fiber], 10)        : undefined,
      sugar:        m[N.sugar]        ? r(m[N.sugar], 10)        : undefined,
      sodium:       m[N.sodium]       ? r(m[N.sodium])           : undefined,
      calcium:      m[N.calcium]      ? r(m[N.calcium])          : undefined,
      iron:         m[N.iron]         ? r(m[N.iron], 10)         : undefined,
      vitaminC:     m[N.vitaminC]     ? r(m[N.vitaminC], 10)     : undefined,
      vitaminD:     m[N.vitaminD]     ? r(m[N.vitaminD], 10)     : undefined,
      potassium:    m[N.potassium]    ? r(m[N.potassium])        : undefined,
      saturatedFat: m[N.saturatedFat] ? r(m[N.saturatedFat], 10) : undefined,
    },
  }
}

function parseOFFProduct(p: Record<string, unknown>): NutritionResult {
  const n = (p.nutriments ?? {}) as Record<string, number>
  return {
    name: String(p.product_name || p.generic_name || ''),
    source: 'openfoodfacts',
    per100g: {
      calories: Math.round(n['energy-kcal_100g'] ?? 0),
      protein:  Math.round((n['proteins_100g']      ?? 0) * 10) / 10,
      carbs:    Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
      fat:      Math.round((n['fat_100g']           ?? 0) * 10) / 10,
    },
    micros: {
      fiber:        n['fiber_100g']          ? Math.round(n['fiber_100g'] * 10) / 10         : undefined,
      sugar:        n['sugars_100g']         ? Math.round(n['sugars_100g'] * 10) / 10        : undefined,
      sodium:       n['sodium_100g']         ? Math.round(n['sodium_100g'] * 1000)           : undefined,
      saturatedFat: n['saturated-fat_100g']  ? Math.round(n['saturated-fat_100g'] * 10) / 10 : undefined,
    },
  }
}

export type LookupProblem = 'offline' | 'rate-limited' | 'unavailable'

export interface LookupOutcome {
  results: NutritionResult[]
  /**
   * Which sources failed and why.
   *
   * Both lookups used to swallow every failure and return an empty array, so
   * being rate-limited, being offline and genuinely finding nothing all looked
   * identical — "no results" — and the obvious next move was to type the
   * numbers in by hand for a food the database knew perfectly well.
   */
  problems: Array<{ source: 'usda' | 'openfoodfacts'; reason: LookupProblem }>
}

/** Requests that hang leave the UI saying "searching" forever. */
const TIMEOUT_MS = 8_000

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const res = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (res.status === 429) throw new LookupError('rate-limited')
  if (!res.ok) throw new LookupError('unavailable')
  return res.json()
}

class LookupError extends Error {
  constructor(readonly reason: LookupProblem) {
    super(reason)
  }
}

function reasonFor(error: unknown): LookupProblem {
  if (error instanceof LookupError) return error.reason
  // A failed fetch with no response is the network being gone. Distinguishing
  // it matters: one is worth retrying in a moment, the other is not.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  return error instanceof TypeError ? 'offline' : 'unavailable'
}

export async function searchFoods(query: string, signal?: AbortSignal): Promise<LookupOutcome> {
  const [usda, off] = await Promise.allSettled([
    searchUSDA(query, signal),
    searchOFF(query, signal),
  ])

  const results: NutritionResult[] = []
  const problems: LookupOutcome['problems'] = []

  if (usda.status === 'fulfilled') results.push(...usda.value)
  else problems.push({ source: 'usda', reason: reasonFor(usda.reason) })

  if (off.status === 'fulfilled') results.push(...off.value)
  else problems.push({ source: 'openfoodfacts', reason: reasonFor(off.reason) })

  return { results: results.slice(0, 14), problems }
}

async function searchUSDA(query: string, signal?: AbortSignal): Promise<NutritionResult[]> {
  const params = new URLSearchParams({
    query,
    api_key: USDA_KEY,
    dataType: 'Foundation,SR Legacy',
    pageSize: '7',
  })
  const data = await fetchJson(`${USDA_BASE}/foods/search?${params}`, signal) as { foods?: USDAFood[] }
  return (data.foods ?? []).map(parseUSDAFood)
}

async function searchOFF(query: string, signal?: AbortSignal): Promise<NutritionResult[]> {
  const params = new URLSearchParams({
    search_terms: query,
    json: '1',
    page_size: '7',
    fields: 'product_name,generic_name,nutriments',
  })
  const data = await fetchJson(`${OFF_BASE}/cgi/search.pl?${params}`, signal) as {
    products?: Record<string, unknown>[]
  }
  return (data.products ?? [])
    .filter((p) => p.product_name)
    .map(parseOFFProduct)
}

export type BarcodeResult =
  | { found: true; food: NutritionResult }
  | { found: false; reason: 'unknown-product' | LookupProblem }

/**
 * A barcode is scanned at arm's length in a shop, so the difference between
 * "we have never heard of this product" and "your phone has no signal" is the
 * difference between typing it in and stepping outside.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeResult> {
  try {
    const data = await fetchJson(`${OFF_BASE}/api/v2/product/${barcode}.json`) as {
      status: number
      product?: Record<string, unknown>
    }
    if (data.status !== 1 || !data.product) return { found: false, reason: 'unknown-product' }
    return { found: true, food: parseOFFProduct(data.product) }
  } catch (error) {
    return { found: false, reason: reasonFor(error) }
  }
}
