import { describe, it, expect } from 'vitest'
import {
  recipeSignature, interchangeableGroups, resolveMerged,
  planMerge, planUnmerge, foldedInto,
} from './mergeRecipes'
import { buildContext } from './nutrition'
import { groupVariants } from './recipeGroups'
import { ALL_RECIPES, FOODS } from '../data'

const ctx = buildContext(FOODS, ALL_RECIPES)

describe('which repeats are safe to merge without asking', () => {
  it('reads two spellings of one meal as the same food', () => {
    // "supă de fasole verde" and "ciorbă de fasole verde" are one dinner written
    // two ways; nothing is lost by folding them together.
    // The full name: there is also a "Green bean soup" dish, which is the
    // component this meal is built from and a group of its own.
    const soup = groupVariants(ALL_RECIPES)
      .find((g) => g.name === 'Green bean soup with wholemeal bread & yogurt')!
    expect(soup.variants.length).toBeGreaterThan(1)
    expect(interchangeableGroups([soup], ctx)).toHaveLength(1)
  })

  it('leaves alone a dish written at genuinely different portions', () => {
    // 259 kcal and 408 kcal are a real choice, not a duplicate.
    const pan = groupVariants(ALL_RECIPES)
      .find((g) => g.name === 'Spicy chicken & vegetable pan')!
    expect(pan.variants.length).toBeGreaterThan(1)
    expect(interchangeableGroups([pan], ctx)).toHaveLength(0)
  })

  it('never offers a group of one', () => {
    const single = groupVariants(ALL_RECIPES).find((g) => g.variants.length === 1)!
    expect(interchangeableGroups([single], ctx)).toHaveLength(0)
  })

  it('finds a real number of them in the shipped library', () => {
    const safe = interchangeableGroups(groupVariants(ALL_RECIPES), ctx)
    expect(safe.length).toBeGreaterThan(10)
    // And every one of them really is uniform, not merely similarly named.
    for (const g of safe) {
      const signatures = new Set(g.variants.map((v) => recipeSignature(v, ctx)))
      expect(signatures.size).toBe(1)
    }
  })
})

describe('keeping the notes straight', () => {
  it('resolves a plain merge', () => {
    expect(resolveMerged({ b: 'a' }, 'b')).toBe('a')
  })

  it('follows a chain to the end', () => {
    expect(resolveMerged({ c: 'b', b: 'a' }, 'c')).toBe('a')
  })

  it('leaves an unmerged recipe alone', () => {
    expect(resolveMerged({ b: 'a' }, 'z')).toBe('z')
  })

  it('gives up on a cycle instead of hanging every screen', () => {
    expect(() => resolveMerged({ a: 'b', b: 'a' }, 'a')).not.toThrow()
  })
})

describe('planning a merge', () => {
  it('points the losers at the winner', () => {
    expect(planMerge({}, 'keep', ['drop1', 'drop2']))
      .toEqual({ drop1: 'keep', drop2: 'keep' })
  })

  it('refuses to merge a recipe into itself', () => {
    // Mapping the winner to the winner would take it out of the library and
    // leave nothing in its place.
    expect(planMerge({}, 'keep', ['keep', 'drop'])).toEqual({ drop: 'keep' })
  })

  it('brings a previous winner\'s losers along', () => {
    // b was merged into a; now a is merged into c. b must follow, or it points
    // at a recipe that is no longer shown.
    expect(planMerge({ b: 'a' }, 'c', ['a'])).toEqual({ a: 'c', b: 'c' })
  })

  it('merges into a recipe that is itself already merged away', () => {
    // Choosing a winner that has since been folded elsewhere should land on
    // whatever it actually became, not recreate a dead end.
    expect(planMerge({ a: 'c' }, 'a', ['d'])).toEqual({ a: 'c', d: 'c' })
  })

  it('lists what a merge would undo', () => {
    const merged = planMerge({}, 'keep', ['drop1', 'drop2'])
    expect(foldedInto(merged, 'keep').sort()).toEqual(['drop1', 'drop2'])
    expect(foldedInto(merged, 'elsewhere')).toEqual([])
  })

  it('puts everything back on undo', () => {
    const merged = planMerge({}, 'keep', ['drop1', 'drop2'])
    expect(planUnmerge(merged, 'keep')).toEqual({})
  })

  it('undoes one dish without touching another', () => {
    const merged = planMerge(planMerge({}, 'keepA', ['dropA']), 'keepB', ['dropB'])
    expect(planUnmerge(merged, 'keepA')).toEqual({ dropB: 'keepB' })
  })
})

describe('what a merge must not break', () => {
  const [winner, loser] = ALL_RECIPES

  it('still resolves a day planned with the merged-away recipe', () => {
    // The fourteen archived weeks name recipe ids in code and cannot be
    // rewritten, so the id has to keep working after a merge.
    const merged = planMerge({}, winner.id, [loser.id])
    const library = ALL_RECIPES.filter((r) => !(r.id in merged))
    const after = buildContext(FOODS, library, merged)

    expect(after.recipes.has(loser.id)).toBe(true)
    expect(after.recipes.get(loser.id)?.id).toBe(winner.id)
  })

  it('drops the merged-away recipe from the library itself', () => {
    const merged = planMerge({}, winner.id, [loser.id])
    const library = ALL_RECIPES.filter((r) => !(r.id in merged))

    expect(library.some((r) => r.id === loser.id)).toBe(false)
    expect(library.some((r) => r.id === winner.id)).toBe(true)
  })

  it('never lets an alias shadow a recipe that is still in the library', () => {
    const bogus = { [winner.id]: loser.id }
    const after = buildContext(FOODS, ALL_RECIPES, bogus)
    expect(after.recipes.get(winner.id)?.id).toBe(winner.id)
  })
})

describe('the store side of merging', () => {
  // Imported lazily so the pure functions above are testable without a store.
  it('folds, hides and restores', async () => {
    const { useRecipeStore } = await import('../store/useRecipeStore')
    const [a, b] = ALL_RECIPES
    useRecipeStore.setState({ custom: [], hidden: [], favouriteIds: [], mergedInto: {} })

    useRecipeStore.getState().mergeRecipes(a.id, [b.id])
    expect(useRecipeStore.getState().mergedInto).toEqual({ [b.id]: a.id })

    useRecipeStore.getState().unmergeRecipe(a.id)
    expect(useRecipeStore.getState().mergedInto).toEqual({})
  })

  it('moves a star off a version nobody can see any more', () => {
    // A favourite on a merged-away recipe would be a star you cannot find to
    // switch off.
    return import('../store/useRecipeStore').then(({ useRecipeStore }) => {
      const [a, b] = ALL_RECIPES
      useRecipeStore.setState({ custom: [], hidden: [], favouriteIds: [b.id], mergedInto: {} })
      useRecipeStore.getState().mergeRecipes(a.id, [b.id])

      const { favouriteIds } = useRecipeStore.getState()
      expect(favouriteIds).toContain(a.id)
      expect(favouriteIds).not.toContain(b.id)
    })
  })

  it('leaves the stars alone when none of them was involved', () => {
    return import('../store/useRecipeStore').then(({ useRecipeStore }) => {
      const [a, b, c] = ALL_RECIPES
      useRecipeStore.setState({ custom: [], hidden: [], favouriteIds: [c.id], mergedInto: {} })
      useRecipeStore.getState().mergeRecipes(a.id, [b.id])

      expect(useRecipeStore.getState().favouriteIds).toEqual([c.id])
    })
  })
})
