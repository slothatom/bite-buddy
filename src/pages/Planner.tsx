import { useMemo, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Copy, Plus, Trash2, X, CalendarDays, MoveRight, Sparkles,
  Check, ShoppingBasket,
} from 'lucide-react'
import type { Component, DayPlan, MealSlot } from '../types'
import { MEAL_SLOTS, SLOT_LABELS } from '../types'
import {
  useMealPlanStore, getWeekDates, getRangeDates, monthOf,
  RANGE_LABELS, type PlanRange,
} from '../store/useMealPlanStore'
import { useDeletedIds } from '../store/useRecipeStore'
import { useUserStore } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import { componentsNutrients, dayNutrients, emptyNutrients, addNutrients } from '../lib/nutrition'
import { CalorieRing, NutrientSummary, SectionHeading, SourceLine } from '../components/ui'
import { useUiStore } from '../store/useUiStore'
import AddEntryModal from '../components/planner/AddEntryModal'
import { usePortionStore } from '../store/usePortionStore'
import { portionEntries } from '../lib/portionsUse'
import { usePantry } from '../store/usePantryStore'
import { mealAvailability } from '../lib/pantry'
import FillGaps from '../components/planner/FillGaps'
import type { Proposal } from '../lib/autoPlan'

/**
 * The weekly planner.
 *
 * The grid runs from the user's chosen week start, Monday by default, and any
 * of the seven days is allowed. The dietician's own plans all ran Wednesday to
 * Tuesday, and loading one lines its days up by weekday rather than forcing the
 * week to start where the document did.
 */
export default function Planner() {
  const { profile } = useUserStore()
  const {
    weekDates, plan, goToWeek, addEntry, removeMeal, clearDay, copyDay,
    moveMeal, duplicateMeal,
  } = useMealPlanStore()
  const ctx = useNutritionContext()

  const [range, setRange] = useState<PlanRange>('week')
  const [selected, setSelected] = useState<string>(() => todayOrFirst(weekDates))
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [copyFrom, setCopyFrom] = useState<string | null>(null)
  const [moving, setMoving] = useState<{ date: string; mealId: string } | null>(null)
  const [filling, setFilling] = useState<string[] | null>(null)
  const { quickAdd, clearQuickAdd } = useUiStore()
  const { takeFrom, returnTo } = usePortionStore()

  const byDate = useMemo(() => new Map(plan.map((d) => [d.date, d])), [plan])

  /**
   * Planning from the fridge takes the portion, and unplanning puts it back.
   *
   * Done here rather than inside the store because it crosses two of them, and
   * because "what is left" is only ever an estimate: the count comes down when
   * you say you will eat something and goes back up when you change your mind,
   * which is as close to the truth as an app that cannot see the tub can get.
   */
  const addEntryTakingPortions = (date: string, slot: MealSlot, entry: Component) => {
    if (entry.kind === 'portion') takeFrom(entry.portionId, entry.servings)
    addEntry(date, slot, entry)
  }

  const removeMealReturningPortions = (date: string, mealId: string) => {
    const meal = byDate.get(date)?.meals.find((m) => m.id === mealId)
    for (const p of portionEntries(meal?.entries ?? [])) returnTo(p.portionId, p.servings)
    removeMeal(date, mealId)
  }

  /** Everything the assistant offered and you kept, in one go. */
  const applyProposals = (proposals: Proposal[]) => {
    for (const p of proposals) addEntryTakingPortions(p.date, p.slot, p.entry)
    setFilling(null)
  }

  const clearDayReturningPortions = (date: string) => {
    const day = byDate.get(date)
    for (const meal of day?.meals ?? []) {
      for (const p of portionEntries(meal.entries)) returnTo(p.portionId, p.servings)
    }
    clearDay(date)
  }

  /**
   * The days on screen. A week, a fortnight, or the calendar month padded out
   * to whole weeks.
   */
  const dates = useMemo(
    () => getRangeDates(weekDates[0], range, profile.weekStartsOn),
    [weekDates, range, profile.weekStartsOn],
  )
  const anchorMonth = monthOf(weekDates[0])
  const selectedDay = byDate.get(selected) ?? { date: selected, meals: [] }
  const selectedTotals = dayNutrients(selectedDay, ctx)
  const targets = profile.targets

  // Totals are for what you are looking at, not for everything ever planned.
  const shownDays = useMemo(
    () => dates.map((date) => byDate.get(date)).filter((d): d is DayPlan => Boolean(d)),
    [dates, byDate],
  )
  const weekTotal = useMemo(
    () => shownDays.reduce((acc, d) => addNutrients(acc, dayNutrients(d, ctx)), emptyNutrients()),
    [shownDays, ctx],
  )
  const plannedDays = shownDays.filter((d) => d.meals.length).length

  // The bottom bar's centre button lands here. Rather than syncing that intent
  // into local state from an effect, which costs a second render, the open
  // modal is derived from either source.
  const filledSlots = new Set(selectedDay.meals.map((m) => m.slot))
  const openAdd = adding ?? (quickAdd
    ? { date: selected, slot: MEAL_SLOTS.find((s) => !filledSlots.has(s)) ?? 'breakfast' }
    : null)

  function closeAdd() {
    setAdding(null)
    clearQuickAdd()
  }

  /** Steps by whatever you are looking at: a week, a fortnight, or a month. */
  function shift(direction: -1 | 1) {
    const ref = new Date(weekDates[0] + 'T12:00:00')
    if (range === 'month') ref.setMonth(ref.getMonth() + direction)
    else ref.setDate(ref.getDate() + direction * (range === 'fortnight' ? 14 : 7))

    goToWeek(ref, profile.weekStartsOn)
    setSelected(getRangeDates(
      getWeekDates(ref, profile.weekStartsOn)[0], range, profile.weekStartsOn,
    )[0])
  }

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Navigation */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="display text-xl sm:text-2xl text-ink-900">
              {range === 'month' ? formatMonth(weekDates[0]) : 'Your week'}
            </h1>
            <p className="text-sm text-ink-700">
              {formatRange(dates)} · {plannedDays} of {dates.length} days planned
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button className="btn-secondary btn-icon" onClick={() => shift(-1)} aria-label={`Previous ${range}`}>
              <ChevronLeft size={18} />
            </button>
            <button
              className="btn-secondary"
              onClick={() => { goToWeek(new Date(), profile.weekStartsOn); setSelected(new Date().toISOString().slice(0, 10)) }}
            >
              Today
            </button>
            <button className="btn-secondary btn-icon" onClick={() => shift(1)} aria-label={`Next ${range}`}>
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        {/* How much of it to look at. A week is the working unit; a fortnight
            is how far ahead a shop reaches; a month is for seeing the shape of
            it rather than the detail. */}
        <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit" role="tablist">
          {(Object.keys(RANGE_LABELS) as PlanRange[]).map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={range === r}
              onClick={() => setRange(r)}
              className={range === r ? 'tab-on' : 'tab-off'}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {/* The days themselves, seven to a row however many there are. The
            weekday letters only appear once a grid is more than one row, where
            reading down a column is the point. */}
        <div className="space-y-1.5 sm:space-y-2">
          {dates.length > 7 && (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {dates.slice(0, 7).map((date) => (
                <div key={date} className="text-center text-[11px] font-bold uppercase tracking-wide text-ink-500">
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {dates.map((date) => (
              <DayCell
                key={date}
                date={date}
                kcal={(() => { const d = byDate.get(date); return d ? dayNutrients(d, ctx).calories : 0 })()}
                selected={date === selected}
                showWeekday={dates.length <= 7}
                dim={range === 'month' && monthOf(date) !== anchorMonth}
                onSelect={() => setSelected(date)}
              />
            ))}
          </div>
        </div>

        {/* Day totals */}
        <section className="card p-5">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <CalorieRing value={selectedTotals.calories} target={targets.calories} />
            <div className="flex-1 w-full">
              <NutrientSummary n={selectedTotals} targets={targets} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-border-200">
            {/* Offered here rather than as a headline action: filling the gaps
                is useful when there are gaps, and the rest of the time it is
                one more thing between you and your week. */}
            <button className="btn-secondary" onClick={() => setFilling(dates)}>
              <Sparkles size={15} /> Fill the gaps
            </button>
            <button className="btn-secondary" onClick={() => setCopyFrom(selected)}>
              <Copy size={15} /> Copy day to…
            </button>
            {selectedDay.meals.length > 0 && (
              <button className="btn-ghost text-ink-500 hover:text-coral-600" onClick={() => clearDayReturningPortions(selected)}>
                <Trash2 size={15} /> Clear day
              </button>
            )}
          </div>
        </section>

        {/* Meals */}
        <section>
          <SectionHeading>{formatDate(selected)}</SectionHeading>
          {/* Two columns from lg. Five slots stacked full width meant a laptop
              showed two of them and the rest below the fold, which is the one
              thing a big screen should never do to a day. */}
          <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2.5 lg:items-start">
            {MEAL_SLOTS.map((slot) => (
              <SlotRow
                key={slot}
                slot={slot}
                day={selectedDay}
                onAdd={() => setAdding({ date: selected, slot })}
                onRemove={(mealId) => removeMealReturningPortions(selected, mealId)}
                onMove={(mealId) => setMoving({ date: selected, mealId })}
              />
            ))}
          </div>
        </section>

        {/* Week summary */}
        <section className="card-soft p-4 flex items-center gap-3 text-sm text-ink-700">
          <CalendarDays size={18} className="text-ink-500 shrink-0" />
          <span>
            A cosy{' '}
            <strong className="font-mono">
              {plannedDays ? Math.round(weekTotal.calories / plannedDays) : 0}
            </strong>{' '}
            kcal a day on average, across {plannedDays} planned {plannedDays === 1 ? 'day' : 'days'}
            {range === 'week' ? ' this week' : range === 'fortnight' ? ' in this fortnight' : ' this month'}.
          </span>
        </section>
      </div>

      {openAdd && (
        <AddEntryModal
          date={openAdd.date}
          slot={openAdd.slot}
          onClose={closeAdd}
          onAdd={(entry: Component) => addEntryTakingPortions(openAdd.date, openAdd.slot, entry)}
        />
      )}

      {filling && (
        <FillGaps
          dates={filling}
          onClose={() => setFilling(null)}
          onApply={applyProposals}
        />
      )}

      {moving && (
        <MoveMealDialog
          from={moving}
          dates={dates}
          onClose={() => setMoving(null)}
          onMove={(date, slot) => { moveMeal(moving.date, moving.mealId, date, slot); setMoving(null) }}
          onCopy={(date, slot) => { duplicateMeal(moving.date, moving.mealId, date, slot); setMoving(null) }}
        />
      )}

      {copyFrom && (
        <CopyDayDialog
          from={copyFrom}
          dates={dates}
          onClose={() => setCopyFrom(null)}
          onPick={(to) => { copyDay(copyFrom, to); setCopyFrom(null) }}
        />
      )}
    </div>
  )
}

function SlotRow({
  slot, day, onAdd, onRemove, onMove,
}: {
  slot: MealSlot
  day: DayPlan
  onAdd: () => void
  onRemove: (mealId: string) => void
  onMove: (mealId: string) => void
}) {
  const ctx = useNutritionContext()
  const meals = day.meals.filter((m) => m.slot === slot)
  const kcal = componentsNutrients(meals.flatMap((m) => m.entries), ctx).calories

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-500">{SLOT_LABELS[slot]}</span>
        <span className="text-xs font-mono text-ink-700">{kcal > 0 ? `${Math.round(kcal)} kcal` : ''}</span>
      </div>

      {meals.length === 0 ? (
        <button onClick={onAdd} className="meal-slot w-full text-sm text-ink-500 hover:text-bite-700">
          <Plus size={16} className="mr-1" /> Pop something in
        </button>
      ) : (
        <div className="space-y-1.5">
          {meals.map((meal) => (
            <div key={meal.id} className="flex items-start gap-2">
              <div className="flex-1 min-w-0 space-y-1">
                {meal.entries.map((entry, i) => (
                  <EntryLine key={i} entry={entry} />
                ))}
                {meal.note ? (
                  <div className="pt-0.5" title={meal.note}>
                    <SourceLine text={meal.note} clamp={2} />
                  </div>
                ) : null}
                <ShoppingState entries={meal.entries} />
              </div>
              <div className="flex shrink-0">
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
            className="inline-flex items-center min-h-11 px-1 -mx-1 text-xs font-semibold text-bite-700 hover:text-bite-800"
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
    <p className={`flex items-start gap-1.5 pt-1 text-xs ${ready ? 'text-teal-700' : 'text-ink-500'}`}>
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

function EntryLine({ entry }: { entry: Component }) {
  const ctx = useNutritionContext()
  const deleted = useDeletedIds()
  const kcal = componentsNutrients([entry], ctx).calories

  // A recipe you deleted still resolves here, so the day keeps its meal and its
  // calories. It is marked rather than hidden: the record is what happened, and
  // silently dropping it would rewrite it.
  const isDeleted = entry.kind === 'recipe' && deleted.has(entry.recipeId)

  // A portion says where it came from rather than what it is made of: the
  // useful fact when you are reading a plan is that this one is already cooked
  // and waiting, not that it is a lentil stew.
  const portion = entry.kind === 'portion' ? ctx.portions?.get(entry.portionId) : undefined
  const portionRecipe = portion?.recipeId ? ctx.recipes.get(portion.recipeId) : undefined

  const label = entry.kind === 'recipe'
    ? ctx.recipes.get(entry.recipeId)?.name.en ?? 'Unknown recipe'
    : entry.kind === 'portion'
      ? portionRecipe?.name.en ?? portion?.label ?? 'From the fridge'
      : ctx.foods.get(entry.foodId)?.names.en ?? 'Unknown food'

  const detail = entry.kind === 'food'
    ? `${Math.round(entry.grams)} g`
    : entry.servings === 1 ? '' : `${entry.servings}×`

  const emoji = entry.kind === 'recipe'
    ? ctx.recipes.get(entry.recipeId)?.emoji ?? '🍽️'
    : entry.kind === 'portion'
      ? (portion?.storage === 'freezer' ? '🧊' : '🥡')
      : '·'

  // The names are long, 46 characters at the median, 77 at the longest, and a
  // phone gives this row about 150px. Truncating turned most of them into
  // "Potatoes with egg, Teleme…", so the name wraps and the numbers hold their
  // own column instead. w-14 was two digits wider than four digits need.
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-base leading-none shrink-0">{emoji}</span>
      <span data-entry-name className={`flex-1 min-w-0 ${isDeleted ? 'text-ink-500' : 'text-ink-900'}`}>
        {label}
        {entry.kind === 'portion' && (
          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-teal-700">
            {portion?.storage === 'freezer' ? 'freezer' : 'fridge'}
          </span>
        )}
        {isDeleted && (
          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-500">
            deleted
          </span>
        )}
      </span>
      {detail ? <span className="text-xs text-ink-500 font-mono shrink-0 tabular-nums">{detail}</span> : null}
      <span className="text-xs text-ink-700 font-mono shrink-0 tabular-nums w-10 sm:w-14 text-right">
        {Math.round(kcal)}
      </span>
    </div>
  )
}

/**
 * Moving or copying one meal.
 *
 * Both live in one dialog because the choice you are making is the same, which
 * day and which slot, and only the last tap differs. Two separate flows would
 * mean picking a destination twice to find out you wanted the other one.
 */
function MoveMealDialog({
  from, dates, onClose, onMove, onCopy,
}: {
  from: { date: string; mealId: string }
  dates: string[]
  onClose: () => void
  onMove: (date: string, slot: MealSlot) => void
  onCopy: (date: string, slot: MealSlot) => void
}) {
  const plan = useMealPlanStore((s) => s.plan)
  const meal = plan.find((d) => d.date === from.date)?.meals.find((m) => m.id === from.mealId)
  const [date, setDate] = useState(from.date)
  const [slot, setSlot] = useState<MealSlot>(meal?.slot ?? 'lunch')

  if (!meal) return null
  const unchanged = date === from.date && slot === meal.slot

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-xs p-4" onClick={onClose}>
      <div
        className="bg-paper rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-ink-900 mb-1">Move or copy this meal</h3>
        <p className="text-sm text-ink-700 mb-4">Pick where it should go.</p>

        <label className="label" htmlFor="move-slot">Slot</label>
        <select
          id="move-slot"
          className="input mb-4"
          value={slot}
          onChange={(e) => setSlot(e.target.value as MealSlot)}
        >
          {MEAL_SLOTS.map((s) => (
            <option key={s} value={s}>{SLOT_LABELS[s]}</option>
          ))}
        </select>

        <p className="label">Day</p>
        <div className="space-y-1 mb-4">
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm ${
                d === date ? 'bg-bite-50 text-bite-700 font-semibold' : 'text-ink-900 hover:bg-cream-50'
              }`}
            >
              {formatDate(d)}{d === from.date ? ' (where it is now)' : ''}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={unchanged} onClick={() => onMove(date, slot)}>
            Move it
          </button>
          <button className="btn-secondary flex-1" onClick={() => onCopy(date, slot)}>
            Copy it
          </button>
        </div>
        <button className="btn-ghost w-full mt-2" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

function CopyDayDialog({
  from, dates, onClose, onPick,
}: {
  from: string
  dates: string[]
  onClose: () => void
  onPick: (to: string) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-xs p-4" onClick={onClose}>
      <div className="bg-paper rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-ink-900 mb-1">Copy {formatDate(from)}</h3>
        <p className="text-sm text-ink-700 mb-4">Pick the day to copy these meals into.</p>
        <div className="space-y-1">
          {dates.filter((d) => d !== from).map((d) => (
            <button key={d} onClick={() => onPick(d)}
              className="w-full text-left px-3 py-2 rounded-xl hover:bg-cream-50 text-sm text-ink-900">
              {formatDate(d)}
            </button>
          ))}
        </div>
        <button className="btn-secondary w-full mt-4" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

function todayOrFirst(dates: string[]): string {
  const today = new Date().toISOString().slice(0, 10)
  return dates.includes(today) ? today : dates[0]
}

function formatDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function formatRange(dates: string[]): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const first = new Date(dates[0] + 'T12:00:00').toLocaleDateString('en-GB', opts)
  const last = new Date(dates[dates.length - 1] + 'T12:00:00').toLocaleDateString('en-GB', opts)
  return `${first} to ${last}`
}

function formatMonth(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/**
 * One day in the grid.
 *
 * The same cell serves all three ranges. In a month it is tighter and the days
 * belonging to the months either side are drawn quieter, since they are real
 * days you can plan but not the ones you came to look at.
 */
function DayCell({
  date, kcal, selected, showWeekday, dim, onSelect,
}: {
  date: string
  kcal: number
  selected: boolean
  showWeekday: boolean
  dim: boolean
  onSelect: () => void
}) {
  const today = date === new Date().toISOString().slice(0, 10)
  const d = new Date(date + 'T12:00:00')

  return (
    <button
      onClick={onSelect}
      aria-label={formatDate(date)}
      aria-pressed={selected}
      className={`rounded-xl px-1 py-2.5 sm:p-3 min-h-14 text-center transition-all border ${
        selected
          ? 'bg-bite-500 text-white border-bite-500 shadow-xs'
          : 'bg-paper border-border-200 hover:border-bite-300 text-ink-900'
      } ${dim && !selected ? 'opacity-45' : ''}`}
    >
      {showWeekday && (
        <div className={`text-[11px] sm:text-xs font-semibold uppercase tracking-wide ${selected ? 'text-bite-100' : 'text-ink-500'}`}>
          {d.toLocaleDateString('en-GB', { weekday: 'short' })}
        </div>
      )}
      <div className={`text-base sm:text-lg font-bold leading-tight ${today && !selected ? 'text-bite-700' : ''}`}>
        {d.getDate()}
      </div>
      <div className={`text-[11px] sm:text-xs font-mono tabular-nums ${selected ? 'text-bite-100' : 'text-ink-500'}`}>
        {kcal > 0 ? Math.round(kcal) : ''}
      </div>
    </button>
  )
}
