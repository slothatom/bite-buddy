/**
 * Deciding what happens when both of you changed the same thing.
 *
 * Sync stores each store as one document, and the first version simply let the
 * later write win. That is fine for a store only one person touches and wrong
 * for the week, which is the whole point of sharing: you add Thursday's dinner,
 * Oli adds Friday's lunch, and whoever saves second erases the other's day.
 *
 * The week is now merged a day at a time. Two people working on different days
 * both keep their work, which is the common case and previously the broken one.
 * The same day changed on both sides still has to pick one, there is no way to
 * combine two different dinners, so it takes the one edited later and reports
 * that it happened, rather than losing it quietly.
 *
 * "Changed on both sides" needs a reference point. A day where only one side
 * moved is not a conflict, it is the other side being out of date, and calling
 * that a conflict would warn about every ordinary edit. So the caller passes
 * `since`, when the two copies last agreed, and a day counts as contested
 * only if both were edited after it.
 *
 * Everything else stays last-write-wins: they are lists you each append to
 * rarely, and inventing a merge for them would be complexity without a
 * corresponding bug.
 */
import type { DayPlan } from '../types'

export interface MergeResult<T> {
  merged: T
  /** Days that existed on both sides with different edits; the newer one won. */
  conflicts: string[]
}

/** The persisted shape of the meal plan store, as far as merging cares. */
interface PlanState {
  plan?: unknown
  [key: string]: unknown
}

function isDay(value: unknown): value is DayPlan {
  return typeof value === 'object' && value !== null && typeof (value as DayPlan).date === 'string'
}

function editedAt(day: DayPlan): number {
  // A day with no stamp predates per-day timestamps, so anything stamped beats
  // it. That is the right way round: an unstamped day is old by definition.
  return day.updatedAt ? Date.parse(day.updatedAt) : 0
}

/**
 * Merges the week day by day.
 *
 * `local` wins ties, because the person whose device this is has just been
 * looking at it, an edit that vanishes under your cursor is worse than one
 * that vanishes on the other side of the room.
 */
export function mergeMealPlan(
  local: PlanState,
  remote: PlanState,
  /** When the two copies last agreed. Without it, nothing is called a conflict. */
  since: number = Number.POSITIVE_INFINITY,
): MergeResult<PlanState> {
  const localDays = Array.isArray(local.plan) ? local.plan.filter(isDay) : []
  const remoteDays = Array.isArray(remote.plan) ? remote.plan.filter(isDay) : []

  if (!localDays.length) return { merged: remote, conflicts: [] }
  if (!remoteDays.length) return { merged: local, conflicts: [] }

  const byDate = new Map<string, DayPlan>()
  const conflicts: string[] = []

  for (const day of remoteDays) byDate.set(day.date, day)

  for (const mine of localDays) {
    const theirs = byDate.get(mine.date)
    if (!theirs) {
      byDate.set(mine.date, mine)
      continue
    }

    // Identical days are not a conflict, however the timestamps compare.
    const same = JSON.stringify(mine.meals) === JSON.stringify(theirs.meals)
    if (same) {
      byDate.set(mine.date, editedAt(mine) >= editedAt(theirs) ? mine : theirs)
      continue
    }

    if (editedAt(mine) >= editedAt(theirs)) byDate.set(mine.date, mine)

    // Only contested if both moved since the copies last agreed. One side
    // moving is just the other being out of date, the ordinary case, and
    // warning about it would make the warning meaningless.
    if (editedAt(mine) > since && editedAt(theirs) > since) conflicts.push(mine.date)
  }

  // The remote document carries the rest of the store's fields; the local one's
  // week replaces its week. Keeping remote as the base means a field added by
  // the other person's newer app is not dropped on the way through.
  const merged: PlanState = {
    ...remote,
    ...local,
    plan: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  }
  return { merged, conflicts }
}

/**
 * Merges one store's document.
 *
 * Only the meal plan has a real merge. Everything else takes the remote copy,
 * which is what it did before, the difference is that this is now a decision
 * with a name rather than the only behaviour available.
 */
export function mergeStore(
  key: string,
  local: unknown,
  remote: unknown,
  since?: number,
): MergeResult<unknown> {
  const bothObjects =
    typeof local === 'object' && local !== null && typeof remote === 'object' && remote !== null

  if (!bothObjects) return { merged: remote, conflicts: [] }
  if (key.includes('mealplan')) {
    return mergeMealPlan(local as PlanState, remote as PlanState, since)
  }
  return { merged: remote, conflicts: [] }
}
