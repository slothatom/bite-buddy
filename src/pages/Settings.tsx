import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Check } from 'lucide-react'
import { PlanArchive } from '../components/settings/PlanArchive'
import { HouseholdPanel } from '../components/settings/HouseholdPanel'
import { useAuthStore } from '../store/useAuth'
import { useSyncStatus } from '../store/useSync'
import { isConfigured } from '../lib/supabase'
import { useMediaQuery } from '../lib/useMediaQuery'
import { BackupPanel } from '../components/settings/BackupPanel'
import { AccountPanel } from '../components/settings/AccountPanel'
import { NotificationsPanel } from '../components/settings/NotificationsPanel'
import { SyncPanel } from '../components/settings/SyncPanel'
import { VersionPanel } from '../components/settings/VersionPanel'
import { FoodCheckPanel } from '../components/settings/FoodCheckPanel'
import { DeletedRecipesPanel, DeletedFoodsPanel } from '../components/settings/DeletedPanels'
import { TargetsSection } from '../components/settings/TargetsSection'
import { ExerciseSection } from '../components/settings/ExerciseSection'
import { WeekSection } from '../components/settings/WeekSection'
import { SettingsHub } from '../components/settings/SettingsHub'
import { HouseholdAside } from '../components/settings/HouseholdAside'
import { AppearanceControl } from '../components/settings/AppearanceControl'
import { SettingsCard, SettingsGroup } from '../components/settings/SettingsList'
import { useSettingsSections, type SettingsSection } from '../components/settings/sections'

/**
 * Settings: a list of pages on a phone, a list beside the page on a desktop.
 *
 * Every page has its own address under /settings (household, targets,
 * history, reminders, appearance, backups, account), so the back arrow, the
 * desktop list and an old bookmark to /history all land in the same place.
 * On a phone /settings itself is the list; on a desktop the list is always on
 * the left, so /settings opens its first page.
 *
 * `signedOut` is the copy reachable from the sign-in screen. It has no sidebar
 * and no bottom bar, so its back arrow shows at every width and goes back to
 * signing in.
 */
export default function Settings({ signedOut = false }: { signedOut?: boolean }) {
  const { pathname } = useLocation()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const sections = useSettingsSections()
  const sub = pathname.replace(/^\/settings\/?/, '').split('/')[0]
  const current = sections.find((s) => s.path === sub)

  // An address for a page this copy does not have (the household, signed
  // out) goes to the list rather than to an empty screen.
  if (sub && !current) return <Navigate to="/settings" replace />
  if (desktop && !current) return <Navigate to={`/settings/${sections[0].path}`} replace />

  const back = signedOut && (desktop || !current)
    ? { to: '/', label: 'Back to sign in' }
    : current
      ? { to: '/settings', label: 'Back to Settings' }
      : { to: '/', label: 'Back to Today' }

  // The household beside the page on a screen wide enough for it, except on
  // the household's own page.
  const aside = sections.some((s) => s.path === 'household') && current?.path !== 'household'

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <header className={`${desktop ? 'h-[72px] px-8 gap-3' : 'h-16 pl-1.5 pr-4 gap-1'} flex items-center`}>
        <Link
          to={back.to}
          aria-label={back.label}
          className={`${signedOut || !desktop ? 'flex' : 'hidden'} items-center justify-center w-11 h-11 shrink-0
                      rounded-[14px] text-ink-900 hover:bg-bite-50`}
        >
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="flex-1 min-w-0 text-[22px] leading-7 lg:text-2xl lg:leading-8 font-extrabold text-ink-900 truncate">
          {desktop || !current ? 'Settings' : current.label}
        </h1>
        {desktop && <SyncChip />}
      </header>

      {signedOut && (
        <p className="px-4 lg:px-8 -mt-1 mb-3 text-sm text-ink-700">
          Signed out. Everything here is kept on this device.
        </p>
      )}

      {desktop && current ? (
        <div
          className={`px-8 pb-8 pt-2 grid gap-5 items-start grid-cols-[220px_minmax(0,1fr)]
                      ${aside ? 'min-[1400px]:grid-cols-[220px_minmax(0,1fr)_300px]' : ''}`}
        >
          <SettingsNav sections={sections} current={current} />
          <div className="min-w-0 flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-xl leading-7 font-extrabold text-ink-900">{current.label}</h2>
              {current.blurb && <p className="text-sm text-ink-700">{current.blurb}</p>}
            </div>
            <Page path={current.path} />
          </div>
          {aside && <HouseholdAside className="hidden min-[1400px]:flex" />}
        </div>
      ) : (
        <div className="max-w-xl mx-auto px-4 pt-1">
          {current ? <Page path={current.path} /> : <SettingsHub />}
        </div>
      )}
    </div>
  )
}

/** The list of pages down the left of a wide screen. */
function SettingsNav({ sections, current }: { sections: SettingsSection[]; current: SettingsSection }) {
  return (
    <nav
      aria-label="Settings sections"
      className="sticky top-4 bg-paper border border-border-200 rounded-card p-2 flex flex-col gap-0.5"
    >
      {sections.map((s) => {
        const on = s.path === current.path
        const Icon = s.icon
        return (
          <Link
            key={s.path}
            to={`/settings/${s.path}`}
            aria-current={on ? 'page' : undefined}
            className={`${on ? 'nav-item-active' : 'nav-item'} text-sm`}
          >
            <Icon size={18} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{s.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/** Whether this device has reached the shared copy, for a signed-in desktop. */
function SyncChip() {
  const account = useAuthStore((s) => isConfigured && Boolean(s.session))
  const { state, at, unsaved } = useSyncStatus()
  if (!account || state !== 'live' || unsaved || !at) return null
  return (
    <span className="badge bg-leaf-50 text-leaf-700 shrink-0">
      <Check size={12} strokeWidth={3} aria-hidden="true" />
      Synced {at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

/** What each page holds. */
function Page({ path }: { path: string }): ReactNode {
  const account = useAuthStore((s) => isConfigured && Boolean(s.session))

  switch (path) {
    case 'household':
      return <HouseholdPanel />
    case 'targets':
      return (
        <div className="flex flex-col gap-8">
          <TargetsSection />
          <ExerciseSection />
          <WeekSection />
        </div>
      )
    case 'history':
      return <PlanArchive />
    case 'reminders':
      return <NotificationsPanel />
    case 'appearance':
      return (
        <SettingsGroup id="appearance-heading" title="How the app looks">
          <SettingsCard>
            <AppearanceControl id="appearance-page" showNote />
          </SettingsCard>
        </SettingsGroup>
      )
    case 'backups':
      return (
        <div className="flex flex-col gap-8">
          <SettingsGroup id="backup-heading" title="Your data">
            <BackupPanel />
          </SettingsGroup>
          <DeletedRecipesPanel />
          <DeletedFoodsPanel />
          <FoodCheckPanel />
        </div>
      )
    case 'account':
      return (
        <div className="flex flex-col gap-8">
          {account && <AccountPanel />}
          {account && <SyncPanel />}
          <VersionPanel />
        </div>
      )
    default:
      return null
  }
}
