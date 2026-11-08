import { Plus, X, MoveRight, Check, ShoppingBasket, Circle, CircleSlash } from 'lucide-react'
import type { Component, DayPlan, MealOutcome, MealSlot } from '../../types'
import { SLOT_LABELS } from '../../types'
import { useNutritionContext } from '../../store/useNutrition'
import { componentsNutrients, entryOutcome } from '../../lib/nutrition'
import { SourceLine } from '../ui'
import { usePantry } from '../../store/usePantryStore'
import { mealAvailability } from '../../lib/pantry'
import { entryName } from '../../lib/entryLabel'
import { EntryLine } from './EntryLine'

export function SlotRow({
  slot, day, onAdd, onRemove, onMove, onOutcome, onEntryOutcome, onAmount, onRemoveEntry,
  onMoveEntry,
}: {
  slot: MealSlot
  day: DayPlan
  onAdd: () => void
  onRemove: (mealId: string) => void
  onMove: (mealId: string) => void
  onOutcome: (mealId: string, outcome: MealOutcome | undefined) => void
  onEntryOutcome: (mealId: string, index: number, outcome: MealOutcome | undefined) => void
  onAmount: (mealId: string, index: number) => void
  onRemoveEntry: (mealId: string, index: number) => void
  onMoveEntry: (mealId: string, index: number) => void
}) {
  const ctx = useNutritionContext()
  const meals = day.meals.filter((m) => m.slot === slot)

  /*
   * What the slot amounted to, counting only what still counts.
   *
   * It used to total every entry in the slot regardless, so a breakfast whose
   * coffee had been marked as not drunk went on charging you for the coffee,
   * in the one place on the screen that exists to say how much you have had.
   */
  const counted = meals.flatMap(
    (meal) => meal.entries.filter((e) => entryOutcome(e, meal) !== 'skipped'))
  const kcal = componentsNutrients(counted, ctx).calories
  const undecided = meals.some(
    (meal) => meal.entries.some((e) => !entryOutcome(e, meal)))

  return (
    <div className="card p-4">
      {/* Tight, because a tick and an amount now live on every line and a day
          still has to fit on a laptop without scrolling. */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-500">{SLOT_LABELS[slot]}</span>
        <span className="flex items-center gap-2">
          {/* One tap for the ordinary case, which is that you ate the meal you
              planned. The ticks below are for the case this app kept getting
              wrong, where you ate most of it. Offered only while there is
              something left to say, so a finished slot is quiet. */}
          {undecided && (
            <button
              className="text-xs font-semibold text-bite-700 hover:underline min-h-11 px-1 -mx-1"
              onClick={() => { for (const meal of meals) onOutcome(meal.id, 'eaten') }}
            >
              Had it all
            </button>
          )}
          <span className="text-xs font-mono text-ink-700">{kcal > 0 ? `${Math.round(kcal)} kcal` : ''}</span>
        </span>
      </div>

      {meals.length === 0 ? (
        <button onClick={onAdd} className="meal-slot w-full text-sm text-ink-500 hover:text-bite-700">
          <Plus size={16} className="mr-1" /> Pop something in
        </button>
      ) : (
        <div className="space-y-1">
          {meals.map((meal) => (
            <div key={meal.id} className="flex items-start gap-2">
              <div className="flex-1 min-w-0 space-y-1">
                {/* A tick a line, because that is how a day is actually eaten.
                    One tick for the meal could say all of it or none of it,
                    and a breakfast of bread, cheese and a coffee you left has
                    neither of those as an honest answer. */}
                {meal.entries.map((entry, i) => {
                  const outcome = entryOutcome(entry, meal)
                  return (
                    <div key={i} className="flex items-start gap-1.5">
                      <OutcomeTick
                        outcome={outcome}
                        what={entryName(entry, ctx)}
                        onChange={(next) => onEntryOutcome(meal.id, i, next)}
                      />
                      <div className="flex-1 min-w-0">
                        <EntryLine
                          entry={entry}
                          struck={outcome === 'skipped'}
                          onAmount={() => onAmount(meal.id, i)}
                        />
                      </div>
                      {/* A line of a meal you can take out on its own.
                          Offered only where it means something different from
                          the meal's own X to the right: with one line in the
                          meal the two would do exactly the same thing, and two
                          crosses on one row is a question the reader has to
                          stop and answer. */}
                      {meal.entries.length > 1 && (
                        <>
                          <button
                            className="btn-ghost btn-icon shrink-0 text-ink-300 hover:text-bite-700"
                            onClick={() => onMoveEntry(meal.id, i)}
                            aria-label={`Move ${entryName(entry, ctx)}`}
                          >
                            <MoveRight size={14} />
                          </button>
                          <button
                            className="btn-ghost btn-icon shrink-0 text-ink-300 hover:text-coral-600"
                            onClick={() => onRemoveEntry(meal.id, i)}
                            aria-label={`Remove ${entryName(entry, ctx)}`}
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  )
                })}
                {meal.note ? (
                  <div className="pt-0.5" title={meal.note}>
                    <SourceLine text={meal.note} clamp={2} translate />
                  </div>
                ) : null}
                <ShoppingState entries={meal.entries} />
              </div>
              {/* The meal's own controls, fenced off from the per-line ones.
                  Once every line carried a move and a remove of its own, the
                  first row of a meal read as four icons in two identical
                  pairs, and nothing said that the right-hand pair meant the
                  whole meal. The rule stays, the grouping is what tells you:
                  a hairline, and these sit outside the line that owns them. */}
              <div className="flex shrink-0 self-start ml-1 pl-1 border-l border-border-100">
                <button
                  className="btn-ghost btn-icon text-ink-300 hover:text-bite-700"
                  onClick={() => onMove(meal.id)}
                  aria-label="Move or copy meal"
                >
                  <MoveRight size={16} />
                </button>
                <button
                  className="btn-ghost btn-icon text-ink-300 hover:text-coral-600"
                  onClick={() => onRemove(meal.id)}
                  aria-label="Remove meal"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={onAdd}
            className="inline-flex items-center min-h-11 px-1 -mx-1 text-xs font-semibold text-bite-700 hover:underline"
          >
            + Add another
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Whether this meal could be cooked tonight.
 *
 * Silent when the cupboard is empty, which is not a technicality: with nothing
 * in it every meal is missing everything, and a line saying so on all thirty
 * five slots of a week is noise on the scale that teaches people to stop
 * reading the app. It has something to say only once you have told it what you
 * have.
 *
 * Names what is short rather than counting it, and never says a meal is a
 * problem. "Onion, spinach" is a fact you can act on in a shop; "not cookable"
 * is a verdict on a kitchen the app cannot see.
 */
function ShoppingState({ entries }: { entries: Component[] }) {
  const ctx = useNutritionContext()
  const pantry = usePantry()
  if (!pantry.size || !entries.length) return null

  const { ready, missing } = mealAvailability(entries, ctx, pantry)

  return (
    <p className={`flex items-start gap-1.5 pt-1 text-xs ${ready ? 'text-leaf-700' : 'text-ink-500'}`}>
      {ready
        ? <><Check size={13} className="shrink-0 mt-px" /> Everything in</>
        : <>
            <ShoppingBasket size={13} className="shrink-0 mt-px" />
            <span className="min-w-0">
              {missing.length === 1 ? 'To buy: ' : `${missing.length} to buy: `}
              {missing.slice(0, 4).join(', ')}{missing.length > 4 ? ' and more' : ''}
            </span>
          </>}
    </p>
  )
}

/**
 * Whether this actually happened.
 *
 * One button and three states, rather than two buttons, because the row
 * already carries move and remove and a fourth control turns a meal into a
 * toolbar. The label says what the next press does, so the cycle is learnable
 * without a legend: unsaid, eaten, skipped, unsaid.
 *
 * Nothing here scolds. A skipped meal is dimmed and struck through, not marked
 * in red: not eating what you planned is a Tuesday, not a failure, and an app
 * that treats it as one is an app people stop ticking honestly.
 */
function OutcomeTick({
  outcome, what, onChange,
}: {
  outcome: MealOutcome | undefined
  /**
   * What this tick is about.
   *
   * A line of ticks down a slot needs it. "Mark as eaten" was a fine name
   * while there was one of these per meal and the meal's name sat beside it;
   * five of them in a column all called the same thing is a screen reader
   * reading out the same button five times with no way to tell which is the
   * bread.
   */
  what?: string
  onChange: (next: MealOutcome | undefined) => void
}) {
  const next: MealOutcome | undefined =
    outcome === undefined ? 'eaten' : outcome === 'eaten' ? 'skipped' : undefined

  const of = what ? ` ${what}` : ''
  const label = outcome === undefined ? `Had${of}`
    : outcome === 'eaten' ? `Had${of}. Say it was left instead`
      : `Left${of}. Clear it`

  return (
    <button
      className={`btn-ghost btn-icon shrink-0 ${
        outcome === 'eaten' ? 'text-leaf-700'
          : outcome === 'skipped' ? 'text-ink-500' : 'text-ink-300 hover:text-leaf-700'
      }`}
      onClick={() => onChange(next)}
      aria-label={label}
      aria-pressed={outcome === 'eaten'}
      title={label}
    >
      {outcome === 'eaten' ? <Check size={16} />
        : outcome === 'skipped' ? <CircleSlash size={16} />
          : <Circle size={16} />}
    </button>
  )
}
