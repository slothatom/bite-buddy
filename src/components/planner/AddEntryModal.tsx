import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Component, MealSlot, Recipe } from '../../types'
import { SLOT_LABELS } from '../../types'
import { useRecipes } from '../../store/useRecipeStore'
import { useFoods } from '../../store/useFoodStore'
import { useNutritionContext } from '../../store/useNutrition'
import { recipePerServing, componentsNutrients } from '../../lib/nutrition'
import { normaliseTerm } from '../../lib/units'
import { searchFoods } from '../../lib/foodSearch'
import { buildFoodIndex } from '../../lib/foodSearch'

/**
 * Adds either a recipe or a weighed food to a meal slot.
 *
 * Both live in one picker because the plans mix them freely: lunch is usually a
 * recipe, while a snack is two food lines and forcing it through a recipe would
 * mean inventing one.
 */
export default function AddEntryModal({
  date, slot, onClose, onAdd,
}: {
  date: string
  slot: MealSlot
  onClose: () => void
  onAdd: (entry: Component) => void
}) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'recipes' | 'foods'>('recipes')
  const [grams, setGrams] = useState<Record<string, number>>({})

  const recipes = useRecipes()
  const foods = useFoods()
  const ctx = useNutritionContext()
  const foodIndex = useMemo(() => buildFoodIndex(foods), [foods])

  const matchedRecipes = useMemo(() => {
    const n = normaliseTerm(query)
    const slotMatch = (r: Recipe) =>
      slot === 'snack1' || slot === 'snack2'
        ? r.tags.includes('snack')
        : r.tags.includes(slot)

    const pool = recipes.filter((r) => {
      if (!n) return slotMatch(r)
      const haystack = normaliseTerm(
        [r.name.en, r.name.ro, r.name.hu, r.sourceLine].filter(Boolean).join(' '))
      return haystack.includes(n)
    })

    return pool.slice(0, 60)
  }, [recipes, query, slot])

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
            <h2 className="text-base font-extrabold text-ink-900">Add to {SLOT_LABELS[slot]}</h2>
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
              placeholder="What are we having?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit">
            {(['recipes', 'foods'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`capitalize ${tab === t ? 'tab-on' : 'tab-off'}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5">
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
                  {r.sourceLine ? (
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
                    Add
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
