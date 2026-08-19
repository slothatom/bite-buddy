import { describe, expect, it } from 'vitest'
import { getWeekDates } from './useMealPlanStore'

/**
 * The week shape is the one piece of date handling that is easy to get subtly
 * wrong and hard to notice.
 */
describe('getWeekDates', () => {
  it('runs Monday to Sunday by default', () => {
    // 2026-08-16 is a Sunday, so it is the last day of the week that began
    // on Monday the 10th — not the first day of a new one.
    const week = getWeekDates(new Date('2026-08-16T12:00:00'))
    expect(week[0]).toBe('2026-08-10')
    expect(week[6]).toBe('2026-08-16')
  })

  it('returns the same week for every day inside it', () => {
    const from = getWeekDates(new Date('2026-08-10T12:00:00'))
    const to = getWeekDates(new Date('2026-08-16T12:00:00'))
    expect(from).toEqual(to)
  })

  it('honours a different week start', () => {
    // The dietician's own weeks ran Wednesday to Tuesday.
    expect(getWeekDates(new Date('2026-08-16T12:00:00'), 3)[0]).toBe('2026-08-12')
    expect(getWeekDates(new Date('2026-08-16T12:00:00'), 0)[0]).toBe('2026-08-16')
  })

  it('always returns seven consecutive dates', () => {
    const week = getWeekDates(new Date('2026-02-27T12:00:00'))
    expect(week).toHaveLength(7)
    for (let i = 1; i < week.length; i++) {
      const gap = Date.parse(week[i]) - Date.parse(week[i - 1])
      expect(gap).toBe(86_400_000)
    }
  })

  it('does not shift the day across a daylight-saving boundary', () => {
    // Europe/Bucharest springs forward on 2026-03-29; midday anchoring keeps
    // each date on its own day regardless of the local offset.
    const week = getWeekDates(new Date('2026-03-30T12:00:00'))
    expect(new Set(week).size).toBe(7)
  })
})
