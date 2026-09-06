import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Sparkles, Calculator, Pencil, Upload, Check, X,
  Download, ClipboardCopy, ClipboardPaste, LogOut, Undo2,
} from 'lucide-react'
import type { ActivityLevel, Goal, Sex, Targets, Theme, UserProfile, WeekStart } from '../types'
import { THEMES, THEME_LABELS } from '../types'
import { useUserStore } from '../store/useUserStore'
import { useUiStore } from '../store/useUiStore'
import { PEOPLE } from '../lib/people'
import { useDeletedRecipes, useRecipeStore, useResolvableRecipes } from '../store/useRecipeStore'
import { useDeletedFoods, useFoodStore, useResolvableFoods } from '../store/useFoodStore'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { auditFoods } from '../lib/foodAudit'
import FoodEditor from '../components/foods/FoodEditor'
import type { Food } from '../types'
import { useNutritionContext } from '../store/useNutrition'
import { SOURCE_PLANS } from '../data'
import {
  ACTIVITY_LABELS, averagePlanDay, explainTdee, fromPlans, fromTdee, totalDailyEnergy,
} from '../lib/targets'
import {
  applyBackup, backupFilename, createBackup, inspectBackup,
  type Backup, type RestorePlan,
} from '../lib/backup'
import { saveTextFile } from '../lib/download'
import { SectionHeading } from '../components/ui'
import { copyToClipboard } from '../lib/clipboard'
import { PlanArchive } from '../components/settings/PlanArchive'
import { useAuthStore } from '../store/useAuth'
import {
  currentState, deviceLabel, disable, enable, readWants, writeWants,
  WANTS_ALL, type PushState, type Wants,
} from '../lib/push'
import { useSyncStatus } from '../store/useSync'
import { probeSaving, type ProbeStep } from '../lib/rows/probe'
import { isConfigured } from '../lib/supabase'

const WEEKDAYS: { value: WeekStart; label: string }[] = [
  { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

/**
 * Two tabs, because the plan archive is a settings-shaped thing.
 *
 * It is fourteen weeks of history you read once in a while and load a week
 * from, not somewhere you go daily, and it was taking a slot in the navigation
 * next to the screens you open every day. The old /history address still
 * works and lands here.
 */
type Tab = 'settings' | 'history'

export default function Settings() {
  const location = useLocation()
  const tab: Tab = location.pathname.startsWith('/settings/history') ? 'history' : 'settings'

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <header>
          <h1 className="display text-xl sm:text-2xl text-ink-900">
            {tab === 'history' ? 'Plan history' : 'Settings'}
          </h1>
          <p className="text-sm text-ink-700">
            {tab === 'history'
              ? "Every week your dietician wrote, in their own words."
              : 'Targets, the shape of your week, and your data.'}
          </p>
        </header>

        <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit" role="tablist">
          <TabLink to="/settings" label="Settings" on={tab === 'settings'} />
          <TabLink to="/settings/history" label="Plan history" on={tab === 'history'} />
        </div>

        {tab === 'history' ? <PlanArchive /> : <SettingsPanels />}
      </div>
    </div>
  )
}

function TabLink({ to, label, on }: { to: string; label: string; on: boolean }) {
  return (
    <Link
      to={to}
      role="tab"
      aria-selected={on}
      className={on ? 'tab-on' : 'tab-off'}
    >
      {label}
    </Link>
  )
}

function SettingsPanels() {
  const {
    profile, setName, setTargets, setTdee, setWeekStart, setWeightUnit, setTheme,
  } = useUserStore()
  // The same person the rest of the app is showing figures for, so setting a
  // target and then reading it back are about the same human being.
  const whose = useUiStore((s) => s.viewingAs)
  const setViewingAs = useUiStore((s) => s.setViewingAs)
  const shown = profile.targets
  // Signed out, the account section has nothing to show and no one to sign out;
  // everything else on this screen belongs to the device and still works.
  const session = useAuthStore((s) => s.session)
  const ctx = useNutritionContext()

  const planAverage = useMemo(() => averagePlanDay(SOURCE_PLANS, ctx), [ctx])
  const planTargets = useMemo(() => fromPlans(SOURCE_PLANS, ctx), [ctx])
  const tdeeTargets = fromTdee(profile.tdee)
  const tdee = totalDailyEnergy(profile.tdee)
  const working = explainTdee(profile.tdee)


  return (
    <div className="space-y-8">
        {/* ─── Targets ─────────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Daily targets</SectionHeading>

          {/* One figure, for a plan that has one. The household cooks once
              and eats the same food, so the line across a day belongs to the
              day and not to a person. Two people did each have their own for
              a while and neither ever set one, so the switch changed nothing
              on screen and read as decoration on all three screens it
              appeared on. Body and Movement still ask whose, because there
              the question really is about a person. */}
          <p className="text-sm text-ink-700 mb-4">
            You are both on <strong className="font-mono">{shown.calories} kcal</strong>{' '}
            (Protein {shown.protein} g · Carbs {shown.carbs} g · Fat {shown.fat} g), set{' '}
            {shown.source === 'from-plans' ? 'from your plans'
              : shown.source === 'tdee' ? 'by the calculator' : 'by hand'}.
          </p>

          <div className="space-y-3">
            {/* From the plans */}
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <Sparkles size={18} className="text-bite-700 shrink-0 mt-0.5" />
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
                <Calculator size={18} className="text-bite-700 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-semibold text-ink-900 text-sm">Work it out from your body</h3>
                    <p className="text-xs text-ink-500">
                      Mifflin-St Jeor, then adjusted for activity and goal. Every step is shown
                      below, so you can check the arithmetic rather than take a number on trust.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="label" htmlFor="tdee-sex">Sex</label>
                      <select id="tdee-sex" className="input" value={profile.tdee.sex ?? ''}
                        onChange={(e) => setTdee({ ...profile.tdee, sex: (e.target.value || undefined) as Sex })}>
                        <option value="">Not set</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="tdee-age">Age</label>
                      <input id="tdee-age" type="number" className="input" value={profile.tdee.age ?? ''}
                        onChange={(e) => setTdee({ ...profile.tdee, age: Number(e.target.value) || undefined })} />
                    </div>
                    <div>
                      <label className="label" htmlFor="tdee-height">Height (cm)</label>
                      <input id="tdee-height" type="number" className="input" value={profile.tdee.heightCm ?? ''}
                        onChange={(e) => setTdee({ ...profile.tdee, heightCm: Number(e.target.value) || undefined })} />
                    </div>
                    <div>
                      <label className="label" htmlFor="tdee-weight">Weight (kg)</label>
                      <input id="tdee-weight" type="number" className="input" value={profile.tdee.weightKg ?? ''}
                        onChange={(e) => setTdee({ ...profile.tdee, weightKg: Number(e.target.value) || undefined })} />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="label" htmlFor="tdee-goal">Goal</label>
                      <select id="tdee-goal" className="input" value={profile.tdee.goal ?? 'maintain'}
                        onChange={(e) => setTdee({ ...profile.tdee, goal: e.target.value as Goal })}>
                        <option value="lose">Lose weight</option>
                        <option value="maintain">Maintain</option>
                        <option value="gain">Gain</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label" htmlFor="tdee-activity">Activity</label>
                    <select id="tdee-activity" className="input" value={profile.tdee.activity ?? 'light'}
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
                      <details className="card-soft p-3">
                        <summary className="text-xs font-bold uppercase tracking-wide text-ink-500 cursor-pointer">
                          How that was worked out
                        </summary>
                        <ol className="mt-2 space-y-2">
                          {working.map((step) => (
                            <li key={step.label} className="text-xs">
                              <p className="text-ink-900 font-semibold">{step.label}</p>
                              <p className="flex flex-wrap items-baseline gap-x-2 text-ink-500">
                                <span className="font-mono">{step.working}</span>
                                <span className="font-mono text-ink-900">= {step.result}</span>
                              </p>
                            </li>
                          ))}
                        </ol>
                        <p className="text-[11px] text-ink-500 mt-3">
                          Mifflin-St Jeor (1990) for the resting rate, its published activity
                          multipliers, a 20% cut as the usual sustainable rate of loss, protein at
                          1.6 g per kg to hold onto muscle while losing, fat at 30% of energy, and
                          fibre at 14 g per 1000 kcal from the dietary reference intakes. It is an
                          estimate: what the scale does over a fortnight beats any formula.
                        </p>
                      </details>

                      <button className="btn-primary" onClick={() => setTargets(tdeeTargets)}>Use these</button>
                    </>
                  ) : (
                    <p className="text-xs text-ink-500">Fill in sex, age, height and weight to see a number.</p>
                  )}
                </div>
              </div>
            </div>

            <ManualTargets
              initial={shown}
              onSave={(targets) => setTargets(targets)}
            />
          </div>
        </section>

        {/* ─── Whose exercise ──────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Whose exercise</SectionHeading>
          {/* All that is left of a switch that used to sit on three screens.
              Food is one target now, because the household cooks once. What
              somebody did in a gym is not shared, and Home and Progress have
              to show one person's, so this says which. Movement itself, and
              Body, are per person on their own screens and ignore this. */}
          <p className="text-sm text-ink-700 mb-3">
            Home and Progress show one person's sessions and steps. This is who.
            The Movement and Body screens ask for themselves.
          </p>
          <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit" role="tablist">
            {PEOPLE.map((person) => (
              <button
                key={person.id}
                role="tab"
                aria-selected={whose === person.id}
                aria-label={`Show ${person.name}'s exercise on Home and Progress`}
                onClick={() => setViewingAs(person.id)}
                className={whose === person.id ? 'tab-on' : 'tab-off'}
              >
                {person.name}
              </button>
            ))}
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
            <div>
              <label className="label" htmlFor="theme">Appearance</label>
              <select
                id="theme"
                className="input"
                value={profile.theme ?? 'system'}
                onChange={(e) => setTheme(e.target.value as Theme)}
              >
                {THEMES.map((t) => <option key={t} value={t}>{THEME_LABELS[t]}</option>)}
              </select>
              <p className="text-xs text-ink-500 mt-1">
                Following your device is the default and changes with it, so the app goes dark
                when your phone does. Pick one of the other two to say otherwise.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="weight-unit">Weights read in</label>
              <select
                id="weight-unit"
                className="input"
                value={profile.weightUnit}
                onChange={(e) => setWeightUnit(e.target.value as UserProfile['weightUnit'])}
              >
                <option value="kg">Kilograms</option>
                <option value="lbs">Pounds</option>
              </select>
              <p className="text-xs text-ink-500 mt-1">
                {/* The reassurance is the point. This setting has existed as a
                    field since the beginning with nothing to change it, and the
                    body screen printed the stored number with whatever this
                    said next to it, so making it settable without saying what
                    it touches would look like a switch that rewrites your
                    history. It does not: every entry keeps the unit you typed
                    it in, and this changes the reading. */}
                Changes how weights are shown, not what was saved. Every entry keeps the unit you
                typed it in, and one logged in the other unit says so beside it.
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
        <FoodCheckPanel />

        <DeletedFoodsPanel />

        {isConfigured && session && <AccountPanel />}

        {isConfigured && session && <SyncPanel />}

        {isConfigured && session && <NotificationsPanel />}

        <VersionPanel />
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
/**
 * Targets typed in by hand.
 *
 * Its own component so the draft in the fields lives with the fields. Held in
 * the parent it survived every re-render of the whole settings screen, which
 * is how a half-typed figure used to reappear after saving.
 */
function ManualTargets({
  initial, onSave,
}: {
  initial: Targets
  onSave: (targets: Targets) => void
}) {
  const [manual, setManual] = useState<Targets>(initial)

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <Pencil size={18} className="text-bite-700 shrink-0 mt-0.5" />
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
          <button className="btn-primary" onClick={() => onSave({ ...manual, source: 'manual' })}>
            Save targets
          </button>
        </div>
      </div>
    </div>
  )
}

function BackupPanel() {
  // Whether there is anywhere else this data lives, which is the difference
  // between the two things this panel can truthfully say.
  const shared = useAuthStore((s) => Boolean(s.session)) && isConfigured
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad'; message: string } | null>(null)
  const [pasted, setPasted] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  // A backup that has been read and found sound, waiting to be agreed to.
  const [plan, setPlan] = useState<RestorePlan | null>(null)
  // What the last restore replaced, so it can be put back.
  const [undo, setUndo] = useState<Backup | null>(null)

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

  /**
   * Reads the file and stops, so the next step is a decision rather than a
   * report of something already done.
   *
   * This used to write straight through and then say "Restored 3 of your 10
   * saved sections", which is the wrong moment for that sentence twice over:
   * nobody agreed to it, and by the time it appears the other seven are gone.
   */
  function onOffered(text: string) {
    const result = inspectBackup(text)
    if (!result.ok) {
      setPlan(null)
      setStatus({ tone: 'bad', message: result.error })
      return
    }
    setStatus(null)
    setPlan(result.plan)
  }

  function onConfirm() {
    if (!plan) return
    const snapshot = applyBackup(plan)
    setPlan(null)
    setPasted('')
    setShowPaste(false)
    setUndo(snapshot)
    setStatus({ tone: 'ok', message: `Restored everything from the backup${savedOn(plan)}.` })
  }

  /**
   * Puts back what the restore replaced.
   *
   * Kept on screen rather than offered for a few seconds like the undo
   * elsewhere in the app. Replacing everything is the largest thing this app
   * can do, and noticing that a week is missing takes longer than noticing a
   * meal is, so the way back stays until it is used or the page is left.
   */
  function onUndo() {
    if (!undo) return
    const back = inspectBackup(JSON.stringify(undo))
    if (!back.ok) {
      setStatus({ tone: 'bad', message: back.error })
      return
    }
    applyBackup(back.plan)
    setUndo(null)
    setStatus({ tone: 'ok', message: 'Put back what was here before the restore.' })
  }

  return (
    <div className="card p-4 space-y-4">
      {/* Two paragraphs, because signing in changes which one is true. Both
          used to be on screen at once, the frightening one first, directly
          above "Signed in as": the app told you there was no account behind it
          and then named the account. */}
      <p className="text-sm text-ink-700">
        {shared
          ? `Everything you plan, log and add is on this device and in the household's shared
             copy, so it reaches the other phone and comes back if this one is lost. A backup
             is still worth having: it is the copy that survives an account going away, and
             the only one you hold yourself.`
          : `Everything you plan, log and add lives in this browser and nowhere else. There's no
             account behind it. A backup is the only copy that survives clearing your browser
             data, switching phone, or a browser that won't let this page save anything at all.`}
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
                if (file) void file.text().then(onOffered)
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
            <button className="btn-primary" disabled={!pasted.trim()} onClick={() => onOffered(pasted)}>
              Read it
            </button>
          </div>
        )}
        {plan && (
          <div className="card-soft p-4 space-y-3 border border-coral-300">
            <p className="text-sm font-semibold text-ink-900">
              This will replace {plan.replacing.length}{' '}
              {plan.replacing.length === 1 ? 'section' : 'sections'} of what is in the app now,
              from a backup{savedOn(plan)}.
            </p>
            {/* Named, not counted. "10 sections" is not something anybody can
                weigh against what they would lose. */}
            <ul className="text-sm text-ink-700 list-disc pl-5 space-y-0.5">
              {plan.replacing.map((what) => <li key={what}>{what}</li>)}
            </ul>
            {plan.unknown.length > 0 && (
              <p className="text-xs text-ink-500">
                {plan.unknown.length === 1 ? 'One section' : `${plan.unknown.length} sections`} in
                that file belong to a version this app does not have, and will be left out.
              </p>
            )}
            <p className="text-xs text-ink-500">
              A copy of what is here now is kept first, so this can be undone.
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={onConfirm}>Replace it all</button>
              <button className="btn-secondary" onClick={() => setPlan(null)}>Cancel</button>
            </div>
          </div>
        )}

        <p className="text-xs text-ink-500">
          Restoring replaces what's currently in the app. It says what it is about to replace
          before it does anything, and keeps a copy of what was here.
        </p>
      </div>

      {status && (
        <p className={`text-sm ${status.tone === 'ok' ? 'text-bite-700' : 'text-coral-600'}`}>
          {status.message}
        </p>
      )}

      {undo && (
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={onUndo}>
            <Undo2 size={15} /> Undo that restore
          </button>
          <button className="btn-ghost text-sm" onClick={() => setUndo(null)}>
            Keep the restored copy
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * When the backup was taken, as a clause that can be left out.
 *
 * A backup with no date in it is a backup somebody hand-edited, and inventing
 * "today" for it would be the app making something up about a file it is about
 * to overwrite everything with.
 */
function savedOn(plan: RestorePlan): string {
  if (!plan.exportedAt) return ''
  const when = new Date(plan.exportedAt)
  if (Number.isNaN(when.getTime())) return ''
  return ` saved on ${when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
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
 * Whether the shared copy is actually receiving anything.
 *
 * Saving is two separate things: writing to this device, which the banner at
 * the top reports when it fails, and reaching the copy the other person reads.
 * The second one can be refused indefinitely by a database policy while the app
 * carries on looking perfectly healthy, and the only honest way to tell is to
 * put the state and the server's own words on a screen you can go and look at.
 */
/**
 * Being told something while the app is closed.
 *
 * Per device, deliberately, and the screen says so. Notifications are the one
 * setting in this app that is not shared: the profile syncs, so putting this
 * there would mean switching them off on your phone switched them off on
 * theirs. Two people, two phones, two answers.
 *
 * Four ways this is unavailable and each says which, because "notifications
 * are unavailable" sends people to the wrong place. A browser that cannot do
 * it at all, a household with no key set up, a permission already refused, and
 * simply not on yet are four different problems with four different fixes, and
 * only one of them is the person's to solve.
 */
function NotificationsPanel() {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // Which of the two you want. Read once the panel knows there is anything to
  // want: asking the database before that would be a query on every visit to
  // Settings for a household that has never set a signing key up.
  const [wants, setWants] = useState<Wants>(WANTS_ALL)

  // A rejection here used to leave the panel invisible for ever, because the
  // section rendered nothing until this resolved. A screen that says nothing
  // is indistinguishable from a feature that was never deployed, which is
  // exactly the wrong thing for a panel whose job is explaining why something
  // is not working.
  useEffect(() => {
    currentState()
      .then(setState)
      .catch((e: Error) => {
        setState({ kind: 'off' })
        setMessage(`Could not work out where this device stands: ${e.message}`)
      })
    // Failing to read them is not worth a message: both on is what the sender
    // does with a member who has no row, so the panel showing both on is the
    // truth either way.
    readWants().then(setWants).catch(() => {})
  }, [])

  async function choose(next: Wants) {
    const before = wants
    // Moved first so the switch answers the thumb. Put back if the write is
    // refused, which is the only way a switch can lie about what it set.
    setWants(next)
    const result = await writeWants(next)
    if (!result.ok) {
      setWants(before)
      setMessage(`Could not save that: ${result.reason}`)
    } else {
      setMessage(null)
    }
  }

  async function turnOn() {
    setBusy(true)
    setMessage(null)
    const result = await enable()
    setMessage(result.ok ? null : result.reason)
    setState(await currentState())
    setBusy(false)
  }

  async function turnOff() {
    setBusy(true)
    setMessage(null)
    await disable()
    setState(await currentState())
    setBusy(false)
  }

  return (
    <section>
      <SectionHeading>Notifications</SectionHeading>
      <div className="card p-4 space-y-3">
        <p className="text-sm text-ink-700">
          Two things, and nothing else. Never more than one at a time for the same thing.
        </p>

        {state === null && (
          <p className="text-sm text-ink-500">Checking this device.</p>
        )}

        {state?.kind === 'unsupported' && (
          <p className="text-sm text-ink-500">This browser cannot show notifications.</p>
        )}

        {state?.kind === 'unconfigured' && (
          <p className="text-sm text-ink-500">
            No signing key has been set up for this household yet, so there is nothing to switch
            on. It is one line in the SQL editor, and the README has it.
          </p>
        )}

        {state?.kind === 'blocked' && (
          <p className="text-sm text-ink-500">
            This site is set to block notifications in your browser. The app cannot undo that, and
            asking again would do nothing: it has to be changed in the browser's own settings for
            this site.
          </p>
        )}

        {(state?.kind === 'off' || state?.kind === 'on') && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={state.kind === 'on' ? 'btn-secondary' : 'btn-primary'}
              onClick={state.kind === 'on' ? turnOff : turnOn}
              disabled={busy}
            >
              {state.kind === 'on' ? 'Turn off on this device' : 'Turn on for this device'}
            </button>
            <span className="text-sm text-ink-500">
              {state.kind === 'on' ? `On, for your ${deviceLabel()}.` : 'Off on this device.'}
            </span>
          </div>
        )}

        {/* Which of the two, once there is anything to receive them. Hidden
            while push is unsupported, unconfigured or blocked, where the
            switches would be two controls over something that cannot happen. */}
        {(state?.kind === 'off' || state?.kind === 'on') && (
          <div className="border-t border-border-100 pt-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">
              What to send
            </p>
            <Wanted
              label="Before a cooking session"
              note="A couple of hours before something you have scheduled to cook."
              on={wants.cook}
              onChange={(on) => void choose({ ...wants, cook: on })}
            />
            <Wanted
              label="When the other one of you changes the week"
              note="One line, after the change settles, rather than one per meal moved."
              on={wants.plan}
              onChange={(on) => void choose({ ...wants, plan: on })}
            />
            {!wants.cook && !wants.plan && state.kind === 'on' && (
              <p className="text-xs text-ink-700">
                Both off, so this device is subscribed and will never be sent anything. That is a
                fine way to leave it, and turning the switch above off is the tidier one.
              </p>
            )}
          </div>
        )}

        {message && <p className="text-sm text-coral-600">{message}</p>}

        <p className="text-xs text-ink-500">
          The switch above is per device, because a phone is what gets notified, and turning it on
          here does nothing to the other one. What to send is per person and follows you to any
          device you sign in on. On Android notifications are more reliable once the app has been
          added to the home screen.
        </p>
      </div>
    </section>
  )
}

/**
 * One kind of notification, on or off.
 *
 * A checkbox rather than a styled toggle: it is a real one under the label, so
 * it is reachable by keyboard, announced as a checkbox, and toggled by tapping
 * anywhere on the row rather than on a 20px switch.
 */
function Wanted({
  label, note, on, onChange,
}: {
  label: string
  note: string
  on: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 py-1.5 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 w-5 h-5 shrink-0 accent-bite-500"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-sm text-ink-900">{label}</span>
        <span className="block text-xs text-ink-500">{note}</span>
      </span>
    </label>
  )
}

function SyncPanel() {
  const { state, at, unsaved, lastError } = useSyncStatus()

  const summary =
    state === 'live' && !unsaved ? 'Everything on this device has reached the shared copy.'
    : state === 'connecting' ? 'Connecting.'
    // Rows, not stores: `owedRows` counts the individual changes, and calling
    // twenty-one emptied shopping list lines "21 stores" was nonsense.
    : unsaved ? `${unsaved} ${unsaved === 1 ? 'change is' : 'changes are'} waiting to go up.`
    : state === 'error' ? 'The last attempt was turned down.'
    : 'Not syncing. This device is working on its own.'

  return (
    <section>
      <SectionHeading>Sharing</SectionHeading>
      <div className="card p-4 space-y-3">
        <p className="text-sm text-ink-700">{summary}</p>

        <dl className="text-xs space-y-1.5">
          <Row label="State" value={state} />
          <Row label="Last agreed" value={at ? at.toLocaleTimeString('en-GB') : 'not yet'} />
          <Row label="Waiting" value={String(unsaved)} />
          {lastError && <Row label="Server said" value={lastError} />}
        </dl>

        <SavingCheck />

        {lastError ? (
          <p className="text-xs text-ink-500">
            Whatever this says is the reason, and it is worth reading out to whoever can change it.
            A message about a policy or a permission means the database is refusing this account
            rather than anything being wrong with what you typed. Nothing has been lost: it is all
            still on this device, and it keeps trying.
          </p>
        ) : null}
      </div>
    </section>
  )
}

/**
 * Writes a row, reads it back, deletes it, and says which of those worked.
 *
 * Every version of this failure has looked identical from the outside: the
 * things you typed are not there. Underneath they were four separate problems,
 * and telling them apart meant somebody with a database and a lot of guessing.
 * A person who can press a button and read four lines does not need either.
 */
function SavingCheck() {
  const [steps, setSteps] = useState<ProbeStep[] | null>(null)
  const [running, setRunning] = useState(false)

  async function run() {
    setRunning(true)
    setSteps(null)
    try {
      setSteps(await probeSaving())
    } catch (e) {
      setSteps([{ what: 'The check itself failed', ok: false, detail: (e as Error).message }])
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="pt-1 space-y-2">
      <button className="btn-secondary" onClick={() => void run()} disabled={running}>
        {running ? 'Checking…' : 'Check saving'}
      </button>

      {steps && (
        <ul className="space-y-1">
          {steps.map((step) => (
            <li key={step.what} className="flex items-start gap-2 text-xs">
              {step.ok
                ? <Check size={13} className="shrink-0 mt-0.5 text-teal-600" />
                : <X size={13} className="shrink-0 mt-0.5 text-coral-600" />}
              <span className="flex-1 min-w-0">
                <span className={step.ok ? 'text-ink-700' : 'text-coral-700 font-semibold'}>{step.what}</span>
                {step.detail ? (
                  <span className="block text-ink-500 font-mono break-words">{step.detail}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      {steps?.every((s) => s.ok) && (
        <p className="text-xs text-teal-700">
          Saving works. What you enter here reaches the other phone.
        </p>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 font-bold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="flex-1 min-w-0 font-mono text-ink-900 break-words">{value}</dd>
    </div>
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
/**
 * The food check, run here rather than only in the weekly job.
 *
 * The job checks what ships with the app. This checks what you have actually
 * got, which includes everything imported from USDA and Open Food Facts, where
 * the wrong numbers come from. It is the same rules either way, and it changes
 * nothing on its own: each finding opens the food so you can decide.
 */
function FoodCheckPanel() {
  const foods = useResolvableFoods()
  const recipes = useResolvableRecipes()
  const plan = useMealPlanStore((s) => s.plan)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)

  const inUse = useMemo(() => {
    const ids = new Set<string>()
    const walk = (components: { kind: string; foodId?: string }[]) => {
      for (const c of components) if (c.kind === 'food' && c.foodId) ids.add(c.foodId)
    }
    for (const r of recipes) walk(r.components)
    for (const day of plan) for (const meal of day.meals) walk(meal.entries)
    return ids
  }, [recipes, plan])

  // The clock is read once, when the panel is first rendered. Reading it
  // during render would make the result depend on when React happened to
  // re-run this, which is the whole point of the rule against it.
  const [now] = useState(() => Date.now())

  const report = useMemo(
    () => auditFoods(foods, { inUse, now }),
    [foods, inUse, now],
  )

  // Missing figures are counted, not listed: there are a hundred of them and
  // they are all the same sentence.
  const listed = report.findings.filter((f) => f.kind !== 'gap')
  const gaps = report.findings.length - listed.length
  const wrong = listed.filter((f) => f.severity === 'wrong').length

  return (
    <section>
      <SectionHeading>Food check</SectionHeading>
      <div className="card p-4 space-y-3">
        <p className="text-sm text-ink-700">
          {report.checked} foods checked against their own numbers: calories against macros,
          the group against the guide, and what is missing. Nothing is changed automatically.
        </p>

        <p className="text-sm text-ink-900">
          {wrong > 0 && (
            <strong className="text-coral-600">
              {wrong} with numbers that cannot be right.{' '}
            </strong>
          )}
          {listed.length - wrong > 0
            ? `${listed.length - wrong} worth a look.`
            : wrong === 0 ? 'Nothing looks wrong.' : ''}
          {gaps > 0 && ` ${gaps} missing a salt or fibre figure.`}
        </p>

        {listed.length > 0 && (
          <>
            <button className="btn-secondary" onClick={() => setOpen(!open)}>
              {open ? 'Hide' : 'Show me'}
            </button>

            {open && (
              <ul className="space-y-2">
                {listed.slice(0, 40).map((f, i) => (
                  <li key={`${f.foodId}-${i}`} className="card-soft p-3">
                    <button
                      className="text-left w-full"
                      onClick={() => setEditing(foods.find((x) => x.id === f.foodId) ?? null)}
                    >
                      <p className="text-sm font-semibold text-ink-900">{f.name}</p>
                      <p className="text-xs text-ink-700">{f.detail}</p>
                      {f.suggestion && <p className="text-xs text-ink-500 mt-0.5">{f.suggestion}</p>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {editing && <FoodEditor food={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

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
