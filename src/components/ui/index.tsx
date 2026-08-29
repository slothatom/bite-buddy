import { Children, useState, type ReactNode } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import type { Macros, MedTier, Nutrients } from '../../types'
import { STATUS_STYLES, targetStatus, type StatusLevel } from '../../lib/status'
import { saltFromSodium } from '../../lib/nutrition'
import Zig, { type ZigMood } from '../brand/Mascot'
import { useEnglish } from '../../store/useEnglish'

/** Shared display pieces. Kept together because each is a handful of lines. */

/**
 * A progress bar measured against a target.
 *
 * The target is drawn as an explicit line rather than being inferred from where
 * the fill stops, and anything over target is labelled in words as well as
 * coloured, the design system forbids carrying that state by hue alone.
 */
export function MacroBar({
  label, value, target, unit = 'g', partial = false,
}: {
  label: string
  value: number
  target?: number
  unit?: string
  /**
   * At least one ingredient said nothing about this, so the figure is a floor.
   *
   * Only fibre has ever needed it: protein, carbs and fat are on every food.
   * Without it, fibre was the one nutrient that could never be marked, and it
   * is exactly the one the plans are short of data on, so "Fibre 23 / 25 g"
   * read as a total on every screen including the recipe sheet.
   */
  partial?: boolean
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
          <span className="text-ink-500 font-semibold">{unit}{partial ? '\u2009+' : ''}</span>
        </span>
      </div>

      <div className="relative h-2.5 rounded-full bg-border-100 overflow-hidden">
        {/* A floor does not fill a bar the way a total does. The number carries
            a "+" and the bar used to carry nothing, so at a glance fibre read
            as met when the figure was only the part the data knows about. The
            fill fades out at its end instead of stopping flat. */}
        <div
          className={`h-full rounded-full transition-all duration-500 ${styles.fill}`}
          style={{
            width: `${fillPct}%`,
            maskImage: partial ? 'linear-gradient(to right, black 55%, transparent 100%)' : undefined,
            WebkitMaskImage: partial ? 'linear-gradient(to right, black 55%, transparent 100%)' : undefined,
          }}
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

/** Calorie dial, a single day's overview. The one number read at a glance. */
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

/** Status as a labelled pill, colour plus icon plus words, never colour alone. */
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

/**
 * The four macros, then the three you watch across a day.
 *
 * Sugar and salt are here rather than buried with the vitamins because they are
 * the two the app is meant to help you keep an eye on, and salt rather than
 * sodium because that is what a label says and what anyone actually thinks in.
 *
 * `partial` names the nutrients at least one ingredient said nothing about;
 * those are shown as "12 g +", because the figure is a floor rather than a
 * total and printing it plain would be a claim the data cannot support.
 */
export function NutrientSummary({
  n, targets, partial = [], unresolved = 0,
}: {
  n: Nutrients
  targets?: Macros & { fiber?: number }
  partial?: readonly string[]
  /**
   * Components that could not be resolved to food at all.
   *
   * Different from `partial`, and worse: a nutrient nobody mentioned makes the
   * figure a floor, but a food the app has lost makes every figure short,
   * calories included, by an amount it cannot even estimate.
   */
  unresolved?: number
}) {
  const salt = saltFromSodium(n.sodium)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <MacroBar label="Protein" value={n.protein} target={targets?.protein} />
        <MacroBar label="Carbs" value={n.carbs} target={targets?.carbs} />
        <MacroBar label="Fat" value={n.fat} target={targets?.fat} />
        <MacroBar
          label="Fibre"
          value={n.fiber ?? 0}
          target={targets?.fiber}
          partial={partial.includes('fiber')}
        />
      </div>

      {/* The note rides along with the sugar and salt line rather than taking a
          paragraph of its own. On the planner that paragraph pushed the fifth
          meal of a day off a laptop screen, and the explanation matters less
          than the day does. */}
      {(n.sugar != null || salt != null || partial.length > 0 || unresolved > 0) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-700 pt-1 border-t border-border-100">
          {n.sugar != null && (
            <span>
              Sugar <strong className="font-mono text-ink-900">
                {Math.round(n.sugar * 10) / 10} g{partial.includes('sugar') ? '\u2009+' : ''}
              </strong>
            </span>
          )}
          {salt != null && (
            <span>
              Salt <strong className="font-mono text-ink-900">
                {salt.toFixed(2)} g{partial.includes('sodium') ? '\u2009+' : ''}
              </strong>
            </span>
          )}
          {partial.length > 0 && (
            <span className="text-ink-500">
              <strong>+</strong> means a floor, not a total
            </span>
          )}
          {unresolved > 0 && (
            <span className="text-coral-700">
              {unresolved === 1
                ? 'One thing here is missing from the library, so every figure is short.'
                : `${unresolved} things here are missing from the library, so every figure is short.`}
            </span>
          )}
        </div>
      )}

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
 * bury: it gets a real treatment, a small language badge and readable muted
 * text, rather than italic, near-invisible grey.
 */
export function SourceLine({
  text, truncate = false, clamp, translate = false,
}: {
  text: string
  /**
   * Whether this is a line of the dietician's, or simply foreign text.
   *
   * Off by default, and deliberately: this same component shows a food's
   * Romanian and Hungarian names on the Foods screen, and rendering those in
   * English turns "sparanghel · spárga" into "asparagus · asparagus", which is
   * the exact opposite of why they are on screen.
   */
  translate?: boolean
  /** One line with an ellipsis, for dense lists where the line is a hint. */
  truncate?: boolean
  /** Up to this many lines, for places where the original wording is the point. */
  clamp?: 2 | 3
}) {
  // `block` and `line-clamp-*` both set `display`, and which one wins depends on
  // the order Tailwind happens to emit them in rather than on the order written
  // here. `block` was winning, so every clamp in the app did nothing and a
  // 187-character dietician line ran to six lines inside a recipe card.
  const wrap = clamp
    ? (clamp === 2 ? 'line-clamp-2' : 'line-clamp-3')
    : truncate ? 'block truncate' : 'block'

  // The dietician's own words, and what they say. The original stays because it
  // is the record: a plan you cannot check against what was actually prescribed
  // is a plan you have to take on faith. The English goes first because for one
  // of the two people here the Romanian is not readable at all.
  const reading = useEnglish(text)
  const english = translate ? reading : ''

  // Both, where there is room to read; the English alone in a dense list.
  // Clamped or truncated means this is a hint beside something else, and
  // doubling the height of every line pushed the fifth meal of a day off a
  // laptop screen. The original is never far: it is on the recipe and it is
  // the whole of the archive.
  const dense = Boolean(clamp || truncate)

  if (dense || !english || english.toLowerCase() === text.toLowerCase()) {
    const shown = dense && english ? english : text
    return <span className={`text-[13px] text-ink-500 min-w-0 ${wrap}`} title={text}>{shown}</span>
  }

  return (
    <span className="block min-w-0">
      <span className={`text-[13px] text-ink-700 min-w-0 ${wrap}`}>{english}</span>
      <span className={`text-[13px] text-ink-500 min-w-0 italic ${wrap}`} lang="ro">{text}</span>
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
 * 829px of chips on Recipes, 1,578px on Foods, about three of seventeen
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
