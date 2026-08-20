import { useMemo, useState } from 'react'
import {
  Sparkles, Calculator, Pencil, Upload, Check,
  Download, ClipboardCopy, ClipboardPaste, LogOut, Undo2,
} from 'lucide-react'
import type { ActivityLevel, Goal, Sex, Targets, WeekStart } from '../types'
import { useUserStore } from '../store/useUserStore'
import { useDeletedRecipes, useRecipeStore } from '../store/useRecipeStore'
import { useDeletedFoods, useFoodStore } from '../store/useFoodStore'
import { useNutritionContext } from '../store/useNutrition'
import { SOURCE_PLANS } from '../data'
import { ACTIVITY_LABELS, averagePlanDay, fromPlans, fromTdee, totalDailyEnergy } from '../lib/targets'
import { backupFilename, createBackup, restoreBackup } from '../lib/backup'
import { saveTextFile } from '../lib/download'
import { SectionHeading } from '../components/ui'
import { copyToClipboard } from '../lib/clipboard'
import { useAuthStore } from '../store/useAuth'
import { isConfigured } from '../lib/supabase'

const WEEKDAYS: { value: WeekStart; label: string }[] = [
  { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

export default function Settings() {
  const { profile, setName, setTargets, setTdee, setWeekStart } = useUserStore()
  // Signed out, the account section has nothing to show and no one to sign out;
  // everything else on this screen belongs to the device and still works.
  const session = useAuthStore((s) => s.session)
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
            (Protein {profile.targets.protein} g · Carbs {profile.targets.carbs} g · Fat {profile.targets.fat} g), set{' '}
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
                        · Protein {planAverage.perDay.protein} g · Carbs {planAverage.perDay.carbs} g
                        · Fat {planAverage.perDay.fat} g · Fibre {planAverage.perDay.fiber} g
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
                        <option value="">Not set</option>
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
                        · Protein {tdeeTargets.protein} g · Carbs {tdeeTargets.carbs} g · Fat {tdeeTargets.fat} g
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
          </div>
        </section>

        {/* ─── Backup ──────────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Your data</SectionHeading>
          <BackupPanel />
        </section>

        {/* ─── Account ─────────────────────────────────────────────────────── */}
        <DeletedRecipesPanel />
        <DeletedFoodsPanel />

        {isConfigured && session && <AccountPanel />}

        <VersionPanel />
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
        Everything you plan, log and add lives in this browser and nowhere else. There's no
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
 * The signed-in account.
 *
 * Only rendered on the deployed app; a local clone has no accounts at all.
 * The display name is what the other person sees on the welcome screen, so it
 * is worth being able to set it to something friendlier than an email address.
 */
function AccountPanel() {
  const { user, members, setDisplayName, signOut } = useAuthStore()
  const mine = members.find((m) => m.id === user?.id)

  // The saved name arrives a moment after the page does, the session is read
  // from storage but the household list is a request. Holding the field in
  // state alone meant it initialised empty and stayed empty, so the name
  // looked lost after every refresh. Null means "not typed in yet", and until
  // then the field shows whatever the household knows.
  const [typed, setTyped] = useState<string | null>(null)
  const name = typed ?? mine?.display_name ?? ''
  const [saved, setSaved] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <section>
      <SectionHeading>Account</SectionHeading>
      <div className="card p-4 space-y-4">
        <p className="text-sm text-ink-700">
          Signed in as <strong className="break-all">{user?.email}</strong>. Your plans, recipes and
          shopping list are shared with everyone else in the household.
        </p>

        <div>
          <label className="label">What the others should call you</label>
          <div className="flex gap-2">
            <input
              className="input" placeholder="e.g. Ana" value={name}
              onChange={(e) => { setTyped(e.target.value); setSaved(false); setFailed(false) }}
            />
            <button
              className="btn-secondary shrink-0"
              disabled={!name.trim() || name.trim() === mine?.display_name}
              onClick={async () => {
                const ok = await setDisplayName(name.trim())
                setSaved(ok)
                setFailed(!ok)
                if (ok) setTyped(null)
              }}
            >
              {saved ? <><Check size={15} /> Saved</> : 'Save'}
            </button>
          </div>
          {failed && (
            <p className="text-xs text-coral-600 mt-1">
              That did not save. Check you are still signed in and try again.
            </p>
          )}
        </div>

        <button className="btn-ghost text-ink-500 hover:text-coral-600 w-fit" onClick={() => void signOut()}>
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </section>
  )
}

/**
 * Which build this is.
 *
 * The app is served from the device by a service worker, so a deploy and the
 * thing on your screen are two different questions. This answers the second
 * one: if the commit here matches the one that was deployed, you are looking at
 * the new version. If it does not, "Check now" fetches the worker again, and
 * if there is a newer one, the page reloads itself onto it.
 */
function VersionPanel() {
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)

  async function check() {
    setChecking(true)
    setChecked(false)
    try {
      const registration = await navigator.serviceWorker?.ready
      await registration?.update()
    } catch {
      // No worker here, nothing to check, and nothing that can be stale.
    } finally {
      setChecking(false)
      setChecked(true)
    }
  }

  return (
    <section>
      <SectionHeading>This version</SectionHeading>
      <div className="card p-4 space-y-3">
        <p className="text-sm text-ink-700">
          Build <strong className="font-mono text-ink-900">{__BUILD_SHA__}</strong>, made{' '}
          {new Date(__BUILD_TIME__).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}.
        </p>
        <p className="text-xs text-ink-500">
          The app is kept on your device so it works without a signal, which means a new version
          arrives quietly in the background. It swaps itself in the next time you open it.
        </p>
        <button className="btn-secondary w-fit" onClick={() => void check()} disabled={checking}>
          {checking ? 'Checking…' : checked ? 'Up to date' : 'Check now'}
        </button>
      </div>
    </section>
  )
}

/**
 * Recipes you deleted, and the way back.
 *
 * Deleting takes a recipe out of every list, search and picker, but does not
 * destroy it, a day you planned months ago names it by id, and throwing it away
 * would blank that day. This is where they wait. It disappears when there is
 * nothing in it, so it is not a permanent reminder of things you got rid of on
 * purpose.
 */
function DeletedRecipesPanel() {
  const deleted = useDeletedRecipes()
  const restoreRecipe = useRecipeStore((s) => s.restoreRecipe)
  if (!deleted.length) return null

  return (
    <section>
      <SectionHeading>Deleted recipes</SectionHeading>
      <div className="card divide-y divide-border-100">
        {deleted.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <span className="text-xl shrink-0">{r.emoji}</span>
            <span className="flex-1 min-w-0 text-sm text-ink-900 truncate">{r.name.en}</span>
            <button className="btn-secondary shrink-0" onClick={() => restoreRecipe(r.id)}>
              <Undo2 size={15} /> Restore
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-500 mt-2 px-1">
        These are out of your library but not gone: any day you already planned with one still
        shows it, marked as deleted, so your history stays as it happened.
      </p>
    </section>
  )
}

/** Foods you deleted, and the way back. Same reasoning as the recipes above. */
function DeletedFoodsPanel() {
  const deleted = useDeletedFoods()
  const restoreFood = useFoodStore((s) => s.restoreFood)
  if (!deleted.length) return null

  return (
    <section>
      <SectionHeading>Deleted foods</SectionHeading>
      <div className="card divide-y divide-border-100">
        {deleted.map((f) => (
          <div key={f.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1 min-w-0 text-sm text-ink-900 truncate">{f.names.en}</span>
            <button className="btn-secondary shrink-0" onClick={() => restoreFood(f.id)}>
              <Undo2 size={15} /> Restore
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-500 mt-2 px-1">
        Recipes and planned days that already use one of these keep their numbers. A food is
        named by everything that contains it, so losing it would blank them all at once.
      </p>
    </section>
  )
}
