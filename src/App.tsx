import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import BottomNav from './components/layout/BottomNav'
import XpToast from './components/layout/XpToast'
import ErrorBoundary from './components/layout/ErrorBoundary'
import StorageBanner from './components/layout/StorageBanner'
import Planner from './pages/Planner'
import Recipes from './pages/Recipes'
import Foods from './pages/Foods'
import GroceryList from './pages/GroceryList'
import History from './pages/History'
import PrepMode from './pages/PrepMode'
import Schedule from './pages/Schedule'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import { useUserStore } from './store/useUserStore'

function ToastLayer() {
  const { toast, clearToast } = useUserStore()
  if (!toast) return null
  return <XpToast key={`${toast.amount}-${toast.label}`} amount={toast.amount} label={toast.label} onDone={clearToast} />
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <StorageBanner />
        <div className="flex min-h-screen bg-sand-50">
          <Sidebar />
          <main className="flex-1 flex flex-col min-w-0">
            <Routes>
              <Route path="/"          element={<Planner />} />
              <Route path="/recipes"   element={<Recipes />} />
              <Route path="/foods"     element={<Foods />} />
              <Route path="/grocery"   element={<GroceryList />} />
              <Route path="/history"   element={<History />} />
              <Route path="/prep"      element={<PrepMode />} />
              <Route path="/schedule"  element={<Schedule />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings"  element={<Settings />} />
            </Routes>
          </main>
          <BottomNav />
        </div>
        <ToastLayer />
      </HashRouter>
    </ErrorBoundary>
  )
}
