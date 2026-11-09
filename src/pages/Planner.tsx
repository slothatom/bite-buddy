import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles, Bookmark, X } from 'lucide-react'
import type { Component, DayPlan, MealSlot } from '../types'
import { MEAL_SLOTS } from '../types'
import {
  useMealPlanStore, getWeekDates, getRangeDates, addDays, today, RANGE_LABELS,
  type PlanRange,
} from '../store/useMealPlanStore'
import { useUserStore } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import { weekEaten, emptyNutrients, addNutrients } from '../lib/nutrition'
import { useUiStore } from '../store/useUiStore'
import { useMediaQuery } from '../lib/useMediaQuery'
import { useDialog } from '../lib/useDialog'
import AddEntryModal from '../components/planner/AddEntryModal'
import FillGaps from '../components/planner/FillGaps'
import WeekTemplates from '../components/planner/WeekTemplates'
import type { Proposal } from '../lib/autoPlan'
import { slotNow } from '../lib/whenDates'
import { formatSpan, todayOrFirst } from '../lib/planner/format'
import { WeekGrid } from '../components/planner/WeekGrid'
import { WeekList } from '../components/planner/WeekList'
import { MealSheet } from '../components/planner/MealSheet'
import { AmountDialog } from '../components/planner/AmountDialog'
import { MoveMealDialog } from '../components/planner/MoveMealDialog'
import { CopyDayDialog } from '../components/planner/CopyDayDialog'
import { DayView } from '../components/planner/DayView'
import { PlanHeader } from '../components/planner/PlanHeader'
import { WeekSummary } from '../components/planner/WeekSummary'
import { usePlanActions } from '../components/planner/usePlanActions'

/**
 * The weekly planner.
 *
 * Opens on the week: Today answers "what am I eating now", so Plan is where
 * the week is laid out. A phone lists the days, one row each, and a wide
 * screen draws them as columns with every meal in them. A day opens as its own
 * screen on a phone and beside the week on a wide screen.
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
  const wide = useMediaQuery('(min-width: 768px)')

  const [range, setRangeState] = useState<PlanRange>('week')
  /** The view a day goes back to: one week or two. */
  const [listRange, setListRange] = useState<Exclude<PlanRange, 'day'>>('week')
  const setRange = (next: PlanRange) => {
    setRangeState(next)
    if (next !== 'day') setListRange(next)
  }
  /**
   * The day being looked at, derived rather than stored: the centre button,
   * which means today; then a day you tapped; then today if it is on screen.
   */
  const [chosen, setChosen] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [copyFrom, setCopyFrom] = useState<string | null>(null)
  const [templating, setTemplating] = useState(false)
  const [amount, setAmount] = useState<{ date: string; mealId: string; index: number } | null>(null)
  const [clearing, setClearing] = useState(false)
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

  /*
   * The window you are stepping through, and the days actually drawn. A day
   * still moves through weeks underneath, because the arrows and the week it
   * sits in have to land somewhere.
   */
  const windowRange: PlanRange = range === 'day' ? listRange : range
  const spanPhrase = windowRange === 'week' ? 'this week' : 'in this fortnight'
  const windowDates = useMemo(
    () => getRangeDates(weekDates[0], windowRange),
    [weekDates, windowRange],
  )

  const selected = quickAdd
    ?? (chosen && windowDates.includes(chosen) ? chosen : null)
    ?? todayOrFirst(windowDates)

  const selectedDay = byDate.get(selected) ?? { date: selected, meals: [] }
  // One plan, one line across it: the household's target. See
  // useUserStore.setTargets for why there is no per-person line here.
  const targets = profile.targets

  const shownDays = useMemo(
    () => windowDates.map((date) => byDate.get(date)).filter((d): d is DayPlan => Boolean(d)),
    [windowDates, byDate],
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
  const daysPlanned = `${plannedDays} of ${windowDates.length} days planned`

  /*
   * How many meals Fill the gaps has to work with: the empty slots on days
   * still ahead. A day that has gone is not offered anything, so it is not
   * counted either.
   */
  const now = today()
  const gaps = windowDates
    .filter((d) => d >= now)
    .reduce((n, d) => n + MEAL_SLOTS.filter((s) => !byDate.get(d)?.meals.some((m) => m.slot === s)).length, 0)
  const fillLabel = gaps ? `Fill the gaps · ${gaps} ${gaps === 1 ? 'meal' : 'meals'}` : 'Fill the gaps'

  // The centre button says which day it meant, which is today, and the slot
  // for the hour rather than the first free one.
  const quickDay = quickAdd ?? selected
  const quickMeals = byDate.get(quickDay)?.meals ?? []
  const filledSlots = new Set(quickMeals.map((m) => m.slot))
  const openAdd = adding ?? (quickAdd
    ? { date: quickDay, slot: filledSlots.has(slotNow()) ? MEAL_SLOTS.find((s) => !filledSlots.has(s)) ?? slotNow() : slotNow() }
    : null)

  /**
   * Bring the week to the day the button meant, so the meal you add appears
   * on screen. Moving the window is a write to the store, so it belongs in an
   * effect and the selection does not.
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
   * Steps by whatever you are looking at: a day at a time in the day view,
   * bringing the week along when the new day falls outside it, and a week or
   * a fortnight otherwise.
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

  function openDay(date: string) {
    setChosen(date)
    setClearing(false)
    setRange('day')
  }

  const toThisWeek = () => { goToWeek(new Date(), profile.weekStartsOn); setChosen(today()) }
  const showingToday = windowDates.includes(now)
  const dayOpen = range === 'day'
  const anyModal = Boolean(openAdd || filling || moving || templating || amount || sheet || copyFrom)

  const dayBody = (
    <DayView
      day={selectedDay}
      targets={targets}
      clearing={clearing}
      setClearing={setClearing}
      onFill={() => setFilling([selected])}
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
  )

  const fillButton = (
    <button type="button" className="btn-primary min-h-11" onClick={() => setFilling(windowDates)}>
      <Sparkles size={16} aria-hidden="true" /> {fillLabel}
    </button>
  )
  const loadButton = (
    <button type="button" className="btn-secondary min-h-11" onClick={() => setTemplating(true)}>
      <Bookmark size={16} aria-hidden="true" /> Load week
    </button>
  )

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      {dayOpen && !wide ? (
        // A phone gives the day the whole screen, with a way back to the week.
        <div className="max-w-2xl mx-auto">
          <header className="min-h-16 px-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setRange(listRange)}
              aria-label="Back to the week"
              className="w-11 h-11 shrink-0 rounded-[14px] inline-flex items-center justify-center text-ink-900 hover:bg-bite-50"
            >
              <ArrowLeft size={22} aria-hidden="true" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl leading-6 font-extrabold text-ink-900">{dayTitle(selected)}</h1>
              <p className="text-xs leading-4 text-ink-700">
                Plan · week of {formatSpan(windowDates.slice(0, 7))} · {daysPlanned}
              </p>
            </div>
            <DayStepper onShift={shift} />
          </header>
          <div className="px-4 pt-1">{dayBody}</div>
        </div>
      ) : (
        <>
          {/* Behind the day on a wide screen, and out of reach while it is
              open: the day is what you are working on. */}
          <div inert={dayOpen} aria-hidden={dayOpen || undefined}>
            <PlanHeader
              week={{ label: formatSpan(windowDates), unit: windowRange, onPrev: () => shift(-1), onNext: () => shift(1) }}
              actions={<>{loadButton}{fillButton}</>}
            >
              <RangeTabs range={range} onRange={setRange} />
              {!showingToday && (
                <button type="button" className="btn-ghost min-h-11 text-bite-700" onClick={toThisWeek}>
                  This week
                </button>
              )}
            </PlanHeader>

            <div className="max-w-6xl mx-auto md:px-8 pt-3 md:pt-4 space-y-3">
              {!dayOpen && <p className="px-4 md:px-0 text-xs font-bold text-ink-700">{daysPlanned}</p>}
              {wide ? (
                <WeekGrid
                  dates={windowDates}
                  byDate={byDate}
                  kcalByDate={kcalByDate}
                  target={targets.calories}
                  selected={dayOpen ? selected : undefined}
                  onOpenDay={openDay}
                  onOpenSlot={(date, slot) => setSheet({ date, slot })}
                  onAddTo={(date, slot) => setAdding({ date, slot })}
                />
              ) : (
                <WeekList
                  dates={windowDates}
                  byDate={byDate}
                  kcalByDate={kcalByDate}
                  target={targets.calories}
                  onOpenDay={openDay}
                />
              )}

              {/* The week's own actions, under the list on a phone. In the
                  title row from md up. */}
              <div className="px-4 flex gap-2 md:hidden [&>button]:min-h-12 [&>button:first-child]:flex-1">
                {fillButton}
                {loadButton}
              </div>

              <div className="px-4 md:px-0">
                <WeekSummary plannedDays={plannedDays} weekTotal={weekTotal} spanPhrase={spanPhrase} />
              </div>
            </div>
          </div>

          {dayOpen && (
            <DayPanel
              date={selected}
              weekLabel={formatSpan(windowDates.slice(0, 7))}
              daysPlanned={daysPlanned}
              onShift={shift}
              onClose={() => setRange(listRange)}
              active={!anyModal}
            >
              {dayBody}
            </DayPanel>
          )}
        </>
      )}

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

/** "Monday 9 Nov", the way a day's own heading names it. */
function dayTitle(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} ${d.getDate()} ${
    d.toLocaleDateString('en-GB', { month: 'short' })}`
}

/**
 * How much of the plan to look at: one day, a week, or a fortnight, which is
 * how far ahead a shop reaches.
 */
function RangeTabs({ range, onRange }: { range: PlanRange; onRange: (r: PlanRange) => void }) {
  return (
    <div role="tablist" aria-label="How much to show" className="flex gap-1 p-1 bg-border-100 rounded-lg w-fit">
      {(Object.keys(RANGE_LABELS) as PlanRange[]).map((r) => (
        <button
          key={r}
          type="button"
          role="tab"
          aria-selected={range === r}
          onClick={() => onRange(r)}
          className={range === r ? 'segment-on' : 'segment-off'}
        >
          {RANGE_LABELS[r]}
        </button>
      ))}
    </div>
  )
}

function DayStepper({ onShift }: { onShift: (direction: -1 | 1) => void }) {
  const button = 'w-11 h-11 shrink-0 rounded-[14px] md:rounded-xl inline-flex items-center justify-center text-ink-700 hover:bg-bite-50'
  return (
    <>
      <button type="button" onClick={() => onShift(-1)} aria-label="Previous day" title="Previous day" className={button}>
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <button type="button" onClick={() => onShift(1)} aria-label="Next day" title="Next day" className={button}>
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </>
  )
}

/**
 * A day, opened beside the week on a wide screen.
 *
 * A panel from the right over a dimmed week, so the week you came from stays
 * in view. It is a region rather than a dialog: the meal pickers and amount
 * dialogs it opens are the dialogs, and they stack over it. The week behind is
 * inert while it is open, and Escape or the scrim closes it.
 */
function DayPanel({ date, weekLabel, daysPlanned, onShift, onClose, active, children }: {
  date: string
  weekLabel: string
  daysPlanned: string
  onShift: (direction: -1 | 1) => void
  onClose: () => void
  /** False while a dialog it opened is on top, so Escape closes only that. */
  active: boolean
  children: ReactNode
}) {
  const panel = useDialog<HTMLElement>(onClose, active)

  return (
    <>
      <div className="fixed inset-0 md:left-62 z-40 bg-ink-900/30" onClick={onClose} aria-hidden="true" />
      <section
        ref={panel}
        aria-labelledby="plan-day-heading"
        className="fixed top-0 right-0 bottom-0 z-40 w-[520px] max-w-full bg-paper border-l border-border-200 shadow-e3 flex flex-col"
      >
        <div className="pl-6 pr-5 pt-4 pb-3 flex items-center gap-1 border-b border-border-100">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-ink-700">Week of {weekLabel} · {daysPlanned}</p>
            <h2 id="plan-day-heading" className="text-[22px] leading-7 font-extrabold text-ink-900">{dayTitle(date)}</h2>
          </div>
          <DayStepper onShift={onShift} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to the week"
            title="Back to the week"
            className="w-11 h-11 shrink-0 rounded-xl inline-flex items-center justify-center text-ink-700 hover:bg-bite-50"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">{children}</div>
        <div className="px-6 py-3 border-t border-border-100 flex justify-end">
          <button type="button" className="btn-primary min-h-11" onClick={onClose}>Done</button>
        </div>
      </section>
    </>
  )
}
