import { useMemo } from 'react'
import { useMealPlanStore } from '../../store/useMealPlanStore'
import { useThisWeek } from '../../store/useThisWeek'
import { useNutritionContext } from '../../store/useNutrition'
import { scoreWeek, scoreGaps, servingCount, IMPLAUSIBLE_RATIO } from '../../lib/mediterranean'
import { EmptyState } from '../ui'

/** The week's Mediterranean serving goals and limits, in full. */
export default function MediterraneanPanel() {
  const plan = useMealPlanStore((s) => s.plan)
  const weekDates = useThisWeek()
  const ctx = useNutritionContext()
  const week = useMemo(
    () => plan.filter((d) => weekDates.includes(d.date)),
    [plan, weekDates],
  )
  const goals = useMemo(() => scoreWeek(week, ctx), [week, ctx])
  const gaps = useMemo(() => scoreGaps(week, ctx), [week, ctx])
  const planned = week.filter((d) => d.meals.length).length

  if (!planned) {
    return <EmptyState title="Nothing to score yet">
      The Mediterranean serving goals need a planned week to measure against.
    </EmptyState>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-700">
        Serving goals from the Mediterranean Diet guide, scaled to the {planned}{' '}
        {planned === 1 ? 'day' : 'days'} planned so far.
      </p>
      {/* What the count had to leave out. Dropping a food mid-count and then
          presenting the total as the week is the same silence that let the
          serving figures go unquestioned for months. */}
      {(gaps.noGoal.length > 0 || gaps.lost > 0) && (
        <div className="card p-4 space-y-1.5">
          {gaps.noGoal.length > 0 && (
            <p className="text-sm text-ink-700">
              {gaps.noGoal.length} {gaps.noGoal.length === 1 ? 'food' : 'foods'} could not be
              counted as servings, because the guide has no serving size for{' '}
              {gaps.noGoal.length === 1 ? 'it' : 'them'}:{' '}
              <span className="text-ink-900">{gaps.noGoal.join(', ')}</span>.
            </p>
          )}
          {gaps.lost > 0 && (
            <p className="text-sm text-coral-700">
              {gaps.lost} {gaps.lost === 1 ? 'thing is' : 'things are'} missing from the library
              altogether, so these counts are short by an unknown amount.
            </p>
          )}
        </div>
      )}

      {/* Two lists, not one. A goal and a limit are opposite questions and had
          the same row and the same filling bar, so a nearly-full bar meant
          "nearly there" on one and "nearly over" on the other, with only hue
          to tell them apart. Split, the shape of the list says which is which
          before any colour does. */}
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500 pt-1">Aim for</p>
      <div className="card divide-y divide-border-100">
        {goals.filter((g) => !g.isLimit).map((g) => {
          const pct = Math.min(1, g.ratio)
          const met = g.isLimit ? g.ratio <= 1 : g.ratio >= 0.9
          return (
            <div key={g.category} className="px-4 py-3">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm font-semibold text-ink-900">
                  {g.label}
                  <span className="ml-2 text-xs font-normal text-ink-500">
                    {g.isLimit ? 'at most ' : ''}{g.target} / {g.period}
                  </span>
                </span>
                <span className={`text-xs font-mono ${
                  g.ratio > IMPLAUSIBLE_RATIO ? 'text-coral-700'
                    : met ? 'text-bite-700' : 'text-ink-500'}`}>
                  {/* Named, because "42.1 of 21" with no unit reads as a
                      broken number rather than a big one. */}
                  {servingCount(g.servings)} of {servingCount(g.expected)} servings
                </span>
              </div>
              <div className="h-2 rounded-full bg-border-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    g.isLimit ? (g.ratio > 1 ? 'bg-coral-500' : 'bg-leaf-400')
                              : (met ? 'bg-leaf-500' : 'bg-ink-300')}`}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
              {/* Three times a target is not a good week, it is a number to
                  doubt. This screen once rendered "80.7 of 21" as a result. */}
              {g.ratio > IMPLAUSIBLE_RATIO && (
                <p className="mt-1.5 text-xs text-coral-700">
                  That is {g.ratio.toFixed(0)} times the goal, which is more likely a problem with
                  the data than a week of eating. Worth checking the foods in it.
                </p>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs font-bold uppercase tracking-wide text-ink-500 pt-1">Keep under</p>
      <div className="card divide-y divide-border-100">
        {goals.filter((g) => g.isLimit).map((g) => (
          <div key={g.category} className="px-4 py-3 flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-ink-900">
              {g.label}
              <span className="ml-2 text-xs font-normal text-ink-500">
                at most {g.target} / {g.period}
              </span>
            </span>
            {/* No bar at all. There is nothing to fill up here: you are either
                inside the line or over it, and that is a word, not a length. */}
            <span className={`text-xs font-mono shrink-0 ${
              g.ratio > 1 ? 'text-coral-700' : 'text-ink-500'}`}>
              {servingCount(g.servings)} of {servingCount(g.expected)}
              <span className="ml-1.5 font-sans font-semibold">
                {g.ratio > 1 ? 'over' : 'within'}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
