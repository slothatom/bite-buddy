import { useMemo, useState } from 'react'
import { Plus, Trash2, Upload, X, Search, Moon, Footprints } from 'lucide-react'
import type { ExerciseKind, SleepEntry, StepEntry, Workout, WorkoutEntry } from '../types'
import { PEOPLE, type PersonId } from '../lib/people'
import {
  useActivityStore, useSleepFor, useStepsFor, useWorkoutsFor,
} from '../store/useActivityStore'
import { useBodyStore } from '../store/useBodyStore'
import { EXERCISE_BY_ID, searchExercises, workoutCalories, workoutMinutes } from '../lib/exercise'
import { EXERCISE_GROUP_LABELS } from '../data/exercises'
import { parseGarminCsv, parseGarminJson, type ImportedActivity } from '../lib/garminImport'
import { EmptyState, SectionHeading } from '../components/ui'

/**
 * Training and sleep, one person at a time.
 *
 * Kept apart from the food side of the app on purpose: what you ate is shared,
 * because you eat the same dinners, and what you did is not. Two people's
 * sessions added together is a graph of a household, which nobody trains for.
 */
export default function Activity() {
  const [who, setWho] = useState<PersonId>(PEOPLE[0].id)
  const [tab, setTab] = useState<'exercise' | 'sleep'>('exercise')

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header>
          <h1 className="display text-xl sm:text-2xl text-ink-900">Movement</h1>
          <p className="text-sm text-ink-700">What you did, and how you slept.</p>
        </header>

        <div className="flex flex-wrap gap-3">
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

          <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit" role="tablist">
            {(['exercise', 'sleep'] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={tab === t ? 'tab-on' : 'tab-off'}
              >
                {t === 'exercise' ? 'Exercise' : 'Sleep'}
              </button>
            ))}
          </div>
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
  const workouts = useWorkoutsFor(who)
  const steps = useStepsFor(who)
  const { removeWorkout } = useActivityStore()
  const weightKg = useWeightOf(who)
  const [building, setBuilding] = useState(false)
  const [bulk, setBulk] = useState(false)

  const week = workouts.slice(-7).reverse()
  const minutes = week.reduce((n, w) => n + workoutMinutes(w), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => setBuilding(true)}>
          <Plus size={16} /> Build a session
        </button>
        <button className="btn-secondary" onClick={() => setBulk(true)}>
          Log it in one go
        </button>
      </div>

      {!weightKg && (
        <p className="text-xs text-ink-500">
          No weight logged for {PEOPLE.find((p) => p.id === who)?.name} yet, so sessions show
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
        <section>
          <SectionHeading>
            Recent sessions
            <span className="ml-2 text-sm font-normal text-ink-500">{minutes} min across {week.length}</span>
          </SectionHeading>
          <div className="card divide-y divide-border-100">
            {[...workouts].reverse().slice(0, 30).map((w) => (
              <WorkoutRow key={w.id} workout={w} weightKg={weightKg} onRemove={() => removeWorkout(w.id)} />
            ))}
          </div>
        </section>
      )}

      <StepsPanel who={who} steps={steps} />

      {building && <SessionBuilder who={who} onClose={() => setBuilding(false)} />}
      {bulk && <BulkDialog who={who} onClose={() => setBulk(false)} />}
    </div>
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
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink-900">{what}</p>
        <p className="text-xs text-ink-500">
          {new Date(workout.date + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short' })}
          {' · '}{workoutMinutes(workout)} min
          {kcal != null && ` · about ${kcal} kcal`}
        </p>
        {workout.note && <p className="text-xs text-ink-700 mt-0.5">{workout.note}</p>}
      </div>
      <button
        className="btn-ghost btn-icon shrink-0 text-ink-300 hover:text-coral-600"
        aria-label="Remove session"
        onClick={onRemove}
      >
        <Trash2 size={15} />
      </button>
    </div>
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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
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
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            className="input pl-9"
            placeholder="Search exercises"
            aria-label="Search exercises"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [label, setLabel] = useState('')
  const [minutes, setMinutes] = useState(60)
  const [calories, setCalories] = useState(0)

  return (
    <Sheet title="Log it in one go" onClose={onClose}>
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
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [value, setValue] = useState('')
  const recent = [...steps].reverse().slice(0, 7)
  const average = recent.length
    ? Math.round(recent.reduce((n, s) => n + s.steps, 0) / recent.length)
    : 0

  return (
    <section>
      <SectionHeading>
        <span className="flex items-center gap-2"><Footprints size={16} /> Steps</span>
      </SectionHeading>
      <div className="card p-4 space-y-3">
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
                  {s.source === 'garmin' && <span className="text-ink-300 ml-1">watch</span>}
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
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [hours, setHours] = useState('')
  const [quality, setQuality] = useState(0)

  const recent = [...sleep].reverse().slice(0, 14)
  const average = recent.length
    ? recent.reduce((n, s) => n + s.hours, 0) / recent.length
    : 0

  return (
    <div className="space-y-5">
      <div className="card p-4 space-y-3">
        <p className="text-sm font-semibold text-ink-900 flex items-center gap-2">
          <Moon size={16} /> Last night
        </p>
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
          <span className="text-xs text-ink-500">How was it</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              aria-label={`${n} out of 5`}
              onClick={() => setQuality(quality === n ? 0 : n)}
              className={`w-8 h-8 rounded-lg text-sm font-bold ${
                quality >= n ? 'bg-bite-500 text-white' : 'bg-cream-50 text-ink-500'}`}
            >
              {n}
            </button>
          ))}
        </div>

        <GarminImport who={who} onImported={importActivity} />
      </div>

      {recent.length === 0 ? (
        <EmptyState title="No nights logged yet">
          Type in how long you slept, or bring in a Garmin export.
        </EmptyState>
      ) : (
        <section>
          <SectionHeading>
            Last {recent.length} nights
            <span className="ml-2 text-sm font-normal text-ink-500">
              {average.toFixed(1)} hours on average
            </span>
          </SectionHeading>
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
        {entry.source === 'garmin' && <span className="text-ink-300 ml-2 text-xs">watch</span>}
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
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
