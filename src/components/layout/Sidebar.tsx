import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, BookOpen, ShoppingCart, Timer, CalendarClock, Zap, Flame, BarChart2, ScrollText } from 'lucide-react'
import { useUserStore } from '../../store/useUserStore'

const NAV = [
  { to: '/',           label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/recipes',    label: 'Recipes',      icon: BookOpen },
  { to: '/grocery',    label: 'Grocery List', icon: ShoppingCart },
  { to: '/prep',       label: 'Prep Mode',    icon: Timer },
  { to: '/schedule',   label: 'Schedule',     icon: CalendarClock },
  { to: '/analytics',  label: 'Analytics',    icon: BarChart2 },
  { to: '/changelog',  label: "What's New",   icon: ScrollText },
]

export default function Sidebar() {
  const location = useLocation()
  const { profile, xpProgress } = useUserStore()
  const progress = xpProgress()

  return (
    <aside className="hidden md:flex w-56 min-h-screen bg-white border-r border-gray-100 flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🥗</span>
          <div>
            <p className="font-extrabold text-gray-900 text-base leading-none">Bite Buddy</p>
            <p className="text-[11px] text-gray-400 font-medium">Meal Prep HQ</p>
          </div>
        </div>
      </div>

      {/* XP Card */}
      <div className="mx-3 mt-3 mb-2 p-3 rounded-xl bg-gradient-to-br from-xp-50 to-xp-100 border border-xp-200">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] font-semibold text-xp-600 uppercase tracking-wide">Level {profile.level}</p>
            <p className="font-bold text-gray-900 text-sm truncate max-w-[100px]">{profile.name}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 badge-purple">
              <Zap size={9} /><span>{profile.xp} XP</span>
            </div>
            {profile.streak > 0 && (
              <div className="flex items-center gap-1 badge-gold">
                <Flame size={9} /><span>{profile.streak}d</span>
              </div>
            )}
          </div>
        </div>
        <div className="xp-bar">
          <div className="xp-bar-fill" style={{ width: `${Math.round(progress.progress * 100)}%` }} />
        </div>
        <p className="text-[10px] text-xp-500 mt-1 text-right">{progress.current} / {progress.needed} XP</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink key={to} to={to} className={active ? 'nav-item-active' : 'nav-item'}>
              <Icon size={16} />{label}
            </NavLink>
          )
        })}
      </nav>

      <div className="px-4 py-3 border-t border-gray-100">
        <p className="text-[11px] text-gray-400">{profile.achievements.length} achievements</p>
      </div>
    </aside>
  )
}
