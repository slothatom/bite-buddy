import { useMemo, useState } from 'react'
import { Search, X, CalendarDays } from 'lucide-react'
import type { Component, MealSlot, Recipe } from '../../types'
import { SLOT_LABELS } from '../../types'
import { useRecipes } from '../../store/useRecipeStore'
import { useFoods } from '../../store/useFoodStore'
import { useNutritionContext } from '../../store/useNutrition'
import { recipePerServing, componentsNutrients } from '../../lib/nutrition'
import { normaliseTerm } from '../../lib/units'
import { mealTimesOf } from '../../lib/dishCategories'
import { searchFoods } from '../../lib/foodSearch'
import { buildFoodIndex } from '../../lib/foodSearch'
import { useAvailablePortions } from '../../store/usePortionStore'
import { today } from '../../store/useMealPlanStore'
import WhenPicker from './WhenPicker'
import { offerOrder, madeWhen, portionLabel } from '../../lib/portionsUse'
import { usePantry } from '../../store/usePantryStore'
import { availability, availabilityLabel } from '../../lib/pantry'

/**
 * Adds a recipe, a weighed food, or something already cooked, to a meal slot.
 *
 * All three live in one picker because the plans mix them freely: lunch is
 * usually a recipe, a snack is two food lines and forcing it through a recipe
 * would mean inventing one, and often the honest answer is that Sunday's stew
 * is still in the fridge.
 *
 * The fridge tab comes first when there is anything in it. That is the whole
 * argument for cooking in advance: the next meal is already decided, and the
 * app should say so before offering you 228 things to choose between.
 */
export default function AddEntryModal({
  date, slot, onClose, onAdd, mode = 'plan', onSlotChange, onDateChange,
}: {
  date: string
  slot: MealSlot
  onClose: () => void
  onAdd: (entry: Component) => void
  /**
   * Whether this is a plan or a record.
   *
   * The picker is identical either way, so it is one component. What changes is
   * the tense: "Add to lunch" is about a lunch that has not happened, and the
   * commonest thing a person wants to write down is one that already has. The
   * caller decides where it lands; this only has to stop saying the wrong
   * thing about it.
   */
  mode?: 'plan' | 'ate'
  /**
   * Lets the day and the meal be corrected here.
   *
   * The centre button used to mean today and Breakfast, always, at any hour
   * and from any screen, with nothing on the sheet saying so and no way to
   * change it. The most-tapped control in the app was the one most likely to
   * file food in the wrong place.
   *
   * Now the sheet states where this is going before you have chosen what, in
   * words rather than in a heading nobody reads, and one tap opens the picker.
   */
  onSlotChange?: (slot: MealSlot) => void
  onDateChange?: (date: string) => void
}) {
  const ate = mode === 'ate'
  const [when, setWhen] = useState(false)
  const [query, setQuery] = useState('')
  // Snacks open on foods. The plans write them as lines rather than dishes
  // ("150 g mere, 10 g caju"), so the recipe tab for a snack slot was reliably
  // empty, an empty list is a worse answer than the right list.
  const isSnack = slot === 'snack1' || slot === 'snack2'
  const available = useAvailablePortions()
  const pantry = usePantry()
  const [tab, setTab] = useState<'fridge' | 'recipes' | 'foods'>(
    available.length ? 'fridge' : isSnack ? 'foods' : 'recipes')
  const [grams, setGrams] = useState<Record<string, number>>({})

  const recipes = useRecipes()
  const foods = useFoods()
  const ctx = useNutritionContext()
  const foodIndex = useMemo(() => buildFoodIndex(foods), [foods])

  const matchedRecipes = useMemo(() => {
    const n = normaliseTerm(query)
    // mealTimesOf rather than the recipe's own tags: the batch-cooked dishes
    // were never a meal in a plan and carry no meal time, so without the
    // category's fallback the lentil stew could never be picked for a lunch.
    const slotMatch = (r: Recipe) =>
      mealTimesOf(r).includes(isSnack ? 'snack' : slot)

    const pool = recipes.filter((r) => {
      if (!n) return slotMatch(r)
      const haystack = normaliseTerm(
        [r.name.en, r.name.ro, r.name.hu, r.sourceLine].filter(Boolean).join(' '))
      return haystack.includes(n)
    })

    return pool.slice(0, 60)
  }, [recipes, query, slot, isSnack])

  const matchedFoods = useMemo(() => searchFoods(query, foodIndex, 40), [query, foodIndex])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}>
      <div
        className="bg-paper w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[88vh] flex flex-col shadow-xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-border-200">
          <div>
            <h2 className="text-base font-extrabold text-ink-900">
              {ate ? `Ate this for ${SLOT_LABELS[slot].toLowerCase()}` : `Add to ${SLOT_LABELS[slot]}`}
            </h2>
            <p className="text-xs text-ink-500">{new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <button className="btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>

        <div className="px-5 pt-4 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
            <input
              className="input pl-9"
              autoFocus
              placeholder={ate ? 'What did you have?' : 'What are we having?'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {(onSlotChange || onDateChange) && (
            <div className="card-soft p-3 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDays size={15} className="shrink-0 text-ink-500" />
                <p className="flex-1 min-w-0 text-sm text-ink-900">
                  <span className="font-semibold">{SLOT_LABELS[slot]}</span>
                  {', '}
                  {date === today()
                    ? 'today'
                    : new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
                </p>
                <button
                  className="btn-ghost text-xs shrink-0"
                  aria-expanded={when}
                  onClick={() => setWhen((v) => !v)}
                >
                  {when ? 'Done' : 'Change'}
                </button>
              </div>

              {when && (
                <WhenPicker
                  date={date}
                  onDate={(d) => onDateChange?.(d)}
                  slot={onSlotChange ? slot : undefined}
                  onSlot={onSlotChange}
                />
              )}
            </div>
          )}

          <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit">
            {([...(available.length ? ['fridge' as const] : []), 'recipes' as const, 'foods' as const]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`capitalize ${tab === t ? 'tab-on' : 'tab-off'}`}
              >
                {t}
                {t === 'fridge' && (
                  <span className="ml-1.5 text-xs opacity-60 font-mono">{available.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5">
          {tab === 'fridge' && offerOrder(available).map((p) => {
            const n = componentsNutrients([{ kind: 'portion', portionId: p.id, servings: 1 }], ctx)
            return (
              <button
                key={p.id}
                onClick={() => { onAdd({ kind: 'portion', portionId: p.id, servings: 1 }); onClose() }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-cream-50 text-left transition-colors"
              >
                <span className="text-xl">{p.storage === 'freezer' ? '🧊' : '🥡'}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink-900 truncate">
                    {portionLabel(p, ctx.recipes)}
                  </span>
                  <span className="block text-xs text-ink-500 truncate">
                    {p.servings === 1 ? '1 portion left' : `${p.servings} portions left`} · {madeWhen(p)}
                  </span>
                </span>
                {n.calories > 0 && (
                  <span className="text-sm font-mono text-ink-700 shrink-0">
                    {Math.round(n.calories)} kcal
                  </span>
                )}
              </button>
            )
          })}

          {tab === 'recipes' && matchedRecipes.map((r) => {
            const n = recipePerServing(r, ctx)
            return (
              <button
                key={r.id}
                onClick={() => { onAdd({ kind: 'recipe', recipeId: r.id, servings: 1 }); onClose() }}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-cream-50 text-left transition-colors"
              >
                <span className="text-xl">{r.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink-900 truncate">{r.name.en}</span>
                  {/* What you have matters more at this moment than what the
                      dietician wrote, so it takes the line when there is
                      anything in the cupboard to say. */}
                  {pantry.size > 0 ? (
                    <span className="block text-xs text-ink-500 truncate">
                      {availabilityLabel(availability(r, ctx, pantry)) || r.sourceLine}
                    </span>
                  ) : r.sourceLine ? (
                    <span className="block text-xs text-ink-500 truncate">{r.sourceLine}</span>
                  ) : null}
                </span>
                <span className="text-sm font-mono text-ink-700 shrink-0">{Math.round(n.calories)} kcal</span>
              </button>
            )
          })}

          {tab === 'recipes' && !matchedRecipes.length && (
            <p className="text-sm text-ink-500 text-center py-8">No recipes match “{query}”.</p>
          )}

          {tab === 'foods' && matchedFoods.map((f) => {
            const g = grams[f.id] ?? f.units[0]?.grams ?? 100
            const n = componentsNutrients([{ kind: 'food', foodId: f.id, grams: g }], ctx)
            return (
              // Name on its own row, then controls beneath: on a phone the
              // one-line version squeezed the food name down to a few characters.
              <div key={f.id} className="p-3 rounded-xl hover:bg-cream-50 transition-colors">
                <div className="min-w-0 mb-2">
                  <p className="text-sm font-semibold text-ink-900 truncate">{f.names.en}</p>
                  {f.names.ro || f.names.hu ? (
                    <p className="text-xs text-ink-500 truncate">
                      {[f.names.ro, f.names.hu].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={g}
                      onChange={(e) => setGrams((s) => ({ ...s, [f.id]: Number(e.target.value) }))}
                      className="input w-24 pr-7 text-right"
                      aria-label={`Grams of ${f.names.en}`}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-500 pointer-events-none">g</span>
                  </div>
                  <span className="flex-1 text-xs text-ink-500 font-mono">{Math.round(n.calories)} kcal</span>
                  <button
                    className="btn-primary shrink-0"
                    onClick={() => { onAdd({ kind: 'food', foodId: f.id, grams: g }); onClose() }}
                  >
                    {ate ? 'Ate it' : 'Add'}
                  </button>
                </div>
              </div>
            )
          })}

          {tab === 'foods' && !matchedFoods.length && (
            <p className="text-sm text-ink-500 text-center py-8">No foods match “{query}”.</p>
          )}
        </div>
      </div>
    </div>
  )
}
