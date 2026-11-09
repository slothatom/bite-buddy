import { useMemo, useState } from 'react'
import {
  Plus, Check, Trash2, Bell, BellOff, Minus, AlertTriangle, Clock, Circle, Refrigerator,
} from 'lucide-react'
import type { CookSession, MealSlot } from '../types'
import { useDialog } from '../lib/useDialog'
import { offerUndo } from '../store/useUndo'
import { useCookStore } from '../store/useCookStore'
import { useRecipes } from '../store/useRecipeStore'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useThisWeek } from '../store/useThisWeek'
import { EmptyState, SearchField } from '../components/ui'
import { PlanHeader } from '../components/planner/PlanHeader'
import { LEAD_MINUTES, overdue, reminderAt, reminderLabel } from '../lib/cookReminder'
import { usePortionStore, useAvailablePortions } from '../store/usePortionStore'
import {
  portionsFromSession, offerOrder, madeWhen, portionLabel, spreadPortions,
} from '../lib/portionsUse'
import { useNutritionContext } from '../store/useNutrition'
import { today, addDays } from '../store/useMealPlanStore'

/**
 * Batch-cook sessions.
 *
 * The dietician's plans repeat a dish across several days on purpose, one pot
 * of lentil stew covers Friday and Saturday, so the useful unit here is a
 * cooking session with several recipes attached, not one meal at a time.
 *
 * Today first, then what is coming, then what has gone. A session that is
 * done says so in a word and a filled tick rather than by fading: a faded card
 * took its own text under the contrast floor.
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
   * how much: the pan is in front of you. Only on the way to done, and only
   * once: unticking is a correction, and a session that already produced
   * portions does not produce them again.
   */
  const complete = (session: CookSession) => {
    const already = portions.some((p) => p.sessionId === session.id)
    toggleComplete(session.id)
    if (!session.completed && !already && session.recipeIds.length) setCooked(session)
  }

  // Every recipe with ingredients can be batch-cooked.
  const batchable = recipes.filter((r) => r.components.length > 0)

  const now = today()
  const groups = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    return [
      { id: 'today', title: `Today, ${longDay(now)}`, sessions: sorted.filter((s) => s.date === now) },
      { id: 'ahead', title: 'Coming up', sessions: sorted.filter((s) => s.date > now) },
      { id: 'gone', title: 'Earlier', sessions: sorted.filter((s) => s.date < now).reverse() },
    ].filter((g) => g.sessions.length)
  }, [sessions, now])
  /** The next thing to cook: the first that is neither done nor already gone. */
  const next = useMemo(
    () => [...sessions]
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
      .find((s) => !s.completed && !overdue(s) && s.date >= now),
    [sessions, now],
  )

  const newSession = (
    <button type="button" className="btn-primary min-h-11" onClick={() => setAdding(true)}>
      <Plus size={16} aria-hidden="true" /> New cook session
    </button>
  )

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <PlanHeader
        actions={(
          <>
            <span className="text-sm text-ink-700">When you are cooking, and what goes in the pot</span>
            {newSession}
          </>
        )}
      />

      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-2.5 md:pt-4 flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
        <div role="region" aria-label="Cook sessions" className="flex-1 min-w-0 flex flex-col gap-2">
          {sessions.length === 0 ? (
            <EmptyState title="No cook sessions planned">
              Add one and pick the dishes you'll batch together.
            </EmptyState>
          ) : groups.map((g) => (
            <section key={g.id} aria-labelledby={`cook-${g.id}`} className="flex flex-col gap-1.5">
              <h2 id={`cook-${g.id}`} className="mt-0.5 text-base leading-6 font-extrabold text-ink-900">{g.title}</h2>
              <ul className="bg-paper border border-border-200 rounded-3xl overflow-hidden">
                {g.sessions.map((s, i) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    first={i === 0}
                    next={next?.id === s.id}
                    made={portions.filter((p) => p.sessionId === s.id).reduce((n, p) => n + p.servings, 0)}
                    onToggle={() => complete(s)}
                    onRemove={() => {
                      removeSession(s.id)
                      offerUndo(`Removed ${s.label || 'the cook session'}`, () => addSession(s))
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="md:w-[360px] md:shrink-0 flex flex-col gap-4">
          <AtTheStove sessions={sessions} />
          <FridgeList />
        </div>

        <div className="md:hidden [&>button]:w-full [&>button]:min-h-12">{newSession}</div>
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

/** "Sunday 8 Nov". */
function longDay(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} ${d.getDate()} ${
    d.toLocaleDateString('en-GB', { month: 'short' })}`
}

/**
 * One session: when, what, how much it makes, whether anyone will be nudged,
 * and a tick for when it is done.
 *
 * Its state is a word in a chip as well as a colour: done, up next, planned,
 * or gone by without being ticked.
 */
function SessionRow({ session: s, first, next, made, onToggle, onRemove }: {
  session: CookSession
  first: boolean
  next: boolean
  /** Portions this session put in the fridge, once it has. */
  made: number
  onToggle: () => void
  onRemove: () => void
}) {
  const ctx = useNutritionContext()
  const d = new Date(s.date + 'T12:00:00')
  const late = overdue(s)
  const names = s.recipeIds
    .map((id) => ctx.recipes.get(id))
    .filter((r) => r != null)
  const makes = useMemo(
    () => portionsFromSession(s.recipeIds, ctx.recipes, s.date, s.id).reduce((n, p) => n + p.servings, 0),
    [s.recipeIds, s.date, s.id, ctx.recipes],
  )
  const label = s.label || 'Cook session'

  const chip = s.completed
    ? { text: 'Done', tone: 'bg-leaf-50 text-leaf-700', icon: Check }
    : late ? { text: 'Time passed', tone: 'bg-coral-50 text-coral-700', icon: AlertTriangle }
      : next ? { text: 'Up next', tone: 'bg-bite-100 text-bite-700', icon: Clock }
        : { text: 'Planned', tone: 'bg-border-100 text-ink-700', icon: Circle }

  return (
    <li className={`flex items-start gap-3 py-2 pl-3.5 pr-1.5 ${first ? '' : 'border-t border-border-100'} ${
      next ? 'bg-bite-50' : ''}`}>
      <div className="w-10 shrink-0 flex flex-col items-center pt-0.5">
        <span className="text-xs font-bold text-ink-700">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
        <span className="text-lg leading-[22px] font-extrabold text-ink-900">{d.getDate()}</span>
        <span className="text-xs font-bold text-ink-700 tabular-nums">{s.time}</span>
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="text-[15px] leading-5 font-extrabold text-ink-900">{label}</h3>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${chip.tone}`}>
            <chip.icon size={12} aria-hidden="true" /> {chip.text}
          </span>
        </div>
        {names.length > 0 && (
          <p className="text-[13px] leading-[18px] text-ink-900">
            {names.map((r) => `${r.emoji} ${r.name.en}`).join(', ')}
          </p>
        )}
        {(s.completed ? made > 0 : makes > 0) && (
          <p className="text-xs leading-4 text-ink-700">
            {s.completed
              ? `Made ${made} ${made === 1 ? 'portion' : 'portions'}`
              : `Makes about ${makes} ${makes === 1 ? 'portion' : 'portions'}`}
          </p>
        )}
        {/* A reminder that can no longer fire, sitting in a list looking
            pending, is the app promising something it cannot do. A session
            that has gone says so instead. */}
        {s.remindAt && !s.completed && !late && (
          <p className="text-xs leading-4 text-ink-700 flex items-center gap-1">
            {/* Not "both phones": the household is however many people have
                signed in, and it reaches every device that allows it. */}
            <Bell size={12} aria-hidden="true" /> A nudge at {reminderLabel(s.remindAt)}, on every phone
            signed in.
          </p>
        )}
        {!s.remindAt && !s.completed && !late && (
          <p className="text-xs leading-4 text-ink-700 flex items-center gap-1">
            <BellOff size={12} aria-hidden="true" /> No reminder
          </p>
        )}
        {late && (
          <p className="text-xs leading-4 text-coral-700 flex items-center gap-1">
            <AlertTriangle size={12} aria-hidden="true" />
            {s.remindAt
              ? 'That time has passed, so no reminder is coming.'
              : 'That time has passed.'}
          </p>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-center">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={s.completed}
          aria-label={s.completed ? `Mark as not done: ${label}` : `Mark as done: ${label}`}
          className="w-11 h-11 inline-flex items-center justify-center"
        >
          <span className={`w-[26px] h-[26px] rounded-full flex items-center justify-center ${
            s.completed ? 'bg-leaf-500 text-white' : `bg-paper border-2 ${next ? 'border-bite-700' : 'border-ink-300'}`}`}>
            {s.completed && <Check size={15} strokeWidth={3} aria-hidden="true" />}
          </span>
        </button>
        <button
          type="button"
          className="w-11 h-11 inline-flex items-center justify-center rounded-xl text-ink-700 hover:text-coral-700"
          onClick={onRemove}
          aria-label="Remove session"
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}

/**
 * The week at the stove: how many sessions, how many portions they make, and
 * which days they fall on. A wide screen has the room; a phone has the list.
 */
function AtTheStove({ sessions }: { sessions: CookSession[] }) {
  const ctx = useNutritionContext()
  const week = useThisWeek()
  const inWeek = sessions.filter((s) => week.includes(s.date))
  const portions = inWeek.reduce(
    (n, s) => n + portionsFromSession(s.recipeIds, ctx.recipes, s.date, s.id).reduce((m, p) => m + p.servings, 0), 0)
  const most = Math.max(1, ...week.map((d) => inWeek.filter((s) => s.date === d).length))

  return (
    <section aria-labelledby="stove-h" className="hidden md:block bg-paper border border-border-200 rounded-3xl p-4">
      <h2 id="stove-h" className="text-base font-extrabold text-ink-900">This week at the stove</h2>
      <p className="mt-1 text-[13px] text-ink-700">
        {inWeek.length} {inWeek.length === 1 ? 'session' : 'sessions'}
        {portions > 0 && ` · about ${portions} ${portions === 1 ? 'portion' : 'portions'}`}. Cooks per day:
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {week.map((date) => {
          const n = inWeek.filter((s) => s.date === date).length
          const d = new Date(date + 'T12:00:00')
          return (
            <li key={date} className="flex items-center gap-2 text-xs">
              <span className="w-8 font-bold text-ink-700">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
              <span className="w-5 font-extrabold text-ink-900 tabular-nums">{d.getDate()}</span>
              <span className="flex-1 h-2 rounded-full bg-border-100 overflow-hidden">
                <span className="block h-full bg-leaf-500 rounded-full" style={{ width: `${(n / most) * 100}%` }} />
              </span>
              <span className="w-10 text-right font-bold text-ink-700">{n ? n : 'None'}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * What is cooked and waiting.
 *
 * On this screen rather than one of its own, because it answers the question
 * this screen exists for: whether you need to cook. Counts are editable here,
 * since the app cannot see the fridge and the number is a note to yourselves.
 * A tub gets here by being cooked: tick a session off and its portions land.
 */
function FridgeList() {
  const ctx = useNutritionContext()
  const available = useAvailablePortions()
  const { updatePortion, removePortion } = usePortionStore()

  if (!available.length) {
    return (
      <div className="rounded-2xl bg-leaf-50 px-3.5 py-2.5 min-h-[52px] flex items-center gap-2.5">
        <Refrigerator size={20} aria-hidden="true" className="shrink-0 text-leaf-700" />
        <p className="flex-1 min-w-0 text-[13px] text-ink-900">
          Nothing cooked and waiting. Tick a session off once you have cooked it and its
          portions land here.
        </p>
      </div>
    )
  }

  const total = available.reduce((n, p) => n + p.servings, 0)

  return (
    <section aria-labelledby="fridge-h" className="rounded-3xl bg-leaf-50 p-3.5">
      <div className="flex items-center gap-2.5 mb-1">
        <Refrigerator size={20} aria-hidden="true" className="shrink-0 text-leaf-700" />
        <h2 id="fridge-h" className="text-sm font-extrabold text-ink-900">
          In the fridge · {total} {total === 1 ? 'portion' : 'portions'}
        </h2>
      </div>

      <ul>
        {offerOrder(available).map((p) => (
          <li key={p.id} className="flex items-center gap-2 py-1">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink-900 truncate">
                {portionLabel(p, ctx.recipes)}
              </p>
              <p className="text-xs text-ink-700">
                {p.storage === 'freezer' ? 'Freezer, ' : ''}{madeWhen(p)}
                {p.source === 'leftover' ? ' · leftovers' : ''}
              </p>
            </div>
            <div className="flex items-center shrink-0">
              <button
                type="button"
                className="w-11 h-11 inline-flex items-center justify-center rounded-xl text-ink-700 hover:text-bite-700"
                onClick={() => updatePortion(p.id, { servings: Math.max(0, p.servings - 0.5) })}
                aria-label={`One fewer ${portionLabel(p, ctx.recipes)}`}
              >
                <Minus size={15} aria-hidden="true" />
              </button>
              <span className="text-sm font-extrabold text-ink-900 tabular-nums w-8 text-center">
                {p.servings}
              </span>
              <button
                type="button"
                className="w-11 h-11 inline-flex items-center justify-center rounded-xl text-ink-700 hover:text-bite-700"
                onClick={() => updatePortion(p.id, { servings: p.servings + 0.5 })}
                aria-label={`One more ${portionLabel(p, ctx.recipes)}`}
              >
                <Plus size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="w-11 h-11 inline-flex items-center justify-center rounded-xl text-ink-700 hover:text-coral-700"
                onClick={() => removePortion(p.id)}
                aria-label={`Remove ${portionLabel(p, ctx.recipes)}`}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-ink-700">Tick a session off and what it made lands here.</p>
    </section>
  )
}

function SessionDialog({
  recipes, onClose, onSave,
}: {
  recipes: ReturnType<typeof useRecipes>
  onClose: () => void
  onSave: (s: CookSession) => void
}) {
  const panel = useDialog<HTMLDivElement>(onClose)
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
        ref={panel}
        role="dialog"
        aria-modal="true"
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
            <SearchField
              placeholder="Search your recipes"
              aria-label="Search dishes"
              value={query}
              onChange={setQuery}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5">
          <div className="card-soft divide-y divide-border-200">
            {matches.planned.length > 0 && (
              <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-500 bg-cream-50">
                Planned this week
              </p>
            )}
            {matches.planned.map((r) => (
              <DishRow key={r.id} recipe={r} on={picked.includes(r.id)} onToggle={() => toggle(r.id)} />
            ))}

            {matches.rest.length > 0 && (
              <p className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-500 bg-cream-50">
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
 * What came out of the session, and where it went.
 *
 * Every number is already filled in, from what each recipe says it makes, so
 * the common case is reading it and pressing the button. Being able to change
 * them matters anyway: a batch is whatever fitted in the pan, and an app that
 * insists otherwise is wrong by Tuesday.
 */
function CookedDialog({ session, onClose }: { session: CookSession; onClose: () => void }) {
  const panel = useDialog<HTMLDivElement>(onClose)
  const ctx = useNutritionContext()
  const { addPortion, takeFrom } = usePortionStore()
  const { plan, addEntry } = useMealPlanStore()
  // Off by default, like everything else here that writes to the week. Fill
  // the gaps proposes and waits; a saved week asks twice. Cooking four
  // portions and finding the next four days planned without having asked is
  // the opposite of that, and it empties the fridge the moment it fills it.
  const [spread, setSpread] = useState(false)

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

  /**
   * Which days a batch lands on, and which meal it lands in.
   *
   * The week after the session, minus anything already gone, since a session
   * is often ticked off a day or two late and nothing can be planned into
   * Monday on Wednesday. Seven days was hardcoded, and so was dinner before
   * lunch, which is a fine default and a poor rule: a batch of soup is lunch
   * for most people, and cooking on a Sunday for a week away from home means
   * choosing the days.
   */
  const offered = useMemo(() => {
    const from = today()
    return Array.from({ length: 7 }, (_, i) => addDays(session.date, i + 1))
      .filter((d) => d >= from)
  }, [session.date])

  const [days, setDays] = useState<string[]>(offered)
  const [first, setFirst] = useState<'dinner' | 'lunch'>('dinner')
  const slots = useMemo<MealSlot[]>(
    () => (first === 'dinner' ? ['dinner', 'lunch'] : ['lunch', 'dinner']),
    [first],
  )

  // What ticking the box would actually do, worked out with the same function
  // that does it. There are usually fewer portions than days, and a day you
  // have already planned is skipped, so "put them in the days ahead" on its
  // own was a promise with no number attached to it.
  const landing = useMemo(
    () => spreadPortions(
      suggested
        .map((p) => ({ id: p.id, servings: made[p.id] ?? p.servings }))
        .filter((p) => p.servings > 0),
      plan, days, slots,
    ),
    [suggested, made, plan, days, slots],
  )

  function save() {
    const kept: { id: string; servings: number }[] = []
    for (const p of suggested) {
      const servings = made[p.id] ?? p.servings
      if (servings <= 0) continue
      addPortion({ ...p, servings, storage: storage[p.id] ?? 'fridge' })
      kept.push({ id: p.id, servings })
    }

    // Cooking four portions is the whole reason to have a cook schedule, and
    // the batch and the week used to be two screens that knew nothing about
    // each other: everything went in the fridge and you planned it back out
    // one slot at a time.
    if (spread) {
      for (const place of spreadPortions(kept, plan, days, slots)) {
        takeFrom(place.portionId, place.servings)
        addEntry(place.date, place.slot, {
          kind: 'portion', portionId: place.portionId, servings: place.servings,
        })
      }
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
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

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox" className="w-4 h-4 accent-bite-500 mt-0.5 shrink-0"
            checked={spread} onChange={() => setSpread(!spread)}
          />
          <span className="min-w-0">
            <span className="block text-sm text-ink-900">Put them in the days ahead</span>
            <span className="block text-xs text-ink-500">
              One a day. Days you have already planned are left as they are.
            </span>
          </span>
        </label>

        {spread && (
          <div className="card-soft p-3 space-y-3">
            <div>
              <p className="label">Which days</p>
              <div className="flex flex-wrap gap-1.5">
                {offered.map((date) => {
                  const on = days.includes(date)
                  const d = new Date(date + 'T12:00:00')
                  return (
                    <button
                      key={date}
                      onClick={() => setDays((all) =>
                        all.includes(date) ? all.filter((x) => x !== date) : [...all, date])}
                      aria-pressed={on}
                      aria-label={d.toLocaleDateString('en-GB', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })}
                      className={`text-xs px-2.5 py-2 rounded-lg border transition-colors ${
                        on ? 'bg-bite-500 border-bite-500 text-on-brand font-semibold'
                          : 'bg-paper border-border-200 text-ink-700 hover:border-bite-300'
                      }`}
                    >
                      {d.toLocaleDateString('en-GB', { weekday: 'short' })} {d.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="label">Which meal first</p>
              <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit">
                {(['dinner', 'lunch'] as const).map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setFirst(slot)}
                    className={`capitalize ${first === slot ? 'tab-on' : 'tab-off'}`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-ink-500">
              {landing.length === 0
                ? 'Nothing would land: either those days are already planned, or there is less than a whole portion to spread.'
                : `${landing.length} ${landing.length === 1 ? 'portion goes' : 'portions go'} into ${
                  new Set(landing.map((l) => l.date)).size} of those days. The rest stays in the fridge.`}
            </p>
          </div>
        )}

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
