import { Children, useState, type ReactNode } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import type { Macros, MedTier, Nutrients } from '../../types'
import { STATUS_STYLES, targetStatus, type StatusLevel } from '../../lib/status'
import Zig, { type ZigMood } from '../brand/Mascot'

/** Shared display pieces. Kept together because each is a handful of lines. */

/**
 * A progress bar measured against a target.
 *
 * The target is drawn as an explicit line rather than being inferred from where
 * the fill stops, and anything over target is labelled in words as well as
 * coloured — the design system forbids carrying that state by hue alone.
 */
export function MacroBar({
  label, value, target, unit = 'g',
}: {
  label: string
  value: number
  target?: number
  unit?: string
}) {
  const status = targetStatus(value, target, unit)
  const styles = STATUS_STYLES[status.level]

  // The bar's full width represents 130% of target, so the target line sits in a
  // consistent place and going over stays visible instead of clipping at the end.
  const scale = target && target > 0 ? target * 1.3 : Math.max(value, 1)
  const fillPct = Math.min(100, (value / scale) * 100)
  const targetPct = target && target > 0 ? (target / scale) * 100 : 0

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs mb-1.5">
        <span className="font-bold text-ink-700">{label}</span>
        <span className="font-bold text-ink-900">
          {Math.round(value)}
          {target ? <span className="text-ink-500 font-semibold"> / {Math.round(target)}</span> : null}
          <span className="text-ink-500 font-semibold">{unit}</span>
        </span>
      </div>

      <div className="relative h-2.5 rounded-full bg-border-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${styles.fill}`}
          style={{ width: `${fillPct}%` }}
        />
        {targetPct > 0 && (
          <span
            aria-hidden
            className="absolute top-0 bottom-0 w-0.5 bg-ink-900/35"
            style={{ left: `${targetPct}%` }}
          />
        )}
      </div>

      {status.deltaLabel && (
        <p className={`mt-1 text-[11px] font-bold ${styles.text}`}>
          <span aria-hidden className="font-extrabold">{status.symbol}</span>{' '}
          {status.label} · {status.deltaLabel}
        </p>
      )}
    </div>
  )
}

/** Calorie dial — a single day's overview. The one number read at a glance. */
export function CalorieRing({ value, target, size = 132 }: { value: number; target: number; size?: number }) {
  const status = targetStatus(value, target)
  const styles = STATUS_STYLES[status.level]

  const r = size / 2 - 10
  const circumference = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(1, value / target) : 0
  const remaining = Math.round(target - value)

  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={10} className="stroke-border-100" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={10} strokeLinecap="round"
            className={styles.ring}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[28px] font-extrabold leading-none text-ink-900">
            {Math.round(value).toLocaleString()}
          </span>
          <span className="text-[11px] font-bold text-ink-500 mt-1">of {target.toLocaleString()} kcal</span>
        </div>
      </div>

      {status.level === 'none' ? null : status.deltaLabel ? (
        <StatusPill level={status.level} label={`${status.label} · ${status.deltaLabel}`} />
      ) : (
        <p className="text-xs font-bold text-ink-700">
          {remaining > 0 ? `${remaining.toLocaleString()} kcal remaining` : 'Right on target'}
        </p>
      )}
    </div>
  )
}

/** Status as a labelled pill — colour plus icon plus words, never colour alone. */
export function StatusPill({ level, label }: { level: StatusLevel; label: string }) {
  const styles = STATUS_STYLES[level]
  const Icon = level === 'over' ? AlertTriangle : level === 'on-track' ? Check : null

  return (
    <span className={`badge ${styles.surface} ${styles.text}`}>
      {Icon ? <Icon size={12} /> : level === 'slightly-over' ? <span aria-hidden className="font-extrabold">+</span> : null}
      {label}
    </span>
  )
}

export function NutrientSummary({ n, targets }: { n: Nutrients; targets?: Macros & { fiber?: number } }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      <MacroBar label="Protein" value={n.protein} target={targets?.protein} />
      <MacroBar label="Carbs" value={n.carbs} target={targets?.carbs} />
      <MacroBar label="Fat" value={n.fat} target={targets?.fat} />
      <MacroBar label="Fibre" value={n.fiber ?? 0} target={targets?.fiber} />
    </div>
  )
}

/**
 * How often the Mediterranean guide says to eat this group.
 *
 * A symbol and a word carry the meaning; colour only reinforces it. These sit on
 * 122 rows at once, so they have to stay quiet.
 */
const TIERS: Record<MedTier, { label: string; symbol: string; className: string }> = {
  daily:    { label: 'Daily',      symbol: '●', className: 'bg-teal-50 text-teal-700' },
  weekly:   { label: 'Weekly',     symbol: '◐', className: 'bg-teal-50 text-teal-800' },
  moderate: { label: 'Moderation', symbol: '○', className: 'bg-cream-50 text-ink-700' },
  rare:     { label: 'Rarely',     symbol: '◇', className: 'bg-mustard-100 text-mustard-800' },
}

export function TierBadge({ tier }: { tier: MedTier }) {
  const { label, symbol, className } = TIERS[tier]
  return (
    <span className={`badge ${className}`}>
      <span aria-hidden>{symbol}</span> {label}
    </span>
  )
}

/**
 * The second language.
 *
 * The dietician's original Romanian or Hungarian is provenance, not metadata to
 * bury: it gets a real treatment — a small language badge and readable muted
 * text — rather than italic, near-invisible grey.
 */
export function SourceLine({
  text, lang, truncate = false, clamp,
}: {
  text: string
  lang?: 'ro' | 'hu'
  /** One line with an ellipsis — for dense lists where the line is a hint. */
  truncate?: boolean
  /** Up to this many lines — for places where the original wording is the point. */
  clamp?: 2 | 3
}) {
  const wrap = clamp ? (clamp === 2 ? 'line-clamp-2' : 'line-clamp-3') : truncate ? 'truncate' : ''
  return (
    <span className="flex items-start gap-1.5 text-[13px] text-ink-500 min-w-0">
      {lang && (
        <span className="shrink-0 mt-px px-1 py-0.5 rounded bg-border-100 text-[11px] font-extrabold tracking-wide text-ink-700 uppercase">
          {lang}
        </span>
      )}
      {/* min-w-0: without it this flex child refuses to shrink past the
          badge's width and the text overflows instead of wrapping. */}
      <span className={`min-w-0 ${wrap}`}>{text}</span>
    </span>
  )
}

export function EmptyState({
  emoji, title, children, mood = 'sleepy',
}: {
  /** Kept for callers that want a specific food icon rather than Zig. */
  emoji?: string
  title: string
  children?: ReactNode
  mood?: ZigMood
}) {
  return (
    <div className="card p-10 text-center">
      {emoji
        ? <div className="text-4xl mb-3">{emoji}</div>
        : <Zig size={84} mood={mood} className="mx-auto mb-4" />}
      <p className="display text-lg text-ink-900">{title}</p>
      {children ? <div className="text-sm text-ink-700 mt-2 max-w-sm mx-auto">{children}</div> : null}
    </div>
  )
}

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-lg font-extrabold text-ink-900">{children}</h2>
      {action}
    </div>
  )
}

/**
 * A row of filter chips that wraps instead of scrolling out of sight.
 *
 * These rows previously scrolled horizontally, which hid most of the filters:
 * 829px of chips on Recipes, 1,578px on Foods — about three of seventeen
 * categories visible, with nothing on screen to say the rest existed. Wrapping
 * shows everything, and collapsing to the first few keeps it from taking over
 * the top of the page.
 *
 * Callers should order any active chip into the first `initial` so a live
 * filter is never hidden behind the toggle.
 */
export function ChipRow({ children, initial = 6 }: { children: ReactNode; initial?: number }) {
  const [expanded, setExpanded] = useState(false)
  const items = Children.toArray(children)
  const hidden = items.length - initial

  return (
    <div className="flex flex-wrap gap-1.5">
      {hidden > 0 && !expanded ? items.slice(0, initial) : items}
      {hidden > 0 && (
        <button className="chip-off" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show fewer' : `+${hidden} more`}
        </button>
      )}
    </div>
  )
}
