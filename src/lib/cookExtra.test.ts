import { describe, it, expect } from 'vitest'
import { surplusLine, surplusOf } from './cookExtra'

const asked = { recipeId: 'stew', madeOn: '2026-09-08', id: 'p1' }

describe('cooking more than you eat', () => {
  it('puts the difference in the fridge', () => {
    // Cook three, eat one. The other two used to exist only in your fridge and
    // your memory, which is the pair of places this app exists to stop being
    // the only record.
    const spare = surplusOf({ ...asked, cooking: 3, eating: 1 })
    expect(spare?.servings).toBe(2)
    expect(spare?.storage).toBe('fridge')
  })

  it('dates the tub to the day it is cooked, not to today', () => {
    // Cooking on Sunday for a Wednesday dinner and stamping the tub today
    // would have the fridge calling it three days older than it is, and the
    // kitchen nudges read that date.
    expect(surplusOf({ ...asked, cooking: 2, eating: 1 })?.madeOn).toBe('2026-09-08')
  })

  it('calls it a batch, not a leftover', () => {
    // A leftover survives a meal you meant to finish. This is a pot somebody
    // deliberately made too much of, and the two mean different things about
    // the cook even though they look the same in the fridge.
    expect(surplusOf({ ...asked, cooking: 4, eating: 1 })?.source).toBe('batch')
  })

  it('has nothing to put away when you eat what you cooked', () => {
    expect(surplusOf({ ...asked, cooking: 1, eating: 1 })).toBeNull()
    expect(surplusLine(1, 1)).toBeNull()
  })

  it('has nothing to put away when you eat more than the pot holds', () => {
    // The dialogs stop this, but a negative helping must not become a tub of
    // minus one serving if one ever gets through.
    expect(surplusOf({ ...asked, cooking: 1, eating: 2 })).toBeNull()
  })

  it('keeps a half', () => {
    expect(surplusOf({ ...asked, cooking: 2, eating: 1.5 })?.servings).toBe(0.5)
    expect(surplusLine(2, 1.5)).toBe('0.5 servings into the fridge')
  })

  it('says one serving in the singular', () => {
    expect(surplusLine(2, 1)).toBe('1 serving into the fridge')
  })
})
