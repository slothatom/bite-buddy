import type { ActivityLevel, Macros, SourcePlan, TdeeProfile, Targets } from '../types'
import { componentsNutrients, type NutritionContext } from './nutrition'

/**
 * Where the daily targets come from.
 *
 * Two independent routes, because they answer different questions:
 *  - `fromPlans` asks "what was I actually eating when this was working?" and
 *    averages the dietician's own 14 weeks.
 *  - `fromTdee` asks "what does the arithmetic say I need?" from body stats.
 * Neither is authoritative, so both are offered and either can be overridden.
 */

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary: desk job, little exercise',
  light: 'Light: exercise 1 to 3 days a week',
  moderate: 'Moderate: exercise 3 to 5 days a week',
  active: 'Active: exercise 6 to 7 days a week',
  'very-active': 'Very active: physical job or twice-daily training',
}

/**
 * Every constant this file applies, in one place, with where it comes from.
 *
 * Written out because a number with no source is indistinguishable from a
 * number somebody made up, and these decide what you eat. Change one here and
 * it changes everywhere, including the working shown on screen.
 */
export const RULES = {
  /** Mifflin-St Jeor (1990), the estimate most clinical guidance uses. */
  bmr: 'Mifflin-St Jeor',
  /** The activity multipliers published alongside it, applied to resting rate. */
  activity: { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, 'very-active': 1.9 },
  /** A 20% cut is the usual sustainable rate of loss; gaining uses a smaller surplus. */
  deficit: 0.8,
  surplus: 1.1,
  /** Grams of protein per kg of body weight, the amount that preserves lean mass in a deficit. */
  proteinPerKg: 1.6,
  /** Share of energy from fat, leaving carbohydrate the remainder. */
  fatShare: 0.3,
  /** Grams of fibre per 1000 kcal, the figure in the dietary reference intakes. */
  fibrePer1000: 14,
} as const

/** Fibre target scales with intake: the common guideline is 14 g per 1000 kcal. */
function fibreFor(calories: number): number {
  return Math.round((calories / 1000) * RULES.fibrePer1000)
}

/**
 * Splits a calorie figure into macros.
 *
 * Protein is set per kilogram of body weight where known, the useful anchor on
 * a reduced-calorie plan, with fat at 30% of energy and carbohydrate taking the
 * remainder, which is roughly how the dietician's own plans distribute.
 */
function splitMacros(calories: number, weightKg?: number): Macros {
  const protein = weightKg
    ? Math.round(weightKg * RULES.proteinPerKg)
    : Math.round((calories * 0.25) / 4)
  const fat = Math.round((calories * RULES.fatShare) / 9)
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))
  return { calories: Math.round(calories), protein, carbs, fat }
}

/** Mifflin-St Jeor, the standard resting-metabolic-rate estimate. */
export function basalMetabolicRate(p: TdeeProfile): number | undefined {
  if (!p.weightKg || !p.heightCm || !p.age || !p.sex) return undefined
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  return p.sex === 'male' ? base + 5 : base - 161
}

export function totalDailyEnergy(p: TdeeProfile): number | undefined {
  const bmr = basalMetabolicRate(p)
  if (!bmr) return undefined
  return bmr * RULES.activity[p.activity ?? 'light']
}

export function fromTdee(p: TdeeProfile): Targets | undefined {
  const tdee = totalDailyEnergy(p)
  if (!tdee) return undefined

  const adjusted =
    p.goal === 'lose' ? tdee * RULES.deficit :
    p.goal === 'gain' ? tdee * RULES.surplus :
    tdee

  const macros = splitMacros(adjusted, p.weightKg)
  return { ...macros, fiber: fibreFor(macros.calories), source: 'tdee' }
}

export interface PlanAverages {
  days: number
  perDay: Macros & { fiber: number }
  /** Lowest and highest day, so the spread is visible rather than hidden by the mean. */
  min: number
  max: number
}

/**
 * Averages the dietician's plans.
 *
 * Days with fewer than three logged meals are skipped: a handful of plan days
 * are partial (one week starts on a Thursday), and including them would drag
 * the average below what was actually prescribed.
 */
export function averagePlanDay(plans: SourcePlan[], ctx: NutritionContext): PlanAverages | undefined {
  const totals: (Macros & { fiber: number })[] = []

  for (const plan of plans) {
    // Another person's plan is not evidence about this user's intake.
    if (plan.subject !== 'self') continue
    for (const day of plan.days) {
      if (day.meals.length < 3) continue
      const n = day.meals.reduce(
        (acc, meal) => {
          const m = componentsNutrients(meal.entries, ctx)
          return {
            calories: acc.calories + m.calories,
            protein: acc.protein + m.protein,
            carbs: acc.carbs + m.carbs,
            fat: acc.fat + m.fat,
            fiber: acc.fiber + (m.fiber ?? 0),
          }
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
      )
      if (n.calories > 0) totals.push(n)
    }
  }

  if (!totals.length) return undefined

  const mean = (pick: (t: (typeof totals)[number]) => number) =>
    totals.reduce((a, t) => a + pick(t), 0) / totals.length

  return {
    days: totals.length,
    perDay: {
      calories: Math.round(mean((t) => t.calories)),
      protein: Math.round(mean((t) => t.protein)),
      carbs: Math.round(mean((t) => t.carbs)),
      fat: Math.round(mean((t) => t.fat)),
      fiber: Math.round(mean((t) => t.fiber)),
    },
    min: Math.round(Math.min(...totals.map((t) => t.calories))),
    max: Math.round(Math.max(...totals.map((t) => t.calories))),
  }
}

export function fromPlans(plans: SourcePlan[], ctx: NutritionContext): Targets | undefined {
  const avg = averagePlanDay(plans, ctx)
  if (!avg) return undefined
  return { ...avg.perDay, source: 'from-plans' }
}

export const FALLBACK_TARGETS: Targets = {
  calories: 1400, protein: 90, carbs: 140, fat: 50, fiber: 25, source: 'manual',
}

export interface TdeeStep {
  label: string
  /** The arithmetic, with this person's own numbers in it. */
  working: string
  result: string
}

/**
 * The calculation, step by step, in the numbers you entered.
 *
 * A single figure with a formula name next to it asks to be taken on trust,
 * and nobody should take a calorie target on trust. Every line here is one
 * multiplication you can check by hand.
 */
export function explainTdee(p: TdeeProfile): TdeeStep[] {
  const bmr = basalMetabolicRate(p)
  if (!bmr || !p.weightKg || !p.heightCm || !p.age || !p.sex) return []

  const activity = p.activity ?? 'light'
  const factor = RULES.activity[activity]
  const tdee = bmr * factor
  const goalFactor = p.goal === 'lose' ? RULES.deficit : p.goal === 'gain' ? RULES.surplus : 1
  const target = tdee * goalFactor
  const protein = Math.round(p.weightKg * RULES.proteinPerKg)
  const fat = Math.round((target * RULES.fatShare) / 9)
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4))
  const sexTerm = p.sex === 'male' ? '+ 5' : '- 161'

  return [
    {
      label: 'Resting rate, Mifflin-St Jeor',
      working: `10 x ${p.weightKg} kg + 6.25 x ${p.heightCm} cm - 5 x ${p.age} ${sexTerm}`,
      result: `${Math.round(bmr)} kcal`,
    },
    {
      label: `Times the ${activity.replace('-', ' ')} activity factor`,
      working: `${Math.round(bmr)} x ${factor}`,
      result: `${Math.round(tdee)} kcal`,
    },
    {
      label: goalFactor === 1
        ? 'Holding steady, so no adjustment'
        : goalFactor < 1 ? 'Less 20% to lose weight' : 'Plus 10% to gain weight',
      working: goalFactor === 1 ? `${Math.round(tdee)}` : `${Math.round(tdee)} x ${goalFactor}`,
      result: `${Math.round(target)} kcal`,
    },
    {
      label: 'Protein at 1.6 g per kg you weigh',
      working: `${p.weightKg} x ${RULES.proteinPerKg}`,
      result: `${protein} g`,
    },
    {
      label: 'Fat at 30% of those calories, at 9 kcal a gram',
      working: `${Math.round(target)} x 0.3 / 9`,
      result: `${fat} g`,
    },
    {
      label: 'Carbohydrate takes what is left, at 4 kcal a gram',
      working: `(${Math.round(target)} - ${protein} x 4 - ${fat} x 9) / 4`,
      result: `${carbs} g`,
    },
    {
      label: 'Fibre at 14 g per 1000 kcal',
      working: `${Math.round(target)} / 1000 x ${RULES.fibrePer1000}`,
      result: `${fibreFor(Math.round(target))} g`,
    },
  ]
}
