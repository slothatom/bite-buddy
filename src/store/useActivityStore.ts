import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import type { SleepEntry, StepEntry, Workout } from '../types'
import { dayMovement, movementAcross, type DayMovement } from '../lib/movement'
import { latestKg } from '../lib/weight'
import { useWeightFor } from './useBodyStore'

/**
 * Training and sleep, per person.
 *
 * Same shape as the body store and for the same reason: two people's sessions
 * added together is a graph of a household, which nobody trains for. Every row
 * carries whose it is, and the ids are the fixed ones in lib/people.ts rather
 * than an account id, so both people are there whether or not either has
 * signed in.
 *
 * Steps and sleep can arrive from a watch export as well as by hand, so each
 * row remembers where it came from. Re-importing the same export replaces what
 * it brought before rather than doubling it, which is what makes it safe to
 * drop the same file in twice.
 */
interface ActivityStore {
  workouts: Workout[]
  steps: StepEntry[]
  sleep: SleepEntry[]

  addWorkout: (w: Workout) => void
  updateWorkout: (id: string, updates: Partial<Workout>) => void
  removeWorkout: (id: string) => void

  addSleep: (s: SleepEntry) => void
  removeSleep: (id: string) => void

  addSteps: (s: StepEntry) => void
  removeSteps: (id: string) => void

  /**
   * Takes in a watch export. One row per person per day wins, so importing the
   * same month twice leaves you with a month rather than two.
   */
  importActivity: (rows: { steps: StepEntry[]; sleep: SleepEntry[] }) => void
}

const byDate = <T extends { date: string }>(a: T, b: T) => a.date.localeCompare(b.date)

/** Keeps one row per person per day, with the newcomer winning. */
function mergeDaily<T extends { personId: string; date: string }>(existing: T[], incoming: T[]): T[] {
  const key = (r: T) => `${r.personId}:${r.date}`
  const map = new Map(existing.map((r) => [key(r), r]))
  for (const row of incoming) map.set(key(row), row)
  return [...map.values()].sort(byDate)
}

export const useActivityStore = create<ActivityStore>()(
  persist(
    (set) => ({
      workouts: [],
      steps: [],
      sleep: [],

      addWorkout: (w) => set((s) => ({ workouts: [...s.workouts, w].sort(byDate) })),

      updateWorkout: (id, updates) =>
        set((s) => ({ workouts: s.workouts.map((w) => (w.id === id ? { ...w, ...updates } : w)) })),

      removeWorkout: (id) => set((s) => ({ workouts: s.workouts.filter((w) => w.id !== id) })),

      addSleep: (entry) => set((s) => ({ sleep: mergeDaily(s.sleep, [entry]) })),
      removeSleep: (id) => set((s) => ({ sleep: s.sleep.filter((e) => e.id !== id) })),

      addSteps: (entry) => set((s) => ({ steps: mergeDaily(s.steps, [entry]) })),
      removeSteps: (id) => set((s) => ({ steps: s.steps.filter((e) => e.id !== id) })),

      importActivity: (rows) =>
        set((s) => ({
          steps: mergeDaily(s.steps, rows.steps),
          sleep: mergeDaily(s.sleep, rows.sleep),
        })),
    }),
    {
      name: 'bite-buddy-activity',
      version: SCHEMA_VERSION,
      storage: safeStorage<ActivityStore>(),
      migrate: upgradeThrough<ActivityStore>(SCHEMA_VERSION, {
        // This store arrived after v3, so there is nothing older to bring
        // forward. The entries exist because the shared upgrade helper walks
        // every version in turn.
        1: (state) => state,
        2: (state) => state,
        // v3 → v4: the two numbered snack slots became one. Nothing in this
        // store holds a slot, so there is nothing to bring forward.
        3: (state) => state,
      }),
    },
  ),
)

export function useWorkoutsFor(personId: string): Workout[] {
  const workouts = useActivityStore((s) => s.workouts)
  return useMemo(
    () => workouts.filter((w) => w.personId === personId).sort(byDate),
    [workouts, personId],
  )
}

/**
 * What one person's movement came to on one day.
 *
 * Here rather than in each screen, because Home, the planner and Progress were
 * about to ask the same question three ways, and the weight it is costed at
 * has to be that person's own: a household where one of you has never stepped
 * on the scales must not cost the other's hour of cycling at their partner's
 * weight.
 */
export function useDayMovement(personId: string, date: string): DayMovement {
  const workouts = useWorkoutsFor(personId)
  const weights = useWeightFor(personId)
  const kg = useMemo(() => latestKg(weights), [weights])
  return useMemo(() => dayMovement(workouts, date, kg), [workouts, date, kg])
}

/** The same across a run of days, for the week summaries. */
export function useMovementAcross(
  personId: string, dates: string[],
): { date: string; movement: DayMovement }[] {
  const workouts = useWorkoutsFor(personId)
  const weights = useWeightFor(personId)
  const kg = useMemo(() => latestKg(weights), [weights])
  // Joined rather than passed as an array: a fresh array every render would
  // rebuild this on every keystroke anywhere on the screen.
  const key = dates.join()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => movementAcross(workouts, dates, kg), [workouts, key, kg])
}

export function useSleepFor(personId: string): SleepEntry[] {
  const sleep = useActivityStore((s) => s.sleep)
  return useMemo(
    () => sleep.filter((e) => e.personId === personId).sort(byDate),
    [sleep, personId],
  )
}

export function useStepsFor(personId: string): StepEntry[] {
  const steps = useActivityStore((s) => s.steps)
  return useMemo(
    () => steps.filter((e) => e.personId === personId).sort(byDate),
    [steps, personId],
  )
}
