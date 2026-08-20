import { describe, it, expect } from 'vitest'
import {
  PORTION_UNITS, toGrams, fromGrams, unitsFor, gramsPerPiece, defaultUnit, unitAvailable,
} from './portions'

const egg = { units: [{ label: '1 egg', grams: 55 }], category: 'eggs' as const }
const oil = { units: [{ label: 'o lingurita', grams: 5 }], category: 'fats-vinegars' as const }
const flour = { units: [], category: 'grains' as const }
const water = { units: [], category: 'beverages' as const }

describe('the units an amount can be entered in', () => {
  it('offers the eight the brief asks for', () => {
    expect(PORTION_UNITS).toEqual(['g', 'kg', 'ml', 'l', 'piece', 'tsp', 'tbsp', 'cup'])
  })

  it('converts the weights and volumes', () => {
    expect(toGrams(1, 'g')).toBe(1)
    expect(toGrams(1.5, 'kg')).toBe(1500)
    expect(toGrams(250, 'ml')).toBe(250)
    expect(toGrams(1, 'l')).toBe(1000)
    expect(toGrams(1, 'tsp')).toBe(5)
    expect(toGrams(2, 'tbsp')).toBe(30)
    expect(toGrams(1, 'cup')).toBe(240)
  })

  it('reads a piece off the food, because a piece is not a fixed weight', () => {
    expect(toGrams(2, 'piece', egg)).toBe(110)
  })

  it('prefers a whole item over a spoon when reading what a piece weighs', () => {
    // A food with both "1 egg" and "o lingurita" must not decide a piece is 5 g.
    const both = { units: [{ label: 'o lingurita', grams: 5 }, { label: '1 egg', grams: 55 }] }
    expect(gramsPerPiece(both)).toBe(55)
  })

  it('refuses a piece of something that has no pieces, rather than guessing', () => {
    // Falling back to grams here would silently turn "1 piece" into 1 g.
    expect(toGrams(1, 'piece', flour)).toBeUndefined()
    expect(toGrams(1, 'piece')).toBeUndefined()
    expect(unitAvailable('piece', flour)).toBe(false)
    expect(unitsFor(flour)).not.toContain('piece')
    expect(unitsFor(egg)).toContain('piece')
  })

  it('refuses a negative or nonsense amount', () => {
    expect(toGrams(-5, 'g')).toBeUndefined()
    expect(toGrams(Number.NaN, 'g')).toBeUndefined()
  })

  it('goes back the other way for display', () => {
    expect(fromGrams(240, 'cup')).toBe(1)
    expect(fromGrams(110, 'piece', egg)).toBe(2)
    expect(fromGrams(100, 'piece', flour)).toBeUndefined()
  })

  it('round-trips without drift at kitchen quantities', () => {
    for (const unit of ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup'] as const) {
      const grams = toGrams(3, unit)!
      expect(fromGrams(grams, unit)).toBeCloseTo(3, 10)
    }
  })

  it('opens on millilitres for something you pour and grams for the rest', () => {
    expect(defaultUnit(water)).toBe('ml')
    expect(defaultUnit(oil)).toBe('g')
  })
})
