import { useState } from 'react'
import { ChevronLeft, ChevronRight, Flame, Zap, Trophy, Target } from 'lucide-react'
import { useMealPlanStore } from '../store/useMealPlanStore'
import { useRecipeStore } from '../store/useRecipeStore'
import { useUserStore } from '../store/useUserStore'
import MealSlotCard from '../components/dashboard/MealSlotCard'
import AddMealModal from '../components/dashboard/AddMealModal'
import MacroBar from '../components/dashboard/MacroBar'
import type { MealType, PlannedMeal, Macros } from '../types'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const MEAL_TYPES: MealType[] = ['breakfast','lunch','dinner','snack1','snack2']
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner',
  snack1: 'Snack 1', snack2: 'Snack 2',
}

interface ModalState { date: string; mealType: MealType }

function sumMacros(macros: Macros[]): Macros {
  return macros.reduce(
    (acc, m) => ({ calories: acc.calories + m.calories, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Dashboard() {
  const { plan, weekDates, addMeal, removeMeal, goToWeek } = useMealPlanStore()
  const { recipes } = useRecipeStore()
  const { profile, unlockAchievement, addXp, checkStreak } = useUserStore()
  const [modal, setModal] = useState<ModalState | null>(null)
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(weekDates.includes(today) ? today : weekDates[0])

  function handlePrevWeek() {
    const d = new Date(weekDates[0] + 'T12:00:00'); d.setDate(d.getDate() - 7); goToWeek(d)
  }
  function handleNextWeek() {
    const d = new Date(weekDates[0] + 'T12:00:00'); d.setDate(d.getDate() + 7); goToWeek(d)
  }

  function handleConfirmAdd(recipeId: string, servings: number, mealType: MealType) {
    if (!modal) return
    const meal: PlannedMeal = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      recipeId, servings, mealType,
    }
    addMeal(modal.date, meal)
    checkStreak()
    const totalMeals = plan.reduce((acc, d) => acc + d.meals.length, 0)
    if (totalMeals === 0) { unlockAchievement('first_plan'); addXp(50) }
  }

  // Today's macros
  const todayPlan = plan.find((d) => d.date === today)
  const todayMacros = sumMacros(
    (todayPlan?.meals ?? []).flatMap((meal) => {
      const recipe = recipes.find((r) => r.id === meal.recipeId)
      if (!recipe) return []
      const m = recipe.macrosPerServing
      return [{ calories: m.calories * meal.servings, protein: m.protein * meal.servings, carbs: m.carbs * meal.servings, fat: m.fat * meal.servings }]
    })
  )

  const weekMealCount = plan.reduce((acc, d) => acc + d.meals.length, 0)

  // Mobile single-day view
  const mobileDayPlan = plan.find((d) => d.date === selectedDate)

  return (
    <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 space-y-4">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-title">Weekly Planner</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {weekDates[0] && formatDate(weekDates[0])} – {weekDates[6] && formatDate(weekDates[6])}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="btn-secondary btn-icon" onClick={handlePrevWeek}><ChevronLeft size={16} /></button>
            <button className="btn-secondary text-xs font-semibold px-2.5" onClick={() => goToWeek(new Date())}>Today</button>
            <button className="btn-secondary btn-icon" onClick={handleNextWeek}><ChevronRight size={16} /></button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { icon: Target,  val: weekMealCount,          label: 'meals planned', color: 'bg-brand-100 text-brand-600', text: 'text-brand-600' },
            { icon: Flame,   val: profile.streak,         label: 'day streak',    color: 'bg-amber-100 text-amber-600', text: 'text-amber-600' },
            { icon: Zap,     val: profile.xp,             label: 'total XP',      color: 'bg-xp-100 text-xp-600',      text: 'text-xp-600' },
            { icon: Trophy,  val: profile.achievements.length, label: 'achievements', color: 'bg-amber-50 text-amber-500', text: 'text-amber-500' },
          ].map(({ icon: Icon, val, label, color, text }) => (
            <div key={label} className="card px-3 py-3 flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={16} />
              </div>
              <div>
                <p className={`text-xl font-extrabold font-mono leading-none ${text}`}>{val}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Today's macros */}
        {todayPlan && todayPlan.meals.length > 0 && (
          <div className="card px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title">Today's Macros</h2>
              <span className="badge-green">{Math.round(todayMacros.calories)} / {profile.macroTargets.calories} kcal</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              <MacroBar label="Calories" value={todayMacros.calories} target={profile.macroTargets.calories} color="bg-gradient-to-r from-amber-400 to-orange-500" unit=" kcal" />
              <MacroBar label="Protein"  value={todayMacros.protein}  target={profile.macroTargets.protein}  color="bg-gradient-to-r from-brand-400 to-brand-600" />
              <MacroBar label="Carbs"    value={todayMacros.carbs}    target={profile.macroTargets.carbs}    color="bg-gradient-to-r from-blue-400 to-blue-600" />
              <MacroBar label="Fat"      value={todayMacros.fat}      target={profile.macroTargets.fat}      color="bg-gradient-to-r from-xp-400 to-xp-600" />
            </div>
          </div>
        )}

        {/* ─── Mobile: day selector + single-day meals ─── */}
        <div className="block md:hidden">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {weekDates.map((date, i) => {
              const isToday = date === today
              const isSelected = date === selectedDate
              const dayMeals = plan.find((d) => d.date === date)?.meals.length ?? 0
              return (
                <button key={date} onClick={() => setSelectedDate(date)}
                  className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-xs font-semibold transition-all
                    ${isSelected ? 'bg-brand-600 text-white' : isToday ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  <span>{DAYS[i]}</span>
                  <span className="text-sm font-bold">{formatDate(date).split(' ')[1]}</span>
                  {dayMeals > 0 && <span className={`text-[9px] mt-0.5 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>{dayMeals} meals</span>}
                </button>
              )
            })}
          </div>

          <div className="mt-3 space-y-2">
            {MEAL_TYPES.map((mealType) => {
              const meal = mobileDayPlan?.meals.find((m) => m.mealType === mealType)
              const recipe = meal ? recipes.find((r) => r.id === meal.recipeId) : undefined
              return (
                <div key={mealType} className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-400 w-16 text-right shrink-0">{MEAL_LABELS[mealType]}</span>
                  <div className="flex-1">
                    <MealSlotCard meal={meal} recipe={recipe} mealType={mealType}
                      onAdd={() => setModal({ date: selectedDate, mealType })}
                      onRemove={() => meal && removeMeal(selectedDate, meal.id)} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── Desktop: full week grid ─── */}
        <div className="hidden md:block card overflow-hidden">
          <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
            <div className="px-3 py-2.5" />
            {weekDates.map((date, i) => {
              const isToday = date === today
              return (
                <div key={date} className={`px-2 py-2.5 text-center border-l border-gray-100 ${isToday ? 'bg-brand-50' : ''}`}>
                  <p className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-brand-600' : 'text-gray-500'}`}>{DAYS[i]}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${isToday ? 'text-brand-700' : 'text-gray-700'}`}>{formatDate(date).split(' ')[1]}</p>
                </div>
              )
            })}
          </div>

          {MEAL_TYPES.map((mealType) => (
            <div key={mealType} className="grid border-b border-gray-100 last:border-0" style={{ gridTemplateColumns: '80px repeat(7, 1fr)' }}>
              <div className="px-3 py-2 flex items-start pt-3">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{MEAL_LABELS[mealType]}</span>
              </div>
              {weekDates.map((date) => {
                const dayPlan = plan.find((d) => d.date === date)
                const meal = dayPlan?.meals.find((m) => m.mealType === mealType)
                const recipe = meal ? recipes.find((r) => r.id === meal.recipeId) : undefined
                const isToday = date === today
                return (
                  <div key={`${date}-${mealType}`} className={`px-1 py-1 border-l border-gray-100 ${isToday ? 'bg-brand-50/50' : ''}`}>
                    <MealSlotCard meal={meal} recipe={recipe} mealType={mealType}
                      onAdd={() => setModal({ date, mealType })}
                      onRemove={() => meal && removeMeal(date, meal.id)} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Achievements */}
        {profile.achievements.length > 0 && (
          <div className="card px-4 py-4">
            <h2 className="section-title mb-3">Recent Achievements</h2>
            <div className="flex flex-wrap gap-2">
              {[...profile.achievements].reverse().slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-br from-gold-400/10 to-gold-500/20 border border-gold-400/30">
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
        <AddMealModal date={modal.date} mealType={modal.mealType} recipes={recipes}
          onAdd={handleConfirmAdd} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
