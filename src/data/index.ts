export { FOODS, FOOD_BY_ID } from './foods'
export { DISHES } from './dishes'

/*
 * The dietician's plans and everything made from them. Not in the repository:
 * they arrive at runtime from the household's archive (see ./archive.ts), and
 * these re-exports are live bindings, so they always read the current one.
 */
export {
  SOURCE_PLANS,
  MEAL_RECIPES,
  RECIPE_CLASSIFICATION,
  RECIPE_ALIASES,
  TIMES_PLANNED,
  ALL_RECIPES,
  setArchive,
  clearArchive,
  currentArchive,
} from './archive'
