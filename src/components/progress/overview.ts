import type { Nutrients, Targets } from '../../types'
import type { DayReading } from '../../lib/nutrition'
import { saltFromSodium } from '../../lib/nutrition'

/**
 * The arithmetic behind the Progress overview, kept apart from the markup so
 * it can be read (and tested) without a screen.
 */

/** "Mon 2 to Sun 8 Nov", or "2 to 8 Nov" without the weekdays. */
export function rangeLabel(dates: readonly string[], weekdays = false): string {
  if (!dates.length) return ''
  const a = new Date(dates[0] + 'T12:00:00')
  const b = new Date(dates[dates.length - 1] + 'T12:00:00')
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
  const left = a.toLocaleDateString('en-GB', {
    ...(weekdays ? { weekday: 'short' } : {}), day: 'numeric', ...(sameMonth ? {} : { month: 'short' }),
  })
  const right = b.toLocaleDateString('en-GB', {
    ...(weekdays ? { weekday: 'short' } : {}), day: 'numeric', month: 'short',
  })
  return `${left} to ${right}`
}

/** "13 Sep". */
export function shortDate(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/**
 * The average of one figure across the days with food on them.
 *
 * Unknown is not zero: a day that does not know its fibre adds nothing to the
 * sum, and the result says it is a floor, which the screen writes as "24 g +".
 */
export function averageOf(
  days: readonly DayReading[],
  pick: (n: Nutrients) => number | undefined,
): { value: number; floor: boolean } | null {
  if (!days.length) return null
  const known = days.map((d) => pick(d.nutrients)).filter((v): v is number => v != null)
  if (!known.length) return null
  return { value: known.reduce((a, b) => a + b, 0) / days.length, floor: known.length < days.length }
}

export type AverageKind = 'aim' | 'about' | 'none'

export interface AverageRow {
  key: 'protein' | 'carbs' | 'fat' | 'fiber' | 'salt'
  label: string
  unit: string
  /** "82 g", "24 g +", or "--" when nothing is known. */
  value: string
  /** "aim for 90 g", "about 210 g", "No target set". */
  target: string
  /** How far along the bar is filled, 0 to 1. */
  fill: number
  /** null when there is no target to measure against. */
  ok: boolean | null
  status: string
  symbol: string
}

/**
 * Each figure against its target, in words and a symbol as well as a colour.
 *
 * Protein and fibre are things to reach; carbs and fat are a figure to be near.
 * Salt has no target in the app, so it is reported and left unjudged.
 */
export function averageRows(days: readonly DayReading[], targets: Targets): AverageRow[] {
  const rows: { key: AverageRow['key']; label: string; unit: string; kind: AverageKind; target?: number; pick: (n: Nutrients) => number | undefined; dp?: number }[] = [
    { key: 'protein', label: 'Protein', unit: 'g', kind: 'aim', target: targets.protein, pick: (n) => n.protein },
    { key: 'carbs', label: 'Carbs', unit: 'g', kind: 'about', target: targets.carbs, pick: (n) => n.carbs },
    { key: 'fat', label: 'Fat', unit: 'g', kind: 'about', target: targets.fat, pick: (n) => n.fat },
    { key: 'fiber', label: 'Fibre', unit: 'g', kind: 'aim', target: targets.fiber, pick: (n) => n.fiber },
    { key: 'salt', label: 'Salt', unit: 'g', kind: 'none', pick: (n) => saltFromSodium(n.sodium), dp: 1 },
  ]

  return rows.map(({ key, label, unit, kind, target, pick, dp }) => {
    const avg = averageOf(days, pick)
    const shown = avg
      ? `${dp ? avg.value.toFixed(dp) : Math.round(avg.value)} ${unit}${avg.floor ? ' +' : ''}`
      : '--'
    if (!avg || !target || kind === 'none') {
      return { key, label, unit, value: shown, target: 'No target set', fill: 0, ok: null, status: '', symbol: '' }
    }
    const ratio = avg.value / target
    const goal = `${Math.round(target)} ${unit}`
    if (kind === 'aim') {
      const ok = ratio >= 0.9
      return {
        key, label, unit, value: shown, target: `aim for ${goal}`, fill: Math.min(1, ratio), ok,
        status: ok ? (ratio >= 1 ? 'Above target' : 'Close to target') : 'Below target',
        symbol: ok ? '✓' : '▼',
      }
    }
    const ok = ratio >= 0.9 && ratio <= 1.1
    return {
      key, label, unit, value: shown, target: `about ${goal}`, fill: Math.min(1, ratio), ok,
      status: ok ? 'Close to target' : ratio > 1 ? 'Above target' : 'Below target',
      symbol: ok ? '✓' : ratio > 1 ? '▲' : '▼',
    }
  })
}

/** Points for a sparkline of `values` across a `width` by `height` box. */
export function sparkPoints(
  values: readonly number[], width: number, height: number, pad = 6, extra?: number,
): { points: [number, number][]; y: (v: number) => number } {
  const all = extra == null ? [...values] : [...values, extra]
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const span = hi - lo || 1
  const y = (v: number) => Math.round((pad + (hi - v) / span * (height - pad * 2)) * 10) / 10
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0
  const points = values.map((v, i): [number, number] => [
    Math.round((values.length > 1 ? pad + i * step : width / 2) * 10) / 10, y(v),
  ])
  return { points, y }
}
