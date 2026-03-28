import { useState } from 'react'
import { ChevronLeft, ChevronRight, Flame, Zap, Trophy, Target } from 'lucide-react'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useRecipeStore } from '../store/useRecipeStore'
import { useUserStore } from '../store/useUserStore'
import MealSlotCard from '../components/dashboard/MealSlotCard'
import AddMealModal from '../components/dashboard/AddMealModal'
import MacroBar from '../components/dashboard/MacroBar'
import type { MealType, PlannedMeal, Macros } from '../types'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

interface ModalState { date: string; mealType: MealType }

function sumMacros(macros: Macros[]): Macros {
  return macros.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Dashboard() {
  const { plan, weekDates, addMeal, removeMeal, goToWeek } = useMealPlanStore()
  const { recipes } = useRecipeStore()
  const { profile, unlockAchievement, addXp, checkStreak } = useUserStore()
  const [modal, setModal] = useState<ModalState | null>(null)

  const today = new Date().toISOString().split('T')[0]

  function handlePrevWeek() {
    const d = new Date(weekDates[0] + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    goToWeek(d)
  }

  function handleNextWeek() {
    const d = new Date(weekDates[0] + 'T12:00:00')
    d.setDate(d.getDate() + 7)
    goToWeek(d)
  }

  function handleAddMeal(date: string, mealType: MealType) {
    setModal({ date, mealType })
  }

  function handleConfirmAdd(recipeId: string, servings: number, mealType: MealType) {
    if (!modal) return
    const meal: PlannedMeal = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      recipeId,
      servings,
      mealType,
    }
    addMeal(modal.date, meal)
    checkStreak()

    const totalMeals = plan.reduce((acc, d) => acc + d.meals.length, 0)
    if (totalMeals === 0) {
      const isNew = unlockAchievement('first_plan')
      if (isNew) addXp(50)
    }
  }

  // Compute totals for today
  const todayPlan = plan.find((d) => d.date === today)
  const todayMacros = sumMacros(
    (todayPlan?.meals ?? []).flatMap((meal) => {
      const recipe = recipes.find((r) => r.id === meal.recipeId)
      if (!recipe) return []
      const m = recipe.macrosPerServing
      return [{
        calories: m.calories * meal.servings,
        protein: m.protein * meal.servings,
        carbs: m.carbs * meal.servings,
        fat: m.fat * meal.servings,
      }]
    })
  )

  // Total planned meals this week
  const weekMealCount = plan.reduce((acc, d) => acc + d.meals.length, 0)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-title">Weekly Planner</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {weekDates[0] && formatDate(weekDates[0])} – {weekDates[6] && formatDate(weekDates[6])}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary btn-icon" onClick={handlePrevWeek}><ChevronLeft size={17} /></button>
            <button
              className="btn-secondary text-xs font-semibold px-3"
              onClick={() => goToWeek(new Date())}
            >
              Today
            </button>
            <button className="btn-secondary btn-icon" onClick={handleNextWeek}><ChevronRight size={17} /></button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600">
              <Target size={18} />
            </div>
            <div>
              <p className="stat-number text-xl text-brand-600">{weekMealCount}</p>
              <p className="text-xs text-gray-500 font-medium">meals planned</p>
            </div>
          </div>
          <div className="card px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
              <Flame size={18} />
            </div>
            <div>
              <p className="stat-number text-xl text-amber-600">{profile.streak}</p>
              <p className="text-xs text-gray-500 font-medium">day streak</p>
            </div>
          </div>
          <div className="card px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-xp-100 flex items-center justify-center text-xp-600">
              <Zap size={18} />
            </div>
            <div>
              <p className="stat-number text-xl text-xp-600">{profile.xp}</p>
              <p className="text-xs text-gray-500 font-medium">total XP</p>
            </div>
          </div>
          <div className="card px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold-400/20 flex items-center justify-center text-gold-600">
              <Trophy size={18} />
            </div>
            <div>
              <p className="stat-number text-xl text-gold-500">{profile.achievements.length}</p>
              <p className="text-xs text-gray-500 font-medium">achievements</p>
            </div>
          </div>
        </div>

        {/* Today's macros */}
        {todayPlan && todayPlan.meals.length > 0 && (
          <div className="card px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Today's Macros</h2>
              <span className="badge-green">
                {Math.round(todayMacros.calories)} / {profile.macroTargets.calories} kcal
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <MacroBar
                label="Calories"
                value={todayMacros.calories}
                target={profile.macroTargets.calories}
                color="bg-gradient-to-r from-amber-400 to-orange-500"
                unit=" kcal"
              />
              <MacroBar
                label="Protein"
                value={todayMacros.protein}
                target={profile.macroTargets.protein}
                color="bg-gradient-to-r from-brand-400 to-brand-600"
              />
              <MacroBar
                label="Carbs"
                value={todayMacros.carbs}
                target={profile.macroTargets.carbs}
                color="bg-gradient-to-r from-blue-400 to-blue-600"
              />
              <MacroBar
                label="Fat"
                value={todayMacros.fat}
                target={profile.macroTargets.fat}
                color="bg-gradient-to-r from-xp-400 to-xp-600"
              />
            </div>
          </div>
        )}

        {/* Weekly grid */}
        <div className="card overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-8 border-b border-gray-100">
            <div className="px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide" />
            {weekDates.map((date, i) => {
              const isToday = date === today
              return (
                <div
                  key={date}
                  className={`px-2 py-2.5 text-center border-l border-gray-100 ${isToday ? 'bg-brand-50' : ''}`}
                >
                  <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-brand-600' : 'text-gray-500'}`}>
                    {DAYS[i]}
                  </p>
                  <p className={`text-sm font-semibold mt-0.5 ${isToday ? 'text-brand-700' : 'text-gray-700'}`}>
                    {formatDate(date).split(' ')[1]}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Meal rows */}
          {MEAL_TYPES.map((mealType) => (
            <div key={mealType} className="grid grid-cols-8 border-b border-gray-100 last:border-0">
              <div className="px-3 py-2 flex items-start pt-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide capitalize">
                  {mealType}
                </span>
              </div>
              {weekDates.map((date, di) => {
                const dayPlan = plan.find((d) => d.date === date)
                const meal = dayPlan?.meals.find((m) => m.mealType === mealType)
                const recipe = meal ? recipes.find((r) => r.id === meal.recipeId) : undefined
                const isToday = date === today
                return (
                  <div
                    key={`${date}-${mealType}`}
                    className={`px-1.5 py-1.5 border-l border-gray-100 ${isToday ? 'bg-brand-50/50' : ''}`}
                  >
                    <MealSlotCard
                      meal={meal}
                      recipe={recipe}
                      mealType={mealType}
                      onAdd={() => handleAddMeal(date, mealType)}
                      onRemove={() => meal && removeMeal(date, meal.id)}
                    />
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Achievements */}
        {profile.achievements.length > 0 && (
          <div className="card px-5 py-4">
            <h2 className="section-title mb-3">Recent Achievements</h2>
            <div className="flex flex-wrap gap-2">
              {[...profile.achievements].reverse().slice(0, 6).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br from-gold-400/10 to-gold-500/20 border border-gold-400/30"
                >
                  <span className="text-lg">{a.emoji}</span>
                  <div>
                    <p className="text-xs font-bold text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-400">+{a.xpReward} XP</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {modal && (
        <AddMealModal
          date={modal.date}
          mealType={modal.mealType}
          recipes={recipes}
          onAdd={handleConfirmAdd}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
