import { describe, it, expect } from 'vitest'
import type { WeightEntry } from '../types'
import { convert, entryKg, fromKg, inUnit, latestKg, round1, toKg } from './weight'

const entry = (weight: number, unit: 'kg' | 'lbs', date = '2026-09-05'): WeightEntry =>
  ({ id: date, date, weight, unit })

describe('reading a weight in the unit you asked for', () => {
  it('leaves a weight alone when the units already agree', () => {
    expect(convert(68.4, 'kg', 'kg')).toBe(68.4)
    expect(inUnit(entry(68.4, 'kg'), 'kg')).toBe(68.4)
  })

  it('converts between the two and back without drifting', () => {
    expect(round1(toKg(fromKg(68.4, 'lbs'), 'lbs'))).toBe(68.4)
  })

  it('knows what a kilogram is', () => {
    expect(round1(fromKg(70, 'lbs'))).toBe(154.3)
    expect(round1(toKg(154.3, 'lbs'))).toBe(70)
  })

  it('reads an entry typed in pounds for somebody reading kilograms', () => {
    // The fault this exists to prevent: before anything converted, an entry of
    // 154 lbs was printed as the bare number with the profile's unit beside
    // it, so switching the setting turned 154 pounds into 154 kilograms.
    expect(inUnit(entry(154.3, 'lbs'), 'kg')).toBe(70)
  })

  it('costs a workout in kilograms whatever the scales said', () => {
    // The MET equation is written in kilograms, so an entry in pounds passed
    // through raw would have reported a person as more than twice their weight
    // and an hour of cycling as more than twice its cost.
    expect(round1(entryKg(entry(154.3, 'lbs')))).toBe(70)
    expect(entryKg(entry(70, 'kg'))).toBe(70)
  })
})

describe('the weight a calorie estimate is costed at', () => {
  it('takes the most recent, whatever order they arrived in', () => {
    const out = latestKg([
      entry(70, 'kg', '2026-09-01'),
      entry(72, 'kg', '2026-09-05'),
      entry(71, 'kg', '2026-09-03'),
    ])
    expect(out).toBe(72)
  })

  it('has no answer at all when nobody has stepped on the scales', () => {
    // Not zero. A weight of zero through the MET equation is a burn of zero,
    // which the app would then report as a fact about an hour of cycling.
    expect(latestKg([])).toBeUndefined()
  })
})
