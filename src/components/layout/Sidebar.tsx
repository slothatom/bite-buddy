import { NavLink, useLocation } from 'react-router-dom'
import { Wordmark } from '../brand/Mascot'
import { NAV, isCurrent } from './nav'

export default function Sidebar() {
  const { pathname } = useLocation()

  return (
    <aside className="hidden md:flex w-56 min-h-screen bg-cream-50 border-r border-border-200 flex-col shrink-0">
      <div className="px-4 py-4 border-b border-border-200">
        <Wordmark />
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={isCurrent(to, pathname) ? 'nav-item-active' : 'nav-item'}
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
