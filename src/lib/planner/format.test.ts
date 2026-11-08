import { describe, it, expect } from 'vitest'
import { formatDate, formatRange, round2, shortName, todayOrFirst } from './format'
import { today } from '../../store/useMealPlanStore'

describe('shortName', () => {
  it('keeps the dish and drops the accompaniments', () => {
    expect(shortName('Roasted vegetables with salmon & yogurt garlic sauce')).toBe('Roasted vegetables')
    expect(shortName('Bread and butter')).toBe('Bread')
    expect(shortName('Soup, bread')).toBe('Soup')
    expect(shortName('Porridge')).toBe('Porridge')
  })
})

describe('round2', () => {
  it('rounds to two decimals', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3)
    expect(round2(1.255 * 2)).toBe(2.51)
  })
})

describe('todayOrFirst', () => {
  it('prefers today when it is on screen, else the first day', () => {
    const now = today()
    expect(todayOrFirst(['2000-01-01', now])).toBe(now)
    expect(todayOrFirst(['2000-01-01', '2000-01-02'])).toBe('2000-01-01')
  })
})

describe('formatDate and formatRange', () => {
  it('words a date and a span the way the planner does', () => {
    expect(formatDate('2026-08-31')).toBe('Monday 31 August')
    expect(formatRange(['2026-08-31', '2026-09-01', '2026-09-06'])).toBe('31 Aug to 6 Sept')
  })
})
