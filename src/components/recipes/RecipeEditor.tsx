import { useMemo, useState, type ReactNode } from 'react'
import { Search, X, Trash2, Plus, Undo2, GripVertical } from 'lucide-react'
import type { Component, Recipe, RecipeTag } from '../../types'
import { useRecipeStore, useRecipes, isBuiltIn } from '../../store/useRecipeStore'
import { useFoods } from '../../store/useFoodStore'
import { useMealPlanStore } from '../../store/useMealPlanStore'
import { useNutritionContext } from '../../store/useNutrition'
import { recipePerServing, componentNutrients, roundNutrients } from '../../lib/nutrition'
import { buildFoodIndex, searchFoods } from '../../lib/foodSearch'
import { normaliseTerm } from '../../lib/units'
import {
  RECIPE_GROUPS, GROUP_LABELS, RECIPE_LABELS, LABEL_DEFINITIONS,
  groupsOf, hasLabel, withGroups, withLabel,
  type RecipeGroup, type RecipeLabel,
} from '../../lib/recipeGroups'
import { NutrientSummary } from '../ui'

/**
 * Editing a recipe, whether it came from the dietician or from you.
 *
 * The 275 shipped recipes live in code, so "editing" one really means keeping
 * your own copy of it — the store does that on the first change and the original
 * stays available to come back to. That is why this offers Revert as well as
 * Delete: undoing your edits and getting rid of the recipe are different
 * intentions, and one button cannot mean both.
 *
 * Nothing here types in calories. Ingredients are weighed foods or other
 * recipes, and the numbers at the bottom are derived as you go — the same
 * derivation the planner uses, so a recipe cannot disagree with its own totals.
 */
export default function RecipeEditor({
  recipe, onClose, onSaved,
}: {
  /** null to write a new one. */
  recipe: Recipe | null
  onClose: () => void
  onSaved?: (recipe: Recipe) => void
}) {
  const { addRecipe, updateRecipe, removeRecipe, revertRecipe, custom } = useRecipeStore()
  const ctx = useNutritionContext()
  const plan = useMealPlanStore((s) => s.plan)

  const [draft, setDraft] = useState<Recipe>(() => recipe ?? blankRecipe())
  const [picking, setPicking] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isNew = recipe === null
  const edited = !isNew && custom.some((r) => r.id === draft.id)
  const canRevert = edited && isBuiltIn(draft.id)

  const perServing = roundNutrients(recipePerServing(draft, ctx))
  const groups = groupsOf(draft)

  /** How many planned meals point at this recipe — deleting it would blank them. */
  const usedInPlan = useMemo(
    () => plan.reduce(
      (n, day) => n + day.meals.reduce(
        (m, meal) => m + meal.entries.filter((e) => e.kind === 'recipe' && e.recipeId === draft.id).length, 0), 0),
    [plan, draft.id],
  )

  function patch(updates: Partial<Recipe>) {
    setDraft((d) => ({ ...d, ...updates }))
  }

  function toggleGroup(group: RecipeGroup) {
    const next = groups.includes(group)
      ? groups.filter((g) => g !== group)
      : [...groups.filter((g) => g !== 'dish'), group]

    // Clearing every meal makes it a dish; that is the same thing as choosing
    // Dishes, so the two paths land in one place.
    patch({ tags: withGroups(draft.tags, next.length ? next : ['dish']) })
  }

  function toggleLabel(label: RecipeLabel) {
    patch({ tags: withLabel(draft.tags, label, !hasLabel(draft, label)) })
  }

  function save() {
    const name = draft.name.en.trim()
    if (!name) return

    const cleaned: Recipe = {
      ...draft,
      name: {
        en: name,
        ro: draft.name.ro?.trim() || undefined,
        hu: draft.name.hu?.trim() || undefined,
      },
      servings: Math.max(1, Math.round(draft.servings) || 1),
      steps: draft.steps.filter((s) => s.instruction.trim()),
    }

    if (isNew) addRecipe(cleaned)
    else updateRecipe(cleaned.id, cleaned)
    onSaved?.(cleaned)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-paper w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-paper flex items-center justify-between gap-3 px-5 py-4 border-b border-border-200 rounded-t-2xl">
          <h2 className="text-base font-extrabold text-ink-900 min-w-0 truncate">
            {isNew ? 'New recipe' : `Edit ${draft.name.en || 'recipe'}`}
          </h2>
          <button className="btn-ghost btn-icon shrink-0" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* ─── What it is ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                className="input w-16 text-center text-xl shrink-0"
                value={draft.emoji}
                onChange={(e) => patch({ emoji: [...e.target.value].slice(-2).join('') })}
                aria-label="Emoji"
              />
              <input
                className="input min-w-0"
                placeholder="What is it called?"
                value={draft.name.en}
                onChange={(e) => patch({ name: { ...draft.name, en: e.target.value } })}
                aria-label="Recipe name"
                autoFocus={isNew}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="input" placeholder="Romanian (optional)"
                value={draft.name.ro ?? ''}
                onChange={(e) => patch({ name: { ...draft.name, ro: e.target.value } })}
                aria-label="Romanian name"
              />
              <input
                className="input" placeholder="Hungarian (optional)"
                value={draft.name.hu ?? ''}
                onChange={(e) => patch({ name: { ...draft.name, hu: e.target.value } })}
                aria-label="Hungarian name"
              />
            </div>
          </div>

          {/* ─── Where it belongs ───────────────────────────────────────── */}
          <Field label="When do you eat it?">
            <div className="flex flex-wrap gap-1.5">
              {RECIPE_GROUPS.map((g) => (
                <button
                  key={g}
                  onClick={() => toggleGroup(g)}
                  className={groups.includes(g) ? 'chip-on' : 'chip-off'}
                >
                  {GROUP_LABELS[g]}
                </button>
              ))}
            </div>
            {groups.includes('dish') && (
              <p className="text-xs text-ink-500 mt-2">
                A dish is something you cook and then use inside meals, rather than a meal itself.
              </p>
            )}
          </Field>

          <Field label="Anything worth noting?">
            <div className="flex flex-wrap gap-1.5">
              {RECIPE_LABELS.map((l) => (
                <button
                  key={l}
                  onClick={() => toggleLabel(l)}
                  className={hasLabel(draft, l) ? 'chip-on' : 'chip-off'}
                >
                  {LABEL_DEFINITIONS[l].label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Makes" unit="servings" value={draft.servings} min={1}
              onChange={(v) => patch({ servings: v })} />
            <NumberField label="Prep" unit="min" value={draft.prepMinutes}
              onChange={(v) => patch({ prepMinutes: v })} />
            <NumberField label="Cook" unit="min" value={draft.cookMinutes}
              onChange={(v) => patch({ cookMinutes: v })} />
          </div>

          {/* ─── What goes in ───────────────────────────────────────────── */}
          <Field label="What goes in">
            <div className="space-y-1.5">
              {draft.components.map((c, i) => (
                <ComponentRow
                  key={`${i}-${c.kind === 'food' ? c.foodId : c.recipeId}`}
                  component={c}
                  onChange={(next) => patch({
                    components: draft.components.map((x, j) => (j === i ? next : x)),
                  })}
                  onRemove={() => patch({ components: draft.components.filter((_, j) => j !== i) })}
                />
              ))}
              {!draft.components.length && (
                <p className="text-sm text-ink-500 py-2">
                  Nothing yet — add a food or another recipe and the numbers below fill themselves in.
                </p>
              )}
            </div>
            <button className="btn-secondary mt-2" onClick={() => setPicking(true)}>
              <Plus size={15} /> Add ingredient
            </button>
          </Field>

          {/* ─── How to make it ─────────────────────────────────────────── */}
          <Field label="How to make it">
            <div className="space-y-2">
              {draft.steps.map((s, i) => (
                <div key={s.id} className="flex items-start gap-2">
                  <span className="shrink-0 w-6 h-6 mt-1.5 rounded-full bg-bite-100 text-bite-800 text-xs font-bold grid place-items-center">
                    {i + 1}
                  </span>
                  <textarea
                    className="input min-w-0 flex-1 resize-y min-h-[44px]"
                    rows={2}
                    value={s.instruction}
                    placeholder="What happens at this step?"
                    onChange={(e) => patch({
                      steps: draft.steps.map((x, j) => (j === i ? { ...x, instruction: e.target.value } : x)),
                    })}
                    aria-label={`Step ${i + 1}`}
                  />
                  <button
                    className="btn-ghost btn-icon shrink-0 mt-1 text-ink-500"
                    onClick={() => patch({ steps: draft.steps.filter((_, j) => j !== i) })}
                    aria-label={`Remove step ${i + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              className="btn-secondary mt-2"
              onClick={() => patch({
                steps: [...draft.steps, { id: newStepId(draft.steps.length), instruction: '', timerSeconds: 0 }],
              })}
            >
              <Plus size={15} /> Add step
            </button>
            {!draft.steps.length && draft.sourceLine && (
              <p className="text-xs text-ink-500 mt-2">
                This one came from a plan, so it has never had a method. Adding one here keeps it for next time.
              </p>
            )}
          </Field>

          {/* ─── What it comes to ───────────────────────────────────────── */}
          <div className="card-soft p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 mb-1">Per serving</p>
            <p className="text-2xl font-extrabold font-mono text-ink-900 mb-3">
              {Math.round(perServing.calories)}
              <span className="text-sm font-semibold text-ink-500 ml-1">kcal</span>
            </p>
            <NutrientSummary n={perServing} />
          </div>

          {/* ─── Getting rid of it ──────────────────────────────────────── */}
          {!isNew && (
            <div className="pt-1 space-y-2 border-t border-border-200">
              {canRevert && (
                <button className="btn-secondary w-full mt-4" onClick={() => { revertRecipe(draft.id); onClose() }}>
                  <Undo2 size={15} /> Undo my changes to this one
                </button>
              )}
              {confirmDelete ? (
                <div className="card-soft p-3 space-y-2">
                  <p className="text-sm text-ink-900 font-semibold">Delete “{draft.name.en}”?</p>
                  <p className="text-xs text-ink-700">
                    {usedInPlan > 0
                      ? `It is in your plan ${usedInPlan} ${usedInPlan === 1 ? 'time' : 'times'} — those entries will stop showing what they were.`
                      : isBuiltIn(draft.id)
                        ? 'It came with the app, so it is hidden rather than destroyed. You can bring it back from Settings.'
                        : 'This one is yours, so it goes for good.'}
                  </p>
                  <div className="flex gap-2">
                    <button className="btn-danger flex-1" onClick={() => { removeRecipe(draft.id); onClose() }}>
                      Yes, delete
                    </button>
                    <button className="btn-secondary flex-1" onClick={() => setConfirmDelete(false)}>
                      Keep it
                    </button>
                  </div>
                </div>
              ) : (
                <button className={`btn-ghost w-full text-coral-600 ${canRevert ? '' : 'mt-4'}`} onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={15} /> Delete this recipe
                </button>
              )}
            </div>
          )}
        </div>

        <footer className="sticky bottom-0 bg-paper flex gap-2 px-5 py-4 border-t border-border-200">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1" onClick={save} disabled={!draft.name.en.trim()}>
            {isNew ? 'Add recipe' : 'Save changes'}
          </button>
        </footer>
      </div>

      {picking && (
        <IngredientPicker
          excludeRecipeId={draft.id}
          onClose={() => setPicking(false)}
          onAdd={(c) => { patch({ components: [...draft.components, c] }); setPicking(false) }}
        />
      )}
    </div>
  )
}

/** One ingredient line: what it is, how much of it, and what that costs. */
function ComponentRow({
  component, onChange, onRemove,
}: {
  component: Component
  onChange: (next: Component) => void
  onRemove: () => void
}) {
  const ctx = useNutritionContext()
  const name = component.kind === 'food'
    ? ctx.foods.get(component.foodId)?.names.en ?? component.foodId
    : ctx.recipes.get(component.recipeId)?.name.en ?? component.recipeId
  const kcal = Math.round(componentNutrients(component, ctx).calories)

  return (
    <div className="flex items-center gap-2 py-1">
      <GripVertical size={14} className="shrink-0 text-ink-300" aria-hidden />
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-ink-900 truncate">{name}</span>
        <span className="block text-xs font-mono text-ink-500">{kcal} kcal</span>
      </span>
      <div className="relative shrink-0">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={component.kind === 'food' ? 5 : 0.5}
          className="input w-20 pr-7 text-right"
          value={component.kind === 'food' ? component.grams : component.servings}
          onChange={(e) => {
            const v = Math.max(0, Number(e.target.value))
            onChange(component.kind === 'food'
              ? { ...component, grams: v }
              : { ...component, servings: v })
          }}
          aria-label={`Amount of ${name}`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-500 pointer-events-none">
          {component.kind === 'food' ? 'g' : '×'}
        </span>
      </div>
      <button className="btn-ghost btn-icon shrink-0 text-ink-500" onClick={onRemove} aria-label={`Remove ${name}`}>
        <Trash2 size={16} />
      </button>
    </div>
  )
}

/**
 * Picks a food or another recipe to add.
 *
 * Recipes are offered as well as foods because that is how the dietician's batch
 * cooking works — a lunch is often "one serving of the lentil stew" plus bread.
 * The recipe being edited is excluded, since a recipe containing itself has no
 * finite calorie count.
 */
function IngredientPicker({
  excludeRecipeId, onClose, onAdd,
}: {
  excludeRecipeId: string
  onClose: () => void
  onAdd: (component: Component) => void
}) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'foods' | 'recipes'>('foods')
  const foods = useFoods()
  const recipes = useRecipes()
  const ctx = useNutritionContext()

  const foodIndex = useMemo(() => buildFoodIndex(foods), [foods])
  const matchedFoods = useMemo(() => searchFoods(query, foodIndex, 40), [query, foodIndex])
  const matchedRecipes = useMemo(() => {
    const n = normaliseTerm(query)
    return recipes
      .filter((r) => r.id !== excludeRecipeId)
      .filter((r) => !n || normaliseTerm([r.name.en, r.name.ro, r.name.hu].filter(Boolean).join(' ')).includes(n))
      .slice(0, 40)
  }, [recipes, query, excludeRecipeId])

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4"
      onClick={onClose}>
      <div
        className="bg-paper w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[80vh] flex flex-col shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border-200">
          <h3 className="text-base font-extrabold text-ink-900">Add an ingredient</h3>
          <button className="btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="px-5 pt-4 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              className="input pl-9" autoFocus placeholder="Search foods and recipes…"
              value={query} onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit">
            {(['foods', 'recipes'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`capitalize ${tab === t ? 'tab-on' : 'tab-off'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-0.5">
          {tab === 'foods' && matchedFoods.map((f) => (
            <button
              key={f.id}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-cream-50 text-left"
              onClick={() => onAdd({ kind: 'food', foodId: f.id, grams: f.units[0]?.grams ?? 100 })}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-ink-900 truncate">{f.names.en}</span>
                <span className="block text-xs font-mono text-ink-500">
                  {Math.round(f.per100g.calories)} kcal / 100 g
                </span>
              </span>
              <Plus size={16} className="shrink-0 text-ink-500" />
            </button>
          ))}
          {tab === 'recipes' && matchedRecipes.map((r) => (
            <button
              key={r.id}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-cream-50 text-left"
              onClick={() => onAdd({ kind: 'recipe', recipeId: r.id, servings: 1 })}
            >
              <span className="text-lg shrink-0">{r.emoji}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-ink-900 truncate">{r.name.en}</span>
                <span className="block text-xs font-mono text-ink-500">
                  {Math.round(recipePerServing(r, ctx).calories)} kcal a serving
                </span>
              </span>
              <Plus size={16} className="shrink-0 text-ink-500" />
            </button>
          ))}
          {((tab === 'foods' && !matchedFoods.length) || (tab === 'recipes' && !matchedRecipes.length)) && (
            <p className="text-sm text-ink-500 text-center py-8">
              Nothing matching that. Foods can be added on the Foods screen.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500 mb-2">{label}</p>
      {children}
    </div>
  )
}

function NumberField({
  label, unit, value, onChange, min = 0,
}: {
  label: string
  unit: string
  value: number
  onChange: (v: number) => void
  min?: number
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-xs font-bold uppercase tracking-wide text-ink-500 mb-1">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        className="input w-full text-right"
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
      />
      <span className="block text-[11px] text-ink-500 mt-0.5 text-right">{unit}</span>
    </label>
  )
}

function blankRecipe(): Recipe {
  return {
    id: `recipe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: { en: '' },
    emoji: '🍽️',
    servings: 1,
    prepMinutes: 0,
    cookMinutes: 0,
    components: [],
    steps: [],
    tags: [] as RecipeTag[],
    createdAt: new Date().toISOString(),
  }
}

function newStepId(index: number): string {
  return `step-${Date.now().toString(36)}-${index}`
}
