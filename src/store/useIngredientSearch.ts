import { useEffect, useMemo, useRef, useState } from 'react'
import type { Food, Recipe } from '../types'
import { useFoods } from './useFoodStore'
import { useRecipes } from './useRecipeStore'
import { buildFoodIndex, searchFoods } from '../lib/foodSearch'
import { normaliseTerm } from '../lib/units'
import { alreadyHave } from '../lib/foodImport'
import {
  searchFoods as lookupOnline,
  type LookupOutcome,
  type NutritionResult,
} from '../services/nutritionApi'

/**
 * One search across everything an ingredient could come from.
 *
 * The library and the two online sources used to be different places you went
 * to: local foods in the recipe editor, USDA and Open Food Facts on the Foods
 * screen. Which meant that to put a food the app did not know into a recipe you
 * had to abandon the recipe, go and add the food, and come back, for something
 * the app could have found in a second.
 *
 * So it is one box now. What you already have appears instantly and works with
 * no signal; the online sources arrive a moment later underneath, in the order
 * the brief asks for, USDA first for generic ingredients, then Open Food Facts
 * for the branded ones, then adding it by hand.
 */

const DEBOUNCE_MS = 350
/** Below this, an online search is mostly noise and mostly rate limit. */
const MIN_QUERY = 3

export interface IngredientSearch {
  /** Foods you already have, best match first. */
  foods: Food[]
  /** Recipes, for the cook-once-eat-twice dishes that nest inside meals. */
  recipes: Recipe[]
  /** Results from USDA and Open Food Facts, minus anything you already have. */
  online: NutritionResult[]
  /** True while the online sources are still being asked. */
  searching: boolean
  /** Which sources failed and why, never silently nothing. */
  problems: LookupOutcome['problems']
  /** True once an online search has actually been run for this query. */
  searched: boolean
}

export function useIngredientSearch(query: string, excludeRecipeId?: string): IngredientSearch {
  const foods = useFoods()
  const recipes = useRecipes()

  const [online, setOnline] = useState<NutritionResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [problems, setProblems] = useState<LookupOutcome['problems']>([])

  const foodIndex = useMemo(() => buildFoodIndex(foods), [foods])
  const localFoods = useMemo(() => searchFoods(query, foodIndex, 20), [query, foodIndex])

  const localRecipes = useMemo(() => {
    const n = normaliseTerm(query)
    return recipes
      .filter((r) => r.id !== excludeRecipeId)
      .filter((r) => !n || normaliseTerm([r.name.en, r.name.ro, r.name.hu].filter(Boolean).join(' ')).includes(n))
      .slice(0, 20)
  }, [recipes, query, excludeRecipeId])

  // One in-flight request at a time: typing "chicken" would otherwise fire
  // seven searches and show whichever came back last, not whichever is current.
  const inFlight = useRef<AbortController | null>(null)

  const term = query.trim()
  const searchable = term.length >= MIN_QUERY

  useEffect(() => {
    if (!searchable) {
      // Nothing to clear here on purpose: setting state straight from an effect
      // body cascades a render, and the results are gated on `searchable` below
      // instead, which is the same thing said as a derivation.
      inFlight.current?.abort()
      return
    }

    const timer = setTimeout(() => {
      inFlight.current?.abort()
      const controller = new AbortController()
      inFlight.current = controller
      setSearching(true)

      lookupOnline(term, controller.signal)
        .then((outcome) => {
          if (controller.signal.aborted) return
          setOnline(outcome.results)
          setProblems(outcome.problems)
          setSearched(true)
        })
        .catch(() => {
          // An abort is the next keystroke, not a failure worth reporting.
          if (!controller.signal.aborted) setSearched(true)
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [term, searchable])

  useEffect(() => () => inFlight.current?.abort(), [])

  // Anything already in the library is shown once, as the local copy: it is the
  // one you can edit, and offering both is offering the same food twice.
  const fresh = useMemo(
    () => online.filter((r) => r.name && !alreadyHave(foods, r)),
    [online, foods],
  )

  // A query too short to search online shows nothing from online, whatever is
  // still sitting in state from the last one you typed.
  if (!searchable) {
    return { foods: localFoods, recipes: localRecipes, online: [], searching: false, problems: [], searched: false }
  }

  return { foods: localFoods, recipes: localRecipes, online: fresh, searching, problems, searched }
}
