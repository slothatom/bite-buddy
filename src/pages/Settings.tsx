import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { SectionHeading } from '../components/ui'
import { PlanArchive } from '../components/settings/PlanArchive'
import { HouseholdPanel } from '../components/settings/HouseholdPanel'
import { useAuthStore } from '../store/useAuth'
import { isConfigured } from '../lib/supabase'
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

/**
 * Two tabs, because the plan archive is a settings-shaped thing.
 *
 * It is fourteen weeks of history you read once in a while and load a week
 * from, not somewhere you go daily, and it was taking a slot in the navigation
 * next to the screens you open every day. The old /history address still
 * works and lands here.
 */
type Tab = 'settings' | 'history'

/**
 * `signedOut` is the copy reachable from the sign-in screen, which brings its
 * own way back; everywhere else a phone gets a back arrow here, because
 * Settings has no bottom bar to leave by.
 */
export default function Settings({ signedOut = false }: { signedOut?: boolean }) {
  const location = useLocation()
  const tab: Tab = location.pathname.startsWith('/settings/history') ? 'history' : 'settings'
  const back = tab === 'history'
    ? { to: '/settings', label: 'Back to Settings' }
    : { to: '/', label: 'Back to Today' }

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <header>
          <div className={`flex items-center gap-1 ${signedOut ? '' : '-ml-2.5 md:ml-0'}`}>
            {!signedOut && (
              <Link
                to={back.to}
                aria-label={back.label}
                className="md:hidden flex items-center justify-center w-11 h-11 shrink-0 rounded-[14px]
                           text-ink-900 hover:bg-bite-50"
              >
                <ArrowLeft size={22} aria-hidden="true" />
              </Link>
            )}
            <h1 className="display text-xl sm:text-2xl text-ink-900">
              {tab === 'history' ? 'Plan history' : 'Settings'}
            </h1>
          </div>
          <p className="text-sm text-ink-700">
            {tab === 'history'
              ? "Every week your dietician wrote, in their own words."
              : 'Targets, the shape of your week, and your data.'}
          </p>
        </header>

        <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit" role="tablist">
          <TabLink to="/settings" label="Settings" on={tab === 'settings'} />
          <TabLink to="/settings/history" label="Plan history" on={tab === 'history'} />
        </div>

        {tab === 'history' ? <PlanArchive /> : <SettingsPanels />}
      </div>
    </div>
  )
}

function TabLink({ to, label, on }: { to: string; label: string; on: boolean }) {
  return (
    <Link
      to={to}
      role="tab"
      aria-selected={on}
      className={on ? 'tab-on' : 'tab-off'}
    >
      {label}
    </Link>
  )
}

function SettingsPanels() {
  // Signed out, the account section has nothing to show and no one to sign out;
  // everything else on this screen belongs to the device and still works.
  const session = useAuthStore((s) => s.session)

  return (
    <div className="space-y-8">
        {/* ─── Targets ─────────────────────────────────────────────────────── */}
        <TargetsSection />

        {/* ─── Whose exercise ──────────────────────────────────────────────── */}
        <ExerciseSection />

        {/* ─── Week & profile ──────────────────────────────────────────────── */}
        <WeekSection />

        {/* ─── Backup ──────────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Your data</SectionHeading>
          <BackupPanel />
        </section>

        {/* ─── Account ─────────────────────────────────────────────────────── */}
        <DeletedRecipesPanel />
        <FoodCheckPanel />

        <DeletedFoodsPanel />

        {isConfigured && session && <AccountPanel />}

        {isConfigured && session && <HouseholdPanel />}

        {isConfigured && session && <SyncPanel />}

        {isConfigured && session && <NotificationsPanel />}

        <VersionPanel />
    </div>
  )
}
