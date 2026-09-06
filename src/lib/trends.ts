import type { DayPlan, MedCategory, Nutrients } from '../types'
import type { NutritionContext } from './nutrition'
import { addNutrients, emptyNutrients, mealsThatCount, scaleNutrients, weekEaten, type DayReading } from './nutrition'
import { flattenComponents } from './ingredients'

/**
 * What a stretch of days adds up to, and what turned up in it most.
 *
 * Progress has answered "how is this week" for months and nothing has ever
 * answered "how is it going". A week is too short to show a habit: it is one
 * shop, one weekend and whatever happened on Tuesday, and two of those in a row
 * can look like opposite lives without either being unusual.
 *
 * Everything here reads what was ticked where anything was ticked, through
 * `weekEaten`, and reports the mix rather than blending a record and an
 * intention into one number. A trend built on what you meant to eat is a chart
 * of your intentions, which is a different and much less interesting subject.
 */

export type Span = 'fortnight' | 'month' | 'quarter'

export const SPANS: Span[] = ['fortnight', 'month', 'quarter']

export const SPAN_LABELS: Record<Span, string> = {
  fortnight: '2 weeks',
  month: '4 weeks',
  quarter: '12 weeks',
}

export const SPAN_DAYS: Record<Span, number> = {
  fortnight: 14,
  month: 28,
  quarter: 84,
}

/** The dates a span covers, oldest first, ending today. */
export function spanDates(span: Span, today: string): string[] {
  const end = new Date(today + 'T12:00:00')
  return Array.from({ length: SPAN_DAYS[span] }, (_, i) => {
    const d = new Date(end)
    d.setDate(d.getDate() - (SPAN_DAYS[span] - 1 - i))
    return d.toISOString().slice(0, 10)
  })
}

export interface Trend {
  days: DayReading[]
  /** Only the days holding something. An empty day is not a day you ate nothing. */
  withFood: DayReading[]
  recorded: number
  planned: number
  /**
   * The average day, or nothing at all.
   *
   * Nothing rather than a row of zeroes: a fortnight with no food in it has no
   * average, and printing 0 kcal would be the app stating a fact about days it
   * knows nothing about.
   */
  average: Nutrients | null
}

export function trend(dates: string[], plan: DayPlan[], ctx: NutritionContext): Trend {
  const { days, recorded, planned } = weekEaten(dates, plan, ctx)
  const withFood = days.filter((d) => d.any)

  const average = withFood.length
    ? scaleNutrients(
      withFood.reduce((sum, d) => addNutrients(sum, d.nutrients), emptyNutrients()),
      1 / withFood.length,
    )
    : null

  return { days, withFood, recorded, planned, average }
}

/**
 * The direction of travel, as a plain comparison of two halves.
 *
 * Not a regression line. A slope fitted to twenty-eight noisy days produces a
 * number with a decimal point and no meaning, and reads as precision nobody
 * measured. Halves are what a person does when they squint at a chart, and the
 * count of days behind each half comes back with it so a comparison resting on
 * two days can say so.
 */
export interface Direction {
  earlier: number | null
  later: number | null
  earlierDays: number
  laterDays: number
  /** The change, where both halves have something to compare. */
  change: number | null
}

export function direction(days: DayReading[], of: (n: Nutrients) => number | undefined): Direction {
  const half = Math.floor(days.length / 2)
  const mean = (slice: DayReading[]) => {
    const values = slice.filter((d) => d.any).map((d) => of(d.nutrients)).filter((v): v is number => v != null)
    return values.length ? { value: values.reduce((a, b) => a + b, 0) / values.length, n: values.length } : null
  }

  const a = mean(days.slice(0, half))
  const b = mean(days.slice(half))

  return {
    earlier: a?.value ?? null,
    later: b?.value ?? null,
    earlierDays: a?.n ?? 0,
    laterDays: b?.n ?? 0,
    change: a && b ? b.value - a.value : null,
  }
}

// ─── What you actually eat ───────────────────────────────────────────────────

export interface FoodTally {
  foodId: string
  name: string
  category: MedCategory
  /** Days it turned up on, which is the honest measure of a habit. */
  days: number
  grams: number
  calories: number
}

/**
 * The foods a stretch of days is actually made of, most-seen first.
 *
 * Counted by the number of days it appears on rather than by weight or by
 * calories, because that is what "what do we eat" means. Olive oil is in
 * everything and weighs nothing; a Sunday roast weighs a kilo and happens
 * once. Both figures come back so either can be read, but the ordering is by
 * days, and a food that turned up twice on one day counts once for that day.
 *
 * Nested recipes are walked down to the foods that were actually bought and
 * eaten, so a week of the dietician's lunches reports salmon and bulgur rather
 * than twelve recipe names.
 */
export function foodsEaten(
  dates: string[], plan: DayPlan[], ctx: NutritionContext,
): FoodTally[] {
  const byDate = new Map(plan.map((d) => [d.date, d]))
  const tally = new Map<string, FoodTally>()

  for (const date of dates) {
    const day = byDate.get(date)
    if (!day) continue

    // Skipped meals are not food you ate. The same rule the day totals use.
    const { meals } = mealsThatCount(day)
    const seenToday = new Set<string>()

    for (const meal of meals) {
      for (const item of flattenComponents(meal.entries, ctx)) {
        const at = tally.get(item.foodId) ?? {
          foodId: item.foodId,
          name: item.food.names.en,
          category: item.food.category,
          days: 0,
          grams: 0,
          calories: 0,
        }
        at.grams += item.grams
        at.calories += (item.food.per100g.calories * item.grams) / 100
        if (!seenToday.has(item.foodId)) {
          at.days += 1
          seenToday.add(item.foodId)
        }
        tally.set(item.foodId, at)
      }
    }
  }

  return [...tally.values()].sort((a, b) => b.days - a.days || b.grams - a.grams)
}

/**
 * A rolling mean, so a line can be read.
 *
 * A day of food is spiky by nature: one dinner out moves a chart more than a
 * fortnight of habit. Smoothed over a week the shape is the thing that is
 * actually changing. The raw days stay available; this is for the line drawn
 * over them, never for a number reported as a fact.
 */
export function smooth(values: (number | null)[], window = 7): (number | null)[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - Math.floor(window / 2))
    const seen = values.slice(from, i + Math.ceil(window / 2)).filter((v): v is number => v != null)
    return seen.length ? seen.reduce((a, b) => a + b, 0) / seen.length : null
  })
}

// ─── Drawing them ────────────────────────────────────────────────────────────

/**
 * A day, as a chart reads it.
 *
 * `value` is absent rather than zero where the day holds nothing, because the
 * app does not know what was eaten on a day nobody wrote anything down for,
 * and a bar of height nought says it does.
 */
export interface Point {
  date: string
  value: number | null
  recorded: boolean
}

export function pointsFrom(days: DayReading[], of: (d: DayReading) => number): Point[] {
  return days.map((d) => ({
    date: d.date,
    value: d.any ? of(d) : null,
    recorded: d.recorded,
  }))
}
