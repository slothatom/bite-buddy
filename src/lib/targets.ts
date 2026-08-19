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

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  'very-active': 1.9,
}

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary — desk job, little exercise',
  light: 'Light — exercise 1–3 days a week',
  moderate: 'Moderate — exercise 3–5 days a week',
  active: 'Active — exercise 6–7 days a week',
  'very-active': 'Very active — physical job or twice-daily training',
}

/** Fibre target scales with intake: the common guideline is 14 g per 1000 kcal. */
function fibreFor(calories: number): number {
  return Math.round((calories / 1000) * 14)
}

/**
 * Splits a calorie figure into macros.
 *
 * Protein is set per kilogram of body weight where known — the useful anchor on
 * a reduced-calorie plan — with fat at 30% of energy and carbohydrate taking the
 * remainder, which is roughly how the dietician's own plans distribute.
 */
function splitMacros(calories: number, weightKg?: number): Macros {
  const protein = weightKg ? Math.round(weightKg * 1.6) : Math.round((calories * 0.25) / 4)
  const fat = Math.round((calories * 0.3) / 9)
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
  return bmr * ACTIVITY_FACTORS[p.activity ?? 'light']
}

export function fromTdee(p: TdeeProfile): Targets | undefined {
  const tdee = totalDailyEnergy(p)
  if (!tdee) return undefined

  // A 20% deficit is the usual sustainable rate; gaining uses a smaller surplus.
  const adjusted =
    p.goal === 'lose' ? tdee * 0.8 :
    p.goal === 'gain' ? tdee * 1.1 :
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
