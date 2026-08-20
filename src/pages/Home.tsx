import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays, ShoppingBasket, BookOpen, ArrowRight,
  Cloud, CloudOff, RefreshCw, AlertTriangle,
} from 'lucide-react'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useUserStore } from '../store/useUserStore'
import { useNutritionContext } from '../store/useNutrition'
import { useAuthStore } from '../store/useAuth'
import { useSyncStatus } from '../store/useSync'
import { dayNutrients, componentsNutrients } from '../lib/nutrition'
import { targetStatus, STATUS_STYLES } from '../lib/status'
import { MEAL_SLOTS, SLOT_LABELS } from '../types'
import { CalorieRing, SectionHeading } from '../components/ui'
import { isConfigured } from '../lib/supabase'
import Zig from '../components/brand/Mascot'

/**
 * The welcome screen — what you land on, before the planner.
 *
 * It answers three questions in order: what am I eating today, how is the week
 * going, and is the other person's copy the same as mine. Everything else is a
 * way through to a screen that does the work.
 */
export default function Home() {
  const { plan, weekDates } = useMealPlanStore()
  const { profile } = useUserStore()
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

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

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
                <Link to="/history" className="btn-secondary">Load a week</Link>
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

            <div className="flex items-end gap-1.5 h-16">
              {weekDates.map((date) => {
                const kcal = days.find((d) => d.date === date)?.kcal ?? 0
                const peak = Math.max(profile.targets.calories, ...days.map((d) => d.kcal), 1)
                const status = targetStatus(kcal, profile.targets.calories)
                return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div
                      className={`w-full rounded-t transition-all ${kcal > 0 ? STATUS_STYLES[status.level].fill : 'bg-border-100'}`}
                      style={{ height: `${kcal > 0 ? Math.max((kcal / peak) * 100, 6) : 6}%` }}
                    />
                    <span className={`text-[11px] leading-none ${date === today ? 'font-bold text-ink-900' : 'text-ink-500'}`}>
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

function SyncLine() {
  const { state, at, unsaved, schemaMismatch } = useSyncStatus()

  // Unsaved changes outrank everything else: it is the only state where what
  // you are looking at is not what the other person will see.
  const [Icon, text, tone] =
    schemaMismatch
      ? [AlertTriangle,
         'The other device is running a different version of the app. Nothing has been overwritten — reload this page to pick up the latest.',
         'text-coral-600']
    : unsaved
      ? [CloudOff,
         `${unsaved} ${unsaved === 1 ? 'change' : 'changes'} not saved yet — kept on this device and retried automatically.`,
         'text-mustard-700']
    : state === 'live'
      ? [Cloud, at ? `Everything shared · last synced ${timeOf(at)}` : 'Everything shared', 'text-teal-600']
    : state === 'connecting'
      ? [RefreshCw, 'Connecting…', 'text-ink-500']
    : state === 'error'
      ? [AlertTriangle, "Can't reach the server — your changes are safe here and will go up when it's back.", 'text-coral-600']
    : [CloudOff, 'Working offline on this device only.', 'text-ink-500']

  return (
    <p className={`flex items-start gap-2 mt-2 px-1 text-xs ${tone}`}>
      <Icon size={14} className="shrink-0 mt-px" /> {text}
    </p>
  )
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
