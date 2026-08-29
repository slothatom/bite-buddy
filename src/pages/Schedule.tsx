import { useMemo, useState } from 'react'
import { Plus, Check, Trash2, Search, Bell, Minus } from 'lucide-react'
import type { CookSession } from '../types'
import { useCookStore } from '../store/useCookStore'
import { useRecipes } from '../store/useRecipeStore'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { EmptyState } from '../components/ui'
import { LEAD_MINUTES, reminderAt, reminderLabel } from '../lib/cookReminder'
import { usePortionStore, useAvailablePortions } from '../store/usePortionStore'
import { portionsFromSession, offerOrder, madeWhen, portionLabel } from '../lib/portionsUse'
import { useNutritionContext } from '../store/useNutrition'
import { today } from '../store/useMealPlanStore'

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
  const [cooked, setCooked] = useState<CookSession | null>(null)
  const portions = usePortionStore((st) => st.portions)

  /**
   * Ticking a session off asks what came out of it.
   *
   * This is the moment the fridge fills up, and the only moment anybody knows
   * how much: the pan is in front of you. Asking later means guessing, and not
   * asking at all is what the app did before, which is why cooking once and
   * eating three times had to be typed in three times.
   *
   * Only on the way to done, and only once. Unticking is a correction, and a
   * session that already produced portions does not produce them again.
   */
  const complete = (session: CookSession) => {
    const already = portions.some((p) => p.sessionId === session.id)
    toggleComplete(session.id)
    if (!session.completed && !already && session.recipeIds.length) setCooked(session)
  }

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

        <FridgeList />

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
                    onClick={() => complete(s)}
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
                    {s.remindAt && !s.completed && (
                      <p className="text-xs text-ink-500 flex items-center gap-1 mt-1">
                        <Bell size={12} /> Both phones buzz at {reminderLabel(s.remindAt)}
                      </p>
                    )}
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

      {cooked && (
        <CookedDialog
          session={cooked}
          onClose={() => setCooked(null)}
        />
      )}

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
  onSave: (s: CookSession) => void
}) {
  const plan = useMealPlanStore((s) => s.plan)
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(today())
  const [time, setTime] = useState('18:00')
  const [picked, setPicked] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [remind, setRemind] = useState(true)

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

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox" className="w-4 h-4 accent-bite-500 mt-0.5 shrink-0"
              checked={remind} onChange={() => setRemind(!remind)}
            />
            <span className="min-w-0">
              <span className="block text-sm text-ink-900">
                Notify both of us {LEAD_MINUTES} minutes before
              </span>
              <span className="block text-xs text-ink-500">
                Reaches whichever phones have notifications switched on, in Settings. Needs
                the notify job running on the server; see the README.
              </span>
            </span>
          </label>

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
              // Worked out here rather than on the server: this is the device
              // that knows what timezone "18:00" was typed in.
              remindAt: remind ? reminderAt(date, time) : undefined,
            })}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * What is cooked and waiting.
 *
 * On this screen rather than a screen of its own, because it answers the
 * question this screen exists for: whether you need to cook. A separate
 * destination for six tubs of stew would be a tab you look at once.
 *
 * Counts are editable here and nowhere else needs them to be right. The app
 * cannot see the fridge, so the number is a note to yourselves, and the
 * only thing that would make it worse is arguing with you about it.
 */
function FridgeList() {
  const ctx = useNutritionContext()
  const available = useAvailablePortions()
  const { updatePortion, removePortion } = usePortionStore()
  const [adding, setAdding] = useState(false)

  if (!available.length && !adding) {
    return (
      <div className="card p-4 flex items-center gap-3">
        <span className="text-xl">🥡</span>
        <p className="flex-1 min-w-0 text-sm text-ink-700">
          Nothing cooked and waiting. Tick a session off when you have cooked it, or add
          leftovers by hand.
        </p>
        <button className="btn-secondary shrink-0" onClick={() => setAdding(true)}>
          <Plus size={15} /> Leftovers
        </button>
      </div>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-500">In the fridge</h2>
        <button className="btn-ghost text-xs" onClick={() => setAdding(true)}>
          <Plus size={14} /> Leftovers
        </button>
      </div>

      <div className="space-y-2">
        {offerOrder(available).map((p) => (
          <div key={p.id} className="card p-3 flex items-center gap-3">
            <span className="text-xl shrink-0">{p.storage === 'freezer' ? '🧊' : '🥡'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900 truncate">
                {portionLabel(p, ctx.recipes)}
              </p>
              <p className="text-xs text-ink-500">
                {madeWhen(p)}
                {p.source === 'leftover' ? ' · leftovers' : ''}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                className="btn-ghost btn-icon text-ink-500"
                onClick={() => updatePortion(p.id, { servings: Math.max(0, p.servings - 0.5) })}
                aria-label={`One fewer ${portionLabel(p, ctx.recipes)}`}
              >
                <Minus size={15} />
              </button>
              <span className="text-sm font-mono text-ink-900 tabular-nums w-8 text-center">
                {p.servings}
              </span>
              <button
                className="btn-ghost btn-icon text-ink-500"
                onClick={() => updatePortion(p.id, { servings: p.servings + 0.5 })}
                aria-label={`One more ${portionLabel(p, ctx.recipes)}`}
              >
                <Plus size={15} />
              </button>
              <button
                className="btn-ghost btn-icon text-ink-300 hover:text-coral-600"
                onClick={() => removePortion(p.id)}
                aria-label={`Remove ${portionLabel(p, ctx.recipes)}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {adding && <LeftoversDialog onClose={() => setAdding(false)} />}
    </section>
  )
}

/**
 * Recording what is left after a meal.
 *
 * A recipe when it was one, and free text when it was not, because half a
 * lasagne somebody improvised is a real thing in a real fridge and refusing to
 * write it down would mean the app only knows about the tidy half of cooking.
 */
function LeftoversDialog({ onClose }: { onClose: () => void }) {
  const recipes = useRecipes()
  const { addPortion } = usePortionStore()
  const [query, setQuery] = useState('')
  const [label, setLabel] = useState('')
  const [servings, setServings] = useState(1)
  const [storage, setStorage] = useState<'fridge' | 'freezer'>('fridge')
  const [recipeId, setRecipeId] = useState<string | null>(null)

  const matches = useMemo(() => {
    const n = query.trim().toLowerCase()
    if (!n) return []
    return recipes.filter((r) => r.name.en.toLowerCase().includes(n)).slice(0, 6)
  }, [query, recipes])

  const chosen = recipes.find((r) => r.id === recipeId)

  function save() {
    if (!chosen && !label.trim()) return
    addPortion({
      id: `leftover-${Date.now().toString(36)}`,
      recipeId: chosen?.id,
      label: chosen ? undefined : label.trim(),
      servings,
      madeOn: today(),
      storage,
      source: 'leftover',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4" onClick={onClose}>
      <div
        className="bg-paper w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl p-5 space-y-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="display text-lg text-ink-900">What is left?</h3>

        {chosen ? (
          <div className="card-soft p-3 flex items-center gap-2">
            <span className="text-lg">{chosen.emoji}</span>
            <span className="flex-1 min-w-0 text-sm font-semibold text-ink-900 truncate">
              {chosen.name.en}
            </span>
            <button className="btn-ghost text-xs" onClick={() => setRecipeId(null)}>Change</button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
              <input
                className="input pl-9"
                placeholder="Search your recipes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {matches.map((r) => (
              <button
                key={r.id}
                onClick={() => { setRecipeId(r.id); setQuery('') }}
                className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-cream-50 text-left"
              >
                <span>{r.emoji}</span>
                <span className="flex-1 min-w-0 text-sm text-ink-900 truncate">{r.name.en}</span>
              </button>
            ))}

            <div>
              <label className="label" htmlFor="leftover-label">Or just say what it is</label>
              <input
                id="leftover-label"
                className="input"
                placeholder="Half a lasagne"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
              <p className="text-xs text-ink-500 mt-1">
                Written this way it has no calories, because nothing knows what went in it.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div>
            <label className="label" htmlFor="leftover-servings">Portions</label>
            <input
              id="leftover-servings"
              type="number" min={0.5} step={0.5} className="input w-24 px-2"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
            />
          </div>
          <div className="flex-1">
            <p className="label">Kept in</p>
            <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit">
              {(['fridge', 'freezer'] as const).map((where) => (
                <button
                  key={where}
                  onClick={() => setStorage(where)}
                  className={`capitalize ${storage === where ? 'tab-on' : 'tab-off'}`}
                >
                  {where}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-primary flex-1" disabled={!chosen && !label.trim()} onClick={save}>
            Keep it
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

/**
 * What came out of the session, and where it went.
 *
 * Every number is already filled in, from what each recipe says it makes, so
 * the common case is reading it and pressing the button. Being able to change
 * them matters anyway: a batch is whatever fitted in the pan, and an app that
 * insists otherwise is wrong by Tuesday.
 */
function CookedDialog({ session, onClose }: { session: CookSession; onClose: () => void }) {
  const ctx = useNutritionContext()
  const { addPortion } = usePortionStore()

  const suggested = useMemo(
    () => portionsFromSession(session.recipeIds, ctx.recipes, session.date, session.id),
    [session, ctx.recipes],
  )

  const [made, setMade] = useState<Record<string, number>>(
    () => Object.fromEntries(suggested.map((p) => [p.id, p.servings])),
  )
  const [storage, setStorage] = useState<Record<string, 'fridge' | 'freezer'>>(
    () => Object.fromEntries(suggested.map((p) => [p.id, 'fridge' as const])),
  )

  function save() {
    for (const p of suggested) {
      const servings = made[p.id] ?? p.servings
      if (servings <= 0) continue
      addPortion({ ...p, servings, storage: storage[p.id] ?? 'fridge' })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4" onClick={onClose}>
      <div
        className="bg-paper w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl p-5 space-y-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="display text-lg text-ink-900">Nicely done. What came out?</h3>
          <p className="text-sm text-ink-700">
            However many portions there are, and where they are going. You can change all of
            this later, and nothing minds if it turns out to be wrong.
          </p>
        </div>

        <div className="space-y-3">
          {suggested.map((p) => {
            const recipe = ctx.recipes.get(p.recipeId ?? '')
            return (
              <div key={p.id} className="card-soft p-3 space-y-2">
                <p className="text-sm font-semibold text-ink-900">
                  {recipe?.emoji} {recipe?.name.en ?? 'Something'}
                </p>
                <div className="flex items-center gap-2">
                  <label className="label mb-0 shrink-0" htmlFor={`made-${p.id}`}>Portions</label>
                  <input
                    id={`made-${p.id}`}
                    type="number" min={0} step={0.5} className="input w-20 px-2"
                    value={made[p.id] ?? p.servings}
                    onChange={(e) => setMade({ ...made, [p.id]: Number(e.target.value) })}
                  />
                  <div className="flex gap-1 p-1 bg-cream-50 rounded-xl ml-auto">
                    {(['fridge', 'freezer'] as const).map((where) => (
                      <button
                        key={where}
                        onClick={() => setStorage({ ...storage, [p.id]: where })}
                        className={`capitalize ${(storage[p.id] ?? 'fridge') === where ? 'tab-on' : 'tab-off'}`}
                      >
                        {where}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={save}>Into the fridge</button>
          <button className="btn-secondary" onClick={onClose}>Nothing to keep</button>
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
