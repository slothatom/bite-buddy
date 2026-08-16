import { useState } from 'react'
import { Plus, Check, Trash2 } from 'lucide-react'
import { useCookStore } from '../store/useCookStore'
import { useRecipes } from '../store/useRecipeStore'
import { EmptyState } from '../components/ui'

/**
 * Batch-cook sessions.
 *
 * The dietician's plans repeat a dish across several days on purpose — one pot
 * of lentil stew covers Friday and Saturday — so the useful unit here is a
 * cooking session with several recipes attached, not one meal at a time.
 */
export default function Schedule() {
  const { sessions, addSession, toggleComplete, removeSession } = useCookStore()
  const recipes = useRecipes()
  const [adding, setAdding] = useState(false)

  const batchable = recipes.filter((r) => r.steps.length > 0)

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-stone-800">Cook schedule</h1>
            <p className="text-sm text-stone-500">When you're actually cooking, and what.</p>
          </div>
          <button className="btn-primary shrink-0" onClick={() => setAdding(true)}>
            <Plus size={16} /> Session
          </button>
        </header>

        {sessions.length === 0 ? (
          <EmptyState emoji="🍳" title="No cook sessions planned">
            Schedule one and pick the dishes you'll batch together.
          </EmptyState>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((s) => (
              <div key={s.id} className={`card p-4 ${s.completed ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleComplete(s.id)}
                    className={`shrink-0 w-6 h-6 rounded-full border-2 grid place-items-center transition-colors ${
                      s.completed ? 'bg-brand-600 border-brand-600 text-white' : 'border-sand-300 text-transparent'}`}
                    aria-label={s.completed ? 'Mark as not done' : 'Mark as done'}
                  >
                    <Check size={13} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm text-stone-800 ${s.completed ? 'line-through' : ''}`}>
                      {s.label || 'Cook session'}
                    </p>
                    <p className="text-xs text-stone-400">
                      {new Date(s.date + 'T12:00:00').toLocaleDateString('en-GB', {
                        weekday: 'long', day: 'numeric', month: 'long' })} · {s.time}
                    </p>
                    {s.recipeIds.length > 0 && (
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {s.recipeIds.map((id) => {
                          const r = recipes.find((x) => x.id === id)
                          return r ? <li key={id} className="tag">{r.emoji} {r.name.en}</li> : null
                        })}
                      </ul>
                    )}
                  </div>
                  <button className="btn-ghost btn-icon text-stone-300 hover:text-clay-600"
                    onClick={() => removeSession(s.id)} aria-label="Remove session">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {adding && (
        <SessionDialog
          recipes={batchable}
          onClose={() => setAdding(false)}
          onSave={(session) => { addSession(session); setAdding(false) }}
        />
      )}
    </div>
  )
}

function SessionDialog({
  recipes, onClose, onSave,
}: {
  recipes: ReturnType<typeof useRecipes>
  onClose: () => void
  onSave: (s: { id: string; date: string; time: string; recipeIds: string[]; label: string; completed: boolean }) => void
}) {
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState('18:00')
  const [picked, setPicked] = useState<string[]>([])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/30 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="font-bold text-stone-800">New cook session</h2>

        <div>
          <label className="label">What is it for</label>
          <input className="input" placeholder="Sunday batch cook" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Dishes ({picked.length} picked)</label>
          <div className="max-h-52 overflow-y-auto card-soft divide-y divide-sand-200">
            {recipes.map((r) => (
              <label key={r.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm">
                <input
                  type="checkbox" className="w-4 h-4 accent-brand-600"
                  checked={picked.includes(r.id)}
                  onChange={() => setPicked((p) => p.includes(r.id) ? p.filter((x) => x !== r.id) : [...p, r.id])}
                />
                <span className="text-stone-700">{r.emoji} {r.name.en}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1"
            onClick={() => onSave({
              id: `${Date.now()}`, date, time, recipeIds: picked,
              label: label.trim() || 'Cook session', completed: false,
            })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
