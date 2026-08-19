import { useMemo, useState } from 'react'
import {
  Sparkles, Calculator, Pencil, Upload, Check,
  Download, ClipboardCopy, ClipboardPaste,
} from 'lucide-react'
import type { ActivityLevel, Goal, Sex, Targets, WeekStart } from '../types'
import { useUserStore } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import { SOURCE_PLANS } from '../data'
import { ACTIVITY_LABELS, averagePlanDay, fromPlans, fromTdee, totalDailyEnergy } from '../lib/targets'
import { copyToClipboard, parseMfpCsv, type MfpDiaryEntry } from '../lib/mfp'
import { backupFilename, createBackup, restoreBackup } from '../lib/backup'
import { saveTextFile } from '../lib/download'
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
          <h1 className="display text-xl sm:text-2xl text-ink-900">Settings</h1>
          <p className="text-sm text-ink-700">Targets, the shape of your week, and your data.</p>
        </header>

        {/* ─── Targets ─────────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Daily targets</SectionHeading>
          <p className="text-sm text-ink-700 mb-4">
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
                <Sparkles size={18} className="text-bite-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-ink-900 text-sm">From your dietician's plans</h3>
                  {planAverage ? (
                    <>
                      <p className="text-sm text-ink-700 mt-0.5">
                        Averaged over {planAverage.days} full days:{' '}
                        <strong className="font-mono text-ink-900">{planAverage.perDay.calories} kcal</strong>{' '}
                        · {planAverage.perDay.protein}p · {planAverage.perDay.carbs}c · {planAverage.perDay.fat}f
                        · {planAverage.perDay.fiber}g fibre
                      </p>
                      <p className="text-xs text-ink-500 mt-1">
                        Individual days ranged from {planAverage.min} to {planAverage.max} kcal.
                      </p>
                      <button className="btn-primary mt-3" onClick={() => planTargets && setTargets(planTargets)}>
                        Use these
                      </button>
                    </>
                  ) : (
                    <p className="text-sm text-ink-500 mt-0.5">No plan data available.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Calculator */}
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <Calculator size={18} className="text-bite-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-semibold text-ink-900 text-sm">Work it out from your body</h3>
                    <p className="text-xs text-ink-500">
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
                      <p className="text-sm text-ink-700">
                        Maintenance is about <strong className="font-mono">{Math.round(tdee ?? 0)} kcal</strong>;
                        your goal gives{' '}
                        <strong className="font-mono text-ink-900">{tdeeTargets.calories} kcal</strong>{' '}
                        · {tdeeTargets.protein}p · {tdeeTargets.carbs}c · {tdeeTargets.fat}f
                      </p>
                      <button className="btn-primary" onClick={() => setTargets(tdeeTargets)}>Use these</button>
                    </>
                  ) : (
                    <p className="text-xs text-ink-500">Fill in sex, age, height and weight to see a number.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Manual */}
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <Pencil size={18} className="text-bite-600 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-3">
                  <h3 className="font-semibold text-ink-900 text-sm">Or set them yourself</h3>
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
              <p className="text-xs text-ink-500 mt-1">
                Monday to Sunday by default. Your dietician's own plans ran Wednesday to
                Tuesday; loading one lines its days up by weekday either way.
              </p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={profile.showGamification}
                onChange={(e) => setShowGamification(e.target.checked)}
                className="w-4 h-4 accent-bite-500" />
              <span className="text-sm text-ink-900">
                Show XP, levels and achievements
                <span className="block text-xs text-ink-500">Off by default to keep the planner quiet.</span>
              </span>
            </label>
          </div>
        </section>

        {/* ─── MyFitnessPal ────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>MyFitnessPal</SectionHeading>
          <MfpImport />
        </section>

        {/* ─── Backup ──────────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Your data</SectionHeading>
          <BackupPanel />
        </section>
      </div>
    </div>
  )
}

/**
 * Backup and restore.
 *
 * Deliberately offers three ways out and two ways back in, because the
 * situations where you most need a backup are the ones where the browser is
 * restricting something: a download that never lands, a clipboard that is
 * blocked, a file picker that isn't offered. At least one path works
 * everywhere the app runs.
 */
function BackupPanel() {
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad'; message: string } | null>(null)
  const [pasted, setPasted] = useState('')
  const [showPaste, setShowPaste] = useState(false)

  const backupText = () => JSON.stringify(createBackup(), null, 2)

  async function onDownload() {
    const outcome = await saveTextFile(backupFilename(), backupText())
    setStatus(
      outcome === 'saved' ? { tone: 'ok', message: 'Backup saved.' }
      : outcome === 'declined' ? { tone: 'bad', message: 'Save cancelled.' }
      : { tone: 'bad', message: "This browser wouldn't save the file. Use Copy backup instead and paste it somewhere safe." },
    )
  }

  async function onCopy() {
    const ok = await copyToClipboard(backupText())
    setStatus(ok
      ? { tone: 'ok', message: 'Backup copied. Paste it into a note or a message to yourself.' }
      : { tone: 'bad', message: "This browser blocked the clipboard. Try Download backup instead." })
  }

  function onRestore(text: string) {
    const result = restoreBackup(text)
    if (!result.ok) {
      setStatus({ tone: 'bad', message: result.error })
      return
    }
    setPasted('')
    setShowPaste(false)
    setStatus({
      tone: 'ok',
      message: `Restored ${result.restored.length} of your ${result.restored.length + result.skipped.length} saved sections.`,
    })
  }

  return (
    <div className="card p-4 space-y-4">
      <p className="text-sm text-ink-700">
        Everything you plan, log and add lives in this browser and nowhere else — there's no
        account behind it. A backup is the only copy that survives clearing your browser data,
        switching phone, or a browser that won't let this page save anything at all.
      </p>

      <div className="space-y-2">
        <p className="label">Save a copy</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => void onDownload()}>
            <Download size={15} /> Download backup
          </button>
          <button className="btn-secondary" onClick={() => void onCopy()}>
            <ClipboardCopy size={15} /> Copy backup
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="label">Bring one back</p>
        <div className="flex flex-wrap gap-2">
          <label className="btn-secondary cursor-pointer">
            <Upload size={15} /> Restore from file
            <input
              type="file" accept=".json,application/json" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void file.text().then(onRestore)
                e.target.value = ''
              }}
            />
          </label>
          <button className="btn-secondary" onClick={() => setShowPaste((v) => !v)}>
            <ClipboardPaste size={15} /> Paste a backup
          </button>
        </div>

        {showPaste && (
          <div className="space-y-2 pt-1">
            <textarea
              className="input h-28 font-mono text-xs"
              placeholder="Paste the contents of a backup here…"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <button className="btn-primary" disabled={!pasted.trim()} onClick={() => onRestore(pasted)}>
              Restore
            </button>
          </div>
        )}
        <p className="text-xs text-ink-500">
          Restoring replaces what's currently in the app. Save a copy first if you're unsure.
        </p>
      </div>

      {status && (
        <p className={`text-sm ${status.tone === 'ok' ? 'text-bite-700' : 'text-coral-600'}`}>
          {status.message}
        </p>
      )}
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
      <p className="text-sm text-ink-700">
        MyFitnessPal closed its API to new developers, so nothing can be written to your diary
        automatically. What works: copy a day or a recipe to the clipboard from the planner and
        paste it in, and bring your history here.
      </p>

      <label className="btn-secondary w-fit cursor-pointer">
        <Upload size={15} /> Import diary CSV
        <input type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      </label>

      {error ? <p className="text-sm text-coral-600">{error}</p> : null}

      {entries && (
        <div className="space-y-2">
          <p className="text-sm text-bite-700 flex items-center gap-1.5">
            <Check size={15} /> Read {entries.length} entries across {byDay.length} days.
          </p>
          <div className="max-h-48 overflow-y-auto card-soft divide-y divide-border-200">
            {byDay.slice(0, 60).map(([date, kcal]) => (
              <div key={date} className="flex justify-between px-3 py-1.5 text-xs">
                <span className="text-ink-700">{date}</span>
                <span className="font-mono text-ink-700">{Math.round(kcal)} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
