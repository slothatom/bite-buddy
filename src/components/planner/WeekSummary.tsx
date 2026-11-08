import { CalendarDays } from 'lucide-react'
import type { Nutrients } from '../../types'

/**
 * The line under the planner: the average day across the days planned.
 *
 * Named after the window, not the view, so a day view still sums the week the
 * day sits in.
 */
export function WeekSummary({
  plannedDays, weekTotal, spanPhrase,
}: {
  plannedDays: number
  weekTotal: Nutrients
  spanPhrase: string
}) {
  return (
    <section className="card-soft p-4 flex items-center gap-3 text-sm text-ink-700">
      <CalendarDays size={18} className="text-ink-500 shrink-0" />
      {/* Nothing planned is not an average of nought. "A cosy 0 kcal a day
          on average, across 0 planned days" is the app describing an empty
          week as though it were a diet, and "cosy" was a verdict on food it
          cannot see in any case. */}
      <span>
        {plannedDays === 0 ? (
          <>Nothing planned {spanPhrase} yet.</>
        ) : (
          <>
            <strong className="font-mono">
              {Math.round(weekTotal.calories / plannedDays)}
            </strong>{' '}
            kcal a day on average, across {plannedDays} planned {plannedDays === 1 ? 'day' : 'days'}
            {' '}{spanPhrase}.
          </>
        )}
      </span>
    </section>
  )
}
