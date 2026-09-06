import { useState } from 'react'
import { positions, range, type Reading } from '../../lib/body'

/**
 * A body figure over time, drawn on a real calendar.
 *
 * The chart this replaces spaced its points evenly along the box, one per
 * reading. Three weigh-ins in a week and then nothing until March came out as
 * four points marching steadily across the screen, which is a picture of a
 * habit nobody has. Here a point sits where its date puts it, so a gap is
 * drawn as a gap and a flurry is drawn as a flurry.
 *
 * Every figure on it can be reached by tapping, because a chart whose only way
 * to name a number is a `title` tooltip cannot be read on a phone, and a phone
 * is where this is read.
 */

const dayLabel = (date: string) =>
  new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const shortDay = (date: string) =>
  new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function BodyChart({
  readings, unit, goal, height = 150,
}: {
  readings: Reading[]
  unit: string
  /** The line being aimed at, folded into the range so it stays on screen. */
  goal?: number
  height?: number
}) {
  const [reading, setReading] = useState<string | null>(null)

  if (!readings.length) return null

  const { min, max } = range(readings.map((r) => r.value), goal)
  const span = max - min
  const at = positions(readings)
  // Inset from the sides so the first and last dot are not sliced in half by
  // the edge of the box.
  const x = (i: number) => 4 + at[i] * 92
  const y = (v: number) => 96 - ((v - min) / span) * 92

  const chosen = readings.find((r) => r.date === reading)
  const line = readings.map((r, i) => `${x(i)},${y(r.value)}`).join(' ')

  return (
    <div className="mt-3">
      {/* What was tapped, in words. Holds its height so nothing below it
          jumps as points are read. */}
      <p className="h-5 text-xs text-ink-700" role="status">
        {chosen && (
          <>
            <strong className="font-semibold text-ink-900">{dayLabel(chosen.date)}</strong>{' '}
            <span className="font-mono">{chosen.value} {unit}</span>
          </>
        )}
      </p>

      <div className="relative" style={{ height }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
        >
          {goal != null && (
            <line
              x1="0" x2="100" y1={y(goal)} y2={y(goal)}
              strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="4 3"
              className="stroke-ink-300"
            />
          )}
          {readings.length > 1 && (
            <polyline
              points={line} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke"
              className="stroke-teal-500" strokeLinejoin="round" strokeLinecap="round"
            />
          )}
        </svg>

        {/* The dots as buttons, over the line. A lone reading still gets one,
            so a first entry is a chart with a point on it rather than an
            empty box. */}
        {readings.map((r, i) => (
          <button
            key={r.date + r.value}
            type="button"
            onClick={() => setReading((was) => (was === r.date ? null : r.date))}
            aria-label={`${dayLabel(r.date)}, ${r.value} ${unit}`}
            className="absolute w-7 h-7 -ml-3.5 -mt-3.5 flex items-center justify-center"
            style={{ left: `${x(i)}%`, top: `${y(r.value)}%` }}
          >
            <span
              className={`block rounded-full border-2 border-paper bg-teal-500
                          ${reading === r.date ? 'w-3.5 h-3.5 ring-2 ring-ink-900' : 'w-2.5 h-2.5'}`}
            />
          </button>
        ))}
      </div>

      {/* The two ends of the stretch, named. Without them the box could be a
          fortnight or a decade and there is no way to tell. */}
      <p className="flex justify-between text-[10px] text-ink-500 mt-1">
        <span>{shortDay(readings[0].date)}</span>
        {readings.length > 1 && <span>{shortDay(readings[readings.length - 1].date)}</span>}
      </p>

      {goal != null && (
        <p className="text-xs text-ink-500 mt-1 flex items-center gap-1.5">
          <span className="w-4 border-t border-dashed border-ink-300" aria-hidden="true" />
          aiming for {goal} {unit}
        </p>
      )}
      <p className="text-xs text-ink-500">Tap a point to read it.</p>
    </div>
  )
}
