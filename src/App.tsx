import { Fragment, lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import BottomNav from './components/layout/BottomNav'
import { REDIRECTS, isSettings } from './components/layout/nav'
import ErrorBoundary from './components/layout/ErrorBoundary'
import StorageBanner from './components/layout/StorageBanner'
import UndoBar from './components/layout/UndoBar'
import Home from './pages/Home'
import Planner from './pages/Planner'
import SignIn from './pages/SignIn'
import HouseholdSetup from './pages/HouseholdSetup'
import { useHousehold } from './store/useHousehold'
import { useArchive } from './store/useArchive'

import { useAuthStore } from './store/useAuth'
import { useSyncSession } from './store/useSync'
import { useMealPlanStore } from './store/useMealPlanStore'
import { useUserStore } from './store/useUserStore'
import { followOtherTabs } from './store/registry'
import { isConfigured } from './lib/supabase'
import Logo from './components/brand/Logo'
import { lazyRoute } from './lib/lazyRoute'
import { applyTheme } from './lib/theme'

/**
 * Home and Planner load with the app; everything else on demand.
 *
 * One bundle meant the first screen waited on the barcode scanner, the whole
 * plan archive and every other screen before it could paint, 561 kB of it,
 * which is the difference between usable and not when you open this on mobile
 * data in a shop. The service worker precaches the split chunks too, so being
 * offline is unaffected: they are already on the device.
 *
 * Home and Planner stay eager because one of them is always what you open.
 */
const Recipes = lazy(lazyRoute(() => import('./pages/Recipes')))
const Foods = lazy(lazyRoute(() => import('./pages/Foods')))
const GroceryList = lazy(lazyRoute(() => import('./pages/GroceryList')))
const Schedule = lazy(lazyRoute(() => import('./pages/Schedule')))
const Activity = lazy(lazyRoute(() => import('./pages/Activity')))
const Analytics = lazy(lazyRoute(() => import('./pages/Analytics')))
const DieticianSummary = lazy(lazyRoute(() => import('./pages/DieticianSummary')))
const Settings = lazy(lazyRoute(() => import('./pages/Settings')))

/** Deliberately quiet: a chunk off the local service worker arrives in a frame
    or two, and a spinner that flashes reads as jank rather than progress. */
function ScreenLoading() {
  return <div className="flex-1" aria-busy="true" />
}

/**
 * Keeps the planner's window on the week you are actually in.
 *
 * Done here rather than in the Planner because every other screen reads the
 * same window and most people open Home. It runs on start and again whenever
 * the app comes back to the foreground: a phone with the app left open
 * overnight is the ordinary case, and until this existed such a phone would
 * still be showing yesterday's week at breakfast.
 */
function useOtherTabs() {
  useEffect(followOtherTabs, [])
}

function useCurrentWeek() {
  const weekStartsOn = useUserStore((s) => s.profile.weekStartsOn)
  const ensureCurrentWeek = useMealPlanStore((s) => s.ensureCurrentWeek)

  useEffect(() => {
    ensureCurrentWeek(weekStartsOn)

    const check = () => { if (!document.hidden) ensureCurrentWeek(weekStartsOn) }
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [weekStartsOn, ensureCurrentWeek])
}

/**
 * Names the browser tab after the screen you are on.
 *
 * Every route was called "Bite Buddy", so two tabs of this app were
 * indistinguishable and so was every entry in a month of history. The app's
 * own name goes second, which is the way round that helps: a tab strip shows
 * you the first few characters.
 */
const TITLES: Record<string, string> = {
  '/': 'Today',
  '/plan/week': 'Plan',
  '/plan/grocery': 'Shopping',
  '/plan/cooking': 'Cooking',
  '/recipes': 'Recipes',
  '/recipes/foods': 'Foods',
  '/progress': 'Progress',
  '/progress/movement': 'Movement',
  '/progress/summary': 'For your dietician',
  '/settings': 'Settings',
  '/settings/history': 'Plan history',
  '/settings/household': 'Household',
  '/settings/targets': 'Targets',
  '/settings/reminders': 'Reminders',
  '/settings/appearance': 'Appearance',
  '/settings/backups': 'Backups',
  '/settings/account': 'Account',
}

function useRouteTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    const name = TITLES[pathname]
      ?? TITLES[Object.keys(TITLES).filter((k) => k !== '/' && pathname.startsWith(k)).sort().pop() ?? '']
    document.title = name ? `${name} · Bite Buddy` : 'Bite Buddy'
  }, [pathname])
}

/**
 * The chosen theme, on the document, kept in step with the device.
 *
 * Applied here rather than in Settings so it survives navigating away from
 * Settings, and applied on every change to the profile so it follows a sync
 * from the other phone. The listener is what makes 'system' mean the device
 * *now*: without it, turning your phone to dark at sunset would leave this app
 * light until the next reload.
 */
function useTheme() {
  const theme = useUserStore((s) => s.profile.theme)

  useEffect(() => {
    applyTheme(theme)

    if (theme && theme !== 'system') return
    if (typeof window === 'undefined' || !window.matchMedia) return

    const device = window.matchMedia('(prefers-color-scheme: dark)')
    const follow = () => applyTheme(theme)
    device.addEventListener('change', follow)
    return () => device.removeEventListener('change', follow)
  }, [theme])
}

/**
 * Where an old address lives now, query string and all.
 *
 * `/grocery?tab=cupboard` has to arrive at the cupboard, not at the list, so
 * the search is carried across rather than dropped.
 */
function Redirect({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={{ pathname: to, search }} replace />
}

/**
 * A tap on a notification while the app is already open.
 *
 * The service worker focuses the open window and posts the path the
 * notification was about (`/#/plan/cooking`); this is what follows it. Without
 * it, tapping a cooking reminder brought the app forward on whatever screen
 * it was last left on.
 */
function useNotificationClicks() {
  const navigate = useNavigate()

  useEffect(() => {
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined
    if (!sw) return
    const follow = (event: MessageEvent) => {
      const data = event.data as { type?: string; path?: unknown } | null
      if (data?.type !== 'notification-click' || typeof data.path !== 'string') return
      const route = data.path.includes('#') ? data.path.slice(data.path.indexOf('#') + 1) : data.path
      navigate(route || '/')
    }
    sw.addEventListener('message', follow)
    return () => sw.removeEventListener('message', follow)
  }, [navigate])
}

/**
 * The household's plan archive, fetched once the household is known.
 *
 * The copy on this device is already in place (main.tsx restores it before
 * the first render); this asks the database whether there is a newer one, and
 * downloads it only if so.
 */
function useArchiveSync() {
  const householdId = useHousehold((s) => (s.status === 'member' ? s.household?.id ?? null : null))

  useEffect(() => {
    if (isConfigured && householdId) void useArchive.getState().load(householdId)
  }, [householdId])
}

/**
 * The app itself, once you are allowed to see it.
 *
 * Sync is started here rather than inside a screen, so it survives navigation
 * and there is exactly one subscription per session.
 */
function Shell() {
  useSyncSession()
  useCurrentWeek()
  useOtherTabs()
  useRouteTitle()
  useArchiveSync()
  useNotificationClicks()
  const { pathname } = useLocation()
  // Settings is a detour with a back arrow and no bar, so no room for one.
  const barSpace = isSettings(pathname) ? '' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0'
  // A new archive remounts every screen, so nothing keeps showing the recipes
  // and plans it read before. Rare (an upload, or a newer one arriving after
  // sign-in), and the stores and the route survive it.
  const archiveVersion = useArchive((s) => s.version)

  return (
    <Fragment key={archiveVersion}>
      <StorageBanner />
      <div className="flex min-h-screen bg-cream-50">
        <Sidebar />
        {/* Room under the content for the phone's bar, so the last row of a
            screen is never hidden behind it. */}
        <main className={`flex-1 flex flex-col min-w-0 ${barSpace}`}>
          <Suspense fallback={<ScreenLoading />}>
            <Routes>
              <Route path="/" element={<Home />} />

              {/* Plan draws its own title and tabs, inside each screen's header. */}
              <Route path="/plan">
                <Route index          element={<Redirect to="/plan/week" />} />
                <Route path="week"    element={<Planner />} />
                <Route path="grocery" element={<GroceryList />} />
                <Route path="cooking" element={<Schedule />} />
              </Route>

              {/* Recipes and Foods put their tabs in their own headers. */}
              <Route path="/recipes">
                <Route index        element={<Recipes />} />
                <Route path="foods" element={<Foods />} />
              </Route>

              {/* Progress draws its own header, with the tabs inside it. */}
              <Route path="/progress">
                <Route index           element={<Analytics />} />
                <Route path="movement" element={<Activity />} />
                <Route path="summary"  element={<DieticianSummary />} />
              </Route>

              <Route path="/settings/*" element={<Settings />} />

              {/* Every address the app used to have still works: bookmarks,
                  reminders already on a phone, and links in old notes. */}
              {/* `/plan` itself is the index of the Plan section above. */}
              {Object.entries(REDIRECTS).filter(([from]) => from !== '/plan').map(([from, to]) => (
                <Route key={from} path={from} element={<Redirect to={to} />} />
              ))}

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <BottomNav />
      <UndoBar />
    </Fragment>
  )
}

/**
 * Settings, without being signed in.
 *
 * Everything on that screen is a property of this device, not of an account:
 * your targets, the shape of your week, the backup file, which build is
 * running, the recipes you deleted. Locking it behind a session meant that
 * signing out took away the one screen you might sign out in order to reach -
 * restoring a backup, or checking a version before deciding to log back in.
 */
function SignedOutSettings() {
  return (
    <div className="min-h-dvh flex flex-col bg-cream-50">
      <Suspense fallback={<ScreenLoading />}>
        <Settings signedOut />
      </Suspense>
    </div>
  )
}

/**
 * Decides between the sign-in screen and the app.
 *
 * When Supabase is not configured, a local clone, the one-file build, the test
 * suite, `ready` starts true and `session` stays null, and the app renders
 * straight through with no login at all. That is the point: the deployment
 * needs an account, running it yourself does not.
 */
function Gate() {
  const ready = useAuthStore((s) => s.ready)
  const session = useAuthStore((s) => s.session)
  // In no household, once the database has said so. A cached household counts
  // as being in one, so a phone opened offline goes straight to the app.
  const homeless = useHousehold((s) =>
    !s.household && (s.status === 'none' || s.status === 'error')
    && s.userId === session?.user?.id)

  if (!isConfigured) return <Shell />

  if (!ready) {
    return (
      <div className="min-h-dvh grid place-items-center bg-cream-50">
        <div className="text-center">
          <Logo variant="mark" size={56} className="mx-auto" />
          <p className="mt-3 text-sm text-ink-500">One moment…</p>
        </div>
      </div>
    )
  }

  if (session && homeless) return <HouseholdSetup />


  if (session) return <Shell />

  return (
    <Routes>
      <Route path="/settings/*" element={<SignedOutSettings />} />
      <Route path="*" element={<SignIn />} />
    </Routes>
  )
}

export default function App() {
  // Here rather than inside the signed-in shell: the sign-in screen is a screen
  // too, and it was the one place a dark theme would have flashed white.
  useTheme()

  return (
    <ErrorBoundary>
      <HashRouter>
        <Gate />
      </HashRouter>
    </ErrorBoundary>
  )
}
