import type { Recipe } from '../types'
import { DISHES } from './dishes'
import { MEAL_RECIPES } from './generated/mealRecipes'
import { RECIPE_CLASSIFICATION } from './generated/classification'
import { TIMES_PLANNED } from './generated/reuse'

export { FOODS, FOOD_BY_ID } from './foods'
export { DISHES } from './dishes'
export { SOURCE_PLANS } from './generated/sourcePlans'
export { MEAL_RECIPES } from './generated/mealRecipes'
export { RECIPE_ALIASES } from './generated/recipeAliases'
export { TIMES_PLANNED } from './generated/reuse'

/**
 * The full recipe library.
 *
 * Dishes come first because meal recipes reference them as components, and
 * keeping the order stable makes the generated data diff cleanly.
 */
export const ALL_RECIPES: Recipe[] = [...DISHES, ...MEAL_RECIPES].map((recipe) => ({
  ...recipe,
  // Category and quick filters are generated separately, see
  // scripts/classify-recipes.ts, so re-deriving them never touches the much
  // larger recipe file and its diffs stay readable.
  ...RECIPE_CLASSIFICATION[recipe.id],
  // How often the plans came back to it. Attached here rather than written into
  // the recipe because it is equally true of the hand-written dishes, and those
  // are not generated.
  ...(TIMES_PLANNED[recipe.id] ? { timesPlanned: TIMES_PLANNED[recipe.id] } : {}),
}))
