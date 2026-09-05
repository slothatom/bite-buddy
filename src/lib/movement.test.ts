import { describe, it, expect } from 'vitest'
import type { Workout } from '../types'
import { dayMovement, movementAcross, movementLabel, NO_MOVEMENT } from './movement'

const session = (over: Partial<Workout> = {}): Workout => ({
  id: 'w1',
  personId: 'arany',
  date: '2026-09-05',
  entries: [{ id: 'e1', exerciseId: 'ex-cycle-light', minutes: 60 }],
  ...over,
})

describe('what a day of movement came to', () => {
  it('says nothing at all about a day with nothing in it', () => {
    expect(dayMovement([session()], '2026-09-04', 70)).toEqual(NO_MOVEMENT)
    expect(movementLabel(NO_MOVEMENT)).toBeNull()
  })

  it('adds up the sessions on the day and leaves the others alone', () => {
    const week = [
      session({ id: 'a', date: '2026-09-05' }),
      session({ id: 'b', date: '2026-09-05' }),
      session({ id: 'c', date: '2026-09-06' }),
    ]
    expect(dayMovement(week, '2026-09-05', 70).sessions).toBe(2)
    expect(dayMovement(week, '2026-09-05', 70).minutes).toBe(120)
  })

  it('reports minutes but no calories when nobody has recorded a weight', () => {
    // Unknown is not zero. The MET equation needs a weight, and a day that
    // reported "0 kcal" for an hour of cycling would be stating a falsehood
    // rather than declining to guess.
    const m = dayMovement([session()], '2026-09-05', undefined)
    expect(m.minutes).toBe(60)
    expect(m.kcal).toBeUndefined()
    expect(movementLabel(m)).toBe('60 min')
  })

  it('takes the figure off your watch over the one off the table', () => {
    const watch = session({ entries: [], bulk: { label: 'Gym', minutes: 45, calories: 400 } })
    const m = dayMovement([watch], '2026-09-05', 70)
    expect(m.kcal).toBe(400)
    // Nothing was guessed at, so nothing is hedged.
    expect(m.estimated).toBe(false)
  })

  it('marks the total an estimate as soon as any part of it was guessed', () => {
    const both = [
      session({ id: 'a', entries: [], bulk: { label: 'Gym', minutes: 45, calories: 400 } }),
      session({ id: 'b' }),
    ]
    expect(dayMovement(both, '2026-09-05', 70).estimated).toBe(true)
  })

  it('says the minutes before the calories, since only one of them is measured', () => {
    const m = dayMovement([session()], '2026-09-05', 70)
    expect(movementLabel(m)).toMatch(/^60 min · about [\d,]+ kcal$/)
  })

  it('walks a run of days and keeps the empty ones', () => {
    // The week chart needs a column for a rest day, not a gap where one was.
    const across = movementAcross([session()], ['2026-09-04', '2026-09-05'], 70)
    expect(across.map((d) => d.movement.sessions)).toEqual([0, 1])
  })
})
