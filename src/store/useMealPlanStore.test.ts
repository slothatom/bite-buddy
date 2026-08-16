import { describe, expect, it } from 'vitest'
import { getWeekDates } from './useMealPlanStore'

/**
 * The week shape is the one piece of date handling that is easy to get subtly
 * wrong and hard to notice: every dietician plan runs Wednesday to Tuesday.
 */
describe('getWeekDates', () => {
  it('starts the week on Wednesday by default', () => {
    // 2026-08-16 is a Sunday; its Wednesday-start week begins on the 12th.
    const week = getWeekDates(new Date('2026-08-16T12:00:00'), 3)
    expect(week[0]).toBe('2026-08-12')
    expect(week[6]).toBe('2026-08-18')
  })

  it('returns the same week for every day inside it', () => {
    const from = getWeekDates(new Date('2026-08-12T12:00:00'), 3)
    const to = getWeekDates(new Date('2026-08-18T12:00:00'), 3)
    expect(from).toEqual(to)
  })

  it('honours a different week start', () => {
    expect(getWeekDates(new Date('2026-08-16T12:00:00'), 1)[0]).toBe('2026-08-10')
    expect(getWeekDates(new Date('2026-08-16T12:00:00'), 0)[0]).toBe('2026-08-16')
  })

  it('always returns seven consecutive dates', () => {
    const week = getWeekDates(new Date('2026-02-27T12:00:00'), 3)
    expect(week).toHaveLength(7)
    for (let i = 1; i < week.length; i++) {
      const gap = Date.parse(week[i]) - Date.parse(week[i - 1])
      expect(gap).toBe(86_400_000)
    }
  })

  it('does not shift the day across a daylight-saving boundary', () => {
    // Europe/Bucharest springs forward on 2026-03-29; midday anchoring keeps
    // each date on its own day regardless of the local offset.
    const week = getWeekDates(new Date('2026-03-30T12:00:00'), 3)
    expect(new Set(week).size).toBe(7)
  })
})
