import { DayChart } from 'bite-buddy'

/** The dates a span covers, oldest first, ending on `end`. */
function backFrom(end: string, n: number): string[] {
  const last = new Date(end + 'T12:00:00')
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(last)
    d.setDate(last.getDate() - (n - 1 - i))
    return d.toISOString().slice(0, 10)
  })
}

/** The same rolling mean the trends tab draws over the bars, nulls and all. */
function rolling(values: (number | null)[], window = 7): (number | null)[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - Math.floor(window / 2))
    const seen = values.slice(from, i + Math.ceil(window / 2)).filter((v): v is number => v != null)
    return seen.length ? seen.reduce((a, b) => a + b, 0) / seen.length : null
  })
}

const points = (
  end: string,
  values: (number | null)[],
  recordedUntil = values.length,
) => backFrom(end, values.length).map((date, i) => ({
  date,
  value: values[i],
  recorded: i < recordedUntil,
}))

// Four weeks of Arany's days, ending today. Three of them were never written
// down, and the last six are planned but not yet ticked off.
const fourWeeks: (number | null)[] = [
  1740, 1820, 1655, null, 1910, 1780, 2050,
  1690, 1725, 1840, null, null, 1595, 1880,
  1770, 1930, 1640, 1710, 1860, 2010, 1580,
  1755, 1800, 1845, 1690, 1720, 1660, 1795,
]

/**
 * Four weeks of calories against the 1800 target.
 *
 * The default reading on the trends tab, and the one that shows all four
 * things at once: recorded days in green, still-planned days in pale bite, the
 * dashed target and the seven-day mean over the top.
 */
export function AMonthOfCalories() {
  return (
    <div style={{ width: 520 }}>
      <DayChart
        points={points('2026-09-10', fourWeeks, 22)}
        target={1800}
        smoothed={rolling(fourWeeks)}
        unit="kcal"
      />
    </div>
  )
}

// Twelve weeks of protein. Written as a shape rather than eighty-four typed
// numbers: a slow climb from the mid-nineties towards the 120 target, with a
// week off in the middle where nothing was recorded.
const twelveWeeks: (number | null)[] = Array.from({ length: 84 }, (_, i) => {
  if (i >= 38 && i < 45) return null
  return Math.round(94 + i * 0.34 + Math.sin(i * 1.1) * 11 + Math.sin(i * 0.37) * 6)
})

/**
 * Twelve weeks, which is the longest span the tab offers.
 *
 * The density test. At 84 bars a day is two pixels wide, the axis drops to one
 * label a fortnight, and the smoothed line is the only thing still readable,
 * which is the argument for drawing it at all.
 */
export function AQuarterOfProtein() {
  return (
    <div style={{ width: 520 }}>
      <DayChart
        points={points('2026-09-10', twelveWeeks, 70)}
        target={120}
        smoothed={rolling(twelveWeeks)}
        unit="g"
      />
    </div>
  )
}

/**
 * A fortnight with holidays in it.
 *
 * A day nobody wrote anything down for is drawn as a hairline gap, not as a
 * bar of height nought. This is the cell to check that against: five of these
 * fourteen days say nothing, and none of them claims Oli ate nothing.
 */
export function GappyFortnight() {
  const values: (number | null)[] = [
    1880, null, null, 1640, 1795, null, 1710,
    1955, null, 1620, 1770, 1840, null, 1690,
  ]
  return (
    <div style={{ width: 460 }}>
      <DayChart
        points={points('2026-09-10', values, 14)}
        target={1800}
        smoothed={rolling(values)}
        unit="kcal"
      />
    </div>
  )
}

/**
 * A fortnight that is mostly intention.
 *
 * Everything from the fourth day on is planned and not ticked, so the chart is
 * almost entirely pale. Worth looking at because it is the case where the
 * legend is doing the work: without it this is just a chart in a different
 * colour, and the number under it would be a chart of intentions.
 */
export function MostlyStillPlanned() {
  const values: (number | null)[] = [
    1720, 1810, 1665, 1900, 1745, 1830, 1690,
    1775, 1860, 1620, 1935, 1700, 1785, 1840,
  ]
  return (
    <div style={{ width: 460 }}>
      <DayChart
        points={points('2026-09-10', values, 3)}
        target={1800}
        smoothed={rolling(values)}
        unit="kcal"
      />
    </div>
  )
}

/**
 * A figure with no target set, drawn shorter.
 *
 * Sugar is not one of the five the dietician wrote a number for, so there is
 * no dashed line and the peak is set by the days themselves. `height` is the
 * only other lever, and 96 is about the floor before the bars stop reading.
 */
export function NoTarget() {
  const values: (number | null)[] = [
    41, 38, 52, 29, 47, 61, 35,
    44, 39, 55, 31, 42, 48, 36,
  ]
  return (
    <div style={{ width: 460 }}>
      <DayChart
        points={points('2026-09-10', values, 12)}
        smoothed={rolling(values)}
        unit="g"
        height={96}
      />
    </div>
  )
}
