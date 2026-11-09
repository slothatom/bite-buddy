import { describe, expect, it } from 'vitest'
import type { DayPlan, MealSlot } from '../../types'
import { dayChip, slotsPlanned } from './dayChip'

function day(...slots: MealSlot[]): DayPlan {
  return {
    date: '2026-11-09',
    meals: slots.map((slot, i) => ({ id: `m${i}`, slot, entries: [] })),
  }
}

describe('dayChip', () => {
  it('says nothing about a day with nothing on it', () => {
    expect(dayChip(undefined, 0, 1800)).toBeNull()
    expect(dayChip(day(), 0, 1800)).toBeNull()
  })

  it('counts the empty slots before it reads the total', () => {
    expect(dayChip(day('breakfast', 'lunch', 'dinner'), 3000, 1800)).toEqual({ label: '1 gap', tone: 'gap' })
    expect(dayChip(day('breakfast', 'lunch'), 900, 1800)?.label).toBe('2 gaps')
  })

  it('reads a full day against the target, with a little slack', () => {
    const full = day('breakfast', 'lunch', 'dinner', 'snack')
    expect(dayChip(full, 1850, 1800)).toEqual({ label: 'On track', tone: 'ok' })
    expect(dayChip(full, 1910, 1800)).toEqual({ label: '+ 110 kcal', tone: 'over' })
    expect(dayChip(full, 1650, 1800)?.label).toBe('On track')
    expect(dayChip(full, 1114, 1400)).toEqual({ label: '286 kcal under', tone: 'gap' })
  })

  it('counts a slot once however many meals it holds', () => {
    expect(slotsPlanned(day('snack', 'snack', 'lunch'))).toBe(2)
  })
})
