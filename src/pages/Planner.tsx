import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2, X, ClipboardCopy, CalendarDays } from 'lucide-react'
import type { Component, DayPlan, MealSlot } from '../types'
import { MEAL_SLOTS, SLOT_LABELS } from '../types'
import { useMealPlanStore, getWeekDates } from '../store/useMealPlanStore'
import { useUserStore } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import { componentsNutrients, dayNutrients, emptyNutrients, addNutrients } from '../lib/nutrition'
import { CalorieRing, NutrientSummary, SectionHeading, SourceLine } from '../components/ui'
import { useUiStore } from '../store/useUiStore'
import AddEntryModal from '../components/planner/AddEntryModal'
import { dayQuickAdd, copyToClipboard } from '../lib/mfp'

/**
 * The weekly planner.
 *
 * The grid runs from the user's chosen week start — Wednesday by default,
 * matching how every one of the dietician's plans is laid out.
 */
export default function Planner() {
  const { profile } = useUserStore()
  const { weekDates, plan, goToWeek, addEntry, removeMeal, clearDay, copyDay } = useMealPlanStore()
  const ctx = useNutritionContext()

  const [selected, setSelected] = useState<string>(() => todayOrFirst(weekDates))
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [copyFrom, setCopyFrom] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const { quickAdd, clearQuickAdd } = useUiStore()

  const byDate = useMemo(() => new Map(plan.map((d) => [d.date, d])), [plan])
  const selectedDay = byDate.get(selected) ?? { date: selected, meals: [] }
  const selectedTotals = dayNutrients(selectedDay, ctx)
  const targets = profile.targets

  const weekTotal = useMemo(
    () => plan.reduce((acc, d) => addNutrients(acc, dayNutrients(d, ctx)), emptyNutrients()),
    [plan, ctx],
  )
  const plannedDays = plan.filter((d) => d.meals.length).length

  // The bottom bar's centre button lands here. Rather than syncing that intent
  // into local state from an effect — which costs a second render — the open
  // modal is derived from either source.
  const filledSlots = new Set(selectedDay.meals.map((m) => m.slot))
  const openAdd = adding ?? (quickAdd
    ? { date: selected, slot: MEAL_SLOTS.find((s) => !filledSlots.has(s)) ?? 'breakfast' }
    : null)

  function closeAdd() {
    setAdding(null)
    clearQuickAdd()
  }

  function shiftWeek(weeks: number) {
    const ref = new Date(weekDates[0] + 'T12:00:00')
    ref.setDate(ref.getDate() + weeks * 7)
    goToWeek(ref, profile.weekStartsOn)
    setSelected(getWeekDates(ref, profile.weekStartsOn)[0])
  }

  async function copyDayForMfp() {
    const perSlot = MEAL_SLOTS.map((slot) => ({
      slot,
      macros: componentsNutrients(
        selectedDay.meals.filter((m) => m.slot === slot).flatMap((m) => m.entries), ctx),
    }))
    const ok = await copyToClipboard(dayQuickAdd(formatDate(selected), perSlot, selectedTotals))
    setCopied(ok)
    setTimeout(() => setCopied(false), 2200)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Week navigation */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="display text-xl sm:text-2xl text-ink-900">Your week</h1>
            <p className="text-sm text-ink-700">
              {formatRange(weekDates)} · {plannedDays} of 7 days planned
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button className="btn-secondary btn-icon" onClick={() => shiftWeek(-1)} aria-label="Previous week">
              <ChevronLeft size={18} />
            </button>
            <button
              className="btn-secondary"
              onClick={() => { goToWeek(new Date(), profile.weekStartsOn); setSelected(new Date().toISOString().slice(0, 10)) }}
            >
              This week
            </button>
            <button className="btn-secondary btn-icon" onClick={() => shiftWeek(1)} aria-label="Next week">
              <ChevronRight size={18} />
            </button>
          </div>
        </header>

        {/* Week strip */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekDates.map((date) => {
            const day = byDate.get(date)
            const kcal = day ? dayNutrients(day, ctx).calories : 0
            const isSelected = date === selected
            const isToday = date === new Date().toISOString().slice(0, 10)
            return (
              <button
                key={date}
                onClick={() => setSelected(date)}
                className={`rounded-xl p-2 sm:p-3 text-center transition-all border ${
                  isSelected
                    ? 'bg-bite-500 text-white border-bite-500 shadow-xs'
                    : 'bg-white border-border-200 hover:border-bite-300 text-ink-900'
                }`}
              >
                <div className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${isSelected ? 'text-bite-100' : 'text-ink-500'}`}>
                  {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}
                </div>
                <div className={`text-base sm:text-lg font-bold leading-tight ${isToday && !isSelected ? 'text-bite-700' : ''}`}>
                  {new Date(date + 'T12:00:00').getDate()}
                </div>
                <div className={`text-[10px] sm:text-xs font-mono ${isSelected ? 'text-bite-100' : 'text-ink-500'}`}>
                  {kcal > 0 ? Math.round(kcal) : '–'}
                </div>
              </button>
            )
          })}
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
            <button className="btn-secondary" onClick={copyDayForMfp}>
              <ClipboardCopy size={15} /> {copied ? 'Copied' : 'Copy for MyFitnessPal'}
            </button>
            <button className="btn-secondary" onClick={() => setCopyFrom(selected)}>
              <Copy size={15} /> Copy day to…
            </button>
            {selectedDay.meals.length > 0 && (
              <button className="btn-ghost text-ink-500 hover:text-coral-600" onClick={() => clearDay(selected)}>
                <Trash2 size={15} /> Clear day
              </button>
            )}
          </div>
        </section>

        {/* Meals */}
        <section>
          <SectionHeading>{formatDate(selected)}</SectionHeading>
          <div className="space-y-2.5">
            {MEAL_SLOTS.map((slot) => (
              <SlotRow
                key={slot}
                slot={slot}
                day={selectedDay}
                onAdd={() => setAdding({ date: selected, slot })}
                onRemove={(mealId) => removeMeal(selected, mealId)}
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
            kcal a day on average, across {plannedDays} planned {plannedDays === 1 ? 'day' : 'days'}.
          </span>
        </section>
      </div>

      {openAdd && (
        <AddEntryModal
          date={openAdd.date}
          slot={openAdd.slot}
          onClose={closeAdd}
          onAdd={(entry: Component) => addEntry(openAdd.date, openAdd.slot, entry)}
        />
      )}

      {copyFrom && (
        <CopyDayDialog
          from={copyFrom}
          dates={weekDates}
          onClose={() => setCopyFrom(null)}
          onPick={(to) => { copyDay(copyFrom, to); setCopyFrom(null) }}
        />
      )}
    </div>
  )
}

function SlotRow({
  slot, day, onAdd, onRemove,
}: {
  slot: MealSlot
  day: DayPlan
  onAdd: () => void
  onRemove: (mealId: string) => void
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
                    <SourceLine text={meal.note} truncate />
                  </div>
                ) : null}
              </div>
              <button
                className="btn-ghost btn-icon shrink-0 text-ink-300 hover:text-coral-600"
                onClick={() => onRemove(meal.id)}
                aria-label="Remove meal"
              >
                <X size={16} />
              </button>
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

function EntryLine({ entry }: { entry: Component }) {
  const ctx = useNutritionContext()
  const kcal = componentsNutrients([entry], ctx).calories

  const label = entry.kind === 'recipe'
    ? ctx.recipes.get(entry.recipeId)?.name.en ?? 'Unknown recipe'
    : ctx.foods.get(entry.foodId)?.names.en ?? 'Unknown food'
  const detail = entry.kind === 'recipe'
    ? entry.servings === 1 ? '' : `${entry.servings}×`
    : `${Math.round(entry.grams)} g`
  const emoji = entry.kind === 'recipe' ? ctx.recipes.get(entry.recipeId)?.emoji ?? '🍽️' : '·'

  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-base leading-none">{emoji}</span>
      <span className="flex-1 min-w-0 truncate text-ink-900">{label}</span>
      {detail ? <span className="text-xs text-ink-500 font-mono shrink-0">{detail}</span> : null}
      <span className="text-xs text-ink-700 font-mono shrink-0 w-14 text-right">{Math.round(kcal)}</span>
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
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
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
  const last = new Date(dates[6] + 'T12:00:00').toLocaleDateString('en-GB', opts)
  return `${first} – ${last}`
}
