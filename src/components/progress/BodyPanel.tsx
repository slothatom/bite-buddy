import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useUserStore } from '../../store/useUserStore'
import {
  useBodyStore, useWeightFor, useMeasurementsFor, useUnassignedCount,
} from '../../store/useBodyStore'
import { MEASUREMENT_KEYS, MEASUREMENT_LABELS, type MeasurementKey } from '../../types'
import { usePeople } from '../../store/useHousehold'
import { today } from '../../store/useMealPlanStore'
import { EmptyState, ChipCheck } from '../ui'
import BodyChart from '../body/BodyChart'
import {
  BODY_SPANS, BODY_SPAN_LABELS, changeOver, spanStart, withinSpan, type Reading,
  type BodySpan,
} from '../../lib/body'
import { fromKg, inUnit, round1, toKg } from '../../lib/weight'
import { useWhose } from './useWhose'

/** Weight and the tape measure, for whoever the header has picked. */
export default function BodyPanel() {
  const {
    addWeightEntry, removeWeightEntry, addMeasurement, removeMeasurement, claimUnassigned,
  } = useBodyStore()
  const { profile, setWeightGoal } = useUserStore()

  // One person at a time, picked in the header. Two waists averaged into one
  // line is a graph of nothing.
  const people = usePeople()
  const who = useWhose()
  const unassigned = useUnassignedCount()

  const weights = useWeightFor(who)
  const measurements = useMeasurementsFor(who)

  /*
   * Everything on this screen, in the unit you asked to read in.
   *
   * The store keeps what you typed and the unit you typed it in, and this is
   * where that becomes a number on a page. Before the setting was settable it
   * did not matter: every entry said kg and so did the profile, so printing
   * the stored figure with the profile's label next to it happened to be
   * right. It stops being right the moment somebody switches, so the reading
   * goes through lib/weight.ts and the store is left alone.
   *
   * Goals are held in kilograms whatever the reading unit, because a goal is a
   * bare number with no unit of its own to remember.
   */
  const unit = profile.weightUnit
  const goalKg = profile.weightGoals?.[who]
  const goal = goalKg == null ? undefined : round1(fromKg(goalKg, unit))

  const [value, setValue] = useState('')
  const [sizes, setSizes] = useState<Partial<Record<MeasurementKey, string>>>({})

  /*
   * How far back the charts and the histories read.
   *
   * One control for both, because a body is one subject: nobody wants the
   * weight over a year beside a waist over three months. Months rather than
   * weeks, because a body moves slowly and gets measured rarely, and a
   * fortnight of it is two dots.
   */
  const [span, setSpan] = useState<BodySpan>('halfYear')
  /** The earliest date the span reaches, or nothing at all for "All". */
  const spanFloor = spanStart(span, today())
  const [measuring, setMeasuring] = useState<MeasurementKey>('waist')
  const now = today()

  /** Every weigh-in in the span, in the unit being read. */
  const weightSeen = useMemo<Reading[]>(
    () => withinSpan(weights.map((w) => ({ date: w.date, value: inUnit(w, unit) })), span, now),
    [weights, unit, span, now],
  )
  const weightMoved = useMemo(() => changeOver(weightSeen), [weightSeen])

  const measured = useMemo<Reading[]>(
    () => withinSpan(
      measurements
        .filter((m) => m.measurements[measuring] != null)
        .map((m) => ({ date: m.date, value: m.measurements[measuring]! })),
      span, now,
    ),
    [measurements, measuring, span, now],
  )
  const measureMoved = useMemo(() => changeOver(measured), [measured])

  /** Only the measures actually taken, so the chips are not five dead ends. */
  const measuresTaken = useMemo(
    () => MEASUREMENT_KEYS.filter((k) => measurements.some((m) => m.measurements[k] != null)),
    [measurements],
  )



  const anySize = MEASUREMENT_KEYS.some((k) => Number(sizes[k]))

  return (
    <div className="space-y-5">
      {/* How far back everything below reads. One control, because a body is
          one subject and nobody wants a year of weight beside three months of
          waist. */}
      <div className="flex flex-wrap gap-1.5">
        {BODY_SPANS.map((s) => (
          <button
            key={s}
            onClick={() => setSpan(s)}
            aria-pressed={span === s}
            className={span === s ? 'chip-on' : 'chip-off'}
          >
            <ChipCheck on={span === s} />
            {BODY_SPAN_LABELS[s]}
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
            {people.find((p) => p.id === who)?.name}'s
          </button>
        </div>
      )}

      {/* ─── Weight ──────────────────────────────────────────────────────── */}
      <div className="card p-4">
        <label className="label">Log today's weight ({unit})</label>
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
                // Stored as typed, in the unit it was typed in. Converting on
                // the way in would round somebody's 68.4 into 150.8 and back
                // into 68.399, and the entry would drift every time the
                // setting was flipped.
                unit,
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
            <p className="text-xs font-bold uppercase tracking-wide text-ink-500">
              Over {BODY_SPAN_LABELS[span].toLowerCase()}
            </p>
            {/* The change across what is on screen, and how long it took. Down
                two kilos means two different things over a fortnight and over
                a year, and one weigh-in is no change rather than a change of
                nought. */}
            <p className={`text-3xl font-extrabold font-mono ${
              (weightMoved?.change ?? 0) <= 0 ? 'text-bite-700' : 'text-coral-600'}`}>
              {weightMoved?.change == null ? '--' : (
                <>{weightMoved.change > 0 ? '+' : ''}{weightMoved.change.toFixed(1)}</>
              )}
              <span className="text-base text-ink-500 font-semibold ml-1">{unit}</span>
            </p>
            <p className="text-xs text-ink-500 mt-1">
              {weightMoved?.change == null
                ? 'One weigh-in so far, which is a reading rather than a change.'
                : `across ${weightMoved.days} ${weightMoved.days === 1 ? 'day' : 'days'}, from ${
                  weightMoved.first.value} to ${weightMoved.last.value} ${unit}.`}
              {goal != null && weightMoved && (() => {
                const togo = weightMoved.last.value - goal
                return Math.abs(togo) < 0.05
                  ? ' At your goal.'
                  : ` ${Math.abs(togo).toFixed(1)} ${unit} ${togo > 0 ? 'to go' : 'below your goal'}.`
              })()}
            </p>

            {weightSeen.length
              ? <BodyChart readings={weightSeen} unit={unit} goal={goal} />
              : (
                <p className="text-sm text-ink-500 mt-3">
                  Nothing weighed in this stretch. The entries are still there; widen the range
                  above to see them.
                </p>
              )}

            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-100">
              <label className="label mb-0 shrink-0" htmlFor="goal">Aiming for</label>
              <input
                id="goal"
                type="number" min={0} step={0.1} className="input w-24 px-2"
                placeholder="none"
                value={goal ?? ''}
                // Typed in whatever you read in, held in kilograms.
                onChange={(e) => setWeightGoal(
                  who,
                  e.target.value ? toKg(Number(e.target.value), unit) : undefined,
                )}
              />
              <span className="text-sm text-ink-500">{unit}</span>
            </div>
          </div>

          {/* The same stretch the chart above is drawn from, so the list and
              the picture are about one thing. */}
          <div className="card divide-y divide-border-100">
            {[...weights].filter((w) => weightSeen.some((r) => r.date === w.date)).reverse().map((w) => (
              <div key={w.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-ink-700">{formatDay(w.date)}</span>
                <span className="flex items-center gap-3">
                  <span className="text-sm font-mono font-semibold text-ink-900">
                  {inUnit(w, unit)} {unit}
                  {/* What you actually typed, where it was another unit. The
                      converted figure is the comparable one and the typed one
                      is the true one, and dropping either loses something. */}
                  {w.unit !== unit && (
                    <span className="ml-1.5 font-normal text-ink-500">({w.weight} {w.unit})</span>
                  )}
                </span>
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
      <h3 className="text-base font-extrabold text-ink-900 pt-1">Measurements</h3>
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
        <EmptyState title="Nothing measured yet">
          Waist, hips, chest, arms and thighs, each one its own line, because they move at
          different times and an average of the five says nothing.
        </EmptyState>
      ) : (
        <>
          {/* The five latest figures, each with what it has done. Five charts
              at once would be five pictures nobody compares; the chart below
              draws whichever one is being asked about. */}
          <div className="grid gap-3 sm:grid-cols-2">
            {MEASUREMENT_KEYS.map((key) => {
              // The same stretch as the chart below. Read over all time while
              // the chart read six months, the card said the waist was down 11
              // and the chart said 7, and both were true, which is the worst
              // way for two numbers about one thing to disagree.
              const series = measurements
                .filter((m) => !spanFloor || m.date >= spanFloor)
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
                </div>
              )
            })}
          </div>

          {measuresTaken.length > 0 && (
            <div className="card p-5">
              {/* One at a time, and only the ones you have actually taken.
                  Waist and thighs on one pair of axes is a chart about the
                  difference between a waist and a thigh. */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {measuresTaken.map((key) => (
                  <button
                    key={key}
                    onClick={() => setMeasuring(key)}
                    aria-pressed={measuring === key}
                    className={measuring === key ? 'chip-on' : 'chip-off'}
                  >
                    <ChipCheck on={measuring === key} />
                    {MEASUREMENT_LABELS[key]}
                  </button>
                ))}
              </div>

              {measured.length ? (
                <>
                  <p className="text-sm text-ink-700">
                    {measureMoved?.change == null
                      ? `One reading of your ${MEASUREMENT_LABELS[measuring].toLowerCase()} in this
                         stretch, which is a measurement rather than a change.`
                      : (
                        <>
                          <strong className="font-mono text-ink-900">
                            {measureMoved.change > 0 ? '+' : ''}{measureMoved.change.toFixed(1)} cm
                          </strong>{' '}
                          across {measureMoved.days} {measureMoved.days === 1 ? 'day' : 'days'},
                          from {measureMoved.first.value} to {measureMoved.last.value} cm.
                        </>
                      )}
                  </p>
                  <BodyChart readings={measured} unit="cm" />
                </>
              ) : (
                <p className="text-sm text-ink-500">
                  No {MEASUREMENT_LABELS[measuring].toLowerCase()} taken in this stretch. Widen the
                  range above to reach the earlier ones.
                </p>
              )}
            </div>
          )}

          <div className="card divide-y divide-border-100">
            {[...measurements].filter((m) => !spanFloor || m.date >= spanFloor).reverse().map((m) => (
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
