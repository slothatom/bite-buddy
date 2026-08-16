import { useMemo, useState } from 'react'
import { RefreshCw, Trash2, ShoppingBasket } from 'lucide-react'
import type { MedCategory } from '../types'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useNutritionContext } from '../store/useNutrition'
import { EmptyState, SectionHeading } from '../components/ui'
import { CATEGORY_EMOJI, CATEGORY_LABELS } from '../lib/categories'

/**
 * The shopping list.
 *
 * Grouped by the food categories rather than alphabetically, because that is
 * the order a market or supermarket is actually walked.
 */
export default function GroceryList() {
  const { groceryItems, generateGroceryList, toggleGroceryItem, clearCheckedItems, clearGroceryList, plan } =
    useMealPlanStore()
  const ctx = useNutritionContext()
  const [justBuilt, setJustBuilt] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<MedCategory, typeof groceryItems>()
    for (const item of groceryItems) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name))
    return [...map].sort((a, b) => CATEGORY_LABELS[a[0]].localeCompare(CATEGORY_LABELS[b[0]]))
  }, [groceryItems])

  const checked = groceryItems.filter((i) => i.checked).length
  const plannedMeals = plan.reduce((a, d) => a + d.meals.length, 0)

  function build() {
    generateGroceryList(ctx)
    setJustBuilt(true)
    setTimeout(() => setJustBuilt(false), 1500)
  }

  return (
    <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-stone-800">Grocery list</h1>
            <p className="text-sm text-stone-500">
              {groceryItems.length
                ? `${checked} of ${groceryItems.length} picked up`
                : `Built from the ${plannedMeals} meals in this week's planner.`}
            </p>
          </div>
          <button className="btn-primary shrink-0" onClick={build}>
            <RefreshCw size={15} className={justBuilt ? 'animate-spin' : ''} />
            {groceryItems.length ? 'Rebuild' : 'Build list'}
          </button>
        </header>

        {groceryItems.length > 0 && (
          <div className="card p-4">
            <div className="h-2 rounded-full bg-sand-200 overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all duration-500"
                style={{ width: `${(checked / groceryItems.length) * 100}%` }} />
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn-ghost text-sm" onClick={clearCheckedItems} disabled={!checked}>
                Clear picked up
              </button>
              <button className="btn-ghost text-sm text-clay-600" onClick={clearGroceryList}>
                <Trash2 size={14} /> Empty list
              </button>
            </div>
          </div>
        )}

        {groceryItems.length === 0 ? (
          <EmptyState emoji="🧺" title="Nothing on the list yet">
            {plannedMeals
              ? 'Build the list from this week’s planner.'
              : 'Plan some meals first, then build the list from them.'}
          </EmptyState>
        ) : (
          grouped.map(([category, items]) => (
            <section key={category}>
              <SectionHeading>
                <span className="flex items-center gap-2 text-base">
                  {CATEGORY_EMOJI[category]} {CATEGORY_LABELS[category]}
                </span>
              </SectionHeading>
              <div className="card divide-y divide-sand-100">
                {items.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleGroceryItem(item.id)}
                      className="w-4 h-4 accent-brand-600 shrink-0"
                    />
                    <span className={`flex-1 text-sm ${item.checked ? 'line-through text-stone-300' : 'text-stone-800'}`}>
                      {item.name}
                    </span>
                    <span className={`text-sm font-mono shrink-0 ${item.checked ? 'text-stone-300' : 'text-stone-500'}`}>
                      {formatAmount(item.grams)}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))
        )}

        {groceryItems.length > 0 && (
          <p className="flex items-start gap-2 text-xs text-stone-400">
            <ShoppingBasket size={14} className="shrink-0 mt-0.5" />
            Weights are raw and unprepared, the way your plans are written — grains and meat before cooking.
          </p>
        )}
      </div>
    </div>
  )
}

function formatAmount(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`
}
