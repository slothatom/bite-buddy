import { useMemo, useState } from 'react'
import { useDialog } from '../lib/useDialog'
import { Check, Dumbbell, Plus, Trash2, Upload, X, Moon, Footprints } from 'lucide-react'
import type { ExerciseKind, SleepEntry, StepEntry, Workout, WorkoutEntry } from '../types'
import { personName, type PersonId } from '../lib/people'
import { usePeople } from '../store/useHousehold'
import { today as todayDate } from '../store/useMealPlanStore'
import { useThisWeek } from '../store/useThisWeek'
import {
  useActivityStore, useMovementAcross, useSleepFor, useStepsFor, useWorkoutsFor,
} from '../store/useActivityStore'
import { useBodyStore } from '../store/useBodyStore'
import { EXERCISE_BY_ID, searchExercises, workoutCalories, workoutMinutes } from '../lib/exercise'
import { EXERCISE_GROUP_LABELS } from '../data/exercises'
import { parseGarminCsv, parseGarminJson, type ImportedActivity } from '../lib/garminImport'
import { EmptyState, SearchField } from '../components/ui'
import ProgressHeader from '../components/progress/ProgressHeader'
import { useWhose } from '../components/progress/useWhose'
import { rangeLabel } from '../components/progress/overview'

/**
 * Training and sleep, one person at a time.
 *
 * Kept apart from the food side of the app on purpose: what you ate is shared,
 * because you eat the same dinners, and what you did is not. Two people's
 * sessions added together is a graph of a household, which nobody trains for.
 * Whose is picked in the Progress header, the same choice the overview reads.
 */
export default function Activity() {
  const who = useWhose()
  const [tab, setTab] = useState<'exercise' | 'sleep'>('exercise')

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="max-w-3xl md:max-w-6xl mx-auto px-4 sm:px-6 md:px-8 pt-3 md:pt-6 space-y-3 md:space-y-4">
        <ProgressHeader whose />

        {/* What, as toggles under the tabs, so it does not read as more of
            the person picker or of the tabs above it. */}
        <div role="group" aria-label="What to show" className="flex gap-2">
          {(['exercise', 'sleep'] as const).map((t) => {
            const on = tab === t
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setTab(t)}
                className={`inline-flex items-center gap-1.5 min-h-11 md:min-h-9 px-3 rounded-full border text-[13px] ${
                  on ? 'border-bite-700 bg-bite-100 text-bite-700 font-extrabold'
                    : 'border-border-200 bg-paper text-ink-900 font-bold'}`}
              >
                {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                {t === 'exercise' ? 'Exercise' : 'Sleep'}
              </button>
            )
          })}
        </div>

        {tab === 'exercise' ? <ExerciseTab who={who} /> : <SleepTab who={who} />}
      </div>
    </div>
  )
}

/** The weight used to cost a session, which is that person's own latest. */
function useWeightOf(personId: PersonId): number | undefined {
  const entries = useBodyStore((s) => s.weightEntries)
  return useMemo(() => {
    const mine = entries.filter((e) => e.memberId === personId)
    const last = mine[mine.length - 1]
    return last?.unit === 'kg' ? last.weight : last ? last.weight * 0.4536 : undefined
  }, [entries, personId])
}

function ExerciseTab({ who }: { who: PersonId }) {
  const people = usePeople()
  const workouts = useWorkoutsFor(who)
  const steps = useStepsFor(who)
  const { removeWorkout } = useActivityStore()
  const weightKg = useWeightOf(who)
  const weekDates = useThisWeek()
  const [building, setBuilding] = useState(false)
  const [bulk, setBulk] = useState(false)

  const newest = [...workouts].reverse().slice(0, 30)
  const thisWeek = newest.filter((w) => weekDates.includes(w.date))
  const earlier = newest.filter((w) => !weekDates.includes(w.date))

  const actions = (className: string) => (
    <div className={`gap-2 ${className}`}>
      <button className="btn-primary flex-1 min-h-12 text-[15px] font-extrabold" onClick={() => setBuilding(true)}>
        <Plus size={16} strokeWidth={2.5} /> Build a session
      </button>
      <button
        className="btn min-h-12 px-4 rounded-lg border border-bite-700 text-bite-700 text-[15px] font-bold hover:bg-bite-50"
        onClick={() => setBulk(true)}
      >
        Log in one go
      </button>
    </div>
  )

  const list = (items: Workout[]) => (
    <ul className="card overflow-hidden divide-y divide-border-100">
      {items.map((w) => (
        <WorkoutRow key={w.id} workout={w} weightKg={weightKg} onRemove={() => removeWorkout(w.id)} />
      ))}
    </ul>
  )

  return (
    <div className="grid gap-3 md:gap-4 md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
      <div className="space-y-3 md:space-y-4 min-w-0">
        <MovementWeek who={who} dates={weekDates} />
        {actions('flex md:hidden')}

        {!weightKg && (
          <p className="text-xs text-ink-700">
            No weight logged for {personName(people, who)} yet, so sessions show
            minutes but no calories. A calorie figure that assumes a body weight is a made-up
            number. Log one under Progress and they fill in.
          </p>
        )}

        {workouts.length === 0 ? (
          <EmptyState title="Nothing logged yet">
            Build a session from the exercise list, or log the whole thing in one line when the
            detail is not worth typing.
          </EmptyState>
        ) : (
          <>
            <section aria-labelledby="log-h" className="space-y-1.5">
              <h2 id="log-h" className="text-base font-extrabold text-ink-900">Logged this week</h2>
              {thisWeek.length
                ? list(thisWeek)
                : <p className="text-sm text-ink-700">Nothing yet this week.</p>}
            </section>
            {earlier.length > 0 && (
              <section aria-labelledby="earlier-h" className="space-y-1.5">
                <h2 id="earlier-h" className="text-base font-extrabold text-ink-900">Earlier</h2>
                {list(earlier)}
              </section>
            )}
          </>
        )}
      </div>

      <div className="space-y-3 md:space-y-4 min-w-0">
        {actions('hidden md:flex')}
        <StepsPanel who={who} steps={steps} />
      </div>

      {building && <SessionBuilder who={who} onClose={() => setBuilding(false)} />}
      {bulk && <BulkDialog who={who} onClose={() => setBulk(false)} />}
    </div>
  )
}

/**
 * The week's movement: days rather than a total, because a week with four
 * half hours in it and a week with one long Sunday are different weeks and one
 * number cannot tell them apart. Nothing is subtracted from the food: see
 * lib/movement.ts for why the target stays where the dietician put it.
 */
function MovementWeek({ who, dates }: { who: PersonId; dates: string[] }) {
  const moved = useMovementAcross(who, dates)
  const today = todayDate()
  const active = moved.filter((d) => d.movement.sessions > 0)
  const minutes = active.reduce((n, d) => n + d.movement.minutes, 0)
  // Only the days that could be costed. Summing a week where one day has no
  // weight behind it and calling the result the week's total would report a
  // smaller number than the week actually was, without saying so.
  const costed = active.filter((d) => d.movement.kcal != null)
  const kcal = costed.reduce((n, d) => n + (d.movement.kcal ?? 0), 0)
  const tallest = Math.max(...moved.map((d) => d.movement.minutes), 1)
  const label = `Minutes moved each day this week: ${moved.map(({ date, movement }) =>
    `${new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })} ${
      movement.minutes ? `${movement.minutes} min` : 'nothing logged'}`).join('; ')}.`

  return (
    <section aria-labelledby="mw-h" className="card p-4 md:px-[22px] md:py-[18px] flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="mw-h" className="text-base font-extrabold text-ink-900">This week</h2>
        <span className="text-xs text-ink-700">{rangeLabel(dates, true)}</span>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 items-baseline text-[13px] text-ink-700">
        <span><strong className="text-[22px] font-extrabold text-ink-900 tabular-nums">{active.length}</strong>
          {active.length === 1 ? ' day' : ' days'} moved</span>
        <span><strong className="text-[22px] font-extrabold text-ink-900 tabular-nums">{minutes}</strong> min</span>
        {costed.length > 0 && (
          <span>about <strong className="text-[22px] font-extrabold text-ink-900 tabular-nums">
            {Math.round(kcal).toLocaleString()}</strong> kcal</span>
        )}
      </p>

      {/* A bar per day of the week, in minutes: the same seven columns as the
          calorie chart on the overview, so the two read against each other. */}
      <div role="img" aria-label={label} className="flex flex-col gap-1">
        <div className="h-16 md:h-28 grid grid-cols-7 gap-2 items-end">
          {moved.map(({ date, movement }) => (
            <div
              key={date}
              className={`rounded-t-md ${movement.minutes > 0 ? 'bg-leaf-500' : 'bg-border-200'}`}
              style={{ height: movement.minutes > 0 ? `${(movement.minutes / tallest) * 100}%` : '3px' }}
            />
          ))}
        </div>
        <div aria-hidden="true" className="grid grid-cols-7 gap-2 border-t border-border-200 pt-1">
          {moved.map(({ date, movement }) => (
            <div key={date} className="flex flex-col items-center gap-0.5">
              <span className="text-xs leading-[14px] font-bold text-ink-900 tabular-nums">
                {movement.minutes > 0 ? movement.minutes : ''}
              </span>
              <span className={`text-xs leading-[14px] ${date === today ? 'text-bite-700 font-extrabold' : 'text-ink-700 font-semibold'}`}>
                {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'narrow' })}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-ink-700">
        Minutes per day.{' '}
        {costed.length < active.length
          ? 'Some days have no weight recorded, so they carry minutes but no calorie estimate. '
          : ''}
        Calories here are an estimate from a table of averages, and none of it is taken off your
        food target: it stays where your dietician set it.
      </p>
    </section>
  )
}

function WorkoutRow({
  workout, weightKg, onRemove,
}: {
  workout: Workout
  weightKg?: number
  onRemove: () => void
}) {
  const kcal = workoutCalories(workout, weightKg)
  const what = workout.bulk
    ? workout.bulk.label
    : workout.entries
        .map((e) => EXERCISE_BY_ID.get(e.exerciseId)?.name ?? 'Something')
        .join(', ')

  return (
    <li className="flex items-center gap-3 py-1.5 pl-3.5 pr-1">
      <span aria-hidden="true" className="w-9 h-9 rounded-md bg-leaf-100 text-leaf-700 flex items-center justify-center shrink-0">
        <Dumbbell size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] leading-5 font-bold text-ink-900">{what}</p>
        <p className="text-xs text-ink-700">
          {new Date(workout.date + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short' })}
          {' · '}{workoutMinutes(workout)} min
          {kcal != null && ` · about ${kcal} kcal`}
        </p>
        {workout.note && <p className="text-xs text-ink-700 mt-0.5">{workout.note}</p>}
      </div>
      <button
        className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 text-ink-500 hover:text-coral-600 hover:bg-cream-50"
        aria-label={`Remove ${what}`}
        onClick={onRemove}
      >
        <Trash2 size={16} />
      </button>
    </li>
  )
}

/**
 * Building a session exercise by exercise.
 *
 * The catalogue ships with the app, so this works on a phone in a gym with no
 * signal, which is exactly where it gets used.
 */
function SessionBuilder({ who, onClose }: { who: PersonId; onClose: () => void }) {
  const { addWorkout } = useActivityStore()
  const [date, setDate] = useState(todayDate())
  const [query, setQuery] = useState('')
  const [entries, setEntries] = useState<WorkoutEntry[]>([])
  const [note, setNote] = useState('')

  const results = useMemo(() => searchExercises(query), [query])

  function add(kind: ExerciseKind) {
    setEntries((list) => [...list, {
      id: `${Date.now().toString(36)}-${list.length}`,
      exerciseId: kind.id,
      minutes: kind.reps ? 10 : 30,
      ...(kind.reps ? { sets: 3, reps: 10 } : {}),
    }])
    setQuery('')
  }

  function patch(id: string, updates: Partial<WorkoutEntry>) {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...updates } : e)))
  }

  return (
    <Sheet title="Build a session" onClose={onClose}>
      <div className="p-5 pb-3 space-y-3 shrink-0">
        <div>
          <label className="label" htmlFor="session-date">Date</label>
          <input id="session-date" type="date" className="input" value={date}
            onChange={(e) => setDate(e.target.value)} />
        </div>
        <SearchField
          placeholder="Search exercises"
          aria-label="Search exercises"
          value={query}
          onChange={setQuery}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 space-y-3">
        {entries.length > 0 && (
          <div className="card-soft divide-y divide-border-200">
            {entries.map((entry) => {
              const kind = EXERCISE_BY_ID.get(entry.exerciseId)
              return (
                <div key={entry.id} className="px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 min-w-0 text-sm font-semibold text-ink-900">{kind?.name}</p>
                    <button
                      className="btn-ghost btn-icon text-ink-300 hover:text-coral-600"
                      aria-label={`Remove ${kind?.name}`}
                      onClick={() => setEntries((l) => l.filter((e) => e.id !== entry.id))}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Field label="Minutes" value={entry.minutes}
                      onChange={(v) => patch(entry.id, { minutes: v })} />
                    {kind?.reps && (
                      <>
                        <Field label="Sets" value={entry.sets ?? 0}
                          onChange={(v) => patch(entry.id, { sets: v })} />
                        <Field label="Reps" value={entry.reps ?? 0}
                          onChange={(v) => patch(entry.id, { reps: v })} />
                        <Field label="kg" value={entry.weightKg ?? 0}
                          onChange={(v) => patch(entry.id, { weightKg: v })} />
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="card-soft divide-y divide-border-200">
          {results.map((kind) => (
            <button
              key={kind.id}
              className="w-full text-left px-3 py-2.5 hover:bg-cream-50 transition-colors"
              onClick={() => add(kind)}
            >
              <span className="text-sm text-ink-900">{kind.name}</span>
              <span className="text-xs text-ink-500 ml-2">
                {EXERCISE_GROUP_LABELS[kind.group]} · {kind.met} MET
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 pt-3 shrink-0 border-t border-border-100 space-y-2"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <input className="input" placeholder="Note, if you want one" aria-label="Note"
          value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1"
            disabled={!entries.length}
            onClick={() => {
              addWorkout({
                id: `w-${Date.now().toString(36)}`,
                personId: who, date, entries, note: note.trim() || undefined,
              })
              onClose()
            }}
          >
            Save session
          </button>
        </div>
      </div>
    </Sheet>
  )
}

/** For when the detail is not worth typing: "gym, an hour, about 400 kcal". */
function BulkDialog({ who, onClose }: { who: PersonId; onClose: () => void }) {
  const { addWorkout } = useActivityStore()
  const [date, setDate] = useState(todayDate())
  const [label, setLabel] = useState('')
  const [minutes, setMinutes] = useState(60)
  const [calories, setCalories] = useState(0)

  return (
    <Sheet title="Log in one go" onClose={onClose}>
      <div className="p-5 space-y-3 flex-1 min-h-0 overflow-y-auto">
        <p className="text-sm text-ink-700">
          One line for the whole thing. If your watch gave you a calorie figure, put it in and
          it is used as given: you were there and it was there, and this app's table was not.
        </p>
        <div>
          <label className="label" htmlFor="bulk-label">What was it</label>
          <input id="bulk-label" className="input" placeholder="Gym, climbing, a long walk"
            value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="bulk-date">Date</label>
          <input id="bulk-date" type="date" className="input" value={date}
            onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minutes" value={minutes} onChange={setMinutes} />
          <Field label="kcal, if known" value={calories} onChange={setCalories} />
        </div>
      </div>
      <div className="flex gap-2 p-5 pt-3 shrink-0 border-t border-border-100"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}>
        <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary flex-1"
          disabled={!label.trim() || !minutes}
          onClick={() => {
            addWorkout({
              id: `w-${Date.now().toString(36)}`,
              personId: who, date, entries: [],
              bulk: { label: label.trim(), minutes, calories: calories || undefined },
            })
            onClose()
          }}
        >
          Save
        </button>
      </div>
    </Sheet>
  )
}

/** Steps, by hand or out of a watch export. */
function StepsPanel({ who, steps }: { who: PersonId; steps: StepEntry[] }) {
  const { addSteps, importActivity } = useActivityStore()
  const [today] = useState(() => todayDate())
  const [value, setValue] = useState('')
  const recent = [...steps].reverse().slice(0, 7)
  const average = recent.length
    ? Math.round(recent.reduce((n, s) => n + s.steps, 0) / recent.length)
    : 0

  return (
    <section aria-labelledby="steps-h" className="card p-4 space-y-3">
      <h2 id="steps-h" className="flex items-center gap-2 text-base font-extrabold text-ink-900">
        <Footprints size={16} aria-hidden="true" /> Steps
      </h2>
      <div className="space-y-3">
        {average > 0 && (
          <p className="text-sm text-ink-700">
            <strong className="font-mono text-ink-900">{average.toLocaleString()}</strong> a day
            across the last {recent.length}.
          </p>
        )}

        <div className="flex gap-2">
          <input
            className="input" type="number" inputMode="numeric" placeholder="Today's steps"
            aria-label="Steps today" value={value} onChange={(e) => setValue(e.target.value)}
          />
          <button
            className="btn-primary shrink-0"
            disabled={!Number(value)}
            onClick={() => {
              addSteps({
                id: `steps-${who}-${today}`, personId: who, date: today,
                steps: Number(value), source: 'manual',
              })
              setValue('')
            }}
          >
            Log
          </button>
        </div>

        <GarminImport who={who} onImported={importActivity} />

        {recent.length > 0 && (
          <ul className="text-xs text-ink-700 space-y-1">
            {recent.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>{new Date(s.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span className="font-mono">
                  {s.steps.toLocaleString()}
                  {s.source === 'garmin' && <span className="text-ink-500 ml-1">watch</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

/**
 * Bringing a watch export in.
 *
 * Garmin has no free public API: Connect's is a partner programme needing a
 * server to hold the credentials, and this app has no server. What it does
 * have is the file Garmin will give you, from Connect's reports or from the
 * full export in its privacy settings, and that is what this reads.
 */
function GarminImport({
  who, onImported,
}: {
  who: PersonId
  onImported: (rows: ImportedActivity) => void
}) {
  const [status, setStatus] = useState<string | null>(null)

  async function onFile(file: File, kind: 'steps' | 'sleep') {
    const text = await file.text()
    const parsed = file.name.endsWith('.json')
      ? parseGarminJson(text, who)
      : parseGarminCsv(text, { personId: who, kind })

    const total = parsed.steps.length + parsed.sleep.length
    if (!total) {
      setStatus('Nothing in that file this could read. Connect exports steps and sleep as CSV from its reports, and the whole account as JSON.')
      return
    }

    onImported(parsed)
    setStatus(
      `Brought in ${parsed.steps.length} days of steps and ${parsed.sleep.length} of sleep`
      + `${parsed.skipped ? `, and skipped ${parsed.skipped} rows it could not read` : ''}.`)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <label className="btn-secondary w-fit cursor-pointer">
          <Upload size={15} /> Steps from Garmin
          <input type="file" accept=".csv,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f, 'steps') }} />
        </label>
        <label className="btn-secondary w-fit cursor-pointer">
          <Upload size={15} /> Sleep from Garmin
          <input type="file" accept=".csv,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f, 'sleep') }} />
        </label>
      </div>
      {status && <p className="text-xs text-ink-700">{status}</p>}
    </div>
  )
}

function SleepTab({ who }: { who: PersonId }) {
  const sleep = useSleepFor(who)
  const { addSleep, removeSleep, importActivity } = useActivityStore()
  const [today] = useState(() => todayDate())
  const [hours, setHours] = useState('')
  const [quality, setQuality] = useState(0)

  const recent = [...sleep].reverse().slice(0, 14)
  const average = recent.length
    ? recent.reduce((n, s) => n + s.hours, 0) / recent.length
    : 0

  return (
    <div className="grid gap-3 md:gap-4 md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
      <div className="card p-4 space-y-3 md:order-2">
        <h2 className="text-base font-extrabold text-ink-900 flex items-center gap-2">
          <Moon size={16} aria-hidden="true" /> Last night
        </h2>
        <div className="flex gap-2">
          <input
            className="input" type="number" step="0.25" placeholder="Hours"
            aria-label="Hours slept" value={hours} onChange={(e) => setHours(e.target.value)}
          />
          <button
            className="btn-primary shrink-0"
            disabled={!Number(hours)}
            onClick={() => {
              addSleep({
                id: `sleep-${who}-${today}`, personId: who, date: today,
                hours: Number(hours), quality: quality || undefined, source: 'manual',
              })
              setHours('')
              setQuality(0)
            }}
          >
            Log
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-700">How was it</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              aria-label={`${n} out of 5`}
              onClick={() => setQuality(quality === n ? 0 : n)}
              className={`w-11 h-11 md:w-9 md:h-9 rounded-lg text-sm font-bold ${
                quality >= n ? 'bg-bite-500 text-on-brand' : 'bg-cream-50 text-ink-500'}`}
            >
              {n}
            </button>
          ))}
        </div>

        <GarminImport who={who} onImported={importActivity} />
      </div>

      {recent.length === 0 ? (
        <div className="md:order-1">
          <EmptyState title="No nights logged yet">
            Type in how long you slept, or bring in a Garmin export.
          </EmptyState>
        </div>
      ) : (
        <section aria-labelledby="nights-h" className="space-y-1.5 md:order-1 min-w-0">
          <h2 id="nights-h" className="text-base font-extrabold text-ink-900">
            Last {recent.length} nights
            <span className="ml-2 text-sm font-semibold text-ink-700">
              {average.toFixed(1)} hours on average
            </span>
          </h2>
          <div className="card divide-y divide-border-100">
            {recent.map((entry) => (
              <SleepRow key={entry.id} entry={entry} onRemove={() => removeSleep(entry.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SleepRow({ entry, onRemove }: { entry: SleepEntry; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="flex-1 min-w-0 text-sm text-ink-900">
        {new Date(entry.date + 'T12:00:00').toLocaleDateString('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short' })}
      </span>
      <span className="text-sm font-mono text-ink-700 shrink-0">
        {entry.hours.toFixed(1)} h
        {entry.quality ? <span className="text-ink-500 ml-2">{entry.quality}/5</span> : null}
        {entry.source === 'garmin' && <span className="text-ink-500 ml-2 text-xs">watch</span>}
      </span>
      <button
        className="btn-ghost btn-icon shrink-0 text-ink-300 hover:text-coral-600"
        aria-label="Remove night"
        onClick={onRemove}
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}

function Field({
  label, value, onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number" min={0} className="input px-2" aria-label={label}
        value={value} onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

/** The same sheet shape the rest of the app uses: header, scroll, footer. */
function Sheet({
  title, onClose, children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  const panel = useDialog<HTMLDivElement>(onClose)
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className="bg-paper w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-base font-extrabold text-ink-900">{title}</h2>
          <button className="btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
