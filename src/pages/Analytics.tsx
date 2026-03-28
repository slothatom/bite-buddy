import { useState } from 'react'
import { Scale, TrendingDown, TrendingUp, Minus, Plus, Trash2, Ruler } from 'lucide-react'
import { useBodyStore } from '../store/useBodyStore'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useRecipeStore } from '../store/useRecipeStore'
import { useUserStore } from '../store/useUserStore'
import type { WeightEntry, BodyMeasurement } from '../types'

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Mini sparkline ────────────────────────────────────────────────────────────
function Sparkline({ values, color = '#22c55e' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 120, h = 40, pad = 4
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── Weight Log ────────────────────────────────────────────────────────────────
function WeightLog() {
  const { weightEntries, addWeightEntry, removeWeightEntry } = useBodyStore()
  const { profile, unlockAchievement } = useUserStore()
  const [weight, setWeight] = useState('')
  const [unit, setUnit] = useState<'kg' | 'lbs'>(profile.weightUnit ?? 'kg')
  const [notes, setNotes] = useState('')
  const today = new Date().toISOString().split('T')[0]

  function handleAdd() {
    if (!weight || isNaN(+weight)) return
    const entry: WeightEntry = {
      id: newId(), date: today, weight: +weight, unit, notes,
    }
    addWeightEntry(entry)
    unlockAchievement('weight_logged')
    setWeight(''); setNotes('')
  }

  const sorted = [...weightEntries].sort((a, b) => a.date.localeCompare(b.date))
  const last5 = sorted.slice(-5)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const change = first && last ? last.weight - first.weight : null

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale size={18} className="text-brand-600" />
          <h2 className="section-title">Weight Log</h2>
        </div>
        {change !== null && (
          <div className={`flex items-center gap-1 badge ${change < 0 ? 'badge-green' : change > 0 ? 'badge-red' : 'badge-gray'}`}>
            {change < 0 ? <TrendingDown size={12} /> : change > 0 ? <TrendingUp size={12} /> : <Minus size={12} />}
            {Math.abs(change).toFixed(1)} {last?.unit}
          </div>
        )}
      </div>

      {/* Sparkline */}
      {sorted.length >= 2 && (
        <div className="flex items-end gap-3">
          <Sparkline values={sorted.map((e) => e.weight)} />
          <div className="text-xs text-gray-400">
            <p className="font-semibold text-gray-700 text-base">{last?.weight} {last?.unit}</p>
            <p>current</p>
          </div>
        </div>
      )}

      {/* Add entry */}
      <div className="flex gap-2">
        <input type="number" step="0.1" min={0} className="input flex-1" placeholder="Weight"
          value={weight} onChange={(e) => setWeight(e.target.value)} />
        <select className="input w-20" value={unit} onChange={(e) => setUnit(e.target.value as 'kg' | 'lbs')}>
          <option value="kg">kg</option>
          <option value="lbs">lbs</option>
        </select>
        <button className="btn-primary" onClick={handleAdd}><Plus size={15} /></button>
      </div>

      {/* Recent entries */}
      {last5.length > 0 && (
        <div className="space-y-1">
          {[...last5].reverse().map((entry) => (
            <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <div>
                <span className="font-mono font-semibold text-sm text-gray-900">{entry.weight} {entry.unit}</span>
                {entry.notes && <span className="text-xs text-gray-400 ml-2">{entry.notes}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{formatDate(entry.date)}</span>
                <button className="text-gray-300 hover:text-red-400 transition-colors" onClick={() => removeWeightEntry(entry.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Body Measurements ─────────────────────────────────────────────────────────
function BodyMeasurements() {
  const { measurements, addMeasurement, removeMeasurement } = useBodyStore()
  const [form, setForm] = useState({ waist: '', hips: '', chest: '', arms: '', thighs: '', unit: 'cm' as 'cm' | 'in' })
  const today = new Date().toISOString().split('T')[0]

  function handleAdd() {
    const vals: BodyMeasurement['measurements'] = {}
    if (form.waist) vals.waist = +form.waist
    if (form.hips) vals.hips = +form.hips
    if (form.chest) vals.chest = +form.chest
    if (form.arms) vals.arms = +form.arms
    if (form.thighs) vals.thighs = +form.thighs
    if (Object.keys(vals).length === 0) return
    addMeasurement({ id: newId(), date: today, measurements: vals, unit: form.unit })
    setForm({ waist: '', hips: '', chest: '', arms: '', thighs: '', unit: form.unit })
  }

  const latest = measurements[measurements.length - 1]

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Ruler size={18} className="text-xp-600" />
        <h2 className="section-title">Body Measurements</h2>
      </div>
      {latest && (
        <div className="grid grid-cols-3 gap-2 text-center">
          {Object.entries(latest.measurements).map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-xl px-2 py-2">
              <p className="font-bold font-mono text-gray-900">{v}<span className="text-xs text-gray-400 font-sans">{latest.unit}</span></p>
              <p className="text-xs text-gray-400 capitalize">{k}</p>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {(['waist','hips','chest','arms','thighs'] as const).map((field) => (
          <div key={field}>
            <label className="text-xs text-gray-400 mb-1 block capitalize">{field}</label>
            <input type="number" min={0} className="input text-xs" placeholder="0"
              value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Unit</label>
          <select className="input text-xs" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as 'cm' | 'in' }))}>
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </div>
      </div>
      <button className="btn-primary w-full" onClick={handleAdd}><Plus size={15} /> Log Measurements</button>
      {measurements.length > 0 && (
        <p className="text-xs text-gray-400">{measurements.length} entries logged · <button className="text-red-400 hover:underline" onClick={() => removeMeasurement(measurements[measurements.length - 1].id)}>remove last</button></p>
      )}
    </div>
  )
}

// ── Weekly Nutrition Summary ───────────────────────────────────────────────────
function WeeklyNutrition() {
  const { plan } = useMealPlanStore()
  const { recipes } = useRecipeStore()
  const { profile } = useUserStore()

  const dayData = plan.map((day) => {
    let cal = 0, p = 0, c = 0, f = 0
    day.meals.forEach((meal) => {
      const recipe = recipes.find((r) => r.id === meal.recipeId)
      if (!recipe) return
      const m = recipe.macrosPerServing
      cal += m.calories * meal.servings
      p   += m.protein  * meal.servings
      c   += m.carbs    * meal.servings
      f   += m.fat      * meal.servings
    })
    return { date: day.date, calories: Math.round(cal), protein: Math.round(p), carbs: Math.round(c), fat: Math.round(f), hasMeals: day.meals.length > 0 }
  })

  const activeDays = dayData.filter((d) => d.hasMeals)
  if (activeDays.length === 0) return (
    <div className="card p-5 text-center py-10">
      <p className="text-2xl mb-2">📊</p>
      <p className="text-gray-500 text-sm">Plan meals to see nutrition analytics</p>
    </div>
  )

  const avg = {
    calories: Math.round(activeDays.reduce((a, d) => a + d.calories, 0) / activeDays.length),
    protein:  Math.round(activeDays.reduce((a, d) => a + d.protein,  0) / activeDays.length),
    carbs:    Math.round(activeDays.reduce((a, d) => a + d.carbs,    0) / activeDays.length),
    fat:      Math.round(activeDays.reduce((a, d) => a + d.fat,      0) / activeDays.length),
  }

  return (
    <div className="card p-5 space-y-4">
      <h2 className="section-title">Weekly Nutrition</h2>
      <div className="grid grid-cols-4 gap-3 text-center">
        {[
          { k: 'calories' as const, label: 'Avg Cal', unit: 'kcal', color: 'text-amber-600', target: profile.macroTargets.calories },
          { k: 'protein'  as const, label: 'Avg Protein', unit: 'g', color: 'text-brand-600', target: profile.macroTargets.protein },
          { k: 'carbs'    as const, label: 'Avg Carbs',   unit: 'g', color: 'text-blue-600',  target: profile.macroTargets.carbs },
          { k: 'fat'      as const, label: 'Avg Fat',     unit: 'g', color: 'text-xp-600',    target: profile.macroTargets.fat },
        ].map(({ k, label, unit, color, target }) => {
          const pct = Math.min((avg[k] / target) * 100, 100)
          return (
            <div key={k}>
              <p className={`font-bold font-mono text-xl ${color}`}>{avg[k]}</p>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-[10px] text-gray-300">{unit} / day</p>
              <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full rounded-full bg-current transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">{Math.round(pct)}% goal</p>
            </div>
          )
        })}
      </div>

      {/* Per-day bars */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Calories per day</p>
        <div className="flex items-end gap-1.5 h-16">
          {dayData.map((day) => {
            const pct = profile.macroTargets.calories > 0 ? Math.min((day.calories / profile.macroTargets.calories) * 100, 100) : 0
            const isOver = day.calories > profile.macroTargets.calories
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col justify-end" style={{ height: '48px' }}>
                  <div
                    className={`w-full rounded-t-sm ${day.hasMeals ? (isOver ? 'bg-red-400' : 'bg-brand-400') : 'bg-gray-100'}`}
                    style={{ height: `${day.hasMeals ? Math.max(pct, 4) : 4}%` }}
                    title={`${day.calories} kcal`}
                  />
                </div>
                <p className="text-[9px] text-gray-400">
                  {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-gray-400">{activeDays.length} days planned this week</p>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
type AnalyticsTab = 'nutrition' | 'weight'

export default function Analytics() {
  const [tab, setTab] = useState<AnalyticsTab>('nutrition')

  return (
    <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-5 space-y-4">
        <h1 className="page-title">Analytics</h1>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['nutrition','weight'] as AnalyticsTab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize
                ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'nutrition' && <WeeklyNutrition />}
        {tab === 'weight'    && (
          <div className="space-y-4">
            <WeightLog />
            <BodyMeasurements />
          </div>
        )}
      </div>
    </div>
  )
}
