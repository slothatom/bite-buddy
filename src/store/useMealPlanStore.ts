import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeStorage, SCHEMA_VERSION, upgradeThrough } from './persist'
import type {
  Component, DayPlan, GroceryItem, MealOutcome, MealSlot, MedCategory, PantryItem,
  PlannedMeal, SourcePlan,
  WeekStart, WeekTemplate,
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

/**
 * Today, as the calendar sees it here.
 *
 * Pinned to noon before being read as ISO, exactly as `getWeekDates` does, and
 * for the same reason: `new Date().toISOString()` is UTC, so anybody east of
 * Greenwich gets tomorrow's date for the last hours of their evening and
 * anybody west gets yesterday's for the first hours of their morning. That was
 * hand-rolled in six places before this existed.
 */
export function today(now: Date = new Date()): string {
  const d = new Date(now)
  d.setHours(12, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

/** How much of the plan you are looking at. */
/*
 * Today, a week, a fortnight. Not a month.
 *
 * A month of meal slots is 150 boxes, and at that size a day is a rectangle
 * with nothing legible in it, so the view that showed the most showed the
 * least. A fortnight is the longest range where you can still read what is
 * planned, which is the only reason to look at a range at all.
 */
export type PlanRange = 'day' | 'week' | 'fortnight'

export const RANGE_LABELS: Record<PlanRange, string> = {
  day: 'Day',
  week: '1 week',
  fortnight: '2 weeks',
}

const RANGE_DAYS: Record<PlanRange, number> = { day: 1, week: 7, fortnight: 14 }

/** A date a number of days along, read at noon so a timezone cannot shift it. */
export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * The dates on screen, for a window that starts at `weekStart`.
 *
 * A day, a week or a fortnight, counted forward from there. The month view
 * this used to pad out to whole weeks is gone: a hundred and fifty meal slots
 * drawn at that size made every day a rectangle with nothing readable in it,
 * so the view that showed the most showed the least.
 */
export function getRangeDates(weekStart: string, range: PlanRange): string[] {
  return Array.from({ length: RANGE_DAYS[range] }, (_, i) => addDays(weekStart, i))
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
  /**
   * What the last rebuild left off because the cupboard already covers it.
   *
   * Not persisted and not synced: it describes one rebuild, and a stale copy of
   * it read on the next visit would be a claim about a list that no longer
   * exists. It is here rather than in the screen's own state because the screen
   * is not the thing that decided.
   */
  cupboardCovered: { foodId: string; name: string; grams: number }[]
  /** Weeks worth having again. Shared, like everything else here. */
  templates: WeekTemplate[]

  setMeal: (date: string, slot: MealSlot, entries: Component[], note?: string) => void
  addEntry: (date: string, slot: MealSlot, entry: Component) => void
  /**
   * Records something that was eaten and had never been planned.
   *
   * Most of what an evening actually contains was not written down that
   * morning, and the app only had one way in: add it to the plan, find it
   * again, tick it. Two actions and a lie in between, because for the seconds
   * in between the day claims you are going to eat it.
   *
   * It does not fold into a planned meal in the same slot. Ticking that meal
   * would say the rest of it was eaten too, which is a different claim and
   * probably a false one, so this lands as its own record beside the plan. Both
   * screens that read a slot already read all of it.
   */
  recordEaten: (date: string, slot: MealSlot, entry: Component) => void
  removeMeal: (date: string, mealId: string) => void
  /**
   * Takes one entry back out of a slot, and the meal with it if that empties it.
   *
   * The inverse of `addEntry`, which had none. `restoreMeals` puts back a meal
   * that was removed whole and is no help here: undoing an add means taking
   * something out, not putting something back. Without this, adding a meal was
   * the one action in the app that could not be confirmed, because there was
   * nothing to offer alongside the confirmation.
   */
  removeEntry: (date: string, slot: MealSlot, index: number) => void
  /**
   * Puts meals back on a day exactly as they were, ids and outcomes included.
   *
   * What undo needs and what `setMeal` cannot give it. `setMeal` writes a slot
   * from scratch with a fresh id, so undoing a removal that way would lose the
   * tick that said the meal was eaten, and would overwrite whatever has been
   * added to the slot in the seconds since.
   *
   * Meals already present by id are left alone, so taking the offer twice, or
   * after the same meal arrived back some other way, cannot duplicate a day.
   */
  restoreMeals: (date: string, meals: PlannedMeal[]) => void
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
  /**
   * Says what became of a meal: eaten, skipped, or nothing yet.
   *
   * The plan was the only record the app had, so a calorie ring on the home
   * screen was really a ring about an intention. Passing `undefined` clears it,
   * because changing your mind about what happened has to be as easy as saying
   * it in the first place, and a tick you cannot take back is one people stop
   * pressing.
   */
  setMealOutcome: (date: string, mealId: string, outcome: MealOutcome | undefined) => void
  /**
   * Changes how much of something is in a meal, after it is already there.
   *
   * Portions were fixed once added: a recipe or a tub from the fridge went in
   * at one serving and stayed there, so "I had half" and "I had two" were both
   * unsayable. With the imported plans averaging well above the target, the
   * portion is the obvious lever and it was the one thing that could not move.
   */
  updateEntry: (date: string, mealId: string, index: number, amount: number) => void
  /** The same meal again somewhere else, leaving the original where it is. */
  duplicateMeal: (fromDate: string, mealId: string, toDate: string, toSlot?: MealSlot) => void
  /** Exchanges two meals, each landing where the other was. */
  swapMeals: (a: { date: string; mealId: string }, b: { date: string; mealId: string }) => void
  goToWeek: (reference: Date, weekStartsOn: WeekStart) => void
  /**
   * Keeps the week on screen, so it can be used again on a week that has not
   * happened yet.
   *
   * A household eats in patterns. The same shop, the same batch on Sunday, the
   * same four dinners in a different order, and rebuilding that by hand every
   * seventh day is the sort of tax that quietly stops people planning at all.
   * Returns the template, or null when there is nothing on the week to save.
   */
  saveTemplate: (name: string) => WeekTemplate | null
  /**
   * Writes a saved week onto the week on screen.
   *
   * Every day of that week is replaced, including the ones the template leaves
   * empty, because a week you asked for is the week you get rather than a merge
   * nobody can predict. What is already there is counted first and shown to
   * you, and nothing moves until you say so.
   */
  applyTemplate: (id: string) => void
  removeTemplate: (id: string) => void
  /**
   * Puts a forgotten week back, for undo.
   *
   * In its old position rather than on top, because the list is ordered by
   * when each was saved and a restored week arriving at the front is a week
   * that has quietly changed its date.
   */
  restoreTemplate: (template: WeekTemplate) => void
  renameTemplate: (id: string, name: string) => void
  /**
   * Moves the window to the week containing today, if it is not there already.
   *
   * The window used to be whatever week the Planner was last pointed at, kept
   * for ever. Nothing advanced it: not opening the app, not a new day, not a
   * new month. So a fortnight after planning, Home scored a week that had
   * already happened, the shopping list offered its days, and the week you were
   * actually in was empty and unmentioned. The one screen that could tell you
   * was the Planner, and only if you pressed Today.
   *
   * Called on start and whenever the app comes back to the foreground, because
   * a phone left open overnight is the common case, not the rare one.
   */
  ensureCurrentWeek: (weekStartsOn: WeekStart) => void
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
  /**
   * Puts grocery lines back where they were, for undo.
   *
   * By position rather than appended, because the list is walked in the order
   * a shop is walked and a restored line arriving at the bottom is a line you
   * do not find again. Lines already present by id are skipped, so taking the
   * offer twice cannot double the list.
   */
  restoreGroceryItems: (items: GroceryItem[]) => void
}

export const useMealPlanStore = create<MealPlanStore>()(
  persist(
    (set, get) => {
      const weekDates = getWeekDates(new Date(), DEFAULT_WEEK_START)
      return {
        weekDates,
        plan: emptyWeek(weekDates),
        templates: [],
        groceryItems: [],
        cupboardCovered: [],

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

        recordEaten: (date, slot, entry) =>
          set((s) => ({
            plan: withDay(s.plan, date, (day) => {
              const eaten = day.meals.find((m) => m.slot === slot && m.outcome === 'eaten')
              if (eaten) {
                return touch({
                  ...day,
                  meals: day.meals.map((m) =>
                    m.id === eaten.id ? { ...m, entries: [...m.entries, entry] } : m),
                })
              }
              return touch({
                ...day,
                meals: [...day.meals, {
                  id: newId(), slot, entries: [entry],
                  outcome: 'eaten', outcomeAt: new Date().toISOString(),
                }],
              })
            }),
          })),

        removeEntry: (date, slot, index) =>
          set((s) => ({
            plan: s.plan.map((day) => {
              if (day.date !== date) return day
              return touch({
                ...day,
                meals: day.meals.flatMap((m) => {
                  if (m.slot !== slot) return [m]
                  const entries = m.entries.filter((_, at) => at !== index)
                  // A slot with nothing in it is not a meal you skipped, it is
                  // a meal that was never there. The planner draws the empty
                  // slots it needs.
                  return entries.length ? [{ ...m, entries }] : []
                }),
              })
            }),
          })),

        removeMeal: (date, mealId) =>
          set((s) => ({
            plan: s.plan.map((day) =>
              day.date === date
                ? touch({ ...day, meals: day.meals.filter((m) => m.id !== mealId) })
                : day),
          })),

        restoreMeals: (date, meals) =>
          set((s) => ({
            plan: withDay(s.plan, date, (day) => {
              const here = new Set(day.meals.map((m) => m.id))
              const missing = meals.filter((m) => !here.has(m.id))
              if (!missing.length) return day
              return touch({ ...day, meals: [...day.meals, ...missing] })
            }),
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

        setMealOutcome: (date, mealId, outcome) =>
          set((s) => ({
            plan: s.plan.map((day) => (day.date === date
              ? touch({
                ...day,
                meals: day.meals.map((m) => (m.id === mealId
                  ? { ...m, outcome, outcomeAt: outcome ? new Date().toISOString() : undefined }
                  : m)),
              })
              : day)),
          })),

        updateEntry: (date, mealId, index, amount) =>
          set((s) => ({
            plan: s.plan.map((day) => (day.date === date
              ? touch({
                ...day,
                meals: day.meals.map((m) => {
                  if (m.id !== mealId) return m
                  const entries = m.entries.map((entry, i) => {
                    if (i !== index) return entry
                    // Grams for a food, servings for anything already made.
                    // Never below zero, and never a fraction of a gram: the
                    // scale in your kitchen does not have those either.
                    return entry.kind === 'food'
                      ? { ...entry, grams: Math.max(0, Math.round(amount)) }
                      : { ...entry, servings: Math.max(0, amount) }
                  })
                  return { ...m, entries }
                }),
              })
              : day)),
          })),

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

        saveTemplate: (name) => {
          const { weekDates, plan } = get()
          const byDate = new Map(plan.map((d) => [d.date, d]))
          const days = weekDates
            .map((date, offset) => ({
              offset,
              // The id goes. It names one meal on one day, and every day this
              // is dropped onto will need its own.
              meals: (byDate.get(date)?.meals ?? []).map(({ id: _id, ...meal }) => meal),
            }))
            .filter((day) => day.meals.length)

          if (!days.length) return null

          const template: WeekTemplate = {
            id: newId(),
            name: name.trim() || 'Saved week',
            days,
            savedAt: new Date().toISOString(),
          }
          set((s) => ({ templates: [template, ...s.templates] }))
          return template
        },

        applyTemplate: (id) =>
          set((s) => {
            const template = s.templates.find((t) => t.id === id)
            if (!template) return {}
            const byOffset = new Map(template.days.map((d) => [d.offset, d]))
            let plan = s.plan
            s.weekDates.forEach((date, offset) => {
              const meals: PlannedMeal[] = (byOffset.get(offset)?.meals ?? [])
                .map((meal) => ({ ...meal, id: newId() }))
              plan = withDay(plan, date, (day) => touch({ ...day, meals }))
            })
            return { plan }
          }),

        removeTemplate: (id) =>
          set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

        restoreTemplate: (template) =>
          set((s) => (s.templates.some((t) => t.id === template.id)
            ? {}
            : {
              templates: [...s.templates, template]
                .sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
            })),

        renameTemplate: (id, name) =>
          set((s) => ({
            templates: s.templates.map((t) =>
              t.id === id ? { ...t, name: name.trim() || t.name } : t),
          })),

        ensureCurrentWeek: (weekStartsOn) => {
          if (get().weekDates.includes(today())) return
          get().goToWeek(new Date(), weekStartsOn)
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
          const weighed = [...items.values()]
            .map((i) => ({ ...i, needed: stillNeeded(i.grams, opts?.pantry?.get(i.foodId)) }))
          const needed = weighed.filter((i) => i.needed > 0).map(({ needed: g, ...i }) => ({ ...i, grams: g }))

          // What the cupboard took off, kept so the screen can say so. A list
          // that quietly comes back half the length is a list you stop
          // trusting, and "half of it disappeared" is exactly how it was
          // reported. The cupboard is a good reason for a line to be missing;
          // it is not a reason for the disappearance to be silent.
          const covered = weighed
            .filter((i) => i.needed <= 0)
            .map((i) => ({ foodId: i.foodId, name: i.name, grams: Math.round(i.grams) }))

          set({
            cupboardCovered: covered,
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

        clearGroceryList: () => set({ groceryItems: [], cupboardCovered: [] }),

        restoreGroceryItems: (items) =>
          set((s) => {
            const here = new Set(s.groceryItems.map((i) => i.id))
            const missing = items.filter((i) => !here.has(i.id))
            if (!missing.length) return {}

            // The order the list was in, for the lines that are back, with
            // anything added since kept on the end.
            const wanted = new Map(items.map((i, at) => [i.id, at]))
            const known = [...s.groceryItems, ...missing].filter((i) => wanted.has(i.id))
            const rest = s.groceryItems.filter((i) => !wanted.has(i.id))
            known.sort((a, b) => wanted.get(a.id)! - wanted.get(b.id)!)
            return { groceryItems: [...known, ...rest] }
          }),
      }
    },
    {
      name: 'bite-buddy-mealplan-v2',
      version: SCHEMA_VERSION,
      storage: safeStorage<MealPlanStore>(),
      /**
       * Everything except which week you were looking at.
       *
       * A window is a thing about right now, not a thing about your data, and
       * storing it caused three separate faults: it came back stale on every
       * visit, it travelled into backups so restoring one moved your week, and
       * it went up with sync so the other phone could move it too. Left out
       * here, the store's own initialiser wins on every load and that is
       * computed from the clock.
       */
      partialize: (state) => {
        // The window is the planner's own, and the cupboard note describes one
        // rebuild: read back on the next visit it would be a claim about a list
        // that no longer exists.
        const { weekDates: _window, cupboardCovered: _note, ...rest } = state
        return rest as MealPlanStore
      },
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
        /*
         * v3 → v4: Snack 1 and Snack 2 became one Snacks slot.
         *
         * Both are remapped rather than one kept and one dropped, so a day
         * that had a morning apple and an afternoon orange keeps both: a slot
         * has always been a list of meals, so they simply sit together now.
         * A meal carries its own id, so nothing collides.
         *
         * Templates are walked too. A saved week is the same shape as a
         * planned one and would otherwise put its snacks into a slot that no
         * longer exists, which reads on screen as a week that lost half its
         * food the moment you loaded it.
         */
        3: (state) => {
          // Read as a plain string: what is in storage was written under the
          // old shape and holds slot names this build's type no longer has.
          const gone = (slot: string) => slot === 'snack1' || slot === 'snack2'
          const move = (meals: PlannedMeal[]) => meals.map((meal) => (
            gone(meal.slot) ? { ...meal, slot: 'snack' as MealSlot } : meal
          ))
          return {
            ...state,
            plan: Array.isArray(state.plan)
              ? state.plan.map((day) => ({ ...day, meals: move(day.meals ?? []) }))
              : state.plan,
            templates: Array.isArray(state.templates)
              ? state.templates.map((t) => ({
                ...t,
                days: Array.isArray(t.days)
                  ? t.days.map((day: DayPlan) => ({ ...day, meals: move(day.meals ?? []) }))
                  : t.days,
              }))
              : state.templates,
          }
        },
      }),
    },
  ),
)
