/**
 * A body figure over time, and what it did.
 *
 * Weight and a tape measure are both the same shape of thing: a number, on a
 * date, taken whenever somebody remembered. That last part is what makes them
 * different from everything else the app charts. A meal plan has an opinion
 * about every day; a bathroom scale has an opinion about the days you stood on
 * it, which might be four times in one week and then not again until March.
 *
 * So the one rule that runs through all of this is that a point is placed by
 * its date and never by its position in the list. Spacing four readings evenly
 * across a chart draws a steady march when what happened was three days of
 * curiosity and a long silence, and the shape is the whole reason to draw a
 * chart at all.
 */

export interface Reading {
  date: string
  value: number
}

export type BodySpan = 'quarter' | 'halfYear' | 'year' | 'all'

export const BODY_SPANS: BodySpan[] = ['quarter', 'halfYear', 'year', 'all']

export const BODY_SPAN_LABELS: Record<BodySpan, string> = {
  quarter: '3 months',
  halfYear: '6 months',
  year: '1 year',
  all: 'All',
}

/**
 * Months rather than days, because a waist is not a weekly story.
 *
 * The trends tab reads food in weeks: you eat every day, so a fortnight is
 * plenty to see a habit. A body moves slowly and gets measured rarely, and a
 * fortnight of it is two dots.
 */
const BODY_SPAN_MONTHS: Record<Exclude<BodySpan, 'all'>, number> = {
  quarter: 3, halfYear: 6, year: 12,
}

/** The earliest date a span reaches back to, or nothing at all for 'all'. */
export function spanStart(span: BodySpan, today: string): string | null {
  if (span === 'all') return null
  const d = new Date(today + 'T12:00:00')
  d.setMonth(d.getMonth() - BODY_SPAN_MONTHS[span])
  return d.toISOString().slice(0, 10)
}

export function withinSpan(readings: Reading[], span: BodySpan, today: string): Reading[] {
  const from = spanStart(span, today)
  return from == null ? readings : readings.filter((r) => r.date >= from)
}

/**
 * What changed across a stretch, and over how long.
 *
 * The days between the first and last reading come back with the figure,
 * because "down 2 kg" means two different things over a fortnight and over a
 * year, and the app is not entitled to imply the faster one.
 *
 * A single reading has no change. Not zero: zero is a claim that nothing moved,
 * and one measurement cannot support it.
 */
export interface Change {
  first: Reading
  last: Reading
  /** Absent where there is only one reading, which is not a change of nought. */
  change: number | null
  days: number
}

export function changeOver(readings: Reading[]): Change | null {
  if (!readings.length) return null
  const first = readings[0]
  const last = readings[readings.length - 1]
  const days = Math.round(
    (new Date(last.date + 'T12:00:00').getTime() - new Date(first.date + 'T12:00:00').getTime())
    / 86_400_000,
  )
  return {
    first,
    last,
    change: readings.length > 1 ? last.value - first.value : null,
    days,
  }
}

/**
 * Where each reading sits along the chart, as a fraction from 0 to 1.
 *
 * By date, so a gap looks like a gap. Where every reading shares one date, or
 * there is only one, everything sits in the middle rather than dividing by a
 * span of zero and drawing a chart of NaN.
 */
export function positions(readings: Reading[]): number[] {
  if (readings.length < 2) return readings.map(() => 0.5)
  const first = new Date(readings[0].date + 'T12:00:00').getTime()
  const last = new Date(readings[readings.length - 1].date + 'T12:00:00').getTime()
  const span = last - first
  if (span <= 0) return readings.map(() => 0.5)
  return readings.map(
    (r) => (new Date(r.date + 'T12:00:00').getTime() - first) / span,
  )
}

/**
 * The vertical range a chart is drawn in.
 *
 * Padded, and never zero-high: a run of identical readings would otherwise
 * divide by nothing and put the line off the top of the box. A goal is folded
 * in because a target line above the chart is a target line you cannot see.
 */
export function range(values: number[], extra?: number): { min: number; max: number } {
  const all = extra == null ? values : [...values, extra]
  const low = Math.min(...all)
  const high = Math.max(...all)
  const pad = (high - low) * 0.12 || Math.max(Math.abs(high) * 0.02, 0.5)
  return { min: low - pad, max: high + pad }
}
