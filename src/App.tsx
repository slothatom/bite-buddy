import { HashRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Dashboard from './pages/Dashboard'
import Recipes from './pages/Recipes'
import GroceryList from './pages/GroceryList'
import PrepMode from './pages/PrepMode'

export default function App() {
  return (
    <HashRouter>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Routes>
            <Route path="/"        element={<Dashboard />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/grocery" element={<GroceryList />} />
            <Route path="/prep"    element={<PrepMode />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
