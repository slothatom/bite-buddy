import type { DayPlan, MealSlot, Nutrients, Targets, WeightEntry } from '../../types'
import { MEAL_SLOTS } from '../../types'
import {
  dayEaten, emptyNutrients, entriesThatCount, entryOutcome, type NutritionContext,
} from '../nutrition'
import { entriesCompleteness } from '../completeness'
import { entryName } from '../entryLabel'
import { scoreGaps, scoreWeek, type GoalProgress, type ScoreGaps } from '../mediterranean'
import { targetStatus, type TargetStatus } from '../status'
import { inUnit, type WeightUnit } from '../weight'
import { weeksOf } from './range'

/**
 * What goes on the page a dietician reads.
 *
 * Pure: everything the screen and the downloaded file show is worked out here
 * from the plan, the targets and the weight log, using the same rules the rest
 * of the app uses. What a day amounted to is `dayEaten`; which figures are a
 * floor is the unknown-is-not-zero report; the Mediterranean servings are the
 * Progress scoring, week by week. Nothing here has its own idea of any of it.
 */

export interface ExportPerson {
  id: string
  name: string
}

/** What happened to one item on a day, in the words the page uses. */
export type ItemOutcome = 'eaten' | 'skipped' | 'not-ticked'

export interface SummaryItem {
  slot: MealSlot
  name: string
  outcome: ItemOutcome
}

export interface SummaryDay {
  date: string
  items: SummaryItem[]
  /** False when nothing at all was planned or written down. A gap, not a zero. */
  any: boolean
  /** True once something on the day was ticked, so it is a record. */
  recorded: boolean
  /** What the day came to: eaten, plus anything nobody said was skipped. */
  nutrients: Nutrients
  calories: TargetStatus
  /**
   * Which figures are a floor rather than a total, shown with a `+`.
   *
   * `all` when an entry no longer resolves to food, which leaves every figure
   * short; otherwise the nutrients only some ingredients mention.
   */
  floors: { all: boolean; fiber: boolean }
  /** Entries the figures are fully sure of, out of those that count. */
  known: number
  total: number
}

export interface SummaryWeek {
  dates: string[]
  /** Days in the block with anything on them. */
  plannedDays: number
  goals: GoalProgress[]
  gaps: ScoreGaps
}

export interface SummaryWeight {
  date: string
  value: number
  unit: WeightUnit
  notes?: string
}

export interface DieticianSummary {
  person: ExportPerson
  from: string
  to: string
  generatedOn: string
  targets: Targets
  days: SummaryDay[]
  weeks: SummaryWeek[]
  weights: SummaryWeight[]
  /** Averages over the days that had food on them, not over the gaps. */
  average: { days: number; recorded: number; nutrients: Nutrients } | null
}

export interface SummaryInput {
  dates: string[]
  plan: DayPlan[]
  ctx: NutritionContext
  targets: Targets
  person: ExportPerson
  /** Every weight entry; the ones for this person in range are picked here. */
  weights: WeightEntry[]
  weightUnit: WeightUnit
  generatedOn: string
}

export function summariseDay(date: string, day: DayPlan | undefined, ctx: NutritionContext, targets: Targets): SummaryDay {
  const meals = day?.meals ?? []
  const items: SummaryItem[] = []
  for (const slot of MEAL_SLOTS) {
    for (const meal of meals.filter((m) => m.slot === slot)) {
      for (const entry of meal.entries) {
        const outcome = entryOutcome(entry, meal)
        items.push({
          slot,
          name: entryName(entry, ctx),
          outcome: outcome === 'eaten' ? 'eaten' : outcome === 'skipped' ? 'skipped' : 'not-ticked',
        })
      }
    }
  }

  const any = items.length > 0
  const { nutrients, recorded } = day && any
    ? dayEaten(day, ctx)
    : { nutrients: emptyNutrients(), recorded: false }
  // Completeness of the entries the figures are built from, so the count and
  // the numbers beside it are about the same food.
  const counted = day ? entriesThatCount(day).entries : []
  const { known, total, report } = entriesCompleteness(counted, ctx)

  return {
    date,
    items,
    any,
    recorded,
    nutrients,
    calories: targetStatus(nutrients.calories, targets.calories),
    floors: {
      all: report.unresolved > 0,
      fiber: report.unresolved > 0 || report.partial.includes('fiber'),
    },
    known,
    total,
  }
}

export function buildSummary(input: SummaryInput): DieticianSummary {
  const { dates, plan, ctx, targets, person, weightUnit, generatedOn } = input
  const byDate = new Map(plan.map((d) => [d.date, d]))

  const days = dates.map((date) => summariseDay(date, byDate.get(date), ctx, targets))

  // The Progress scoring, one block of seven at a time, because its weekly
  // goals are a week's worth and a month scored as one week would be four
  // times over on every one of them.
  const weeks = weeksOf(dates).map((block): SummaryWeek => {
    const blockDays = block.map((d) => byDate.get(d)).filter((d): d is DayPlan => Boolean(d))
    return {
      dates: block,
      plannedDays: blockDays.filter((d) => d.meals.length).length,
      goals: scoreWeek(blockDays, ctx),
      gaps: scoreGaps(blockDays, ctx),
    }
  })

  const from = dates[0]
  const to = dates[dates.length - 1]
  const weights = input.weights
    .filter((e) => e.memberId === person.id && e.date >= from && e.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e): SummaryWeight => ({
      date: e.date, value: inUnit(e, weightUnit), unit: weightUnit,
      ...(e.notes ? { notes: e.notes } : {}),
    }))

  const withFood = days.filter((d) => d.any)
  const average = withFood.length
    ? {
        days: withFood.length,
        recorded: withFood.filter((d) => d.recorded).length,
        nutrients: averageOf(withFood.map((d) => d.nutrients)),
      }
    : null

  return { person, from, to, generatedOn, targets, days, weeks, weights, average }
}

function averageOf(list: Nutrients[]): Nutrients {
  const n = list.length || 1
  const sum = (k: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber') =>
    list.reduce((a, x) => a + (x[k] ?? 0), 0) / n
  return {
    calories: sum('calories'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat'),
    fiber: sum('fiber'),
  }
}
