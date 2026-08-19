// ─── Nutrition ───────────────────────────────────────────────────────────────

export interface Macros {
  calories: number
  protein: number  // g
  carbs: number    // g
  fat: number      // g
}

export interface Micros {
  fiber?: number        // g
  sugar?: number        // g
  sodium?: number       // mg
  calcium?: number      // mg
  iron?: number         // mg
  vitaminC?: number     // mg
  vitaminD?: number     // mcg
  potassium?: number    // mg
  saturatedFat?: number // g
}

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
 *  daily    — "Eat More", the base of every meal
 *  weekly   — several times a week (legumes, fish)
 *  moderate — "Eat in Moderation" (dairy, poultry, eggs)
 *  rare     — "Eat Rarely or Limit" (red meat, sweets)
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
}

/** 0 = Sunday, 1 = Monday … 6 = Saturday. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * Monday → Sunday.
 *
 * The dietician's own plans all run Wednesday to Tuesday, but the app's week is
 * the ordinary one. Loading a plan lines its days up by weekday, so a Wednesday
 * meal still lands on Wednesday — it just sits mid-week instead of first.
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
  /** Whose plan this is — one week was written for a different person. */
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
}

// ─── Grocery ─────────────────────────────────────────────────────────────────

export interface GroceryItem {
  id: string
  /** Resolved food, so RO/HU/EN spellings of the same thing merge into one line. */
  foodId: string
  name: string
  grams: number
  category: MedCategory
  checked: boolean
  fromRecipeIds: string[]
}

// ─── Weight & Body ───────────────────────────────────────────────────────────

export interface WeightEntry {
  id: string
  date: string   // 'YYYY-MM-DD'
  weight: number
  unit: 'kg' | 'lbs'
  notes?: string
}

export interface BodyMeasurement {
  id: string
  date: string
  measurements: {
    waist?: number
    hips?: number
    chest?: number
    arms?: number
    thighs?: number
  }
  unit: 'cm' | 'in'
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

// ─── Gamification ─────────────────────────────────────────────────────────────

export type AchievementId =
  | 'first_recipe' | 'five_recipes' | 'first_plan'
  | 'week_complete' | 'grocery_master' | 'prep_master'
  | 'streak_3' | 'streak_7' | 'macro_goal' | 'weight_logged'

export interface Achievement {
  id: AchievementId
  name: string
  description: string
  emoji: string
  xpReward: number
  unlockedAt?: string
}

export interface UserProfile {
  name: string
  xp: number
  level: number
  streak: number
  lastActiveDate?: string
  targets: Targets
  tdee: TdeeProfile
  weightUnit: 'kg' | 'lbs'
  weekStartsOn: WeekStart
  /** Which language to show food and recipe names in. */
  foodNameLanguage: 'en' | 'ro' | 'hu'
  /** XP, levels and achievements are opt-in — the planner stays calm by default. */
  showGamification: boolean
  achievements: Achievement[]
}

// ─── Release Notes ────────────────────────────────────────────────────────────

export interface ReleaseNote {
  version: string
  date: string
  title: string
  changes: { type: 'feature' | 'fix' | 'improvement'; text: string }[]
}
