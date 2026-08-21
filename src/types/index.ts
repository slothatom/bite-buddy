// ─── Nutrition ───────────────────────────────────────────────────────────────

export interface Macros {
  calories: number
  protein: number  // g
  carbs: number    // g
  fat: number      // g
}

/**
 * Everything beyond the four macros.
 *
 * Every field is optional and `undefined` means **unknown**, never zero. A food
 * whose source said nothing about zinc has not told you there is no zinc in it,
 * and a total that quietly treats the two the same is a total that lies. See
 * `reportNutrients` in lib/nutrition.ts for how a partial total says so.
 *
 * Sodium is the canonical salt figure and is always in milligrams; sources give
 * either salt or sodium, and `saltFromSodium` converts. What the source
 * actually said is kept on the food's provenance.
 */
export interface Micros {
  fiber?: number        // g
  sugar?: number        // g
  sodium?: number       // mg
  saturatedFat?: number // g
  cholesterol?: number  // mg
  calcium?: number      // mg
  iron?: number         // mg
  magnesium?: number    // mg
  potassium?: number    // mg
  zinc?: number         // mg
  vitaminA?: number     // mcg RAE
  vitaminB6?: number    // mg
  vitaminB12?: number   // mcg
  vitaminC?: number     // mg
  vitaminD?: number     // mcg
  vitaminE?: number     // mg
  folate?: number       // mcg DFE
}

/** The micronutrient keys, in the order they are worth showing. */
export const MICRO_KEYS = [
  'fiber', 'sugar', 'sodium', 'saturatedFat', 'cholesterol',
  'calcium', 'iron', 'magnesium', 'potassium', 'zinc',
  'vitaminA', 'vitaminB6', 'vitaminB12', 'vitaminC', 'vitaminD', 'vitaminE', 'folate',
] as const

export type MicroKey = typeof MICRO_KEYS[number]

/** Everything we know about a quantity of food. */
export type Nutrients = Macros & Micros

export const EMPTY_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 }

// ─── Foods ───────────────────────────────────────────────────────────────────

/**
 * The 17 food groups of the Mediterranean Diet guide, in the order the guide
 * presents them. Used for browsing the food library and for serving-goal scoring.
 */
export type MedCategory =
  | 'vegetables' | 'legumes' | 'fruits' | 'grains' | 'nuts-seeds'
  | 'herbs-spices' | 'fats-vinegars' | 'dairy' | 'fish-seafood'
  | 'poultry' | 'eggs' | 'red-meat' | 'pantry' | 'spreads-sauces'
  | 'treats' | 'sweeteners' | 'beverages'

/**
 * How often the guide says to eat this group:
 *  daily   , "Eat More", the base of every meal
 *  weekly  , several times a week (legumes, fish)
 *  moderate, "Eat in Moderation" (dairy, poultry, eggs)
 *  rare    , "Eat Rarely or Limit" (red meat, sweets)
 */
export type MedTier = 'daily' | 'weekly' | 'moderate' | 'rare'

/**
 * The dietician always weighs starches and meat BEFORE cooking
 * ("50 g bulgur nefiert", "100 g piept de pui crud"). 50 g of dry bulgur is
 * roughly three times the calories of 50 g of cooked bulgur, so the state a
 * food is weighed in is part of its identity, not a display detail.
 */
export type FoodState = 'raw' | 'cooked' | 'dry' | 'as-sold'

/** A named portion, e.g. "o lingurita" = 5 g, "1 medium apple" = 150 g. */
export interface FoodUnit {
  label: string
  grams: number
}

/**
 * The units an amount can be entered in.
 *
 * Grams are what everything is stored and calculated in; the rest are ways of
 * saying a number of grams. Millilitres are treated as grams, which is right for
 * water, milk and stock and close enough for oil at the quantities a kitchen
 * scale can read anyway.
 */
export type PortionUnit = 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'tsp' | 'tbsp' | 'cup'

/**
 * Where a food's numbers came from, kept so they never have to be fetched twice
 * and so a wrong number can be traced back to whoever said it.
 */
export interface FoodProvenance {
  source: 'curated' | 'usda' | 'off' | 'custom'
  /** FDC ID for USDA, barcode for Open Food Facts. */
  externalId?: string
  /** The name the source used, which is often not the name you gave it. */
  sourceName?: string
  /** What the figures are per, almost always 100 g. */
  basePortion: { amount: number; unit: PortionUnit }
  /** ISO date the figures were fetched. Nutrition data gets revised. */
  retrievedAt?: string
  /**
   * Salt as the source stated it, before normalising to sodium in milligrams.
   * European labels give salt in grams; USDA gives sodium in milligrams.
   */
  saltAsGiven?: { kind: 'salt' | 'sodium'; value: number; unit: 'g' | 'mg' }
}

export interface Food {
  id: string
  /** Display names. English is required; Romanian/Hungarian come from the plans. */
  names: { en: string; ro?: string; hu?: string }
  /** Extra strings that should match this food in search and during plan import. */
  aliases: string[]
  category: MedCategory
  medTier: MedTier
  state: FoodState
  /** Nutrients per 100 g (or per 100 ml for liquids). */
  per100g: Nutrients
  /** Named portions, beyond plain grams. */
  units: FoodUnit[]
  source: 'curated' | 'usda' | 'off' | 'custom'
  /** Where the numbers came from. Absent on the foods curated by hand. */
  provenance?: FoodProvenance
  /** Set on foods the user added themselves. */
  createdAt?: string
}

// ─── Recipes ─────────────────────────────────────────────────────────────────

/**
 * A component is either a weighed food or a nested recipe. Nesting is what
 * models the dietician's batch cooking: "pasta de ton (pt 2 portii: 135 g ton,
 * 50 g branza cremoasa...)" is one dish cooked once and eaten across two meals.
 */
export type Component =
  | { kind: 'food';   foodId: string;   grams: number;   note?: string }
  | { kind: 'recipe'; recipeId: string; servings: number; note?: string }

export interface PrepStep {
  id: string
  instruction: string
  timerSeconds: number // 0 = no timer
}

/**
 * What the food actually is, not when it is eaten, how it is served, or how it
 * was cooked. "Main", "Side" and "Bowl" are deliberately absent: they describe a
 * role at the table rather than a food, so they tell you nothing when you are
 * looking for something to cook.
 *
 * A recipe has one of these. Meal times and the quick filters are the two
 * multi-select axes; this is the single-valued one.
 */
export type DishCategory =
  | 'soup' | 'salad' | 'pasta' | 'noodles' | 'rice' | 'grain' | 'curry' | 'stew'
  | 'sandwich' | 'wrap' | 'burger' | 'pizza' | 'taco' | 'quesadilla'
  | 'omelette' | 'pancake' | 'waffle' | 'porridge' | 'cereal'
  | 'bread' | 'toast' | 'pastry' | 'cake' | 'cookie' | 'dessert'
  | 'snack' | 'fruit' | 'vegetable' | 'meat' | 'fish' | 'seafood'
  | 'egg' | 'cheese' | 'yogurt' | 'dip' | 'sauce' | 'smoothie' | 'drink'

/**
 * How a recipe fits into a day that is already busy.
 *
 * These are about circumstance rather than food, whether you have twenty
 * minutes, whether the fridge needs emptying, whether you want to be looked
 * after. A recipe can carry any number of them.
 */
export type QuickFilter =
  | 'quick' | 'lazy' | 'meal-prep' | 'leftovers' | 'one-pan' | 'freezer'
  | 'light' | 'cozy' | 'high-protein' | 'veggie-packed' | 'budget'
  | 'pantry' | 'fridge-clearout' | 'special'

export type RecipeTag =
  | 'high-protein' | 'low-carb' | 'vegan' | 'vegetarian' | 'pescatarian'
  | 'quick' | 'batch' | 'breakfast' | 'lunch' | 'dinner'
  | 'snack' | 'dessert' | 'soup' | 'salad' | 'spread'

export interface Recipe {
  id: string
  name: { en: string; ro?: string; hu?: string }
  description?: string
  emoji: string
  servings: number
  prepMinutes: number
  cookMinutes: number
  components: Component[]
  steps: PrepStep[]
  tags: RecipeTag[]
  /** What the food is. Every shipped recipe has one; yours can wait. */
  category?: DishCategory
  /** Circumstance rather than food, see QuickFilter. */
  quickFilters?: QuickFilter[]
  /**
   * The dietician's original line, kept verbatim. Shown as provenance in the UI
   * and used to verify that every source line maps to something.
   */
  sourceLine?: string
  sourcePlanId?: string
  createdAt: string
}

// ─── Meal Plan ────────────────────────────────────────────────────────────────

export type MealSlot = 'breakfast' | 'snack1' | 'lunch' | 'snack2' | 'dinner'

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner']

export const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  snack1:    'Snack 1',
  lunch:     'Lunch',
  snack2:    'Snack 2',
  dinner:    'Dinner',
}

/**
 * A planned meal is a list of entries, not a single recipe reference. This is
 * what lets "150 g mere, 10 g caju" be two food lines instead of a fabricated
 * recipe, while a cooked lunch is a single nested recipe entry.
 */
export interface PlannedMeal {
  id: string
  slot: MealSlot
  entries: Component[]
  note?: string
}

export interface DayPlan {
  date: string        // 'YYYY-MM-DD'
  meals: PlannedMeal[]
  /**
   * When this day last changed, as an ISO timestamp.
   *
   * Sync merges the week a day at a time, so the two of you editing different
   * days both keep your work. Deciding which version of the *same* day wins
   * needs a per-day timestamp; without one the only possible answer is
   * "whichever write landed last", which is how an edit disappears.
   */
  updatedAt?: string
}

/** 0 = Sunday, 1 = Monday … 6 = Saturday. */
import type { MomentKind } from '../lib/moments'

export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * Monday → Sunday.
 *
 * The dietician's own plans all run Wednesday to Tuesday, but the app's week is
 * the ordinary one. Loading a plan lines its days up by weekday, so a Wednesday
 * meal still lands on Wednesday, it just sits mid-week instead of first.
 */
export const DEFAULT_WEEK_START: WeekStart = 1

// ─── Source plan archive ──────────────────────────────────────────────────────

export type PlanLanguage = 'ro' | 'hu'

/** One line exactly as the dietician wrote it, plus what we resolved it to. */
export interface SourceMeal {
  slot: MealSlot
  /** Original text, verbatim. */
  text: string
  /** What this line was mapped to when imported. */
  entries: Component[]
}

export interface SourceDay {
  /** Day name as written: 'Miercuri', 'Szerda', … */
  dayName: string
  weekday: number      // 0=Sun … 6=Sat
  meals: SourceMeal[]
}

/** One of the 14 dietician documents. */
export interface SourcePlan {
  id: string
  /** Original filename, for traceability back to the .docx. */
  file: string
  label: string
  language: PlanLanguage
  /** ISO date the plan was issued, parsed from the filename where present. */
  issuedOn?: string
  /** Whose plan this is, one week was written for a different person. */
  subject: 'self' | 'other'
  days: SourceDay[]
}

// ─── Cook Schedule ────────────────────────────────────────────────────────────

export interface CookSession {
  id: string
  date: string        // 'YYYY-MM-DD'
  time: string        // 'HH:MM'
  recipeIds: string[]
  label: string
  completed: boolean
  /**
   * When to email both of you, as an instant rather than a wall-clock time.
   *
   * Worked out in the browser that scheduled it, which is the one place that
   * definitely knows which timezone "18:00" meant. The job that sends the
   * emails runs on a server whose idea of local time is nobody's, and a
   * reminder three hours late is worse than no reminder.
   */
  remindAt?: string
}

// ─── Grocery ─────────────────────────────────────────────────────────────────

export interface GroceryItem {
  id: string
  /**
   * Resolved food, so RO/HU/EN spellings of the same thing merge into one
   * line. Empty on a line you added yourself, which need not be a food the app
   * knows: washing-up liquid is a real shopping list item.
   */
  foodId: string
  name: string
  grams: number
  category: MedCategory
  checked: boolean
  fromRecipeIds: string[]
  /** Added by hand rather than worked out from the plan; rebuilding keeps it. */
  manual?: boolean
  /** An amount that is not a weight, shown exactly as typed: "2 packs". */
  amount?: string
}

// ─── Weight & Body ───────────────────────────────────────────────────────────

/**
 * Body entries belong to a person, unlike everything else in this app.
 *
 * The week, the targets, the recipes and the grocery list are shared between
 * the two of you on purpose, you eat the same dinners. A waist measurement is
 * not that: pooling two people's bodies into one trend line makes a graph of
 * nothing. `memberId` is the id of whoever it belongs to.
 *
 * Undefined means an entry logged before the app knew about people, or logged
 * on a copy running with no account at all. Those show as unclaimed rather than
 * being assigned to whoever happens to be looking.
 */
export interface WeightEntry {
  id: string
  date: string   // 'YYYY-MM-DD'
  weight: number
  unit: 'kg' | 'lbs'
  notes?: string
  memberId?: string
}

/** The five, plus weight, which has its own entry type for its own history. */
export const MEASUREMENT_KEYS = ['waist', 'hips', 'chest', 'arms', 'thighs'] as const
export type MeasurementKey = typeof MEASUREMENT_KEYS[number]

export const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  waist: 'Waist', hips: 'Hips', chest: 'Chest', arms: 'Arms', thighs: 'Thighs',
}

export interface BodyMeasurement {
  id: string
  date: string
  /** Each one optional: you measure what you measure on the day. */
  measurements: Partial<Record<MeasurementKey, number>>
  unit: 'cm' | 'in'
  memberId?: string
}

// ─── Targets ─────────────────────────────────────────────────────────────────

export type Sex = 'female' | 'male'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active'
export type Goal = 'lose' | 'maintain' | 'gain'

/** Inputs for the TDEE calculator. All optional until the user fills them in. */
export interface TdeeProfile {
  sex?: Sex
  age?: number
  heightCm?: number
  weightKg?: number
  activity?: ActivityLevel
  goal?: Goal
}

export type TargetSource = 'from-plans' | 'tdee' | 'manual'

export interface Targets extends Macros {
  fiber?: number
  source: TargetSource
}

// ─── The user ─────────────────────────────────────────────────────────────────

export interface UserProfile {
  name: string
  targets: Targets
  tdee: TdeeProfile
  weightUnit: 'kg' | 'lbs'
  weekStartsOn: WeekStart
  /** Which language to show food and recipe names in. */
  foodNameLanguage: 'en' | 'ro' | 'hu'
  /** 'system' follows the device; the other two override it in either direction. */
  /** Little things Zig has noticed. See lib/moments.ts for why these are not points. */
  moments: Moment[]
  /**
   * When this profile last changed, so two devices can tell whose copy is
   * newer. Optional because profiles written before sync existed have no stamp,
   * and an unstamped profile counts as the older one.
   */
  updatedAt?: string
}

/** One thing Zig noticed, once. */
export interface Moment {
  kind: MomentKind
  at: string
  seen: boolean
}

// ─── Release Notes ────────────────────────────────────────────────────────────

export interface ReleaseNote {
  version: string
  date: string
  title: string
  changes: { type: 'feature' | 'fix' | 'improvement'; text: string }[]
}

// ─── Exercise and sleep ───────────────────────────────────────────────────────

/**
 * How hard an activity is, as a multiple of sitting still.
 *
 * MET, from the Compendium of Physical Activities. One MET is roughly what you
 * burn doing nothing, so an activity at 8 METs burns eight times that. It is
 * how any calorie figure for exercise is arrived at, and it is an estimate:
 * two people doing the same hour of the same thing do not burn the same
 * amount.
 */
export interface ExerciseKind {
  id: string
  name: string
  group: ExerciseGroup
  met: number
  /** Set for the ones you count in reps rather than minutes. */
  reps?: boolean
}

export type ExerciseGroup =
  | 'cardio' | 'strength' | 'core' | 'mobility' | 'sport' | 'everyday'

/** One exercise inside a session. */
export interface WorkoutEntry {
  id: string
  exerciseId: string
  /** Minutes. The unit everything is costed in, reps or not. */
  minutes: number
  sets?: number
  reps?: number
  weightKg?: number
  note?: string
}

export interface Workout {
  id: string
  /** Whose it is. See lib/people.ts. */
  personId: string
  date: string
  entries: WorkoutEntry[]
  /**
   * A session logged as one lump, for when the detail is not worth typing:
   * "gym, an hour, about 400 kcal". Costed as given rather than from METs.
   */
  bulk?: { label: string; minutes: number; calories?: number }
  note?: string
}

export type ActivitySource = 'manual' | 'garmin'

/** A day's steps, however they got here. */
export interface StepEntry {
  id: string
  personId: string
  date: string
  steps: number
  source: ActivitySource
}

export interface SleepEntry {
  id: string
  personId: string
  /** The night ending on this date, so it lines up with the day you felt it. */
  date: string
  hours: number
  /** Out of 5, as you would rate it yourself. Nothing derives from this. */
  quality?: number
  source: ActivitySource
  note?: string
}
