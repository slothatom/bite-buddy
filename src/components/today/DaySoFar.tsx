import type { ReactNode } from 'react'
import { targetStatus } from '../../lib/status'
import { SLOT_LABELS } from '../../types'
import { KnownHint, StatusPill } from '../ui'
import type { SlotRow } from './todayModel'

/**
 * How the day stands: what has been had, against the target, and what the
 * plan still has to come.
 *
 * The big number is what has happened, never what was hoped for. The pill
 * reads the whole day, had plus still planned, because "on track" is a
 * statement about where the day will end up rather than where it is at noon.
 * A bar on the phone, a ring with a sentence on a wide screen, both from the
 * same three figures.
 */
export default function DaySoFar({
  had, ahead, protein, target, rows, known,
}: {
  had: number
  ahead: number
  protein: number
  target: number
  rows: SlotRow[]
  known: { known: number; total: number } | null
}) {
  const projected = had + ahead
  const status = targetStatus(projected, target)
  const room = Math.max(0, Math.round(target - projected))
  const pct = (n: number) => (target > 0 ? Math.min(100, (n / target) * 100) : 0)
  const eatenPct = pct(had)
  const plannedPct = Math.min(100 - eatenPct, pct(ahead))
  const fmt = (n: number) => Math.round(n).toLocaleString('en-GB')

  const pill = projected > 0 && status.level !== 'none' ? (
    <StatusPill
      level={status.level}
      label={status.deltaLabel ? `${status.label} · ${status.deltaLabel}` : status.label}
    />
  ) : null

  return (
    <section
      aria-label="Day so far"
      className="bg-paper border border-border-200 rounded-card p-4 xl:p-[18px] flex flex-col gap-2.5 xl:gap-3"
    >
      {/* The phone: one line of figures, then the bar. */}
      <div className="flex items-baseline gap-2 xl:hidden">
        <span className="text-[28px] leading-7 font-extrabold text-ink-900 tabular-nums">{fmt(had)}</span>
        <span className="text-sm text-ink-700 flex-1 min-w-0">of {fmt(target)} kcal so far</span>
        {pill}
      </div>
      <div
        className="h-2.5 rounded-full bg-border-100 overflow-hidden flex xl:hidden"
        role="img"
        aria-label={`${fmt(had)} kcal eaten and ${fmt(ahead)} still planned, of ${fmt(target)}`}
      >
        <div className="bg-leaf-500" style={{ width: `${eatenPct}%` }} />
        <div className="bg-leaf-200" style={{ width: `${plannedPct}%` }} />
      </div>

      {/* A wide screen: the ring, and the day said in a sentence. */}
      <div className="hidden xl:flex items-center gap-[18px]">
        <Ring eaten={eatenPct} planned={plannedPct}>
          <span className="text-[26px] leading-7 font-extrabold text-ink-900 tabular-nums">{fmt(had)}</span>
          <span className="text-xs text-ink-700">of {fmt(target)} kcal</span>
        </Ring>
        <div className="flex flex-col gap-2 items-start min-w-0">
          {pill}
          <p className="text-[13px] leading-[18px] text-ink-700">{sentence(rows, projected)}</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-between xl:justify-start gap-x-4 gap-y-1 text-xs leading-4 text-ink-700">
        <Key swatch="bg-leaf-500">Eaten<span className="hidden xl:inline"> {fmt(had)}</span></Key>
        <Key swatch="bg-leaf-200">Still planned {fmt(ahead)}</Key>
        <span className="xl:hidden">Protein {fmt(protein)} g</span>
        <span className="hidden xl:flex">
          <Key swatch="bg-border-100 ring-1 ring-inset ring-ink-300">Room {fmt(room)}</Key>
        </span>
      </div>
      {known && <KnownHint known={known.known} total={known.total} />}
    </section>
  )
}

function Key({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-[3px] shrink-0 ${swatch}`} />
      <span>{children}</span>
    </span>
  )
}

/** Two arcs on one track: what was had, then what is still planned. */
function Ring({ eaten, planned, children }: { eaten: number; planned: number; children: ReactNode }) {
  const size = 120
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const arc = (from: number, len: number) => ({
    strokeDasharray: `${(len / 100) * c} ${c}`,
    strokeDashoffset: -(from / 100) * c,
  })
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={12} className="stroke-border-100" />
        {planned > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={12}
            className="stroke-leaf-200" style={arc(eaten, planned)} />
        )}
        {eaten > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={12}
            className="stroke-leaf-500" style={arc(0, eaten)} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four']

/** Where the day has got to, in words a person would use. */
function sentence(rows: SlotRow[], projected: number): string {
  if (!rows.length) return 'No meals on the plan for today.'
  const done = rows.filter((r) => r.state === 'eaten').length
  const rest = rows.filter((r) => r.state !== 'eaten').map((r) => SLOT_LABELS[r.slot].toLowerCase())
  const about = Math.round(projected).toLocaleString('en-GB')
  if (!rest.length) return `Everything planned is eaten: ${about} kcal for the day.`
  const list = rest.length === 1 ? rest[0] : `${rest.slice(0, -1).join(', ')} and ${rest[rest.length - 1]}`
  const what = list.charAt(0).toUpperCase() + list.slice(1)
  const verb = rest.length === 1 ? 'brings' : 'bring'
  if (!done) return `Nothing ticked yet. ${what} ${verb} you to about ${about}.`
  return `${WORDS[done] ?? done} ${done === 1 ? 'meal' : 'meals'} in. ${what} ${verb} you to about ${about}.`
}
