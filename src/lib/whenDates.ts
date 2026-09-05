import type { MealSlot, WeekStart } from '../types'
import { getWeekDates } from '../store/useMealPlanStore'

/**
 * The window of days every picker in the app offers, and the meal the clock
 * suggests. Both live here rather than beside the component so that importing
 * "which days" does not mean importing a React tree, and so the rule can be
 * tested on its own.
 */

/** How many weeks the window covers, and where it starts relative to today. */
const WEEKS = 5
const WEEKS_BACK = 1

export function whenDates(from: string, weekStartsOn: WeekStart): string[] {
  const back = new Date(from + 'T12:00:00')
  back.setDate(back.getDate() - 7 * WEEKS_BACK)
  const start = getWeekDates(back, weekStartsOn)[0]

  const out: string[] = []
  for (let i = 0; i < WEEKS * 7; i += 1) {
    const d = new Date(start + 'T12:00:00')
    d.setDate(d.getDate() + i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

/**
 * Which meal it probably is, from the clock.
 *
 * A guess, and offered as one: every caller shows the slot and lets it be
 * changed. The alternative was the centre button always saying Breakfast, at
 * any hour, which made the most-tapped control in the app the one most likely
 * to file food in the wrong place.
 */
export function slotNow(hour = new Date().getHours()): MealSlot {
  if (hour < 10) return 'breakfast'
  if (hour < 12) return 'snack1'
  if (hour < 15) return 'lunch'
  if (hour < 17) return 'snack2'
  return 'dinner'
}
