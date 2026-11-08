import { describe, it, expect } from 'vitest'
import type { Recipe } from '../../types'
import { categoriesOnShelf, favouritesFirst, matchRecipes, onShelf, type RecipeQuery } from './shelf'

const now = '2026-08-21T10:00:00.000Z'

function recipe(over: Partial<Recipe> & { id: string }): Recipe {
  return {
    name: { en: over.id }, emoji: '🍲', servings: 2, prepMinutes: 10, cookMinutes: 20,
    components: [], steps: [], tags: ['dinner'], createdAt: now, ...over,
  }
}

const RECIPES = [
  recipe({ id: 'porridge', tags: ['breakfast'], category: 'grain', quickFilters: ['quick'] }),
  recipe({ id: 'lentil stew', tags: ['lunch', 'dinner'], category: 'stew', quickFilters: ['meal-prep'] }),
  recipe({
    id: 'cheese toast', name: { en: 'Cheese toast', ro: 'Pâine cu telemea' }, tags: ['breakfast'],
    category: 'sandwich', quickFilters: ['quick', 'lazy'],
  }),
  recipe({ id: 'stock', tags: [], category: 'soup' }),
]

const none: RecipeQuery = { query: '', category: null, filters: [], favesOnly: false, favouriteIds: [] }
const ids = (list: Recipe[]) => list.map((r) => r.id)

describe('matchRecipes', () => {
  it('lets everything through with nothing asked', () => {
    expect(ids(matchRecipes(RECIPES, none))).toEqual(ids(RECIPES))
  })

  it('searches the Romanian line without its diacritics', () => {
    expect(ids(matchRecipes(RECIPES, { ...none, query: 'telemea' }))).toEqual(['cheese toast'])
    expect(ids(matchRecipes(RECIPES, { ...none, query: 'paine' }))).toEqual(['cheese toast'])
  })

  it('narrows by every ticked filter together, not by any of them', () => {
    expect(ids(matchRecipes(RECIPES, { ...none, filters: ['quick'] })))
      .toEqual(['porridge', 'cheese toast'])
    expect(ids(matchRecipes(RECIPES, { ...none, filters: ['quick', 'lazy'] })))
      .toEqual(['cheese toast'])
  })

  it('keeps to the category and the favourites when asked', () => {
    expect(ids(matchRecipes(RECIPES, { ...none, category: 'stew' }))).toEqual(['lentil stew'])
    expect(ids(matchRecipes(RECIPES, { ...none, favesOnly: true, favouriteIds: ['porridge'] })))
      .toEqual(['porridge'])
  })
})

describe('onShelf', () => {
  it('puts a two-meal dish on both shelves and an untagged one under dishes', () => {
    const mine = new Set<string>()
    expect(ids(onShelf(RECIPES, 'lunch', mine))).toEqual(['lentil stew'])
    expect(ids(onShelf(RECIPES, 'dinner', mine))).toEqual(['lentil stew'])
    expect(ids(onShelf(RECIPES, 'dish', mine))).toEqual(['stock'])
  })

  it('reads yours from the set of your own, whatever they are tagged', () => {
    expect(ids(onShelf(RECIPES, 'mine', new Set(['stock', 'porridge'])))).toEqual(['porridge', 'stock'])
  })
})

describe('favouritesFirst', () => {
  it('puts favourites first, then the rest alphabetically, without touching the input', () => {
    const input = [...RECIPES]
    expect(ids(favouritesFirst(input, ['stock'])))
      .toEqual(['stock', 'cheese toast', 'lentil stew', 'porridge'])
    expect(input).toEqual(RECIPES)
  })
})

describe('categoriesOnShelf', () => {
  it('counts only the categories present, in the library order', () => {
    const list = [...RECIPES, recipe({ id: 'other stew', category: 'stew' })]
    expect(categoriesOnShelf(list)).toEqual([['soup', 1], ['stew', 2], ['grain', 1], ['sandwich', 1]])
  })
})
