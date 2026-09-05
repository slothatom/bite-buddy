import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useThisWeek } from '../store/useThisWeek'
import { useUserStore } from '../store/useUserStore'
import { targetsFor } from '../store/useUserStore'
import { useUiStore } from '../store/useUiStore'
import {
  useBodyStore, useWeightFor, useMeasurementsFor, useUnassignedCount,
} from '../store/useBodyStore'
import { MEASUREMENT_KEYS, MEASUREMENT_LABELS, type MeasurementKey } from '../types'
import { PEOPLE, type PersonId } from '../lib/people'
import { useNutritionContext } from '../store/useNutrition'
import { today } from '../store/useMealPlanStore'
import { weekEaten } from '../lib/nutrition'
import { scoreWeek, scoreGaps, servingCount, IMPLAUSIBLE_RATIO } from '../lib/mediterranean'
import { STATUS_STYLES, targetStatus } from '../lib/status'
import { EmptyState, SectionHeading } from '../components/ui'
import { useMovementAcross } from '../store/useActivityStore'
import type { DayMovement } from '../lib/movement'
import { fromKg, inUnit, round1, toKg } from '../lib/weight'

type Tab = 'week' | 'mediterranean' | 'body'

export default function Analytics() {
  const [tab, setTab] = useState<Tab>('week')

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header>
          <h1 className="display text-xl sm:text-2xl text-ink-900">Progress</h1>
          <p className="text-sm text-ink-700">How your week is shaping up.</p>
        </header>

        {/* Announced as tabs, like every other strip in the app. These were
            plain buttons, so nothing told a screen reader they were a set or
            which one was current. */}
        <div
          className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit"
          role="tablist"
          aria-label="What to show"
        >
          {([['week', 'This week'], ['mediterranean', 'Mediterranean'], ['body', 'Body']] as const).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={tab === k ? 'tab-on' : 'tab-off'}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'week' && <WeekTab />}
        {tab === 'mediterranean' && <MediterraneanTab />}
        {tab === 'body' && <BodyTab />}
      </div>
    </div>
  )
}

function WeekTab() {
  const plan = useMealPlanStore((s) => s.plan)
  const weekDates = useThisWeek()
  const { profile } = useUserStore()
  const viewingAs = useUiStore((s) => s.viewingAs)
  const targets = targetsFor(profile, viewingAs)
  const ctx = useNutritionContext()

  // The week on screen, not every day the app has ever held. Under a tab
  // labelled "This week" the whole plan was charted, so a week planned a
  // fortnight ago was still being shown as though it were this one.
  //
  // And what each day amounted to, not what was hoped for it. This screen
  // summed the plan while the planner and Home reported what had been ticked,
  // so the app recorded the truth in one place and reported the intention here.
  const { days, recorded, planned: stillPlanned } = weekEaten(weekDates, plan, ctx)
  // What was done as well as what was eaten. Logged on the Movement screen for
  // months and never once mentioned on a screen about the week.
  const moved = useMovementAcross(viewingAs, weekDates)
  const withFood = days.filter((d) => d.nutrients.calories > 0)
  const peak = Math.max(targets.calories, ...days.map((d) => d.nutrients.calories), 1)

  if (!withFood.length) {
    return <EmptyState title="Nothing planned yet this week">
      Add a few meals and the numbers will appear here.
    </EmptyState>
  }

  const avg = withFood.reduce((a, d) => a + d.nutrients.calories, 0) / withFood.length

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Daily average</p>
        <p className="text-3xl font-extrabold font-mono text-ink-900">
          {Math.round(avg)}<span className="text-base text-ink-500 font-semibold ml-1">kcal</span>
        </p>
        {/* Which days are records and which are still intentions. A blend of
            the two presented as one number is the thing this screen used to do
            without saying so. */}
        <p className="text-sm text-ink-700">
          across {withFood.length} {withFood.length === 1 ? 'day' : 'days'}
          {recorded > 0 && stillPlanned > 0
            ? `, ${recorded} recorded and ${stillPlanned} still planned`
            : recorded > 0 ? ', all recorded' : ', all planned'}
          {' · '}target {targets.calories}
        </p>
      </div>

      <MovementWeek moved={moved} />

      <section>
        <SectionHeading>Calories by day</SectionHeading>
        <div className="card p-5">
          {/* The target used to be labelled on the line itself, where it sat on
              top of any bar reaching a similar height, measured 24px of overlap
              on a phone. It reads as a legend instead, and the line stays bare. */}
          <p className="flex items-center gap-2 mb-3 text-xs text-ink-500">
            <span className="w-6 border-t-2 border-dashed border-ink-900/25" aria-hidden="true" />
            target {targets.calories.toLocaleString()} kcal
            {recorded > 0 && (
              <span className="ml-1">
                · <span className="text-teal-700 font-bold">{'\u2713'}</span> recorded, the rest planned
              </span>
            )}
          </p>
          <div className="relative flex items-end gap-2 h-40">
            <div
              className="absolute inset-x-0 border-t-2 border-dashed border-ink-900/25 pointer-events-none"
              style={{ bottom: `${Math.min(96, (targets.calories / peak) * 100)}%` }}
            />
            {days.map((d) => {
              const kcal = d.nutrients.calories
              const height = (kcal / peak) * 100
              const status = targetStatus(kcal, targets.calories)
              return (
                // The figures sit under the bars, not above them: above, they
                // land exactly where the target line runs whenever the week is
                // near target, and the dashes struck through the digits.
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  {/* Over target used to be carried by hue alone, which
                      lib/status.ts exists to prevent: it hands back a label and
                      a symbol precisely so a bar does not have to be red to
                      mean something. The symbol rides above the bar. */}
                  <span
                    className={`text-[11px] font-bold leading-none h-3 ${STATUS_STYLES[status.level].text}`}
                    aria-hidden="true"
                  >
                    {status.symbol}
                  </span>
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${STATUS_STYLES[status.level].fill}`}
                    style={{ height: `${Math.max(height, kcal > 0 ? 4 : 0)}%` }}
                  />
                  <span className="text-[11px] font-mono text-ink-900 tabular-nums leading-none">
                    {kcal > 0 ? Math.round(kcal) : ''}
                  </span>
                  {/* A recorded day and a planned one are different claims, so
                      the difference is a mark under the day rather than a shade
                      of the same bar. */}
                  <span
                    className="text-[11px] text-ink-500 leading-none"
                    title={d.any ? (d.recorded ? 'recorded' : 'planned') : undefined}
                  >
                    {new Date(d.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'narrow' })}
                    {d.recorded ? <span className="text-teal-700 font-bold">{'\u2009\u2713'}</span> : null}
                  </span>
                </div>
              )
            })}
          </div>

        </div>
      </section>
    </div>
  )
}

/** Servings against the guide's goals, which is what the diet is actually about. */
/**
 * The week's movement, next to the week's food.
 *
 * Days rather than a total, because a week with four half hours in it and a
 * week with one long Sunday are different weeks and one number cannot tell
 * them apart. Nothing is subtracted from the food: see lib/movement.ts for why
 * the target stays where the dietician put it.
 */
function MovementWeek({ moved }: { moved: { date: string; movement: DayMovement }[] }) {
  const active = moved.filter((d) => d.movement.sessions > 0)
  // Nothing logged is nothing to show. A card reporting zero of everything is
  // a scolding rather than a summary.
  if (!active.length) return null

  const minutes = active.reduce((n, d) => n + d.movement.minutes, 0)
  // Only the days that could be costed. Summing a week where one day has no
  // weight behind it and calling the result the week's total would report a
  // smaller number than the week actually was, without saying so.
  const costed = active.filter((d) => d.movement.kcal != null)
  const kcal = costed.reduce((n, d) => n + (d.movement.kcal ?? 0), 0)

  return (
    <section>
      <SectionHeading>Movement</SectionHeading>
      <div className="card p-5 space-y-3">
        <p className="text-sm text-ink-700">
          <strong className="font-mono text-ink-900">{active.length}</strong>
          {active.length === 1 ? ' day' : ' days'} with something logged
          {' · '}
          <strong className="font-mono text-ink-900">{minutes}</strong> min
          {costed.length > 0 && (
            <> · about <strong className="font-mono text-ink-900">
              {Math.round(kcal).toLocaleString()}
            </strong> kcal</>
          )}
        </p>

        {/* A bar per day of the week, in minutes. Same seven columns as the
            calorie chart above it, so the two read against each other. */}
        <div className="flex items-end gap-1 h-16" aria-hidden="true">
          {moved.map(({ date, movement }) => {
            const tallest = Math.max(...moved.map((d) => d.movement.minutes), 1)
            return (
              <div key={date} className="flex-1 flex flex-col justify-end h-full">
                <div
                  className={movement.minutes > 0 ? 'bg-teal-500 rounded-t-sm' : 'bg-border-200 rounded-t-sm'}
                  style={{ height: `${Math.max(2, (movement.minutes / tallest) * 100)}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex gap-1 text-[10px] font-bold uppercase text-ink-500">
          {moved.map(({ date, movement }) => (
            <span key={date} className="flex-1 text-center">
              {movement.minutes > 0 ? `${movement.minutes}m` : '·'}
            </span>
          ))}
        </div>

        <p className="text-xs text-ink-500">
          {costed.length < active.length
            ? 'Some days have no weight recorded, so they carry minutes but no calorie estimate. '
            : ''}
          Calories here are an estimate from a table of averages, and none of it is taken off your
          food target: the plans were written for two people who move.
        </p>
      </div>
    </section>
  )
}

function MediterraneanTab() {
  const plan = useMealPlanStore((s) => s.plan)
  const weekDates = useThisWeek()
  const ctx = useNutritionContext()
  const week = useMemo(
    () => plan.filter((d) => weekDates.includes(d.date)),
    [plan, weekDates],
  )
  const goals = useMemo(() => scoreWeek(week, ctx), [week, ctx])
  const gaps = useMemo(() => scoreGaps(week, ctx), [week, ctx])
  const planned = week.filter((d) => d.meals.length).length

  if (!planned) {
    return <EmptyState title="Nothing to score yet">
      The Mediterranean serving goals need a planned week to measure against.
    </EmptyState>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-700">
        Serving goals from the Mediterranean Diet guide, scaled to the {planned}{' '}
        {planned === 1 ? 'day' : 'days'} planned so far.
      </p>
      {/* What the count had to leave out. Dropping a food mid-count and then
          presenting the total as the week is the same silence that let the
          serving figures go unquestioned for months. */}
      {(gaps.noGoal.length > 0 || gaps.lost > 0) && (
        <div className="card p-4 space-y-1.5">
          {gaps.noGoal.length > 0 && (
            <p className="text-sm text-ink-700">
              {gaps.noGoal.length} {gaps.noGoal.length === 1 ? 'food' : 'foods'} could not be
              counted as servings, because the guide has no serving size for{' '}
              {gaps.noGoal.length === 1 ? 'it' : 'them'}:{' '}
              <span className="text-ink-900">{gaps.noGoal.join(', ')}</span>.
            </p>
          )}
          {gaps.lost > 0 && (
            <p className="text-sm text-coral-700">
              {gaps.lost} {gaps.lost === 1 ? 'thing is' : 'things are'} missing from the library
              altogether, so these counts are short by an unknown amount.
            </p>
          )}
        </div>
      )}

      {/* Two lists, not one. A goal and a limit are opposite questions and had
          the same row and the same filling bar, so a nearly-full bar meant
          "nearly there" on one and "nearly over" on the other, with only hue
          to tell them apart. Split, the shape of the list says which is which
          before any colour does. */}
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500 pt-1">Aim for</p>
      <div className="card divide-y divide-border-100">
        {goals.filter((g) => !g.isLimit).map((g) => {
          const pct = Math.min(1, g.ratio)
          const met = g.isLimit ? g.ratio <= 1 : g.ratio >= 0.9
          return (
            <div key={g.category} className="px-4 py-3">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-semibold text-ink-900">
                  {g.label}
                  <span className="ml-2 text-xs font-normal text-ink-500">
                    {g.isLimit ? 'at most ' : ''}{g.target} / {g.period}
                  </span>
                </span>
                <span className={`text-xs font-mono ${
                  g.ratio > IMPLAUSIBLE_RATIO ? 'text-coral-700'
                    : met ? 'text-bite-700' : 'text-ink-500'}`}>
                  {/* Named, because "42.1 of 21" with no unit reads as a
                      broken number rather than a big one. */}
                  {servingCount(g.servings)} of {servingCount(g.expected)} servings
                </span>
              </div>
              <div className="h-2 rounded-full bg-border-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    g.isLimit ? (g.ratio > 1 ? 'bg-coral-500' : 'bg-teal-400')
                              : (met ? 'bg-teal-500' : 'bg-ink-300')}`}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
              {/* Three times a target is not a good week, it is a number to
                  doubt. This screen once rendered "80.7 of 21" as a result. */}
              {g.ratio > IMPLAUSIBLE_RATIO && (
                <p className="mt-1.5 text-xs text-coral-700">
                  That is {g.ratio.toFixed(0)} times the goal, which is more likely a problem with
                  the data than a week of eating. Worth checking the foods in it.
                </p>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs font-bold uppercase tracking-wide text-ink-500 pt-1">Keep under</p>
      <div className="card divide-y divide-border-100">
        {goals.filter((g) => g.isLimit).map((g) => (
          <div key={g.category} className="px-4 py-3 flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-ink-900">
              {g.label}
              <span className="ml-2 text-xs font-normal text-ink-500">
                at most {g.target} / {g.period}
              </span>
            </span>
            {/* No bar at all. There is nothing to fill up here: you are either
                inside the line or over it, and that is a word, not a length. */}
            <span className={`text-xs font-mono shrink-0 ${
              g.ratio > 1 ? 'text-coral-700' : 'text-ink-500'}`}>
              {servingCount(g.servings)} of {servingCount(g.expected)}
              <span className="ml-1.5 font-sans font-semibold">
                {g.ratio > 1 ? 'over' : 'within'}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BodyTab() {
  const {
    addWeightEntry, removeWeightEntry, addMeasurement, removeMeasurement, claimUnassigned,
  } = useBodyStore()
  const { profile, setWeightGoal } = useUserStore()

  // Both people are always on screen, signed in or not. Two waists averaged
  // into one line is a graph of nothing, and a tab that only appears once
  // somebody signs in is a tab nobody finds.
  const [who, setWho] = useState<PersonId>(PEOPLE[0].id)
  const unassigned = useUnassignedCount()

  const weights = useWeightFor(who)
  const measurements = useMeasurementsFor(who)

  /*
   * Everything on this screen, in the unit you asked to read in.
   *
   * The store keeps what you typed and the unit you typed it in, and this is
   * where that becomes a number on a page. Before the setting was settable it
   * did not matter: every entry said kg and so did the profile, so printing
   * the stored figure with the profile's label next to it happened to be
   * right. It stops being right the moment somebody switches, so the reading
   * goes through lib/weight.ts and the store is left alone.
   *
   * Goals are held in kilograms whatever the reading unit, because a goal is a
   * bare number with no unit of its own to remember.
   */
  const unit = profile.weightUnit
  const shown = useMemo(() => weights.map((w) => inUnit(w, unit)), [weights, unit])
  const goalKg = profile.weightGoals?.[who]
  const goal = goalKg == null ? undefined : round1(fromKg(goalKg, unit))

  const [value, setValue] = useState('')
  const [sizes, setSizes] = useState<Partial<Record<MeasurementKey, string>>>({})

  // Both ends in the same unit before subtracting: a first entry in pounds and
  // a latest in kilograms differenced raw is not a change, it is a subtraction
  // of two different things.
  const change = shown.length > 1 ? round1(shown[shown.length - 1] - shown[0]) : 0
  const anySize = MEASUREMENT_KEYS.some((k) => Number(sizes[k]))

  return (
    <div className="space-y-5">
      {/* Whose body. Named, so it does not read as more of the row above. */}
      <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit" role="tablist" aria-label="Whose">
        {PEOPLE.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={who === p.id}
            onClick={() => setWho(p.id)}
            className={who === p.id ? 'tab-on' : 'tab-off'}
          >
            {p.name}
          </button>
        ))}
      </div>

      {unassigned > 0 && (
        <div className="rounded-2xl border border-bite-200 bg-bite-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="flex-1 min-w-0 text-sm text-ink-900">
            {unassigned} {unassigned === 1 ? 'entry was' : 'entries were'} logged before the app
            knew who was who. They are nobody's until you say so.
          </p>
          <button className="btn-primary shrink-0" onClick={() => claimUnassigned(who)}>
            {PEOPLE.find((p) => p.id === who)?.name}'s
          </button>
        </div>
      )}

      {/* ─── Weight ──────────────────────────────────────────────────────── */}
      <div className="card p-4">
        <label className="label">Log today's weight ({unit})</label>
        <div className="flex gap-2">
          <input
            type="number" step="0.1" className="input" placeholder="e.g. 68.4"
            aria-label="Weight"
            value={value} onChange={(e) => setValue(e.target.value)}
          />
          <button
            className="btn-primary shrink-0"
            disabled={!Number(value)}
            onClick={() => {
              addWeightEntry({
                id: `${Date.now()}`,
                date: today(),
                weight: Number(value),
                // Stored as typed, in the unit it was typed in. Converting on
                // the way in would round somebody's 68.4 into 150.8 and back
                // into 68.399, and the entry would drift every time the
                // setting was flipped.
                unit,
                memberId: who,
              })
              setValue('')
            }}
          >
            <Plus size={16} /> Log
          </button>
        </div>
      </div>

      {weights.length === 0 ? (
        <EmptyState title="No weight logged yet" />
      ) : (
        <>
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Since you started</p>
            <p className={`text-3xl font-extrabold font-mono ${change <= 0 ? 'text-bite-700' : 'text-coral-600'}`}>
              {change > 0 ? '+' : ''}{change.toFixed(1)}
              <span className="text-base text-ink-500 font-semibold ml-1">{unit}</span>
            </p>
            {goal != null && weights.length > 0 && (
              <p className="text-xs text-ink-500 mt-1">
                {(() => {
                  const togo = shown[shown.length - 1] - (goal ?? 0)
                  return Math.abs(togo) < 0.05
                    ? 'At your goal.'
                    : `${Math.abs(togo).toFixed(1)} ${unit} ${togo > 0 ? 'to go' : 'below your goal'}.`
                })()}
              </p>
            )}
            <Sparkline values={shown} goal={goal} />

            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-100">
              <label className="label mb-0 shrink-0" htmlFor="goal">Aiming for</label>
              <input
                id="goal"
                type="number" min={0} step={0.1} className="input w-24 px-2"
                placeholder="none"
                value={goal ?? ''}
                // Typed in whatever you read in, held in kilograms.
                onChange={(e) => setWeightGoal(
                  who,
                  e.target.value ? toKg(Number(e.target.value), unit) : undefined,
                )}
              />
              <span className="text-sm text-ink-500">{unit}</span>
            </div>
          </div>

          <div className="card divide-y divide-border-100">
            {[...weights].reverse().map((w) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-ink-700">{formatDay(w.date)}</span>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-mono font-semibold text-ink-900">
                  {inUnit(w, unit)} {unit}
                  {/* What you actually typed, where it was another unit. The
                      converted figure is the comparable one and the typed one
                      is the true one, and dropping either loses something. */}
                  {w.unit !== unit && (
                    <span className="ml-1.5 font-normal text-ink-500">({w.weight} {w.unit})</span>
                  )}
                </span>
                  <button className="text-xs text-ink-500 hover:text-coral-600" onClick={() => removeWeightEntry(w.id)}>
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─── The tape measure ────────────────────────────────────────────── */}
      <SectionHeading>Measurements</SectionHeading>
      <div className="card p-4 space-y-3">
        <p className="text-xs text-ink-500">
          In centimetres. Fill in whichever you took. A blank is simply not measured that day,
          and the trend below skips it rather than reading it as a change.
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {MEASUREMENT_KEYS.map((key) => (
            <div key={key}>
              <label className="label">{MEASUREMENT_LABELS[key]}</label>
              <input
                type="number" step="0.5" min={0} className="input px-2"
                aria-label={MEASUREMENT_LABELS[key]}
                value={sizes[key] ?? ''}
                onChange={(e) => setSizes((s) => ({ ...s, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <button
          className="btn-primary w-fit"
          disabled={!anySize}
          onClick={() => {
            const taken: Partial<Record<MeasurementKey, number>> = {}
            for (const key of MEASUREMENT_KEYS) {
              const n = Number(sizes[key])
              if (n > 0) taken[key] = n
            }
            addMeasurement({
              id: `${Date.now()}`,
              date: today(),
              measurements: taken,
              unit: 'cm',
              memberId: who,
            })
            setSizes({})
          }}
        >
          <Plus size={16} /> Log measurements
        </button>
      </div>

      {measurements.length === 0 ? (
        <EmptyState title="Nothing measured yet" mood="thinking">
          Waist, hips, chest, arms and thighs, each one its own line, because they move at
          different times and an average of the five says nothing.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {MEASUREMENT_KEYS.map((key) => {
              const series = measurements
                .map((m) => m.measurements[key])
                .filter((v): v is number => v != null)
              if (!series.length) return null

              const delta = series.length > 1 ? series[series.length - 1] - series[0] : 0
              return (
                <div key={key} className="card p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-500">
                    {MEASUREMENT_LABELS[key]}
                  </p>
                  <p className="text-2xl font-extrabold font-mono text-ink-900">
                    {series[series.length - 1]}<span className="text-sm text-ink-500 font-semibold ml-1">cm</span>
                    {series.length > 1 && (
                      <span className={`text-sm font-semibold ml-2 ${delta <= 0 ? 'text-bite-700' : 'text-coral-600'}`}>
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                      </span>
                    )}
                  </p>
                  {series.length > 1 && <Sparkline values={series} />}
                </div>
              )
            })}
          </div>

          <div className="card divide-y divide-border-100">
            {[...measurements].reverse().map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm text-ink-700">{formatDay(m.date)}</span>
                  <span className="block text-xs font-mono text-ink-500">
                    {MEASUREMENT_KEYS
                      .filter((k) => m.measurements[k] != null)
                      .map((k) => `${MEASUREMENT_LABELS[k].toLowerCase()} ${m.measurements[k]}`)
                      .join(' · ')}
                  </span>
                </span>
                <button className="text-xs text-ink-500 hover:text-coral-600 shrink-0"
                  onClick={() => removeMeasurement(m.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function formatDay(date: string): string {
  return new Date(date + 'T12:00:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Sparkline({ values, goal }: { values: number[]; goal?: number }) {
  if (values.length < 2) return null
  // The goal is part of the range, or a line above the chart is a line you
  // cannot see, which is worse than no line.
  const all = goal ? [...values, goal] : values
  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = max - min || 1
  const y = (v: number) => 30 - ((v - min) / span) * 26
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${y(v)}`).join(' ')

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-16 mt-3">
      {goal != null && (
        <line
          x1="0" x2="100" y1={y(goal)} y2={y(goal)}
          strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 3"
          className="stroke-ink-300"
        />
      )}
      <polyline points={points} fill="none" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
        className="stroke-teal-500" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
