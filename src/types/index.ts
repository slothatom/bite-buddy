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

// ─── Recipes ─────────────────────────────────────────────────────────────────

export interface Ingredient {
  id: string
  name: string
  amount: number
  unit: string
  macros: Macros      // per stated amount
  micros?: Micros     // per stated amount
  per100g?: Macros    // raw API data — used to recalculate when amount changes
}

export interface PrepStep {
  id: string
  instruction: string
  timerSeconds: number // 0 = no timer
}

export type RecipeTag =
  | 'high-protein' | 'low-carb' | 'vegan' | 'vegetarian'
  | 'quick' | 'bulk' | 'breakfast' | 'lunch' | 'dinner'
  | 'snack' | 'dessert'

export interface Recipe {
  id: string
  name: string
  description: string
  emoji: string
  servings: number
  prepMinutes: number
  cookMinutes: number
  ingredients: Ingredient[]
  steps: PrepStep[]
  tags: RecipeTag[]
  macrosPerServing: Macros
  microsPerServing?: Micros
  createdAt: string
}

// ─── Meal Plan ────────────────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack1' | 'snack2'

export interface PlannedMeal {
  id: string
  recipeId: string
  servings: number
  mealType: MealType
}

export interface DayPlan {
  date: string        // 'YYYY-MM-DD'
  meals: PlannedMeal[]
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
  name: string
  amount: number
  unit: string
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
  macroTargets: Macros
  weightUnit: 'kg' | 'lbs'
  achievements: Achievement[]
}

// ─── Release Notes ────────────────────────────────────────────────────────────

export interface ReleaseNote {
  version: string
  date: string
  title: string
  changes: { type: 'feature' | 'fix' | 'improvement'; text: string }[]
}
