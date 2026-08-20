/**
 * Watching for the things Zig notices.
 *
 * Mounted once, on the welcome screen. It derives everything from state that
 * already exists rather than being called from all over the app — a moment is
 * an observation about how things are, not an event fired at the instant you
 * do something.
 */
import { useEffect } from 'react'
import { useMealPlanStore } from './useMealPlanStore'
import { useUserStore } from './useUserStore'
import { useRecipeStore } from './useRecipeStore'
import { useFoodStore } from './useFoodStore'
import { useNutritionContext } from './useNutrition'
import { dayNutrients } from '../lib/nutrition'
import { scoreWeek } from '../lib/mediterranean'
import { EMPTY_CONTEXT } from '../lib/moments'

export function useWatchForMoments() {
  const plan = useMealPlanStore((s) => s.plan)
  const custom = useRecipeStore((s) => s.custom)
  const customFoods = useFoodStore((s) => s.custom)
  const { profile, notice } = useUserStore()
  const ctx = useNutritionContext()

  useEffect(() => {
    const planned = plan.filter((d) => d.meals.length)
    const veg = scoreWeek(plan, ctx).find((g) => g.category === 'vegetables')
    const fibreTarget = profile.targets.fiber ?? 0

    notice({
      ...EMPTY_CONTEXT,
      plannedDays: planned.length,
      weekFullyPlanned: planned.length === 7,
      ownRecipes: custom.length,
      ownFoods: customFoods.length,
      vegGoalMet: (veg?.ratio ?? 0) >= 1,
      fibreGoalMet: fibreTarget > 0
        && planned.some((d) => (dayNutrients(d, ctx).fiber ?? 0) >= fibreTarget),
    })
  }, [plan, custom, customFoods, ctx, profile.targets.fiber, notice])
}
