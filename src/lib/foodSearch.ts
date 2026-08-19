import type { Food } from '../types'
import { normaliseTerm } from './units'

/**
 * Matching a free-text term against the food database.
 *
 * The plans name the same ingredient in Romanian, Hungarian and several
 * spellings ("paine int", "paine integrala", "teljes kiorlesu kenyer"), so every
 * name and alias is indexed in normalised form and matched without diacritics.
 */

export interface FoodIndex {
  byExact: Map<string, Food>
  all: Food[]
}

export function buildFoodIndex(foods: Food[]): FoodIndex {
  const byExact = new Map<string, Food>()
  for (const food of foods) {
    const keys = [food.names.en, food.names.ro, food.names.hu, ...food.aliases]
    for (const key of keys) {
      if (!key) continue
      const n = normaliseTerm(key)
      // First registration wins, so a food's own name beats another's alias.
      if (n && !byExact.has(n)) byExact.set(n, food)
    }
  }
  return { byExact, all: foods }
}

/**
 * Resolves a term to a food.
 *
 * Falls back from exact match to longest-alias-contained-in-term, which handles
 * the plans' habit of appending preparation to the ingredient
 * ("halloumi la gratar", "cartofi dulci cantariti cruzi").
 */
export function resolveFood(term: string, index: FoodIndex): Food | undefined {
  const n = normaliseTerm(term)
  if (!n) return undefined

  const exact = index.byExact.get(n)
  if (exact) return exact

  let best: { food: Food; length: number } | undefined
  for (const [key, food] of index.byExact) {
    if (key.length < 4) continue
    if (!n.includes(key)) continue
    if (!best || key.length > best.length) best = { food, length: key.length }
  }
  return best?.food
}

/** Ranked search for the food library UI. */
export function searchFoods(query: string, index: FoodIndex, limit = 30): Food[] {
  const n = normaliseTerm(query)
  if (!n) return index.all.slice(0, limit)

  const scored: { food: Food; score: number }[] = []
  for (const food of index.all) {
    const keys = [food.names.en, food.names.ro, food.names.hu, ...food.aliases]
      .filter(Boolean)
      .map((k) => normaliseTerm(k as string))

    let score = 0
    for (const key of keys) {
      if (key === n) score = Math.max(score, 100)
      else if (key.startsWith(n)) score = Math.max(score, 70)
      else if (key.includes(n)) score = Math.max(score, 40)
    }
    if (score > 0) scored.push({ food, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.food.names.en.localeCompare(b.food.names.en))
    .slice(0, limit)
    .map((s) => s.food)
}
