import { describe, it, expect } from 'vitest'
import { formatGrams, parseAmount } from './grocery'

describe('reading an amount someone typed', () => {
  it('takes grams with or without the unit', () => {
    expect(parseAmount('250')).toEqual({ grams: 250 })
    expect(parseAmount('250 g')).toEqual({ grams: 250 })
    expect(parseAmount(' 250g ')).toEqual({ grams: 250 })
  })

  it('takes kilograms, including the comma most of Europe writes', () => {
    expect(parseAmount('1.5 kg')).toEqual({ grams: 1500 })
    expect(parseAmount('1,5 kg')).toEqual({ grams: 1500 })
  })

  it('keeps anything that is not a weight exactly as typed', () => {
    // A shopping list is not only weights: you buy two packs of feta and one
    // bunch of parsley, and neither should be forced into grams.
    expect(parseAmount('2 packs')).toEqual({ text: '2 packs' })
    expect(parseAmount('a bunch')).toEqual({ text: 'a bunch' })
  })

  it('treats an empty box as no amount at all', () => {
    expect(parseAmount('   ')).toEqual({})
  })

  it('switches to kilograms once a bag gets heavy', () => {
    expect(formatGrams(950)).toBe('950 g')
    expect(formatGrams(1200)).toBe('1.2 kg')
  })
})
