import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import BottomNav from './components/layout/BottomNav'
import Dashboard from './pages/Dashboard'
import Recipes from './pages/Recipes'
import GroceryList from './pages/GroceryList'
import PrepMode from './pages/PrepMode'
import Analytics from './pages/Analytics'
import Schedule from './pages/Schedule'
import Changelog from './pages/Changelog'
import XpToast from './components/layout/XpToast'
import { useUserStore } from './store/useUserStore'

function ToastLayer() {
  const { toast, clearToast } = useUserStore()
  if (!toast) return null
  return <XpToast key={`${toast.amount}-${toast.label}-${Date.now()}`} amount={toast.amount} label={toast.label} onDone={clearToast} />
}

export default function App() {
  return (
    <HashRouter>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/recipes"    element={<Recipes />} />
            <Route path="/grocery"    element={<GroceryList />} />
            <Route path="/prep"       element={<PrepMode />} />
            <Route path="/schedule"   element={<Schedule />} />
            <Route path="/analytics"  element={<Analytics />} />
            <Route path="/changelog"  element={<Changelog />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
      <ToastLayer />
    </HashRouter>
  )
}
