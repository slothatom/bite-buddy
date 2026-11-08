import { describe, expect, it } from 'vitest'
import type { DayPlan, Food, Recipe } from '../types'
import { buildContext, reportDay } from './nutrition'
import { completenessLine, dayCompleteness, entriesCompleteness } from './completeness'

function food(id: string, per100g: Food['per100g']): Food {
  return {
    id, names: { en: id }, aliases: [], category: 'pantry', medTier: 'daily',
    state: 'as-sold', per100g, units: [], source: 'curated',
  }
}

const OATS = food('oats', { calories: 380, protein: 13, carbs: 68, fat: 6.5, fiber: 10 })
const MILK = food('milk', { calories: 47, protein: 3.4, carbs: 4.8, fat: 1.5 })
const APPLE = food('apple', { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 })

const PORRIDGE: Recipe = {
  id: 'porridge', name: { en: 'Porridge' }, emoji: '🥣', servings: 2,
  components: [
    { kind: 'food', foodId: 'oats', grams: 80 },
    { kind: 'food', foodId: 'milk', grams: 200 },
  ],
  steps: [], tags: [], prepMinutes: 0, cookMinutes: 0, createdAt: '2022-01-01T00:00:00.000Z',
}

const ctx = buildContext([OATS, MILK, APPLE], [PORRIDGE])

function day(entries: DayPlan['meals'][number]['entries']): DayPlan {
  return { date: '2026-08-31', meals: [{ id: 'm1', slot: 'breakfast', entries }] }
}

describe('entriesCompleteness', () => {
  it('counts every entry as known when nothing on the day is a floor', () => {
    const c = entriesCompleteness([{ kind: 'food', foodId: 'apple', grams: 150 }], ctx)
    expect(c).toMatchObject({ known: 1, total: 1 })
    expect(c.report.partial).toEqual([])
  })

  it('names the entry that makes fibre a floor, and only that one', () => {
    // The apple and the oats state fibre; the milk inside the porridge does not.
    const d = day([
      { kind: 'food', foodId: 'apple', grams: 150 },
      { kind: 'recipe', recipeId: 'porridge', servings: 1 },
    ])
    const c = dayCompleteness(d, ctx)
    expect(c.report.partial).toContain('fiber')
    expect(c).toMatchObject({ known: 1, total: 2 })
  })

  it('ignores the nutrients a day never prints with a +', () => {
    // Only the apple states vitamin C, so it is partial for the day, but no
    // day total shows vitamin C and it must not make the oats unknown.
    const withC = buildContext(
      [OATS, { ...APPLE, per100g: { ...APPLE.per100g, vitaminC: 4.6 } }], [])
    const c = entriesCompleteness([
      { kind: 'food', foodId: 'apple', grams: 150 },
      { kind: 'food', foodId: 'oats', grams: 50 },
    ], withC)
    expect(c.report.partial).toContain('vitaminC')
    expect(c).toMatchObject({ known: 2, total: 2 })
  })

  it('agrees with the day report it is built on', () => {
    const d = day([{ kind: 'recipe', recipeId: 'porridge', servings: 1 }])
    expect(dayCompleteness(d, ctx).report).toEqual(reportDay(d, ctx))
  })

  it('never counts an entry the library has lost as known', () => {
    const c = entriesCompleteness([
      { kind: 'food', foodId: 'apple', grams: 100 },
      { kind: 'recipe', recipeId: 'gone', servings: 1 },
    ], ctx)
    expect(c).toMatchObject({ known: 1, total: 2 })
    expect(c.report.unresolved).toBe(1)
  })
})

describe('completenessLine', () => {
  it('words the count, and says nothing about an empty day', () => {
    expect(completenessLine({ known: 3, total: 5 })).toBe('3 of 5 entries fully known')
    expect(completenessLine({ known: 1, total: 1 })).toBe('1 of 1 entry fully known')
    expect(completenessLine({ known: 0, total: 0 })).toBe('')
  })
})
