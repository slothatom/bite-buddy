import { describe, it, expect } from 'vitest'
import type { TdeeProfile } from '../types'
import { basalMetabolicRate, explainTdee, fromTdee, totalDailyEnergy } from './targets'

/**
 * The arithmetic behind a calorie target, checked against hand-worked figures.
 *
 * These are not snapshots of whatever the code happens to return: each one is
 * the published formula worked through with a calculator, so a change to the
 * constants fails here rather than quietly changing what somebody eats.
 */
const woman: TdeeProfile = {
  sex: 'female', age: 34, heightCm: 168, weightKg: 68, activity: 'light', goal: 'lose',
}

const man: TdeeProfile = {
  sex: 'male', age: 40, heightCm: 180, weightKg: 82, activity: 'moderate', goal: 'maintain',
}

describe('Mifflin-St Jeor', () => {
  it('matches the published formula for a woman', () => {
    // 10 x 68 + 6.25 x 168 - 5 x 34 - 161 = 680 + 1050 - 170 - 161 = 1399
    expect(basalMetabolicRate(woman)).toBe(1399)
  })

  it('matches the published formula for a man', () => {
    // 10 x 82 + 6.25 x 180 - 5 x 40 + 5 = 820 + 1125 - 200 + 5 = 1750
    expect(basalMetabolicRate(man)).toBe(1750)
  })

  it('says nothing at all when a figure is missing', () => {
    // A guess dressed as a calculation is worse than an empty box.
    expect(basalMetabolicRate({ ...woman, weightKg: undefined })).toBeUndefined()
    expect(fromTdee({ ...woman, age: undefined })).toBeUndefined()
  })
})

describe('the activity multipliers', () => {
  it('applies 1.375 for light activity', () => {
    expect(Math.round(totalDailyEnergy(woman) ?? 0)).toBe(Math.round(1399 * 1.375))
  })

  it('applies 1.55 for moderate', () => {
    expect(Math.round(totalDailyEnergy(man) ?? 0)).toBe(Math.round(1750 * 1.55))
  })
})

describe('turning that into a target', () => {
  it('takes 20% off to lose weight, and splits the rest by the stated rules', () => {
    const t = fromTdee(woman)
    // 1399 x 1.375 = 1923.6, less 20% = 1538.9
    expect(t?.calories).toBe(1539)
    // Protein 1.6 g per kg: 68 x 1.6 = 108.8
    expect(t?.protein).toBe(109)
    // Fat 30% of energy at 9 kcal a gram: 1538.9 x 0.3 / 9 = 51.3
    expect(t?.fat).toBe(51)
    // Carbohydrate takes the remainder at 4 kcal a gram.
    expect(t?.carbs).toBe(Math.round((1538.9 - 109 * 4 - 51 * 9) / 4))
    // Fibre at 14 g per 1000 kcal.
    expect(t?.fiber).toBe(22)
  })

  it('leaves a maintenance target alone', () => {
    expect(fromTdee(man)?.calories).toBe(Math.round(1750 * 1.55))
  })
})

describe('showing the working', () => {
  it('walks through every step with the numbers that were entered', () => {
    const steps = explainTdee(woman)
    expect(steps).toHaveLength(7)
    expect(steps[0].working).toContain('10 x 68 kg')
    expect(steps[0].result).toBe('1399 kcal')
    expect(steps[1].working).toContain('1.375')
    expect(steps[2].label).toContain('20%')
    expect(steps.at(-1)?.result).toBe('22 g')
  })

  it('has nothing to show until the figures are there', () => {
    expect(explainTdee({ ...woman, heightCm: undefined })).toEqual([])
  })
})
