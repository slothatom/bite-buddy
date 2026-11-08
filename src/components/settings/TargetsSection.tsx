import { useMemo } from 'react'
import { Sparkles, Calculator } from 'lucide-react'
import type { ActivityLevel, Goal, Sex } from '../../types'
import { useUserStore } from '../../store/useUserStore'
import { useNutritionContext } from '../../store/useNutrition'
import { SOURCE_PLANS } from '../../data'
import {
  ACTIVITY_LABELS, averagePlanDay, explainTdee, fromPlans, fromTdee, totalDailyEnergy,
} from '../../lib/targets'
import { EstimatesNote, SectionHeading } from '../ui'
import { ManualTargets } from './ManualTargets'

/**
 * Daily targets: from the dietician's plans, from the calculator, or by hand.
 */
export function TargetsSection() {
  const { profile, setTargets, setTdee } = useUserStore()
  const shown = profile.targets
  const ctx = useNutritionContext()

  const planAverage = useMemo(() => averagePlanDay(SOURCE_PLANS, ctx), [ctx])
  const planTargets = useMemo(() => fromPlans(SOURCE_PLANS, ctx), [ctx])
  const tdeeTargets = fromTdee(profile.tdee)
  const tdee = totalDailyEnergy(profile.tdee)
  const working = explainTdee(profile.tdee)

  return (
    <section>
      <SectionHeading>Daily targets</SectionHeading>

      {/* One figure, for a plan that has one. The household cooks once
          and eats the same food, so the line across a day belongs to the
          day and not to a person. Two people did each have their own for
          a while and neither ever set one, so the switch changed nothing
          on screen and read as decoration on all three screens it
          appeared on. Body and Movement still ask whose, because there
          the question really is about a person. */}
      <p className="text-sm text-ink-700 mb-4">
        You are both on <strong className="font-mono">{shown.calories} kcal</strong>{' '}
        (Protein {shown.protein} g · Carbs {shown.carbs} g · Fat {shown.fat} g), set{' '}
        {shown.source === 'from-plans' ? 'from your plans'
          : shown.source === 'tdee' ? 'by the calculator' : 'by hand'}.
      </p>
      {/* Said once, where the targets are set: none of these numbers came
          from the dietician, who wrote meals rather than calories. */}
      <EstimatesNote className="-mt-2 mb-4" />

      <div className="space-y-3">
        {/* From the plans */}
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <Sparkles size={18} className="text-bite-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-ink-900 text-sm">From your dietician's plans</h3>
              {planAverage ? (
                <>
                  <p className="text-sm text-ink-700 mt-0.5">
                    Averaged over {planAverage.days} full days:{' '}
                    <strong className="font-mono text-ink-900">{planAverage.perDay.calories} kcal</strong>{' '}
                    · Protein {planAverage.perDay.protein} g · Carbs {planAverage.perDay.carbs} g
                    · Fat {planAverage.perDay.fat} g · Fibre {planAverage.perDay.fiber} g
                  </p>
                  <p className="text-xs text-ink-500 mt-1">
                    Individual days ranged from {planAverage.min} to {planAverage.max} kcal.
                  </p>
                  <button className="btn-primary mt-3" onClick={() => planTargets && setTargets(planTargets)}>
                    Use these
                  </button>
                </>
              ) : (
                <p className="text-sm text-ink-500 mt-0.5">No plan data available.</p>
              )}
            </div>
          </div>
        </div>

        {/* Calculator */}
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <Calculator size={18} className="text-bite-700 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-ink-900 text-sm">Work it out from your body</h3>
                <p className="text-xs text-ink-500">
                  Mifflin-St Jeor, then adjusted for activity and goal. Every step is shown
                  below, so you can check the arithmetic rather than take a number on trust.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label" htmlFor="tdee-sex">Sex</label>
                  <select id="tdee-sex" className="input" value={profile.tdee.sex ?? ''}
                    onChange={(e) => setTdee({ ...profile.tdee, sex: (e.target.value || undefined) as Sex })}>
                    <option value="">Not set</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="tdee-age">Age</label>
                  <input id="tdee-age" type="number" className="input" value={profile.tdee.age ?? ''}
                    onChange={(e) => setTdee({ ...profile.tdee, age: Number(e.target.value) || undefined })} />
                </div>
                <div>
                  <label className="label" htmlFor="tdee-height">Height (cm)</label>
                  <input id="tdee-height" type="number" className="input" value={profile.tdee.heightCm ?? ''}
                    onChange={(e) => setTdee({ ...profile.tdee, heightCm: Number(e.target.value) || undefined })} />
                </div>
                <div>
                  <label className="label" htmlFor="tdee-weight">Weight (kg)</label>
                  <input id="tdee-weight" type="number" className="input" value={profile.tdee.weightKg ?? ''}
                    onChange={(e) => setTdee({ ...profile.tdee, weightKg: Number(e.target.value) || undefined })} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="label" htmlFor="tdee-goal">Goal</label>
                  <select id="tdee-goal" className="input" value={profile.tdee.goal ?? 'maintain'}
                    onChange={(e) => setTdee({ ...profile.tdee, goal: e.target.value as Goal })}>
                    <option value="lose">Lose weight</option>
                    <option value="maintain">Maintain</option>
                    <option value="gain">Gain</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label" htmlFor="tdee-activity">Activity</label>
                <select id="tdee-activity" className="input" value={profile.tdee.activity ?? 'light'}
                  onChange={(e) => setTdee({ ...profile.tdee, activity: e.target.value as ActivityLevel })}>
                  {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((a) => (
                    <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>
                  ))}
                </select>
              </div>

              {tdeeTargets ? (
                <>
                  <p className="text-sm text-ink-700">
                    Maintenance is about <strong className="font-mono">{Math.round(tdee ?? 0)} kcal</strong>;
                    your goal gives{' '}
                    <strong className="font-mono text-ink-900">{tdeeTargets.calories} kcal</strong>{' '}
                    · Protein {tdeeTargets.protein} g · Carbs {tdeeTargets.carbs} g · Fat {tdeeTargets.fat} g
                  </p>
                  <details className="card-soft p-3">
                    <summary className="text-xs font-bold uppercase tracking-wide text-ink-500 cursor-pointer">
                      How that was worked out
                    </summary>
                    <ol className="mt-2 space-y-2">
                      {working.map((step) => (
                        <li key={step.label} className="text-xs">
                          <p className="text-ink-900 font-semibold">{step.label}</p>
                          <p className="flex flex-wrap items-baseline gap-x-2 text-ink-500">
                            <span className="font-mono">{step.working}</span>
                            <span className="font-mono text-ink-900">= {step.result}</span>
                          </p>
                        </li>
                      ))}
                    </ol>
                    <p className="text-xs text-ink-500 mt-3">
                      Mifflin-St Jeor (1990) for the resting rate, its published activity
                      multipliers, a 20% cut as the usual sustainable rate of loss, protein at
                      1.6 g per kg to hold onto muscle while losing, fat at 30% of energy, and
                      fibre at 14 g per 1000 kcal from the dietary reference intakes. It is an
                      estimate: what the scale does over a fortnight beats any formula.
                    </p>
                  </details>

                  <button className="btn-primary" onClick={() => setTargets(tdeeTargets)}>Use these</button>
                </>
              ) : (
                <p className="text-xs text-ink-500">Fill in sex, age, height and weight to see a number.</p>
              )}
            </div>
          </div>
        </div>

        <ManualTargets
          initial={shown}
          onSave={(targets) => setTargets(targets)}
        />
      </div>
    </section>
  )
}
