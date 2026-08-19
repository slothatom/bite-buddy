import type { Recipe } from '../types'
import { DISHES } from './dishes'
import { MEAL_RECIPES } from './generated/mealRecipes'

export { FOODS, FOOD_BY_ID } from './foods'
export { DISHES } from './dishes'
export { SOURCE_PLANS } from './generated/sourcePlans'
export { MEAL_RECIPES } from './generated/mealRecipes'

/**
 * The full recipe library.
 *
 * Dishes come first because meal recipes reference them as components, and
 * keeping the order stable makes the generated data diff cleanly.
 */
export const ALL_RECIPES: Recipe[] = [...DISHES, ...MEAL_RECIPES]
