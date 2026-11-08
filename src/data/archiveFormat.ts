import type { DishCategory, QuickFilter, Recipe, SourcePlan } from '../types'

/**
 * The dietician's plans, as one file.
 *
 * These are somebody's medical correspondence, so they are not in the
 * repository and not in the site's JavaScript. `npm run data:build` writes them
 * to `data/archive.json` (gitignored), an admin uploads that file in Settings,
 * and the household reads it back from Supabase behind its login. Everything
 * here is about the shape of that one file and nothing else, so the app, the
 * scripts and the tests all agree on it.
 */

export const ARCHIVE_VERSION = 1

/** What kind of food a recipe is, worked out by scripts/classify-recipes.ts. */
export interface RecipeClassification {
  category: DishCategory
  quickFilters: QuickFilter[]
}

export interface PlanArchive {
  version: typeof ARCHIVE_VERSION
  /** The plans day by day, every line in her own words. */
  sourcePlans: SourcePlan[]
  /** The meals the importer made out of those lines. */
  mealRecipes: Recipe[]
  /** Category and quick filters, for the meals and the hand-written dishes alike. */
  classification: Record<string, RecipeClassification>
  /** Recipes that turned out to be another recipe, and which one. */
  recipeAliases: Record<string, string>
  /** How many of the plans' meals each recipe feeds. */
  timesPlanned: Record<string, number>
}

export interface ArchiveCounts {
  plans: number
  days: number
  recipes: number
}

export function archiveCounts(archive: PlanArchive): ArchiveCounts {
  return {
    plans: archive.sourcePlans.length,
    days: archive.sourcePlans.reduce((n, p) => n + p.days.length, 0),
    recipes: archive.mealRecipes.length,
  }
}

/** A file that is not a plan archive, with every reason it is not. */
export class ArchiveError extends Error {
  readonly problems: string[]

  constructor(problems: string[]) {
    const shown = problems.slice(0, 5)
    const more = problems.length > shown.length ? ` And ${problems.length - shown.length} more.` : ''
    super(`This is not a plan archive. ${shown.join(' ')}${more}`)
    this.name = 'ArchiveError'
    this.problems = problems
  }
}

const SLOTS = new Set(['breakfast', 'lunch', 'dinner', 'snack', 'snack1', 'snack2'])

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Checks that `value` is a plan archive, and says what is wrong when it is not.
 *
 * A shape check rather than a full one: enough that the app can read every
 * field it reads without a crash, and that a wrong file (a backup, a recipe
 * export, last year's format) is refused with a sentence rather than accepted
 * and shown as an empty archive.
 */
export function parseArchive(value: unknown): PlanArchive {
  const problems: string[] = []
  const say = (what: string) => { if (problems.length < 50) problems.push(what) }

  if (!isObject(value)) throw new ArchiveError(['The file does not hold a JSON object.'])

  if (value.version !== ARCHIVE_VERSION) {
    say(`It says version ${JSON.stringify(value.version ?? null)}, and this app reads version ${ARCHIVE_VERSION}.`)
  }

  if (!Array.isArray(value.sourcePlans)) say('"sourcePlans" should be a list of plans.')
  else {
    value.sourcePlans.forEach((plan: unknown, i) => {
      const at = `Plan ${i + 1}`
      if (!isObject(plan)) { say(`${at} is not an object.`); return }
      for (const key of ['id', 'file', 'label'] as const) {
        if (!isString(plan[key])) say(`${at} has no "${key}".`)
      }
      if (plan.language !== 'ro' && plan.language !== 'hu') say(`${at} has an unknown language.`)
      if (plan.subject !== 'self' && plan.subject !== 'other') say(`${at} has an unknown subject.`)
      if (!Array.isArray(plan.days)) { say(`${at} has no list of days.`); return }
      plan.days.forEach((day: unknown, d) => {
        if (!isObject(day) || !isString(day.dayName) || !isNumber(day.weekday) || !Array.isArray(day.meals)) {
          say(`${at}, day ${d + 1} is not a day.`)
          return
        }
        day.meals.forEach((meal: unknown, m) => {
          if (!isObject(meal) || !isString(meal.text) || !SLOTS.has(meal.slot as string)
            || !Array.isArray(meal.entries)) {
            say(`${at}, day ${d + 1}, meal ${m + 1} is not a meal.`)
          }
        })
      })
    })
  }

  if (!Array.isArray(value.mealRecipes)) say('"mealRecipes" should be a list of recipes.')
  else {
    value.mealRecipes.forEach((r: unknown, i) => {
      const at = `Recipe ${i + 1}`
      if (!isObject(r)) { say(`${at} is not an object.`); return }
      if (!isString(r.id)) say(`${at} has no id.`)
      if (!isObject(r.name) || !isString(r.name.en)) say(`${at} has no English name.`)
      if (!Array.isArray(r.components)) say(`${at} has no components.`)
      if (!Array.isArray(r.steps) || !Array.isArray(r.tags)) say(`${at} has no steps or tags.`)
      for (const key of ['servings', 'prepMinutes', 'cookMinutes'] as const) {
        if (!isNumber(r[key])) say(`${at} has no "${key}".`)
      }
    })
  }

  if (!isObject(value.classification)) say('"classification" should be an object.')
  else {
    for (const [id, c] of Object.entries(value.classification)) {
      if (!isObject(c) || !isString(c.category) || !Array.isArray(c.quickFilters)) {
        say(`The classification of ${id} is not one.`)
      }
    }
  }

  if (!isObject(value.recipeAliases)) say('"recipeAliases" should be an object.')
  else if (!Object.values(value.recipeAliases).every(isString)) say('Every recipe alias should name a recipe.')

  if (!isObject(value.timesPlanned)) say('"timesPlanned" should be an object.')
  else if (!Object.values(value.timesPlanned).every(isNumber)) say('Every "timesPlanned" should be a number.')

  if (problems.length) throw new ArchiveError(problems)
  return value as unknown as PlanArchive
}

/** Reads the text of an archive file. JSON errors are reported the same way. */
export function parseArchiveText(text: string): PlanArchive {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new ArchiveError(['The file is not valid JSON.'])
  }
  return parseArchive(value)
}
