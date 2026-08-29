import type { DayPlan, Food, FoodState, MedCategory } from '../types'
import { mealsThatCount, type NutritionContext } from './nutrition'
import { flattenComponents, flattenWithLosses } from './ingredients'

/**
 * Scoring a week against the Mediterranean Diet guide's serving goals.
 *
 * The guide states goals per category and defines a serving in grams-equivalent
 * terms, "1 serving = ½ cup cooked or chopped raw vegetables" and so on. Those
 * definitions are turned into gram weights here so a planned week can be scored
 * without asking the user to count cups.
 */

export interface ServingGoal {
  category: MedCategory
  label: string
  /** Grams that count as one serving. */
  gramsPerServing: number
  /**
   * The state that figure is about.
   *
   * A serving of grains is conventionally 40 g uncooked; a serving of legumes
   * is a cooked weight. The food database records state as part of a food's
   * identity, and this was ignored, so 40 g of dry lentils were scored against
   * a cooked serving and counted as less than half of one.
   */
  servingState: FoodState
  /** Target servings, and whether that target is daily or weekly. */
  target: number
  period: 'day' | 'week'
}

export const SERVING_GOALS: ServingGoal[] = [
  { category: 'vegetables',   label: 'Vegetables',   gramsPerServing: 80,  target: 3, period: 'day',  servingState: 'raw' },
  { category: 'fruits',       label: 'Fruits',       gramsPerServing: 120, target: 2, period: 'day',  servingState: 'raw' },
  { category: 'grains',       label: 'Whole grains', gramsPerServing: 40,  target: 3, period: 'day',  servingState: 'dry' },
  { category: 'legumes',      label: 'Legumes',      gramsPerServing: 90,  target: 3, period: 'week', servingState: 'cooked' },
  { category: 'fish-seafood', label: 'Fish',         gramsPerServing: 120, target: 2, period: 'week', servingState: 'raw' },
  { category: 'nuts-seeds',   label: 'Nuts & seeds', gramsPerServing: 15,  target: 5, period: 'week', servingState: 'as-sold' },
  { category: 'red-meat',     label: 'Red meat',     gramsPerServing: 100, target: 1, period: 'week', servingState: 'raw' },
  // Listed as a category to limit and given no goal, so it never appeared on
  // the screen at all: the one group the guide is most emphatic about was the
  // one the app said nothing about.
  { category: 'treats',       label: 'Treats',       gramsPerServing: 40,  target: 2, period: 'week', servingState: 'as-sold' },
]

/**
 * Dry weight to cooked weight, near enough.
 *
 * Pulses and grains take up roughly two and a half times their dry weight in
 * water. It is a rule of thumb rather than a measurement, and it only ever
 * decides how a serving is counted, never a calorie: the energy comes from the
 * food's own per-100 g figures, in the state that food is stored in.
 */
const COOKED_FROM_DRY = 2.5

/** What one serving weighs, for a food in the state this one is stored in. */
export function servingGrams(food: Food, goal: ServingGoal): number {
  const dry = (s: FoodState) => s === 'dry'
  if (dry(goal.servingState) === dry(food.state)) return goal.gramsPerServing
  return dry(food.state)
    ? goal.gramsPerServing / COOKED_FROM_DRY
    : goal.gramsPerServing * COOKED_FROM_DRY
}

/**
 * What the week actually put on a plate, day by day.
 *
 * A day nobody has ticked counts as planned, and a day somebody has ticked
 * counts only what they said they ate. Without this the guide scored three
 * dinners you skipped: it read the plan and the plan alone, while the same
 * week's calories on the planner already knew better.
 */
function countedEntries(days: DayPlan[]) {
  return days.flatMap((day) => mealsThatCount(day).meals.flatMap((meal) => meal.entries))
}

/** Categories the guide says to limit rather than reach for. */
export const LIMIT_CATEGORIES: MedCategory[] = ['red-meat', 'treats']

/**
 * Servings per category, counting each ingredient in the state it is stored in.
 *
 * Summing grams first and dividing once at the end is what buried the state
 * problem: dry and cooked went into the same bucket and came out as one weight
 * with no way to tell them apart.
 */
export function servingsByCategory(
  days: DayPlan[], ctx: NutritionContext,
): Map<MedCategory, number> {
  const entries = countedEntries(days)
  const goals = new Map(SERVING_GOALS.map((g) => [g.category, g]))
  const totals = new Map<MedCategory, number>()

  for (const ingredient of flattenComponents(entries, ctx, { skip: ['water'] })) {
    const goal = goals.get(ingredient.food.category)
    if (!goal) continue
    const per = servingGrams(ingredient.food, goal)
    totals.set(goal.category, (totals.get(goal.category) ?? 0) + ingredient.grams / per)
  }
  return totals
}

/** Total grams eaten per category, resolving nested recipes down to foods. */
export function gramsByCategory(days: DayPlan[], ctx: NutritionContext): Map<MedCategory, number> {
  // Third copy of this tree walk, before it moved to lib/ingredients. Water is
  // skipped for the same reason it is left off a shopping list: nobody is
  // counting it towards a serving goal.
  const entries = countedEntries(days)
  const totals = new Map<MedCategory, number>()

  for (const ingredient of flattenComponents(entries, ctx, { skip: ['water'] })) {
    const category = ingredient.food.category
    totals.set(category, (totals.get(category) ?? 0) + ingredient.grams)
  }
  return totals
}

/**
 * What the week's scoring had to leave out, so the screen can say so.
 *
 * Two different silences, both of which used to pass without a word.
 * `noGoal` is food the guide has no serving size for, dropped mid-count.
 * `lost` is food the app cannot resolve at all. Either way the servings shown
 * are of less than the week, and a score presented as complete when it is not
 * is the whole reason this screen was reporting 80.7 of 21 in the first place.
 */
export interface ScoreGaps {
  /** Foods with no serving size for any guide group, by display name. */
  noGoal: string[]
  /** Components that resolved to nothing at all. */
  lost: number
}

export function scoreGaps(days: DayPlan[], ctx: NutritionContext): ScoreGaps {
  const goals = new Set(SERVING_GOALS.map((g) => g.category))
  const { ingredients, lost } = flattenWithLosses(countedEntries(days), ctx, { skip: ['water'] })

  const noGoal = new Map<string, string>()
  for (const ingredient of ingredients) {
    if (!goals.has(ingredient.food.category)) noGoal.set(ingredient.foodId, ingredient.food.names.en)
  }

  return { noGoal: [...noGoal.values()].sort(), lost: lost.length }
}

/**
 * A count so far past its target that it is a data problem rather than a result.
 *
 * The screen once read "Vegetables 80.7 of 21" and rendered it as a score,
 * because grams were being counted as servings. That specific bug is fixed and
 * tested, but a number three times its target is worth doubting on sight rather
 * than believing because the arithmetic happened to run.
 */
export const IMPLAUSIBLE_RATIO = 3

export interface GoalProgress extends ServingGoal {
  servings: number
  /** Target expressed over the days actually planned. */
  expected: number
  ratio: number
  /** For limit categories, being under target is the good outcome. */
  isLimit: boolean
}

export function scoreWeek(days: DayPlan[], ctx: NutritionContext): GoalProgress[] {
  const plannedDays = days.filter((d) => d.meals.length).length || 1
  const totals = servingsByCategory(days, ctx)

  return SERVING_GOALS.map((goal) => {
    const servings = totals.get(goal.category) ?? 0
    const expected = goal.period === 'day' ? goal.target * plannedDays : goal.target
    return {
      ...goal,
      servings,
      expected,
      ratio: expected > 0 ? servings / expected : 0,
      isLimit: LIMIT_CATEGORIES.includes(goal.category),
    }
  })
}
