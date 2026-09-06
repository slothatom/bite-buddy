import { describe, it, expect } from 'vitest'
import { changeOver, positions, range, spanStart, withinSpan, type Reading } from './body'

const r = (date: string, value: number): Reading => ({ date, value })

describe('the stretch a body chart is read over', () => {
  it('reaches back in months, because a waist is not a weekly story', () => {
    expect(spanStart('quarter', '2026-09-06')).toBe('2026-06-06')
    expect(spanStart('year', '2026-09-06')).toBe('2025-09-06')
  })

  it('has no floor at all for everything you have ever logged', () => {
    expect(spanStart('all', '2026-09-06')).toBeNull()
    const all = [r('2019-01-01', 80), r('2026-09-06', 74)]
    expect(withinSpan(all, 'all', '2026-09-06')).toHaveLength(2)
  })

  it('drops what falls outside it', () => {
    const kept = withinSpan([r('2026-01-01', 80), r('2026-08-01', 76)], 'quarter', '2026-09-06')
    expect(kept.map((k) => k.date)).toEqual(['2026-08-01'])
  })
})

describe('what changed', () => {
  it('reports the change and how long it took', () => {
    // "Down 2 kg" means two different things over a fortnight and over a year.
    const out = changeOver([r('2026-08-07', 76), r('2026-09-06', 74)])
    expect(out?.change).toBe(-2)
    expect(out?.days).toBe(30)
  })

  it('has no change from one reading, rather than a change of nought', () => {
    // Zero is a claim that nothing moved. One measurement cannot support it.
    const out = changeOver([r('2026-09-06', 74)])
    expect(out?.change).toBeNull()
    expect(out?.days).toBe(0)
  })

  it('has nothing to say about nothing', () => {
    expect(changeOver([])).toBeNull()
  })
})

describe('where a reading sits on the chart', () => {
  it('places it by its date, never by its turn in the list', () => {
    // Three days of curiosity and then a long silence. Spaced by index this
    // draws a steady march, which is not what happened.
    const at = positions([r('2026-01-01', 80), r('2026-01-03', 79), r('2026-07-01', 74)])
    expect(at[0]).toBe(0)
    expect(at[2]).toBe(1)
    expect(at[1]).toBeLessThan(0.02)
  })

  it('puts a lone reading in the middle rather than dividing by no span', () => {
    expect(positions([r('2026-09-06', 74)])).toEqual([0.5])
    expect(positions([r('2026-09-06', 74), r('2026-09-06', 75)])).toEqual([0.5, 0.5])
  })
})

describe('the range a chart is drawn in', () => {
  it('pads, so the line is not flush with the edge', () => {
    const { min, max } = range([70, 80])
    expect(min).toBeLessThan(70)
    expect(max).toBeGreaterThan(80)
  })

  it('never has no height, even where nothing moved at all', () => {
    const { min, max } = range([74, 74, 74])
    expect(max).toBeGreaterThan(min)
  })

  it('makes room for the goal, or it is a line you cannot see', () => {
    const { min } = range([80, 78], 70)
    expect(min).toBeLessThan(70)
  })
})
