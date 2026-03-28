import { useState } from 'react'
import { CalendarClock, Plus, Trash2, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useCookStore } from '../store/useCookStore'
import { useRecipeStore } from '../store/useRecipeStore'
import type { CookSession } from '../types'

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }

function formatDateTime(date: string, time: string) {
  const d = new Date(`${date}T${time}`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function Schedule() {
  const { sessions, addSession, toggleComplete, removeSession, upcomingSessions } = useCookStore()
  const { recipes } = useRecipeStore()
  const [showForm, setShowForm] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const upcoming = upcomingSessions()
  const today = new Date().toISOString().split('T')[0]
  const past = sessions.filter((s) => s.date < today || s.completed).reverse()

  const [form, setForm] = useState({
    date: today,
    time: '10:00',
    label: '',
    recipeIds: [] as string[],
  })

  function toggleFormRecipe(id: string) {
    setForm((f) => ({
      ...f,
      recipeIds: f.recipeIds.includes(id)
        ? f.recipeIds.filter((r) => r !== id)
        : [...f.recipeIds, id],
    }))
  }

  function handleAdd() {
    if (!form.label.trim() && form.recipeIds.length === 0) return
    const session: CookSession = {
      id: newId(),
      date: form.date,
      time: form.time,
      label: form.label.trim() || 'Prep session',
      recipeIds: form.recipeIds,
      completed: false,
    }
    addSession(session)
    setForm({ date: today, time: '10:00', label: '', recipeIds: [] })
    setShowForm(false)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="page-title">Cook Schedule</h1>
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
            <Plus size={15} /> Add session
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="card px-5 py-4 space-y-3">
            <h2 className="section-title">New cook session</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Date</label>
                <input type="date" className="input text-sm w-full" value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Time</label>
                <input type="time" className="input text-sm w-full" value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Label</label>
              <input type="text" className="input text-sm w-full" placeholder="e.g. Sunday batch cook"
                value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Recipes to cook</label>
              <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                {recipes.map((r) => (
                  <label key={r.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors text-xs font-medium
                      ${form.recipeIds.includes(r.id) ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}>
                    <input type="checkbox" className="hidden" checked={form.recipeIds.includes(r.id)}
                      onChange={() => toggleFormRecipe(r.id)} />
                    <span className="text-base">{r.emoji}</span>
                    <span className="truncate">{r.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button className="btn-ghost flex-1" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={handleAdd}
                disabled={!form.label.trim() && form.recipeIds.length === 0}>
                Add session
              </button>
            </div>
          </div>
        )}

        {/* Upcoming sessions */}
        {upcoming.length === 0 && !showForm ? (
          <div className="card px-6 py-16 text-center">
            <div className="text-5xl mb-4">📅</div>
            <p className="font-semibold text-gray-700 text-lg">No upcoming sessions</p>
            <p className="text-sm text-gray-400 mt-2 mb-6">Schedule your cook sessions to stay on track.</p>
            <button className="btn-primary mx-auto" onClick={() => setShowForm(true)}>
              <Plus size={15} /> Add first session
            </button>
          </div>
        ) : (
          upcoming.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Upcoming ({upcoming.length})</p>
              {upcoming.map((s) => (
                <SessionCard key={s.id} session={s} recipes={recipes}
                  onToggle={() => toggleComplete(s.id)} onRemove={() => removeSession(s.id)} />
              ))}
            </div>
          )
        )}

        {/* Past / completed */}
        {past.length > 0 && (
          <div>
            <button className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2"
              onClick={() => setShowPast((v) => !v)}>
              {showPast ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Past & completed ({past.length})
            </button>
            {showPast && (
              <div className="space-y-2">
                {past.map((s) => (
                  <SessionCard key={s.id} session={s} recipes={recipes}
                    onToggle={() => toggleComplete(s.id)} onRemove={() => removeSession(s.id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SessionCard({ session, recipes, onToggle, onRemove }: {
  session: CookSession
  recipes: ReturnType<typeof useRecipeStore>['recipes']
  onToggle: () => void
  onRemove: () => void
}) {
  const sessionRecipes = session.recipeIds.map((id) => recipes.find((r) => r.id === id)).filter(Boolean) as typeof recipes

  return (
    <div className={`card px-4 py-3 flex items-start gap-3 transition-opacity ${session.completed ? 'opacity-60' : ''}`}>
      <button onClick={onToggle}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
          ${session.completed ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-brand-400'}`}>
        {session.completed && <Check size={11} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${session.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {session.label}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <CalendarClock size={11} />
            {formatDateTime(session.date, session.time)}
          </div>
        </div>
        {sessionRecipes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {sessionRecipes.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-100 text-xs text-gray-600 font-medium">
                {r.emoji} {r.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <button onClick={onRemove} className="btn-ghost btn-icon text-red-400 hover:bg-red-50 shrink-0">
        <Trash2 size={14} />
      </button>
    </div>
  )
}
