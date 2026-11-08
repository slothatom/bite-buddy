import type { WeekStart } from '../../types'
import { addDays, getWeekDates } from '../../store/useMealPlanStore'

/**
 * Which stretch of days a summary for the dietician covers.
 *
 * Three answers to the question people actually bring to an appointment:
 * this week, the month since the last visit, or two dates of their own.
 */
export type ExportSpan = 'this-week' | 'last-4-weeks' | 'custom'

export const EXPORT_SPAN_LABELS: Record<ExportSpan, string> = {
  'this-week': 'This week',
  'last-4-weeks': 'Last 4 weeks',
  custom: 'Custom',
}

/**
 * The longest stretch a custom range may cover.
 *
 * A summary is something a dietician reads in an appointment. A year of days
 * is a document nobody reads, and a slip of the date picker should not build
 * one.
 */
export const MOST_DAYS = 92

/** Every date from `from` to `to`, both included, in order. Swapped if backwards. */
export function datesBetween(from: string, to: string): string[] {
  const [a, b] = from <= to ? [from, to] : [to, from]
  const out: string[] = []
  for (let d = a; d <= b && out.length < MOST_DAYS; d = addDays(d, 1)) out.push(d)
  return out
}

/**
 * The dates a span covers, given today and the week the user lives in.
 *
 * "Last 4 weeks" is the four calendar weeks ending with this one, rather than
 * twenty-eight days back from today, so the Mediterranean goals, which are
 * counted per week, are scored over whole weeks.
 */
export function spanDates(
  span: ExportSpan,
  { today, weekStartsOn, from, to }: { today: string; weekStartsOn: WeekStart; from?: string; to?: string },
): string[] {
  const thisWeek = getWeekDates(new Date(today + 'T12:00:00'), weekStartsOn)
  if (span === 'this-week') return thisWeek
  if (span === 'last-4-weeks') return datesBetween(addDays(thisWeek[0], -21), thisWeek[6])
  return datesBetween(from || today, to || from || today)
}

/** Consecutive runs of at most seven days, from the start of the range. */
export function weeksOf(dates: string[]): string[][] {
  const out: string[][] = []
  for (let i = 0; i < dates.length; i += 7) out.push(dates.slice(i, i + 7))
  return out
}
