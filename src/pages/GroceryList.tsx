import { useState } from 'react'
import { ShoppingCart, RefreshCw, Trash2, CheckCheck, Package, ChevronDown } from 'lucide-react'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useRecipeStore } from '../store/useRecipeStore'
import { useUserStore } from '../store/useUserStore'

function groupByFirstLetter(items: { name: string }[]) {
  const groups: Record<string, typeof items> = {}
  items.forEach((item) => {
    const letter = item.name[0].toUpperCase()
    if (!groups[letter]) groups[letter] = []
    groups[letter].push(item)
  })
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
}

export default function GroceryList() {
  const { plan, groceryItems, generateGroceryList, toggleGroceryItem, clearCheckedItems, clearGroceryList } = useMealPlanStore()
  const { recipes } = useRecipeStore()
  const { unlockAchievement, addXp } = useUserStore()

  // All unique recipes referenced in the plan
  const planRecipeIds = [...new Set(plan.flatMap((d) => d.meals.map((m) => m.recipeId)))]
  const planRecipes = planRecipeIds.map((id) => recipes.find((r) => r.id === id)).filter(Boolean) as typeof recipes

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(planRecipeIds))
  const [showPicker, setShowPicker] = useState(false)

  function toggleRecipe(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const allSelected = planRecipes.every((r) => selectedIds.has(r.id))

  function handleGenerate() {
    const filter = selectedIds.size > 0 ? [...selectedIds] : undefined
    generateGroceryList(filter)
    const isFirst = groceryItems.length === 0
    if (isFirst) {
      unlockAchievement('grocery_master')
      addXp(75)
    }
    setShowPicker(false)
  }

  const checked = groceryItems.filter((i) => i.checked)
  const unchecked = groceryItems.filter((i) => !i.checked)
  const groups = groupByFirstLetter(unchecked)
  const totalItems = groceryItems.length
  const progress = totalItems > 0 ? (checked.length / totalItems) * 100 : 0

  return (
    <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="page-title">Grocery List</h1>
          <div className="flex gap-2 flex-wrap">
            {groceryItems.length > 0 && (
              <>
                <button className="btn-secondary" onClick={clearCheckedItems} disabled={checked.length === 0}>
                  <CheckCheck size={15} /> Clear checked
                </button>
                <button className="btn-ghost text-red-500 hover:bg-red-50" onClick={clearGroceryList}>
                  <Trash2 size={15} />
                </button>
              </>
            )}
            <div className="relative">
              <button className="btn-primary flex items-center gap-1.5" onClick={() => setShowPicker((v) => !v)}>
                <RefreshCw size={15} /> Generate
                {planRecipes.length > 0 && (
                  <span className="flex items-center gap-0.5 text-white/70">
                    <span className="text-xs">({selectedIds.size}/{planRecipes.length})</span>
                    <ChevronDown size={13} className={`transition-transform ${showPicker ? 'rotate-180' : ''}`} />
                  </span>
                )}
              </button>

              {showPicker && planRecipes.length > 0 && (
                <div className="absolute right-0 top-full mt-1.5 z-30 bg-white rounded-2xl shadow-2xl border border-gray-100 w-72 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-700">Select recipes</p>
                    <button className="text-xs text-brand-600 font-semibold hover:underline"
                      onClick={() => setSelectedIds(allSelected ? new Set() : new Set(planRecipes.map((r) => r.id)))}>
                      {allSelected ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {planRecipes.map((recipe) => (
                      <label key={recipe.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0">
                        <input type="checkbox" checked={selectedIds.has(recipe.id)}
                          onChange={() => toggleRecipe(recipe.id)}
                          className="w-4 h-4 rounded accent-brand-600 cursor-pointer" />
                        <span className="text-lg">{recipe.emoji}</span>
                        <span className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">{recipe.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-gray-100">
                    <button className="btn-primary w-full" onClick={handleGenerate} disabled={selectedIds.size === 0}>
                      <RefreshCw size={14} /> Generate list
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {groceryItems.length === 0 ? (
          <div className="card px-6 py-16 text-center">
            <div className="text-5xl mb-4">🛒</div>
            <p className="font-semibold text-gray-700 text-lg">Your list is empty</p>
            <p className="text-sm text-gray-400 mt-2 mb-6">
              Plan meals in the Weekly Planner, then generate your grocery list here.
            </p>
            {planRecipes.length === 0 ? (
              <p className="text-xs text-gray-400">No meals planned this week yet.</p>
            ) : (
              <button className="btn-primary mx-auto" onClick={handleGenerate}>
                <RefreshCw size={15} /> Generate from plan
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Progress */}
            <div className="card px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={16} className="text-brand-600" />
                  <span className="font-semibold text-gray-900 text-sm">
                    {checked.length} / {totalItems} items collected
                  </span>
                </div>
                {progress === 100 && (
                  <span className="badge-green">🎉 All done!</span>
                )}
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Unchecked items grouped */}
            {unchecked.length > 0 && (
              <div className="card overflow-hidden">
                {groups.map(([letter, items], gi) => (
                  <div key={letter}>
                    <div className={`px-4 py-1.5 bg-gray-50 border-b border-gray-100 ${gi > 0 ? 'border-t' : ''}`}>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{letter}</span>
                    </div>
                    {(items as typeof groceryItems).map((item) => {
                      const recipeNames = item.fromRecipeIds
                        .map((id) => recipes.find((r) => r.id === id))
                        .filter(Boolean)
                        .map((r) => r!.name)
                      return (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                        >
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => toggleGroceryItem(item.id)}
                            className="w-4 h-4 rounded accent-brand-600 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-400 font-mono">{item.amount} {item.unit}</span>
                              {recipeNames.length > 0 && (
                                <>
                                  <span className="text-gray-300">·</span>
                                  <span className="text-xs text-gray-400 truncate">{recipeNames.join(', ')}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Checked items */}
            {checked.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">
                  In your cart ({checked.length})
                </p>
                <div className="card overflow-hidden opacity-60">
                  {checked.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleGroceryItem(item.id)}
                        className="w-4 h-4 rounded accent-brand-600 cursor-pointer"
                      />
                      <span className="text-sm text-gray-400 line-through">{item.name}</span>
                      <span className="text-xs text-gray-300 font-mono ml-auto">{item.amount} {item.unit}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="card px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Package size={15} className="text-gray-500" />
                <p className="text-sm font-semibold text-gray-700">Weekly nutrition summary</p>
              </div>
              <WeeklyNutritionSummary />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function WeeklyNutritionSummary() {
  const { plan } = useMealPlanStore()
  const { recipes } = useRecipeStore()

  let totalCal = 0, totalP = 0, totalC = 0, totalF = 0, days = 0

  plan.forEach((day) => {
    if (day.meals.length > 0) {
      days++
      day.meals.forEach((meal) => {
        const recipe = recipes.find((r) => r.id === meal.recipeId)
        if (!recipe) return
        const m = recipe.macrosPerServing
        totalCal += m.calories * meal.servings
        totalP   += m.protein  * meal.servings
        totalC   += m.carbs    * meal.servings
        totalF   += m.fat      * meal.servings
      })
    }
  })

  if (days === 0) return <p className="text-xs text-gray-400">Plan meals to see nutrition summary.</p>

  return (
    <div className="grid grid-cols-4 gap-3 text-center">
      {[
        { label: 'Calories', value: Math.round(totalCal), unit: 'kcal', color: 'text-amber-600' },
        { label: 'Protein',  value: Math.round(totalP),   unit: 'g',    color: 'text-brand-600' },
        { label: 'Carbs',    value: Math.round(totalC),   unit: 'g',    color: 'text-blue-600' },
        { label: 'Fat',      value: Math.round(totalF),   unit: 'g',    color: 'text-xp-600' },
      ].map(({ label, value, unit, color }) => (
        <div key={label}>
          <p className={`font-bold font-mono text-lg ${color}`}>{value}<span className="text-xs font-sans text-gray-400 ml-0.5">{unit}</span></p>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-xs text-gray-300">{days}d avg: {Math.round(value / days)}{unit}</p>
        </div>
      ))}
    </div>
  )
}
