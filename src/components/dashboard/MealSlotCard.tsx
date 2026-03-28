import { Plus, X } from 'lucide-react'
import type { PlannedMeal, Recipe } from '../../types'

interface Props {
  meal?: PlannedMeal
  recipe?: Recipe
  mealType: string
  onAdd: () => void
  onRemove: () => void
}

const MEAL_COLORS: Record<string, string> = {
  breakfast: 'text-amber-600 bg-amber-50 border-amber-200',
  snack1:    'text-xp-700 bg-xp-50 border-xp-200',
  lunch:     'text-brand-700 bg-brand-50 border-brand-200',
  snack2:    'text-purple-700 bg-purple-50 border-purple-200',
  dinner:    'text-blue-700 bg-blue-50 border-blue-200',
}

export default function MealSlotCard({ meal, recipe, mealType, onAdd, onRemove }: Props) {
  if (!meal || !recipe) {
    return (
      <button onClick={onAdd} className="meal-slot w-full group">
        <div className="flex flex-col items-center gap-1 text-gray-400 group-hover:text-brand-500 transition-colors">
          <Plus size={16} />
          <span className="text-xs font-medium">Add</span>
        </div>
      </button>
    )
  }

  return (
    <div className={`meal-slot-filled w-full border rounded-xl p-2 ${MEAL_COLORS[mealType]}`}>
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-base leading-none">{recipe.emoji}</span>
          <p className="text-xs font-semibold truncate leading-tight">{recipe.name}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity mt-0.5"
        >
          <X size={12} />
        </button>
      </div>
      <p className="text-xs opacity-60 mt-0.5 ml-6">×{meal.servings} serving{meal.servings !== 1 ? 's' : ''}</p>
    </div>
  )
}
