import { useState } from 'react'
import {
  Plus, MoveRight, Check, ShoppingBasket, Circle, CircleSlash, MoreHorizontal, SkipForward, Trash2,
} from 'lucide-react'
import type { Component, DayPlan, MealOutcome, MealSlot } from '../../types'
import { SLOT_LABELS } from '../../types'
import { useNutritionContext } from '../../store/useNutrition'
import { componentsNutrients, entryOutcome } from '../../lib/nutrition'
import { SourceLine } from '../ui'
import { usePantry } from '../../store/usePantryStore'
import { mealAvailability } from '../../lib/pantry'
import { entryName } from '../../lib/entryLabel'
import { EntryLine } from './EntryLine'

interface Action {
  label: string
  aria: string
  icon: typeof Plus
  danger?: boolean
  run: () => void
}

/**
 * One slot of a day: its name, its total, a way to add, and what is in it.
 *
 * Drawn as a section of the day's card rather than a card of its own, so the
 * four slots read as one day. Every line keeps its tick and its amount where a
 * thumb can reach them; the rest of what can be done to a line, move, skip and
 * remove, sits behind one button on a phone and inline on a wide screen.
 */
export function SlotRow({
  slot, day, first = false, onAdd, onRemove, onMove, onOutcome, onEntryOutcome, onAmount, onRemoveEntry,
  onMoveEntry,
}: {
  slot: MealSlot
  day: DayPlan
  /** The top section of its card, so it draws no rule above itself. */
  first?: boolean
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
  /** The one line whose actions are showing on a phone, if any. */
  const [open, setOpen] = useState<string | null>(null)

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
  const name = SLOT_LABELS[slot]

  return (
    <section aria-label={name} className={first ? '' : 'border-t border-border-100'}>
      <div className="flex items-center gap-2 pl-3.5 pr-1.5 pt-1.5 min-h-11">
        <h3 className="text-[15px] leading-5 font-extrabold text-ink-900">{name}</h3>
        <span className="flex-1" />
        {/* One tap for the ordinary case, which is that you ate the meal you
            planned. Offered only while there is something left to say. */}
        {undecided && (
          <button
            type="button"
            className="text-xs font-bold text-bite-700 hover:underline min-h-11 px-1"
            onClick={() => { for (const meal of meals) onOutcome(meal.id, 'eaten') }}
          >
            Had it all
          </button>
        )}
        {kcal > 0 && (
          <span className="text-xs font-bold text-ink-700 tabular-nums">{Math.round(kcal)} kcal</span>
        )}
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add to ${name.toLowerCase()}`}
          className="min-h-11 px-2.5 rounded-[14px] text-[13px] font-extrabold text-bite-700 hover:bg-bite-50 inline-flex items-center gap-1"
        >
          <Plus size={16} aria-hidden="true" /> Add
        </button>
      </div>

      {meals.length === 0 ? (
        <p className="px-3.5 pb-3 text-[13px] text-ink-700">Nothing planned yet</p>
      ) : (
        <ul className="pb-1.5">
          {meals.map((meal) => {
            const many = meal.entries.length > 1
            return (
              <li key={meal.id}>
                <ul>
                  {/* A tick a line, because that is how a day is actually
                      eaten: a breakfast of bread, cheese and a coffee you left
                      is neither all of it nor none of it. */}
                  {meal.entries.map((entry, i) => {
                    const outcome = entryOutcome(entry, meal)
                    const what = entryName(entry, ctx)
                    const key = `${meal.id}:${i}`
                    const isOpen = open === key
                    // Line actions where the meal has several lines; the
                    // meal's own where the line is the meal, so one row never
                    // offers two buttons that do the same thing.
                    const actions: Action[] = [
                      many
                        ? { label: 'Move', aria: `Move ${what}`, icon: MoveRight, run: () => onMoveEntry(meal.id, i) }
                        : { label: 'Move', aria: 'Move or copy meal', icon: MoveRight, run: () => onMove(meal.id) },
                      ...(outcome === 'skipped' ? [] : [{
                        label: 'Skip', aria: `Skip ${what}`, icon: SkipForward,
                        run: () => onEntryOutcome(meal.id, i, 'skipped'),
                      }]),
                      many
                        ? { label: 'Remove', aria: `Remove ${what}`, icon: Trash2, danger: true, run: () => onRemoveEntry(meal.id, i) }
                        : { label: 'Remove', aria: 'Remove meal', icon: Trash2, danger: true, run: () => onRemove(meal.id) },
                    ]
                    return (
                      <li key={i} className={isOpen ? 'bg-bite-50 md:bg-transparent' : ''}>
                        <div className="flex items-center gap-1.5 px-1 min-h-12">
                          <OutcomeTick
                            outcome={outcome}
                            what={what}
                            onChange={(next) => onEntryOutcome(meal.id, i, next)}
                          />
                          <EntryLine
                            entry={entry}
                            struck={outcome === 'skipped'}
                            onAmount={() => onAmount(meal.id, i)}
                          />
                          {/* Inline on a wide screen, where there is room for
                              them; behind one button on a phone. */}
                          <span className="hidden md:flex shrink-0">
                            {actions.map((a) => (
                              <button
                                key={a.label}
                                type="button"
                                onClick={a.run}
                                aria-label={a.aria}
                                title={a.aria}
                                className={`w-11 h-11 rounded-xl inline-flex items-center justify-center text-ink-700 ${
                                  a.danger ? 'hover:text-coral-700' : 'hover:text-bite-700'}`}
                              >
                                <a.icon size={16} aria-hidden="true" />
                              </button>
                            ))}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : key)}
                            aria-label={`Actions for ${what}`}
                            aria-expanded={isOpen}
                            className="md:hidden w-11 h-11 shrink-0 rounded-[14px] inline-flex items-center justify-center text-ink-700"
                          >
                            <MoreHorizontal size={18} aria-hidden="true" />
                          </button>
                        </div>
                        {isOpen && (
                          <div
                            role="group"
                            aria-label={`What to do with ${what}`}
                            className="md:hidden grid gap-1.5 px-3.5 pb-2 pt-0.5"
                            style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}
                          >
                            {actions.map((a) => (
                              <button
                                key={a.label}
                                type="button"
                                onClick={() => { setOpen(null); a.run() }}
                                aria-label={a.aria}
                                className={`min-h-11 rounded-[14px] border bg-paper text-[13px] font-bold inline-flex items-center justify-center gap-1 ${
                                  a.danger ? 'border-coral-700 text-coral-700' : 'border-border-200 text-ink-900'}`}
                              >
                                <a.icon size={15} aria-hidden="true" /> {a.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
                <div className="pl-[50px] pr-3.5 space-y-1">
                  {meal.note ? (
                    <div title={meal.note}>
                      <SourceLine text={meal.note} clamp={2} translate />
                    </div>
                  ) : null}
                  <ShoppingState entries={meal.entries} />
                  {/* The whole meal, when it is more than one line: the lines'
                      own buttons move and remove a line, these the lot. */}
                  {many && (
                    <div className="flex flex-wrap gap-x-3 -ml-1">
                      <button
                        type="button"
                        onClick={() => onMove(meal.id)}
                        aria-label="Move or copy meal"
                        className="min-h-11 px-1 text-xs font-bold text-bite-700 hover:underline inline-flex items-center gap-1"
                      >
                        <MoveRight size={14} aria-hidden="true" /> Move or copy the meal
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(meal.id)}
                        aria-label="Remove meal"
                        className="min-h-11 px-1 text-xs font-bold text-coral-700 hover:underline inline-flex items-center gap-1"
                      >
                        <Trash2 size={14} aria-hidden="true" /> Remove the meal
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
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
