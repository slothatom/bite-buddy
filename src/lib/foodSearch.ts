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
 *
 * Preferring the alias nearest the front was tried, to stop "150 g tofu cu o
 * lingurita de ulei de masline" binding its weight to the oil. It fixed thirty
 * lines and broke ten others: "salata cezar : 120 g piept de curcan" then gave
 * its 120 g to the salad. Position is not a better guess than length, only a
 * different one. The fix belongs where the ambiguity is created, in the
 * splitter, not here where it is already too late.
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

/**
 * Every food an alias in this term points at, earliest first.
 *
 * The importer uses it to notice a fragment that names two foods while
 * carrying one weight, which is a line it has misread rather than a line it
 * can resolve. Guessing there is what produced the olive oil.
 */
export function resolveAllFoods(term: string, index: FoodIndex): Food[] {
  const n = normaliseTerm(term)
  if (!n) return []

  const hits: { food: Food; at: number }[] = []
  for (const [key, food] of index.byExact) {
    if (key.length < 4) continue
    const at = n.indexOf(key)
    if (at < 0) continue
    if (!hits.some((h) => h.food.id === food.id)) hits.push({ food, at })
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.food)
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
