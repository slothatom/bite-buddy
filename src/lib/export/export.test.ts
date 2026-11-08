import { describe, expect, it } from 'vitest'
import type { DayPlan, Food, Recipe, Targets, WeightEntry } from '../../types'
import { buildContext } from '../nutrition'
import { datesBetween, MOST_DAYS, spanDates, weeksOf } from './range'
import { buildSummary, summariseDay } from './summary'
import { escapeHtml, summaryBody, summaryDocument, summaryFilename } from './html'
import { ESTIMATES_NOTE } from '../estimates'

function food(id: string, category: Food['category'], per100g: Food['per100g']): Food {
  return {
    id, names: { en: id }, aliases: [], category, medTier: 'daily',
    state: 'as-sold', per100g, units: [], source: 'curated',
  }
}

const SPINACH = food('spinach', 'vegetables', { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2 })
const OATS = food('oats', 'grains', { calories: 380, protein: 13, carbs: 68, fat: 6.5, fiber: 10 })
const MILK = food('milk', 'dairy', { calories: 50, protein: 3.4, carbs: 4.8, fat: 1.5 })

const PORRIDGE: Recipe = {
  id: 'porridge', name: { en: 'Porridge' }, emoji: '🥣', servings: 1,
  components: [
    { kind: 'food', foodId: 'oats', grams: 50 },
    { kind: 'food', foodId: 'milk', grams: 200 },
  ],
  steps: [], tags: [], prepMinutes: 0, cookMinutes: 0, createdAt: '2022-01-01T00:00:00.000Z',
}

const ctx = buildContext([SPINACH, OATS, MILK], [PORRIDGE])
const targets: Targets = { calories: 400, protein: 30, carbs: 50, fat: 15, fiber: 25, source: 'tdee' }

const PLAN: DayPlan[] = [
  {
    date: '2026-08-31',
    meals: [
      { id: 'b', slot: 'breakfast', entries: [{ kind: 'recipe', recipeId: 'porridge', servings: 1 }], outcome: 'eaten' },
      { id: 'l', slot: 'lunch', entries: [{ kind: 'food', foodId: 'spinach', grams: 200 }], outcome: 'skipped' },
    ],
  },
  {
    date: '2026-09-01',
    meals: [{ id: 'd', slot: 'dinner', entries: [{ kind: 'food', foodId: 'spinach', grams: 300 }] }],
  },
]

const WEIGHTS: WeightEntry[] = [
  { id: 'w1', date: '2026-08-30', weight: 70, unit: 'kg', memberId: 'oli' },
  { id: 'w2', date: '2026-09-02', weight: 69.5, unit: 'kg', memberId: 'oli', notes: 'after <run>' },
  { id: 'w3', date: '2026-09-02', weight: 80, unit: 'kg', memberId: 'arany' },
  { id: 'w4', date: '2026-09-03', weight: 154, unit: 'lbs', memberId: 'oli' },
]

const dates = datesBetween('2026-08-31', '2026-09-06')
const summary = buildSummary({
  dates, plan: PLAN, ctx, targets, person: { id: 'oli', name: 'Oli' },
  weights: WEIGHTS, weightUnit: 'kg', generatedOn: '2026-09-07',
})

describe('ranges', () => {
  it('lists every date between two, either way round', () => {
    expect(datesBetween('2026-08-30', '2026-09-02'))
      .toEqual(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02'])
    expect(datesBetween('2026-09-02', '2026-08-30')[0]).toBe('2026-08-30')
  })

  it('caps a custom range rather than building a year', () => {
    expect(datesBetween('2026-01-01', '2026-12-31')).toHaveLength(MOST_DAYS)
  })

  it('reads this week and the last four whole weeks from the week start', () => {
    // 2026-09-03 is a Thursday; weeks start on Monday.
    const week = spanDates('this-week', { today: '2026-09-03', weekStartsOn: 1 })
    expect(week[0]).toBe('2026-08-31')
    expect(week).toHaveLength(7)
    const month = spanDates('last-4-weeks', { today: '2026-09-03', weekStartsOn: 1 })
    expect(month).toHaveLength(28)
    expect(month[0]).toBe('2026-08-10')
    expect(month[27]).toBe('2026-09-06')
  })

  it('takes a custom range as given', () => {
    expect(spanDates('custom', { today: '2026-09-03', weekStartsOn: 1, from: '2026-09-01', to: '2026-09-02' }))
      .toEqual(['2026-09-01', '2026-09-02'])
  })

  it('cuts a range into weeks from its first day', () => {
    expect(weeksOf(datesBetween('2026-08-01', '2026-08-10')).map((w) => w.length)).toEqual([7, 3])
  })
})

describe('summariseDay', () => {
  it('names what was eaten, skipped and not ticked, in slot order', () => {
    const [mon, tue] = summary.days
    expect(mon.items).toEqual([
      { slot: 'breakfast', name: 'Porridge', outcome: 'eaten' },
      { slot: 'lunch', name: 'spinach', outcome: 'skipped' },
    ])
    expect(tue.items).toEqual([{ slot: 'dinner', name: 'spinach', outcome: 'not-ticked' }])
    expect(mon.recorded).toBe(true)
    expect(tue.recorded).toBe(false)
  })

  it('counts what was eaten and leaves the skipped lunch out', () => {
    // 50 g oats (190 kcal) + 200 g milk (100 kcal); the spinach was skipped.
    expect(Math.round(summary.days[0].nutrients.calories)).toBe(290)
  })

  it('marks fibre as a floor where an ingredient did not say, and counts entries known', () => {
    const mon = summary.days[0]
    expect(mon.floors).toEqual({ all: false, fiber: true })
    expect(mon).toMatchObject({ known: 0, total: 1 })
    const tue = summary.days[1]
    expect(tue.floors).toEqual({ all: false, fiber: false })
    expect(tue).toMatchObject({ known: 1, total: 1 })
  })

  it('treats a day with nothing on it as a gap, not a zero', () => {
    const empty = summariseDay('2026-09-05', undefined, ctx, targets)
    expect(empty).toMatchObject({ any: false, items: [], known: 0, total: 0 })
  })

  it('makes every figure a floor when something no longer resolves', () => {
    const day: DayPlan = { date: '2026-09-04', meals: [{ id: 'x', slot: 'lunch', entries: [
      { kind: 'recipe', recipeId: 'gone', servings: 1 },
    ] }] }
    expect(summariseDay(day.date, day, ctx, targets).floors).toEqual({ all: true, fiber: true })
  })
})

describe('buildSummary', () => {
  it('averages over the days with food, not over the gaps', () => {
    expect(summary.average?.days).toBe(2)
    expect(summary.average?.recorded).toBe(1)
    expect(Math.round(summary.average!.nutrients.calories)).toBe(Math.round((290 + 69) / 2))
  })

  it('scores the Mediterranean goals with the Progress scoring, a week at a time', () => {
    expect(summary.weeks).toHaveLength(1)
    const veg = summary.weeks[0].goals.find((g) => g.category === 'vegetables')!
    expect(veg.servings).toBeGreaterThan(0)
    expect(summary.weeks[0].plannedDays).toBe(2)
  })

  it('keeps only this person\'s weights in range, in the chosen unit', () => {
    expect(summary.weights).toEqual([
      { date: '2026-09-02', value: 69.5, unit: 'kg', notes: 'after <run>' },
      { date: '2026-09-03', value: 69.9, unit: 'kg' },
    ])
  })
})

describe('the page', () => {
  const body = summaryBody(summary)

  it('says the figures are estimates and what + means', () => {
    expect(body).toContain(escapeHtml(ESTIMATES_NOTE))
    expect(body).toContain('a floor, not a total')
  })

  it('escapes whatever was typed', () => {
    expect(body).toContain('after &lt;run&gt;')
    expect(body).not.toContain('<run>')
  })

  it('carries the floor marker and the known count on an incomplete day', () => {
    expect(body).toMatch(/Fibre <strong class="bbs-num">\d+\u2009\+<\/strong>/)
    expect(body).toContain('0 of 1 entry fully known')
  })

  it('is a whole document with nothing to fetch', () => {
    const doc = summaryDocument(summary)
    expect(doc.startsWith('<!doctype html>')).toBe(true)
    expect(doc).toContain('<style>')
    expect(doc).not.toMatch(/<script|<link|src="http/)
  })

  it('names the file after the person and the range', () => {
    expect(summaryFilename(summary)).toBe('bite-buddy-summary-oli-2026-08-31-to-2026-09-06.html')
  })

  it('never writes an em dash', () => {
    expect(summaryDocument(summary)).not.toContain(String.fromCharCode(0x2014))
  })
})
