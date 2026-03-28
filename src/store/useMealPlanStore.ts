import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DayPlan, GroceryItem, PlannedMeal } from '../types'
import { useRecipeStore } from './useRecipeStore'

function getWeekDates(referenceDate: Date = new Date()): string[] {
  const dates: string[] = []
  const day = referenceDate.getDay() // 0=Sun
  const monday = new Date(referenceDate)
  monday.setDate(referenceDate.getDate() - ((day + 6) % 7)) // shift to Monday
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

function buildEmptyWeek(dates: string[]): DayPlan[] {
  return dates.map((date) => ({ date, meals: [] }))
}

interface MealPlanStore {
  weekDates: string[]
  plan: DayPlan[]
  groceryItems: GroceryItem[]

  addMeal: (date: string, meal: PlannedMeal) => void
  removeMeal: (date: string, mealId: string) => void
  clearDay: (date: string) => void
  goToWeek: (referenceDate: Date) => void

  generateGroceryList: () => void
  toggleGroceryItem: (id: string) => void
  clearCheckedItems: () => void
  clearGroceryList: () => void
}

export const useMealPlanStore = create<MealPlanStore>()(
  persist(
    (set, get) => {
      const today = new Date()
      const weekDates = getWeekDates(today)
      return {
        weekDates,
        plan: buildEmptyWeek(weekDates),
        groceryItems: [],

        addMeal: (date, meal) =>
          set((s) => ({
            plan: s.plan.map((day) =>
              day.date === date ? { ...day, meals: [...day.meals, meal] } : day
            ),
          })),

        removeMeal: (date, mealId) =>
          set((s) => ({
            plan: s.plan.map((day) =>
              day.date === date
                ? { ...day, meals: day.meals.filter((m) => m.id !== mealId) }
                : day
            ),
          })),

        clearDay: (date) =>
          set((s) => ({
            plan: s.plan.map((day) =>
              day.date === date ? { ...day, meals: [] } : day
            ),
          })),

        goToWeek: (referenceDate) => {
          const newDates = getWeekDates(referenceDate)
          set((s) => {
            // preserve existing meals for dates that overlap
            const existing = new Map(s.plan.map((d) => [d.date, d]))
            const newPlan = newDates.map((date) =>
              existing.get(date) ?? { date, meals: [] }
            )
            return { weekDates: newDates, plan: newPlan }
          })
        },

        generateGroceryList: () => {
          const { plan } = get()
          const { recipes } = useRecipeStore.getState()
          const map = new Map<string, GroceryItem>()

          plan.forEach((day) => {
            day.meals.forEach((meal) => {
              const recipe = recipes.find((r) => r.id === meal.recipeId)
              if (!recipe) return
              const scale = meal.servings / recipe.servings
              recipe.ingredients.forEach((ing) => {
                const key = `${ing.name.toLowerCase()}-${ing.unit}`
                if (map.has(key)) {
                  const existing = map.get(key)!
                  map.set(key, {
                    ...existing,
                    amount: Math.round((existing.amount + ing.amount * scale) * 10) / 10,
                    fromRecipeIds: [...new Set([...existing.fromRecipeIds, recipe.id])],
                  })
                } else {
                  map.set(key, {
                    id: key,
                    name: ing.name,
                    amount: Math.round(ing.amount * scale * 10) / 10,
                    unit: ing.unit,
                    checked: false,
                    fromRecipeIds: [recipe.id],
                  })
                }
              })
            })
          })

          set({ groceryItems: Array.from(map.values()) })
        },

        toggleGroceryItem: (id) =>
          set((s) => ({
            groceryItems: s.groceryItems.map((item) =>
              item.id === id ? { ...item, checked: !item.checked } : item
            ),
          })),

        clearCheckedItems: () =>
          set((s) => ({
            groceryItems: s.groceryItems.filter((item) => !item.checked),
          })),

        clearGroceryList: () => set({ groceryItems: [] }),
      }
    },
    { name: 'bite-buddy-mealplan' }
  )
)

export { getWeekDates }
