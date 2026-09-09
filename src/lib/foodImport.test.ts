import { describe, it, expect } from 'vitest'
import { guessCategory } from './foodImport'

describe('guessing a food group from its name', () => {
  it('puts the obvious ones where they belong', () => {
    expect(guessCategory('Greek yogurt')).toBe('dairy')
    expect(guessCategory('Chicken breast')).toBe('poultry')
    expect(guessCategory('Rolled oats')).toBe('grains')
    expect(guessCategory('Blueberries')).toBe('fruits')
  })

  it('matches at the start of a word, not anywhere in the string', () => {
    // Every one of these was wrong when the patterns matched substrings:
    // leustean contains "tea", peanut butter went to legumes before nuts.
    expect(guessCategory('Leustean')).not.toBe('beverages')
    expect(guessCategory('Peanut butter')).not.toBe('legumes')
  })

  it('reads a cooked dish as a dish, not as its loudest ingredient', () => {
    // A chicken soup is not a serving of chicken, and a ciorba filed under
    // vegetables would put a bowl of broth towards a vegetable goal it never
    // earned. Cooked dishes carries no serving goal, so it is counted for its
    // calories and disclosed rather than scored.
    expect(guessCategory('Chicken soup')).toBe('dishes')
    expect(guessCategory('Ciorba de legume')).toBe('dishes')
    expect(guessCategory('Ciorbă de fasole')).toBe('dishes')
    expect(guessCategory('Beef stew')).toBe('dishes')
    // Hungarian builds the word up rather than out: the soup is the ending.
    expect(guessCategory('Tyukhusleves')).toBe('dishes')
    expect(guessCategory('Zoldsegleves')).toBe('dishes')
  })

  it('falls back to the pantry rather than guessing', () => {
    // A wrong shelf is a small problem; a confident wrong shelf is worse,
    // because the audit reads this and would report a real group as an error.
    expect(guessCategory('Mamaliga')).toBe('pantry')
  })
})
