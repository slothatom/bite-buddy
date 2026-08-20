import { describe, it, expect, beforeEach } from 'vitest'
import { useFoodStore, isCuratedFood, visibleFoods, foodLibraryWith } from './useFoodStore'
import { buildContext, componentsNutrients } from '../lib/nutrition'
import { FOODS, ALL_RECIPES } from '../data'
import type { Food } from '../types'

const CURATED = FOODS[0]

const visible = () => visibleFoods(useFoodStore.getState())
const resolvable = () => foodLibraryWith(useFoodStore.getState().custom)

const mine = (id: string): Food => ({
  id, names: { en: 'Mine' }, aliases: [], category: 'pantry', medTier: 'daily',
  state: 'as-sold', per100g: { calories: 100, protein: 1, carbs: 2, fat: 3 },
  units: [], source: 'custom',
})

describe('editing a food', () => {
  beforeEach(() => useFoodStore.setState({ custom: [], hidden: [] }))

  it('copies a curated food aside rather than pretending to edit code', () => {
    useFoodStore.getState().updateFood(CURATED.id, { medTier: 'rare' })

    const { custom } = useFoodStore.getState()
    expect(custom).toHaveLength(1)
    expect(custom[0].medTier).toBe('rare')
    // And the override wins where it counts: the list shows one, not two.
    expect(visible().filter((f) => f.id === CURATED.id)).toHaveLength(1)
    expect(visible().find((f) => f.id === CURATED.id)?.medTier).toBe('rare')
  })

  it('reverting brings the shipped version back exactly', () => {
    const { updateFood, revertFood } = useFoodStore.getState()
    updateFood(CURATED.id, { medTier: 'rare' })
    revertFood(CURATED.id)

    expect(useFoodStore.getState().custom).toHaveLength(0)
    expect(visible().find((f) => f.id === CURATED.id)).toEqual(CURATED)
  })

  it('knows which foods it did not write', () => {
    expect(isCuratedFood(CURATED.id)).toBe(true)
    expect(isCuratedFood('custom-abc')).toBe(false)
  })
})

describe('deleting a food', () => {
  beforeEach(() => useFoodStore.setState({ custom: [], hidden: [] }))

  it('takes it out of the library', () => {
    useFoodStore.getState().removeFood(CURATED.id)
    expect(visible().some((f) => f.id === CURATED.id)).toBe(false)
  })

  it('deletes an edited curated food instead of resurrecting the original', () => {
    const { updateFood, removeFood } = useFoodStore.getState()
    updateFood(CURATED.id, { medTier: 'rare' })
    removeFood(CURATED.id)

    expect(visible().some((f) => f.id === CURATED.id)).toBe(false)
  })

  it('leaves a recipe that uses it with its numbers intact', () => {
    // A food is named by every recipe that contains it. Destroying the food
    // would blank all of them at once.
    const recipe = ALL_RECIPES.find((r) =>
      r.components.some((c) => c.kind === 'food' && c.foodId === CURATED.id))
    if (!recipe) return

    const before = componentsNutrients(recipe.components, buildContext(resolvable(), ALL_RECIPES)).calories
    useFoodStore.getState().removeFood(CURATED.id)
    const after = componentsNutrients(recipe.components, buildContext(resolvable(), ALL_RECIPES)).calories

    expect(before).toBeGreaterThan(0)
    expect(after).toBe(before)
  })

  it('leaves a planned snack line alone', () => {
    // Snacks are food lines, not recipes: "150 g apple, 10 g cashews" is two
    // direct food references in the plan.
    const line = [{ kind: 'food' as const, foodId: CURATED.id, grams: 100 }]
    const before = componentsNutrients(line, buildContext(resolvable(), ALL_RECIPES)).calories

    useFoodStore.getState().removeFood(CURATED.id)

    expect(componentsNutrients(line, buildContext(resolvable(), ALL_RECIPES)).calories).toBe(before)
  })

  it('keeps a food of your own resolvable too, not just the curated ones', () => {
    const { addFood, removeFood } = useFoodStore.getState()
    addFood(mine('custom-planned'))
    removeFood('custom-planned')

    expect(visible().some((f) => f.id === 'custom-planned')).toBe(false)
    expect(resolvable().some((f) => f.id === 'custom-planned')).toBe(true)
  })

  it('can be put back, edits and all', () => {
    const { updateFood, removeFood, restoreFood } = useFoodStore.getState()
    updateFood(CURATED.id, { medTier: 'rare' })
    removeFood(CURATED.id)
    restoreFood(CURATED.id)

    expect(visible().find((f) => f.id === CURATED.id)?.medTier).toBe('rare')
  })
})
