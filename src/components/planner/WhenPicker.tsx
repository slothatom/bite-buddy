import { useMemo } from 'react'
import type { MealSlot } from '../../types'
import { MEAL_SLOTS, SLOT_LABELS } from '../../types'
import { today as todayDate } from '../../store/useMealPlanStore'
import { whenDates } from '../../lib/whenDates'
import { useUserStore } from '../../store/useUserStore'

/**
 * Which day, and which meal. One picker, used everywhere the question is asked.
 *
 * There were four of these and they disagreed about everything. Moving a meal
 * offered all 42 days of the month including ones long gone; "Copy day to"
 * offered the current week and, in the week it was tested, only days *before*
 * today; "Put it in a day" offered the current week; the shopping list offered
 * the next eight days. Same question, four incompatible answers, and none of
 * them let you say which meal except the one that always said Breakfast.
 *
 * The window is the same wherever it is asked: the week before last week's
 * start, five weeks in all, so there is room to correct something you forgot
 * to log on Tuesday and room to plan a fortnight out. Days that have gone are
 * dimmed rather than removed, because "I ate that yesterday" is a real thing
 * to want to say, and hiding the day makes it impossible rather than
 * deliberate.
 */

export default function WhenPicker({
  date, onDate, slot, onSlot, busy, disabled,
}: {
  date: string
  onDate: (date: string) => void
  /** Omit to ask only for a day, as copying a whole day does. */
  slot?: MealSlot
  onSlot?: (slot: MealSlot) => void
  /** Days that already carry something, marked with a dot. */
  busy?: Set<string>
  /** Days that cannot be chosen here, whatever the reason. */
  disabled?: (date: string) => boolean
}) {
  const weekStartsOn = useUserStore((s) => s.profile.weekStartsOn)
  const now = todayDate()
  const dates = useMemo(() => whenDates(now, weekStartsOn), [now, weekStartsOn])

  const weekdays = dates.slice(0, 7).map((d) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'narrow' }))

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-1.5">Which day</p>

        {/* The weekday letters once, above the grid, rather than on every
            cell: five rows of them is a wall of text around the numbers. */}
        <div className="grid grid-cols-7 gap-1 mb-1" aria-hidden="true">
          {weekdays.map((letter, i) => (
            <span key={i} className="text-center text-[10px] font-bold uppercase text-ink-500">
              {letter}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dates.map((d) => {
            const on = d === date
            const past = d < now
            const isToday = d === now
            const off = disabled?.(d) ?? false
            const when = new Date(d + 'T12:00:00')

            return (
              <button
                key={d}
                type="button"
                disabled={off}
                data-when-day
                onClick={() => onDate(d)}
                aria-pressed={on}
                aria-label={`${when.toLocaleDateString('en-GB', {
                  weekday: 'long', day: 'numeric', month: 'long',
                })}${isToday ? ', today' : past ? ', already gone' : ''}`}
                className={`relative rounded-lg py-2 min-h-11 text-center text-sm font-semibold border transition-colors ${
                  on ? 'bg-bite-500 border-bite-500 text-white'
                    : off ? 'bg-cream-50 border-transparent text-ink-300'
                      : past ? 'bg-cream-50 border-transparent text-ink-500'
                        : 'bg-paper border-border-200 text-ink-900 hover:border-bite-300'
                } ${isToday && !on ? 'ring-2 ring-bite-300' : ''}`}
              >
                {when.getDate()}
                {/* A day that already has food in it. Said with a dot rather
                    than a colour, which is carrying enough already. */}
                {busy?.has(d) && (
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                      on ? 'bg-white' : 'bg-bite-500'}`}
                  />
                )}
              </button>
            )
          })}
        </div>

        <p className="text-xs text-ink-500 mt-1.5">
          {date === now ? 'Today.' : new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          }) + (date < now ? ', which has already gone.' : '.')}
        </p>
      </div>

      {slot && onSlot && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-1.5">Which meal</p>
          <div className="flex flex-wrap gap-1.5">
            {MEAL_SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSlot(s)}
                aria-pressed={s === slot}
                className={`text-xs px-2.5 py-2 rounded-lg border transition-colors ${
                  s === slot
                    ? 'bg-bite-500 border-bite-500 text-white font-semibold'
                    : 'bg-paper border-border-200 text-ink-700 hover:border-bite-300'
                }`}
              >
                {SLOT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
