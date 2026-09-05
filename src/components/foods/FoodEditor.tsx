import { useMemo, useState } from 'react'
import { useDialog } from '../../lib/useDialog'
import { readAmount, MOST } from '../../lib/amounts'
import { X, Trash2, Undo2, Combine } from 'lucide-react'
import type { Food, MedCategory, MedTier, FoodState } from '../../types'
import { useFoodStore, useFoodsMergedInto, isCuratedFood } from '../../store/useFoodStore'
import { useRecipes } from '../../store/useRecipeStore'
import { useMealPlanStore } from '../../store/useMealPlanStore'
import { saltFromSodium } from '../../lib/nutrition'
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../../lib/categories'

/**
 * The ceiling for one of a food's own figures, all of them per 100 g.
 *
 * A macro cannot exceed the 100 g it is measured in, calories top out around
 * pure fat, and sodium's ceiling is salt itself.
 */
function ceiling(key: string): number {
  if (key === 'calories') return MOST.caloriesPer100g
  if (key === 'sodium') return MOST.sodiumPer100g
  return MOST.gramsPer100g
}

/**
 * Editing a food, whether it came with the app or from a search.
 *
 * The 122 curated foods live in code, so editing one keeps your own copy of it
 * with the original underneath, the same copy-on-write the recipes use, and
 * the same reason Revert and Delete are separate buttons: undoing your changes
 * and getting rid of the food are different intentions.
 *
 * Nutrition is per 100 g throughout, because that is what every source states
 * and what every calculation in the app expects. A blank is unknown, not zero.
 */
export default function FoodEditor({ food, onClose }: { food: Food; onClose: () => void }) {
  const panel = useDialog<HTMLDivElement>(onClose)
  const { updateFood, removeFood, revertFood, unmergeFood, custom } = useFoodStore()
  const folded = useFoodsMergedInto(food.id)
  const recipes = useRecipes()
  const plan = useMealPlanStore((s) => s.plan)

  const [draft, setDraft] = useState<Food>(food)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const edited = custom.some((f) => f.id === food.id)
  const canRevert = edited && isCuratedFood(food.id)

  /** What would be left pointing at nothing, recipes and planned snack lines. */
  const usedBy = useMemo(() => {
    const inRecipes = recipes.filter((r) =>
      r.components.some((c) => c.kind === 'food' && c.foodId === food.id)).length
    const inPlan = plan.reduce((n, day) => n + day.meals.reduce(
      (m, meal) => m + meal.entries.filter((e) => e.kind === 'food' && e.foodId === food.id).length, 0), 0)
    return { inRecipes, inPlan }
  }, [recipes, plan, food.id])

  function patch(updates: Partial<Food>) {
    setDraft((d) => ({ ...d, ...updates }))
  }

  /** A blank means unknown, so it is removed rather than stored as a zero. */
  function setNutrient(key: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium', raw: string) {
    // Clamped rather than merely floored. `min` on the element blocks the
    // stepper arrows and nothing else, so 999999 went straight through.
    const value = raw === '' ? undefined : readAmount(raw, { max: ceiling(key), places: 1 })
    setDraft((d) => {
      const per100g = { ...d.per100g }
      if (value == null && key !== 'calories' && key !== 'protein' && key !== 'carbs' && key !== 'fat') {
        delete per100g[key]
      } else {
        per100g[key] = value ?? 0
      }
      return { ...d, per100g }
    })
  }

  function save() {
    if (!draft.names.en.trim()) return
    updateFood(food.id, { ...draft, names: { ...draft.names, en: draft.names.en.trim() } })
    onClose()
  }

  const salt = saltFromSodium(draft.per100g.sodium)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className="bg-paper w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-200">
          <h2 className="text-base font-extrabold text-ink-900 min-w-0 truncate">
            {draft.names.en || 'Food'}
          </h2>
          <button className="btn-ghost btn-icon shrink-0" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="label">Name (English)</label>
            <input className="input" value={draft.names.en} aria-label="Food name"
              onChange={(e) => patch({ names: { ...draft.names, en: e.target.value } })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Romanian</label>
              <input className="input" value={draft.names.ro ?? ''}
                onChange={(e) => patch({ names: { ...draft.names, ro: e.target.value || undefined } })} />
            </div>
            <div>
              <label className="label">Hungarian</label>
              <input className="input" value={draft.names.hu ?? ''}
                onChange={(e) => patch({ names: { ...draft.names, hu: e.target.value || undefined } })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Category</label>
              <select className="input" value={draft.category} aria-label="Category"
                onChange={(e) => patch({ category: e.target.value as MedCategory })}>
                {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="label">How often</label>
              <select className="input" value={draft.medTier} aria-label="How often"
                onChange={(e) => patch({ medTier: e.target.value as MedTier })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="moderate">Moderation</option>
                <option value="rare">Rarely</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Weighed</label>
            <select className="input" value={draft.state} aria-label="Weighed"
              onChange={(e) => patch({ state: e.target.value as FoodState })}>
              <option value="as-sold">As sold</option>
              <option value="raw">Raw</option>
              <option value="dry">Dry</option>
              <option value="cooked">Cooked</option>
            </select>
            <p className="text-xs text-ink-500 mt-1">
              50 g of dry bulgur is about three times the calories of 50 g cooked, so this is part
              of what the food is rather than a note about it.
            </p>
          </div>

          <p className="text-xs font-bold uppercase tracking-wide text-ink-500 pt-1">Per 100 g</p>
          <div className="grid grid-cols-4 gap-2">
            {([['calories', 'kcal'], ['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']] as const).map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type="number" min={0} max={ceiling(key)} className="input px-2" aria-label={label}
                  value={draft.per100g[key] ?? ''}
                  onChange={(e) => setNutrient(key, e.target.value)} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([['fiber', 'Fibre g'], ['sugar', 'Sugar g'], ['sodium', 'Sodium mg']] as const).map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type="number" min={0} max={ceiling(key)} className="input px-2" aria-label={label}
                  value={draft.per100g[key] ?? ''}
                  onChange={(e) => setNutrient(key, e.target.value)} />
              </div>
            ))}
          </div>
          {salt != null && (
            <p className="text-xs text-ink-500 -mt-1">About {salt.toFixed(2)} g of salt.</p>
          )}
          <p className="text-xs text-ink-500">
            Leave anything you do not know blank. A zero here says there is none of it, which is a
            different claim.
          </p>

          {draft.provenance?.source && draft.provenance.source !== 'custom' && (
            <div className="card-soft p-3 text-xs text-ink-700 space-y-0.5">
              <p>
                From <strong>{draft.provenance.source === 'usda' ? 'USDA FoodData Central' : 'Open Food Facts'}</strong>
                {draft.provenance.externalId ? ` · ${draft.provenance.externalId}` : ''}
              </p>
              {draft.provenance.retrievedAt && (
                <p className="text-ink-500">
                  Fetched {new Date(draft.provenance.retrievedAt).toLocaleDateString('en-GB')}
                </p>
              )}
            </div>
          )}

          {folded.length > 0 && (
            <div className="card-soft p-3 flex items-start gap-2.5">
              <Combine size={16} className="text-ink-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-900">
                  {folded.length} duplicate {folded.length === 1 ? 'entry was' : 'entries were'} folded
                  into this one. Anything that named them resolves here.
                </p>
                <button className="btn-ghost px-0 text-ink-500" onClick={() => unmergeFood(food.id)}>
                  <Undo2 size={15} /> Put them back
                </button>
              </div>
            </div>
          )}

          <div className="pt-1 space-y-2 border-t border-border-200">
            {canRevert && (
              <button className="btn-secondary w-full mt-4" onClick={() => { revertFood(food.id); onClose() }}>
                <Undo2 size={15} /> Undo my changes to this one
              </button>
            )}

            {confirmDelete ? (
              <div className="card-soft p-3 space-y-2">
                <p className="text-sm text-ink-900 font-semibold">Delete “{draft.names.en}”?</p>
                <p className="text-xs text-ink-700">
                  It will be removed from your foods and from every search and picker.{' '}
                  {usedBy.inRecipes || usedBy.inPlan
                    ? `The ${usedBy.inRecipes} ${usedBy.inRecipes === 1 ? 'recipe' : 'recipes'} and ${usedBy.inPlan} planned ${usedBy.inPlan === 1 ? 'line' : 'lines'} that use it keep their numbers. Nothing you have already eaten is affected.`
                    : 'Nothing uses it, so nothing else changes.'}{' '}
                  You can restore it from Settings.
                </p>
                <div className="flex gap-2">
                  <button className="btn-danger flex-1" onClick={() => { removeFood(food.id); onClose() }}>
                    Yes, delete
                  </button>
                  <button className="btn-secondary flex-1" onClick={() => setConfirmDelete(false)}>Keep it</button>
                </div>
              </div>
            ) : (
              <button className={`btn-ghost w-full text-coral-600 ${canRevert ? '' : 'mt-4'}`}
                onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> Delete this food
              </button>
            )}
          </div>
        </div>

        <footer className="flex gap-2 px-5 py-4 border-t border-border-200">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={save} disabled={!draft.names.en.trim()}>
            Save changes
          </button>
        </footer>
      </div>
    </div>
  )
}
