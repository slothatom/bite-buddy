import { useState } from 'react'
import { X, Search } from 'lucide-react'
import type { MealType, Recipe } from '../../types'

interface Props {
  date: string
  mealType: MealType
  recipes: Recipe[]
  onAdd: (recipeId: string, servings: number, mealType: MealType) => void
  onClose: () => void
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export default function AddMealModal({ date, mealType, recipes, onAdd, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [servings, setServings] = useState(1)

  const filtered = recipes.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleAdd() {
    if (!selected) return
    onAdd(selected.id, servings, mealType)
    onClose()
  }

  const displayDate = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="card w-full max-w-md mx-4 shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900">Add {MEAL_LABELS[mealType]}</p>
            <p className="text-xs text-gray-400">{displayDate}</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search recipes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Recipe list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">No recipes found</p>
          )}
          {filtered.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setSelected(recipe)}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-100 flex items-center gap-3
                ${selected?.id === recipe.id
                  ? 'bg-brand-50 border border-brand-200'
                  : 'hover:bg-gray-50 border border-transparent'}`}
            >
              <span className="text-xl">{recipe.emoji}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{recipe.name}</p>
                <p className="text-xs text-gray-400">
                  {recipe.macrosPerServing.calories} kcal · {recipe.macrosPerServing.protein}g protein
                </p>
              </div>
              {selected?.id === recipe.id && (
                <div className="ml-auto w-4 h-4 rounded-full bg-brand-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Servings + confirm */}
        {selected && (
          <div className="px-5 py-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="label mb-0">Servings</span>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary btn-icon w-8 h-8 text-lg"
                  onClick={() => setServings((s) => Math.max(1, s - 1))}
                >−</button>
                <span className="w-6 text-center font-bold font-mono text-sm">{servings}</span>
                <button
                  className="btn-secondary btn-icon w-8 h-8 text-lg"
                  onClick={() => setServings((s) => s + 1)}
                >+</button>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
              <button className="btn-primary flex-1" onClick={handleAdd}>Add Meal</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
