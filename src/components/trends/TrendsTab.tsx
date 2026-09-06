import { useMemo, useState } from 'react'
import type { MedCategory, Nutrients, Targets } from '../../types'
import { CATEGORY_LABELS } from '../../lib/categories'
import { useMealPlanStore, today } from '../../store/useMealPlanStore'
import { useNutritionContext } from '../../store/useNutrition'
import { useUserStore } from '../../store/useUserStore'
import { EmptyState, SectionHeading } from '../ui'
import {
  SPANS, SPAN_LABELS, direction, foodsEaten, pointsFrom, smooth, spanDates, trend, type Span,
} from '../../lib/trends'
import DayChart, { Legend } from './Chart'

/**
 * How it is going, as opposed to how this week is going.
 *
 * Progress has answered the second for months. A week is one shop, one weekend
 * and whatever happened on Tuesday, and two of them in a row can look like
 * opposite lives without either being unusual. This is the same numbers over
 * long enough to show a habit.
 *
 * Everything here reads what was ticked wherever anything was ticked, and says
 * how much of what it is showing is a record and how much is still an
 * intention. A trend built on what you meant to eat is a chart of intentions.
 */

/** The figures worth watching over months, and what each is measured in. */
const WATCHED = [
  { key: 'calories', label: 'Calories', unit: 'kcal', of: (n: Nutrients) => n.calories },
  { key: 'protein', label: 'Protein', unit: 'g', of: (n: Nutrients) => n.protein },
  { key: 'carbs', label: 'Carbs', unit: 'g', of: (n: Nutrients) => n.carbs },
  { key: 'fat', label: 'Fat', unit: 'g', of: (n: Nutrients) => n.fat },
  { key: 'fiber', label: 'Fibre', unit: 'g', of: (n: Nutrients) => n.fiber ?? 0 },
] as const

type Watched = typeof WATCHED[number]['key']

const TARGET_OF: Record<Watched, (t: Targets) => number | undefined> = {
  calories: (t) => t.calories,
  protein: (t) => t.protein,
  carbs: (t) => t.carbs,
  fat: (t) => t.fat,
  fiber: (t) => t.fiber,
}

export default function TrendsTab() {
  const plan = useMealPlanStore((s) => s.plan)
  const ctx = useNutritionContext()
  const { profile } = useUserStore()
  const targets = profile.targets

  const [span, setSpan] = useState<Span>('month')
  const [watching, setWatching] = useState<Watched>('calories')
  const [category, setCategory] = useState<MedCategory | 'all'>('all')

  const dates = useMemo(() => spanDates(span, today()), [span])
  const read = useMemo(() => trend(dates, plan, ctx), [dates, plan, ctx])

  const chosen = WATCHED.find((w) => w.key === watching)!
  const target = TARGET_OF[watching](targets)

  const points = useMemo(
    () => pointsFrom(read.days, (d) => chosen.of(d.nutrients)),
    [read.days, chosen],
  )
  const line = useMemo(() => smooth(points.map((p) => p.value)), [points])
  const way = useMemo(() => direction(read.days, chosen.of), [read.days, chosen])

  const foods = useMemo(() => foodsEaten(dates, plan, ctx), [dates, plan, ctx])
  const shownFoods = useMemo(
    () => (category === 'all' ? foods : foods.filter((f) => f.category === category)).slice(0, 12),
    [foods, category],
  )

  // Only the categories actually present, so the filter is not a list of
  // seventeen things fifteen of which find nothing.
  const categories = useMemo(
    () => [...new Set(foods.map((f) => f.category))].sort(),
    [foods],
  )

  if (!read.withFood.length) {
    return (
      <EmptyState title="Nothing to trend yet">
        Plan or record a few days and this fills in. It reads the last {SPAN_LABELS[span].toLowerCase()}.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-5">
      {/* ─── Filters ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {SPANS.map((s) => (
            <button
              key={s}
              onClick={() => setSpan(s)}
              aria-pressed={span === s}
              className={span === s ? 'chip-on' : 'chip-off'}
            >
              {SPAN_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WATCHED.map((w) => (
            <button
              key={w.key}
              onClick={() => setWatching(w.key)}
              aria-pressed={watching === w.key}
              className={watching === w.key ? 'chip-on' : 'chip-off'}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── The chart ───────────────────────────────────────────────────── */}
      <section>
        <SectionHeading>{chosen.label} by day</SectionHeading>
        <div className="card p-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
            <p className="text-2xl font-extrabold font-mono text-ink-900">
              {read.average ? Math.round(chosen.of(read.average)) : 0}
              <span className="text-sm text-ink-500 font-semibold ml-1">{chosen.unit} a day</span>
            </p>
            <p className="text-sm text-ink-700">
              across {read.withFood.length} {read.withFood.length === 1 ? 'day' : 'days'}
              {read.recorded > 0 && read.planned > 0
                ? `, ${read.recorded} recorded and ${read.planned} still planned`
                : read.recorded > 0 ? ', all recorded' : ', all planned'}
            </p>
          </div>

          <DayChart points={points} target={target} smoothed={line} unit={chosen.unit} />
          <Legend target={target} unit={chosen.unit} />

          {/* Which way it is going, in words, with the days behind it. A
              comparison resting on two days has to say so. */}
          <p className="text-sm text-ink-700 mt-3 pt-3 border-t border-border-100">
            {way.change == null ? (
              <>Not enough days yet to say which way this is going.</>
            ) : (
              <>
                The second half averages{' '}
                <strong className="font-mono text-ink-900">
                  {way.change > 0 ? '+' : ''}{Math.round(way.change)} {chosen.unit}
                </strong>{' '}
                a day against the first, over {way.earlierDays} and {way.laterDays} days
                with food in them.
              </>
            )}
          </p>
        </div>
      </section>

      {/* ─── What it is made of ──────────────────────────────────────────── */}
      <section>
        <SectionHeading>What you eat most</SectionHeading>
        <div className="card p-5 space-y-3">
          <p className="text-sm text-ink-700">
            By the number of days it turned up on, which is what a habit is. Olive oil is in
            everything and weighs nothing; a roast weighs a kilo and happens once.
          </p>

          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCategory('all')}
                aria-pressed={category === 'all'}
                className={category === 'all' ? 'chip-on' : 'chip-off'}
              >
                Everything
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  aria-pressed={category === c}
                  className={category === c ? 'chip-on' : 'chip-off'}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          )}

          {shownFoods.length === 0 ? (
            <p className="text-sm text-ink-500">Nothing in that group over this stretch.</p>
          ) : (
            <ol className="space-y-1.5">
              {shownFoods.map((f) => (
                <li key={f.foodId} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                  <span className="flex-auto min-w-28 text-ink-900 truncate">{f.name}</span>
                  <span className="flex items-baseline gap-3 shrink-0 ml-auto font-mono text-xs text-ink-700 tabular-nums">
                    <span>{f.days} {f.days === 1 ? 'day' : 'days'}</span>
                    <span className="w-16 text-right">{Math.round(f.grams).toLocaleString()} g</span>
                  </span>
                  {/* The bar is the same figure as the number beside it, never
                      the only place it appears. */}
                  <span
                    aria-hidden="true"
                    className="basis-full h-1 rounded-full bg-bite-200"
                    style={{ width: `${(f.days / shownFoods[0].days) * 100}%` }}
                  />
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  )
}
