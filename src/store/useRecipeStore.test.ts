import { describe, it, expect, beforeEach } from 'vitest'
import { useRecipeStore, isBuiltIn, visibleRecipes, libraryWith } from './useRecipeStore'
import { buildContext, componentsNutrients } from '../lib/nutrition'
import { FOODS } from '../data'
import { ALL_RECIPES } from '../data'
import type { Recipe } from '../types'

const BUILT_IN = ALL_RECIPES[0]

/** The app's own rule, not a copy of it — see visibleRecipes. */
function visible(): Recipe[] {
  return visibleRecipes(useRecipeStore.getState())
}

const mine = (id: string): Recipe => ({
  id, name: { en: 'Mine' }, emoji: '🍲', servings: 1,
  prepMinutes: 0, cookMinutes: 0, components: [], steps: [], tags: [],
  createdAt: new Date(0).toISOString(),
})

describe('editing the shipped library', () => {
  beforeEach(() => {
    useRecipeStore.setState({ custom: [], hidden: [], favouriteIds: [] })
  })

  it('copies a built-in aside rather than pretending to edit code', () => {
    useRecipeStore.getState().updateRecipe(BUILT_IN.id, { emoji: '🎈' })

    const { custom } = useRecipeStore.getState()
    expect(custom).toHaveLength(1)
    expect(custom[0].id).toBe(BUILT_IN.id)
    expect(custom[0].emoji).toBe('🎈')
    // And the override wins where it counts: the list shows one, not two.
    expect(visible().filter((r) => r.id === BUILT_IN.id)).toHaveLength(1)
    expect(visible().find((r) => r.id === BUILT_IN.id)?.emoji).toBe('🎈')
  })

  it('deletes an edited built-in instead of resurrecting the original', () => {
    // This is the bug the delete button had: removing the override handed the
    // shipped recipe straight back, so deleting appeared to do nothing at all.
    const { updateRecipe, removeRecipe } = useRecipeStore.getState()
    updateRecipe(BUILT_IN.id, { emoji: '🎈' })
    removeRecipe(BUILT_IN.id)

    expect(visible().some((r) => r.id === BUILT_IN.id)).toBe(false)
  })

  it('reverting brings the shipped version back exactly', () => {
    const { updateRecipe, revertRecipe } = useRecipeStore.getState()
    updateRecipe(BUILT_IN.id, { emoji: '🎈', name: { en: 'Something else' } })
    revertRecipe(BUILT_IN.id)

    expect(useRecipeStore.getState().custom).toHaveLength(0)
    expect(visible().find((r) => r.id === BUILT_IN.id)).toEqual(BUILT_IN)
  })

  it('reverting undoes a delete too', () => {
    const { removeRecipe, revertRecipe } = useRecipeStore.getState()
    removeRecipe(BUILT_IN.id)
    revertRecipe(BUILT_IN.id)

    expect(visible().some((r) => r.id === BUILT_IN.id)).toBe(true)
  })
})

describe('recipes of your own', () => {
  beforeEach(() => {
    useRecipeStore.setState({ custom: [], hidden: [], favouriteIds: [] })
  })

  it('adds and then deletes, out of the library but not destroyed', () => {
    // A recipe of your own used to be dropped outright. It cannot be: a day you
    // planned with it names it by id, and losing it blanks that day.
    const { addRecipe, removeRecipe } = useRecipeStore.getState()
    addRecipe(mine('recipe-abc'))
    expect(visible().some((r) => r.id === 'recipe-abc')).toBe(true)

    removeRecipe('recipe-abc')
    expect(visible().some((r) => r.id === 'recipe-abc')).toBe(false)
    expect(useRecipeStore.getState().hidden).toContain('recipe-abc')
    expect(libraryWith(useRecipeStore.getState().custom).some((r) => r.id === 'recipe-abc')).toBe(true)
  })

  it('takes the favourite star down with the recipe', () => {
    const { addRecipe, toggleFavourite, removeRecipe } = useRecipeStore.getState()
    addRecipe(mine('recipe-fave'))
    toggleFavourite('recipe-fave')
    removeRecipe('recipe-fave')

    expect(useRecipeStore.getState().favouriteIds).not.toContain('recipe-fave')
  })

  it('knows which recipes it did not write', () => {
    expect(isBuiltIn(BUILT_IN.id)).toBe(true)
    expect(isBuiltIn('recipe-abc')).toBe(false)
  })
})

describe('deleting a recipe', () => {
  const BUILT_IN = ALL_RECIPES.find((r) => r.components.length > 0)!

  beforeEach(() => {
    useRecipeStore.setState({ custom: [], hidden: [], favouriteIds: [], mergedInto: {} })
  })

  /** What the app can still resolve, which is what a saved plan looks things up in. */
  const resolvable = () => libraryWith(useRecipeStore.getState().custom)

  it('takes it out of the library', () => {
    useRecipeStore.getState().removeRecipe(BUILT_IN.id)
    expect(visible().some((r) => r.id === BUILT_IN.id)).toBe(false)
  })

  it('takes the favourite with it', () => {
    const { toggleFavourite, removeRecipe } = useRecipeStore.getState()
    toggleFavourite(BUILT_IN.id)
    removeRecipe(BUILT_IN.id)
    expect(useRecipeStore.getState().favouriteIds).not.toContain(BUILT_IN.id)
  })

  it('leaves a day you already planned with it intact', () => {
    // The plan stores an id, not a copy. Destroying the recipe turned that day's
    // dinner into a blank worth zero calories — quietly rewriting your history.
    const before = componentsNutrients(
      [{ kind: 'recipe', recipeId: BUILT_IN.id, servings: 1 }],
      buildContext(FOODS, resolvable()),
    ).calories
    expect(before).toBeGreaterThan(0)

    useRecipeStore.getState().removeRecipe(BUILT_IN.id)

    const after = componentsNutrients(
      [{ kind: 'recipe', recipeId: BUILT_IN.id, servings: 1 }],
      buildContext(FOODS, resolvable()),
    ).calories
    expect(after).toBe(before)
  })

  it('keeps a recipe of your own resolvable too, not just the built-in ones', () => {
    const { addRecipe, removeRecipe } = useRecipeStore.getState()
    addRecipe(mine('recipe-planned'))
    removeRecipe('recipe-planned')

    expect(visible().some((r) => r.id === 'recipe-planned')).toBe(false)
    expect(resolvable().some((r) => r.id === 'recipe-planned')).toBe(true)
  })

  it('can be put back', () => {
    const { removeRecipe, restoreRecipe } = useRecipeStore.getState()
    removeRecipe(BUILT_IN.id)
    restoreRecipe(BUILT_IN.id)
    expect(visible().some((r) => r.id === BUILT_IN.id)).toBe(true)
  })

  it('restores your edited version, not the original underneath', () => {
    const { updateRecipe, removeRecipe, restoreRecipe } = useRecipeStore.getState()
    updateRecipe(BUILT_IN.id, { emoji: '🎈' })
    removeRecipe(BUILT_IN.id)
    restoreRecipe(BUILT_IN.id)

    expect(visible().find((r) => r.id === BUILT_IN.id)?.emoji).toBe('🎈')
  })

  it('does not touch the ingredients, which other recipes use', () => {
    const { removeRecipe } = useRecipeStore.getState()
    const foodsBefore = FOODS.length
    removeRecipe(BUILT_IN.id)

    expect(FOODS.length).toBe(foodsBefore)
    for (const c of BUILT_IN.components) {
      if (c.kind === 'food') expect(FOODS.some((f) => f.id === c.foodId)).toBe(true)
    }
  })
})
