import type { DishCategory, Recipe } from '../types'
import type { NutritionContext } from './nutrition'

/**
 * How long a meal takes, when nobody wrote it down.
 *
 * The dietician's plans are portions, not methods. "125 g somon, 250 g legume
 * la cuptor" says what to eat and says nothing at all about time, so all 157
 * imported meals arrived with prep and cook at zero, and "Quick tonight" could
 * only ever see the 71 hand-written dishes. A filter that silently ignores two
 * thirds of the library is worse than no filter.
 *
 * These are estimates and the app says so. But they are not invented: the
 * numbers below are the dish library's own medians, written by hand alongside
 * the methods, and `cookingTimes.test.ts` holds them to that. Where a category
 * has no dish to learn from, the figure is a plain guess at a domestic kitchen
 * and is marked as one.
 */

export interface CookingTime {
  prep: number
  cook: number
}

/**
 * Minutes for a plate of each kind of food, from ingredients to table.
 *
 * Categories marked "measured" are the median of the dishes already written by
 * hand in that category, and the test pins them there. The rest are estimates
 * for categories the plans never used.
 */
export const CATEGORY_TIMES: Record<DishCategory, CookingTime> = {
  soup:       { prep: 10, cook: 25 },  // measured, 12 dishes
  stew:       { prep: 10, cook: 30 },  // measured, 5 dishes
  curry:      { prep: 10, cook: 30 },  // as a stew
  salad:      { prep: 8,  cook: 0 },   // measured, 9 dishes
  pasta:      { prep: 8,  cook: 12 },
  noodles:    { prep: 8,  cook: 12 },
  rice:       { prep: 5,  cook: 20 },
  grain:      { prep: 8,  cook: 20 },
  sandwich:   { prep: 5,  cook: 0 },
  wrap:       { prep: 12, cook: 12 },
  burger:     { prep: 12, cook: 12 },
  pizza:      { prep: 8,  cook: 20 },
  taco:       { prep: 10, cook: 10 },
  quesadilla: { prep: 6,  cook: 8 },
  omelette:   { prep: 3,  cook: 8 },   // measured, 5 dishes
  egg:        { prep: 5,  cook: 10 },
  meat:       { prep: 8,  cook: 25 },  // measured, 4 dishes
  fish:       { prep: 12, cook: 22 },
  seafood:    { prep: 10, cook: 12 },
  vegetable:  { prep: 8,  cook: 18 },  // measured, 17 dishes
  porridge:   { prep: 4,  cook: 8 },   // measured, 3 dishes
  cereal:     { prep: 3,  cook: 0 },
  pancake:    { prep: 8,  cook: 10 },
  waffle:     { prep: 8,  cook: 12 },
  bread:      { prep: 15, cook: 35 },
  toast:      { prep: 3,  cook: 4 },
  pastry:     { prep: 20, cook: 25 },
  cheese:     { prep: 5,  cook: 0 },
  yogurt:     { prep: 3,  cook: 0 },
  dip:        { prep: 8,  cook: 0 },   // measured, 5 dishes
  sauce:      { prep: 5,  cook: 5 },
  fruit:      { prep: 3,  cook: 0 },
  snack:      { prep: 3,  cook: 0 },
  dessert:    { prep: 6,  cook: 0 },   // measured, 2 dishes
  cake:       { prep: 15, cook: 35 },
  cookie:     { prep: 15, cook: 12 },
  smoothie:   { prep: 5,  cook: 0 },
  drink:      { prep: 3,  cook: 0 },
}

/** Categories with enough hand-written dishes to be worth checking against. */
export const MEASURED: DishCategory[] = [
  'soup', 'stew', 'salad', 'omelette', 'meat', 'vegetable', 'porridge', 'dip',
]

/** A minute each for the other things on the plate, and never more than five. */
const ASSEMBLY_CAP = 5

/**
 * What a meal takes, from what it is made of.
 *
 * The longest thing in it decides the cooking: a salmon fillet and a tray of
 * roasted vegetables go in the oven together, they do not queue. Preparation is
 * the longest single job plus a minute for each other thing to be weighed,
 * sliced or spooned out, because those really do queue, up to a point.
 *
 * A dish the meal contains brings its own hand-written times, which always beat
 * the estimate for its category. Where a meal is only raw food on a plate,
 * "150 g iaurt, 40 g fulgi de ovaz, 100 g fructe de padure", the category is
 * all there is, and three minutes with a bowl is about right.
 */
export function deriveTimes(
  recipe: Pick<Recipe, 'components'>,
  ctx: NutritionContext,
  category: DishCategory,
): { prepMinutes: number; cookMinutes: number } {
  const floor = CATEGORY_TIMES[category] ?? { prep: 5, cook: 0 }
  let prep = floor.prep
  let cook = floor.cook

  for (const c of recipe.components) {
    if (c.kind !== 'recipe') continue
    const dish = ctx.recipes.get(c.recipeId)
    if (!dish) continue
    prep = Math.max(prep, dish.prepMinutes)
    cook = Math.max(cook, dish.cookMinutes)
  }

  const others = Math.min(ASSEMBLY_CAP, Math.max(0, recipe.components.length - 1))
  return { prepMinutes: prep + others, cookMinutes: cook }
}

/**
 * Whether a recipe's time is an estimate rather than something somebody timed.
 *
 * True for everything that came from the plans, which is most of the library.
 * The screens say "about 25 min" for those, because the dietician wrote
 * portions and never once wrote a clock time, and rounding a guess to the
 * minute and presenting it as fact is the sort of small dishonesty that makes
 * a reader stop believing the numbers that are real.
 */
export function timeIsEstimated(recipe: Pick<Recipe, 'sourceLine'>): boolean {
  return Boolean(recipe.sourceLine)
}
