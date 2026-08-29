import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useMealPlanStore } from '../store/useMealPlanStore'
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
import { dayNutrients, emptyNutrients } from '../lib/nutrition'
import { scoreWeek } from '../lib/mediterranean'
import { STATUS_STYLES, targetStatus } from '../lib/status'
import { EmptyState, SectionHeading } from '../components/ui'

type Tab = 'week' | 'mediterranean' | 'body'

export default function Analytics() {
  const [tab, setTab] = useState<Tab>('week')

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header>
          <h1 className="display text-xl sm:text-2xl text-ink-900">Progress</h1>
          <p className="text-sm text-ink-700">How your week is shaping up.</p>
        </header>

        {/* Announced as tabs, like every other strip in the app. These were
            plain buttons, so nothing told a screen reader they were a set or
            which one was current. */}
        <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit" role="tablist">
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
  const { plan, weekDates } = useMealPlanStore()
  const { profile } = useUserStore()
  const viewingAs = useUiStore((s) => s.viewingAs)
  const targets = targetsFor(profile, viewingAs)
  const ctx = useNutritionContext()

  // The week on screen, not every day the app has ever held. Under a tab
  // labelled "This week" the whole plan was charted, so a week planned a
  // fortnight ago was still being shown as though it were this one.
  const days = weekDates.map((date) => {
    const day = plan.find((d) => d.date === date)
    return { date, n: day ? dayNutrients(day, ctx) : emptyNutrients() }
  })
  const planned = days.filter((d) => d.n.calories > 0)
  const peak = Math.max(targets.calories, ...days.map((d) => d.n.calories), 1)

  if (!planned.length) {
    return <EmptyState title="Nothing planned yet this week">
      Add a few meals and the numbers will appear here.
    </EmptyState>
  }

  const avg = planned.reduce((a, d) => a + d.n.calories, 0) / planned.length

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Daily average</p>
        <p className="text-3xl font-extrabold font-mono text-ink-900">
          {Math.round(avg)}<span className="text-base text-ink-500 font-semibold ml-1">kcal</span>
        </p>
        <p className="text-sm text-ink-700">
          across {planned.length} planned {planned.length === 1 ? 'day' : 'days'} · target {targets.calories}
        </p>
      </div>

      <section>
        <SectionHeading>Calories by day</SectionHeading>
        <div className="card p-5">
          {/* The target used to be labelled on the line itself, where it sat on
              top of any bar reaching a similar height, measured 24px of overlap
              on a phone. It reads as a legend instead, and the line stays bare. */}
          <p className="flex items-center gap-2 mb-3 text-xs text-ink-500">
            <span className="w-6 border-t-2 border-dashed border-ink-900/25" aria-hidden="true" />
            target {targets.calories.toLocaleString()} kcal
          </p>
          <div className="relative flex items-end gap-2 h-40">
            <div
              className="absolute inset-x-0 border-t-2 border-dashed border-ink-900/25 pointer-events-none"
              style={{ bottom: `${Math.min(96, (targets.calories / peak) * 100)}%` }}
            />
            {days.map((d) => {
              const height = (d.n.calories / peak) * 100
              const status = targetStatus(d.n.calories, targets.calories)
              return (
                // The figures sit under the bars, not above them: above, they
                // land exactly where the target line runs whenever the week is
                // near target, and the dashes struck through the digits.
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${STATUS_STYLES[status.level].fill}`}
                    style={{ height: `${Math.max(height, d.n.calories > 0 ? 4 : 0)}%` }}
                  />
                  <span className="text-[11px] font-mono text-ink-900 tabular-nums leading-none">
                    {d.n.calories > 0 ? Math.round(d.n.calories) : ''}
                  </span>
                  <span className="text-[11px] text-ink-500 leading-none">
                    {new Date(d.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'narrow' })}
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
function MediterraneanTab() {
  const { plan, weekDates } = useMealPlanStore()
  const ctx = useNutritionContext()
  const week = useMemo(
    () => plan.filter((d) => weekDates.includes(d.date)),
    [plan, weekDates],
  )
  const goals = useMemo(() => scoreWeek(week, ctx), [week, ctx])
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
      <div className="card divide-y divide-border-100">
        {goals.map((g) => {
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
                <span className={`text-xs font-mono ${met ? 'text-bite-700' : 'text-ink-500'}`}>
                  {/* Named, because "42.1 of 21" with no unit reads as a
                      broken number rather than a big one. */}
                  {g.servings.toFixed(1)} of {g.expected.toFixed(0)} servings
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
            </div>
          )
        })}
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
  const goal = profile.weightGoals?.[who]
  const measurements = useMeasurementsFor(who)

  const [value, setValue] = useState('')
  const [sizes, setSizes] = useState<Partial<Record<MeasurementKey, string>>>({})

  const change = weights.length > 1 ? weights[weights.length - 1].weight - weights[0].weight : 0
  const anySize = MEASUREMENT_KEYS.some((k) => Number(sizes[k]))

  return (
    <div className="space-y-5">
      {/* Whose body. */}
      <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit" role="tablist">
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
        <label className="label">Log today's weight ({profile.weightUnit})</label>
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
                unit: profile.weightUnit,
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
              <span className="text-base text-ink-500 font-semibold ml-1">{profile.weightUnit}</span>
            </p>
            {goal != null && weights.length > 0 && (
              <p className="text-xs text-ink-500 mt-1">
                {(() => {
                  const togo = weights[weights.length - 1].weight - goal
                  return Math.abs(togo) < 0.05
                    ? 'At your goal.'
                    : `${Math.abs(togo).toFixed(1)} ${profile.weightUnit} ${togo > 0 ? 'to go' : 'below your goal'}.`
                })()}
              </p>
            )}
            <Sparkline values={weights.map((w) => w.weight)} goal={goal} />

            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-100">
              <label className="label mb-0 shrink-0" htmlFor="goal">Aiming for</label>
              <input
                id="goal"
                type="number" min={0} step={0.1} className="input w-24 px-2"
                placeholder="none"
                value={goal ?? ''}
                onChange={(e) => setWeightGoal(who, e.target.value ? Number(e.target.value) : undefined)}
              />
              <span className="text-sm text-ink-500">{profile.weightUnit}</span>
            </div>
          </div>

          <div className="card divide-y divide-border-100">
            {[...weights].reverse().map((w) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-ink-700">{formatDay(w.date)}</span>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-mono font-semibold text-ink-900">{w.weight} {w.unit}</span>
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
