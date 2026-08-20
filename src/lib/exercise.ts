import type { ExerciseKind, Workout } from '../types'
import { EXERCISES } from '../data/exercises'

/**
 * What a session costs, and how to find the thing you did.
 *
 * The calorie figure is an estimate and should be read as one. It comes from
 * the MET equation, the same one behind every fitness app: energy per minute
 * is the activity's MET times 3.5 ml of oxygen per kg per minute, and a litre
 * of oxygen is about 5 kcal, which reduces to met x 3.5 x kg / 200 per minute.
 *
 * Two people of the same weight doing the same hour of the same thing can
 * differ by a third. It is useful for comparing your own weeks to each other,
 * and not for deciding you have earned a cake.
 */

export const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))

/** Kilocalories for one activity, by the MET equation. */
export function caloriesBurned(met: number, weightKg: number, minutes: number): number {
  if (!(met > 0) || !(weightKg > 0) || !(minutes > 0)) return 0
  return (met * 3.5 * weightKg / 200) * minutes
}

/**
 * What a whole session came to.
 *
 * A session logged as one lump uses the figure you gave it, if you gave one:
 * you were there and your watch was there, and neither this table nor this
 * formula knows better than either.
 */
export function workoutCalories(workout: Workout, weightKg?: number): number | undefined {
  if (workout.bulk) {
    if (workout.bulk.calories != null) return workout.bulk.calories
    if (!weightKg) return undefined
    // Nothing says what it was, so it is costed as moderate effort.
    return Math.round(caloriesBurned(5, weightKg, workout.bulk.minutes))
  }

  if (!weightKg) return undefined

  let total = 0
  for (const entry of workout.entries) {
    const kind = EXERCISE_BY_ID.get(entry.exerciseId)
    if (!kind) continue
    total += caloriesBurned(kind.met, weightKg, entry.minutes)
  }
  return Math.round(total)
}

export function workoutMinutes(workout: Workout): number {
  if (workout.bulk) return workout.bulk.minutes
  return workout.entries.reduce((n, e) => n + e.minutes, 0)
}

/** Finds an exercise by name, the way you would type it. */
export function searchExercises(query: string, limit = 30): ExerciseKind[] {
  const q = query.trim().toLowerCase()
  if (!q) return EXERCISES.slice(0, limit)

  const starts: ExerciseKind[] = []
  const contains: ExerciseKind[] = []
  for (const e of EXERCISES) {
    const name = e.name.toLowerCase()
    if (name.startsWith(q)) starts.push(e)
    else if (name.includes(q)) contains.push(e)
  }
  return [...starts, ...contains].slice(0, limit)
}
