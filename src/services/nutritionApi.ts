const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'
const OFF_BASE  = 'https://world.openfoodfacts.org'
const USDA_KEY  = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY'

export interface NutritionResult {
  name: string
  per100g: MacroPer100g
  micros?: MicroPer100g
  source: 'usda' | 'openfoodfacts'
  /**
   * Enough to trace the numbers back and to never fetch them twice: the
   * source's own id and name, what the figures are per, and, because European
   * labels state salt where USDA states sodium, which of the two was given.
   */
  externalId?: string
  sourceName?: string
  basePortion: { amount: number; unit: 'g' | 'ml' }
  saltAsGiven?: { kind: 'salt' | 'sodium'; value: number; unit: 'g' | 'mg' }
}

export interface MacroPer100g {
  calories: number
  protein: number
  carbs: number
  fat: number
}

/** Undefined means the source did not say, never that the value is zero. */
export type MicroPer100g = Partial<Record<
  | 'fiber' | 'sugar' | 'sodium' | 'saturatedFat' | 'cholesterol'
  | 'calcium' | 'iron' | 'magnesium' | 'potassium' | 'zinc'
  | 'vitaminA' | 'vitaminB6' | 'vitaminB12' | 'vitaminC' | 'vitaminD' | 'vitaminE' | 'folate',
  number
>>

/*
 * Energy under any of the three ids USDA states it as.
 *
 * 1008 is kcal on most rows; the Foundation set gives Atwater general (2047)
 * or specific (2048) on some instead. Reading only 1008 meant those rows
 * arrived with `calories: 0`, and a 0 kcal ingredient does not fail loudly, it
 * quietly zeroes the recipe it is added to, and then the day, and then the
 * week.
 */
const ENERGY_IDS = [1008, 2048, 2047]

// USDA nutrient IDs. https://fdc.nal.usda.gov/
const N = {
  calories:     1008,
  protein:      1003,
  carbs:        1005,
  fat:          1004,
  fiber:        1079,
  sugar:        2000,
  sodium:       1093,
  saturatedFat: 1258,
  cholesterol:  1253,
  calcium:      1087,
  iron:         1089,
  magnesium:    1090,
  potassium:    1092,
  zinc:         1095,
  vitaminA:     1106, // RAE
  vitaminB6:    1175,
  vitaminB12:   1178,
  vitaminC:     1162,
  vitaminD:     1114,
  vitaminE:     1109,
  folate:       1177, // DFE
}

/** How many decimals each nutrient is worth keeping. */
const PRECISION: Record<string, number> = {
  fiber: 10, sugar: 10, saturatedFat: 10, iron: 10, zinc: 10,
  vitaminB6: 100, vitaminB12: 100, vitaminC: 10, vitaminD: 10, vitaminE: 10,
  sodium: 1, cholesterol: 1, calcium: 1, magnesium: 1, potassium: 1,
  vitaminA: 1, folate: 1,
}

interface USDANutrient { nutrientId: number; value?: number }
interface USDAFood { description: string; foodNutrients: USDANutrient[]; fdcId?: number }

function parseUSDAFood(food: USDAFood): NutritionResult {
  // A nutrient the response does not carry stays absent from this map, which is
  // what keeps "not reported" from becoming a zero further down.
  const m = new Map<number, number>()
  for (const n of food.foodNutrients ?? []) {
    if (n.value != null) m.set(n.nutrientId, n.value)
  }

  const r = (v: number, d = 1) => Math.round(v * d) / d
  const micros: MicroPer100g = {}
  for (const [key, id] of Object.entries(N)) {
    if (key === 'calories' || key === 'protein' || key === 'carbs' || key === 'fat') continue
    const value = m.get(id)
    if (value != null) {
      micros[key as keyof MicroPer100g] = r(value, PRECISION[key] ?? 1)
    }
  }

  const sodium = m.get(N.sodium)
  const energy = ENERGY_IDS.map((id) => m.get(id)).find((v) => v != null)

  return {
    name: food.description,
    source: 'usda',
    externalId: food.fdcId != null ? String(food.fdcId) : undefined,
    sourceName: food.description,
    basePortion: { amount: 100, unit: 'g' },
    saltAsGiven: sodium != null ? { kind: 'sodium', value: r(sodium), unit: 'mg' } : undefined,
    per100g: {
      calories: r(energy ?? 0),
      protein:  r(m.get(N.protein)  ?? 0, 10),
      carbs:    r(m.get(N.carbs)    ?? 0, 10),
      fat:      r(m.get(N.fat)      ?? 0, 10),
    },
    micros,
  }
}

/**
 * Whether a search result is worth offering as an ingredient.
 *
 * USDA returns rows that state a handful of nutrients and no energy at all,
 * "Chicken, breast, boneless, skinless, raw" among them, and they arrived in
 * the picker reading 0 kcal per 100 g with nothing to say they were unknown
 * rather than empty. Adding one silently zeroed the recipe's calories, and
 * that recipe then fed the planner, the day rings and Progress.
 *
 * Left out rather than flagged. Everywhere else this app marks an unknown and
 * carries on, because there the unknown is one field of something you already
 * have; here it is a thing you have not added yet and there are six other rows
 * on the list that do state their energy.
 */
export function worthOffering(result: NutritionResult): boolean {
  return result.per100g.calories > 0
}

/**
 * Open Food Facts keys, with how many decimals each is worth keeping.
 *
 * The precision is not decoration. Vitamin B12 arrives in micrograms and a
 * portion holds a fraction of one, so rounding it to a whole number rounds it
 * to nothing, a nutrient the source did report, discarded on the way in.
 */
const OFF_KEYS: [keyof MicroPer100g, string, number][] = [
  ['fiber', 'fiber_100g', 10],
  ['sugar', 'sugars_100g', 10],
  ['saturatedFat', 'saturated-fat_100g', 10],
  ['cholesterol', 'cholesterol_100g', 1],   // mg after conversion
  ['calcium', 'calcium_100g', 1],           // mg
  ['iron', 'iron_100g', 10],                // mg, small
  ['magnesium', 'magnesium_100g', 1],       // mg
  ['potassium', 'potassium_100g', 1],       // mg
  ['zinc', 'zinc_100g', 10],                // mg, small
  ['vitaminA', 'vitamin-a_100g', 1],        // mcg RAE, hundreds
  ['vitaminB6', 'vitamin-b6_100g', 100],    // mg, tiny
  ['vitaminB12', 'vitamin-b12_100g', 100],  // mcg, tiny
  ['vitaminC', 'vitamin-c_100g', 10],       // mg
  ['vitaminD', 'vitamin-d_100g', 10],       // mcg, small
  ['vitaminE', 'vitamin-e_100g', 10],       // mg
  ['folate', 'vitamin-b9_100g', 1],         // mcg DFE, hundreds
]

/** Minerals and vitamins Open Food Facts reports in grams, not milligrams. */
const IN_GRAMS = new Set<keyof MicroPer100g>([
  'cholesterol', 'calcium', 'iron', 'magnesium', 'potassium', 'zinc',
  'vitaminB6', 'vitaminC', 'vitaminE',
])
/** …and the ones it reports in grams that the app keeps in micrograms. */
const IN_GRAMS_TO_MCG = new Set<keyof MicroPer100g>(['vitaminA', 'vitaminB12', 'vitaminD', 'folate'])

function parseOFFProduct(p: Record<string, unknown>): NutritionResult {
  const n = (p.nutriments ?? {}) as Record<string, number>
  const micros: MicroPer100g = {}

  for (const [key, offKey, precision] of OFF_KEYS) {
    const value = n[offKey]
    if (value == null) continue
    const scaled = IN_GRAMS.has(key) ? value * 1000
      : IN_GRAMS_TO_MCG.has(key) ? value * 1_000_000
      : value
    micros[key] = Math.round(scaled * precision) / precision
  }

  // Salt or sodium, whichever the label carried. European products state salt.
  const saltGrams = n['salt_100g']
  const sodiumGrams = n['sodium_100g']
  const saltAsGiven = sodiumGrams != null
    ? { kind: 'sodium' as const, value: Math.round(sodiumGrams * 1000), unit: 'mg' as const }
    : saltGrams != null
      ? { kind: 'salt' as const, value: Math.round(saltGrams * 100) / 100, unit: 'g' as const }
      : undefined

  if (sodiumGrams != null) micros.sodium = Math.round(sodiumGrams * 1000)
  else if (saltGrams != null) micros.sodium = Math.round((saltGrams / 2.5) * 1000)

  const barcode = p.code ?? p._id
  const name = String(p.product_name || p.generic_name || '')

  return {
    name,
    source: 'openfoodfacts',
    externalId: barcode != null ? String(barcode) : undefined,
    sourceName: name,
    basePortion: { amount: 100, unit: 'g' },
    saltAsGiven,
    per100g: {
      calories: Math.round(n['energy-kcal_100g'] ?? 0),
      protein:  Math.round((n['proteins_100g']      ?? 0) * 10) / 10,
      carbs:    Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
      fat:      Math.round((n['fat_100g']           ?? 0) * 10) / 10,
    },
    micros,
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
   * identical, "no results", and the obvious next move was to type the
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

  // Both are asked at once, but USDA comes first in the list: it is the
  // reference source for generic ingredients, chicken, rice, a tomato, and its
  // figures are laboratory measurements. Open Food Facts is community-entered
  // label data, which is exactly what you want for a branded yogurt and not what
  // you want for a potato.
  if (usda.status === 'fulfilled') results.push(...usda.value)
  else problems.push({ source: 'usda', reason: reasonFor(usda.reason) })

  if (off.status === 'fulfilled') results.push(...off.value)
  else problems.push({ source: 'openfoodfacts', reason: reasonFor(off.reason) })

  // A row with no energy figure is not an ingredient anybody can use. See
  // `worthOffering`: adding one zeroes whatever it is added to.
  return { results: results.filter(worthOffering).slice(0, 14), problems }
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
    fields: 'code,product_name,generic_name,nutriments',
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
    // The barcode is the id worth keeping, whatever the payload calls itself.
    return { found: true, food: { ...parseOFFProduct(data.product), externalId: barcode } }
  } catch (error) {
    return { found: false, reason: reasonFor(error) }
  }
}
