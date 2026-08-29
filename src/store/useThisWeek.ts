import { useMemo } from 'react'
import { getWeekDates, today } from './useMealPlanStore'
import { useUserStore } from './useUserStore'

/**
 * The week you are actually in, whatever the planner is showing.
 *
 * These are two different questions and they had one answer. `weekDates` is the
 * planner's viewport: `goToWeek` writes it, and the arrows either side of the
 * date range call `goToWeek`. Every other screen read the same field, so
 * stepping back one week to check what you ate last Tuesday quietly moved
 * Home's "days planned", Progress, the guide scoring and the shopping list's
 * day picker to last week too, and left them there for the rest of the session.
 *
 * That is the original stale-week defect wearing a different coat. The fix that
 * shipped for it, `ensureCurrentWeek`, only runs on start and on returning to
 * the foreground, so it cannot see a window the user moved by hand.
 *
 * So the planner keeps its viewport and everybody else asks the clock. Derived
 * rather than stored, which also means it cannot go stale, cannot be persisted
 * into a backup, and cannot arrive from the other phone.
 */
export function useThisWeek(): string[] {
  const weekStartsOn = useUserStore((s) => s.profile.weekStartsOn)
  const date = today()

  return useMemo(() => getWeekDates(new Date(date + 'T12:00:00'), weekStartsOn), [date, weekStartsOn])
}
