import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import type {
  Component, DayPlan, GroceryItem, MealSlot, MedCategory, PantryItem, PlannedMeal, SourcePlan,
  WeekStart,
} from '../types'
import { parseAmount } from '../lib/grocery'
import { DEFAULT_WEEK_START } from '../types'
import type { NutritionContext } from '../lib/nutrition'
import { stillNeeded } from '../lib/pantry'

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

/** How much of the plan you are looking at. */
export type PlanRange = 'week' | 'fortnight' | 'month'

export const RANGE_LABELS: Record<PlanRange, string> = {
  week: '1 week',
  fortnight: '2 weeks',
  month: '1 month',
}

function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The dates on screen, for a window that starts at `weekStart`.
 *
 * A week and a fortnight are simply seven and fourteen days from there. A
 * month is the calendar month the window sits in, padded out to whole weeks so
 * the grid has no ragged edges: the days either side belong to the neighbouring
 * months and are real days you can plan, they are just drawn quieter.
 */
export function getRangeDates(
  weekStart: string,
  range: PlanRange,
  weekStartsOn: WeekStart = DEFAULT_WEEK_START,
): string[] {
  if (range === 'week') return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  if (range === 'fortnight') return Array.from({ length: 14 }, (_, i) => addDays(weekStart, i))

  const anchor = new Date(weekStart + 'T12:00:00')
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12)

  const gridStart = getWeekDates(first, weekStartsOn)[0]
  const gridEnd = getWeekDates(last, weekStartsOn)[6]

  const out: string[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) out.push(d)
  return out
}

/** The month a window belongs to, for labelling and for greying the edges. */
export function monthOf(weekStart: string): number {
  return new Date(weekStart + 'T12:00:00').getMonth()
}

function emptyWeek(dates: string[]): DayPlan[] {
  return dates.map((date) => ({ date, meals: [] }))
}

/**
 * Stamps a day as changed.
 *
 * Every mutation goes through this, because sync merges the week a day at a
 * time and an unstamped day cannot be compared against the other person's copy.
 */
function touch(day: DayPlan): DayPlan {
  return { ...day, updatedAt: new Date().toISOString() }
}

/**
 * Applies a change to one day, creating it if the plan has never seen it.
 *
 * The planner used to hold exactly the seven days on screen, so every mutation
 * could assume its day existed. It does not any more: you can look at a
 * fortnight or a month, and a day three weeks out is a day nothing has written
 * to yet. Without this, adding a meal there did nothing at all, silently.
 */
function withDay(plan: DayPlan[], date: string, change: (day: DayPlan) => DayPlan): DayPlan[] {
  if (plan.some((d) => d.date === date)) {
    return plan.map((d) => (d.date === date ? change(d) : d))
  }
  return [...plan, change({ date, meals: [] })].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Days worth keeping.
 *
 * Everything with food in it, since that is your history, plus the empty days
 * of whatever is on screen so the grid has something to render. An empty day
 * from a week nobody is looking at is a row of nothing, and keeping every one
 * of them forever would grow the synced document without adding a fact.
 */
function pruneEmptyDays(plan: DayPlan[], keep: string[]): DayPlan[] {
  const shown = new Set(keep)
  return plan.filter((d) => d.meals.length > 0 || shown.has(d.date))
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export interface GroceryOptions {
  /** Only these days. Everything the plan holds, if left out. */
  dates?: string[]
  /** Only these recipes, for shopping for one batch cook. */
  recipeIds?: string[]
  /**
   * What is already in the cupboard, so the list stops asking for it.
   *
   * Left out, the list is what the plan needs. Given, it is what the plan needs
   * and you do not have, which is the difference between a list you read and a
   * list of forty lines you read past.
   */
  pantry?: Map<string, PantryItem>
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
  /**
   * Takes a meal off one day and puts it on another, or in another slot.
   *
   * Plans change by rearranging far more often than by being written fresh:
   * Thursday's dinner becomes Friday's because Thursday ran late. Doing that
   * with the tools that existed meant reading what was there, deleting it, and
   * typing it again on the other day.
   */
  moveMeal: (fromDate: string, mealId: string, toDate: string, toSlot?: MealSlot) => void
  /** The same meal again somewhere else, leaving the original where it is. */
  duplicateMeal: (fromDate: string, mealId: string, toDate: string, toSlot?: MealSlot) => void
  /** Exchanges two meals, each landing where the other was. */
  swapMeals: (a: { date: string; mealId: string }, b: { date: string; mealId: string }) => void
  goToWeek: (reference: Date, weekStartsOn: WeekStart) => void
  /** Drops one of the dietician's weeks onto the current week's dates. */
  loadSourcePlan: (source: SourcePlan) => void
  importWeek: (data: MealPlanExport) => void

  /**
   * Works the list out from the plan.
   *
   * `dates` limits it to the days you are actually shopping for, which is the
   * usual case: you buy for the next four days, not for every day the app has
   * ever held. Without it the list covers the whole plan, which now runs to
   * months.
   */
  generateGroceryList: (ctx: NutritionContext, opts?: GroceryOptions) => void
  toggleGroceryItem: (id: string) => void
  addGroceryItem: (item: { name: string; amount: string; category?: MedCategory }) => void
  updateGroceryItem: (id: string, updates: { name?: string; amount?: string }) => void
  removeGroceryItem: (id: string) => void
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
            plan: withDay(s.plan, date, (day) => {
              const others = day.meals.filter((m) => m.slot !== slot)
              if (!entries.length) return touch({ ...day, meals: others })
              return touch({ ...day, meals: [...others, { id: newId(), slot, entries, note }] })
            }),
          })),

        addEntry: (date, slot, entry) =>
          set((s) => ({
            plan: withDay(s.plan, date, (day) => {
              const existing = day.meals.find((m) => m.slot === slot)
              if (existing) {
                return touch({
                  ...day,
                  meals: day.meals.map((m) =>
                    m.slot === slot ? { ...m, entries: [...m.entries, entry] } : m),
                })
              }
              return touch({ ...day, meals: [...day.meals, { id: newId(), slot, entries: [entry] }] })
            }),
          })),

        removeMeal: (date, mealId) =>
          set((s) => ({
            plan: s.plan.map((day) =>
              day.date === date
                ? touch({ ...day, meals: day.meals.filter((m) => m.id !== mealId) })
                : day),
          })),

        clearDay: (date) =>
          set((s) => ({
            plan: s.plan.map((day) => (day.date === date ? touch({ ...day, meals: [] }) : day)),
          })),

        moveMeal: (fromDate, mealId, toDate, toSlot) =>
          set((s) => {
            const meal = s.plan.find((d) => d.date === fromDate)?.meals.find((m) => m.id === mealId)
            if (!meal) return {}
            const landed: PlannedMeal = { ...meal, slot: toSlot ?? meal.slot }
            if (fromDate === toDate) {
              return {
                plan: withDay(s.plan, toDate, (day) => touch({
                  ...day,
                  meals: day.meals.map((m) => (m.id === mealId ? landed : m)),
                })),
              }
            }
            const without = s.plan.map((day) =>
              day.date === fromDate
                ? touch({ ...day, meals: day.meals.filter((m) => m.id !== mealId) })
                : day)
            return {
              plan: withDay(without, toDate, (day) => touch({ ...day, meals: [...day.meals, landed] })),
            }
          }),

        duplicateMeal: (fromDate, mealId, toDate, toSlot) =>
          set((s) => {
            const meal = s.plan.find((d) => d.date === fromDate)?.meals.find((m) => m.id === mealId)
            if (!meal) return {}
            // A new id, or the copy and the original would be the same meal as
            // far as every other action is concerned: removing one would remove
            // both.
            const copy: PlannedMeal = { ...meal, id: newId(), slot: toSlot ?? meal.slot }
            return { plan: withDay(s.plan, toDate, (day) => touch({ ...day, meals: [...day.meals, copy] })) }
          }),

        swapMeals: (a, b) =>
          set((s) => {
            const first = s.plan.find((d) => d.date === a.date)?.meals.find((m) => m.id === a.mealId)
            const second = s.plan.find((d) => d.date === b.date)?.meals.find((m) => m.id === b.mealId)
            if (!first || !second) return {}

            // Slots are exchanged along with days: swapping Tuesday's lunch for
            // Friday's dinner has to leave a lunch on Friday, not two dinners.
            const swapped = (day: DayPlan): DayPlan => touch({
              ...day,
              meals: day.meals.map((m) => {
                if (m.id === a.mealId) return { ...second, id: m.id, slot: first.slot }
                if (m.id === b.mealId) return { ...first, id: m.id, slot: second.slot }
                return m
              }),
            })

            return {
              plan: s.plan.map((day) =>
                day.date === a.date || day.date === b.date ? swapped(day) : day),
            }
          }),

        copyDay: (fromDate, toDate) =>
          set((s) => {
            const source = s.plan.find((d) => d.date === fromDate)
            if (!source?.meals.length) return {}
            const meals: PlannedMeal[] = source.meals.map((m) => ({ ...m, id: newId() }))
            return { plan: withDay(s.plan, toDate, (day) => touch({ ...day, meals })) }
          }),

        /**
         * Moves the window, keeping every other day.
         *
         * This used to replace the plan with the seven days of the week you
         * moved to, so planning a fortnight ahead and then stepping back threw
         * the second week away. The window is now just a window.
         */
        goToWeek: (reference, weekStartsOn) => {
          const dates = getWeekDates(reference, weekStartsOn)
          set((s) => {
            const existing = new Set(s.plan.map((d) => d.date))
            const added = dates.filter((d) => !existing.has(d)).map((date) => ({ date, meals: [] }))
            const plan = [...s.plan, ...added].sort((a, b) => a.date.localeCompare(b.date))
            return { weekDates: dates, plan: pruneEmptyDays(plan, dates) }
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
                if (!day) return touch({ date, meals: [] })
                return touch({
                  date,
                  meals: day.meals
                    .filter((m) => m.entries.length)
                    .map((m) => ({ id: newId(), slot: m.slot, entries: m.entries, note: m.text })),
                })
              }),
              groceryItems: [],
            }
          }),

        importWeek: (data) => {
          const dates = getWeekDates(new Date(data.weekStart + 'T12:00:00'), DEFAULT_WEEK_START)
          const imported = new Map(data.plan.map((d) => [d.date, d]))
          set({
            weekDates: dates,
            plan: dates.map((date) => touch(imported.get(date) ?? { date, meals: [] })),
            groceryItems: [],
          })
        },

        generateGroceryList: (ctx, opts) => {
          const { plan, groceryItems } = get()
          const filter = opts?.recipeIds ? new Set(opts.recipeIds) : null
          const days = opts?.dates ? new Set(opts.dates) : null
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
              } else if (c.kind === 'portion') {
                // Already cooked and already in the fridge. Buying its
                // ingredients again is the exact thing cooking in advance was
                // meant to avoid, and it is why a portion is its own kind of
                // entry rather than a recipe with a note on it.
                continue
              } else {
                const recipe = ctx.recipes.get(c.recipeId)
                if (!recipe) continue
                const perServing = c.servings / Math.max(1, recipe.servings)
                collect(recipe.components, scale * perServing, fromRecipe ?? recipe.id, depth + 1)
              }
            }
          }

          for (const day of plan) {
            if (days && !days.has(day.date)) continue
            for (const meal of day.meals) {
              const entries = filter
                ? meal.entries.filter((e) => e.kind === 'recipe' && filter.has(e.recipeId))
                : meal.entries
              collect(entries, 1, null)
            }
          }

          // Rebuilding keeps two things: the lines you added yourself, which
          // were never in the plan and would vanish otherwise, and the ticks
          // against anything you have already put in the trolley.
          const ticked = new Set(groceryItems.filter((i) => i.checked).map((i) => i.id))
          const mine = groceryItems.filter((i) => i.manual)

          // What the cupboard already covers comes off the list entirely rather
          // than appearing ticked: a line you have to read and dismiss is worse
          // than no line, and the cupboard is the reason it is not needed.
          const needed = [...items.values()]
            .map((i) => ({ ...i, grams: stillNeeded(i.grams, opts?.pantry?.get(i.foodId)) }))
            .filter((i) => i.grams > 0)

          set({
            groceryItems: [
              ...needed.map((i) => ({
                ...i, grams: Math.round(i.grams), checked: ticked.has(i.id),
              })),
              ...mine,
            ],
          })
        },

        toggleGroceryItem: (id) =>
          set((s) => ({
            groceryItems: s.groceryItems.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
          })),

        addGroceryItem: ({ name, amount, category }) => {
          const parsed = parseAmount(amount)
          set((s) => ({
            groceryItems: [...s.groceryItems, {
              id: `manual-${newId()}`,
              foodId: '',
              name: name.trim(),
              grams: parsed.grams ?? 0,
              amount: parsed.text,
              category: category ?? 'pantry',
              checked: false,
              fromRecipeIds: [],
              manual: true,
            }],
          }))
        },

        updateGroceryItem: (id, updates) =>
          set((s) => ({
            groceryItems: s.groceryItems.map((i) => {
              if (i.id !== id) return i
              const next = { ...i }
              if (updates.name !== undefined) next.name = updates.name.trim() || i.name
              if (updates.amount !== undefined) {
                const parsed = parseAmount(updates.amount)
                next.grams = parsed.grams ?? 0
                next.amount = parsed.text
              }
              return next
            }),
          })),

        removeGroceryItem: (id) =>
          set((s) => ({ groceryItems: s.groceryItems.filter((i) => i.id !== id) })),

        clearCheckedItems: () =>
          set((s) => ({ groceryItems: s.groceryItems.filter((i) => !i.checked) })),

        clearGroceryList: () => set({ groceryItems: [] }),
      }
    },
    {
      name: 'bite-buddy-mealplan-v2',
      version: SCHEMA_VERSION,
      storage: safeStorage<MealPlanStore>(),
      migrate: upgradeThrough<MealPlanStore>(SCHEMA_VERSION, {
        // v1 → v2: days gained updatedAt. Existing days are stamped once, at
        // the epoch, so anything either of you touches from now on wins over
        // state that predates the merge.
        1: (state) => ({
          ...state,
          plan: Array.isArray(state.plan)
            ? state.plan.map((day) => ({ ...(day as DayPlan), updatedAt: new Date(0).toISOString() }))
            : state.plan,
        }),
        // v2 → v3: XP left the user profile; the plan is unaffected.
        2: (state) => state,
      }),
    },
  ),
)
