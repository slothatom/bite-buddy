import type { Food, MedCategory, MedTier } from '../types'
import { guessCategory, TIER_BY_CATEGORY } from './foodImport'

/**
 * Checking the food database against itself.
 *
 * The numbers in here come from four places with different standards: the
 * dietician's guide, USDA, Open Food Facts, and somebody typing. Open Food
 * Facts in particular is crowd-entered, so a decimal point in the wrong place
 * is a normal Tuesday. A wrong food is worse than a missing one: it is wrong
 * in every recipe that uses it and in every day those recipes are planned
 * into, quietly, for as long as nobody checks.
 *
 * Only the impossible is called wrong: more than 100 g of macros in 100 g of
 * food, or more energy than pure fat. Everything else is a question, because
 * every rule here has an honest exception and a check that cries wolf weekly
 * is a check nobody opens.
 *
 * Everything here is arithmetic rather than judgement, deliberately. The
 * checks that matter for health data are the ones that can be reproduced
 * exactly and argued with, and "these calories do not match these macros" is a
 * fact. What is left to a person is the reading of it: nothing here edits a
 * food, it only says which ones are worth looking at.
 */

export type FindingKind =
  | 'impossible'   // cannot be true of any food
  | 'mismatch'     // the calories and the macros disagree
  | 'tier'         // how often it says to eat this does not match its group
  | 'category'     // the group looks wrong for the name
  | 'gap'          // something is missing that the food is used for
  | 'stale'        // the source has had time to revise it

export type Severity = 'wrong' | 'check'

export interface Finding {
  foodId: string
  name: string
  kind: FindingKind
  severity: Severity
  /** What is wrong, in one line, with the numbers in it. */
  detail: string
  /** What would fix it, where that is knowable. */
  suggestion?: string
}

/**
 * Energy from macros, by the Atwater factors every food label is built on.
 *
 * Fibre counts where it is known. It is carbohydrate that mostly is not
 * absorbed, worth about 2 kcal a gram rather than 4, and ignoring that makes
 * anything fibrous look wrong: ground cinnamon is 53 g of fibre in 100 g, and
 * the naive sum puts it 100 kcal above what the jar says.
 */
export function atwaterCalories(
  protein: number, carbs: number, fat: number, fibre?: number,
): number {
  const digestible = fibre != null ? Math.max(0, carbs - fibre) : carbs
  const fromFibre = fibre != null ? Math.min(fibre, carbs) * 2 : 0
  return protein * 4 + digestible * 4 + fromFibre + fat * 9
}

/**
 * How far the stated calories may sit from the macros before it is a problem.
 *
 * Some slack is honest: fibre yields about 2 kcal per gram rather than 4, sugar
 * alcohols less again, and rounding on a label is legal and normal. A quarter
 * covers all of that. Beyond it, something is keyed wrong.
 */
const CALORIE_TOLERANCE = 0.25
const CALORIE_FLOOR = 25

/** Pure fat, the most energy-dense thing that can be sold as food. */
const MAX_CALORIES_PER_100G = 902

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

/** Groups where a missing fibre figure is a missing figure rather than a zero. */
const PLANT_GROUPS = new Set<MedCategory>([
  'vegetables', 'fruits', 'legumes', 'grains', 'nuts-seeds', 'herbs-spices',
])

/** The guide's frequencies, in order, so two of them can be compared. */
const OFTEN: Record<MedTier, number> = { rare: 0, moderate: 1, weekly: 2, daily: 3 }

function round(n: number): number {
  return Math.round(n * 10) / 10
}

export interface AuditOptions {
  /** Ids the plans and recipes actually use, which is where a gap matters. */
  inUse?: Set<string>
  /** For the stale check. Passed in so a run is reproducible. */
  now?: number
}

export function auditFood(food: Food, opts: AuditOptions = {}): Finding[] {
  const found: Finding[] = []
  const at = (kind: FindingKind, severity: Severity, detail: string, suggestion?: string) =>
    found.push({ foodId: food.id, name: food.names.en, kind, severity, detail, suggestion })

  const { calories, protein, carbs, fat } = food.per100g

  // ─── Things that cannot be true ────────────────────────────────────────────
  for (const [label, value] of [
    ['calories', calories], ['protein', protein], ['carbs', carbs], ['fat', fat],
  ] as const) {
    if (value < 0) at('impossible', 'wrong', `${label} is negative (${value})`)
  }

  const grams = protein + carbs + fat
  if (grams > 100) {
    at('impossible', 'wrong',
      `protein, carbs and fat come to ${round(grams)} g in 100 g of food`,
      'One of the three is probably per portion rather than per 100 g.')
  }

  if (calories > MAX_CALORIES_PER_100G) {
    at('impossible', 'wrong',
      `${Math.round(calories)} kcal per 100 g, and pure fat is ${MAX_CALORIES_PER_100G}`,
      'Check whether this is per portion, or a decimal point out.')
  }

  // ─── Calories against the macros ───────────────────────────────────────────
  //
  // Reported rather than failed, whichever way the gap runs. There are honest
  // reasons for both directions: fibre and sugar alcohols yield less than the
  // sum says, and alcohol yields energy nothing here records, which is why
  // vanilla extract really is 288 kcal of almost nothing. So this asks the
  // question and leaves the answer to somebody who can look at the jar.
  const fibre = food.per100g.fiber
  const expected = atwaterCalories(protein, carbs, fat, fibre)
  const gap = Math.abs(calories - expected)
  const allowed = Math.max(CALORIE_FLOOR, expected * CALORIE_TOLERANCE)

  if (expected > 0 && gap > allowed) {
    const why = calories > expected
      ? 'Something is adding energy that is not recorded here: alcohol, or a macro left blank.'
      : fibre == null
        ? 'Fibre is not recorded, and fibre yields about half what carbohydrate does.'
        : 'Fibre is accounted for, so one of these four numbers is wrong.'
    at('mismatch', 'check',
      `says ${Math.round(calories)} kcal, but ${round(protein)} g protein, ${round(carbs)} g carbs`
      + `${fibre != null ? ` (${round(fibre)} g of it fibre)` : ''}`
      + ` and ${round(fat)} g fat come to ${Math.round(expected)} kcal`,
      `${why} The difference is about ${Math.round(gap)} kcal per 100 g.`)
  }

  // A food with calories and no macros at all is not necessarily wrong, but it
  // cannot be checked, and it will quietly under-report protein for every
  // recipe it appears in.
  if (calories > 50 && expected === 0) {
    at('gap', 'check', `${Math.round(calories)} kcal with no macros recorded at all`)
  }

  // ─── How often the guide says to eat it ────────────────────────────────────
  //
  // Only in one direction. Marked rarer than its group is a deliberate call
  // somebody made, a banana is a fruit and still the sugary one, and reporting
  // it weekly forever would train everyone to skim the list. Marked more often
  // than the group allows is the direction that quietly licenses eating
  // something several times a week that the guide puts at monthly.
  const expectedTier: MedTier | undefined = TIER_BY_CATEGORY[food.category]
  if (expectedTier && OFTEN[food.medTier] > OFTEN[expectedTier]) {
    at('tier', 'check',
      `filed under ${food.category}, which the guide puts at "${expectedTier}", but marked "${food.medTier}"`,
      'Either the group or the frequency is wrong, and this way round it says to eat it more.')
  }

  // ─── Does the group match the name ─────────────────────────────────────────
  //
  // Only for plain names. "Cheese & blueberry loaf" is a cake, and no amount
  // of pattern matching on a dish name will agree with the shelf it belongs
  // on; guessing at those produced most of the noise and none of the catches.
  const words = food.names.en.trim().split(/\s+/).length
  const guess: MedCategory = guessCategory(food.names.en)
  // 'pantry' is what the guess returns when nothing matched, so it says nothing.
  if (words <= 2 && guess !== 'pantry' && guess !== food.category) {
    at('category', 'check',
      `named like ${guess} but filed under ${food.category}`,
      'Worth a look; the name may just be unusual.')
  }

  // ─── What is missing ───────────────────────────────────────────────────────
  //
  // Only where the figure would actually mean something. Salt matters in
  // everything, so a missing sodium is worth knowing about for any food you
  // eat. Fibre only in the groups that have any: reporting that beef has no
  // fibre figure is reporting that beef has no fibre.
  if (opts.inUse?.has(food.id)) {
    if (food.per100g.sodium == null) {
      at('gap', 'check', 'no salt figure, and it is used in the plans',
        'Every daily salt total that includes it is a floor rather than a figure.')
    }
    if (food.per100g.fiber == null && PLANT_GROUPS.has(food.category)) {
      at('gap', 'check', 'no fibre figure, and it is a food that has fibre',
        'Every daily fibre total that includes it is a floor rather than a figure.')
    }
  }

  // ─── Age of the figures ────────────────────────────────────────────────────
  const retrieved = food.provenance?.retrievedAt
  if (retrieved && opts.now) {
    const age = opts.now - Date.parse(retrieved)
    if (Number.isFinite(age) && age > YEAR_MS) {
      at('stale', 'check',
        `taken from ${food.provenance?.source === 'usda' ? 'USDA' : 'Open Food Facts'}`
        + ` on ${retrieved.slice(0, 10)}, over a year ago`,
        'Worth re-fetching; both databases revise entries.')
    }
  }

  return found
}

export interface AuditReport {
  checked: number
  findings: Finding[]
  /** Counts by kind, for a one-line summary. */
  byKind: Record<FindingKind, number>
}

export function auditFoods(foods: Food[], opts: AuditOptions = {}): AuditReport {
  const findings = foods.flatMap((f) => auditFood(f, opts))

  const byKind = {
    impossible: 0, mismatch: 0, tier: 0, category: 0, gap: 0, stale: 0,
  } as Record<FindingKind, number>
  for (const f of findings) byKind[f.kind] += 1

  // Anything actually wrong first: the ones that change a number you ate.
  const order: Severity[] = ['wrong', 'check']
  findings.sort((a, b) =>
    order.indexOf(a.severity) - order.indexOf(b.severity) || a.name.localeCompare(b.name))

  return { checked: foods.length, findings, byKind }
}
