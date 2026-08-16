import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useUserStore } from '../store/useUserStore'
import { useBodyStore } from '../store/useBodyStore'
import { useNutritionContext } from '../store/useNutrition'
import { dayNutrients } from '../lib/nutrition'
import { scoreWeek } from '../lib/mediterranean'
import { EmptyState, SectionHeading } from '../components/ui'

type Tab = 'week' | 'mediterranean' | 'body'

export default function Analytics() {
  const [tab, setTab] = useState<Tab>('week')

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header>
          <h1 className="text-2xl font-extrabold text-stone-800">Progress</h1>
          <p className="text-sm text-stone-500">How the planned week measures up.</p>
        </header>

        <div className="flex gap-1 p-1 bg-sand-100 rounded-xl w-fit">
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
    return <EmptyState emoji="📊" title="Nothing planned this week">
      Add meals in the planner and the numbers will show up here.
    </EmptyState>
  }

  const avg = planned.reduce((a, d) => a + d.n.calories, 0) / planned.length

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Daily average</p>
        <p className="text-3xl font-extrabold font-mono text-stone-800">
          {Math.round(avg)}<span className="text-base text-stone-400 font-semibold ml-1">kcal</span>
        </p>
        <p className="text-sm text-stone-500">
          across {planned.length} planned {planned.length === 1 ? 'day' : 'days'} · target {profile.targets.calories}
        </p>
      </div>

      <section>
        <SectionHeading>Calories by day</SectionHeading>
        <div className="card p-5">
          <div className="flex items-end gap-2 h-40">
            {days.map((d) => {
              const height = (d.n.calories / peak) * 100
              const over = d.n.calories > profile.targets.calories * 1.05
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[10px] font-mono text-stone-400">
                    {d.n.calories > 0 ? Math.round(d.n.calories) : ''}
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all duration-500 ${over ? 'bg-clay-400' : 'bg-brand-400'}`}
                    style={{ height: `${Math.max(height, d.n.calories > 0 ? 4 : 0)}%` }}
                  />
                  <span className="text-[10px] text-stone-400">
                    {new Date(d.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'narrow' })}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="relative mt-2 pt-2 border-t border-dashed border-sand-300">
            <span className="text-[10px] text-stone-400">Target {profile.targets.calories} kcal</span>
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
    return <EmptyState emoji="🫒" title="Nothing planned this week">
      The Mediterranean serving goals need a planned week to score against.
    </EmptyState>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-500">
        Serving goals from the Mediterranean Diet guide, scaled to the {planned}{' '}
        {planned === 1 ? 'day' : 'days'} planned so far.
      </p>
      <div className="card divide-y divide-sand-100">
        {goals.map((g) => {
          const pct = Math.min(1, g.ratio)
          const met = g.isLimit ? g.ratio <= 1 : g.ratio >= 0.9
          return (
            <div key={g.category} className="px-4 py-3">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-semibold text-stone-800">
                  {g.label}
                  <span className="ml-2 text-xs font-normal text-stone-400">
                    {g.isLimit ? 'at most ' : ''}{g.target} / {g.period}
                  </span>
                </span>
                <span className={`text-xs font-mono ${met ? 'text-brand-700' : 'text-stone-400'}`}>
                  {g.servings.toFixed(1)} of {g.expected.toFixed(0)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-sand-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    g.isLimit ? (g.ratio > 1 ? 'bg-clay-500' : 'bg-brand-400')
                              : (met ? 'bg-brand-500' : 'bg-sand-400')}`}
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
        <EmptyState emoji="⚖️" title="No weight logged yet" />
      ) : (
        <>
          <div className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Since you started</p>
            <p className={`text-3xl font-extrabold font-mono ${change <= 0 ? 'text-brand-700' : 'text-clay-600'}`}>
              {change > 0 ? '+' : ''}{change.toFixed(1)}
              <span className="text-base text-stone-400 font-semibold ml-1">{profile.weightUnit}</span>
            </p>
            <Sparkline values={sorted.map((w) => w.weight)} />
          </div>

          <div className="card divide-y divide-sand-100">
            {[...sorted].reverse().map((w) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-stone-600">
                  {new Date(w.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-mono font-semibold text-stone-800">{w.weight} {w.unit}</span>
                  <button className="text-xs text-stone-300 hover:text-clay-600" onClick={() => removeWeightEntry(w.id)}>
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
        className="stroke-brand-500" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
