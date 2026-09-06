import { describe, it, expect } from 'vitest'
import type { GroceryItem } from '../types'
import { formatGrams, parseAmount, householdAmount, listAsText } from './grocery'

describe('reading an amount someone typed', () => {
  it('takes grams when the unit says grams', () => {
    expect(parseAmount('250 g')).toEqual({ grams: 250 })
    expect(parseAmount(' 250g ')).toEqual({ grams: 250 })
    expect(parseAmount('250 grams')).toEqual({ grams: 250 })
  })

  it('reads a bare number as a count, not as grams', () => {
    // The unit used to be optional and defaulted to grams, so typing 1 next to
    // "Vanilla Milk" bought one gram of vanilla milk. Nobody shopping has ever
    // meant that, and the box has always suggested "2 packs".
    //
    // Guessing from the size of the number is the other option and it is
    // worse: a threshold reading 500 as grams and 2 as packs is a rule nobody
    // can see, and it would be wrong about 200 eggs and 2 kg of flour in the
    // same list.
    expect(parseAmount('1')).toEqual({ text: '1' })
    expect(parseAmount('250')).toEqual({ text: '250' })
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

describe('what to put in the basket', () => {
  it('counts things you can pick up', () => {
    expect(householdAmount(360, [{ label: 'tomato', grams: 120 }])).toBe('3 tomatoes')
    expect(householdAmount(150, [{ label: 'apple', grams: 150 }])).toBe('1 apple')
  })

  it('leaves measures alone, because they are not a thing to buy', () => {
    // Three tablespoons of oats is not a shopping instruction, and reads like
    // one, which is worse than the grams it replaced.
    expect(householdAmount(30, [{ label: 'tbsp', grams: 10 }])).toBeUndefined()
    expect(householdAmount(300, [{ label: 'half a plate', grams: 150 }])).toBeUndefined()
    expect(householdAmount(400, [{ label: 'bowl', grams: 200 }])).toBeUndefined()
  })

  it('says nothing when the rounding would be a lie', () => {
    // 1.4 peppers is not a number anybody can act on.
    expect(householdAmount(170, [{ label: 'pepper', grams: 120 }])).toBeUndefined()
  })

  it('gives up once a count stops being a count', () => {
    expect(householdAmount(1000, [{ label: 'clove', grams: 3 }])).toBeUndefined()
    expect(householdAmount(60, [{ label: 'tomato', grams: 120 }])).toBeUndefined()
  })

  it('pluralises without inventing words', () => {
    expect(householdAmount(16, [{ label: 'cake', grams: 8 }])).toBe('2 cakes')
    expect(householdAmount(160, [{ label: 'flatbread', grams: 80 }])).toBe('2 flatbreads')
  })

  it('has nothing to say about a food with no units', () => {
    expect(householdAmount(200, undefined)).toBeUndefined()
    expect(householdAmount(200, [])).toBeUndefined()
  })
})

describe('handing the list to somebody else', () => {
  const item = (over: Partial<GroceryItem>): GroceryItem => ({
    id: 'i', foodId: 'f', name: 'Tomatoes', grams: 360, category: 'vegetables',
    checked: false, fromRecipeIds: [], ...over,
  })
  const labels = { vegetables: 'Vegetables', dairy: 'Dairy' }
  // As the screen does it: no weight means no weight, not zero.
  const amount = (i: GroceryItem) => i.amount ?? (i.grams ? `${i.grams} g` : '')

  it('groups it the way the screen does', () => {
    const text = listAsText([
      item({ id: 'a' }),
      item({ id: 'b', name: 'Yogurt', category: 'dairy', grams: 400 }),
    ], labels, amount)

    expect(text).toContain('Vegetables')
    expect(text).toContain('  Tomatoes , 360 g')
    expect(text).toContain('Dairy')
  })

  it('leaves out what is already in the trolley', () => {
    const text = listAsText([
      item({ id: 'a' }),
      item({ id: 'b', name: 'Yogurt', checked: true }),
    ], labels, amount)

    expect(text).toContain('Tomatoes')
    expect(text).not.toContain('Yogurt')
  })

  it('says so rather than sending an empty message', () => {
    expect(listAsText([item({ checked: true })], labels, amount)).toBe('Nothing left to buy.')
  })

  it('copes with a line that has no amount', () => {
    const text = listAsText([item({ grams: 0, name: 'Washing-up liquid' })], labels, amount)
    expect(text).toContain('Washing-up liquid')
    expect(text).not.toContain(' , ')
  })
})
