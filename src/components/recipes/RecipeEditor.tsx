import { useMemo, useState, type ReactNode } from 'react'
import {
  Search, X, Trash2, Plus, Undo2, GripVertical, Loader2, Download, ClipboardPaste, Sparkles,
} from 'lucide-react'
import type {
  Difficulty, DishCategory, RecipeComponent, PortionUnit, QuickFilter, Recipe, RecipeTag,
} from '../../types'
import { DIFFICULTY_LABELS } from '../../types'
import { safeUrl } from '../../lib/links'
import { useRecipeStore, isBuiltIn } from '../../store/useRecipeStore'
import { useFoods, useFoodStore } from '../../store/useFoodStore'
import { useIngredientSearch, type IngredientSearch } from '../../store/useIngredientSearch'
import { importedFood, alreadyHave } from '../../lib/foodImport'
import type { NutritionResult } from '../../services/nutritionApi'
import { draftFromText } from '../../services/recipeAssistant'
import { componentsFrom, resolveIngredients, type RecipeDraft } from '../../lib/recipeDraft'
import { buildFoodIndex } from '../../lib/foodSearch'
import { useMealPlanStore } from '../../store/useMealPlanStore'
import { useNutritionContext } from '../../store/useNutrition'
import { recipePerServing, componentNutrients, reportPerServing, roundNutrients } from '../../lib/nutrition'
import {
  RECIPE_GROUPS, GROUP_LABELS, groupsOf, withGroups, type RecipeGroup,
} from '../../lib/recipeGroups'
import {
  DISH_CATEGORIES, CATEGORY_LABELS, CATEGORY_MEAL_TIMES,
  QUICK_FILTERS, QUICK_FILTER_DEFINITIONS, hasQuickFilter, withQuickFilter,
} from '../../lib/dishCategories'
import { NutrientSummary } from '../ui'
import { UNIT_LABELS, unitsFor, toGrams, fromGrams, defaultUnit, APPROXIMATE_UNITS } from '../../lib/portions'

/**
 * Editing a recipe, whether it came from the dietician or from you.
 *
 * The 275 shipped recipes live in code, so "editing" one really means keeping
 * your own copy of it, the store does that on the first change and the original
 * stays available to come back to. That is why this offers Revert as well as
 * Delete: undoing your edits and getting rid of the recipe are different
 * intentions, and one button cannot mean both.
 *
 * Nothing here types in calories. Ingredients are weighed foods or other
 * recipes, and the numbers at the bottom are derived as you go, the same
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
  const [pasting, setPasting] = useState(false)
  /**
   * Ingredients the assistant read but could not match to a food you have.
   *
   * Kept beside the draft rather than dropped, because "handful of coriander"
   * is a real line in a real recipe and the person reading it knows what to do
   * with it. Shown until they are resolved or the recipe is saved without them.
   */
  const [unmatched, setUnmatched] = useState<string[]>([])

  const isNew = recipe === null
  const edited = !isNew && custom.some((r) => r.id === draft.id)
  const canRevert = edited && isBuiltIn(draft.id)

  const report = reportPerServing(draft, ctx)
  const perServing = roundNutrients(report.total)
  const groups = groupsOf(draft)

  /** How many planned meals point at this recipe, deleting it would blank them. */
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

  function toggleFilter(filter: QuickFilter) {
    patch({ quickFilters: withQuickFilter(draft.quickFilters, filter, !hasQuickFilter(draft, filter)) })
  }

  /**
   * Choosing what a dish *is* suggests when you eat it, but only ever suggests.
   * On a recipe that already has meal times, whether from the plans or from you,
   * they are left exactly as they are.
   */
  function chooseCategory(category: DishCategory) {
    if (groups.includes('dish') && !draft.tags.some((t) => ['breakfast', 'lunch', 'dinner', 'snack'].includes(t))) {
      patch({ category, tags: withGroups(draft.tags, CATEGORY_MEAL_TIMES[category]) })
      return
    }
    patch({ category })
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
      description: draft.description?.trim() || undefined,
      // Stored only if it is a link this app would actually follow, so a bad
      // one is refused at the point of typing rather than kept and skipped
      // silently at the point of showing.
      sourceUrl: safeUrl(draft.sourceUrl)?.href,
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

          {/* Offered only on a new recipe: on an existing one it would mean
              replacing what is already there, which is not what anybody wants
              from a button labelled "paste". */}
          {isNew && (
            <button className="btn-secondary w-full" onClick={() => setPasting(true)}>
              <ClipboardPaste size={15} /> Paste a recipe and let it read it
            </button>
          )}

          {unmatched.length > 0 && (
            <div className="card-soft p-3 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wide text-mustard-700">
                {unmatched.length === 1 ? 'One ingredient' : `${unmatched.length} ingredients`} not
                in your foods
              </p>
              <p className="text-sm text-ink-700">{unmatched.join(', ')}</p>
              <p className="text-xs text-ink-500">
                They were left out rather than guessed at. Add them below if they matter to the
                numbers.
              </p>
            </div>
          )}

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

          <Field label="What kind of dish is it?">
            <select
              className="input w-full"
              value={draft.category ?? ''}
              onChange={(e) => chooseCategory(e.target.value as DishCategory)}
              aria-label="Dish category"
            >
              <option value="" disabled>Pick one…</option>
              {DISH_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <p className="text-xs text-ink-500 mt-2">
              What the food is, not when you eat it or how it is served.
            </p>
          </Field>

          <Field label="Filters">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => toggleFilter(f)}
                  className={hasQuickFilter(draft, f) ? 'chip-on' : 'chip-off'}
                  title={QUICK_FILTER_DEFINITIONS[f].note}
                >
                  {QUICK_FILTER_DEFINITIONS[f].emoji} {QUICK_FILTER_DEFINITIONS[f].label}
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
                  Nothing yet. Add a food or another recipe and the numbers below fill themselves in.
                </p>
              )}
            </div>
            <button className="btn-secondary mt-2" onClick={() => setPicking(true)}>
              <Plus size={15} /> Add ingredient
            </button>
          </Field>

          {/* ─── Yours to say ───────────────────────────────────────────── */}
          <Field label="How much of an evening is it?">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => patch({ difficulty: draft.difficulty === d ? undefined : d })}
                  aria-pressed={draft.difficulty === d}
                  className={draft.difficulty === d ? 'chip-on' : 'chip-off'}
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Notes">
            <textarea
              className="input min-h-20 resize-y"
              placeholder="What to watch, what you changed, who liked it"
              aria-label="Notes"
              value={draft.description ?? ''}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>

          <Field label="Where it came from">
            <input
              className="input"
              placeholder="bbcgoodfood.com/recipes/..."
              aria-label="Where it came from"
              value={draft.sourceUrl ?? ''}
              onChange={(e) => patch({ sourceUrl: e.target.value })}
            />
            {draft.sourceUrl && !safeUrl(draft.sourceUrl) && (
              <p className="text-xs text-coral-700 mt-1">
                That is not a web address this app will link to. Only http and https.
              </p>
            )}
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
            <NutrientSummary n={perServing} partial={report.partial} />
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
                    This recipe will be removed from your recipes, and from search, the planner
                    and your favourites.{' '}
                    {usedInPlan > 0
                      ? `The ${usedInPlan} ${usedInPlan === 1 ? 'day' : 'days'} you have already planned with it keep it, marked as deleted. Historical meal data is not affected.`
                      : 'Historical meal data will not be affected.'}{' '}
                    You can restore it from Settings.
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

      {pasting && (
        <PasteRecipe
          onClose={() => setPasting(false)}
          onDraft={(read, components, missing) => {
            patch({
              name: { en: read.name },
              emoji: read.emoji,
              servings: read.servings,
              prepMinutes: read.prepMinutes,
              cookMinutes: read.cookMinutes,
              category: read.category,
              quickFilters: read.quickFilters,
              tags: read.mealTypes as Recipe['tags'],
              components,
              steps: read.steps.map((instruction, i) => ({
                id: `step-${i}`, instruction, timerSeconds: 0,
              })),
              description: read.note,
            })
            setUnmatched(missing)
            setPasting(false)
          }}
        />
      )}

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

/**
 * One ingredient line: what it is, how much of it, and what that costs.
 *
 * The amount can be entered in any unit and is stored in grams, because grams
 * are the only thing the rest of the app can work with, the grocery list adds
 * weights together and a recipe has to scale. The unit you picked is remembered
 * for the row so the number you typed is the number you see, but nothing
 * downstream ever has to know about cups.
 */
/**
 * Reading a paste into a draft.
 *
 * The assistant does the tedious half: turning "1 cup of red lentils" into 190
 * grams of a food you actually have, and a list of steps into a list of steps.
 * It does not decide anything. What comes back lands in the editor as a draft
 * with every field showing, and nothing is saved until you press save.
 *
 * Two things it is not allowed to do, and the second is the reason this is
 * safe. It cannot invent a category or a filter, only choose from the ones this
 * app has. And it cannot supply a single calorie: every number still comes from
 * your food database, so an ingredient it could not match is reported rather
 * than costed.
 */
function PasteRecipe({
  onClose, onDraft,
}: {
  onClose: () => void
  onDraft: (draft: RecipeDraft, components: RecipeComponent[], unmatched: string[]) => void
}) {
  const foods = useFoods()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function read() {
    setBusy(true)
    setError(null)
    const result = await draftFromText(text, foods)
    setBusy(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    const resolved = resolveIngredients(result.draft, foods, buildFoodIndex(foods))
    onDraft(
      result.draft,
      componentsFrom(resolved),
      resolved.filter((i) => i.matched === 'none').map((i) => i.name),
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs sm:p-4" onClick={onClose}>
      <div
        className="bg-paper w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-xl p-5 space-y-4"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="display text-lg text-ink-900">Paste a recipe</h3>
          <p className="text-sm text-ink-700">
            From a website, a message, or a few lines of your own shorthand. It comes back as a
            draft you can edit, and nothing is saved until you say so.
          </p>
        </div>

        <textarea
          className="input min-h-40 font-mono text-xs"
          autoFocus
          placeholder={'chicken thighs, 500g\nsweet potato, 3 medium\nroast 40 min at 200'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {error && (
          <p className="card-soft p-3 text-sm text-coral-700 bg-coral-50">{error}</p>
        )}

        <p className="text-xs text-ink-500">
          Ingredients are matched to foods you already have, and anything it cannot match is
          listed rather than guessed at. Every calorie still comes from your own food database.
        </p>

        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            disabled={busy || text.trim().length < 10}
            onClick={() => void read()}
          >
            {busy
              ? <><Loader2 size={15} className="animate-spin" /> Reading it</>
              : <><Sparkles size={15} /> Read it</>}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function ComponentRow({
  component, onChange, onRemove,
}: {
  component: RecipeComponent
  onChange: (next: RecipeComponent) => void
  onRemove: () => void
}) {
  const ctx = useNutritionContext()
  const food = component.kind === 'food' ? ctx.foods.get(component.foodId) : undefined
  const name = component.kind === 'food'
    ? food?.names.en ?? component.foodId
    : ctx.recipes.get(component.recipeId)?.name.en ?? component.recipeId
  const kcal = Math.round(componentNutrients(component, ctx).calories)

  const [unit, setUnit] = useState<PortionUnit>(() => (food ? defaultUnit(food) : 'g'))
  const available = food ? unitsFor(food) : []

  // What to show in the box: the stored grams expressed in the chosen unit.
  const shown = component.kind === 'food'
    ? fromGrams(component.grams, unit, food) ?? component.grams
    : component.servings

  function setAmount(value: number) {
    if (component.kind !== 'food') {
      onChange({ ...component, servings: Math.max(0, value) })
      return
    }
    const grams = toGrams(Math.max(0, value), unit, food)
    if (grams != null) onChange({ ...component, grams })
  }

  function changeUnit(next: PortionUnit) {
    // The weight does not change when you change how you are describing it -
    // 100 g stays 100 g and simply reads as 0.42 cup.
    setUnit(next)
  }

  return (
    <div className="py-1">
      <div className="flex items-center gap-2">
        <GripVertical size={14} className="shrink-0 text-ink-300" aria-hidden />
        <span className="flex-1 min-w-0">
          <span className="block text-sm text-ink-900 truncate">{name}</span>
          <span className="block text-xs font-mono text-ink-500">
            {kcal} kcal
            {component.kind === 'food' && unit !== 'g' ? ` · ${Math.round(component.grams)} g` : ''}
          </span>
        </span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={component.kind === 'food' ? (unit === 'g' || unit === 'ml' ? 5 : 0.25) : 0.5}
          className="input w-20 text-right shrink-0"
          value={Math.round(shown * 100) / 100}
          onChange={(e) => setAmount(Number(e.target.value))}
          aria-label={`Amount of ${name}`}
        />
        {component.kind === 'food' && available.length > 1 ? (
          <select
            className="input w-20 shrink-0 px-2"
            value={unit}
            onChange={(e) => changeUnit(e.target.value as PortionUnit)}
            aria-label={`Unit for ${name}`}
          >
            {available.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
          </select>
        ) : (
          <span className="w-20 shrink-0 text-sm text-ink-500 px-2">×</span>
        )}
        <button className="btn-ghost btn-icon shrink-0 text-ink-500" onClick={onRemove} aria-label={`Remove ${name}`}>
          <Trash2 size={16} />
        </button>
      </div>
      {component.kind === 'food' && APPROXIMATE_UNITS.includes(unit) && (
        <p className="text-[11px] text-ink-500 pl-6">
          {unit === 'piece' ? 'A piece of this is taken as its usual size.' : 'A rough measure. Weigh it if it matters.'}
        </p>
      )}
    </div>
  )
}

/**
 * One search for anything an ingredient could be.
 *
 * Your own foods and recipes first, because they are instant and work with no
 * signal. USDA and Open Food Facts underneath a moment later, in that order -
 * USDA is the reference for a generic ingredient, Open Food Facts is where a
 * branded yogurt lives. Picking an online one saves it to your foods, with its
 * source and id, and drops it into the recipe in a single tap; you never have
 * to leave a half-written recipe to go and fetch an ingredient.
 *
 * The recipe being edited is excluded, since a recipe containing itself has no
 * finite calorie count.
 */
function IngredientPicker({
  excludeRecipeId, onClose, onAdd,
}: {
  excludeRecipeId: string
  onClose: () => void
  onAdd: (component: RecipeComponent) => void
}) {
  const [query, setQuery] = useState('')
  const ctx = useNutritionContext()
  const addFood = useFoodStore((s) => s.addFood)
  const foods = useFoods()
  const { foods: matchedFoods, recipes: matchedRecipes, online, searching, problems, searched } =
    useIngredientSearch(query, excludeRecipeId)

  /** Saves an online result as a food of yours, then adds it to the recipe. */
  function takeOnline(result: NutritionResult) {
    const existing = alreadyHave(foods, result)
    const food = existing ?? importedFood(result)
    if (!existing) addFood(food)
    onAdd({ kind: 'food', foodId: food.id, grams: 100 })
  }

  const nothing = !matchedFoods.length && !matchedRecipes.length && !online.length

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

        <div className="px-5 pt-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              className="input pl-9 pr-9" autoFocus
              placeholder="Anything: yours, USDA, Open Food Facts…"
              value={query} onChange={(e) => setQuery(e.target.value)}
            />
            {searching && (
              <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 animate-spin" />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-0.5">
          {matchedFoods.length > 0 && <ResultHeading>Your foods</ResultHeading>}
          {matchedFoods.map((f) => (
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

          {matchedRecipes.length > 0 && <ResultHeading>Your recipes</ResultHeading>}
          {matchedRecipes.map((r) => (
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

          {/* USDA before Open Food Facts: laboratory figures for a generic
              ingredient beat community-entered label data, and the other way
              round for a branded product. */}
          {(['usda', 'openfoodfacts'] as const).map((source) => {
            const rows = online.filter((r) => r.source === source)
            if (!rows.length) return null
            return (
              <div key={source}>
                <ResultHeading>
                  {source === 'usda' ? 'USDA FoodData Central' : 'Open Food Facts'}
                </ResultHeading>
                {rows.map((r, i) => (
                  <button
                    key={`${r.externalId ?? r.name}-${i}`}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-cream-50 text-left"
                    onClick={() => takeOnline(r)}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-ink-900 line-clamp-2">{r.name}</span>
                      <span className="block text-xs font-mono text-ink-500">
                        {Math.round(r.per100g.calories)} kcal / 100 g
                        {r.micros && Object.keys(r.micros).length
                          ? ` · ${Object.keys(r.micros).length} nutrients` : ''}
                      </span>
                    </span>
                    <Download size={15} className="shrink-0 text-ink-500" />
                  </button>
                ))}
              </div>
            )
          })}

          {searching && nothing && (
            <p className="text-sm text-ink-500 text-center py-8">Looking it up…</p>
          )}

          {!searching && nothing && query.trim().length > 0 && (
            <div className="py-6 text-center space-y-2">
              <p className="text-sm text-ink-700">
                {searched ? lookupMessage(problems, query) : `Nothing of yours matches “${query}”.`}
              </p>
              <p className="text-xs text-ink-500">
                Add it on the Foods screen and it will be here next time.
              </p>
            </div>
          )}

          {!query.trim() && (
            <p className="text-sm text-ink-500 text-center py-8">
              Type to search your foods, your recipes, and the two open databases at once.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500 px-3 pt-3 pb-1">
      {children}
    </p>
  )
}

/**
 * What to say when the online sources came back with nothing.
 *
 * Being rate-limited, being offline and genuinely finding nothing are three
 * different situations with three different next moves, and calling all of them
 * "no results" sends you off to type in numbers the database already had.
 */
function lookupMessage(problems: IngredientSearch['problems'], query: string): string {
  if (problems.some((p) => p.reason === 'offline')) {
    return 'No signal, so only your own foods were searched.'
  }
  if (problems.some((p) => p.reason === 'rate-limited')) {
    return 'The food databases are rate-limiting us. Worth trying again in a minute.'
  }
  if (problems.length === 2) {
    return 'Both food databases are unreachable just now.'
  }
  return `Nothing anywhere matches “${query}”.`
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
