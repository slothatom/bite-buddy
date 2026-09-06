import { useState } from 'react'
import type { Point } from '../../lib/trends'

/**
 * The charts the trends tab is drawn with.
 *
 * Hand-rolled, because a charting library is 90 kB to draw eighty-four
 * rectangles and would arrive with its own opinions about colour that this
 * app's contrast checker cannot read.
 *
 * Two rules run through all of them. Nothing carries its meaning in hue alone,
 * so a recorded day is marked by a shape as well as a colour. And a day with no
 * food in it is drawn as a gap rather than as a zero, because the app does not
 * know what was eaten on a day nobody wrote anything down for, and a bar of
 * height nought says it does.
 */

const dayLabel = (date: string) =>
  new Date(date + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

/**
 * A bar per day, with a line for the target and a line for the trend.
 *
 * Bars rather than a line for the days themselves: a day is a discrete thing
 * that happened, and joining them implies a value in between that nobody ate.
 * The smoothed line goes over the top, where a line does belong.
 */
export default function DayChart({
  points, target, smoothed, unit, height = 140,
}: {
  points: Point[]
  /** The line to beat, or to stay under. Omitted where there is no target. */
  target?: number
  /** A rolling mean, drawn over the bars. Same length as `points`. */
  smoothed?: (number | null)[]
  unit: string
  height?: number
}) {
  // Which day is being read, if any. A chart whose only way to name a figure
  // is a `title` tooltip cannot be read on a phone at all, and a phone is
  // where this is read. Tapping a bar puts the day in words above the chart.
  const [reading, setReading] = useState<Point | null>(null)

  const values = points.map((p) => p.value).filter((v): v is number => v != null)
  if (!values.length) return null

  const peak = Math.max(...values, target ?? 0) * 1.05
  const pct = (v: number) => (peak > 0 ? (v / peak) * 100 : 0)

  // One label every week, which is the only spacing that fits twelve of them
  // on a phone without turning the axis into a smear.
  const every = points.length > 30 ? 14 : 7

  return (
    <div>
      {/* What was tapped, in words. Holds its height so the chart below does
          not jump up and down as days are read. */}
      <p className="h-5 text-xs text-ink-700" role="status">
        {reading?.value != null && (
          <>
            <strong className="font-semibold text-ink-900">{dayLabel(reading.date)}</strong>{' '}
            <span className="font-mono">{Math.round(reading.value).toLocaleString()} {unit}</span>
            <span className="text-ink-500">, {reading.recorded ? 'recorded' : 'still planned'}</span>
          </>
        )}
      </p>

      <div className="relative" style={{ height }}>
        {target != null && (
          <div
            className="absolute inset-x-0 border-t-2 border-dashed border-ink-900/40 z-10 pointer-events-none"
            style={{ bottom: `${pct(target)}%` }}
            aria-hidden="true"
          />
        )}

        {/* The smoothed line, as a polyline over the bars.
            The viewBox is one unit per day rather than one per gap, and each
            point sits at the middle of its day, because that is where the bar
            it belongs to is drawn. Mapping onto `length - 1` put the whole
            line half a bar to the left of the days it describes. */}
        {smoothed && (
          <svg
            // Drawn over the bars, but not in front of them: without this the
            // line and the target take every tap and no day can be read.
            className="absolute inset-0 w-full h-full overflow-visible z-10 pointer-events-none"
            preserveAspectRatio="none"
            viewBox={`0 0 ${points.length} 100`}
            aria-hidden="true"
          >
            <polyline
              fill="none"
              className="stroke-bite-700"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              points={smoothed
                .map((v, i) => (v == null ? null : `${i + 0.5},${100 - pct(v)}`))
                .filter(Boolean)
                .join(' ')}
            />
          </svg>
        )}

        <div className="absolute inset-0 flex items-end gap-px">
          {points.map((p) => (
            <div key={p.date} className="flex-1 h-full flex flex-col justify-end min-w-0">
              {p.value == null ? (
                // A day with nothing written down. Drawn as the gap it is, and
                // not offered as something to read: there is nothing to say.
                <div className="h-px bg-border-200" />
              ) : (
                <button
                  type="button"
                  onClick={() => setReading((was) => (was?.date === p.date ? null : p))}
                  aria-label={`${dayLabel(p.date)}, ${Math.round(p.value)} ${unit}, ${p.recorded ? 'recorded' : 'still planned'}`}
                  className={`w-full rounded-t-sm ${p.recorded ? 'bg-teal-500' : 'bg-bite-200'}
                              ${reading?.date === p.date ? 'ring-2 ring-ink-900 ring-offset-1' : ''}`}
                  style={{ height: `${Math.max(1, pct(p.value))}%` }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-px mt-1" aria-hidden="true">
        {points.map((p, i) => (
          <span key={p.date} className="flex-1 min-w-0 text-center text-[9px] text-ink-500">
            {i % every === 0 ? new Date(p.date + 'T12:00:00').getDate() : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * What the colours and the dashes mean, in words.
 *
 * Every chart in this app that used colour alone has been fixed once already.
 * A legend is the cheapest way to keep this one honest, and it doubles as the
 * only description a screen reader gets of a picture.
 */
export function Legend({ target, unit }: { target?: number; unit: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500 mt-2">
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-2 rounded-sm bg-teal-500" aria-hidden="true" />
        recorded
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-3 h-2 rounded-sm bg-bite-200" aria-hidden="true" />
        still planned
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-4 border-t-2 border-bite-700" aria-hidden="true" />
        the trend
      </span>
      {target != null && (
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-ink-900/40" aria-hidden="true" />
          target {Math.round(target).toLocaleString()} {unit}
        </span>
      )}
      <span className="basis-full">Tap a day to read it.</span>
    </p>
  )
}
