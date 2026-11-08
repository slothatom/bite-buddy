import { Plus, Check, CircleDot } from 'lucide-react'
import type { DayPlan, MealSlot } from '../../types'
import { MEAL_SLOTS, SLOT_LABELS } from '../../types'
import { today } from '../../store/useMealPlanStore'
import { useNutritionContext } from '../../store/useNutrition'
import { entryOutcome, type NutritionContext } from '../../lib/nutrition'
import { entriesName } from '../../lib/entryLabel'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { formatDate, shortName } from '../../lib/planner/format'

/**
 * A fortnight of food, as day rows and slot columns.
 *
 * The planner used to draw a strip of seven cells holding a calorie number and
 * nothing else, with one day's meals underneath it, so the week view never
 * actually showed a week. This shows every meal in the range at once.
 *
 * Days run down and slots run across, which is the one arrangement that fits a
 * phone without scrolling sideways: six columns at 390px rather than eight.
 * The cost is width, about 60px a cell, and most of the dietician's recipes are
 * named in six words. So a row opens: tap the date and that day gives its meals
 * their full names, on one line each, for as long as you are reading it.
 */
export function WeekGrid({
  dates, byDate, kcalByDate, selected, expanded, onExpand, onOpenDay, onOpenSlot, onAddTo,
}: {
  dates: string[]
  byDate: Map<string, DayPlan>
  kcalByDate: Map<string, number>
  selected: string
  /** The one day showing full names, if any. */
  expanded: string | null
  onExpand: (date: string | null) => void
  onOpenDay: (date: string) => void
  onOpenSlot: (date: string, slot: MealSlot) => void
  /** An empty slot goes straight to the picker, rather than to an empty panel. */
  onAddTo: (date: string, slot: MealSlot) => void
}) {
  const ctx = useNutritionContext()
  const now = today()
  // Six columns hold 12px text from the small breakpoint up. Below it a
  // column is about fifty pixels, which is three letters of a name at the
  // caption size, so a phone gets the week as a list instead: one day a row,
  // its slots one under the next with their full names.
  const wide = useMediaQuery('(min-width: 640px)')

  return (
    <div className="space-y-1.5">
      {/* The slot names once, at the top. Hidden from a screen reader because
          every cell below already says which slot it is in its own label; a
          visual header row is for eyes following a column. */}
      {wide && (
        <div className="grid gap-1.5 px-0.5" style={{ gridTemplateColumns: DAY_COLUMNS }} aria-hidden="true">
          <span />
          {MEAL_SLOTS.map((slot) => (
            <span key={slot} className="text-center text-xs font-bold uppercase tracking-wide text-ink-500 truncate">
              {SLOT_LABELS[slot]}
            </span>
          ))}
        </div>
      )}

      {dates.map((date) => {
        const day = byDate.get(date)
        const open = !wide || expanded === date
        const past = date < now
        const isToday = date === now
        const weekday = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
        const kcal = Math.round(kcalByDate.get(date) ?? 0)

        // A past day is quieter by surface and by word, not by fading its
        // text: opacity took ink-500 to about 2.4:1. Today carries the brand.
        const dateTone = isToday
          ? 'bg-bite-500 text-on-brand'
          : past ? 'bg-transparent text-ink-500' : 'bg-cream-50 text-ink-900'

        const dateLabel = (
          <>
            {/* Today inherits the button's own colour rather than naming
                one. A colour named here has its ground on the parent, so
                nothing can tell what it sits on. */}
            <span className={`text-xs font-bold uppercase tracking-wide ${isToday ? '' : 'text-ink-500'}`}>
              {weekday}
            </span>
            <span className="text-sm font-extrabold leading-none">
              {new Date(date + 'T12:00:00').getDate()}
            </span>
            {past && !isToday && (
              <span data-past className="text-xs font-bold text-ink-500">Past</span>
            )}
            {open && (
              <span className={`ml-auto text-xs font-mono ${isToday ? '' : 'text-ink-500'}`}>
                {kcal} kcal
              </span>
            )}
          </>
        )

        return (
          <div
            key={date}
            data-day-row={date}
            className={`grid gap-1 sm:gap-1.5 items-stretch rounded-xl p-0.5
                        ${date === selected ? 'bg-bite-50' : ''}`}
            style={{ gridTemplateColumns: open ? '1fr' : DAY_COLUMNS }}
          >
            {/* The date, and on a wide screen the handle that opens the row.
                A phone already shows every name in full, so there it is a
                heading for the row rather than a toggle. */}
            {wide ? (
              <button
                type="button"
                onClick={() => onExpand(open ? null : date)}
                aria-expanded={open}
                aria-label={`${formatDate(date)}${past && !isToday ? ', past' : ''}, ${kcal} kcal. ${
                  open ? 'Hide the full names' : 'Show the full names'}`}
                className={`flex rounded-lg px-1 py-1.5 text-left
                            ${open ? 'items-baseline gap-2' : 'flex-col justify-center'}
                            ${dateTone}`}
              >
                {dateLabel}
              </button>
            ) : (
              <h3
                aria-label={`${formatDate(date)}${past && !isToday ? ', past' : ''}, ${kcal} kcal`}
                className={`flex items-baseline gap-2 rounded-lg px-2 py-1.5 ${dateTone}`}
              >
                {dateLabel}
              </h3>
            )}

            {open ? (
              // Opened: one slot a line, full names, and a way into the day.
              <div className="space-y-1 pb-1">
                {MEAL_SLOTS.map((slot) => (
                  <MealCell
                    key={slot}
                    date={date} slot={slot} day={day} ctx={ctx}
                    full
                    onOpen={() => onOpenSlot(date, slot)}
                    onAdd={() => onAddTo(date, slot)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => onOpenDay(date)}
                  className="text-xs font-bold text-bite-700 hover:underline px-1 min-h-11"
                >
                  Open {formatDate(date)}
                </button>
              </div>
            ) : (
              MEAL_SLOTS.map((slot) => (
                <MealCell
                  key={slot}
                  date={date} slot={slot} day={day} ctx={ctx}
                  onOpen={() => onOpenSlot(date, slot)}
                  onAdd={() => onAddTo(date, slot)}
                />
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}

/** The day column, then the five slots. Narrow enough for a phone. */
const DAY_COLUMNS = '3rem repeat(5, minmax(0, 1fr))'

/**
 * One day's one slot, as the grid draws it.
 *
 * A meal that was ticked carries the tick as well as its colour, because
 * nothing in this app is allowed to say something in hue alone. An empty slot
 * is a dashed outline rather than a blank, so a gap in a week reads as a gap
 * you can fill rather than as a rendering fault.
 */
function MealCell({
  date, slot, day, ctx, full = false, onOpen, onAdd,
}: {
  date: string
  slot: MealSlot
  day: DayPlan | undefined
  ctx: NutritionContext
  full?: boolean
  onOpen: () => void
  onAdd: () => void
}) {
  const meals = day?.meals.filter((m) => m.slot === slot) ?? []

  if (!meals.length) {
    return (
      // Straight to the picker. Opening an empty panel first, so you could
      // press "Pop something in" inside it, was two taps to reach a thing the
      // cell already says it does.
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add something to ${SLOT_LABELS[slot]} on ${formatDate(date)}`}
        className={`rounded-lg border border-dashed border-border-200 text-ink-300
                    hover:border-bite-400 hover:text-bite-700 flex items-center justify-center
                    ${full ? 'w-full min-h-11 py-1.5 text-xs gap-1' : 'min-h-11 text-xs'}`}
      >
        <Plus size={13} />{full && <span className="text-ink-500">{SLOT_LABELS[slot]}</span>}
      </button>
    )
  }

  /*
   * The cell's state, worked out from the items rather than from the meals.
   *
   * Reading `m.outcome` was right while a meal was ticked whole. It stopped
   * being right the moment items could be ticked one at a time: a breakfast
   * where you had the bread and left the coffee leaves the meal undecided, and
   * the week grid would have shown it as untouched, which is the week quietly
   * disagreeing with the day.
   */
  const outcomes = meals.flatMap((m) => m.entries.map((e) => entryOutcome(e, m)))
  const eaten = outcomes.every((o) => o === 'eaten')
  const skipped = outcomes.every((o) => o === 'skipped')
  const part = !eaten && !skipped && outcomes.some((o) => o === 'eaten')
  const name = entriesName(meals.flatMap((m) => m.entries), ctx)

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
      className={`relative rounded-lg px-1 py-1 text-left leading-tight border
                  ${eaten ? 'bg-leaf-50 border-leaf-200'
                    : skipped ? 'bg-transparent border-border-200' : 'bg-cream-50 border-transparent'}
                  hover:border-bite-400
                  ${full ? 'w-full min-h-11 flex items-center gap-1.5' : 'min-h-11 block'}`}
    >
      {/* Skipped says so in a word, on a quieter surface. It used to be the
          same cell at 55% opacity, which was colour alone and took the name
          under 3:1. */}
      {skipped && !full && (
        <span className="block text-xs font-bold text-ink-500">Skipped</span>
      )}
      {/* A full line has no column header above it, so it names its slot. */}
      {full && (
        <span className="shrink-0 w-20 text-xs font-bold uppercase tracking-wide text-ink-500">
          {SLOT_LABELS[slot]}
        </span>
      )}
      {/* Out of the text's way in the narrow view. A column is sixty pixels
          and the tick was taking fifteen of them, which left "Chicken" too
          little room to sit on a line and had it breaking mid-word. */}
      {(eaten || part) && (
        // Part way through is its own mark rather than a paler tick. Colour is
        // never the only thing carrying a meaning in this app, and "some of
        // it" and "all of it" are two different facts about a morning.
        part ? (
          <CircleDot
            size={11}
            aria-hidden="true"
            className={`text-leaf-700 ${full ? 'shrink-0' : 'absolute top-0.5 right-0.5'}`}
          />
        ) : (
          <Check
            size={11}
            aria-hidden="true"
            className={`text-leaf-700 ${full ? 'shrink-0' : 'absolute top-0.5 right-0.5'}`}
          />
        )
      )}
      <span
        className={`block min-w-0 text-xs
                    ${skipped ? 'line-through text-ink-500' : 'text-ink-900'}
                    ${full ? 'flex-1 truncate' : `${skipped ? 'line-clamp-2' : 'line-clamp-3'} break-words`}
                    ${!full && eaten ? 'pr-2.5' : ''}`}
      >
        {full ? name : shortName(name)}
        {/* A slot holds as many meals as you had, and the snack slot now
            regularly holds two. Naming the first and saying nothing about the
            rest is a cell claiming a day is smaller than it was. */}
        {!full && meals.length > 1 && (
          <span className="text-ink-500"> +{meals.length - 1}</span>
        )}
      </span>
      {skipped && full && (
        <span className="shrink-0 text-xs font-bold text-ink-500">Skipped</span>
      )}
    </button>
  )
}
