import { describe, it, expect } from 'vitest'
import { whenDates, slotNow } from './whenDates'

/**
 * There were four day pickers and they disagreed about everything: 42 days
 * including ones long gone, the current week, only days before today, and the
 * next eight. Same question, four incompatible answers.
 */
describe('the window every picker offers', () => {
  const dates = whenDates('2026-09-05', 1)

  it('is five whole weeks, so the grid has no ragged edge', () => {
    expect(dates).toHaveLength(35)
    expect(dates[0]).toBe('2026-08-24')
    expect(dates[34]).toBe('2026-09-27')
  })

  it('starts on the chosen weekday, whichever that is', () => {
    // 2026-09-05 is a Saturday. Monday weeks start on the 24th, Sunday weeks
    // on the 23rd, and the dietician's own weeks ran Wednesday to Tuesday.
    expect(whenDates('2026-09-05', 0)[0]).toBe('2026-08-23')
    expect(whenDates('2026-09-05', 3)[0]).toBe('2026-08-26')
  })

  it('runs consecutively, with no gap across a month boundary', () => {
    for (let i = 1; i < dates.length; i += 1) {
      expect(Date.parse(dates[i]) - Date.parse(dates[i - 1])).toBe(86_400_000)
    }
  })

  it('reaches back far enough to log something you forgot', () => {
    // A week back at least, because "I ate that on Tuesday" is a real thing to
    // want to say and the pickers that hid past days made it impossible.
    expect(dates.filter((d) => d < '2026-09-05').length).toBeGreaterThanOrEqual(7)
  })

  it('reaches forward far enough to plan a fortnight', () => {
    expect(dates.filter((d) => d > '2026-09-05').length).toBeGreaterThanOrEqual(14)
  })

  it('always contains today', () => {
    for (const start of [0, 1, 3] as const) {
      expect(whenDates('2026-09-05', start)).toContain('2026-09-05')
    }
  })

  it('does not shift a day across a daylight-saving boundary', () => {
    // Europe/Bucharest falls back on 2026-10-25.
    const across = whenDates('2026-10-25', 1)
    expect(new Set(across).size).toBe(35)
    expect(across).toContain('2026-10-25')
  })
})

describe('the meal the clock suggests', () => {
  it('follows the day round', () => {
    expect(slotNow(8)).toBe('breakfast')
    expect(slotNow(11)).toBe('snack1')
    expect(slotNow(13)).toBe('lunch')
    expect(slotNow(16)).toBe('snack2')
    expect(slotNow(19)).toBe('dinner')
  })

  it('never says breakfast in the evening', () => {
    // Which is what the centre button did, at any hour, from any screen.
    for (let hour = 12; hour < 24; hour += 1) {
      expect(slotNow(hour), `${hour}:00`).not.toBe('breakfast')
    }
  })
})
