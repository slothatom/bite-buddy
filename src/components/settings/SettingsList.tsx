import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, type LucideIcon } from 'lucide-react'

/**
 * The pieces every Settings screen is built from: a titled group, a card of
 * rows, a row that opens a page, a coloured icon tile, and a switch.
 *
 * Kept together so the hub, the sub-pages and the desktop pane all draw the
 * same row the same way.
 */

export type Tone = 'bite' | 'leaf' | 'mustard' | 'plain'

const TONES: Record<Tone, string> = {
  bite: 'bg-bite-100 text-bite-700',
  leaf: 'bg-leaf-50 text-leaf-700',
  mustard: 'bg-mustard-100 text-mustard-800',
  plain: 'bg-border-100 text-ink-700',
}

/** A 36px rounded square holding an icon, tinted by what it stands for. */
export function IconTile({ icon: Icon, tone = 'bite' }: { icon: LucideIcon; tone?: Tone }) {
  return (
    <span className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${TONES[tone]}`}>
      <Icon size={20} aria-hidden="true" />
    </span>
  )
}

/** A heading over a card, the unit the Settings screens are made of. */
export function SettingsGroup({ id, title, aside, children }: {
  id: string
  title: string
  /** A short note at the right end of the heading. */
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-base leading-6 font-extrabold text-ink-900">{title}</h2>
        {aside ? <span className="text-xs text-ink-700">{aside}</span> : null}
      </div>
      {children}
    </section>
  )
}

/** The card the rows sit in, a hairline between each. */
export function SettingsCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-paper border border-border-200 rounded-card overflow-hidden divide-y divide-border-100 ${className}`}>
      {children}
    </div>
  )
}

/** A row that opens another Settings page. */
export function SettingsLink({ to, icon, tone, title, detail, trailing }: {
  to: string
  icon: LucideIcon
  tone?: Tone
  title: string
  detail?: ReactNode
  trailing?: ReactNode
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3.5 py-3 min-h-11 text-ink-900 hover:bg-bite-50 transition-colors"
    >
      <IconTile icon={icon} tone={tone} />
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[15px] leading-5 font-bold">{title}</span>
        {detail ? <span className="text-xs text-ink-700">{detail}</span> : null}
      </span>
      {trailing}
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-300" />
    </Link>
  )
}

/**
 * On or off, as a switch the size of a thumb.
 *
 * A real button with `role="switch"`, so it is announced as a switch with its
 * state, reached by keyboard, and named by the label it points at. The track
 * is 52px; the button around it is 56 by 44, the size a finger needs.
 */
export function Switch({ checked, onChange, labelledBy, disabled = false }: {
  checked: boolean
  onChange: (next: boolean) => void
  labelledBy: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="w-14 h-11 shrink-0 flex items-center justify-center cursor-pointer rounded-lg
                 disabled:opacity-45 disabled:cursor-not-allowed"
    >
      <span
        aria-hidden="true"
        className={`w-[52px] h-8 rounded-full px-[3px] flex items-center transition-colors
                    ${checked ? 'bg-bite-700 justify-end' : 'bg-ink-500 justify-start'}`}
      >
        <span className="w-[26px] h-[26px] rounded-full bg-paper shadow-e1" />
      </span>
    </button>
  )
}
