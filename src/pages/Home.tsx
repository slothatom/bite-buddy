import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays, ShoppingBasket, BookOpen, ArrowRight, Sparkles,
  Cloud, CloudOff, RefreshCw, AlertTriangle, CookingPot, Scale,
} from 'lucide-react'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useUserStore } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import { useAuthStore } from '../store/useAuth'
import { useSyncStatus } from '../store/useSync'
import { useAvailablePortions } from '../store/usePortionStore'
import { acknowledgeConflicts } from '../lib/sync'
import { dayNutrients, componentsNutrients } from '../lib/nutrition'
import { targetStatus, STATUS_STYLES } from '../lib/status'
import { MEAL_SLOTS, SLOT_LABELS } from '../types'
import { CalorieRing, SectionHeading } from '../components/ui'
import { isConfigured } from '../lib/supabase'
import Zig from '../components/brand/Mascot'
import { MOMENTS } from '../lib/moments'
import { useWatchForMoments } from '../store/useMoments'
import { useRecipes } from '../store/useRecipeStore'
import { useCookStore } from '../store/useCookStore'
import { useBodyStore } from '../store/useBodyStore'
import { scoreWeek } from '../lib/mediterranean'
import { suggest } from '../lib/suggestions'
import { kitchenNudges } from '../lib/kitchen'
import { usePantry } from '../store/usePantryStore'
import { PEOPLE } from '../lib/people'

/**
 * The welcome screen, what you land on, before the planner.
 *
 * It answers three questions in order: what am I eating today, how is the week
 * going, and is the other person's copy the same as mine. Everything else is a
 * way through to a screen that does the work.
 */
export default function Home() {
  useWatchForMoments()
  const { plan, weekDates } = useMealPlanStore()
  const recipes = useRecipes()
  const sessions = useCookStore((s) => s.sessions)
  const { profile } = useUserStore()
  const portions = useAvailablePortions()
  const groceryItems = useMealPlanStore((s) => s.groceryItems)
  const pantry = usePantry()
  const ctx = useNutritionContext()
  const members = useAuthStore((s) => s.members)
  const me = useAuthStore((s) => s.user)

  const today = new Date().toISOString().slice(0, 10)
  const todayPlan = plan.find((d) => d.date === today)
  const todayTotals = todayPlan ? dayNutrients(todayPlan, ctx) : null

  const days = useMemo(
    () => plan.map((d) => ({ date: d.date, kcal: dayNutrients(d, ctx).calories })),
    [plan, ctx],
  )
  const plannedDays = days.filter((d) => d.kcal > 0).length
  const others = members.filter((m) => m.id !== me?.id)

  /** The days of this week, for the guide's scoring. */
  const weekPlan = useMemo(
    () => plan.filter((d) => weekDates.includes(d.date)),
    [plan, weekDates],
  )

  // How much of the guide the week keeps to, as one number. Limit categories
  // count when you are under them, everything else when you are over.
  const mediterranean = useMemo(() => {
    const scored = scoreWeek(weekPlan, ctx)
    const met = scored.filter((g) => (g.isLimit ? g.ratio <= 1 : g.ratio >= 0.9)).length
    return { met, of: scored.length }
  }, [weekPlan, ctx])

  /** The last fortnight, so a trend has something to be a trend of. */
  const fortnight = useMemo(() => {
    const from = new Date(today + 'T12:00:00')
    from.setDate(from.getDate() - 13)
    const start = from.toISOString().slice(0, 10)
    const out: { date: string; kcal: number }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(start + 'T12:00:00')
      d.setDate(d.getDate() + i)
      const date = d.toISOString().slice(0, 10)
      const day = plan.find((p) => p.date === date)
      out.push({ date, kcal: day ? dayNutrients(day, ctx).calories : 0 })
    }
    return out
  }, [plan, ctx, today])

  const nextCook = useMemo(
    () => sessions.filter((s) => !s.completed && s.date >= today)
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))[0],
    [sessions, today],
  )

  /**
   * What the kitchen has to say, and then what the week has to say.
   *
   * Two sources on purpose. The kitchen ones are about now: something cooked
   * and unclaimed, a session tomorrow missing an ingredient, a list that no
   * longer matches the plan. The week ones are about balance, which matters and
   * never matters today.
   *
   * Capped at four between them. Home is where you land, and a screen that
   * raises five things is a screen people learn to scroll past, which costs the
   * one thing that actually needed saying.
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

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <MomentNote />

        <header className="flex items-start gap-4">
          <Zig mood={plannedDays ? 'happy' : 'thinking'} size={58} />
          <div className="min-w-0">
            <h1 className="display text-xl sm:text-2xl text-ink-900">{greeting()}{profile.name ? `, ${profile.name}` : ''}</h1>
            <p className="text-sm text-ink-700">
              {new Date(today + 'T12:00:00').toLocaleDateString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </p>
          </div>
        </header>

        {/* ─── At a glance ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Tile
            label="Today"
            value={todayTotals?.calories ? Math.round(todayTotals.calories).toLocaleString() : '0'}
            unit="kcal"
            note={`of ${profile.targets.calories.toLocaleString()}`}
          />
          <Tile
            label="This week"
            value={`${plannedDays}`}
            unit="of 7"
            note="days planned"
          />
          <Tile
            label="Mediterranean"
            value={`${mediterranean.met}`}
            unit={`of ${mediterranean.of}`}
            note="of the guide's goals"
            to="/analytics"
          />
          {/* What is already cooked outranks what is planned to be: it is the
              thing that changes what you do in the next hour. */}
          {portions.length ? (
            <Tile
              label="In the fridge"
              value={`${portions.reduce((n, p) => n + p.servings, 0)}`}
              unit={portions.length === 1 ? 'portion' : 'portions'}
              note={portions.length === 1 ? 'of one thing' : `of ${portions.length} things`}
              icon={CookingPot}
              to="/schedule"
            />
          ) : nextCook ? (
            <Tile
              label="Next cook"
              value={new Date(nextCook.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}
              unit={nextCook.time}
              note={nextCook.label}
              icon={CookingPot}
              to="/schedule"
            />
          ) : (
            <WeightTile />
          )}
        </div>

        {/* Today and the week, side by side from lg. They are read together,
            "what am I eating" and "how is the week going", and stacking them
            put the second one below the fold on every laptop. */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-6 lg:space-y-0 lg:items-start">

        {/* ─── Today ───────────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>Today</SectionHeading>
          {todayTotals && todayTotals.calories > 0 ? (
            <div className="card p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <CalorieRing value={todayTotals.calories} target={profile.targets.calories} />
                <div className="flex-1 w-full space-y-1.5">
                  {MEAL_SLOTS.map((slot) => {
                    const meals = todayPlan?.meals.filter((m) => m.slot === slot) ?? []
                    if (!meals.length) return null
                    const kcal = componentsNutrients(meals.flatMap((m) => m.entries), ctx).calories
                    return (
                      <div key={slot} className="flex items-baseline gap-2 text-sm">
                        <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-ink-500">
                          {SLOT_LABELS[slot]}
                        </span>
                        <span className="flex-1 min-w-0 text-ink-900">
                          {meals.flatMap((m) => m.entries).map((e) => label(e, ctx)).join(', ')}
                        </span>
                        <span className="shrink-0 text-xs font-mono text-ink-700 tabular-nums">
                          {Math.round(kcal)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <Link to="/plan" className="btn-secondary w-fit">
                Open the planner <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div className="card p-5 text-center space-y-3">
              <p className="font-semibold text-ink-900">Nothing planned for today yet.</p>
              <p className="text-sm text-ink-700">
                Start from scratch, or load one of the 14 weeks your dietician wrote.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link to="/plan" className="btn-primary">Plan today</Link>
                <Link to="/settings/history" className="btn-secondary">Load a week</Link>
              </div>
            </div>
          )}
        </section>

        {/* ─── The week ────────────────────────────────────────────────────── */}
        <section>
          <SectionHeading>This week</SectionHeading>
          <div className="card p-5 space-y-4">
            <p className="text-sm text-ink-700">
              <strong className="font-mono text-ink-900">{plannedDays}</strong> of 7 days planned
              {plannedDays > 0 && (
                <> · averaging{' '}
                  <strong className="font-mono text-ink-900">
                    {Math.round(days.reduce((a, d) => a + d.kcal, 0) / plannedDays)}
                  </strong>{' '}
                  kcal against a target of {profile.targets.calories.toLocaleString()}
                </>
              )}
            </p>

            {/* A fortnight rather than a week: seven bars is a snapshot, two
                weeks is the first length at which a habit is visible. */}
            <div className="flex items-end gap-1 h-16">
              {fortnight.map(({ date, kcal }) => {
                const peak = Math.max(profile.targets.calories, ...fortnight.map((d) => d.kcal), 1)
                const status = targetStatus(kcal, profile.targets.calories)
                return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div
                      title={`${new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: ${Math.round(kcal)} kcal`}
                      className={`w-full rounded-t transition-all ${kcal > 0 ? STATUS_STYLES[status.level].fill : 'bg-border-100'}`}
                      style={{ height: `${kcal > 0 ? Math.max((kcal / peak) * 100, 6) : 6}%` }}
                    />
                    <span className={`text-[10px] leading-none ${date === today ? 'font-bold text-ink-900' : 'text-ink-500'}`}>
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'narrow' })}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link to="/plan" className="btn-secondary"><CalendarDays size={15} /> Planner</Link>
              <Link to="/grocery" className="btn-secondary"><ShoppingBasket size={15} /> Grocery list</Link>
              <Link to="/recipes" className="btn-secondary"><BookOpen size={15} /> Recipes</Link>
            </div>
          </div>
        </section>

        </div>

        {/* ─── Ideas ───────────────────────────────────────────────────────── */}
        {shown.length > 0 && (
          <section>
            <SectionHeading>Worth a thought</SectionHeading>
            <div className="card divide-y divide-border-100">
              {shown.map((idea) => (
                <Link
                  key={idea.id}
                  to={idea.to}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-cream-50 transition-colors"
                >
                  <Sparkles
                    size={16}
                    className={`shrink-0 mt-0.5 ${idea.urgent ? 'text-mustard-600' : 'text-bite-600'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900">{idea.title}</p>
                    <p className="text-xs text-ink-700 mt-0.5">{idea.reason}</p>
                  </div>
                  <ArrowRight size={15} className="text-ink-300 shrink-0 mt-0.5" />
                </Link>
              ))}
            </div>
            <p className="text-xs text-ink-500 mt-2 px-1">
              All from your own library and your dietician's guide. Nothing here is invented.
            </p>
          </section>
        )}

        {/* ─── The household ───────────────────────────────────────────────── */}
        {isConfigured && (
          <section>
            <SectionHeading>Who's here</SectionHeading>
            <div className="card divide-y divide-border-100">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-9 h-9 rounded-full bg-bite-100 text-bite-700 grid place-items-center font-bold text-sm shrink-0">
                    {(m.display_name || m.email).slice(0, 1).toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-900">
                      {m.display_name || m.email}
                      {m.id === me?.id && <span className="ml-2 text-xs font-normal text-ink-500">you</span>}
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
        )}
      </div>
    </div>
  )
}

/**
 * One number, big enough to read while walking past.
 *
 * The dashboard's job is to be glanceable: four of these answer "am I on
 * track" without reading a sentence. Anything that needs a sentence belongs
 * further down the page.
 */
function Tile({
  label, value, unit, note, icon: Icon, to,
}: {
  label: string
  value: string
  unit?: string
  note?: string
  icon?: typeof CalendarDays
  to?: string
}) {
  const body = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500 flex items-center gap-1">
        {Icon && <Icon size={12} />} {label}
      </p>
      <p className="text-xl font-extrabold text-ink-900 leading-tight mt-0.5">
        {value}
        {unit && <span className="text-xs font-semibold text-ink-500 ml-1">{unit}</span>}
      </p>
      {note && <p className="text-[11px] text-ink-500 truncate">{note}</p>}
    </>
  )

  return to
    ? <Link to={to} className="card p-3 min-w-0 hover:border-bite-300 transition-colors">{body}</Link>
    : <div className="card p-3 min-w-0">{body}</div>
}

/**
 * The fourth tile when no cook session is coming up.
 *
 * Whoever weighed in most recently, since a shared screen should show whoever
 * is actually keeping a log rather than an empty box for the person who is
 * not.
 */
function WeightTile() {
  const weights = useBodyStore((s) => s.weightEntries)

  const latest = PEOPLE
    .map((p) => {
      const mine = weights.filter((w) => w.memberId === p.id)
      return { person: p, entries: mine, last: mine[mine.length - 1] }
    })
    .filter((x) => x.last)
    .sort((a, b) => (b.last?.date ?? '').localeCompare(a.last?.date ?? ''))[0]

  if (!latest?.last) {
    return (
      <Link to="/analytics" className="card p-3 min-w-0 hover:border-bite-300 transition-colors">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500 flex items-center gap-1">
          <Scale size={12} /> Weight
        </p>
        <p className="text-sm font-semibold text-ink-700 leading-tight mt-1">Nothing logged</p>
        <p className="text-[11px] text-ink-500">Tap to add one</p>
      </Link>
    )
  }

  const first = latest.entries[0]
  const change = latest.last.weight - first.weight

  return (
    <Link to="/analytics" className="card p-3 min-w-0 hover:border-bite-300 transition-colors">
      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-500 flex items-center gap-1">
        <Scale size={12} /> {latest.person.name}
      </p>
      <p className="text-xl font-extrabold text-ink-900 leading-tight mt-0.5">
        {latest.last.weight}
        <span className="text-xs font-semibold text-ink-500 ml-1">{latest.last.unit}</span>
      </p>
      <p className="text-[11px] text-ink-500 truncate">
        {latest.entries.length > 1
          ? `${change > 0 ? '+' : ''}${change.toFixed(1)} since ${new Date(first.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
          : 'first entry'}
      </p>
    </Link>
  )
}

/**
 * One thing Zig noticed, shown once.
 *
 * Above the greeting so it is the first thing you see, and gone the moment you
 * acknowledge it. There is no history to browse and no total to admire, see
 * lib/moments.ts for why that is the point.
 */
function MomentNote() {
  const { unseenMoment, markMomentSeen } = useUserStore()
  const moment = unseenMoment()
  if (!moment) return null

  const definition = MOMENTS[moment.kind]
  if (!definition) return null

  return (
    <div className="card p-4 flex items-start gap-3 border-bite-200 bg-bite-50">
      <Zig mood={definition.mood} size={44} />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink-900 text-sm">{definition.title}</p>
        <p className="text-sm text-ink-700 mt-0.5">{definition.note}</p>
      </div>
      <button
        className="btn-ghost shrink-0 text-ink-500"
        onClick={() => markMomentSeen(moment.kind)}
      >
        Lovely
      </button>
    </div>
  )
}

function SyncLine() {
  const { state, at, unsaved, conflicts, lastError } = useSyncStatus()

  // Unsaved changes outrank everything else: it is the only state where what
  // you are looking at is not what the other person will see.
  const [Icon, text, tone] =
    conflicts.length
      ? [AlertTriangle,
         `You and someone else both changed ${conflicts.length === 1 ? formatDay(conflicts[0]) : `${conflicts.length} days`}. The later edit was kept. Worth a look.`,
         'text-mustard-700']
    : unsaved
      ? [CloudOff,
         `${unsaved} ${unsaved === 1 ? 'change' : 'changes'} not saved yet, kept on this device and retried automatically.`,
         'text-mustard-700']
    : state === 'live'
      ? [Cloud, at ? `Everything shared · last synced ${timeOf(at)}` : 'Everything shared', 'text-teal-600']
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
    <p className={`flex items-start gap-2 mt-2 px-1 text-xs ${tone}`}>
      <Icon size={14} className="shrink-0 mt-px" /> {text}
      {conflicts.length > 0 && (
        <button className="underline shrink-0" onClick={() => acknowledgeConflicts()}>
          Dismiss
        </button>
      )}
    </p>
  )
}

function formatDay(date: string): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long' })
}

function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
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

function label(entry: { kind: string; recipeId?: string; foodId?: string },
  ctx: ReturnType<typeof useNutritionContext>): string {
  return entry.kind === 'recipe'
    ? ctx.recipes.get(entry.recipeId ?? '')?.name.en ?? 'Unknown'
    : ctx.foods.get(entry.foodId ?? '')?.names.en ?? 'Unknown'
}
