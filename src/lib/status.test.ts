import { describe, expect, it } from 'vitest'
import { targetStatus } from './status'

/**
 * The design system is explicit that over-target must never be carried by hue
 * alone, so every over-target result has to come with a label and a symbol.
 */
describe('targetStatus', () => {
  it('reports nothing when there is no target', () => {
    expect(targetStatus(1200, undefined).level).toBe('none')
    expect(targetStatus(1200, 0).level).toBe('none')
  })

  it('is on track up to 105%', () => {
    expect(targetStatus(1000, 1000).level).toBe('on-track')
    expect(targetStatus(1050, 1000).level).toBe('on-track')
  })

  it('is slightly over between 105% and 130%', () => {
    const s = targetStatus(1120, 1000)
    expect(s.level).toBe('slightly-over')
    expect(s.label).toBe('Slightly over')
    expect(s.deltaLabel).toBe('+120 kcal')
    expect(s.symbol).toBe('+')
  })

  it('is over target beyond 130%', () => {
    const s = targetStatus(1430, 1000)
    expect(s.level).toBe('over')
    expect(s.label).toBe('Over target')
    expect(s.deltaLabel).toBe('+430 kcal')
    expect(s.symbol).toBe('!')
  })

  it('carries a non-colour cue whenever it is over target', () => {
    for (const value of [1100, 1200, 1400, 2600]) {
      const s = targetStatus(value, 1000)
      expect(s.label, `${value} should be labelled`).not.toBe('')
      expect(s.symbol, `${value} should have a symbol`).not.toBe('')
    }
  })

  it('uses the unit it is given', () => {
    expect(targetStatus(140, 100, 'g').deltaLabel).toBe('+40 g')
  })

  it('sits exactly on the boundaries predictably', () => {
    expect(targetStatus(105, 100).level).toBe('on-track')
    expect(targetStatus(130, 100).level).toBe('slightly-over')
    expect(targetStatus(131, 100).level).toBe('over')
  })
})
