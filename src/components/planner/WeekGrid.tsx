import { Plus, Check, CircleDot } from 'lucide-react'
import type { DayPlan, MealSlot } from '../../types'
import { MEAL_SLOTS, SLOT_LABELS } from '../../types'
import { today } from '../../store/useMealPlanStore'
import { useNutritionContext } from '../../store/useNutrition'
import { componentsNutrients, entryOutcome, type NutritionContext } from '../../lib/nutrition'
import { entriesName } from '../../lib/entryLabel'
import { formatDate, formatRange } from '../../lib/planner/format'
import { CHIP_TONE, dayChip } from '../../lib/planner/dayChip'

/**
 * The week on a wide screen: a column a day, a row a slot, a card a meal.
 *
 * Every meal in the range is on screen at once, under full names, which a
 * laptop has the width for. A day's heading opens that day; a meal opens over
 * the week in a sheet; an empty slot goes straight to the picker. A fortnight
 * is two of these, one under the other, because fourteen columns would leave
 * a name a word a line.
 */
export function WeekGrid({
  dates, byDate, kcalByDate, target, selected, onOpenDay, onOpenSlot, onAddTo,
}: {
  dates: string[]
  byDate: Map<string, DayPlan>
  kcalByDate: Map<string, number>
  target: number
  selected?: string
  onOpenDay: (date: string) => void
  onOpenSlot: (date: string, slot: MealSlot) => void
  /** An empty slot goes straight to the picker, rather than to an empty panel. */
  onAddTo: (date: string, slot: MealSlot) => void
}) {
  const weeks: string[][] = []
  for (let i = 0; i < dates.length; i += 7) weeks.push(dates.slice(i, i + 7))

  return (
    <div className="space-y-4">
      {weeks.map((week) => (
        <OneWeek
          key={week[0]}
          dates={week}
          byDate={byDate}
          kcalByDate={kcalByDate}
          target={target}
          selected={selected}
          onOpenDay={onOpenDay}
          onOpenSlot={onOpenSlot}
          onAddTo={onAddTo}
        />
      ))}
    </div>
  )
}

function OneWeek({
  dates, byDate, kcalByDate, target, selected, onOpenDay, onOpenSlot, onAddTo,
}: {
  dates: string[]
  byDate: Map<string, DayPlan>
  kcalByDate: Map<string, number>
  target: number
  selected?: string
  onOpenDay: (date: string) => void
  onOpenSlot: (date: string, slot: MealSlot) => void
  onAddTo: (date: string, slot: MealSlot) => void
}) {
  const ctx = useNutritionContext()
  const now = today()

  return (
    <section
      aria-label={`Week of ${formatRange(dates)}`}
      className="bg-paper border border-border-200 rounded-3xl overflow-hidden grid"
      style={{ gridTemplateColumns: `96px repeat(${dates.length}, minmax(0, 1fr))` }}
    >
      <div className="p-3 flex items-end text-xs font-bold text-ink-700">Meal</div>
      {dates.map((date) => {
        const day = byDate.get(date)
        const kcal = Math.round(kcalByDate.get(date) ?? 0)
        const chip = dayChip(day, kcal, target)
        const isToday = date === now
        const past = date < now
        const d = new Date(date + 'T12:00:00')
        return (
          <div
            key={date}
            data-day-row={date}
            data-has-food={day?.meals.length ? '' : undefined}
            className={`border-l border-border-100 ${isToday || date === selected ? 'bg-bite-50' : ''}`}
          >
            <button
              type="button"
              onClick={() => onOpenDay(date)}
              aria-label={`Open ${formatDate(date)}${isToday ? ', today' : past ? ', past' : ''}, ${kcal} kcal${
                chip ? `, ${chip.label}` : ''}`}
              className="w-full h-full p-2.5 flex flex-col gap-1.5 text-left hover:bg-bite-50"
            >
              <span className={`text-sm leading-[18px] font-extrabold ${isToday ? 'text-bite-700' : 'text-ink-900'}`}>
                {d.toLocaleDateString('en-GB', { weekday: 'short' })} {d.getDate()}
                {isToday && <span className="ml-1 text-xs font-bold">Today</span>}
              </span>
              <span className="text-xs leading-4 text-ink-700">
                {kcal > 0
                  ? <><span className="font-bold text-ink-900">{kcal.toLocaleString('en-GB')}</span> kcal</>
                  : 'No meals planned'}
              </span>
              <span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
                  chip ? CHIP_TONE[chip.tone] : CHIP_TONE.gap}`}>
                  {chip ? chip.label : past ? 'Past' : 'Nothing yet'}
                </span>
              </span>
            </button>
          </div>
        )
      })}

      {MEAL_SLOTS.map((slot) => (
        <SlotLine
          key={slot}
          slot={slot}
          dates={dates}
          byDate={byDate}
          ctx={ctx}
          onOpenSlot={onOpenSlot}
          onAddTo={onAddTo}
        />
      ))}
    </section>
  )
}

function SlotLine({ slot, dates, byDate, ctx, onOpenSlot, onAddTo }: {
  slot: MealSlot
  dates: string[]
  byDate: Map<string, DayPlan>
  ctx: NutritionContext
  onOpenSlot: (date: string, slot: MealSlot) => void
  onAddTo: (date: string, slot: MealSlot) => void
}) {
  return (
    <>
      <div className="p-3 border-t border-border-100 text-sm font-extrabold text-ink-900">
        {SLOT_LABELS[slot]}
      </div>
      {dates.map((date) => (
        <div key={date} className="border-t border-l border-border-100 p-1.5 min-w-0 flex flex-col gap-1.5">
          <MealCell
            date={date}
            slot={slot}
            day={byDate.get(date)}
            ctx={ctx}
            onOpen={() => onOpenSlot(date, slot)}
            onAdd={() => onAddTo(date, slot)}
          />
        </div>
      ))}
    </>
  )
}

/**
 * One day's one slot.
 *
 * A meal that was ticked carries the tick as well as its colour, because
 * nothing in this app is allowed to say something in hue alone. An empty slot
 * is a dashed outline that says Add, so a gap reads as a gap you can fill
 * rather than as a rendering fault.
 */
function MealCell({ date, slot, day, ctx, onOpen, onAdd }: {
  date: string
  slot: MealSlot
  day: DayPlan | undefined
  ctx: NutritionContext
  onOpen: () => void
  onAdd: () => void
}) {
  const meals = day?.meals.filter((m) => m.slot === slot) ?? []

  if (!meals.length) {
    return (
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add something to ${SLOT_LABELS[slot]} on ${formatDate(date)}`}
        className="flex-1 min-h-11 rounded-xl border border-dashed border-ink-300 text-xs font-bold text-ink-700
                   hover:border-bite-700 hover:text-bite-700 flex items-center justify-center gap-1"
      >
        <Plus size={14} aria-hidden="true" /> Add
      </button>
    )
  }

  /*
   * The cell's state, worked out from the items rather than from the meals,
   * so a breakfast where you had the bread and left the coffee reads as part
   * way through rather than untouched.
   */
  const entries = meals.flatMap((m) => m.entries)
  const outcomes = meals.flatMap((m) => m.entries.map((e) => entryOutcome(e, m)))
  const eaten = outcomes.length > 0 && outcomes.every((o) => o === 'eaten')
  const skipped = outcomes.length > 0 && outcomes.every((o) => o === 'skipped')
  const part = !eaten && !skipped && outcomes.some((o) => o === 'eaten')
  const name = entriesName(entries, ctx)
  const kcal = Math.round(componentsNutrients(
    meals.flatMap((m) => m.entries.filter((e) => entryOutcome(e, m) !== 'skipped')), ctx).calories)

  return (
    <button
      type="button"
      data-planned
      onClick={onOpen}
      aria-label={`${SLOT_LABELS[slot]} on ${formatDate(date)}: ${name}${
        meals.length > 1 ? `, ${meals.length} meals` : ''}${
        eaten ? ', eaten'
          : skipped ? ', skipped'
            : part ? `, ${outcomes.filter((o) => o === 'eaten').length} of ${outcomes.length} eaten`
              : ', planned'}`}
      className={`rounded-xl border p-2 flex flex-col gap-1.5 text-left hover:border-bite-700
                  ${eaten ? 'bg-leaf-50 border-leaf-200' : 'bg-cream-50 border-border-200'}`}
    >
      <span className={`text-[13px] leading-[17px] font-bold break-words ${
        skipped ? 'line-through text-ink-700' : 'text-ink-900'}`}>
        {name}
        {meals.length > 1 && <span className="font-semibold text-ink-700"> +{meals.length - 1}</span>}
      </span>
      <span className="flex items-center justify-between gap-1 text-xs font-bold text-ink-700">
        <span className="flex items-center gap-1">
          {eaten && <><Check size={13} aria-hidden="true" className="text-leaf-700" /> Had</>}
          {part && <><CircleDot size={13} aria-hidden="true" className="text-leaf-700" /> Part</>}
          {skipped && 'Skipped'}
        </span>
        <span className="tabular-nums">{kcal}</span>
      </span>
    </button>
  )
}
