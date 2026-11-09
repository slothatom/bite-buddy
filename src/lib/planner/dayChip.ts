import type { DayPlan } from '../../types'
import { MEAL_SLOTS } from '../../types'

/**
 * How a day of the plan stands, in the two or three words a week can hold.
 *
 * Gaps first: a day with an empty slot is not finished, and comparing its
 * total to a target would only say it is short, which it is by construction.
 * A full day is then read against the target, with a little slack either way,
 * because a plan within a hundred calories of a line is on it. Over says by
 * how much, plainly; nothing here is a verdict.
 */
export type DayChipTone = 'ok' | 'over' | 'gap'

export interface DayChip {
  label: string
  tone: DayChipTone
}

/** How far from the target still counts as on track, in kcal. */
export const ON_TRACK_SLACK = 100

export function slotsPlanned(day: DayPlan | undefined): number {
  if (!day) return 0
  return MEAL_SLOTS.filter((slot) => day.meals.some((m) => m.slot === slot)).length
}

export function dayChip(day: DayPlan | undefined, kcal: number, target: number): DayChip | null {
  const planned = slotsPlanned(day)
  if (!planned) return null
  const gaps = MEAL_SLOTS.length - planned
  if (gaps) return { label: gaps === 1 ? '1 gap' : `${gaps} gaps`, tone: 'gap' }
  const over = Math.round(kcal - target)
  if (target > 0 && over > ON_TRACK_SLACK) {
    return { label: `+ ${over.toLocaleString('en-GB')} kcal`, tone: 'over' }
  }
  // Short of the line by more than a snack is worth saying too, quietly.
  if (target > 0 && -over > 2 * ON_TRACK_SLACK) {
    return { label: `${(-over).toLocaleString('en-GB')} kcal under`, tone: 'gap' }
  }
  return { label: 'On track', tone: 'ok' }
}

/** The chip's colours, as token classes that hold in both themes. */
export const CHIP_TONE: Record<DayChipTone, string> = {
  ok: 'bg-leaf-50 text-leaf-700',
  over: 'bg-mustard-100 text-mustard-800',
  gap: 'bg-border-100 text-ink-700',
}
