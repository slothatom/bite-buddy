import { Copy, Sparkles, Trash2 } from 'lucide-react'
import type { DayPlan, MealOutcome, MealSlot, Targets } from '../../types'
import { MEAL_SLOTS } from '../../types'
import { useNutritionContext } from '../../store/useNutrition'
import { dayEaten, dayLabel, dayProgress, dayStanding, reportDay } from '../../lib/nutrition'
import { formatDate } from '../../lib/planner/format'
import { CalorieRing, NutrientSummary, SectionHeading } from '../ui'
import { SlotRow } from './SlotRow'

/**
 * One day in detail: the ring, the day's own toolbar, and its slots in order.
 *
 * Only drawn in the day view. In a week view it was the whole content of the
 * screen and the reason a week was never on it.
 */
export function DayView({
  date: selected, day: selectedDay, targets, clearing, setClearing, onFill, onCopy, onClear, onAdd, onRemove, onMove,
  onOutcome, onEntryOutcome, onAmount, onRemoveEntry, onMoveEntry,
}: {
  date: string
  day: DayPlan
  targets: Targets
  /** Whether the clear-day button is asking to be confirmed. */
  clearing: boolean
  setClearing: (clearing: boolean) => void
  onFill: () => void
  onCopy: () => void
  onClear: () => void
  onAdd: (slot: MealSlot) => void
  onRemove: (mealId: string) => void
  onMove: (mealId: string) => void
  onOutcome: (mealId: string, outcome: MealOutcome | undefined) => void
  onEntryOutcome: (mealId: string, index: number, outcome: MealOutcome | undefined) => void
  onAmount: (mealId: string, index: number) => void
  onRemoveEntry: (mealId: string, index: number) => void
  onMoveEntry: (mealId: string, index: number) => void
}) {
  const ctx = useNutritionContext()
  // Once anything on the day has been ticked this is a record rather than an
  // intention, and the ring says which. A ring built on the plan looked like a
  // tracker and was really a sum of things nobody had confirmed eating.
  const { nutrients: selectedTotals } = dayEaten(selectedDay, ctx)
  // Empty, all still ahead of you, part way through, or done. The badge used
  // to have two states for four situations and was wrong in two of them.
  const progress = dayProgress(selectedDay)
  // Split rather than summed, for the hours when a day is half over. The ring
  // and the bars still show the whole day, which is what a target is about;
  // this is the sentence underneath that says where you have got to.
  const standing = dayStanding(selectedDay, ctx)
  // What the day's figures do not know. The planner totalled with a function
  // that discards it, so a day of foods with no sodium figure between them
  // still showed a salt total as though it were one.
  const dayReport = reportDay(selectedDay, ctx)

  return (
    <>
      <section className="card p-5">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <CalorieRing value={selectedTotals.calories} target={targets.calories} />
          <div className="flex-1 w-full">
            <NutrientSummary
              n={selectedTotals}
              targets={targets}
              partial={dayReport.partial}
              unresolved={dayReport.unresolved}
            />
            {/* Where the day has got to, once any of it has happened. Two
                facts rather than one sum: at four in the afternoon "this day
                is 1,600 kcal" is not the thing you want to know. */}
            {standing.count.had > 0 && (
              <p className="mt-3 pt-3 border-t border-border-200 text-sm text-ink-700">
                <strong className="font-mono">{Math.round(standing.had.calories)}</strong> kcal
                {' '}had
                {standing.count.ahead > 0 ? (
                  <>
                    {', '}
                    <strong className="font-mono">{Math.round(standing.ahead.calories)}</strong>
                    {' '}still to come across {standing.count.ahead}{' '}
                    {standing.count.ahead === 1 ? 'item' : 'items'}.
                  </>
                ) : '. Nothing else on the day.'}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-border-200">
          {/* Offered here rather than as a headline action: filling the gaps
              is useful when there are gaps, and the rest of the time it is
              one more thing between you and your week. */}
          <button className="btn-secondary" onClick={() => onFill()}>
            <Sparkles size={15} /> Fill the gaps
          </button>
          <button className="btn-secondary" onClick={() => onCopy()}>
            <Copy size={15} /> Copy day to…
          </button>
          {selectedDay.meals.length > 0 && (
            clearing ? (
              <>
                {/* The count is on the button, where the thumb already is,
                    rather than in a sentence above it. */}
                <button
                  className="btn-primary"
                  onClick={() => { onClear(); setClearing(false) }}
                >
                  <Trash2 size={15} /> Clear {selectedDay.meals.length}{' '}
                  {selectedDay.meals.length === 1 ? 'meal' : 'meals'}
                </button>
                <button className="btn-secondary" onClick={() => setClearing(false)}>Keep them</button>
              </>
            ) : (
              <button
                className="btn-ghost text-ink-500 hover:text-coral-600"
                onClick={() => setClearing(true)}
              >
                <Trash2 size={15} /> Clear day
              </button>
            )
          )}
        </div>
      </section>

      {/* Meals */}
      <section>
        <SectionHeading>
          {formatDate(selected)}
          {dayLabel(progress) && (
            <span className="ml-2 text-xs font-bold uppercase tracking-wide text-ink-500">
              {dayLabel(progress)}
            </span>
          )}
        </SectionHeading>
        {/* One slot under the next, at every width.

            This was two columns from lg and three from xl, to keep a laptop
            from pushing the later meals below the fold. It bought that at a
            cost that showed up the moment a day was mostly empty: four slots
            across an auto-flowing grid put Snacks under Breakfast with a
            column and a half of nothing beside it, and the order you read
            them in stopped matching the order you eat them in. A day is a
            sequence, so it is drawn as one. */}
        <div className="space-y-2">
          {MEAL_SLOTS.map((slot) => (
            <SlotRow
              key={slot}
              slot={slot}
              day={selectedDay}
              onAdd={() => onAdd(slot)}
              onRemove={onRemove}
              onMove={onMove}
              onOutcome={onOutcome}
              onEntryOutcome={onEntryOutcome}
              onAmount={onAmount}
              onRemoveEntry={onRemoveEntry}
              onMoveEntry={onMoveEntry}
            />
          ))}
        </div>
      </section>
    </>
  )
}
