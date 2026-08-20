import { describe, it, expect } from 'vitest'
import type { Food } from '../types'
import { atwaterCalories, auditFood, auditFoods } from './foodAudit'

const food = (over: Partial<Food> = {}): Food => ({
  id: 'test-1',
  names: { en: 'Test food' },
  aliases: [],
  category: 'pantry',
  medTier: 'moderate',
  state: 'as-sold',
  per100g: { calories: 100, protein: 5, carbs: 15, fat: 2 },
  units: [],
  source: 'custom',
  ...over,
})

const kinds = (f: Food, now?: number) => auditFood(f, { now }).map((x) => x.kind)

describe('checking a food against itself', () => {
  it('passes a food whose calories match its macros', () => {
    // 5 x 4 + 15 x 4 + 2 x 9 = 98, near enough to 100.
    expect(atwaterCalories(5, 15, 2)).toBe(98)
    expect(kinds(food())).toEqual([])
  })

  it('counts fibre at what it is worth, not as carbohydrate', () => {
    // Ground cinnamon: 247 kcal on the jar, 81 g of carbohydrate of which 53 g
    // is fibre. Treating fibre as ordinary carbohydrate puts it 100 kcal out
    // and reports the jar as wrong.
    expect(Math.round(atwaterCalories(4, 81, 1.2, 53))).toBe(245)
    expect(kinds(food({ per100g: { calories: 247, protein: 4, carbs: 81, fat: 1.2, fiber: 53 } })))
      .toEqual([])
  })

  it('asks rather than accuses when energy is unaccounted for', () => {
    // Vanilla extract is 288 kcal and almost no macros, because a third of it
    // is alcohol, which nothing here records. A weekly check that called this
    // an error would be wrong every week.
    const found = auditFood(food({ per100g: { calories: 288, protein: 0.1, carbs: 12.7, fat: 0.1 } }))
    expect(found.map((f) => f.kind)).toContain('mismatch')
    expect(found.every((f) => f.severity === 'check')).toBe(true)
    expect(found[0].suggestion).toContain('alcohol')
  })

  it('catches calories that disagree with the macros', () => {
    // A crowd-entered decimal point: 620 kcal against macros worth 98.
    expect(kinds(food({ per100g: { calories: 620, protein: 5, carbs: 15, fat: 2 } })))
      .toContain('mismatch')
  })

  it('allows the slack that fibre and label rounding need', () => {
    // Rolled oats: 379 kcal stated, macros come to 400, and the difference is
    // mostly fibre yielding about 2 kcal a gram rather than 4.
    expect(kinds(food({ per100g: { calories: 379, protein: 13, carbs: 68, fat: 7 } })))
      .not.toContain('mismatch')
  })

  it('catches more than 100 g of macros in 100 g of food', () => {
    expect(kinds(food({ per100g: { calories: 700, protein: 40, carbs: 40, fat: 40 } })))
      .toContain('impossible')
  })

  it('catches calories denser than pure fat', () => {
    expect(kinds(food({ per100g: { calories: 1200, protein: 0, carbs: 0, fat: 130 } })))
      .toContain('impossible')
  })

  it('notices when the group and the frequency disagree', () => {
    // Red meat is on the guide's "rarely" list, so daily is a contradiction.
    expect(kinds(food({ category: 'red-meat', medTier: 'daily' }))).toContain('tier')
  })

  it('notices a name that does not look like its group', () => {
    expect(kinds(food({ names: { en: 'Greek yogurt' }, category: 'grains' })))
      .toContain('category')
  })

  it('says nothing about a group it cannot guess', () => {
    expect(kinds(food({ names: { en: 'Leustean' }, category: 'vegetables' })))
      .not.toContain('category')
  })

  it('flags figures a year old, and leaves fresh ones alone', () => {
    const now = Date.parse('2026-08-20T00:00:00Z')
    const provenance = {
      source: 'off' as const,
      basePortion: { amount: 100, unit: 'g' as const },
    }
    expect(kinds(food({ provenance: { ...provenance, retrievedAt: '2024-01-01' } }), now))
      .toContain('stale')
    expect(kinds(food({ provenance: { ...provenance, retrievedAt: '2026-06-01' } }), now))
      .not.toContain('stale')
  })

  it('only asks about missing figures for foods the plans use', () => {
    const bare = food({ per100g: { calories: 100, protein: 5, carbs: 15, fat: 2 } })
    expect(auditFood(bare, {}).map((f) => f.kind)).not.toContain('gap')
    expect(auditFood(bare, { inUse: new Set(['test-1']) }).map((f) => f.kind)).toContain('gap')
  })

  it('does not report that beef has no fibre', () => {
    // It has none. A weekly list of foods that correctly contain no fibre is
    // a weekly list nobody reads.
    const beef = food({
      category: 'red-meat', medTier: 'rare', names: { en: 'Beef' },
      per100g: { calories: 250, protein: 26, carbs: 0, fat: 15, sodium: 60 },
    })
    expect(auditFood(beef, { inUse: new Set(['test-1']) })).toEqual([])
  })
})

describe('the report', () => {
  it('puts what is wrong ahead of what is worth a look', () => {
    const report = auditFoods([
      food({ id: 'a', names: { en: 'Beef mince' }, category: 'red-meat', medTier: 'daily' }),
      food({ id: 'b', per100g: { calories: 400, protein: 60, carbs: 60, fat: 60 } }),
    ])
    expect(report.checked).toBe(2)
    expect(report.findings[0].severity).toBe('wrong')
    expect(report.findings[0].kind).toBe('impossible')
    expect(report.byKind.tier).toBe(1)
  })
})
