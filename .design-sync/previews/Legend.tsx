import { DayChart, Legend } from 'bite-buddy'

/**
 * The full legend, with a target to name.
 *
 * Four keys and a line of instruction. The target is the only one that carries
 * a number, so it is the only one that changes between charts.
 */
export function WithTarget() {
  return (
    <div style={{ width: 520 }}>
      <Legend target={1800} unit="kcal" />
    </div>
  )
}

/**
 * The same legend for a figure nobody set a target for.
 *
 * The dashed key drops out entirely rather than reading "target none", because
 * there is no dashed line on the chart above it to explain.
 */
export function NoTarget() {
  return (
    <div style={{ width: 520 }}>
      <Legend unit="g" />
    </div>
  )
}

/**
 * Where it actually lives: directly under the chart it describes.
 *
 * The pairing is the point. Recorded and still planned are two colours on the
 * bars, and this line is the only place either is named, so the two are graded
 * together or not at all.
 */
export function UnderTheChart() {
  const values = [1740, 1820, 1655, 1910, 1780, 2050, 1690, 1725, 1840, 1595, 1880, 1770, 1930, 1640]
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date('2026-09-10T12:00:00')
    d.setDate(d.getDate() - (13 - i))
    return d.toISOString().slice(0, 10)
  })
  return (
    <div style={{ width: 460 }}>
      <DayChart
        points={dates.map((date, i) => ({ date, value: values[i], recorded: i < 10 }))}
        target={1800}
        unit="kcal"
      />
      <Legend target={1800} unit="kcal" />
    </div>
  )
}

/**
 * Phone width, where the keys wrap onto three lines.
 *
 * The wrap is why the target key carries its own number instead of sitting in
 * a column: at 260 the keys land wherever they land, and each one has to stand
 * on its own.
 */
export function Narrow() {
  return (
    <div style={{ width: 260 }}>
      <Legend target={2300} unit="mg" />
    </div>
  )
}
