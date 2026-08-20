import { describe, it, expect, beforeEach } from 'vitest'
import { useRecipeStore, isBuiltIn } from './useRecipeStore'
import { ALL_RECIPES } from '../data'
import type { Recipe } from '../types'

const BUILT_IN = ALL_RECIPES[0]

function visible(): Recipe[] {
  const { custom, hidden } = useRecipeStore.getState()
  const overridden = new Set(custom.map((r) => r.id))
  const hiddenSet = new Set(hidden)
  return [
    ...ALL_RECIPES.filter((r) => !overridden.has(r.id) && !hiddenSet.has(r.id)),
    ...custom,
  ]
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

  it('adds and then deletes for good, leaving nothing hidden', () => {
    const { addRecipe, removeRecipe } = useRecipeStore.getState()
    addRecipe(mine('recipe-abc'))
    expect(visible().some((r) => r.id === 'recipe-abc')).toBe(true)

    removeRecipe('recipe-abc')
    expect(visible().some((r) => r.id === 'recipe-abc')).toBe(false)
    // Nothing to hide — it was never in the shipped library.
    expect(useRecipeStore.getState().hidden).toEqual([])
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
