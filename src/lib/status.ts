/**
 * Target status.
 *
 * The design system is explicit that going over a target is information, not
 * failure, and that the state must never be carried by hue alone. So this
 * returns a label, a symbol and a signed delta alongside the colour level —
 * every consumer is expected to render at least the label or the symbol, not
 * just the colour.
 *
 * Thresholds come from the system: under 105% is on track, 105–130% is slightly
 * over, beyond that is over target.
 */

export type StatusLevel = 'none' | 'on-track' | 'slightly-over' | 'over'

export interface TargetStatus {
  level: StatusLevel
  /** Plain-language label, e.g. "Slightly over". Empty when there is no target. */
  label: string
  /** Signed difference from target, rounded. */
  delta: number
  /** "+120 kcal" — empty when on track or untargeted. */
  deltaLabel: string
  /** A non-colour cue: nothing, a plus, or an alert. */
  symbol: '' | '+' | '!'
  /** value / target, or 0 when there is no target. */
  ratio: number
}

export function targetStatus(value: number, target: number | undefined, unit = 'kcal'): TargetStatus {
  if (!target || target <= 0) {
    return { level: 'none', label: '', delta: 0, deltaLabel: '', symbol: '', ratio: 0 }
  }

  const ratio = value / target
  const delta = Math.round(value - target)

  if (ratio <= 1.05) {
    return { level: 'on-track', label: 'On track', delta, deltaLabel: '', symbol: '', ratio }
  }

  const deltaLabel = `+${delta} ${unit}`

  if (ratio <= 1.3) {
    return { level: 'slightly-over', label: 'Slightly over', delta, deltaLabel, symbol: '+', ratio }
  }

  return { level: 'over', label: 'Over target', delta, deltaLabel, symbol: '!', ratio }
}

/**
 * Tailwind classes per level, kept beside the logic so a new level cannot be
 * added without deciding how it looks.
 */
export const STATUS_STYLES: Record<StatusLevel, { fill: string; text: string; surface: string; ring: string }> = {
  'none':          { fill: 'bg-border-200', text: 'text-ink-500',     surface: 'bg-cream-50',     ring: 'stroke-border-200' },
  'on-track':      { fill: 'bg-teal-500',   text: 'text-teal-700',    surface: 'bg-teal-50',      ring: 'stroke-teal-500' },
  'slightly-over': { fill: 'bg-mustard-500', text: 'text-mustard-800', surface: 'bg-mustard-100', ring: 'stroke-mustard-500' },
  'over':          { fill: 'bg-coral-500',  text: 'text-coral-700',   surface: 'bg-coral-50',     ring: 'stroke-coral-500' },
}
