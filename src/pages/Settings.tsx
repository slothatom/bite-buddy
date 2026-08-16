import { useMemo, useState } from 'react'
import { Sparkles, Calculator, Pencil, Upload, Check } from 'lucide-react'
import type { ActivityLevel, Goal, Sex, Targets, WeekStart } from '../types'
import { useUserStore } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import { SOURCE_PLANS } from '../data'
import { ACTIVITY_LABELS, averagePlanDay, fromPlans, fromTdee, totalDailyEnergy } from '../lib/targets'
import { parseMfpCsv, type MfpDiaryEntry } from '../lib/mfp'
import { SectionHeading } from '../components/ui'

const WEEKDAYS: { value: WeekStart; label: string }[] = [
  { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

export default function Settings() {
  const { profile, setName, setTargets, setTdee, setWeekStart, setShowGamification } = useUserStore()
  const ctx = useNutritionContext()

  const planAverage = useMemo(() => averagePlanDay(SOURCE_PLANS, ctx), [ctx])
  const planTargets = useMemo(() => fromPlans(SOURCE_PLANS, ctx), [ctx])
  const tdeeTargets = fromTdee(profile.tdee)
  const tdee = totalDailyEnergy(profile.tdee)

  const [manual, setManual] = useState<Targets>(profile.targets)

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <header>
          <h1 className="text-2xl font-display font-semibold text-stone-700">Settings</h1>
          <p className="text-sm text-stone-500">Targets, the shape of your week, and your data.</p>
        </header>

        {/* ─── Targets ─────────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Daily targets</SectionHeading>
          <p className="text-sm text-stone-500 mb-4">
            Currently{' '}
            <strong className="font-mono">{profile.targets.calories} kcal</strong>{' '}
            ({profile.targets.protein}p · {profile.targets.carbs}c · {profile.targets.fat}f), set{' '}
            {profile.targets.source === 'from-plans' ? 'from your plans'
              : profile.targets.source === 'tdee' ? 'by the calculator' : 'by hand'}.
          </p>

          <div className="space-y-3">
            {/* From the plans */}
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <Sparkles size={18} className="text-brand-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-stone-800 text-sm">From your dietician's plans</h3>
                  {planAverage ? (
                    <>
                      <p className="text-sm text-stone-500 mt-0.5">
                        Averaged over {planAverage.days} full days:{' '}
                        <strong className="font-mono text-stone-700">{planAverage.perDay.calories} kcal</strong>{' '}
                        · {planAverage.perDay.protein}p · {planAverage.perDay.carbs}c · {planAverage.perDay.fat}f
                        · {planAverage.perDay.fiber}g fibre
                      </p>
                      <p className="text-xs text-stone-400 mt-1">
                        Individual days ranged from {planAverage.min} to {planAverage.max} kcal.
                      </p>
                      <button className="btn-primary mt-3" onClick={() => planTargets && setTargets(planTargets)}>
                        Use these
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-stone-400 mt-0.5">No plan data available.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Calculator */}
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <Calculator size={18} className="text-brand-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-semibold text-stone-800 text-sm">Work it out from your body</h3>
                    <p className="text-xs text-stone-400">
                      Mifflin-St Jeor, then adjusted for activity and goal.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="label">Sex</label>
                      <select className="input" value={profile.tdee.sex ?? ''}
                        onChange={(e) => setTdee({ ...profile.tdee, sex: (e.target.value || undefined) as Sex })}>
                        <option value="">—</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Age</label>
                      <input type="number" className="input" value={profile.tdee.age ?? ''}
                        onChange={(e) => setTdee({ ...profile.tdee, age: Number(e.target.value) || undefined })} />
                    </div>
                    <div>
                      <label className="label">Height (cm)</label>
                      <input type="number" className="input" value={profile.tdee.heightCm ?? ''}
                        onChange={(e) => setTdee({ ...profile.tdee, heightCm: Number(e.target.value) || undefined })} />
                    </div>
                    <div>
                      <label className="label">Weight (kg)</label>
                      <input type="number" className="input" value={profile.tdee.weightKg ?? ''}
                        onChange={(e) => setTdee({ ...profile.tdee, weightKg: Number(e.target.value) || undefined })} />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="label">Goal</label>
                      <select className="input" value={profile.tdee.goal ?? 'maintain'}
                        onChange={(e) => setTdee({ ...profile.tdee, goal: e.target.value as Goal })}>
                        <option value="lose">Lose weight</option>
                        <option value="maintain">Maintain</option>
                        <option value="gain">Gain</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label">Activity</label>
                    <select className="input" value={profile.tdee.activity ?? 'light'}
                      onChange={(e) => setTdee({ ...profile.tdee, activity: e.target.value as ActivityLevel })}>
                      {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => (
                        <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>
                      ))}
                    </select>
                  </div>

                  {tdeeTargets ? (
                    <>
                      <p className="text-sm text-stone-500">
                        Maintenance is about <strong className="font-mono">{Math.round(tdee ?? 0)} kcal</strong>;
                        your goal gives{' '}
                        <strong className="font-mono text-stone-700">{tdeeTargets.calories} kcal</strong>{' '}
                        · {tdeeTargets.protein}p · {tdeeTargets.carbs}c · {tdeeTargets.fat}f
                      </p>
                      <button className="btn-primary" onClick={() => setTargets(tdeeTargets)}>Use these</button>
                    </>
                  ) : (
                    <p className="text-xs text-stone-400">Fill in sex, age, height and weight to see a number.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Manual */}
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <Pencil size={18} className="text-brand-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-3">
                  <h3 className="font-semibold text-stone-800 text-sm">Or set them yourself</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {([
                      ['calories', 'kcal'], ['protein', 'Protein'], ['carbs', 'Carbs'],
                      ['fat', 'Fat'], ['fiber', 'Fibre'],
                    ] as const).map(([key, label]) => (
                      <div key={key}>
                        <label className="label">{label}</label>
                        <input type="number" min={0} className="input px-2"
                          value={manual[key] ?? 0}
                          onChange={(e) => setManual({ ...manual, [key]: Number(e.target.value) })} />
                      </div>
                    ))}
                  </div>
                  <button className="btn-primary" onClick={() => setTargets({ ...manual, source: 'manual' })}>
                    Save targets
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Week & profile ──────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Your week</SectionHeading>
          <div className="card p-4 space-y-4">
            <div>
              <label className="label">Name</label>
              <input className="input" value={profile.name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Week starts on</label>
              <select className="input" value={profile.weekStartsOn}
                onChange={(e) => setWeekStart(Number(e.target.value) as WeekStart)}>
                {WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <p className="text-xs text-stone-400 mt-1">
                Your dietician's plans all run Wednesday to Tuesday, which is the default.
              </p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={profile.showGamification}
                onChange={(e) => setShowGamification(e.target.checked)}
                className="w-4 h-4 accent-brand-600" />
              <span className="text-sm text-stone-700">
                Show XP, levels and achievements
                <span className="block text-xs text-stone-400">Off by default to keep the planner quiet.</span>
              </span>
            </label>
          </div>
        </section>

        {/* ─── MyFitnessPal ────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>MyFitnessPal</SectionHeading>
          <MfpImport />
        </section>
      </div>
    </div>
  )
}

/**
 * Imports a MyFitnessPal diary export.
 *
 * MyFitnessPal has no public API, so a CSV export is the only way to get diary
 * history out. The import is read-only and summary-level: it shows what was
 * logged, it does not try to rebuild those meals from this app's food database.
 */
function MfpImport() {
  const [entries, setEntries] = useState<MfpDiaryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onFile(file: File) {
    setError(null)
    const parsed = parseMfpCsv(await file.text())
    if (!parsed.length) {
      setError('No diary rows found. Export "Nutrition" from MyFitnessPal and upload that CSV.')
      setEntries(null)
      return
    }
    setEntries(parsed)
  }

  const byDay = useMemo(() => {
    if (!entries) return []
    const map = new Map<string, number>()
    for (const e of entries) map.set(e.date, (map.get(e.date) ?? 0) + e.macros.calories)
    return [...map].sort((a, b) => b[0].localeCompare(a[0]))
  }, [entries])

  return (
    <div className="card p-4 space-y-3">
      <p className="text-sm text-stone-600">
        MyFitnessPal closed its API to new developers, so nothing can be written to your diary
        automatically. What works: copy a day or a recipe to the clipboard from the planner and
        paste it in, and bring your history here.
      </p>

      <label className="btn-secondary w-fit cursor-pointer">
        <Upload size={15} /> Import diary CSV
        <input type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      </label>

      {error ? <p className="text-sm text-clay-600">{error}</p> : null}

      {entries && (
        <div className="space-y-2">
          <p className="text-sm text-brand-700 flex items-center gap-1.5">
            <Check size={15} /> Read {entries.length} entries across {byDay.length} days.
          </p>
          <div className="max-h-48 overflow-y-auto card-soft divide-y divide-sand-200">
            {byDay.slice(0, 60).map(([date, kcal]) => (
              <div key={date} className="flex justify-between px-3 py-1.5 text-xs">
                <span className="text-stone-600">{date}</span>
                <span className="font-mono text-stone-500">{Math.round(kcal)} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
