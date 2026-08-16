import type { ReactNode } from 'react'
import type { Macros, MedTier, Nutrients } from '../../types'
import Mascot, { type MascotMood } from '../brand/Mascot'

/** Shared display pieces. Kept together because each is a handful of lines. */

export function MacroBar({
  label, value, target, unit = 'g', tone = 'brand',
}: {
  label: string
  value: number
  target?: number
  unit?: string
  tone?: 'brand' | 'clay' | 'stone'
}) {
  const ratio = target && target > 0 ? value / target : 0
  const pct = Math.min(1, ratio)
  // Being a little over is normal, not an alarm: it warms to peach first and
  // only deepens when the day is well past target.
  const fill =
    ratio > 1.3 ? 'bg-clay-400'
    : ratio > 1.05 ? 'bg-clay-300'
    : tone === 'clay' ? 'bg-butter-400'
    : tone === 'stone' ? 'bg-brand-300'
    : 'bg-brand-500'

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1">
        <span className="font-semibold text-stone-500">{label}</span>
        <span className="font-mono text-stone-600">
          {Math.round(value)}{target ? <span className="text-stone-400"> / {Math.round(target)}</span> : null}
          <span className="text-stone-400">{unit}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-sand-200 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${fill}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}

/** Calorie dial — the one number that gets read at a glance. */
export function CalorieRing({ value, target, size = 116 }: { value: number; target: number; size?: number }) {
  const pct = target > 0 ? Math.min(1.25, value / target) : 0
  const r = size / 2 - 9
  const circumference = 2 * Math.PI * r
  const over = pct > 1.3

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={9} className="stroke-sand-200" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={9} strokeLinecap="round"
          className={over ? 'stroke-clay-400' : 'stroke-brand-500'}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(1, pct))}
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold font-mono leading-none text-stone-800">{Math.round(value)}</span>
        <span className="text-[11px] text-stone-400 mt-0.5">of {Math.round(target)} kcal</span>
      </div>
    </div>
  )
}

export function NutrientSummary({ n, targets }: { n: Nutrients; targets?: Macros & { fiber?: number } }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-3">
      <MacroBar label="Protein" value={n.protein} target={targets?.protein} />
      <MacroBar label="Carbs" value={n.carbs} target={targets?.carbs} tone="stone" />
      <MacroBar label="Fat" value={n.fat} target={targets?.fat} tone="clay" />
      <MacroBar label="Fibre" value={n.fiber ?? 0} target={targets?.fiber} />
    </div>
  )
}

/** How often the Mediterranean guide says to eat this group. */
export function TierBadge({ tier }: { tier: MedTier }) {
  const map: Record<MedTier, { label: string; className: string }> = {
    daily:    { label: 'Daily',      className: 'bg-brand-100 text-brand-800' },
    weekly:   { label: 'Weekly',     className: 'bg-brand-50 text-brand-700' },
    moderate: { label: 'Moderation', className: 'bg-sand-200 text-stone-600' },
    rare:     { label: 'Rarely',     className: 'bg-clay-100 text-clay-700' },
  }
  const { label, className } = map[tier]
  return <span className={`badge ${className}`}>{label}</span>
}

export function EmptyState({
  emoji, title, children, mood = 'sleepy',
}: {
  /** Kept for callers that want a specific food icon rather than the mascot. */
  emoji?: string
  title: string
  children?: ReactNode
  mood?: MascotMood
}) {
  return (
    <div className="card p-10 text-center">
      {emoji
        ? <div className="text-4xl mb-3">{emoji}</div>
        : <Mascot size={72} mood={mood} className="mx-auto mb-3" />}
      <p className="font-display font-semibold text-stone-700">{title}</p>
      {children ? <div className="text-sm text-stone-500 mt-1.5">{children}</div> : null}
    </div>
  )
}

export function SectionHeading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-bold text-stone-800">{children}</h2>
      {action}
    </div>
  )
}
