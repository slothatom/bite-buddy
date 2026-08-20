import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import BottomNav from './components/layout/BottomNav'
import XpToast from './components/layout/XpToast'
import ErrorBoundary from './components/layout/ErrorBoundary'
import StorageBanner from './components/layout/StorageBanner'
import Home from './pages/Home'
import Planner from './pages/Planner'
import SignIn from './pages/SignIn'

import { useUserStore } from './store/useUserStore'
import { useAuthStore } from './store/useAuth'
import { useSyncSession } from './store/useSync'
import { isConfigured } from './lib/supabase'
import Zig from './components/brand/Mascot'

/**
 * Home and Planner load with the app; everything else on demand.
 *
 * One bundle meant the first screen waited on the barcode scanner, the whole
 * plan archive and every other screen before it could paint — 561 kB of it,
 * which is the difference between usable and not when you open this on mobile
 * data in a shop. The service worker precaches the split chunks too, so being
 * offline is unaffected: they are already on the device.
 *
 * Home and Planner stay eager because one of them is always what you open.
 */
const Recipes = lazy(() => import('./pages/Recipes'))
const Foods = lazy(() => import('./pages/Foods'))
const GroceryList = lazy(() => import('./pages/GroceryList'))
const History = lazy(() => import('./pages/History'))
const PrepMode = lazy(() => import('./pages/PrepMode'))
const Schedule = lazy(() => import('./pages/Schedule'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Settings = lazy(() => import('./pages/Settings'))

/** Deliberately quiet: a chunk off the local service worker arrives in a frame
    or two, and a spinner that flashes reads as jank rather than progress. */
function ScreenLoading() {
  return <div className="flex-1" aria-busy="true" />
}

function ToastLayer() {
  const { toast, clearToast } = useUserStore()
  if (!toast) return null
  return <XpToast key={`${toast.amount}-${toast.label}`} amount={toast.amount} label={toast.label} onDone={clearToast} />
}

/**
 * The app itself, once you are allowed to see it.
 *
 * Sync is started here rather than inside a screen, so it survives navigation
 * and there is exactly one subscription per session.
 */
function Shell() {
  useSyncSession()

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
              <Route path="/history"   element={<History />} />
              <Route path="/prep"      element={<PrepMode />} />
              <Route path="/schedule"  element={<Schedule />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings"  element={<Settings />} />
              <Route path="*"          element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <BottomNav />
      </div>
      <ToastLayer />
    </>
  )
}

/**
 * Decides between the sign-in screen and the app.
 *
 * When Supabase is not configured — a local clone, the one-file build, the test
 * suite — `ready` starts true and `session` stays null, and the app renders
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

  return session ? <Shell /> : <SignIn />
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Gate />
      </HashRouter>
    </ErrorBoundary>
  )
}
