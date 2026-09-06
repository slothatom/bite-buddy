import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Sidebar from './components/layout/Sidebar'
import BottomNav from './components/layout/BottomNav'
import ErrorBoundary from './components/layout/ErrorBoundary'
import StorageBanner from './components/layout/StorageBanner'
import UndoBar from './components/layout/UndoBar'
import Home from './pages/Home'
import Planner from './pages/Planner'
import SignIn from './pages/SignIn'

import { useAuthStore } from './store/useAuth'
import { useSyncSession } from './store/useSync'
import { useMealPlanStore } from './store/useMealPlanStore'
import { useUserStore } from './store/useUserStore'
import { followOtherTabs } from './store/registry'
import { isConfigured } from './lib/supabase'
import Zig from './components/brand/Mascot'
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
  '/plan': 'Planner',
  '/recipes': 'Recipes',
  '/foods': 'Foods',
  '/grocery': 'Shopping',
  '/schedule': 'Cooking',
  '/movement': 'Movement',
  '/analytics': 'Progress',
  '/settings': 'Settings',
  '/settings/history': 'Plan history',
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

  return (
    <>
      <StorageBanner />
      <div className="flex min-h-screen bg-cream-50">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <Suspense fallback={<ScreenLoading />}>
            <Routes>
              <Route path="/"          element={<Home />} />
              <Route path="/plan"      element={<Planner />} />
              <Route path="/recipes"   element={<Recipes />} />
              <Route path="/foods"     element={<Foods />} />
              <Route path="/grocery"   element={<GroceryList />} />
              {/* The archive lives inside Settings now. The old address still
                  works, plenty of things link to it. */}
              <Route path="/history"   element={<Navigate to="/settings/history" replace />} />
              <Route path="/schedule"  element={<Schedule />} />
              <Route path="/movement" element={<Activity />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings/*" element={<Settings />} />
              <Route path="*"          element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <BottomNav />
      </div>
      <UndoBar />
    </>
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
      <header className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-border-200 bg-paper">
        <Link to="/" className="btn-secondary"><ArrowLeft size={15} /> Sign in</Link>
        <p className="text-sm text-ink-500">Signed out. Everything here is kept on this device.</p>
      </header>
      <Suspense fallback={<ScreenLoading />}>
        <Settings />
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

  if (!isConfigured) return <Shell />

  if (!ready) {
    return (
      <div className="min-h-dvh grid place-items-center bg-cream-50">
        <div className="text-center">
          <Zig mood="thinking" size={64} />
          <p className="mt-3 text-sm text-ink-500">One moment…</p>
        </div>
      </div>
    )
  }

  if (session) return <Shell />

  return (
    <Routes>
      <Route path="/settings" element={<SignedOutSettings />} />
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
