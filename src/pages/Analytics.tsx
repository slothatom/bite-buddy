import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useUserStore } from '../store/useUserStore'
import { useBodyStore } from '../store/useBodyStore'
import { useNutritionContext } from '../store/useNutrition'
import { dayNutrients } from '../lib/nutrition'
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

        <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit">
          {([['week', 'This week'], ['mediterranean', 'Mediterranean'], ['body', 'Body']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={tab === k ? 'tab-on' : 'tab-off'}>
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
  const { plan } = useMealPlanStore()
  const { profile } = useUserStore()
  const ctx = useNutritionContext()

  const days = plan.map((d) => ({ date: d.date, n: dayNutrients(d, ctx) }))
  const planned = days.filter((d) => d.n.calories > 0)
  const peak = Math.max(profile.targets.calories, ...days.map((d) => d.n.calories), 1)

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
          across {planned.length} planned {planned.length === 1 ? 'day' : 'days'} · target {profile.targets.calories}
        </p>
      </div>

      <section>
        <SectionHeading>Calories by day</SectionHeading>
        <div className="card p-5">
          {/* The target used to be labelled on the line itself, where it sat on
              top of any bar reaching a similar height — measured 24px of overlap
              on a phone. It reads as a legend instead, and the line stays bare. */}
          <p className="flex items-center gap-2 mb-3 text-xs text-ink-500">
            <span className="w-6 border-t-2 border-dashed border-ink-900/25" aria-hidden="true" />
            target {profile.targets.calories.toLocaleString()} kcal
          </p>
          <div className="relative flex items-end gap-2 h-40">
            <div
              className="absolute inset-x-0 border-t-2 border-dashed border-ink-900/25 pointer-events-none"
              style={{ bottom: `${Math.min(96, (profile.targets.calories / peak) * 100)}%` }}
            />
            {days.map((d) => {
              const height = (d.n.calories / peak) * 100
              const status = targetStatus(d.n.calories, profile.targets.calories)
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
  const { plan } = useMealPlanStore()
  const ctx = useNutritionContext()
  const goals = useMemo(() => scoreWeek(plan, ctx), [plan, ctx])
  const planned = plan.filter((d) => d.meals.length).length

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
                  {g.servings.toFixed(1)} of {g.expected.toFixed(0)}
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
  const { weightEntries, addWeightEntry, removeWeightEntry } = useBodyStore()
  const { profile } = useUserStore()
  const [value, setValue] = useState('')

  const sorted = [...weightEntries].sort((a, b) => a.date.localeCompare(b.date))
  const change = sorted.length > 1 ? sorted[sorted.length - 1].weight - sorted[0].weight : 0

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <label className="label">Log today's weight ({profile.weightUnit})</label>
        <div className="flex gap-2">
          <input
            type="number" step="0.1" className="input" placeholder="e.g. 68.4"
            value={value} onChange={(e) => setValue(e.target.value)}
          />
          <button
            className="btn-primary shrink-0"
            disabled={!Number(value)}
            onClick={() => {
              addWeightEntry({
                id: `${Date.now()}`,
                date: new Date().toISOString().slice(0, 10),
                weight: Number(value),
                unit: profile.weightUnit,
              })
              setValue('')
            }}
          >
            <Plus size={16} /> Log
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState title="No weight logged yet" />
      ) : (
        <>
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">Since you started</p>
            <p className={`text-3xl font-extrabold font-mono ${change <= 0 ? 'text-bite-700' : 'text-coral-600'}`}>
              {change > 0 ? '+' : ''}{change.toFixed(1)}
              <span className="text-base text-ink-500 font-semibold ml-1">{profile.weightUnit}</span>
            </p>
            <Sparkline values={sorted.map((w) => w.weight)} />
          </div>

          <div className="card divide-y divide-border-100">
            {[...sorted].reverse().map((w) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-ink-700">
                  {new Date(w.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-mono font-semibold text-ink-900">{w.weight} {w.unit}</span>
                  <button className="text-xs text-ink-300 hover:text-coral-600" onClick={() => removeWeightEntry(w.id)}>
                    Remove
                  </button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / span) * 26}`)
    .join(' ')

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-16 mt-3">
      <polyline points={points} fill="none" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
        className="stroke-teal-500" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
