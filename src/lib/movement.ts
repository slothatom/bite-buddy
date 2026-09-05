import type { Workout } from '../types'
import { workoutCalories, workoutMinutes } from './exercise'

/**
 * What a day's movement came to, for the screens about the day.
 *
 * The Movement screen has logged sessions and costed them for months, and no
 * other screen has ever mentioned them. You could cycle for an hour, log it,
 * open Home, and read a day that had never heard of it.
 *
 * What this deliberately does not do is change the target. The calorie figure
 * the app measures a day against comes from the dietician's own plans, and
 * those were written for two people who move: adding an exercise bonus on top
 * would be double counting the same hour, and the app would quietly hand back
 * four hundred calories nobody prescribed. So the burn is reported beside the
 * day rather than folded into it, and the line it is measured against stays
 * exactly where it was put.
 *
 * The number is an estimate and the screens say so. See lib/exercise.ts for
 * why the MET equation is worth reporting and not worth trusting to the
 * calorie.
 */

export interface DayMovement {
  /**
   * Kilocalories, where they can be worked out at all.
   *
   * Absent rather than zero when nobody has recorded a weight, because the MET
   * equation needs one and an unknown is not a nothing. A day with sessions in
   * it and no weight behind them still reports its minutes.
   */
  kcal?: number
  minutes: number
  sessions: number
  /**
   * Whether any part of the figure was estimated rather than given.
   *
   * A session logged as a lump with its own calorie count came off somebody's
   * watch. Everything else came off a table of averages.
   */
  estimated: boolean
}

export const NO_MOVEMENT: DayMovement = { minutes: 0, sessions: 0, estimated: false }

/** One day's sessions, summed. */
export function dayMovement(workouts: Workout[], date: string, weightKg?: number): DayMovement {
  const onTheDay = workouts.filter((w) => w.date === date)
  if (!onTheDay.length) return NO_MOVEMENT

  let kcal: number | undefined
  let estimated = false
  for (const workout of onTheDay) {
    const cost = workoutCalories(workout, weightKg)
    if (cost == null) continue
    kcal = (kcal ?? 0) + cost
    // Given only when the session was logged as a lump with a figure on it.
    if (!(workout.bulk && workout.bulk.calories != null)) estimated = true
  }

  return {
    kcal,
    minutes: onTheDay.reduce((n, w) => n + workoutMinutes(w), 0),
    sessions: onTheDay.length,
    estimated,
  }
}

/**
 * A run of days, for the week summaries.
 *
 * Returned per day rather than as a total, because a week that averages forty
 * minutes across seven days and a week with two long sessions in it are
 * different weeks, and a single number cannot tell them apart.
 */
export function movementAcross(
  workouts: Workout[], dates: string[], weightKg?: number,
): { date: string; movement: DayMovement }[] {
  return dates.map((date) => ({ date, movement: dayMovement(workouts, date, weightKg) }))
}

/**
 * How a day's movement reads in a sentence, or nothing when there was none.
 *
 * Minutes lead. They are what you actually did, they are recorded rather than
 * modelled, and they are the half of this that is true to the minute.
 */
export function movementLabel(m: DayMovement): string | null {
  if (!m.sessions) return null
  const time = `${m.minutes} min`
  if (m.kcal == null) return time
  return `${time} · about ${Math.round(m.kcal).toLocaleString()} kcal`
}
