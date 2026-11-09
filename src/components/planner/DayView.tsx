import { Copy, Sparkles, Trash2 } from 'lucide-react'
import type { DayPlan, MealOutcome, MealSlot, Targets } from '../../types'
import { MEAL_SLOTS } from '../../types'
import { useNutritionContext } from '../../store/useNutrition'
import { usePeople } from '../../store/useHousehold'
import { dayEaten, dayLabel, dayProgress, dayStanding } from '../../lib/nutrition'
import { dayCompleteness } from '../../lib/completeness'
import { CHIP_TONE, dayChip, slotsPlanned } from '../../lib/planner/dayChip'
import { KnownHint, NutrientSummary } from '../ui'
import { PersonStack } from '../ui/PersonAvatar'
import { SlotRow } from './SlotRow'

/**
 * One day in detail: how it stands against the target, then its slots in the
 * order they are eaten, then what can be done to the whole day.
 *
 * The same body on a phone, where it is the screen, and on a wide screen,
 * where it opens beside the week. The header around it belongs to whichever
 * of those it is in.
 */
export function DayView({
  day: selectedDay, targets, clearing, setClearing, onFill, onCopy, onClear, onAdd, onRemove, onMove,
  onOutcome, onEntryOutcome, onAmount, onRemoveEntry, onMoveEntry,
}: {
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
  const people = usePeople()
  // Once anything on the day has been ticked this is a record rather than an
  // intention, and the figure says which.
  const { nutrients: totals } = dayEaten(selectedDay, ctx)
  const kcal = Math.round(totals.calories)
  const target = Math.round(targets.calories)
  // Empty, all still ahead of you, part way through, or done.
  const progress = dayProgress(selectedDay)
  const label = dayLabel(progress)
  // Split rather than summed, for the hours when a day is half over.
  const standing = dayStanding(selectedDay, ctx)
  // What the day's figures do not know, said rather than counted as nought.
  const { report: dayReport, known, total } = dayCompleteness(selectedDay, ctx)
  const chip = dayChip(selectedDay, kcal, target)
  const planned = slotsPlanned(selectedDay)
  const fill = target > 0 ? Math.min(100, (kcal / target) * 100) : 0

  return (
    <div className="flex flex-col gap-3">
      {/* One plan for the household, so one line for it: everybody in the
          household eats from this day, and it is measured against the
          household's target. */}
      <section aria-label="Day totals" className="bg-paper border border-border-200 rounded-3xl px-3.5 py-3 flex flex-col gap-2">
        <div className="flex items-center gap-2.5 min-h-8">
          <PersonStack people={people} size="md" />
          <span className="flex-1 min-w-0 text-sm text-ink-700">
            <strong data-day-kcal className="text-base font-extrabold text-ink-900 tabular-nums">
              {kcal.toLocaleString('en-GB')}
            </strong>
            {' '}of {target.toLocaleString('en-GB')} kcal
          </span>
          {chip && (
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${CHIP_TONE[chip.tone]}`}>
              {chip.label}
            </span>
          )}
        </div>
        <div
          role="progressbar"
          aria-label="Of the day's target"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.min(kcal, target)}
          className="h-2 rounded-full bg-border-100 overflow-hidden"
        >
          <div className="h-full bg-leaf-500 rounded-full" style={{ width: `${fill}%` }} />
        </div>
        {/* Where the day has got to, once any of it has happened. Two facts
            rather than one sum: at four in the afternoon "this day is 1,600
            kcal" is not the thing you want to know. */}
        {standing.count.had > 0 && (
          <p className="text-[13px] text-ink-700">
            <strong className="text-ink-900 tabular-nums">{Math.round(standing.had.calories)}</strong> kcal
            {' '}had
            {standing.count.ahead > 0 ? (
              <>
                {', '}
                <strong className="text-ink-900 tabular-nums">{Math.round(standing.ahead.calories)}</strong>
                {' '}still to come across {standing.count.ahead}{' '}
                {standing.count.ahead === 1 ? 'item' : 'items'}.
              </>
            ) : '. Nothing else on the day.'}
          </p>
        )}
        <div className="text-xs leading-4 text-ink-700 border-t border-border-100 pt-2 flex flex-wrap gap-x-1">
          <span>{planned} of {MEAL_SLOTS.length} meals planned</span>
          {label && <><span aria-hidden="true">·</span><span>{label}</span></>}
        </div>
        {/* Beside the totals, not inside the disclosure: it says how far to trust them. */}
        <KnownHint known={known} total={total} />
        <details className="group">
          <summary className="min-h-11 flex items-center text-xs font-bold text-bite-700 cursor-pointer">
            Nutrients for the day
          </summary>
          <div className="pb-1">
            <NutrientSummary
              n={totals}
              targets={targets}
              partial={dayReport.partial}
              unresolved={dayReport.unresolved}
            />
          </div>
        </details>
      </section>

      {/* One slot under the next: a day is a sequence, so it is drawn as one. */}
      <div className="bg-paper border border-border-200 rounded-3xl overflow-hidden">
        {MEAL_SLOTS.map((slot, i) => (
          <SlotRow
            key={slot}
            slot={slot}
            first={i === 0}
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

      <DayActions
        meals={selectedDay.meals.length}
        clearing={clearing}
        setClearing={setClearing}
        onFill={onFill}
        onCopy={onCopy}
        onClear={onClear}
      />
    </div>
  )
}

/**
 * What can be done to the whole day: fill its gaps, copy it, clear it.
 *
 * Clearing asks first, with the count on the button where the thumb already
 * is, because it throws away everything the day holds.
 */
export function DayActions({ meals, clearing, setClearing, onFill, onCopy, onClear }: {
  meals: number
  clearing: boolean
  setClearing: (clearing: boolean) => void
  onFill: () => void
  onCopy: () => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-secondary" onClick={onFill}>
        <Sparkles size={15} aria-hidden="true" /> Fill the gaps
      </button>
      <button type="button" className="btn-secondary" onClick={onCopy} aria-label="Copy day to another day">
        <Copy size={15} aria-hidden="true" /> Copy day
      </button>
      {meals > 0 && (
        clearing ? (
          <>
            <button
              type="button"
              className="btn-primary"
              onClick={() => { onClear(); setClearing(false) }}
            >
              <Trash2 size={15} aria-hidden="true" /> Clear {meals} {meals === 1 ? 'meal' : 'meals'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setClearing(false)}>Keep them</button>
          </>
        ) : (
          <button
            type="button"
            className="btn-ghost text-ink-700 hover:text-coral-700"
            onClick={() => setClearing(true)}
          >
            <Trash2 size={15} aria-hidden="true" /> Clear day
          </button>
        )
      )}
    </div>
  )
}
