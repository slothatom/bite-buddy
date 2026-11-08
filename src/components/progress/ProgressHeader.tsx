import type { ReactNode } from 'react'
import SectionTabs from '../layout/SectionTabs'
import { SECTION_TABS } from '../layout/nav'
import { PersonAvatar } from '../ui/PersonAvatar'
import { usePeople } from '../../store/useHousehold'
import { useUiStore } from '../../store/useUiStore'
import { personName } from '../../lib/people'
import { useWhose } from './useWhose'

/**
 * The top of every Progress screen: the title, whose figures these are, and
 * the Overview · Movement · Summary tabs.
 *
 * Whose is the device's "viewing as", the same choice Today reads its movement
 * from and Settings sets, so Overview and Movement agree on who they are about
 * without each keeping a choice of its own.
 */
export default function ProgressHeader({ subtitle, whose = false, actions }: {
  /** Under the title on a phone. Left out, it says whose figures these are. */
  subtitle?: string
  /** Show the person picker. Only drawn when there is somebody to pick. */
  whose?: boolean
  /** Buttons at the right of the header from md up. */
  actions?: ReactNode
}) {
  const people = usePeople()
  const who = useWhose()
  const { label, tabs } = SECTION_TABS.progress
  const line = subtitle ?? (whose && people.length > 1 ? `Showing: ${personName(people, who)}` : undefined)

  return (
    <header data-print-hide className="space-y-3">
      <div className="flex items-center gap-2 md:gap-3 min-h-11">
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] leading-7 md:text-2xl md:leading-8 font-extrabold text-ink-900">Progress</h1>
          {line && <p className="text-xs text-ink-700 md:hidden">{line}</p>}
        </div>
        {whose && <WhosePicker />}
        {actions && <div className="hidden md:flex items-center gap-2">{actions}</div>}
      </div>
      <SectionTabs label={label} tabs={tabs} />
    </header>
  )
}

/**
 * Avatars on a phone, avatars with names from md up. Each is a toggle that
 * says which one is on, and names the person it shows.
 */
function WhosePicker() {
  const people = usePeople()
  const who = useWhose()
  const setViewingAs = useUiStore((s) => s.setViewingAs)
  if (people.length < 2) return null

  return (
    <div role="group" aria-label="Whose progress" className="flex gap-1 md:gap-1.5">
      {people.map((p, i) => {
        const on = p.id === who
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={on}
            aria-label={`Show ${p.name}`}
            onClick={() => setViewingAs(p.id)}
            className={`flex items-center justify-center w-11 h-11 rounded-full shrink-0
                        md:w-auto md:h-10 md:gap-2 md:pl-2 md:pr-3.5 md:border md:text-sm
                        ${on
                          ? 'md:border-bite-700 md:bg-bite-100 md:text-bite-700 md:font-extrabold'
                          : 'md:border-border-200 md:bg-paper md:text-ink-900 md:font-bold'}`}
          >
            <PersonAvatar
              person={p}
              index={i}
              selected={on}
              className="md:w-6 md:h-6 md:text-xs md:ring-0 md:ring-offset-0"
            />
            <span className="hidden md:inline">{p.name}</span>
          </button>
        )
      })}
    </div>
  )
}
