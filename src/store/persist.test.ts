import { describe, it, expect } from 'vitest'
import { upgradeThrough, discardOlderThan } from './persist'

/**
 * Migration is the one piece of this app that can destroy data by working
 * incorrectly rather than by failing. Discarding used to be the only option,
 * which was defensible while nothing real was stored and is not now.
 */

describe('upgradeThrough', () => {
  const upgrades = {
    1: (s: Record<string, unknown>) => ({ ...s, two: true }),
    2: (s: Record<string, unknown>) => ({ ...s, three: true }),
  }

  it('passes current state straight through', () => {
    const state = { kept: 'yes' }
    expect(upgradeThrough(3, upgrades)(state, 3)).toBe(state)
  })

  it('applies every step between the stored version and this one', () => {
    expect(upgradeThrough(3, upgrades)({ kept: 'yes' }, 1))
      .toEqual({ kept: 'yes', two: true, three: true })
  })

  it('applies only the steps that are needed', () => {
    expect(upgradeThrough(3, upgrades)({ kept: 'yes' }, 2))
      .toEqual({ kept: 'yes', three: true })
  })

  it('discards state from a newer app rather than guessing at it', () => {
    // The other person's phone updated first. Their state may contain fields
    // this build has never heard of; there is no safe reading of it.
    expect(upgradeThrough(2, upgrades)({ kept: 'yes' }, 5)).toBeUndefined()
  })

  it('discards when a step in the chain is missing', () => {
    // A gap means nobody wrote the upgrade. Silently skipping it would hand the
    // app a shape it does not understand.
    expect(upgradeThrough(3, { 2: upgrades[2] })({ kept: 'yes' }, 1)).toBeUndefined()
  })

  it('discards anything that is not an object', () => {
    expect(upgradeThrough(2, upgrades)('corrupt', 1)).toBeUndefined()
    expect(upgradeThrough(2, upgrades)(null, 1)).toBeUndefined()
  })
})

describe('discardOlderThan', () => {
  it('keeps only an exact version match', () => {
    expect(discardOlderThan(2)({ a: 1 }, 2)).toEqual({ a: 1 })
    expect(discardOlderThan(2)({ a: 1 }, 1)).toBeUndefined()
    expect(discardOlderThan(2)({ a: 1 }, 3)).toBeUndefined()
  })
})
