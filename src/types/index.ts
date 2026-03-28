// ─── Nutrition ───────────────────────────────────────────────────────────────

export interface Macros {
  calories: number
  protein: number  // grams
  carbs: number    // grams
  fat: number      // grams
}

// ─── Recipes ─────────────────────────────────────────────────────────────────

export interface Ingredient {
  id: string
  name: string
  amount: number
  unit: string
  macros: Macros // per stated amount
}

export interface PrepStep {
  id: string
  instruction: string
  timerSeconds: number // 0 = no timer
}

export type RecipeTag =
  | 'high-protein'
  | 'low-carb'
  | 'vegan'
  | 'vegetarian'
  | 'quick'
  | 'bulk'
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snack'
  | 'dessert'

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
  createdAt: string
}

// ─── Meal Plan ────────────────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

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

// ─── Grocery ─────────────────────────────────────────────────────────────────

export interface GroceryItem {
  id: string
  name: string
  amount: number
  unit: string
  checked: boolean
  fromRecipeIds: string[]
}

// ─── Gamification ─────────────────────────────────────────────────────────────

export type AchievementId =
  | 'first_recipe'
  | 'five_recipes'
  | 'first_plan'
  | 'week_complete'
  | 'grocery_master'
  | 'prep_master'
  | 'streak_3'
  | 'streak_7'
  | 'macro_goal'

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
  achievements: Achievement[]
}
