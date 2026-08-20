import { describe, it, expect } from 'vitest'
import type { Workout } from '../types'
import { caloriesBurned, searchExercises, workoutCalories, workoutMinutes } from './exercise'

describe('what an hour costs', () => {
  it('follows the MET equation', () => {
    // 8 METs, 70 kg, 60 minutes: 8 x 3.5 x 70 / 200 = 9.8 kcal a minute.
    expect(Math.round(caloriesBurned(8, 70, 60))).toBe(588)
  })

  it('returns nothing rather than a zero-shaped guess', () => {
    expect(caloriesBurned(8, 0, 60)).toBe(0)
    expect(caloriesBurned(0, 70, 60)).toBe(0)
  })
})

const workout = (over: Partial<Workout> = {}): Workout => ({
  id: 'w1', personId: 'arany', date: '2026-08-20',
  entries: [
    { id: 'e1', exerciseId: 'ex-run', minutes: 30 },
    { id: 'e2', exerciseId: 'ex-weights', minutes: 20 },
  ],
  ...over,
})

describe('a session', () => {
  it('adds up its exercises', () => {
    // Running at 10 METs for 30 min plus weights at 5 for 20, at 70 kg.
    const expected = Math.round((10 * 3.5 * 70 / 200) * 30 + (5 * 3.5 * 70 / 200) * 20)
    expect(workoutCalories(workout(), 70)).toBe(expected)
    expect(workoutMinutes(workout())).toBe(50)
  })

  it('says nothing about calories when it does not know what you weigh', () => {
    // A calorie figure that quietly assumes a body weight is a made-up number.
    expect(workoutCalories(workout(), undefined)).toBeUndefined()
  })

  it('takes your own figure for a session logged in one lump', () => {
    const lump = workout({ entries: [], bulk: { label: 'Gym', minutes: 60, calories: 420 } })
    expect(workoutCalories(lump, 70)).toBe(420)
    expect(workoutMinutes(lump)).toBe(60)
  })

  it('costs a lump with no figure as moderate effort', () => {
    const lump = workout({ entries: [], bulk: { label: 'Gym', minutes: 60 } })
    expect(workoutCalories(lump, 70)).toBe(Math.round((5 * 3.5 * 70 / 200) * 60))
  })

  it('ignores an exercise it has never heard of rather than counting it as zero effort', () => {
    const odd = workout({ entries: [{ id: 'e1', exerciseId: 'ex-nonsense', minutes: 30 }] })
    expect(workoutCalories(odd, 70)).toBe(0)
  })
})

describe('finding an exercise', () => {
  it('puts what you typed at the front', () => {
    expect(searchExercises('run')[0].name).toMatch(/^Running/)
  })

  it('still finds it mid-word', () => {
    expect(searchExercises('press').map((e) => e.id)).toContain('ex-bench')
  })
})
