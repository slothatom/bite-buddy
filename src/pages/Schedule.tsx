import { useMemo, useState } from 'react'
import { Plus, Check, Trash2, Search } from 'lucide-react'
import { useCookStore } from '../store/useCookStore'
import { useRecipes } from '../store/useRecipeStore'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { EmptyState } from '../components/ui'

/**
 * Batch-cook sessions.
 *
 * The dietician's plans repeat a dish across several days on purpose, one pot
 * of lentil stew covers Friday and Saturday, so the useful unit here is a
 * cooking session with several recipes attached, not one meal at a time.
 */
export default function Schedule() {
  const { sessions, addSession, toggleComplete, removeSession } = useCookStore()
  const recipes = useRecipes()
  const [adding, setAdding] = useState(false)

  // Every recipe with ingredients can be batch-cooked. This used to require a
  // written method, and since none of the imported meals carry one, the picker
  // was always empty and no session could be built.
  const batchable = recipes.filter((r) => r.components.length > 0)

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="display text-xl sm:text-2xl text-ink-900">Cook schedule</h1>
            <p className="text-sm text-ink-700">When you’re cooking, and what’s going in the pot.</p>
          </div>
          <button className="btn-primary shrink-0" onClick={() => setAdding(true)}>
            <Plus size={16} /> Session
          </button>
        </header>

        {sessions.length === 0 ? (
          <EmptyState title="No cook sessions planned">
            Add one and pick the dishes you'll batch together.
          </EmptyState>
        ) : (
          <div className="space-y-2.5">
            {sessions.map((s) => (
              <div key={s.id} className={`card p-4 ${s.completed ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleComplete(s.id)}
                    className={`shrink-0 w-6 h-6 rounded-full border-2 grid place-items-center transition-colors ${
                      s.completed ? 'bg-bite-500 border-bite-500 text-white' : 'border-border-200 text-transparent'}`}
                    aria-label={s.completed ? 'Mark as not done' : 'Mark as done'}
                  >
                    <Check size={13} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm text-ink-900 ${s.completed ? 'line-through' : ''}`}>
                      {s.label || 'Cook session'}
                    </p>
                    <p className="text-xs text-ink-500">
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
                  <button className="btn-ghost btn-icon text-ink-300 hover:text-coral-600"
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
  const plan = useMealPlanStore((s) => s.plan)
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState('18:00')
  const [picked, setPicked] = useState<string[]>([])
  const [query, setQuery] = useState('')

  /**
   * What you are actually cooking this week, first.
   *
   * The picker offered all 207 recipes in library order, so building a session
   * meant scrolling past two hundred dishes nobody is eating to find the four
   * that are planned. Those four are the point of a batch cook.
   */
  const plannedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const day of plan) {
      for (const meal of day.meals) {
        for (const entry of meal.entries) {
          if (entry.kind === 'recipe') ids.add(entry.recipeId)
        }
      }
    }
    return ids
  }, [plan])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hit = (r: ReturnType<typeof useRecipes>[number]) =>
      !q || [r.name.en, r.name.ro, r.name.hu].some((n) => n?.toLowerCase().includes(q))
    const found = recipes.filter(hit)
    return {
      planned: found.filter((r) => plannedIds.has(r.id)),
      rest: found.filter((r) => !plannedIds.has(r.id)),
    }
  }, [recipes, plannedIds, query])

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4" onClick={onClose}>
      {/* A column with one scrolling middle. The whole dialog used to scroll,
          which pushed Save off the bottom edge, and the inline safe-area
          padding replaced the bottom padding rather than adding to it, so the
          buttons sat flush against the edge of the card. */}
      <div
        className="bg-paper w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-3 space-y-4 shrink-0">
          <h2 className="text-base font-extrabold text-ink-900">New cook session</h2>

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
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
              <input
                className="input pl-9"
                placeholder="Search your recipes"
                aria-label="Search dishes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5">
          <div className="card-soft divide-y divide-border-200">
            {matches.planned.length > 0 && (
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500 bg-cream-50">
                Planned this week
              </p>
            )}
            {matches.planned.map((r) => (
              <DishRow key={r.id} recipe={r} on={picked.includes(r.id)} onToggle={() => toggle(r.id)} />
            ))}

            {matches.rest.length > 0 && (
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-500 bg-cream-50">
                Everything else
              </p>
            )}
            {matches.rest.map((r) => (
              <DishRow key={r.id} recipe={r} on={picked.includes(r.id)} onToggle={() => toggle(r.id)} />
            ))}

            {matches.planned.length === 0 && matches.rest.length === 0 && (
              <p className="px-3 py-4 text-sm text-ink-500">Nothing matches "{query.trim()}".</p>
            )}
          </div>
        </div>

        <div
          className="flex gap-2 p-5 pt-3 shrink-0 border-t border-border-100"
          style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        >
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

function DishRow({
  recipe, on, onToggle,
}: {
  recipe: ReturnType<typeof useRecipes>[number]
  on: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer text-sm">
      <input type="checkbox" className="w-4 h-4 accent-bite-500 shrink-0" checked={on} onChange={onToggle} />
      <span className="text-ink-900 min-w-0">{recipe.emoji} {recipe.name.en}</span>
    </label>
  )
}
