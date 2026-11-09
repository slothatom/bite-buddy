import type { DayPlan } from '../../types'
import { MEAL_SLOTS } from '../../types'
import { today } from '../../store/useMealPlanStore'
import { useNutritionContext } from '../../store/useNutrition'
import { entriesName } from '../../lib/entryLabel'
import { formatDate, shortName } from '../../lib/planner/format'
import { CHIP_TONE, dayChip, slotsPlanned } from '../../lib/planner/dayChip'

/**
 * The week on a phone: one row a day, opened by tapping it.
 *
 * A row is the day's shape rather than its detail: a pill a slot, filled when
 * something is planned in it, the names of what is planned on one line, the
 * total, and a word on how the day stands. The detail is the day view, one
 * tap away, which is where anything gets changed.
 */
export function WeekList({ dates, byDate, kcalByDate, target, onOpenDay }: {
  dates: string[]
  byDate: Map<string, DayPlan>
  kcalByDate: Map<string, number>
  target: number
  onOpenDay: (date: string) => void
}) {
  const ctx = useNutritionContext()
  const now = today()

  return (
    <ul aria-label="Days" className="mx-4 bg-paper border border-border-200 rounded-3xl overflow-hidden">
      {dates.map((date, i) => {
        const day = byDate.get(date)
        const planned = slotsPlanned(day)
        const kcal = Math.round(kcalByDate.get(date) ?? 0)
        const chip = dayChip(day, kcal, target)
        const isToday = date === now
        const past = date < now
        const d = new Date(date + 'T12:00:00')
        const names = MEAL_SLOTS.flatMap((slot) => (day?.meals ?? [])
          .filter((m) => m.slot === slot)
          .map((m) => shortName(entriesName(m.entries, ctx))))
          .filter(Boolean)
        const summary = names.length
          ? names.join(', ')
          : past ? 'Nothing was planned' : 'Nothing planned yet'

        return (
          <li
            key={date}
            data-day-row={date}
            data-has-food={planned ? '' : undefined}
            className={`${i ? 'border-t border-border-100' : ''} ${isToday ? 'bg-bite-50' : ''}`}
          >
            <button
              type="button"
              onClick={() => onOpenDay(date)}
              aria-label={`Open ${formatDate(date)}${isToday ? ', today' : past ? ', past' : ''}${
                kcal ? `, ${kcal} kcal` : ''}${chip ? `, ${chip.label}` : ''}`}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[60px] text-left hover:bg-bite-50"
            >
              <span className={`w-10 shrink-0 flex flex-col items-center ${isToday ? 'text-bite-700' : 'text-ink-900'}`}>
                <span className="text-xs font-bold">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                <span className="text-lg leading-[22px] font-extrabold">{d.getDate()}</span>
              </span>
              <span className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="flex gap-1" aria-hidden="true">
                  {MEAL_SLOTS.map((slot) => {
                    const on = day?.meals.some((m) => m.slot === slot)
                    return (
                      <span
                        key={slot}
                        data-planned={on ? '' : undefined}
                        className={`w-7 h-2 rounded-full ${on
                          ? 'bg-leaf-500'
                          : 'bg-paper ring-[1.5px] ring-inset ring-ink-300'}`}
                      />
                    )
                  })}
                </span>
                <span className="text-[13px] leading-[18px] text-ink-700 line-clamp-2">{summary}</span>
              </span>
              <span className="shrink-0 flex flex-col items-end gap-1">
                {kcal > 0 && (
                  <span className="text-[15px] font-extrabold text-ink-900 tabular-nums">
                    {kcal.toLocaleString('en-GB')}
                  </span>
                )}
                {chip && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${CHIP_TONE[chip.tone]}`}>
                    {chip.label}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
