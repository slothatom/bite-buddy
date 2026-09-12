import { describe, it, expect } from 'vitest'
import { guessCategory, guessDishType } from './foodImport'

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

describe('guessing what kind of dish a name names', () => {
  it('reads the dish out of the words it already matched on', () => {
    expect(guessDishType('Chicken soup')).toBe('soup')
    expect(guessDishType('Ciorbă de fasole')).toBe('soup')
    expect(guessDishType('Beef stew')).toBe('stew')
    expect(guessDishType('Vegetable curry')).toBe('curry')
    expect(guessDishType('Greek salad')).toBe('salad')
  })

  /* Hungarian builds the word up rather than out, the same case the group
     guesser has to handle: "leves" is a soup's ending, not its beginning. */
  it('reads a Hungarian soup, which ends rather than begins with it', () => {
    expect(guessDishType('Zoldsegleves')).toBe('soup')
  })

  it('says nothing when the name says nothing', () => {
    expect(guessDishType('Leftovers')).toBeUndefined()
    expect(guessDishType('Greek yogurt')).toBeUndefined()
  })
})
