import type { Component, DayPlan, MicroKey } from '../types'
import { reportNutrients, type NutrientReport, type NutritionContext } from './nutrition'
import { flattenWithLosses } from './ingredients'

/**
 * How many of a day's entries the app knows everything about.
 *
 * Built on the same rule as the `+` floor: unknown is not zero. The day's
 * report already names the nutrients only some ingredients mention, and the
 * day's totals print the ones they show as a floor, "12 g +", and counts the
 * entries that no longer resolve to food at all. An entry is fully known when
 * it is behind none of that: it resolves, and every ingredient under it states
 * every shown nutrient the day had to print as a floor. So the count says
 * which entries are the reason a `+` appears, rather than inventing a second
 * idea of "complete".
 *
 * Only the nutrients a day's totals actually show with a `+` count: fibre,
 * sugar and salt. The vitamins are tracked but never printed under a day, and
 * a hint driven by them would say "0 of 5" about a day whose every visible
 * figure is a plain total.
 */
export const SHOWN_FLOORS: readonly MicroKey[] = ['fiber', 'sugar', 'sodium']

export interface Completeness {
  /** Entries that resolve and add nothing unknown to the day's floors. */
  known: number
  /** Every entry counted. */
  total: number
  /** The day's own report, so a caller does not have to work it out twice. */
  report: NutrientReport
}

export function entriesCompleteness(entries: Component[], ctx: NutritionContext): Completeness {
  const report = reportNutrients(entries, ctx)
  const floors = report.partial.filter((k) => SHOWN_FLOORS.includes(k))
  let known = 0
  for (const entry of entries) {
    const { ingredients, lost } = flattenWithLosses([entry], ctx)
    if (lost.length) continue
    if (!ingredients.length) continue
    if (ingredients.every((i) => floors.every((k) => i.food.per100g[k] != null))) known++
  }
  return { known, total: entries.length, report }
}

/** The same, for every entry on a day, which is what `reportDay` totals. */
export function dayCompleteness(day: DayPlan, ctx: NutritionContext): Completeness {
  return entriesCompleteness(day.meals.flatMap((m) => m.entries), ctx)
}

/** "3 of 5 entries fully known", or nothing when there is nothing to count. */
export function completenessLine({ known, total }: Pick<Completeness, 'known' | 'total'>): string {
  if (total === 0) return ''
  return `${known} of ${total} ${total === 1 ? 'entry' : 'entries'} fully known`
}
