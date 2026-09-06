import { useMemo, useState } from 'react'
import { CalendarPlus, Check } from 'lucide-react'
import type { MealSlot, SourcePlan } from '../../types'
import { SLOT_LABELS } from '../../types'
import { SOURCE_PLANS } from '../../data'
import { useMealPlanStore, today } from '../../store/useMealPlanStore'
import { useDialog } from '../../lib/useDialog'
import { offerUndo } from '../../store/useUndo'
import WhenPicker from '../planner/WhenPicker'
import { useUserStore } from '../../store/useUserStore'
import { EMPTY_CONTEXT } from '../../lib/moments'
import { SourceLine } from '../ui'
import { useNutritionContext } from '../../store/useNutrition'
import { componentsNutrients } from '../../lib/nutrition'

/**
 * The archive of the dietician's plans.
 *
 * The original Romanian and Hungarian wording is kept verbatim, it is the
 * record of what was actually prescribed, and the calorie figures beside it are
 * this app's interpretation, not the dietician's.
 */
export function PlanArchive() {
  /*
   * Nothing open to begin with.
   *
   * This opened `SOURCE_PLANS[0]`, the first of the fourteen in the order they
   * were imported, while the list on screen is sorted newest first. So it was
   * not even the top row that unfolded: it was a week from June 2022 somewhere
   * down the page, expanded on every visit, for no reason anybody could see.
   * An archive is a list you pick from.
   */
  const [openId, setOpenId] = useState<string | null>(null)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [taking, setTaking] = useState<Taken | null>(null)
  const { loadSourcePlan, weekDates } = useMealPlanStore()
  const notice = useUserStore((s) => s.notice)

  const plans = useMemo(
    () => [...SOURCE_PLANS].sort((a, b) => (b.issuedOn ?? '').localeCompare(a.issuedOn ?? '')),
    [],
  )

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-700">
        {plans.length} weeks from your dietician, {plans.reduce((a, p) => a + p.days.length, 0)} days in all.
        Drop any week straight into your planner.
      </p>

      <div className="space-y-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            open={openId === plan.id}
            loaded={loadedId === plan.id}
            onToggle={() => setOpenId(openId === plan.id ? null : plan.id)}
            onLoad={() => {
              loadSourcePlan(plan)
              setLoadedId(plan.id)
              notice({ ...EMPTY_CONTEXT, loadedFromArchive: true })
            }}
            onTake={setTaking}
            weekLabel={weekDates[0]}
          />
        ))}
      </div>

      {taking && <PutItSomewhere taken={taking} onClose={() => setTaking(null)} />}
    </div>
  )
}

/**
 * Where a day or a meal out of the archive should land.
 *
 * "Load" drops a whole week onto the current week, matching weekday to
 * weekday, which is the right thing when you want the week and far too much
 * when you wanted Tuesday's dinner. The archive is fourteen weeks of meals
 * somebody wrote for this household, and the useful thing to do with it is
 * take one, so a day and a meal can each be lifted out and put anywhere.
 *
 * Added rather than replacing what is already in that slot. A slot holds a
 * list, and quietly overwriting a meal you had planned is not something a
 * button called "Take" should do.
 */
function PutItSomewhere({ taken, onClose }: { taken: Taken; onClose: () => void }) {
  const { plan, addEntry } = useMealPlanStore()
  const panel = useDialog<HTMLDivElement>(onClose)
  const [date, setDate] = useState(today)

  // One meal picks its slot; a whole day keeps each meal in its own.
  const single = taken.meals.length === 1 ? taken.meals[0] : undefined
  const [slot, setSlot] = useState<MealSlot>(() => single?.slot ?? 'dinner')

  const busy = useMemo(
    () => new Set(plan.filter((d) => d.meals.length).map((d) => d.date)),
    [plan],
  )

  function put() {
    for (const meal of taken.meals) {
      for (const entry of meal.entries) {
        addEntry(date, single ? slot : meal.slot, entry)
      }
    }
    const when = new Date(date + 'T12:00:00')
      .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    offerUndo(`Put ${taken.what} on ${when}`, () => {
      // Taken back out in reverse, so each index is still the one just added.
      for (const meal of [...taken.meals].reverse()) {
        const where = single ? slot : meal.slot
        for (let i = meal.entries.length - 1; i >= 0; i--) {
          const day = useMealPlanStore.getState().plan.find((d) => d.date === date)
          const at = (day?.meals.find((m) => m.slot === where)?.entries.length ?? 1) - 1
          useMealPlanStore.getState().removeEntry(date, where, at)
        }
      }
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Put ${taken.what} in a day`}
        className="bg-paper rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-ink-900 mb-1">{taken.what}</h3>
        <p className="text-sm text-ink-700 mb-4">
          {single
            ? 'One meal, on a day and a slot of your choosing.'
            : `${taken.meals.length} meals, each keeping the slot it was written for.`}
        </p>

        <WhenPicker
          date={date}
          onDate={setDate}
          slot={single ? slot : undefined}
          onSlot={single ? setSlot : undefined}
          busy={busy}
        />

        <p className="text-xs text-ink-500 mt-3">
          Added to whatever is already there rather than replacing it.
        </p>

        <div className="flex gap-2 mt-5">
          <button className="btn-primary flex-1" onClick={put}>
            <Check size={15} /> Put it in
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

/** One or more meals lifted out of an archived week, waiting for a home. */
export interface Taken {
  /** What is being moved, for the dialog's heading and the undo line. */
  what: string
  meals: SourcePlan['days'][number]['meals']
}

function PlanCard({
  plan, open, loaded, onToggle, onLoad, onTake, weekLabel,
}: {
  plan: SourcePlan
  open: boolean
  loaded: boolean
  onToggle: () => void
  onLoad: () => void
  onTake: (taken: Taken) => void
  weekLabel: string
}) {
  const ctx = useNutritionContext()

  const dayTotals = plan.days.map((d) =>
    d.meals.reduce((sum, m) => sum + componentsNutrients(m.entries, ctx).calories, 0))
  const complete = dayTotals.filter((t) => t > 0)
  const average = complete.length ? Math.round(complete.reduce((a, b) => a + b, 0) / complete.length) : 0

  return (
    <article className="card overflow-hidden">
      {/* Two sibling buttons rather than one nested inside the other: a button
          inside a button is invalid, and browsers reparent it so its click
          handler never fires. */}
      <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-cream-50">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 min-w-0 min-h-11 text-left">
          <span className="text-xl">{plan.language === 'hu' ? '🇭🇺' : '🇷🇴'}</span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-ink-900 text-sm">{plan.label}</span>
            <span className="block text-xs text-ink-500">
              {plan.days.length} days · avg {average} kcal
              {plan.subject === 'other' ? ' · not your plan' : ''}
            </span>
          </span>
        </button>
        <button
          onClick={onLoad}
          className={loaded ? 'chip-on' : 'chip-off'}
        >
          {loaded ? <><Check size={12} /> Loaded</> : <><CalendarPlus size={12} /> Load</>}
        </button>
      </div>

      {open && (
        <div className="border-t border-border-200 divide-y divide-border-100">
          {plan.days.map((day, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <h3 className="text-sm font-bold text-ink-900">{day.dayName}</h3>
                <span className="flex items-baseline gap-2 shrink-0">
                  <button
                    className="btn-ghost text-xs text-bite-700"
                    onClick={() => onTake({ what: day.dayName, meals: day.meals })}
                  >
                    <CalendarPlus size={12} /> Take this day
                  </button>
                  <span className="text-xs font-mono text-ink-500">{Math.round(dayTotals[i])} kcal</span>
                </span>
              </div>
              <dl className="space-y-1">
                {day.meals.map((meal, j) => (
                  <div key={j} className="flex gap-3 text-xs">
                    <dt className="w-20 shrink-0 font-semibold text-ink-500">{SLOT_LABELS[meal.slot]}</dt>
                    {/* The archive is where these are actually read, so both
                        go: what it says, and what was written. The original is
                        the record and stays underneath rather than being
                        replaced by a reading of it. */}
                    <dd className="flex-1 min-w-0">
                      <SourceLine text={meal.text} translate />
                    </dd>
                    <dd className="w-12 text-right font-mono text-ink-500 shrink-0">
                      {Math.round(componentsNutrients(meal.entries, ctx).calories)}
                    </dd>
                    <dd className="shrink-0">
                      <button
                        className="btn-ghost text-xs text-bite-700 px-1 -mx-1"
                        aria-label={`Take ${SLOT_LABELS[meal.slot]} from ${day.dayName}`}
                        onClick={() => onTake({ what: `${day.dayName} ${SLOT_LABELS[meal.slot].toLowerCase()}`, meals: [meal] })}
                        disabled={!meal.entries.length}
                      >
                        Take
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <p className="px-4 py-3 text-xs text-ink-500">
            Loading this plan fills the week of {new Date(weekLabel + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })},
            matching each day to the same weekday.
          </p>
        </div>
      )}
    </article>
  )
}
