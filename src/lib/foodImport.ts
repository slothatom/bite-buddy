import type { Food, MedCategory, MedTier } from '../types'
import type { NutritionResult } from '../services/nutritionApi'

/**
 * Turning a search result into a food the app owns.
 *
 * One place, because there are two ways in, the Foods screen and the recipe
 * editor's ingredient search, and they have to store the same thing. A food
 * saved from a recipe that lacked its source id would be a food that has to be
 * looked up again, and a wrong number with nothing to trace it to.
 */

/** Which of the guide's groups a source's own wording suggests. */
const CATEGORY_HINTS: [RegExp, MedCategory][] = [
  [/yogurt|yoghurt|kefir|cheese|milk|cream|butter/i, 'dairy'],
  [/chicken|turkey|poultry/i, 'poultry'],
  [/beef|pork|lamb|veal|bacon|ham|sausage/i, 'red-meat'],
  [/fish|salmon|tuna|cod|trout|mackerel|sardine|shrimp|prawn|squid/i, 'fish-seafood'],
  [/\begg/i, 'eggs'],
  [/bean|lentil|chickpea|pea\b|tofu|hummus/i, 'legumes'],
  [/bread|rice|pasta|oat|flour|cereal|quinoa|bulgur|couscous|barley/i, 'grains'],
  [/nut|almond|walnut|cashew|seed|peanut/i, 'nuts-seeds'],
  [/oil|vinegar|olive/i, 'fats-vinegars'],
  [/juice|water|tea|coffee|drink|soda|cola/i, 'beverages'],
  [/chocolate|candy|sweet|biscuit|cookie|cake|crisps|chips/i, 'treats'],
  [/sugar|honey|syrup/i, 'sweeteners'],
  [/sauce|ketchup|mayonnaise|mustard|spread|dip/i, 'spreads-sauces'],
  [/salt|pepper|spice|herb|basil|oregano|cinnamon/i, 'herbs-spices'],
  [/apple|banana|orange|berry|berries|grape|melon|peach|pear|plum|mango|fruit/i, 'fruits'],
]

/**
 * A guess at the food group, from the name.
 *
 * Only a guess, and it does not need to be right: the group decides where the
 * food sits on the Foods screen and nothing about its numbers. You can change
 * it afterwards, and a wrong shelf is a much smaller problem than a blocking
 * question in the middle of writing a recipe.
 */
export function guessCategory(name: string): MedCategory {
  for (const [pattern, category] of CATEGORY_HINTS) {
    if (pattern.test(name)) return category
  }
  return 'pantry'
}

/** How often the guide says to eat that group. */
const TIER_BY_CATEGORY: Partial<Record<MedCategory, MedTier>> = {
  vegetables: 'daily', fruits: 'daily', grains: 'daily', 'nuts-seeds': 'daily',
  'herbs-spices': 'daily', 'fats-vinegars': 'daily', beverages: 'daily',
  legumes: 'weekly', 'fish-seafood': 'weekly',
  dairy: 'moderate', poultry: 'moderate', eggs: 'moderate',
  'red-meat': 'rare', treats: 'rare', sweeteners: 'rare',
}

export function importedFood(result: NutritionResult, id = `custom-${Date.now().toString(36)}`): Food {
  const category = guessCategory(result.name)

  return {
    id,
    names: { en: result.name },
    aliases: [],
    category,
    medTier: TIER_BY_CATEGORY[category] ?? 'moderate',
    state: 'as-sold',
    // Everything the source knew, not just the fields a form shows. A
    // micronutrient dropped here is one that has to be fetched again.
    per100g: { ...result.micros, ...result.per100g },
    units: [],
    source: result.source === 'usda' ? 'usda' : 'off',
    provenance: {
      source: result.source === 'usda' ? 'usda' : 'off',
      externalId: result.externalId,
      sourceName: result.sourceName ?? result.name,
      basePortion: result.basePortion,
      retrievedAt: new Date().toISOString(),
      saltAsGiven: result.saltAsGiven,
    },
    createdAt: new Date().toISOString(),
  }
}

/**
 * Whether a food already in the library is the same thing as a search result.
 *
 * Matched on the source's own id first, since that is exact, and on the name
 * only as a fallback. Without this, searching for the same yogurt twice adds it
 * twice and the library fills up with duplicates that differ by nothing.
 */
export function alreadyHave(foods: Food[], result: NutritionResult): Food | undefined {
  if (result.externalId) {
    const byId = foods.find((f) => f.provenance?.externalId === result.externalId)
    if (byId) return byId
  }
  const name = result.name.trim().toLowerCase()
  return foods.find((f) => f.names.en.trim().toLowerCase() === name)
}
