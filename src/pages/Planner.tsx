import { useEffect, useMemo, useState } from 'react'
import type { Component, DayPlan, MealSlot } from '../types'
import { MEAL_SLOTS } from '../types'
import {
  useMealPlanStore, getWeekDates, getRangeDates, addDays, today,
  type PlanRange,
} from '../store/useMealPlanStore'
import { useUserStore } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import { weekEaten, emptyNutrients, addNutrients } from '../lib/nutrition'
import { useUiStore } from '../store/useUiStore'
import AddEntryModal from '../components/planner/AddEntryModal'
import FillGaps from '../components/planner/FillGaps'
import WeekTemplates from '../components/planner/WeekTemplates'
import type { Proposal } from '../lib/autoPlan'
import { slotNow } from '../lib/whenDates'
import { todayOrFirst } from '../lib/planner/format'
import { WeekGrid } from '../components/planner/WeekGrid'
import { MealSheet } from '../components/planner/MealSheet'
import { AmountDialog } from '../components/planner/AmountDialog'
import { MoveMealDialog } from '../components/planner/MoveMealDialog'
import { CopyDayDialog } from '../components/planner/CopyDayDialog'
import { DayView } from '../components/planner/DayView'
import { PlannerHeader } from '../components/planner/PlannerHeader'
import { WeekSummary } from '../components/planner/WeekSummary'
import { usePlanActions } from '../components/planner/usePlanActions'

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
    weekDates, plan, goToWeek, copyDay, moveMeal, duplicateMeal, setMealOutcome, setEntryOutcome,
  } = useMealPlanStore()
  const ctx = useNutritionContext()

  /*
   * The day, not the week.
   *
   * The week grid is the better view for planning and the wrong one for the
   * thing this screen is opened for most: what am I eating now, and what have
   * I had so far. That answer only exists in the day view, and it was two taps
   * away every single time. Planning a week is deliberate and can afford a
   * tap; checking off a snack cannot.
   */
  const [range, setRange] = useState<PlanRange>('day')
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
  // Carries its date, because a meal can now be opened from any day in the
  // grid rather than only from the one the day view had selected.
  const [amount, setAmount] = useState<{ date: string; mealId: string; index: number } | null>(null)
  const [clearing, setClearing] = useState(false)
  /** The one day showing full meal names in the grid, if any. */
  const [expandedDay, setExpandedDay] = useState<string | null>(null)
  /** The meal opened from the grid, edited over the week rather than in it. */
  const [sheet, setSheet] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [moving, setMoving] = useState<{ date: string; mealId: string; index?: number } | null>(null)
  const [filling, setFilling] = useState<string[] | null>(null)
  const { quickAdd, clearQuickAdd } = useUiStore()

  const byDate = useMemo(() => new Map(plan.map((d) => [d.date, d])), [plan])

  const {
    addEntryTakingPortions, removeMealReturningPortions, removeEntryReturningPortions,
    moveEntryToSlot, changeAmountKeepingPortions, clearDayReturningPortions,
  } = usePlanActions()

  /** Everything the assistant offered and you kept, in one go. */
  const applyProposals = (proposals: Proposal[]) => {
    for (const p of proposals) addEntryTakingPortions(p.date, p.slot, p.entry)
    setFilling(null)
  }

  /**
   * The days on screen. A week, a fortnight, or the calendar month padded out
   * to whole weeks.
   */
  /*
   * The window you are stepping through, and the days actually drawn.
   *
   * They are the same thing for a week and a fortnight. A day view still moves
   * through weeks underneath, because the arrows and "Today" have to land
   * somewhere and a week is the thing the rest of the app is arranged around;
   * only what is drawn narrows to one date.
   */
  const windowRange: PlanRange = range === 'day' ? 'week' : range
  /*
   * Named after the window, not the view. The summary underneath a day still
   * sums the week the day sits in, and keying its wording off the view meant
   * that opening on the day view called that week "this fortnight".
   */
  const spanPhrase = windowRange === 'week' ? 'this week' : 'in this fortnight'
  const windowDates = useMemo(
    () => getRangeDates(weekDates[0], windowRange),
    [weekDates, windowRange],
  )

  // The button first, then whatever you tapped, then today if it is on screen.
  const selected = quickAdd
    ?? (chosen && windowDates.includes(chosen) ? chosen : null)
    ?? todayOrFirst(windowDates)

  const dates = useMemo(
    () => (range === 'day' ? [selected] : windowDates),
    [range, selected, windowDates],
  )
  const selectedDay = byDate.get(selected) ?? { date: selected, meals: [] }
  // Whose target the day is measured against. The plan is shared, the line
  // it is compared to is not.
  /*
   * One plan, one line across it.
   *
   * There is one plan because a household cooks once and eats the same food,
   * which is the premise the whole app rests on, so a control here asking
   * which person this week is for was asking you to pick a human being for a
   * thing that has none. Home, Progress and Body still ask, because there the
   * question really is about a person.
   *
   * The household's target, not whichever person some other screen was last
   * looking at: inheriting that would leave the same week measured against a
   * different line depending on where you had been, which is the visible
   * toggle's fault without the visibility.
   */
  const targets = profile.targets

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
  /*
   * The window, not the view.
   *
   * "31 Aug to 6 Sept, 7 of 7 days planned" is a fact about the week you are
   * standing in, and it stays true and useful while you look at one day of it.
   * Narrowing it to "1 of 1" would be arithmetic about the thing you are
   * already looking at.
   */
  const counted = windowDates

  const shownDays = useMemo(
    () => counted.map((date) => byDate.get(date)).filter((d): d is DayPlan => Boolean(d)),
    [counted, byDate],
  )
  const reading = useMemo(() => weekEaten(windowDates, plan, ctx), [windowDates, plan, ctx])
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
    if (quickAdd && !windowDates.includes(quickAdd)) {
      goToWeek(new Date(quickAdd + 'T12:00:00'), profile.weekStartsOn)
    }
  }, [quickAdd, windowDates, goToWeek, profile.weekStartsOn])

  function closeAdd() {
    setAdding(null)
    clearQuickAdd()
  }

  /**
   * Steps by whatever you are looking at.
   *
   * A day at a time in the day view, which is the only reading of an arrow
   * there: stepping a whole week from a screen showing Tuesday would land you
   * on a Tuesday you did not ask for. The week comes along when the new day
   * falls outside it.
   */
  function shift(direction: -1 | 1) {
    if (range === 'day') {
      const next = addDays(selected, direction)
      setChosen(next)
      if (!windowDates.includes(next)) goToWeek(new Date(next + 'T12:00:00'), profile.weekStartsOn)
      return
    }

    const ref = new Date(weekDates[0] + 'T12:00:00')
    ref.setDate(ref.getDate() + direction * (range === 'fortnight' ? 14 : 7))

    goToWeek(ref, profile.weekStartsOn)
    setChosen(getRangeDates(getWeekDates(ref, profile.weekStartsOn)[0], range)[0])
  }

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <PlannerHeader
          windowDates={windowDates}
          plannedDays={plannedDays}
          dayCount={counted.length}
          range={range}
          onShift={shift}
          onToday={() => { goToWeek(new Date(), profile.weekStartsOn); setChosen(today()) }}
          onRange={setRange}
          onSavedWeeks={() => setTemplating(true)}
          onFill={() => setFilling(dates)}
        />

        {/* Every meal in the range, or the one day in detail. The week view
            used to be seven cells holding a calorie number, with a single
            day's food underneath, so it never actually showed a week. */}
        {range !== 'day' && (
          <WeekGrid
            dates={dates}
            byDate={byDate}
            kcalByDate={kcalByDate}
            selected={selected}
            expanded={expandedDay}
            onExpand={setExpandedDay}
            onOpenDay={(date) => { setChosen(date); setRange('day') }}
            onOpenSlot={(date, slot) => setSheet({ date, slot })}
            onAddTo={(date, slot) => setAdding({ date, slot })}
          />
        )}

        {/* The day in detail, only in the day view. In a week view it was the
            whole content of the screen and the reason a week was never on it. */}
        {range === 'day' && (
          <DayView
            date={selected}
            day={selectedDay}
            targets={targets}
            clearing={clearing}
            setClearing={setClearing}
            onFill={() => setFilling(dates)}
            onCopy={() => setCopyFrom(selected)}
            onClear={() => clearDayReturningPortions(selected)}
            onAdd={(slot) => setAdding({ date: selected, slot })}
            onRemove={(mealId) => removeMealReturningPortions(selected, mealId)}
            onMove={(mealId) => setMoving({ date: selected, mealId })}
            onOutcome={(mealId, outcome) => setMealOutcome(selected, mealId, outcome)}
            onEntryOutcome={(mealId, i, outcome) => setEntryOutcome(selected, mealId, i, outcome)}
            onAmount={(mealId, index) => setAmount({ date: selected, mealId, index })}
            onRemoveEntry={(mealId, index) => removeEntryReturningPortions(selected, mealId, index)}
            onMoveEntry={(mealId, index) => setMoving({ date: selected, mealId, index })}
          />
        )}

        {/* Week summary */}
        <WeekSummary plannedDays={plannedDays} weekTotal={weekTotal} spanPhrase={spanPhrase} />
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
          onMove={(date, slot) => {
            if (moving.index === undefined) moveMeal(moving.date, moving.mealId, date, slot)
            else moveEntryToSlot(moving.date, moving.mealId, moving.index, date, slot)
            setMoving(null)
          }}
          onCopy={moving.index === undefined
            ? (date, slot) => { duplicateMeal(moving.date, moving.mealId, date, slot); setMoving(null) }
            : undefined}
        />
      )}

      {templating && (
        <WeekTemplates weekDates={weekDates} onClose={() => setTemplating(false)} />
      )}

      {amount && (
        <AmountDialog
          day={byDate.get(amount.date) ?? { date: amount.date, meals: [] }}
          mealId={amount.mealId}
          index={amount.index}
          onClose={() => setAmount(null)}
          onSet={(value) => {
            changeAmountKeepingPortions(amount.date, amount.mealId, amount.index, value)
            setAmount(null)
          }}
        />
      )}

      {sheet && (
        <MealSheet
          date={sheet.date}
          slot={sheet.slot}
          day={byDate.get(sheet.date) ?? { date: sheet.date, meals: [] }}
          onClose={() => setSheet(null)}
          onAdd={() => { setAdding({ date: sheet.date, slot: sheet.slot }); setSheet(null) }}
          onRemove={(mealId) => removeMealReturningPortions(sheet.date, mealId)}
          onMove={(mealId) => { setMoving({ date: sheet.date, mealId }); setSheet(null) }}
          onOutcome={(mealId, outcome) => setMealOutcome(sheet.date, mealId, outcome)}
          onEntryOutcome={(mealId, i, outcome) => setEntryOutcome(sheet.date, mealId, i, outcome)}
          onAmount={(mealId, index) => { setAmount({ date: sheet.date, mealId, index }); setSheet(null) }}
          onRemoveEntry={(mealId, index) =>
            removeEntryReturningPortions(sheet.date, mealId, index)}
          onMoveEntry={(mealId, index) => {
            setMoving({ date: sheet.date, mealId, index }); setSheet(null)
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
