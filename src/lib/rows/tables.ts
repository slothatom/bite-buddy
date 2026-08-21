import type {
  BodyMeasurement, CookSession, DayPlan, Food, GroceryItem, PlannedMeal, Portion, Recipe,
  SleepEntry, StepEntry, UserProfile, WeightEntry,
} from '../../types'
import { useMealPlanStore } from '../../store/useMealPlanStore'
import { useRecipeStore } from '../../store/useRecipeStore'
import { useFoodStore } from '../../store/useFoodStore'
import { useBodyStore } from '../../store/useBodyStore'
import { useCookStore } from '../../store/useCookStore'
import { useActivityStore } from '../../store/useActivityStore'
import { useUserStore } from '../../store/useUserStore'
import { usePortionStore } from '../../store/usePortionStore'
import type { RowTable, SyncRow } from './types'

/**
 * How the app's state looks as rows, and how rows become state again.
 *
 * The stores are untouched: they are still the working copy, still local-first,
 * still what every screen reads. This is a translation at the edge, and keeping
 * it here rather than inside the stores is what stops the sync layer leaking
 * into the app.
 *
 * Each table reads its slice and writes it back. Nothing here knows about the
 * network, which is why the whole file can be tested by calling it.
 */

/** A list of things with ids, which is most of what the app holds. */
function listTable<T extends { id: string }>(
  table: string,
  read: () => T[],
  write: (rows: T[]) => void,
  promote: (item: T) => Partial<SyncRow> = () => ({}),
): RowTable {
  return {
    table,
    read: () => read().map((item) => ({ id: item.id, data: item, ...promote(item) })),
    apply: (rows) => write(rows.map((r) => r.data as T).filter(Boolean)),
  }
}

/**
 * The week, as one row per meal.
 *
 * A meal rather than a day, because the day is what two people edit at the same
 * time. Your Thursday dinner and Oli's Thursday lunch are two rows that cannot
 * contend; as one document they were a coin toss.
 *
 * A day exists here only if it has meals on it. An empty day carries no
 * information, and the planner creates the ones it needs to show.
 */
const planMeals: RowTable = {
  table: 'plan_meals',
  read: () =>
    useMealPlanStore.getState().plan.flatMap((day) =>
      day.meals.map((meal) => ({
        id: meal.id,
        day: day.date,
        slot: meal.slot,
        data: meal,
      }))),

  apply: (rows) => {
    const byDate = new Map<string, PlannedMeal[]>()
    for (const row of rows) {
      const date = row.day
      const meal = row.data as PlannedMeal | undefined
      if (!date || !meal) continue
      const meals = byDate.get(date) ?? []
      meals.push(meal)
      byDate.set(date, meals)
    }

    const plan: DayPlan[] = [...byDate.entries()]
      .map(([date, meals]) => ({ date, meals }))
      .sort((a, b) => a.date.localeCompare(b.date))

    useMealPlanStore.setState({ plan })
  },
}

const groceryItems = listTable<GroceryItem>(
  'grocery_items',
  () => useMealPlanStore.getState().groceryItems,
  (items) => useMealPlanStore.setState({ groceryItems: items }),
)

/**
 * The recipe library, meaning your changes to it.
 *
 * The 275 shipped recipes live in the app, so a row exists only for one you
 * wrote, edited, hid, favourited or folded into another. That is why the four
 * separate lists the store keeps collapse into one row per recipe: they are all
 * answers to "what have you done to this recipe".
 *
 * Hiding is a column with a value rather than an entry in a list, which is what
 * makes deleting work. An absence cannot be told apart from not having heard.
 */
const recipes: RowTable = {
  table: 'recipes',
  read: () => {
    const { custom, hidden, favouriteIds, mergedInto } = useRecipeStore.getState()
    const ids = new Set([...custom.map((r) => r.id), ...hidden, ...favouriteIds, ...Object.keys(mergedInto)])
    const byId = new Map(custom.map((r) => [r.id, r]))

    return [...ids].map((id) => ({
      id,
      data: byId.get(id) ?? null,
      hidden: hidden.includes(id),
      favourite: favouriteIds.includes(id),
      merged_into: mergedInto[id] ?? null,
    }))
  },

  apply: (rows) => {
    useRecipeStore.setState({
      custom: rows.map((r) => r.data as Recipe).filter(Boolean),
      hidden: rows.filter((r) => r.hidden).map((r) => r.id),
      favouriteIds: rows.filter((r) => r.favourite).map((r) => r.id),
      mergedInto: Object.fromEntries(
        rows.filter((r) => r.merged_into).map((r) => [r.id, r.merged_into as string]),
      ),
    })
  },
}

const foods: RowTable = {
  table: 'foods',
  read: () => {
    const { custom, hidden, mergedInto } = useFoodStore.getState()
    const ids = new Set([...custom.map((f) => f.id), ...hidden, ...Object.keys(mergedInto)])
    const byId = new Map(custom.map((f) => [f.id, f]))

    return [...ids].map((id) => ({
      id,
      data: byId.get(id) ?? null,
      hidden: hidden.includes(id),
      merged_into: mergedInto[id] ?? null,
    }))
  },

  apply: (rows) => {
    useFoodStore.setState({
      custom: rows.map((r) => r.data as Food).filter(Boolean),
      hidden: rows.filter((r) => r.hidden).map((r) => r.id),
      mergedInto: Object.fromEntries(
        rows.filter((r) => r.merged_into).map((r) => [r.id, r.merged_into as string]),
      ),
    })
  },
}

const byDate = (a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date)

const weights = listTable<WeightEntry>(
  'weights',
  () => useBodyStore.getState().weightEntries,
  (rows) => useBodyStore.setState({ weightEntries: [...rows].sort(byDate) }),
  (w) => ({ day: w.date, member_id: w.memberId ?? null }),
)

const measurements = listTable<BodyMeasurement>(
  'measurements',
  () => useBodyStore.getState().measurements,
  (rows) => useBodyStore.setState({ measurements: [...rows].sort(byDate) }),
  (m) => ({ day: m.date, member_id: m.memberId ?? null }),
)

const workouts = listTable(
  'workouts',
  () => useActivityStore.getState().workouts,
  (rows) => useActivityStore.setState({ workouts: [...rows].sort(byDate) }),
  (w) => ({ day: w.date, member_id: w.personId }),
)

const steps = listTable<StepEntry>(
  'steps',
  () => useActivityStore.getState().steps,
  (rows) => useActivityStore.setState({ steps: [...rows].sort(byDate) }),
  (s) => ({ day: s.date, member_id: s.personId }),
)

const sleep = listTable<SleepEntry>(
  'sleep',
  () => useActivityStore.getState().sleep,
  (rows) => useActivityStore.setState({ sleep: [...rows].sort(byDate) }),
  (s) => ({ day: s.date, member_id: s.personId }),
)

const portions = listTable<Portion>(
  'portions',
  () => usePortionStore.getState().portions,
  (rows) => usePortionStore.setState({
    portions: [...rows].sort((a, b) => a.madeOn.localeCompare(b.madeOn)),
  }),
  (p) => ({ day: p.madeOn }),
)

const cookSessions = listTable<CookSession>(
  'cook_sessions',
  () => useCookStore.getState().sessions,
  (rows) => useCookStore.setState({
    sessions: [...rows].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)),
  }),
  (s) => ({ day: s.date }),
)

/**
 * The profile: targets, the week start, the name, the moments.
 *
 * The one thing in the app there is genuinely only one of, so it is one row and
 * the later edit wins. It is stamped on every change, and a row with no stamp
 * counts as older than one with.
 */
const settings: RowTable = {
  table: 'settings',
  read: () => [{ id: 'profile', data: useUserStore.getState().profile }],
  apply: (rows) => {
    const profile = rows.find((r) => r.id === 'profile')?.data as UserProfile | undefined
    if (profile) useUserStore.setState({ profile })
  },
}

export const ROW_TABLES: RowTable[] = [
  planMeals, groceryItems, recipes, foods,
  weights, measurements, workouts, steps, sleep,
  portions, cookSessions, settings,
]
