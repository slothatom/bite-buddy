import { useMemo, useState } from 'react'
import { CalendarPlus, Check } from 'lucide-react'
import type { SourcePlan } from '../types'
import { SLOT_LABELS } from '../types'
import { SOURCE_PLANS } from '../data'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useUserStore } from '../store/useUserStore'
import { EMPTY_CONTEXT } from '../lib/moments'
import { useNutritionContext } from '../store/useNutrition'
import { componentsNutrients } from '../lib/nutrition'

/**
 * The archive of the dietician's plans.
 *
 * The original Romanian and Hungarian wording is kept verbatim, it is the
 * record of what was actually prescribed, and the calorie figures beside it are
 * this app's interpretation, not the dietician's.
 */
export default function History() {
  const [openId, setOpenId] = useState<string | null>(SOURCE_PLANS[0]?.id ?? null)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const { loadSourcePlan, weekDates } = useMealPlanStore()
  const notice = useUserStore((s) => s.notice)

  const plans = useMemo(
    () => [...SOURCE_PLANS].sort((a, b) => (b.issuedOn ?? '').localeCompare(a.issuedOn ?? '')),
    [],
  )

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header>
          <h1 className="display text-xl sm:text-2xl text-ink-900">Plan history</h1>
          <p className="text-sm text-ink-700">
            {plans.length} weeks from your dietician, {plans.reduce((a, p) => a + p.days.length, 0)} days in all.
            Drop any week straight into your planner.
          </p>
        </header>

        <div className="space-y-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              open={openId === plan.id}
              loaded={loadedId === plan.id}
              onToggle={() => setOpenId(openId === plan.id ? null : plan.id)}
              onLoad={() => {
                loadSourcePlan(plan)
                setLoadedId(plan.id)
                notice({ ...EMPTY_CONTEXT, loadedFromArchive: true })
              }}
              weekLabel={weekDates[0]}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function PlanCard({
  plan, open, loaded, onToggle, onLoad, weekLabel,
}: {
  plan: SourcePlan
  open: boolean
  loaded: boolean
  onToggle: () => void
  onLoad: () => void
  weekLabel: string
}) {
  const ctx = useNutritionContext()

  const dayTotals = plan.days.map((d) =>
    d.meals.reduce((sum, m) => sum + componentsNutrients(m.entries, ctx).calories, 0))
  const complete = dayTotals.filter((t) => t > 0)
  const average = complete.length ? Math.round(complete.reduce((a, b) => a + b, 0) / complete.length) : 0

  return (
    <article className="card overflow-hidden">
      {/* Two sibling buttons rather than one nested inside the other: a button
          inside a button is invalid, and browsers reparent it so its click
          handler never fires. */}
      <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-cream-50">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 min-w-0 min-h-11 text-left">
          <span className="text-xl">{plan.language === 'hu' ? '🇭🇺' : '🇷🇴'}</span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-ink-900 text-sm">{plan.label}</span>
            <span className="block text-xs text-ink-500">
              {plan.days.length} days · avg {average} kcal
              {plan.subject === 'other' ? ' · not your plan' : ''}
            </span>
          </span>
        </button>
        <button
          onClick={onLoad}
          className={loaded ? 'chip-on' : 'chip-off'}
        >
          {loaded ? <><Check size={12} /> Loaded</> : <><CalendarPlus size={12} /> Load</>}
        </button>
      </div>

      {open && (
        <div className="border-t border-border-200 divide-y divide-border-100">
          {plan.days.map((day, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-baseline justify-between mb-1.5">
                <h3 className="text-sm font-bold text-ink-900">{day.dayName}</h3>
                <span className="text-xs font-mono text-ink-500">{Math.round(dayTotals[i])} kcal</span>
              </div>
              <dl className="space-y-1">
                {day.meals.map((meal, j) => (
                  <div key={j} className="flex gap-3 text-xs">
                    <dt className="w-20 shrink-0 font-semibold text-ink-500">{SLOT_LABELS[meal.slot]}</dt>
                    <dd className="flex-1 text-ink-700">{meal.text}</dd>
                    <dd className="w-12 text-right font-mono text-ink-500 shrink-0">
                      {Math.round(componentsNutrients(meal.entries, ctx).calories)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <p className="px-4 py-3 text-xs text-ink-500">
            Loading this plan fills the week of {new Date(weekLabel + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })},
            matching each day to the same weekday.
          </p>
        </div>
      )}
    </article>
  )
}
