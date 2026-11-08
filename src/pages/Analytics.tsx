import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight } from 'lucide-react'
import { useMealPlanStore, addDays, today as todayDate } from '../store/useMealPlanStore'
import { useThisWeek } from '../store/useThisWeek'
import { useUserStore } from '../store/useUserStore'
import { useWeightFor } from '../store/useBodyStore'
import { useNutritionContext } from '../store/useNutrition'
import { useMovementAcross } from '../store/useActivityStore'
import { weekEaten, type DayReading } from '../lib/nutrition'
import { scoreWeek, servingCount } from '../lib/mediterranean'
import { STATUS_STYLES, targetStatus } from '../lib/status'
import { inUnit, round1, fromKg } from '../lib/weight'
import { EstimatesNote } from '../components/ui'
import TrendsTab from '../components/trends/TrendsTab'
import ProgressHeader from '../components/progress/ProgressHeader'
import { useWhose } from '../components/progress/useWhose'
import BodyPanel from '../components/progress/BodyPanel'
import MediterraneanPanel from '../components/progress/MediterraneanPanel'
import {
  averageRows, rangeLabel, shortDate, sparkPoints, type AverageRow,
} from '../components/progress/overview'

type Detail = 'body' | 'mediterranean' | 'trends'

const DETAILS: [Detail, string][] = [['body', 'Body'], ['mediterranean', 'Mediterranean'], ['trends', 'Trends']]

/**
 * Progress, the overview: how this week is going, the daily averages against
 * the targets, and the weight, with the detail underneath.
 *
 * Everything that used to sit behind the old This week · Trends ·
 * Mediterranean · Body strip is still here: the week is the overview, and the
 * other three are the "In detail" tabs below it.
 */
export default function Analytics() {
  const [detail, setDetail] = useState<Detail>('body')
  const week = useWeek()

  function openDetail(d: Detail) {
    setDetail(d)
    document.getElementById('progress-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex-1 overflow-y-auto pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="max-w-3xl md:max-w-6xl mx-auto px-4 sm:px-6 md:px-8 pt-3 md:pt-6 space-y-3 md:space-y-4">
        <ProgressHeader
          whose
          actions={<span className="text-[15px] font-extrabold text-ink-900 tabular-nums pl-2">{rangeLabel(week.dates)}</span>}
        />

        <StatTiles week={week} />

        <div className="grid gap-3 md:gap-4 md:grid-cols-[minmax(0,1fr)_340px] md:items-start">
          <WeekCard week={week} onServings={() => openDetail('mediterranean')} />
          <div className="space-y-3 md:space-y-4">
            <EightWeeks />
            <AveragesCard rows={week.rows} />
          </div>
        </div>

        <div className="md:hidden space-y-3">
          <WeightCard onLog={() => openDetail('body')} />
          <MoreLinks dates={week.dates} />
        </div>

        <section id="progress-detail" aria-labelledby="detail-h" className="pt-3 space-y-3 scroll-mt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id="detail-h" className="w-full sm:w-auto sm:flex-1 text-base font-extrabold text-ink-900">In detail</h2>
            <div className="grid grid-cols-3 sm:flex gap-1 p-1 bg-border-100 rounded-lg w-full sm:w-fit" role="tablist" aria-label="Which detail">
              {DETAILS.map(([k, label]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={detail === k}
                  onClick={() => setDetail(k)}
                  className={detail === k ? 'segment-on' : 'segment-off'}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {detail === 'body' && <BodyPanel />}
          {detail === 'mediterranean' && <MediterraneanPanel />}
          {detail === 'trends' && <TrendsTab />}
        </section>
      </div>
    </div>
  )
}

interface Week {
  dates: string[]
  days: DayReading[]
  withFood: DayReading[]
  recorded: number
  planned: number
  avg: number
  onTrack: number
  target: number
  rows: AverageRow[]
}

/**
 * The week on screen, as what each day amounted to: what was ticked where
 * anything was, and the plan where nothing was yet. Which days are records and
 * which are still intentions is said, never blended into one number silently.
 */
function useWeek(): Week {
  const plan = useMealPlanStore((s) => s.plan)
  const dates = useThisWeek()
  const targets = useUserStore((s) => s.profile.targets)
  const ctx = useNutritionContext()

  return useMemo(() => {
    const { days, recorded, planned } = weekEaten(dates, plan, ctx)
    const withFood = days.filter((d) => d.nutrients.calories > 0)
    const avg = withFood.length
      ? withFood.reduce((a, d) => a + d.nutrients.calories, 0) / withFood.length
      : 0
    const onTrack = withFood.filter((d) => targetStatus(d.nutrients.calories, targets.calories).level === 'on-track').length
    return {
      dates, days, withFood, recorded, planned, avg, onTrack,
      target: targets.calories, rows: averageRows(withFood, targets),
    }
  }, [dates, plan, ctx, targets])
}

// ─── Desktop tiles ────────────────────────────────────────────────────────────

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card px-[18px] py-3.5 flex flex-col gap-0.5 min-w-0">
      <dt className="text-xs font-extrabold tracking-wide uppercase text-ink-700">{label}</dt>
      {children}
    </div>
  )
}

function StatTiles({ week }: { week: Week }) {
  const protein = week.rows.find((r) => r.key === 'protein')!
  return (
    <dl className="hidden md:grid grid-cols-4 gap-4">
      <Tile label="Daily average">
        <dd className="text-[26px] leading-8 font-extrabold text-ink-900 tabular-nums">
          {week.withFood.length ? Math.round(week.avg).toLocaleString() : '--'}
          <span className="text-sm font-bold text-ink-700 ml-1">kcal</span>
        </dd>
        <dd className="text-xs text-ink-700">
          Target {week.target.toLocaleString()} · over {week.withFood.length} {week.withFood.length === 1 ? 'day' : 'days'}
        </dd>
      </Tile>
      <Tile label="On-track days">
        <dd className="text-[26px] leading-8 font-extrabold text-ink-900 tabular-nums">
          {week.onTrack}<span className="text-sm font-bold text-ink-700 ml-1">of {week.withFood.length}</span>
        </dd>
        <dd className="flex gap-1 items-center mt-1" aria-hidden="true">
          {week.days.map((d) => {
            const level = d.nutrients.calories > 0 ? targetStatus(d.nutrients.calories, week.target).level : 'none'
            return (
              <span
                key={d.date}
                className={`w-[18px] h-2 rounded-full ${level === 'none' ? 'bg-paper ring-1 ring-inset ring-ink-300' : STATUS_STYLES[level].fill}`}
              />
            )
          })}
        </dd>
      </Tile>
      <Tile label="Protein, daily">
        <dd className="text-[26px] leading-8 font-extrabold text-ink-900 tabular-nums">{protein.value}</dd>
        <dd className={`text-xs font-bold ${protein.ok == null ? 'text-ink-700' : protein.ok ? 'text-leaf-700' : 'text-mustard-800'}`}>
          {protein.symbol && <span aria-hidden="true">{protein.symbol} </span>}
          {protein.ok == null ? protein.target : `${protein.status}, ${protein.target}`}
        </dd>
      </Tile>
      <Tile label="Weight">
        <WeightFigures compact />
      </Tile>
    </dl>
  )
}

// ─── The week ─────────────────────────────────────────────────────────────────

function WeekCard({ week, onServings }: { week: Week; onServings: () => void }) {
  const today = todayDate()
  const { days, withFood, target } = week

  return (
    <section aria-labelledby="week-h" className="card p-4 md:px-[22px] md:py-[18px] flex flex-col gap-2 md:gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week-h" className="text-base font-extrabold text-ink-900">
          <span className="md:hidden">This week</span>
          <span className="hidden md:inline">Calories by day</span>
        </h2>
        <span className="text-xs text-ink-700 md:hidden">{rangeLabel(week.dates, true)}</span>
      </div>

      {!withFood.length ? (
        <p className="text-sm text-ink-700 py-6">
          Nothing planned yet this week. Add a few meals and the numbers will appear here.
        </p>
      ) : (
        <>
          <div className="md:hidden flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[28px] leading-7 font-extrabold text-ink-900 tabular-nums">
              {Math.round(week.avg).toLocaleString()}
            </span>
            <span className="text-sm text-ink-700 flex-1">kcal a day</span>
            <span className="badge bg-leaf-50 text-leaf-700">
              <Check size={12} strokeWidth={3} aria-hidden="true" />
              {week.onTrack} of {withFood.length} days on track
            </span>
          </div>
          {/* Which days are records and which are still intentions. A blend of
              the two presented as one number is what this screen used to do
              without saying so. */}
          <p className="md:hidden text-xs text-ink-700">
            Average of {withFood.length} {withFood.length === 1 ? 'day' : 'days'}
            {week.recorded > 0 && week.planned > 0
              ? `, ${week.recorded} recorded and ${week.planned} still planned`
              : week.recorded > 0 ? ', all recorded' : ', all planned'}
            {' · '}target {target.toLocaleString()}
          </p>

          <WeekChart days={days} target={target} today={today} />
          <Legend />
        </>
      )}
      <EstimatesNote />

      <WeekServings dates={week.dates} onMore={onServings} />
    </section>
  )
}

/** Still planned: a pale fill with an edge, so it is a shape as well as a shade. */
const PLANNED_FILL = 'bg-leaf-100 ring-[1.5px] ring-inset ring-leaf-500'

/** The fill a still-planned bar wears, as a legend key. A mark, not text. */
function PlannedSwatch() {
  return <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-[3px] ${PLANNED_FILL}`} />
}

function dayKind(d: DayReading, target: number) {
  const kcal = d.nutrients.calories
  const status = targetStatus(kcal, target)
  const over = status.level === 'slightly-over' || status.level === 'over'
  const fill = !kcal ? 'bg-border-200'
    : over ? STATUS_STYLES[status.level].fill
      : d.recorded ? 'bg-leaf-500'
        : PLANNED_FILL
  const words = !kcal ? 'nothing yet'
    : `${Math.round(kcal).toLocaleString()} kcal, ${over ? status.label.toLowerCase() : 'on track'}${d.recorded ? '' : ', still planned'}`
  return { kcal, status, over, fill, words }
}

/**
 * Seven bars against the target. Over is a symbol above the bar as well as a
 * colour, and a recorded day is a tick under its letter, so neither rests on
 * hue alone.
 */
function WeekChart({ days, target, today }: { days: DayReading[]; target: number; today: string }) {
  const peak = Math.max(target * 1.2, ...days.map((d) => d.nutrients.calories), 1)
  const label = `Calories by day against a target of ${target.toLocaleString()}: ${days.map((d) =>
    `${weekday(d.date, 'long')} ${dayKind(d, target).words}`).join('; ')}.`

  return (
    <div role="img" aria-label={label} className="flex flex-col gap-1 mt-1">
      <div className="relative h-28 md:h-60 grid grid-cols-7 gap-2 md:gap-5 md:px-3 items-end">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 border-t-2 border-dashed border-ink-300 md:border-bite-700 pointer-events-none"
          style={{ bottom: `${(target / peak) * 100}%` }}
        />
        {days.map((d) => {
          const k = dayKind(d, target)
          return (
            <div key={d.date} className="flex flex-col items-center justify-end h-full gap-0.5 min-w-0">
              <span className="hidden md:block text-[13px] font-extrabold text-ink-900 tabular-nums">
                {k.kcal ? Math.round(k.kcal).toLocaleString() : ''}
              </span>
              <span aria-hidden="true" className={`md:hidden h-3.5 text-xs leading-[14px] font-extrabold ${STATUS_STYLES[k.status.level].text}`}>
                {k.over ? k.status.symbol : ''}
              </span>
              <div
                className={`w-full md:max-w-16 rounded-t-lg md:rounded-t-[10px] transition-all duration-500 ${k.fill}`}
                style={{ height: `${Math.max((k.kcal / peak) * 100, k.kcal ? 4 : 2)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div aria-hidden="true" className="grid grid-cols-7 gap-2 md:gap-5 md:px-3 border-t border-border-200 pt-1">
        {days.map((d) => {
          const k = dayKind(d, target)
          const isToday = d.date === today
          return (
            <div key={d.date} className="flex flex-col items-center gap-0.5 min-w-0">
              <span className="md:hidden text-xs leading-[14px] font-bold text-ink-900 tabular-nums">
                {k.kcal ? Math.round(k.kcal).toLocaleString() : ''}
              </span>
              <span className={`text-xs md:text-[13px] leading-[14px] md:leading-5 ${isToday ? 'text-bite-700 font-extrabold' : 'text-ink-700 font-semibold md:font-bold'}`}>
                <span className="md:hidden">{weekday(d.date, 'narrow')}</span>
                <span className="hidden md:inline">{weekday(d.date, 'short')} {Number(d.date.slice(8))}</span>
                {d.recorded ? <span className="md:hidden text-leaf-700 font-extrabold">{' ✓'}</span> : null}
              </span>
              <span className={`hidden md:block text-xs font-bold whitespace-nowrap ${
                !k.kcal ? 'text-ink-700' : k.over ? STATUS_STYLES[k.status.level].text : d.recorded ? 'text-leaf-700' : 'text-ink-700'}`}>
                {!k.kcal ? '' : k.over ? `${k.status.symbol} ${k.status.label}` : d.recorded ? '✓ On track' : 'Still planned'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-700">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="w-[18px] border-t-2 border-dashed border-ink-300 md:border-bite-700" />Target
      </span>
      <span><span className="text-leaf-700 font-extrabold">{'✓'}</span> Recorded</span>
      <span className="inline-flex items-center gap-1.5">
        <PlannedSwatch />Still planned
      </span>
      <span><span className="text-mustard-800 font-extrabold">+</span> Slightly over</span>
      <span><span className="text-coral-700 font-extrabold">!</span> Over</span>
    </div>
  )
}

/** Four of the week's Mediterranean goals, under the chart from md up. */
function WeekServings({ dates, onMore }: { dates: string[]; onMore: () => void }) {
  const plan = useMealPlanStore((s) => s.plan)
  const ctx = useNutritionContext()
  const goals = useMemo(() => {
    const week = plan.filter((d) => dates.includes(d.date))
    return week.some((d) => d.meals.length) ? scoreWeek(week, ctx).slice(0, 4) : []
  }, [plan, dates, ctx])
  if (!goals.length) return null

  return (
    <div className="hidden md:flex flex-col gap-2 mt-auto pt-3 border-t border-border-100">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-extrabold text-ink-900">Mediterranean servings this week</h3>
        <button type="button" onClick={onMore} className="text-sm font-bold text-bite-700 hover:underline">
          All servings
        </button>
      </div>
      <ul className="grid grid-cols-4 gap-2">
        {goals.map((g) => {
          const ok = g.isLimit ? g.ratio <= 1 : g.ratio >= 0.9
          return (
            <li key={g.category} className="border border-border-100 rounded-lg px-3 py-2 flex flex-col gap-0.5 min-w-0">
              <span className="text-[13px] font-bold text-ink-900 truncate">{g.label}</span>
              <span className="text-xs text-ink-700">
                {servingCount(g.servings)} of {g.isLimit ? 'at most ' : ''}{servingCount(g.expected)}
              </span>
              <span className={`text-xs font-bold ${ok ? 'text-leaf-700' : 'text-mustard-800'}`}>
                <span aria-hidden="true">{ok ? '✓' : g.isLimit ? '▲' : '▼'} </span>
                {g.isLimit ? (ok ? 'Within' : 'Over') : (ok ? 'Met' : 'Below')}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── Averages ─────────────────────────────────────────────────────────────────

function statusText(r: AverageRow) {
  return r.ok == null ? 'text-ink-700' : r.ok ? 'text-leaf-700' : 'text-mustard-800'
}

function AveragesCard({ rows }: { rows: AverageRow[] }) {
  const phone = rows.filter((r) => r.key === 'protein' || r.key === 'fiber' || r.key === 'salt')
  const anyFloor = rows.some((r) => r.value.endsWith('+'))

  return (
    <section aria-labelledby="avg-h" className="card p-4 md:px-[18px] flex flex-col gap-2 md:gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="avg-h" className="text-base font-extrabold text-ink-900">Daily averages</h2>
        <span className="hidden md:inline text-xs text-ink-700">vs your targets</span>
      </div>

      <dl className="md:hidden grid grid-cols-3 gap-2">
        {phone.map((r) => (
          <div key={r.key} className="bg-cream-50 rounded-lg px-2.5 py-2 flex flex-col gap-0.5 min-w-0">
            <dt className="text-xs text-ink-700">{r.label}</dt>
            <dd className="text-lg leading-[22px] font-extrabold text-ink-900 tabular-nums">{r.value}</dd>
            <dd className={`text-xs ${statusText(r)}`}>
              {r.symbol && <span aria-hidden="true">{r.symbol} </span>}{r.target}
            </dd>
          </div>
        ))}
      </dl>

      <ul className="hidden md:flex flex-col gap-2.5">
        {rows.map((r) => (
          <li key={r.key} className="flex flex-col gap-1">
            <div className="flex items-baseline gap-1.5 text-sm">
              <span className="font-bold text-ink-900 flex-1">{r.label}</span>
              <span className="font-extrabold text-ink-900 tabular-nums">{r.value}</span>
              <span className="text-xs text-ink-700">{r.target}</span>
            </div>
            {r.ok != null && (
              <>
                <div className="h-1.5 rounded-full bg-border-100 overflow-hidden" aria-hidden="true">
                  <div
                    className={`h-full rounded-full ${r.ok ? 'bg-leaf-500' : 'bg-mustard-500'}`}
                    style={{ width: `${r.fill * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-bold ${statusText(r)}`}>
                  <span aria-hidden="true">{r.symbol} </span>{r.status}
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      {anyFloor && (
        <p className="text-xs text-ink-700">A trailing + means at least this much: some foods have no figure for it yet.</p>
      )}
    </section>
  )
}

// ─── Eight weeks ──────────────────────────────────────────────────────────────

/** The weekly average over the last eight weeks, against the target. */
function EightWeeks() {
  const plan = useMealPlanStore((s) => s.plan)
  const dates = useThisWeek()
  const ctx = useNutritionContext()
  const target = useUserStore((s) => s.profile.targets.calories)

  const weeks = useMemo(() => {
    const out: { start: string; avg: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const shifted = dates.map((d) => addDays(d, -7 * i))
      const withFood = weekEaten(shifted, plan, ctx).days.filter((d) => d.nutrients.calories > 0)
      if (withFood.length) {
        out.push({ start: shifted[0], avg: withFood.reduce((a, d) => a + d.nutrients.calories, 0) / withFood.length })
      }
    }
    return out
  }, [dates, plan, ctx])

  if (weeks.length < 2) return null
  const W = 300
  const H = 72
  const { points, y } = sparkPoints(weeks.map((w) => w.avg), W, H, 6, target)
  const last = points[points.length - 1]
  const first = weeks[0]
  const now = weeks[weeks.length - 1]

  return (
    <section aria-labelledby="trend-h" className="hidden md:flex card px-[18px] py-4 flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 id="trend-h" className="text-base font-extrabold text-ink-900">Last 8 weeks</h2>
        <span className="text-xs text-ink-700">weekly average</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`} className="w-full h-[72px]" role="img"
        aria-label={`Weekly average calories over the last 8 weeks, from ${Math.round(first.avg).toLocaleString()} in the week of ${shortDate(first.start)} to ${Math.round(now.avg).toLocaleString()} now, against a target of ${target.toLocaleString()}.`}
      >
        <line x1="0" x2={W} y1={y(target)} y2={y(target)} className="stroke-bite-700" strokeWidth="1.5" strokeDasharray="4 4" />
        <polyline points={points.map((p) => p.join(',')).join(' ')} fill="none" className="stroke-leaf-500" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r="4" className="fill-leaf-500 stroke-paper" strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-xs text-ink-700 tabular-nums">
        <span>{shortDate(first.start)} · {Math.round(first.avg).toLocaleString()}</span>
        <span className="font-bold text-ink-900">This week · {Math.round(now.avg).toLocaleString()}</span>
      </div>
    </section>
  )
}

// ─── Weight ───────────────────────────────────────────────────────────────────

/** The latest weight and what it has done over eight weeks, for whoever is picked. */
function useWeightGlance() {
  const who = useWhose()
  const weights = useWeightFor(who)
  const profile = useUserStore((s) => s.profile)
  const unit = profile.weightUnit
  const goalKg = profile.weightGoals?.[who]
  const goal = goalKg == null ? undefined : round1(fromKg(goalKg, unit))
  const floor = addDays(todayDate(), -56)
  const recent = weights.filter((w) => w.date >= floor).map((w) => ({ date: w.date, value: inUnit(w, unit) }))
  const latest = weights.length ? { date: weights[weights.length - 1].date, value: inUnit(weights[weights.length - 1], unit) } : null
  return { unit, goal, recent, latest }
}

function WeightFigures({ compact = false }: { compact?: boolean }) {
  const { unit, goal, recent, latest } = useWeightGlance()
  if (!latest) {
    return <dd className="text-sm text-ink-700 py-1">No weight logged yet</dd>
  }
  const first = recent[0]
  const change = first && recent.length > 1 ? round1(latest.value - first.value) : null
  const moved = change == null ? null
    : change === 0 ? `no change since ${shortDate(first.date)}`
      : `${change < 0 ? 'down' : 'up'} ${Math.abs(change).toFixed(1)} ${unit} since ${shortDate(first.date)}`
  const aim = goal != null ? `aiming for ${goal}` : null
  const line = [moved, aim].filter(Boolean).join(' · ')

  if (compact) {
    return (
      <>
        <dd className="text-[26px] leading-8 font-extrabold text-ink-900 tabular-nums">
          {latest.value}<span className="text-sm font-bold text-ink-700 ml-1">{unit}</span>
        </dd>
        <dd className="text-xs text-ink-700">{line || `on ${shortDate(latest.date)}`}</dd>
      </>
    )
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-[22px] leading-[26px] font-extrabold text-ink-900 tabular-nums">{latest.value}<span className="ml-1">{unit}</span></span>
      <span className="text-[13px] text-ink-700">{line || `on ${shortDate(latest.date)}`}</span>
    </div>
  )
}

function WeightCard({ onLog }: { onLog: () => void }) {
  const { unit, recent, latest } = useWeightGlance()
  const W = 326
  const H = 48
  const spark = recent.length > 1 ? sparkPoints(recent.map((r) => r.value), W, H) : null
  const last = spark?.points[spark.points.length - 1]

  return (
    // Not a labelled region: "Weight" is already the name of the input that
    // logs one, further down the same screen.
    <section className="card p-4 flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-extrabold text-ink-900">Weight</h2>
        <span className="text-xs text-ink-700">Last 8 weeks</span>
      </div>
      <WeightFigures />
      {spark && last && (
        <svg
          viewBox={`0 0 ${W} ${H}`} className="w-full h-12" role="img"
          aria-label={`The last 8 weeks of weigh-ins: from ${recent[0].value} ${unit} on ${shortDate(recent[0].date)} to ${recent[recent.length - 1].value} ${unit}.`}
        >
          <polyline points={spark.points.map((p) => p.join(',')).join(' ')} fill="none" className="stroke-bite-700" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={last[0]} cy={last[1]} r="4" className="fill-bite-700 stroke-paper" strokeWidth="2" />
        </svg>
      )}
      <button type="button" onClick={onLog} className="self-start min-h-11 text-sm font-bold text-bite-700 hover:underline">
        {latest ? 'Log a weight or see them all' : 'Log a weight'}
      </button>
    </section>
  )
}

// ─── The rest of the section ─────────────────────────────────────────────────

function MoreLinks({ dates }: { dates: string[] }) {
  const who = useWhose()
  const moved = useMovementAcross(who, dates)
  const active = moved.filter((d) => d.movement.sessions > 0)
  const minutes = active.reduce((n, d) => n + d.movement.minutes, 0)

  const rows = [
    {
      to: '/progress/movement', title: 'Movement',
      sub: active.length ? `${active.length} ${active.length === 1 ? 'day' : 'days'} this week · ${minutes} min` : 'Nothing logged this week',
    },
    { to: '/progress/summary', title: 'Summary for your dietician', sub: `Ready for ${rangeLabel(dates)}` },
  ]

  return (
    <nav aria-label="More in Progress" className="card overflow-hidden divide-y divide-border-100">
      {rows.map((r) => (
        <Link key={r.to} to={r.to} className="flex items-center gap-3 px-3.5 py-2.5 min-h-11 hover:bg-cream-50">
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[15px] font-bold text-ink-900">{r.title}</span>
            <span className="text-xs text-ink-700">{r.sub}</span>
          </span>
          <ChevronRight size={18} className="text-ink-500 shrink-0" aria-hidden="true" />
        </Link>
      ))}
    </nav>
  )
}

function weekday(date: string, style: 'narrow' | 'short' | 'long'): string {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: style })
}
