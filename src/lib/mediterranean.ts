import type { DayPlan, MedCategory } from '../types'
import type { NutritionContext } from './nutrition'
import { flattenComponents } from './ingredients'

/**
 * Scoring a week against the Mediterranean Diet guide's serving goals.
 *
 * The guide states goals per category and defines a serving in grams-equivalent
 * terms — "1 serving = ½ cup cooked or chopped raw vegetables" and so on. Those
 * definitions are turned into gram weights here so a planned week can be scored
 * without asking the user to count cups.
 */

export interface ServingGoal {
  category: MedCategory
  label: string
  /** Grams that count as one serving. */
  gramsPerServing: number
  /** Target servings, and whether that target is daily or weekly. */
  target: number
  period: 'day' | 'week'
}

export const SERVING_GOALS: ServingGoal[] = [
  { category: 'vegetables',    label: 'Vegetables',   gramsPerServing: 80,  target: 3, period: 'day' },
  { category: 'fruits',        label: 'Fruits',       gramsPerServing: 120, target: 2, period: 'day' },
  { category: 'grains',        label: 'Whole grains', gramsPerServing: 40,  target: 3, period: 'day' },
  { category: 'legumes',       label: 'Legumes',      gramsPerServing: 90,  target: 3, period: 'week' },
  { category: 'fish-seafood',  label: 'Fish',         gramsPerServing: 120, target: 2, period: 'week' },
  { category: 'nuts-seeds',    label: 'Nuts & seeds', gramsPerServing: 15,  target: 5, period: 'week' },
  { category: 'red-meat',      label: 'Red meat',     gramsPerServing: 100, target: 1, period: 'week' },
]

/** Categories the guide says to limit rather than reach for. */
export const LIMIT_CATEGORIES: MedCategory[] = ['red-meat', 'treats']

/** Total grams eaten per category, resolving nested recipes down to foods. */
export function gramsByCategory(days: DayPlan[], ctx: NutritionContext): Map<MedCategory, number> {
  // Third copy of this tree walk, before it moved to lib/ingredients. Water is
  // skipped for the same reason it is left off a shopping list: nobody is
  // counting it towards a serving goal.
  const entries = days.flatMap((day) => day.meals.flatMap((meal) => meal.entries))
  const totals = new Map<MedCategory, number>()

  for (const ingredient of flattenComponents(entries, ctx, { skip: ['water'] })) {
    const category = ingredient.food.category
    totals.set(category, (totals.get(category) ?? 0) + ingredient.grams)
  }
  return totals
}

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
  const totals = gramsByCategory(days, ctx)

  return SERVING_GOALS.map((goal) => {
    const grams = totals.get(goal.category) ?? 0
    const servings = grams / goal.gramsPerServing
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
