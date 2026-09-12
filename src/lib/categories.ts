import type { DishCategory, MedCategory } from '../types'
import { DISH_CATEGORIES, CATEGORY_LABELS as DISH_LABELS } from './dishCategories'

/**
 * Display names and icons for the Mediterranean guide's food groups, in the
 * order the guide itself presents them, followed by the app's own group for a
 * dish you cannot break into ingredients. See `MedCategory`.
 */

export const CATEGORY_ORDER: MedCategory[] = [
  'vegetables', 'legumes', 'fruits', 'grains', 'nuts-seeds', 'herbs-spices',
  'fats-vinegars', 'dairy', 'fish-seafood', 'poultry', 'eggs', 'red-meat',
  'pantry', 'spreads-sauces', 'treats', 'sweeteners', 'beverages',
  // Last, and not the guide's: see `MedCategory`. A cooked dish is one item
  // with no group of its own, and the shopping list has no aisle for it.
  'dishes',
]

export const CATEGORY_LABELS: Record<MedCategory, string> = {
  vegetables: 'Vegetables', legumes: 'Legumes', fruits: 'Fruits', grains: 'Whole grains',
  'nuts-seeds': 'Nuts & seeds', 'herbs-spices': 'Herbs & spices', 'fats-vinegars': 'Fats & vinegars',
  dairy: 'Dairy', 'fish-seafood': 'Fish & seafood', poultry: 'Poultry', eggs: 'Eggs',
  'red-meat': 'Red meat', pantry: 'Pantry', 'spreads-sauces': 'Spreads & sauces',
  treats: 'Treats', sweeteners: 'Sweeteners', beverages: 'Drinks',
  dishes: 'Cooked dishes',
}

export const CATEGORY_EMOJI: Record<MedCategory, string> = {
  vegetables: '🥬', legumes: '🫘', fruits: '🍑', grains: '🌾', 'nuts-seeds': '🥜',
  'herbs-spices': '🌿', 'fats-vinegars': '🫒', dairy: '🧀', 'fish-seafood': '🐟',
  poultry: '🍗', eggs: '🥚', 'red-meat': '🥩', pantry: '🥣', 'spreads-sauces': '🧴',
  treats: '🍫', sweeteners: '🍯', beverages: '💧', dishes: '🍲',
}

/**
 * The food groups a person actually picks from, and the dishes behind them.
 *
 * The guide's seventeen groups are ingredients, and `dishes` is the app's own
 * escape hatch for a bowl of soup that cannot be broken into any of them. As
 * one entry in a list it read as a shrug: a dropdown offering Vegetables,
 * Dairy, Eggs and then "Cooked dishes" tells you where a carrot goes and
 * nothing about where a soup goes.
 *
 * So the hatch is opened out. The list now names the dishes themselves, from
 * the same vocabulary recipes already use, and picking one records both facts:
 * the food group stays `dishes`, which is what the serving goals, the trends
 * and the shopping aisles read, and the kind of dish is kept beside it.
 *
 * Promoting these to food groups of their own was the alternative and it would
 * have bought nothing: all thirty-nine would still count towards no serving
 * goal, because a soup is not an ingredient however it is filed. This way the
 * list says what you mean and the arithmetic underneath is untouched.
 */
export const INGREDIENT_GROUPS: MedCategory[] = CATEGORY_ORDER.filter((c) => c !== 'dishes')

/** What a `<select>` carries for a dish, so one control can mean two fields. */
const DISH_PREFIX = 'dish:'

export function categoryValue(
  food: { category: MedCategory; dishType?: DishCategory },
): string {
  if (food.category !== 'dishes') return food.category
  return food.dishType ? `${DISH_PREFIX}${food.dishType}` : 'dishes'
}

export function parseCategoryValue(
  value: string,
): { category: MedCategory; dishType?: DishCategory } {
  if (!value.startsWith(DISH_PREFIX)) {
    // Leaving the dishes group clears the dish type: a food that is now Dairy
    // is not a soup, and a stale "soup" sitting on it would surface later as a
    // filter that matched something nobody would call a soup.
    return { category: value as MedCategory, dishType: undefined }
  }
  return { category: 'dishes', dishType: value.slice(DISH_PREFIX.length) as DishCategory }
}

/** The options under "Cooked dishes", with the unspecified case first. */
export const DISH_CHOICES: { value: string; label: string }[] = [
  { value: 'dishes', label: 'Cooked dish' },
  ...DISH_CATEGORIES.map((d) => ({ value: `${DISH_PREFIX}${d}`, label: DISH_LABELS[d] })),
]
