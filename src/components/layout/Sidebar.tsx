import { Link, useLocation } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Logo from '../brand/Logo'
import { PersonStack } from '../ui/PersonAvatar'
import { usePeople } from '../../store/useHousehold'
import { SECTIONS, SETTINGS, isCurrent } from './nav'
import { useQuickAdd } from './useQuickAdd'

/**
 * The desktop's navigation, down the left.
 *
 * The same four places as the phone's bar, the same add button, and at the
 * foot the household and the way into Settings, which on a phone is the gear
 * in Today's header. Sticky, so the foot stays on screen on a long page.
 */
export default function Sidebar() {
  const { pathname } = useLocation()
  const quickAdd = useQuickAdd()
  const people = usePeople()
  const SettingsIcon = SETTINGS.icon
  const inSettings = isCurrent(SETTINGS.base, pathname)

  return (
    <aside
      aria-label="Sidebar"
      data-print-hide
      className="hidden md:flex sticky top-0 h-dvh w-62 shrink-0 flex-col gap-4 px-4 py-5
                 bg-paper border-r border-border-200 overflow-y-auto"
    >
      <Link to="/" aria-label="Bite Buddy, Today" className="flex items-center min-h-11 px-2 rounded-md">
        <Logo size={30} />
      </Link>

      <nav aria-label="Main" className="flex flex-col gap-1">
        {SECTIONS.map(({ to, base, label, icon: Icon }) => {
          const current = isCurrent(base, pathname)
          return (
            <Link
              key={to}
              to={to}
              aria-current={current ? 'page' : undefined}
              className={current ? 'nav-item-active' : 'nav-item'}
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>

      <button type="button" onClick={quickAdd} className="btn-primary w-full min-h-11 rounded-lg text-[15px]">
        <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
        Add food
      </button>

      <div className="mt-auto flex flex-col gap-2 border-t border-border-100 pt-4">
        <div className="flex items-center gap-2.5 px-3 min-h-9">
          <PersonStack people={people} />
          <span className="text-sm font-bold text-ink-900 min-w-0 truncate">
            {people.map((p) => p.name).join(' · ')}
          </span>
        </div>
        <Link
          to={SETTINGS.to}
          aria-current={inSettings ? 'page' : undefined}
          className={inSettings ? 'nav-item-active' : 'nav-item'}
        >
          <SettingsIcon size={20} aria-hidden="true" />
          {SETTINGS.label}
        </Link>
      </div>
    </aside>
  )
}
