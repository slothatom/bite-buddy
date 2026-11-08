import { ChevronLeft, ChevronRight, Sparkles, Bookmark } from 'lucide-react'
import { RANGE_LABELS, type PlanRange } from '../../store/useMealPlanStore'
import { formatRange } from '../../lib/planner/format'

/**
 * The planner's title, its arrows, and how much of the plan to look at.
 *
 * A week is the working unit; a fortnight is how far ahead a shop reaches; a
 * month is for seeing the shape of it rather than the detail.
 */
export function PlannerHeader({
  windowDates, plannedDays, dayCount, range, onShift, onToday, onRange, onSavedWeeks, onFill,
}: {
  windowDates: string[]
  plannedDays: number
  /** The days the count is out of: the window, not the view. */
  dayCount: number
  range: PlanRange
  onShift: (direction: -1 | 1) => void
  onToday: () => void
  onRange: (range: PlanRange) => void
  onSavedWeeks: () => void
  onFill: () => void
}) {
  return (
    <>
      {/* Navigation */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display text-xl sm:text-2xl text-ink-900">
            Your week
          </h1>
          <p className="text-sm text-ink-700">
            {formatRange(windowDates)} · {plannedDays} of {dayCount} days planned
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-secondary btn-icon" onClick={() => onShift(-1)} aria-label={`Previous ${range}`}>
            <ChevronLeft size={18} />
          </button>
          <button
            className="btn-secondary"
            onClick={onToday}
          >
            Today
          </button>
          <button className="btn-secondary btn-icon" onClick={() => onShift(1)} aria-label={`Next ${range}`}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      {/* How much of it to look at. A week is the working unit; a fortnight
          is how far ahead a shop reaches; a month is for seeing the shape of
          it rather than the detail. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit" role="tablist">
        {(Object.keys(RANGE_LABELS) as PlanRange[]).map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={range === r}
            onClick={() => onRange(r)}
            className={range === r ? 'tab-on' : 'tab-off'}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
        </div>

        {/* Week scoped, so it sits with the range rather than in the day
            toolbar below, which acts on the day you have selected. */}
        <button className="btn-secondary" onClick={onSavedWeeks}>
          <Bookmark size={15} /> Saved weeks
        </button>

        {/* Range scoped, so it sits with the range. In the day view it is on
            the day's own toolbar below, acting on that day alone. */}
        {range !== 'day' && (
          <button className="btn-secondary" onClick={onFill}>
            <Sparkles size={15} /> Fill the gaps
          </button>
        )}
      </div>
    </>
  )
}
