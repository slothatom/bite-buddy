import { useMemo, useState } from 'react'
import { useResolvableRecipes } from '../../store/useRecipeStore'
import { useResolvableFoods } from '../../store/useFoodStore'
import { useMealPlanStore } from '../../store/useMealPlanStore'
import { auditFoods } from '../../lib/foodAudit'
import FoodEditor from '../foods/FoodEditor'
import type { Food } from '../../types'
import { SectionHeading } from '../ui'

/**
 * Recipes you deleted, and the way back.
 *
 * Deleting takes a recipe out of every list, search and picker, but does not
 * destroy it, a day you planned months ago names it by id, and throwing it away
 * would blank that day. This is where they wait. It disappears when there is
 * nothing in it, so it is not a permanent reminder of things you got rid of on
 * purpose.
 */
/**
 * The food check, run here rather than only in the weekly job.
 *
 * The job checks what ships with the app. This checks what you have actually
 * got, which includes everything imported from USDA and Open Food Facts, where
 * the wrong numbers come from. It is the same rules either way, and it changes
 * nothing on its own: each finding opens the food so you can decide.
 */
export function FoodCheckPanel() {
  const foods = useResolvableFoods()
  const recipes = useResolvableRecipes()
  const plan = useMealPlanStore((s) => s.plan)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)

  const inUse = useMemo(() => {
    const ids = new Set<string>()
    const walk = (components: { kind: string; foodId?: string }[]) => {
      for (const c of components) if (c.kind === 'food' && c.foodId) ids.add(c.foodId)
    }
    for (const r of recipes) walk(r.components)
    for (const day of plan) for (const meal of day.meals) walk(meal.entries)
    return ids
  }, [recipes, plan])

  // The clock is read once, when the panel is first rendered. Reading it
  // during render would make the result depend on when React happened to
  // re-run this, which is the whole point of the rule against it.
  const [now] = useState(() => Date.now())

  const report = useMemo(
    () => auditFoods(foods, { inUse, now }),
    [foods, inUse, now],
  )

  // Missing figures are counted, not listed: there are a hundred of them and
  // they are all the same sentence.
  const listed = report.findings.filter((f) => f.kind !== 'gap')
  const gaps = report.findings.length - listed.length
  const wrong = listed.filter((f) => f.severity === 'wrong').length

  return (
    <section>
      <SectionHeading>Food check</SectionHeading>
      <div className="card p-4 space-y-3">
        <p className="text-sm text-ink-700">
          {report.checked} foods checked against their own numbers: calories against macros,
          the group against the guide, and what is missing. Nothing is changed automatically.
        </p>

        <p className="text-sm text-ink-900">
          {wrong > 0 && (
            <strong className="text-coral-600">
              {wrong} with numbers that cannot be right.{' '}
            </strong>
          )}
          {listed.length - wrong > 0
            ? `${listed.length - wrong} worth a look.`
            : wrong === 0 ? 'Nothing looks wrong.' : ''}
          {gaps > 0 && ` ${gaps} missing a salt or fibre figure.`}
        </p>

        {listed.length > 0 && (
          <>
            <button className="btn-secondary" onClick={() => setOpen(!open)}>
              {open ? 'Hide' : 'Show me'}
            </button>

            {open && (
              <ul className="space-y-2">
                {listed.slice(0, 40).map((f, i) => (
                  <li key={`${f.foodId}-${i}`} className="card-soft p-3">
                    <button
                      className="text-left w-full"
                      onClick={() => setEditing(foods.find((x) => x.id === f.foodId) ?? null)}
                    >
                      <p className="text-sm font-semibold text-ink-900">{f.name}</p>
                      <p className="text-xs text-ink-700">{f.detail}</p>
                      {f.suggestion && <p className="text-xs text-ink-500 mt-0.5">{f.suggestion}</p>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {editing && <FoodEditor food={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}
