import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { discardOlderThan, safeStorage, SCHEMA_VERSION } from './persist'
import type {
  Component, DayPlan, GroceryItem, MealSlot, PlannedMeal, SourcePlan, WeekStart,
} from '../types'
import { DEFAULT_WEEK_START } from '../types'
import type { NutritionContext } from '../lib/nutrition'

/**
 * Returns the seven dates of the week containing `reference`.
 *
 * The week does not necessarily start on Monday: the dietician issued plans on
 * Wednesdays and every document runs Wednesday → Tuesday, so the planner
 * defaults to a Wednesday start and the day is configurable.
 */
export function getWeekDates(reference: Date = new Date(), weekStartsOn: WeekStart = DEFAULT_WEEK_START): string[] {
  const start = new Date(reference)
  start.setHours(12, 0, 0, 0)
  const shift = (start.getDay() - weekStartsOn + 7) % 7
  start.setDate(start.getDate() - shift)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function emptyWeek(dates: string[]): DayPlan[] {
  return dates.map((date) => ({ date, meals: [] }))
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface MealPlanExport {
  version: 2
  exportedAt: string
  weekStart: string
  plan: DayPlan[]
}

interface MealPlanStore {
  weekDates: string[]
  plan: DayPlan[]
  groceryItems: GroceryItem[]

  setMeal: (date: string, slot: MealSlot, entries: Component[], note?: string) => void
  addEntry: (date: string, slot: MealSlot, entry: Component) => void
  removeMeal: (date: string, mealId: string) => void
  clearDay: (date: string) => void
  copyDay: (fromDate: string, toDate: string) => void
  goToWeek: (reference: Date, weekStartsOn: WeekStart) => void
  /** Drops one of the dietician's weeks onto the current week's dates. */
  loadSourcePlan: (source: SourcePlan) => void
  importWeek: (data: MealPlanExport) => void

  generateGroceryList: (ctx: NutritionContext, recipeIds?: string[]) => void
  toggleGroceryItem: (id: string) => void
  clearCheckedItems: () => void
  clearGroceryList: () => void
}

export const useMealPlanStore = create<MealPlanStore>()(
  persist(
    (set, get) => {
      const weekDates = getWeekDates(new Date(), DEFAULT_WEEK_START)
      return {
        weekDates,
        plan: emptyWeek(weekDates),
        groceryItems: [],

        setMeal: (date, slot, entries, note) =>
          set((s) => ({
            plan: s.plan.map((day) => {
              if (day.date !== date) return day
              const others = day.meals.filter((m) => m.slot !== slot)
              if (!entries.length) return { ...day, meals: others }
              return { ...day, meals: [...others, { id: newId(), slot, entries, note }] }
            }),
          })),

        addEntry: (date, slot, entry) =>
          set((s) => ({
            plan: s.plan.map((day) => {
              if (day.date !== date) return day
              const existing = day.meals.find((m) => m.slot === slot)
              if (existing) {
                return {
                  ...day,
                  meals: day.meals.map((m) =>
                    m.slot === slot ? { ...m, entries: [...m.entries, entry] } : m),
                }
              }
              return { ...day, meals: [...day.meals, { id: newId(), slot, entries: [entry] }] }
            }),
          })),

        removeMeal: (date, mealId) =>
          set((s) => ({
            plan: s.plan.map((day) =>
              day.date === date ? { ...day, meals: day.meals.filter((m) => m.id !== mealId) } : day),
          })),

        clearDay: (date) =>
          set((s) => ({
            plan: s.plan.map((day) => (day.date === date ? { ...day, meals: [] } : day)),
          })),

        copyDay: (fromDate, toDate) =>
          set((s) => {
            const source = s.plan.find((d) => d.date === fromDate)
            if (!source?.meals.length) return {}
            const meals: PlannedMeal[] = source.meals.map((m) => ({ ...m, id: newId() }))
            return { plan: s.plan.map((day) => (day.date === toDate ? { ...day, meals } : day)) }
          }),

        goToWeek: (reference, weekStartsOn) => {
          const dates = getWeekDates(reference, weekStartsOn)
          set((s) => {
            const existing = new Map(s.plan.map((d) => [d.date, d]))
            return { weekDates: dates, plan: dates.map((date) => existing.get(date) ?? { date, meals: [] }) }
          })
        },

        loadSourcePlan: (source) =>
          set((s) => {
            // Source days carry a weekday, not a date. Line them up with the
            // matching weekday in the week currently on screen.
            const byWeekday = new Map(source.days.map((d) => [d.weekday, d]))
            return {
              plan: s.weekDates.map((date) => {
                const weekday = new Date(date + 'T12:00:00').getDay()
                const day = byWeekday.get(weekday)
                if (!day) return { date, meals: [] }
                return {
                  date,
                  meals: day.meals
                    .filter((m) => m.entries.length)
                    .map((m) => ({ id: newId(), slot: m.slot, entries: m.entries, note: m.text })),
                }
              }),
              groceryItems: [],
            }
          }),

        importWeek: (data) => {
          const dates = getWeekDates(new Date(data.weekStart + 'T12:00:00'), DEFAULT_WEEK_START)
          const imported = new Map(data.plan.map((d) => [d.date, d]))
          set({
            weekDates: dates,
            plan: dates.map((date) => imported.get(date) ?? { date, meals: [] }),
            groceryItems: [],
          })
        },

        generateGroceryList: (ctx, recipeIds) => {
          const { plan } = get()
          const filter = recipeIds ? new Set(recipeIds) : null
          const items = new Map<string, GroceryItem>()

          /** Walks nested recipes down to the foods that actually get bought. */
          const collect = (components: Component[], scale: number, fromRecipe: string | null, depth = 0) => {
            if (depth > 6) return
            for (const c of components) {
              if (c.kind === 'food') {
                const existing = items.get(c.foodId)
                const grams = c.grams * scale
                const food = ctx.foods.get(c.foodId)
                if (!food) continue
                // Water and seasonings are not shopping-list material.
                if (food.id === 'water') continue
                if (existing) {
                  existing.grams += grams
                  if (fromRecipe && !existing.fromRecipeIds.includes(fromRecipe)) {
                    existing.fromRecipeIds.push(fromRecipe)
                  }
                } else {
                  items.set(c.foodId, {
                    id: c.foodId,
                    foodId: c.foodId,
                    name: food.names.en,
                    grams,
                    category: food.category,
                    checked: false,
                    fromRecipeIds: fromRecipe ? [fromRecipe] : [],
                  })
                }
              } else {
                const recipe = ctx.recipes.get(c.recipeId)
                if (!recipe) continue
                const perServing = c.servings / Math.max(1, recipe.servings)
                collect(recipe.components, scale * perServing, fromRecipe ?? recipe.id, depth + 1)
              }
            }
          }

          for (const day of plan) {
            for (const meal of day.meals) {
              const entries = filter
                ? meal.entries.filter((e) => e.kind === 'recipe' && filter.has(e.recipeId))
                : meal.entries
              collect(entries, 1, null)
            }
          }

          set({
            groceryItems: [...items.values()].map((i) => ({ ...i, grams: Math.round(i.grams) })),
          })
        },

        toggleGroceryItem: (id) =>
          set((s) => ({
            groceryItems: s.groceryItems.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
          })),

        clearCheckedItems: () =>
          set((s) => ({ groceryItems: s.groceryItems.filter((i) => !i.checked) })),

        clearGroceryList: () => set({ groceryItems: [] }),
      }
    },
    {
      name: 'bite-buddy-mealplan-v2',
      version: SCHEMA_VERSION,
      storage: safeStorage<MealPlanStore>(),
      migrate: discardOlderThan<MealPlanStore>(SCHEMA_VERSION),
    },
  ),
)
