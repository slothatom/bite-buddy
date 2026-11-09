import { today } from '../../store/useMealPlanStore'

/**
 * Pure helpers the planner screens share: dates as the planner words them,
 * and the small roundings and shortenings its cells need.
 */

/**
 * As much of a name as sixty pixels can hold.
 *
 * The dietician writes "Roasted vegetables with salmon & yogurt garlic sauce",
 * and the part that identifies it is at the front. Cutting at the first "with"
 * or "&" keeps the dish and drops the accompaniments, which is what somebody
 * scanning a week is looking for. The whole thing is one tap away on the date.
 */
export function shortName(name: string): string {
  return name.split(/\s+(?:with|and|&)\s+/i)[0].split(',')[0]
}

/** Two decimals, which is as fine as a quarter portion or a gram ever needs. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function todayOrFirst(dates: string[]): string {
  const now = today()
  return dates.includes(now) ? now : dates[0]
}

export function formatDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export function formatRange(dates: string[]): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const first = new Date(dates[0] + 'T12:00:00').toLocaleDateString('en-GB', opts)
  const last = new Date(dates[dates.length - 1] + 'T12:00:00').toLocaleDateString('en-GB', opts)
  return `${first} to ${last}`
}

/**
 * A stretch of days as short as it can be said: "9 to 15 Nov", or
 * "28 Nov to 4 Dec" when it crosses a month.
 */
export function formatSpan(dates: string[]): string {
  const first = new Date(dates[0] + 'T12:00:00')
  const last = new Date(dates[dates.length - 1] + 'T12:00:00')
  const month = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' })
  return first.getMonth() === last.getMonth()
    ? `${first.getDate()} to ${last.getDate()} ${month(last)}`
    : `${first.getDate()} ${month(first)} to ${last.getDate()} ${month(last)}`
}
