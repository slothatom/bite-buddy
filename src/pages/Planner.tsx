import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Copy, Plus, Trash2, X, CalendarDays, MoveRight, Sparkles,
  Check, ShoppingBasket, Bookmark, Circle, CircleSlash, Minus,
} from 'lucide-react'
import type { Component, DayPlan, MealOutcome, MealSlot } from '../types'
import { MEAL_SLOTS, SLOT_LABELS } from '../types'
import {
  useMealPlanStore, getWeekDates, getRangeDates, monthOf, today,
  RANGE_LABELS, type PlanRange,
} from '../store/useMealPlanStore'
import { useDeletedIds } from '../store/useRecipeStore'
import { useUserStore } from '../store/useUserStore'
import { targetsFor } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import {
  componentsNutrients, dayEaten, dayProgress, dayLabel, weekEaten, emptyNutrients, addNutrients, reportDay,
} from '../lib/nutrition'
import { CalorieRing, NutrientSummary, SectionHeading, SourceLine } from '../components/ui'
import { useUiStore } from '../store/useUiStore'
import { PEOPLE } from '../lib/people'
import AddEntryModal from '../components/planner/AddEntryModal'
import { usePortionStore } from '../store/usePortionStore'
import { portionEntries } from '../lib/portionsUse'
import { usePantry } from '../store/usePantryStore'
import { mealAvailability } from '../lib/pantry'
import FillGaps from '../components/planner/FillGaps'
import WeekTemplates from '../components/planner/WeekTemplates'
import type { Proposal } from '../lib/autoPlan'
import { baseName } from '../lib/recipeGroups'
import { entriesName, entryName } from '../lib/entryLabel'
import { slotNow } from '../lib/whenDates'
import { useDialog } from '../lib/useDialog'
import WhenPicker from '../components/planner/WhenPicker'
import { offerUndo } from '../store/useUndo'

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
    moveMeal, duplicateMeal, setMealOutcome, updateEntry, restoreMeals,
  } = useMealPlanStore()
  const ctx = useNutritionContext()

  const [range, setRange] = useState<PlanRange>('week')
  /**
   * The day being looked at, derived rather than stored.
   *
   * Three things want a say: the centre button, which means today from
   * wherever it was pressed; a day you tapped; and failing both, today if it
   * is on screen. Holding that in state meant writing to it from an effect
   * every time the button arrived from another screen, which is a cascading
   * render and a lint error, and got the precedence wrong besides.
   */
  const [chosen, setChosen] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [copyFrom, setCopyFrom] = useState<string | null>(null)
  const [templating, setTemplating] = useState(false)
  const [amount, setAmount] = useState<{ mealId: string; index: number } | null>(null)
  const [clearing, setClearing] = useState(false)
  const [moving, setMoving] = useState<{ date: string; mealId: string } | null>(null)
  const [filling, setFilling] = useState<string[] | null>(null)
  const { quickAdd, clearQuickAdd, viewingAs, setViewingAs } = useUiStore()
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

    // Removing a meal had neither a confirmation nor a way back, and it is a
    // single tap next to the tick that says you ate it.
    if (meal) {
      offerUndo(`Removed ${entriesName(meal.entries, ctx)}`, () => {
        for (const p of portionEntries(meal.entries)) takeFrom(p.portionId, p.servings)
        restoreMeals(date, [meal])
      })
    }
  }

  /**
   * Changing how much of a portion you are having gives the rest back.
   *
   * The same bookkeeping as adding and removing: the tub knows how many
   * servings are left, and saying "actually I only had half" has to put the
   * other half back or the fridge slowly forgets food it still has.
   */
  const changeAmountKeepingPortions = (
    date: string, mealId: string, index: number, value: number,
  ) => {
    const entry = byDate.get(date)?.meals.find((m) => m.id === mealId)?.entries[index]
    if (entry?.kind === 'portion') {
      const difference = value - entry.servings
      if (difference > 0) takeFrom(entry.portionId, difference)
      else if (difference < 0) returnTo(entry.portionId, -difference)
    }
    updateEntry(date, mealId, index, value)
  }

  /** Everything the assistant offered and you kept, in one go. */
  const applyProposals = (proposals: Proposal[]) => {
    for (const p of proposals) addEntryTakingPortions(p.date, p.slot, p.entry)
    setFilling(null)
  }

  const clearDayReturningPortions = (date: string) => {
    const day = byDate.get(date)
    const meals = day?.meals ?? []
    for (const meal of meals) {
      for (const p of portionEntries(meal.entries)) returnTo(p.portionId, p.servings)
    }
    clearDay(date)

    if (meals.length) {
      offerUndo(`Cleared ${meals.length} ${meals.length === 1 ? 'meal' : 'meals'} off ${formatDate(date)}`, () => {
        for (const meal of meals) {
          for (const p of portionEntries(meal.entries)) takeFrom(p.portionId, p.servings)
        }
        restoreMeals(date, meals)
      })
    }
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

  // The button first, then whatever you tapped, then today if it is on screen.
  const selected = quickAdd
    ?? (chosen && dates.includes(chosen) ? chosen : null)
    ?? todayOrFirst(dates)
  const selectedDay = byDate.get(selected) ?? { date: selected, meals: [] }
  // Once anything on the day has been ticked this is a record rather than an
  // intention, and the ring says which. A ring built on the plan looked like a
  // tracker and was really a sum of things nobody had confirmed eating.
  const { nutrients: selectedTotals } = dayEaten(selectedDay, ctx)
  // Empty, all still ahead of you, part way through, or done. The badge used
  // to have two states for four situations and was wrong in two of them.
  const progress = dayProgress(selectedDay)
  // What the day's figures do not know. The planner totalled with a function
  // that discards it, so a day of foods with no sodium figure between them
  // still showed a salt total as though it were one.
  const dayReport = reportDay(selectedDay, ctx)
  // Whose target the day is measured against. The plan is shared, the line
  // it is compared to is not.
  const targets = targetsFor(profile, viewingAs)

  // Totals are for what you are looking at, not for everything ever planned.
  //
  // And for what those days came to rather than what was hoped for them: the
  // ring below this was already reporting the ticks while the range average
  // above it summed the plan, so the two disagreed about the same week.
  /**
   * The days the header is actually about.
   *
   * The month grid is padded out to whole weeks and shows the neighbours
   * greyed, which is right: a Monday that belongs to July is still the Monday
   * before this one. But the count underneath "AUGUST 2026" read "1 of 42 days
   * planned", claiming five days of July and six of September as August's.
   */
  const counted = useMemo(
    () => (range === 'month' ? dates.filter((d) => monthOf(d) === anchorMonth) : dates),
    [dates, range, anchorMonth],
  )

  const shownDays = useMemo(
    () => counted.map((date) => byDate.get(date)).filter((d): d is DayPlan => Boolean(d)),
    [counted, byDate],
  )
  const reading = useMemo(() => weekEaten(dates, plan, ctx), [dates, plan, ctx])
  const kcalByDate = useMemo(
    () => new Map(reading.days.map((d) => [d.date, d.nutrients.calories])),
    [reading],
  )
  const weekTotal = useMemo(
    () => reading.days.reduce((acc, d) => addNutrients(acc, d.nutrients), emptyNutrients()),
    [reading],
  )
  const plannedDays = shownDays.filter((d) => d.meals.length).length

  // The bottom bar's centre button lands here. Rather than syncing that intent
  // into local state from an effect, which costs a second render, the open
  // modal is derived from either source.
  // The centre button says which day it meant, which is today. Falling back to
  // whatever this screen had selected is how it used to offer Monday the 17th.
  const quickDay = quickAdd ?? selected
  const quickMeals = byDate.get(quickDay)?.meals ?? []
  const filledSlots = new Set(quickMeals.map((m) => m.slot))
  const openAdd = adding ?? (quickAdd
    // The clock rather than the first free slot. "The first slot with nothing
    // in it" is breakfast on an empty day whatever the hour, which is how the
    // centre button came to always say Breakfast.
    ? { date: quickDay, slot: filledSlots.has(slotNow()) ? MEAL_SLOTS.find((s) => !filledSlots.has(s)) ?? slotNow() : slotNow() }
    : null)

  /**
   * Follow the day the centre button meant, and bring the week with it.
   *
   * Two halves, and the second was missed first time round. Selecting the day
   * is not enough: if you had stepped the planner back a week, the modal opened
   * on today while the grid still showed a week today was not in, so the meal
   * you added appeared nowhere on screen. The button says today, so the screen
   * has to be showing today.
   */
  /**
   * Bring the week to the day the button meant.
   *
   * Selecting it is not enough: stepped back a week, the modal opened on today
   * while the grid showed a week today was not in, so the meal you added
   * appeared nowhere. Moving the window is a write to the store rather than to
   * this component, so it belongs in an effect and the selection does not.
   */
  useEffect(() => {
    if (quickAdd && !dates.includes(quickAdd)) {
      goToWeek(new Date(quickAdd + 'T12:00:00'), profile.weekStartsOn)
    }
  }, [quickAdd, dates, goToWeek, profile.weekStartsOn])

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
    setChosen(getRangeDates(
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
              {formatRange(dates)} · {plannedDays} of {counted.length} days planned
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button className="btn-secondary btn-icon" onClick={() => shift(-1)} aria-label={`Previous ${range}`}>
              <ChevronLeft size={18} />
            </button>
            <button
              className="btn-secondary"
              onClick={() => { goToWeek(new Date(), profile.weekStartsOn); setChosen(today()) }}
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
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Week scoped, so it sits with the range rather than in the day
              toolbar below, which acts on the day you have selected. */}
          <button className="btn-secondary" onClick={() => setTemplating(true)}>
            <Bookmark size={15} /> Saved weeks
          </button>

          {/* Whose target the totals are measured against. The plan is one
              plan; the line across it is personal, and it lives here rather
              than buried in Settings because this is where you notice it is
              the wrong one. */}
          <div className="flex gap-1 p-1 bg-cream-50 rounded-xl ml-auto" role="tablist">
            {PEOPLE.map((person) => (
              <button
                key={person.id}
                role="tab"
                aria-selected={viewingAs === person.id}
                aria-label={`Show totals against ${person.name}'s target`}
                onClick={() => setViewingAs(person.id)}
                className={viewingAs === person.id ? 'tab-on' : 'tab-off'}
              >
                {person.name}
              </button>
            ))}
          </div>
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
                kcal={kcalByDate.get(date) ?? 0}
                selected={date === selected}
                showWeekday={dates.length <= 7}
                dim={range === 'month' && monthOf(date) !== anchorMonth}
                onSelect={() => setChosen(date)}
              />
            ))}
          </div>
        </div>

        {/* Day totals */}
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
              clearing ? (
                <>
                  {/* The count is on the button, where the thumb already is,
                      rather than in a sentence above it. */}
                  <button
                    className="btn-primary"
                    onClick={() => { clearDayReturningPortions(selected); setClearing(false) }}
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
              <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-ink-500">
                {dayLabel(progress)}
              </span>
            )}
          </SectionHeading>
          {/* Two columns from lg. Five slots stacked full width meant a laptop
              showed two of them and the rest below the fold, which is the one
              thing a big screen should never do to a day. */}
          <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-2 lg:items-start">
            {MEAL_SLOTS.map((slot) => (
              <SlotRow
                key={slot}
                slot={slot}
                day={selectedDay}
                onAdd={() => setAdding({ date: selected, slot })}
                onRemove={(mealId) => removeMealReturningPortions(selected, mealId)}
                onMove={(mealId) => setMoving({ date: selected, mealId })}
                onOutcome={(mealId, outcome) => setMealOutcome(selected, mealId, outcome)}
                onAmount={(mealId, index) => setAmount({ mealId, index })}
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
          onSlotChange={(slot) => setAdding({ date: openAdd.date, slot })}
          onDateChange={(date) => setAdding({ date, slot: openAdd.slot })}
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
          onClose={() => setMoving(null)}
          onMove={(date, slot) => { moveMeal(moving.date, moving.mealId, date, slot); setMoving(null) }}
          onCopy={(date, slot) => { duplicateMeal(moving.date, moving.mealId, date, slot); setMoving(null) }}
        />
      )}

      {templating && (
        <WeekTemplates weekDates={weekDates} onClose={() => setTemplating(false)} />
      )}

      {amount && (
        <AmountDialog
          day={selectedDay}
          mealId={amount.mealId}
          index={amount.index}
          onClose={() => setAmount(null)}
          onSet={(value) => {
            changeAmountKeepingPortions(selected, amount.mealId, amount.index, value)
            setAmount(null)
          }}
        />
      )}

      {copyFrom && (
        <CopyDayDialog
          from={copyFrom}
          onClose={() => setCopyFrom(null)}
          onPick={(to) => { copyDay(copyFrom, to); setCopyFrom(null) }}
        />
      )}
    </div>
  )
}

function SlotRow({
  slot, day, onAdd, onRemove, onMove, onOutcome, onAmount,
}: {
  slot: MealSlot
  day: DayPlan
  onAdd: () => void
  onRemove: (mealId: string) => void
  onMove: (mealId: string) => void
  onOutcome: (mealId: string, outcome: MealOutcome | undefined) => void
  onAmount: (mealId: string, index: number) => void
}) {
  const ctx = useNutritionContext()
  const meals = day.meals.filter((m) => m.slot === slot)
  const kcal = componentsNutrients(meals.flatMap((m) => m.entries), ctx).calories

  return (
    <div className="card p-4">
      {/* Tight, because a tick and an amount now live on every meal and a day
          still has to fit on a laptop without scrolling. */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-500">{SLOT_LABELS[slot]}</span>
        <span className="text-xs font-mono text-ink-700">{kcal > 0 ? `${Math.round(kcal)} kcal` : ''}</span>
      </div>

      {meals.length === 0 ? (
        <button onClick={onAdd} className="meal-slot w-full text-sm text-ink-500 hover:text-bite-700">
          <Plus size={16} className="mr-1" /> Pop something in
        </button>
      ) : (
        <div className="space-y-1">
          {meals.map((meal) => (
            <div key={meal.id} className="flex items-start gap-2">
              <OutcomeTick
                outcome={meal.outcome}
                onChange={(next) => onOutcome(meal.id, next)}
              />
              <div className={`flex-1 min-w-0 space-y-1 ${meal.outcome === 'skipped' ? 'opacity-55' : ''}`}>
                {meal.entries.map((entry, i) => (
                  <EntryLine
                    key={i}
                    entry={entry}
                    struck={meal.outcome === 'skipped'}
                    onAmount={() => onAmount(meal.id, i)}
                  />
                ))}
                {meal.note ? (
                  <div className="pt-0.5" title={meal.note}>
                    <SourceLine text={meal.note} clamp={2} translate />
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
  outcome, onChange,
}: {
  outcome: MealOutcome | undefined
  onChange: (next: MealOutcome | undefined) => void
}) {
  const next: MealOutcome | undefined =
    outcome === undefined ? 'eaten' : outcome === 'eaten' ? 'skipped' : undefined

  const label = outcome === undefined ? 'Mark as eaten'
    : outcome === 'eaten' ? 'Eaten. Mark as skipped instead'
      : 'Skipped. Clear it'

  return (
    <button
      className={`btn-ghost btn-icon shrink-0 ${
        outcome === 'eaten' ? 'text-teal-700'
          : outcome === 'skipped' ? 'text-ink-500' : 'text-ink-300 hover:text-teal-700'
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

/**
 * How much of it there was.
 *
 * Grams for a food, servings for anything already made. The steps are the ones
 * people actually eat in, halves and quarters of a portion, rather than a free
 * number field that invites 0.37 of a stew.
 */
function AmountDialog({
  day, mealId, index, onClose, onSet,
}: {
  day: DayPlan
  mealId: string
  index: number
  onClose: () => void
  onSet: (value: number) => void
}) {
  const ctx = useNutritionContext()
  const panel = useDialog<HTMLDivElement>(onClose)
  const entry = day.meals.find((m) => m.id === mealId)?.entries[index]

  const current = entry ? (entry.kind === 'food' ? entry.grams : entry.servings) : 0
  const [value, setValue] = useState(current)

  if (!entry) return null

  const isFood = entry.kind === 'food'
  const step = isFood ? 10 : 0.25
  const label = isFood
    ? ctx.foods.get(entry.foodId)?.names.en ?? 'This ingredient'
    : entry.kind === 'recipe'
      ? ctx.recipes.get(entry.recipeId)?.name.en ?? 'This dish'
      : 'This portion'

  /**
   * What the number is allowed to be.
   *
   * It ran from zero to nothing at all, so the stepper would happily write a
   * meal of 0 g, which is a meal that is not one, or 40 servings of stew, which
   * is a slip of a thumb on a button that repeats.
   *
   * The floor is one step, because taking a line down to nothing means
   * removing it and there is a bin for that. The ceiling is only a real
   * constraint in one of the three cases: a tub in the fridge holds what it
   * holds, and this entry has already taken some of it, so the most you can
   * have is what is left plus what you took. The other two are round numbers
   * chosen to stop a runaway, not to have an opinion about your dinner.
   */
  const inTheTub = entry.kind === 'portion'
    ? round2((ctx.portions?.get(entry.portionId)?.servings ?? 0) + entry.servings)
    : null
  const most = isFood ? 3000 : inTheTub ?? 20
  const capped = inTheTub !== null && value >= inTheTub

  const shown = isFood
    ? `${Math.round(value)} g`
    : `${value === Math.round(value) ? value : value.toFixed(2).replace(/0+$/, '')} ${
      value === 1 ? 'serving' : 'servings'}`

  const kcal = componentsNutrients(
    [isFood ? { ...entry, grams: value } : { ...entry, servings: value }],
    ctx,
  ).calories

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panel}
        aria-modal="true"
        className="bg-paper rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`How much ${label}`}
      >
        <h3 className="font-bold text-ink-900 mb-1">{label}</h3>
        <p className="text-sm text-ink-700 mb-4">
          {isFood ? 'How much of it, in grams.' : 'How much of it you are having.'}
        </p>

        <div className="flex items-center justify-center gap-4 mb-5">
          <button
            className="btn-secondary btn-icon"
            onClick={() => setValue((v) => Math.max(step, round2(v - step)))}
            disabled={value <= step}
            aria-label="Less"
          >
            <Minus size={18} />
          </button>
          <div className="text-center min-w-28">
            <div className="text-2xl font-bold text-ink-900 tabular-nums">{shown}</div>
            <div className="text-xs text-ink-500 font-mono">
              {kcal > 0 ? `${Math.round(kcal)} kcal` : ' '}
            </div>
          </div>
          <button
            className="btn-secondary btn-icon"
            onClick={() => setValue((v) => Math.min(most, round2(v + step)))}
            disabled={value >= most}
            aria-label="More"
          >
            <Plus size={18} />
          </button>
        </div>

        {capped && (
          <p className="text-xs text-ink-500 text-center mb-4 -mt-2">
            That is everything left in the tub.
          </p>
        )}

        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={() => onSet(value)}>Save</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

/**
 * A meal's name, as a link when there is something behind it.
 *
 * Two renderings rather than a link with no destination, because an anchor
 * with no href is not a link to a screen reader or to a keyboard and reads as
 * one to everybody else.
 */
function Name({
  to, title, className, children,
}: {
  to?: string
  title?: string
  className: string
  children: ReactNode
}) {
  if (!to) {
    return <span title={title} data-entry-name className={className}>{children}</span>
  }
  return (
    <Link to={to} title={title} data-entry-name className={className}>
      {children}
    </Link>
  )
}

/** Two decimals, which is as fine as a quarter portion or a gram ever needs. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function EntryLine({
  entry, struck = false, onAmount,
}: {
  entry: Component
  struck?: boolean
  onAmount?: () => void
}) {
  const ctx = useNutritionContext()
  const deleted = useDeletedIds()
  const kcal = componentsNutrients([entry], ctx).calories

  // A recipe you deleted still resolves here, so the day keeps its meal and its
  // calories. It is marked rather than hidden: the record is what happened, and
  // silently dropping it would rewrite it.
  const isDeleted = entry.kind === 'recipe' && deleted.has(entry.recipeId)

  // Which tub it is, for the emoji and the fridge-or-freezer tag. The name
  // itself comes from the shared helper, which already knows that a portion
  // says where it came from rather than what it is made of.
  const portion = entry.kind === 'portion' ? ctx.portions?.get(entry.portionId) : undefined

  // A portion points at one too: the tub is a batch of something, and what
  // went into it is the same question.
  const opensId = entry.kind === 'recipe'
    ? entry.recipeId
    : entry.kind === 'portion' ? portion?.recipeId : undefined
  const opensTo = opensId && ctx.recipes.has(opensId)
    ? `/recipes?recipe=${encodeURIComponent(opensId)}`
    : undefined

  const full = entryName(entry, ctx)

  // Without the portion in brackets. A library name has to stand alone, so
  // "Eggplant spread with wholemeal bread & mixed vegetables (50 g wholemeal
  // bread)" is right on a card you might meet cold. Here the ingredients are
  // written out directly underneath, weights and all, so the bracket is saying
  // it twice, and saying it in the one place where a second line costs a slot
  // its place on the screen.
  const label = baseName(full)

  const detail = entry.kind === 'food'
    ? `${Math.round(entry.grams)} g`
    : entry.servings === 1 ? '' : `${entry.servings}×`

  const emoji = entry.kind === 'recipe'
    ? ctx.recipes.get(entry.recipeId)?.emoji ?? '🍽️'
    : entry.kind === 'portion'
      ? (portion?.storage === 'freezer' ? '🧊' : '🥡')
      : '·'

  // The names are long, 46 characters at the median, 77 at the longest, and in
  // a three-column day on a laptop this row gets about 320px, which the tick,
  // the two meal buttons, the amount and the calories take 250 of. The name
  // was left with 70px and broke one word per line: "Eggplant / spread / with
  // / wholemeal / bread & / mixed / vegetables", seven lines for one meal,
  // which pushed Snack 2 and Dinner off the bottom of a 950px laptop.
  //
  // So the row wraps instead, and the two numbers travel together. The name
  // takes its natural width and will not be squeezed below 7rem, so a short
  // one keeps the numbers beside it and a long one sends them to a second
  // line rather than shrinking to nothing. Two lines at worst, one whenever
  // the column is wide enough, which is what a phone gives it.
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
      {/* Emoji and name in one box, so the name wraps underneath its own first
          line rather than underneath the emoji. */}
      <span className="flex-auto min-w-28 flex items-baseline gap-2">
      <span className="text-base leading-none shrink-0">{emoji}</span>
      {/* Through to the recipe, which the planner could not do at all. You
          read "Cabbage soup with wholemeal bread" on Tuesday, wondered what
          went in it, and had to go to Recipes and search for it by name. Only
          the ones that are a recipe: a weighed food has no page to open, and
          a link that sometimes goes nowhere is worse than no link. */}
      <Name
        to={opensTo}
        title={full === label ? undefined : full}
        className={`min-w-0 ${isDeleted ? 'text-ink-500' : 'text-ink-900'} ${
          struck ? 'line-through' : ''} ${opensTo ? 'hover:text-bite-700 hover:underline' : ''}`}
      >
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
      </Name>
      </span>
      {/* The amount is the control. Tapping the line's name would fight with
          reading it, and a separate button would be a fourth thing in a row
          that already has three. Kept in one box with the calories so the two
          numbers wrap as a pair instead of stacking one above the other. */}
      <span className="flex items-baseline gap-2 shrink-0 ml-auto">
      <button
        // A thumb-sized hit area that costs no height: the padding makes the
        // box, the negative margin gives the space back to the layout. Sized
        // to fill it instead pushed the fifth slot of a day below the fold.
        className="text-xs text-ink-500 font-mono shrink-0 tabular-nums min-w-11 px-1 py-3 -my-3
                   hover:text-bite-700 underline decoration-dotted underline-offset-4"
        onClick={onAmount}
        aria-label={`Change how much: ${label}`}
      >
        {detail || (entry.kind === 'food' ? '0 g' : '1×')}
      </button>
      <span className="text-xs text-ink-700 font-mono shrink-0 tabular-nums w-10 sm:w-14 text-right">
        {Math.round(kcal)}
      </span>
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
  from, onClose, onMove, onCopy,
}: {
  from: { date: string; mealId: string }
  onClose: () => void
  onMove: (date: string, slot: MealSlot) => void
  onCopy: (date: string, slot: MealSlot) => void
}) {
  const plan = useMealPlanStore((s) => s.plan)
  const panel = useDialog<HTMLDivElement>(onClose)
  const meal = plan.find((d) => d.date === from.date)?.meals.find((m) => m.id === from.mealId)
  const [date, setDate] = useState(from.date)
  const [slot, setSlot] = useState<MealSlot>(meal?.slot ?? 'lunch')
  const busy = useMemo(
    () => new Set(plan.filter((d) => d.meals.length).map((d) => d.date)),
    [plan],
  )

  if (!meal) return null
  const unchanged = date === from.date && slot === meal.slot

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-xs p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Move or copy this meal"
        className="bg-paper rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-ink-900 mb-1">Move or copy this meal</h3>
        <p className="text-sm text-ink-700 mb-4">Pick where it should go.</p>

        <div className="mb-5">
          <WhenPicker date={date} onDate={setDate} slot={slot} onSlot={setSlot} busy={busy} />
        </div>

        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={unchanged} onClick={() => onMove(date, slot)}>
            Move it
          </button>
          {/* Disabled for the source slot too. It used to stay enabled there,
              and tapping it appended a second identical copy to the same slot
              with nothing said: Snack 1 went from 294 to 588 kcal. */}
          <button className="btn-secondary flex-1" disabled={unchanged} onClick={() => onCopy(date, slot)}>
            Copy it
          </button>
        </div>
        <button className="btn-ghost w-full mt-2" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

/**
 * Copying a whole day onto another one.
 *
 * The same picker as everything else, without the slot, because a day carries
 * its own slots with it. It used to be a list of every date in the range, one
 * per row, which in month view was 42 rows of 1,452 px inside a 1,110 px
 * overlay: the heading was off the top and Cancel was off the bottom, with no
 * way to scroll to either.
 */
function CopyDayDialog({
  from, onClose, onPick,
}: {
  from: string
  onClose: () => void
  onPick: (to: string) => void
}) {
  const plan = useMealPlanStore((s) => s.plan)
  const busy = useMemo(
    () => new Set(plan.filter((d) => d.meals.length).map((d) => d.date)),
    [plan],
  )
  const panel = useDialog<HTMLDivElement>(onClose)
  const [to, setTo] = useState<string | null>(null)

  // What it would land on, said before it lands. Copying onto a day that
  // already has meals is a legitimate thing to want and a horrible surprise.
  const onto = to ? plan.find((d) => d.date === to)?.meals.length ?? 0 : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-xs p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Copy a day"
        className="bg-paper rounded-2xl p-5 w-full max-w-sm shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-ink-900 mb-1">Copy {formatDate(from)}</h3>
        <p className="text-sm text-ink-700 mb-4">Pick the day to copy these meals into.</p>

        <WhenPicker
          date={to ?? from}
          onDate={setTo}
          busy={busy}
          disabled={(d) => d === from}
        />

        {onto > 0 && (
          <p className="text-sm text-coral-700 mt-4">
            That day already has {onto} {onto === 1 ? 'meal' : 'meals'} on it, and they would be
            replaced.
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button
            className="btn-primary flex-1"
            disabled={!to}
            onClick={() => to && onPick(to)}
          >
            Copy it there
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function todayOrFirst(dates: string[]): string {
  const now = today()
  return dates.includes(now) ? now : dates[0]
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
  const isToday = date === today()
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
      <div className={`text-base sm:text-lg font-bold leading-tight ${isToday && !selected ? 'text-bite-700' : ''}`}>
        {d.getDate()}
      </div>
      <div className={`text-[11px] sm:text-xs font-mono tabular-nums ${selected ? 'text-bite-100' : 'text-ink-500'}`}>
        {kcal > 0 ? Math.round(kcal) : ''}
      </div>
    </button>
  )
}
