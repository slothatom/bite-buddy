import { describe, it, expect } from 'vitest'
import type { Food } from '../types'
import { duplicateFoods, foodSignature, normalisedName } from './mergeFoods'

const food = (id: string, name: string, extra: Partial<Food> = {}): Food => ({
  id,
  names: { en: name },
  aliases: [],
  category: 'dairy',
  medTier: 'moderate',
  state: 'as-sold',
  per100g: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  units: [],
  source: 'custom',
  ...extra,
})

const curated = (id: string) => id.startsWith('food-')

describe('spotting the same ingredient twice', () => {
  it('matches names that differ only in case and punctuation', () => {
    expect(normalisedName('Greek Yogurt, 2%')).toBe(normalisedName('greek yogurt 2'))
  })

  it('groups two entries for the same food and keeps the curated one', () => {
    const groups = duplicateFoods(
      [food('food-yogurt', 'Greek yogurt'), food('custom-1', 'greek yogurt')],
      curated,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].keep.id).toBe('food-yogurt')
    expect(groups[0].fold.map((f) => f.id)).toEqual(['custom-1'])
  })

  it('leaves alone two foods of the same name with different numbers', () => {
    // 59 kcal against 97 is a real choice about which yogurt you actually buy,
    // not a duplicate to tidy away.
    const groups = duplicateFoods(
      [
        food('a', 'Greek yogurt'),
        food('b', 'Greek yogurt', { per100g: { calories: 97, protein: 9, carbs: 4, fat: 5 } }),
      ],
      curated,
    )
    expect(groups).toEqual([])
  })

  it('never merges dry into cooked', () => {
    // 100 g of dry bulgur is roughly three times the food that 100 g of cooked
    // bulgur is. Same name, same numbers per 100 g would still be two foods.
    const a = food('a', 'Bulgur', { state: 'dry' })
    const b = food('b', 'Bulgur', { state: 'cooked' })
    expect(foodSignature(a)).not.toBe(foodSignature(b))
    expect(duplicateFoods([a, b], curated)).toEqual([])
  })

  it('matches on the source id even when the names read differently', () => {
    const provenance = {
      source: 'off' as const,
      externalId: '5900512300207',
      basePortion: { amount: 100, unit: 'g' as const },
      retrievedAt: '2026-01-01',
    }
    const groups = duplicateFoods(
      [
        food('a', 'Skyr natural', { provenance }),
        food('b', 'Skyr, plain, 0% fat', { provenance }),
      ],
      curated,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].fold).toHaveLength(1)
  })

  it('says nothing about a library with no repeats', () => {
    expect(duplicateFoods([food('a', 'Apple'), food('b', 'Cashews')], curated)).toEqual([])
  })
})
