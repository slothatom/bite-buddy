import { describe, expect, it } from 'vitest'
import { parseMfpCsv, quickAddLine } from './mfp'

describe('quickAddLine', () => {
  it('formats a line that can be pasted straight into a Quick Add', () => {
    expect(quickAddLine('Lunch', { calories: 612.4, protein: 41.2, carbs: 58.44, fat: 22 }))
      .toBe('Lunch — 612 kcal · 41.2g protein · 58.4g carbs · 22g fat')
  })
})

describe('parseMfpCsv', () => {
  it('locates columns by header name, not position', () => {
    // MyFitnessPal has changed its export column order between versions.
    const csv = [
      'Date,Meal,Calories,Fat (g),Carbohydrates (g),Protein (g),Fiber',
      '2026-08-01,Breakfast,412,14,52,18,7',
      '2026-08-01,Lunch,610,22,60,35,9',
    ].join('\n')

    const entries = parseMfpCsv(csv)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      date: '2026-08-01',
      meal: 'Breakfast',
      macros: { calories: 412, protein: 18, carbs: 52, fat: 14 },
      fiber: 7,
    })
  })

  it('handles quoted fields containing commas', () => {
    const csv = [
      'Date,Meal,Calories,Protein (g)',
      '"2026-08-02","Lunch, packed",500,30',
    ].join('\n')
    expect(parseMfpCsv(csv)[0].meal).toBe('Lunch, packed')
  })

  it('skips rows with an unreadable date instead of inventing one', () => {
    const csv = ['Date,Meal,Calories', 'not-a-date,Lunch,500', '2026-08-03,Dinner,600'].join('\n')
    const entries = parseMfpCsv(csv)
    expect(entries).toHaveLength(1)
    expect(entries[0].date).toBe('2026-08-03')
  })

  it('returns nothing for a file that is not a diary export', () => {
    expect(parseMfpCsv('Name,Address\nfoo,bar')).toEqual([])
    expect(parseMfpCsv('')).toEqual([])
  })

  it('tolerates missing macro columns rather than producing NaN', () => {
    const entries = parseMfpCsv('Date,Calories\n2026-08-04,500')
    expect(entries[0].macros).toEqual({ calories: 500, protein: 0, carbs: 0, fat: 0 })
  })
})
