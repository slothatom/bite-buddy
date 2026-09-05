import { describe, it, expect } from 'vitest'
import { readAmount, MOST } from './amounts'

/**
 * `min` on a number input is a hint to the browser, not a rule: it colours the
 * field and blocks the stepper arrows, and does nothing at all to what can be
 * typed or pasted. Every gram field in the app was relying on it.
 */
describe('reading a number somebody typed', () => {
  const grams = { max: MOST.grams }

  it('takes an ordinary amount as it is', () => {
    expect(readAmount('150', grams)).toBe(150)
  })

  it('caps a runaway rather than believing it', () => {
    // 999999 into a food's gram field was taken at face value and reported as
    // 2,469,998 kcal, with the digits overflowing the box.
    expect(readAmount('999999', grams)).toBe(MOST.grams)
  })

  it('does not keep the digits of a negative and throw away the sign', () => {
    // "-50" left the sign behind and kept the rest, so the field showed 050
    // and the app stored fifty grams of something you meant to remove.
    expect(readAmount('-50', grams)).toBe(0)
  })

  it('treats a half-typed box as the floor rather than as nothing', () => {
    // An empty box is somebody mid-keystroke. Snapping it to a number would
    // fight the cursor; reading it as NaN would poison every total downstream.
    expect(readAmount('', grams)).toBe(0)
    expect(readAmount('-', grams)).toBe(0)
    expect(readAmount('abc', grams)).toBe(0)
  })

  it('rounds to the places the unit actually comes in', () => {
    expect(readAmount('150.7', grams)).toBe(151)
    expect(readAmount('1.25', { max: 20, places: 1 })).toBe(1.3)
    expect(readAmount('1.24', { max: 20, places: 1 })).toBe(1.2)
  })

  it('honours a floor above zero, for things there cannot be none of', () => {
    expect(readAmount('0', { min: 1, max: 10 })).toBe(1)
  })

  it('holds a macro to the hundred grams it is measured in', () => {
    // 140 g of protein per 100 g of food is not a food.
    expect(readAmount('140', { max: MOST.gramsPer100g })).toBe(100)
    expect(readAmount('9999', { max: MOST.caloriesPer100g })).toBe(1000)
  })
})
