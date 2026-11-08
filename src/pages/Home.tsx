import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Sparkles, Cloud, CloudOff, RefreshCw, AlertTriangle, Utensils, Activity,
} from 'lucide-react'
import { useMealPlanStore, today as todayDate } from '../store/useMealPlanStore'
import { useThisWeek } from '../store/useThisWeek'
import { useUserStore } from '../store/useUserStore'
import { useUiStore } from '../store/useUiStore'
import { useNutritionContext } from '../store/useNutrition'
import { useAuthStore, type Member } from '../store/useAuth'
import { useSyncStatus } from '../store/useSync'
import { useAvailablePortions } from '../store/usePortionStore'
import { keepMine, takeTheirs } from '../lib/sync'
import { useConflicts } from '../lib/rows/conflicts'
import { dayStanding, weekEaten } from '../lib/nutrition'
import type { MealSlot } from '../types'
import AddEntryModal from '../components/planner/AddEntryModal'
import { slotNow } from '../lib/whenDates'
import { dayCompleteness } from '../lib/completeness'
import { isConfigured } from '../lib/supabase'
import { MOMENTS } from '../lib/moments'
import { personName } from '../lib/people'
import Logo from '../components/brand/Logo'
import TodayHeaderActions from '../components/layout/TodayHeaderActions'
import { useWatchForMoments } from '../store/useMoments'
import { useRecipes } from '../store/useRecipeStore'
import { useCookStore } from '../store/useCookStore'
import { useBodyStore } from '../store/useBodyStore'
import { scoreWeek } from '../lib/mediterranean'
import { suggest } from '../lib/suggestions'
import { kitchenNudges } from '../lib/kitchen'
import { usePantry } from '../store/usePantryStore'
import { useDayMovement } from '../store/useActivityStore'
import { movementLabel, type DayMovement } from '../lib/movement'
import { usePeople, useResolvedPerson } from '../store/useHousehold'
import { slotRows, nextUp } from '../components/today/todayModel'
import { useSlotTicks } from '../components/today/useSlotTicks'
import DaySoFar from '../components/today/DaySoFar'
import NextUp from '../components/today/NextUp'
import TodayMeals from '../components/today/TodayMeals'
import WeekGlance from '../components/today/WeekGlance'
import MacrosSoFar from '../components/today/MacrosSoFar'
import TodoToday, { type TodoItem } from '../components/today/TodoToday'

/**
 * Today: what you land on.
 *
 * It answers three questions in order: where the day stands, what is next,
 * and what the rest of the app has waiting. The week, the ideas and the
 * household follow, and everything else is a way through to a screen that
 * does the work.
 *
 * One column on a phone, in that order. From xl the day's figures move to a
 * column of their own on the right, beside the meals they are made of. Each
 * column is a `contents` box below xl, so the phone's order is set once, with
 * `order`, rather than by drawing anything twice.
 */
export default function Home() {
  useWatchForMoments()
  const plan = useMealPlanStore((s) => s.plan)
  const recordEaten = useMealPlanStore((s) => s.recordEaten)
  // The week you are in, not the week the planner happens to be showing.
  const weekDates = useThisWeek()
  // Which meal an unplanned bite gets filed under, and on which day. Guessed
  // from the clock, stated on the sheet, and correctable there.
  const [ate, setAte] = useState<{ date: string; slot: MealSlot } | null>(null)
  const recipes = useRecipes()
  const sessions = useCookStore((s) => s.sessions)
  const { profile } = useUserStore()
  const people = usePeople()
  const viewingAs = useResolvedPerson(useUiStore((s) => s.viewingAs))
  const targets = profile.targets
  const portions = useAvailablePortions()
  const groceryItems = useMealPlanStore((s) => s.groceryItems)
  const pantry = usePantry()
  const ctx = useNutritionContext()
  const members = useAuthStore((s) => s.members)
  const me = useAuthStore((s) => s.user)
  const weight = useWeightTodo()

  const today = todayDate()
  const todayPlan = plan.find((d) => d.date === today)
  // Where today has got to: what has been had, and what is still to come.
  // They add up to the day's total exactly, see dayStanding.
  const standing = todayPlan ? dayStanding(todayPlan, ctx) : null
  // How many of today's entries the figures are fully sure of. See
  // lib/completeness.ts: the same rule as the `+` floor on the planner.
  const todayKnown = todayPlan ? dayCompleteness(todayPlan, ctx) : null
  const rows = useMemo(() => slotRows(todayPlan, ctx), [todayPlan, ctx])
  const next = nextUp(rows)
  const ticks = useSlotTicks(today)
  // What you did today, which every screen about today had never heard of.
  const movedToday = useDayMovement(viewingAs, today)
  const iAte = () => setAte({ date: todayDate(), slot: slotNow() })

  /**
   * This week, and only this week, as what each day came to.
   *
   * It used to be the whole plan against a hardcoded "of 7", so a fortnight
   * planned ahead read "14 of 7". The number has to be true of the week you
   * are standing in.
   */
  const week = useMemo(() => weekEaten(weekDates, plan, ctx).days, [weekDates, plan, ctx])
  const plannedDays = week.filter((d) => d.nutrients.calories > 0).length
  const average = plannedDays
    ? Math.round(week.reduce((a, d) => a + d.nutrients.calories, 0) / plannedDays)
    : 0

  /** The days of this week, for the guide's scoring. */
  const weekPlan = useMemo(
    () => plan.filter((d) => weekDates.includes(d.date)),
    [plan, weekDates],
  )

  /**
   * How much of the guide the week keeps to, as one number.
   *
   * Only the goals you have to reach. A ceiling is met by eating nothing, and
   * counting those made an empty week report a quarter of the guide achieved.
   */
  const mediterranean = useMemo(() => {
    const goals = scoreWeek(weekPlan, ctx).filter((g) => !g.isLimit)
    return { met: goals.filter((g) => g.ratio >= 0.9).length, of: goals.length }
  }, [weekPlan, ctx])

  const nextCook = useMemo(
    () => sessions.filter((s) => !s.completed && s.date >= today)
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0],
    [sessions, today],
  )

  /**
   * What the kitchen has to say, and then what the week has to say.
   *
   * Capped at four between them. Today is where you land, and a screen that
   * raises five things is a screen people learn to scroll past, which costs
   * the one thing that actually needed saying.
   */
  const nudges = useMemo(
    () => kitchenNudges({
      days: weekPlan, ctx, today, portions, sessions, groceryItems, pantry,
    }),
    [weekPlan, ctx, today, portions, sessions, groceryItems, pantry],
  )

  const ideas = useMemo(
    () => suggest({ days: weekPlan, recipes, ctx, today }),
    [weekPlan, recipes, ctx, today],
  )

  const shown = useMemo(
    () => [
      ...nudges.map((n) => ({ id: n.id, title: n.title, reason: n.detail, to: n.to, urgent: n.rank <= 20 })),
      ...ideas.map((i) => ({ id: i.id, title: i.title, reason: i.reason, to: i.to, urgent: false })),
    ].slice(0, 4),
    [nudges, ideas],
  )

  /**
   * What the old tiles said, as things to do: the next cook, the list, what is
   * already cooked, and whoever is keeping a weight log.
   */
  const todo: TodoItem[] = []
  if (nextCook) {
    const when = nextCook.date === today
      ? 'Cook at'
      : `Cook ${new Date(nextCook.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}`
    const n = nextCook.recipeIds.length
    todo.push({
      id: 'cook', icon: 'cook', eyebrow: `${when} ${nextCook.time}`, title: nextCook.label,
      detail: `${n} ${n === 1 ? 'recipe' : 'recipes'}`, to: '/plan/cooking',
    })
  }
  if (groceryItems.length) {
    const left = groceryItems.filter((g) => !g.checked).length
    todo.push({
      id: 'grocery', icon: 'grocery', eyebrow: 'Grocery',
      title: left ? `${left} ${left === 1 ? 'item' : 'items'} left` : 'All ticked off',
      detail: `${groceryItems.length} on the list`, to: '/plan/grocery',
    })
  }
  if (portions.length) {
    const servings = portions.reduce((n, p) => n + p.servings, 0)
    todo.push({
      id: 'fridge', icon: 'fridge', eyebrow: 'In the fridge',
      title: `${servings} ${servings === 1 ? 'portion' : 'portions'}`,
      detail: portions.length === 1 ? 'of one thing' : `of ${portions.length} things`,
      to: '/plan/cooking',
    })
  }
  todo.push(weight)

  const at = new Date(today + 'T12:00:00')
  const dateLong = at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const dateShort = at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })

  const mealsFooter = (
    <div className="flex flex-wrap gap-x-2">
      <button type="button" className="btn-ghost text-bite-700 min-h-11 px-2" onClick={iAte}>
        <Utensils size={15} aria-hidden="true" /> I ate something else
      </button>
      <Link to="/plan/week" className="btn-ghost text-bite-700 min-h-11 px-2">
        Open the planner <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 xl:px-8 pb-6">

        <header className="flex items-center gap-3 min-h-16 xl:min-h-[72px]">
          {/* The phone has no top bar, so Today carries the mark. */}
          <Logo variant="mark" size={30} className="md:hidden shrink-0" />
          <div className="min-w-0 flex-1 flex flex-col">
            <h1 className="text-xl leading-6 xl:text-2xl xl:leading-8 font-extrabold text-ink-900">
              <span className="sm:hidden">{dateShort}</span>
              <span className="hidden sm:inline">{dateLong}</span>
            </h1>
            {people.length > 1 && (
              <p className="text-xs leading-4 text-ink-700">
                Showing: <span className="font-bold text-ink-900">{personName(people, viewingAs)}</span>
              </p>
            )}
          </div>
          <TodayHeaderActions />
        </header>

        <div className="flex flex-col gap-3.5 xl:gap-6 pt-1 xl:pt-4">
          <MomentNote />

          <div className="flex flex-col gap-3.5 xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-6 xl:items-start">
            <div className="contents xl:flex xl:flex-col xl:gap-6 xl:min-w-0">
              {next && (
                <div className="max-xl:order-2">
                  <NextUp row={next} onEaten={() => ticks.markEaten(next)} />
                </div>
              )}
              <div className="max-xl:order-3">
                {rows.length ? (
                  <TodayMeals
                    rows={rows} next={next} onEaten={ticks.markEaten} onUndo={ticks.unmark} footer={mealsFooter}
                  />
                ) : (
                  <NothingPlanned onAte={iAte} />
                )}
              </div>
              <div className="max-xl:order-5">
                <WeekGlance
                  days={week}
                  today={today}
                  target={targets.calories}
                  plannedDays={plannedDays}
                  average={average}
                  guide={mediterranean}
                />
              </div>
              {shown.length > 0 && (
                <div className="max-xl:order-6">
                  <Ideas shown={shown} />
                </div>
              )}
            </div>

            <div className="contents xl:flex xl:flex-col xl:gap-5 xl:min-w-0">
              <div className="max-xl:order-1 flex flex-col gap-3.5 xl:gap-5">
                <DaySoFar
                  had={standing?.had.calories ?? 0}
                  ahead={standing?.ahead.calories ?? 0}
                  protein={standing?.had.protein ?? 0}
                  target={targets.calories}
                  rows={rows}
                  known={todayKnown}
                />
                <MovedToday movement={movedToday} />
              </div>
              {standing && (
                <MacrosSoFar had={standing.had} targets={targets} className="hidden xl:block" />
              )}
              <div className="max-xl:order-4">
                <TodoToday items={todo} />
              </div>
              {isConfigured && (
                <div className="max-xl:order-7">
                  <Household members={members} me={me?.id} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {ate && (
        <AddEntryModal
          date={ate.date}
          slot={ate.slot}
          mode="ate"
          onSlotChange={(slot) => setAte({ ...ate, slot })}
          onDateChange={(date) => setAte({ ...ate, date })}
          onClose={() => setAte(null)}
          onAdd={(entry) => recordEaten(ate.date, ate.slot, entry)}
        />
      )}
    </div>
  )
}

/** A day with nothing on it: three ways to put something there. */
function NothingPlanned({ onAte }: { onAte: () => void }) {
  return (
    <section aria-labelledby="today-meals-h" className="flex flex-col gap-1.5 xl:gap-2">
      <h2 id="today-meals-h" className="text-base leading-6 font-extrabold text-ink-900">Today's meals</h2>
      <div className="bg-paper border border-border-200 rounded-card p-5 text-center space-y-3">
        <p className="font-semibold text-ink-900">Nothing planned for today yet.</p>
        <p className="text-sm text-ink-700">
          Start from scratch, or load one of the weeks your dietician wrote.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Link to="/plan/week" className="btn-primary">Plan today</Link>
          <button type="button" className="btn-secondary" onClick={onAte}>
            <Utensils size={15} aria-hidden="true" /> I ate something
          </button>
          <Link to="/settings/history" className="btn-secondary">Load a week</Link>
        </div>
      </div>
    </section>
  )
}

/**
 * Ideas, every one grounded in the plan or the guide. Kept to four: see the
 * cap where they are chosen.
 */
function Ideas({ shown }: { shown: { id: string; title: string; reason: string; to: string; urgent: boolean }[] }) {
  return (
    <section aria-labelledby="ideas-h" className="flex flex-col gap-1.5 xl:gap-2">
      <h2 id="ideas-h" className="text-base leading-6 font-extrabold text-ink-900">Worth a thought</h2>
      <div className="bg-paper border border-border-200 rounded-card overflow-hidden divide-y divide-border-100">
        {shown.map((idea) => (
          <Link
            key={idea.id}
            to={idea.to}
            className="flex items-start gap-3 px-4 py-3 min-h-11 hover:bg-bite-50 transition-colors"
          >
            <Sparkles
              size={16}
              aria-hidden="true"
              className={`shrink-0 mt-0.5 ${idea.urgent ? 'text-mustard-700' : 'text-bite-700'}`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-ink-900">{idea.title}</p>
              <p className="text-xs text-ink-700 mt-0.5">{idea.reason}</p>
            </div>
            <ArrowRight size={15} aria-hidden="true" className="text-ink-300 shrink-0 mt-0.5" />
          </Link>
        ))}
      </div>
      <p className="text-xs text-ink-700 px-1">
        All from your own library and your dietician's guide. Nothing here is invented.
      </p>
    </section>
  )
}

/** Who has signed in, when they were last here, and whether your copies agree. */
function Household({ members, me }: { members: Member[]; me?: string }) {
  const others = members.filter((m) => m.id !== me)
  return (
    <section aria-labelledby="here-h" className="flex flex-col gap-1.5 xl:gap-2">
      <h2 id="here-h" className="text-base leading-6 font-extrabold text-ink-900">Who's here</h2>
      <div className="bg-paper border border-border-200 rounded-card overflow-hidden divide-y divide-border-100">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <span className="w-9 h-9 rounded-full bg-bite-100 text-bite-700 grid place-items-center font-bold text-sm shrink-0">
              {(m.display_name || m.email).slice(0, 1).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900">
                {m.display_name || m.email}
                {m.id === me && <span className="ml-2 text-xs font-normal text-ink-500">you</span>}
              </p>
              <p className="text-xs text-ink-500">Last here {relative(m.last_seen_at)}</p>
            </div>
          </div>
        ))}
        {!others.length && (
          <p className="px-4 py-3 text-sm text-ink-500">
            Nobody else has signed in yet. They'll appear here once they open their link.
          </p>
        )}
      </div>
      <SyncLine />
    </section>
  )
}

/**
 * What you did today, said beside the day rather than folded into it.
 *
 * The Movement screen has costed sessions for months and no other screen had
 * ever mentioned one, so an hour of cycling was recorded and then invisible
 * everywhere you would look for it.
 *
 * It does not move the target, and it says so. Two reasons, and the second is
 * the one that matters: the estimate is loose enough that treating it as
 * spendable would be a licence rather than a measurement, and the calorie
 * figure the app measures a day against came from the dietician's own plans,
 * which were written for two people who already move. Adding a bonus on top
 * would count the same hour twice and hand back four hundred calories nobody
 * prescribed.
 */
function MovedToday({ movement }: { movement: DayMovement }) {
  const said = movementLabel(movement)
  // Nothing logged is nothing to report. An empty row saying "0 min" reads as
  // a reproach, which is not this app's business.
  if (!said) return null

  return (
    <div className="bg-paper border border-border-200 rounded-lg p-3 flex items-start gap-3">
      <Activity size={16} className="text-leaf-700 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm text-ink-900">
          <span className="font-semibold">Moved today</span>
          {' · '}
          <span className="font-mono tabular-nums">{said}</span>
        </p>
        <p className="text-xs text-ink-700">
          {movement.kcal == null
            ? 'No weight recorded yet, so there is no calorie estimate for it.'
            : movement.estimated
              ? 'An estimate, and not added to your target: the plans were written for days you move.'
              : 'Not added to your target: the plans were written for days you move.'}
        </p>
      </div>
    </div>
  )
}

/**
 * The weight entry on the to-do list.
 *
 * Whoever weighed in most recently, since a shared screen should show whoever
 * is actually keeping a log rather than an empty box for the person who is
 * not.
 */
function useWeightTodo(): TodoItem {
  const weights = useBodyStore((s) => s.weightEntries)
  const people = usePeople()

  const latest = people
    .map((p) => {
      const mine = weights.filter((w) => w.memberId === p.id)
      return { person: p, entries: mine, last: mine[mine.length - 1] }
    })
    .filter((x) => x.last)
    .sort((a, b) => (b.last?.date ?? '').localeCompare(a.last?.date ?? ''))[0]

  if (!latest?.last) {
    return { id: 'weight', icon: 'weight', eyebrow: 'Weight', title: 'Nothing logged', detail: 'Tap to add one', to: '/progress' }
  }

  const first = latest.entries[0]
  const change = latest.last.weight - first.weight
  return {
    id: 'weight',
    icon: 'weight',
    eyebrow: latest.person.name,
    title: `${latest.last.weight} ${latest.last.unit}`,
    detail: latest.entries.length > 1
      ? `${change > 0 ? '+' : ''}${change.toFixed(1)} since ${new Date(first.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
      : 'First entry',
    to: '/progress',
  }
}

/**
 * One thing the app noticed, shown once.
 *
 * Above everything else so it is the first thing you see, and gone the moment
 * you acknowledge it. There is no history to browse and no total to admire,
 * see lib/moments.ts for why that is the point.
 */
function MomentNote() {
  const { unseenMoment, markMomentSeen } = useUserStore()
  const moment = unseenMoment()
  if (!moment) return null

  const definition = MOMENTS[moment.kind]
  if (!definition) return null

  return (
    <div className="rounded-card p-4 flex items-start gap-3 border border-bite-200 bg-bite-50">
      <Logo variant="mark" size={32} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink-900 text-sm">{definition.title}</p>
        <p className="text-sm text-ink-700 mt-0.5">{definition.note}</p>
      </div>
      <button
        type="button"
        className="btn-ghost shrink-0 text-ink-700"
        onClick={() => markMomentSeen(moment.kind)}
      >
        Lovely
      </button>
    </div>
  )
}

/**
 * Edits that clashed: both of you changed the same thing before your copies
 * met. This device's version was kept and sent; the other person's is held
 * here so it can be brought back, one at a time or not at all.
 */
function ConflictList() {
  const conflicts = useConflicts((s) => s.items)
  if (!conflicts.length) return null

  const one = conflicts.length === 1
  return (
    <div className="mt-2 px-1 text-xs text-mustard-700" role="status">
      <p className="flex items-start gap-2">
        <AlertTriangle size={14} className="shrink-0 mt-px" aria-hidden="true" />
        <span>
          {one
            ? `You and someone else both changed ${conflicts[0].label}. Your version was kept; theirs is saved here.`
            : `You and someone else both changed ${conflicts.length} things. Your versions were kept; theirs are saved here.`}
        </span>
      </p>
      <ul className="mt-1 ml-6 flex flex-col gap-1">
        {conflicts.map((c) => (
          <li key={c.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {!one && <span className="text-ink-700">{c.label}</span>}
            <button className="underline" onClick={() => takeTheirs(c.key)}>
              Use theirs{one ? '' : <span className="sr-only"> for {c.label}</span>}
            </button>
            <button className="underline" onClick={() => keepMine(c.key)}>
              Keep mine{one ? '' : <span className="sr-only"> for {c.label}</span>}
            </button>
          </li>
        ))}
      </ul>
      {!one && (
        <button className="underline ml-6 mt-1" onClick={() => keepMine()}>
          Keep all of mine
        </button>
      )}
    </div>
  )
}

function SyncLine() {
  const { state, at, unsaved, lastError } = useSyncStatus()

  // Unsaved changes outrank everything else: it is the only state where what
  // you are looking at is not what the other person will see.
  const [Icon, text, tone] =
    unsaved
      ? [CloudOff,
         `${unsaved} ${unsaved === 1 ? 'change' : 'changes'} not saved yet, kept on this device and retried automatically.`,
         'text-mustard-700']
    : state === 'live'
      ? [Cloud, at ? `Everything shared · last synced ${timeOf(at)}` : 'Everything shared', 'text-leaf-600']
    : state === 'connecting'
      ? [RefreshCw, 'Connecting…', 'text-ink-500']
    : state === 'error'
      ? [AlertTriangle,
         lastError
           ? `The server turned the last write down: ${lastError}. Your changes are safe on this device.`
           : "Can't reach the server. Your changes are safe here and will go up when it's back.",
         'text-coral-600']
    : [CloudOff, 'Working offline on this device only.', 'text-ink-500']

  return (
    <>
      <ConflictList />
      <p className={`flex items-start gap-2 mt-2 px-1 text-xs ${tone}`}>
        <Icon size={14} className="shrink-0 mt-px" /> {text}
      </p>
    </>
  )
}

function timeOf(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function relative(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}
