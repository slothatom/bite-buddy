import { describe, it, expect } from 'vitest'
import type { RecipeTag } from '../types'
import {
  groupsOf, primaryGroupOf, groupForTime, hasLabel, otherTags,
  withGroups, withLabel, baseName, groupVariants,
  RECIPE_GROUPS, RECIPE_LABELS,
} from './recipeGroups'
import type { Recipe } from '../types'
import { ALL_RECIPES } from '../data'

const tagged = (...tags: RecipeTag[]) => ({ tags })

describe('groups', () => {
  it('shelves a recipe by when you eat it', () => {
    expect(groupsOf(tagged('breakfast', 'quick'))).toEqual(['breakfast'])
  })

  it('puts a two-meal dish on both shelves', () => {
    // The lentil stew is lunch on Friday and dinner on Saturday. Picking one
    // would hide it from the other.
    expect(groupsOf(tagged('lunch', 'dinner'))).toEqual(['lunch', 'dinner'])
  })

  it('treats anything without a meal tag as a dish', () => {
    expect(groupsOf(tagged('spread', 'high-protein'))).toEqual(['dish'])
    expect(groupsOf(tagged())).toEqual(['dish'])
  })

  it('picks the earliest meal when a card has room for only one', () => {
    expect(primaryGroupOf(tagged('dinner', 'lunch'))).toBe('lunch')
  })

  it('opens on the meal you are most likely looking for', () => {
    expect(groupForTime(new Date('2026-08-20T08:00:00'))).toBe('breakfast')
    expect(groupForTime(new Date('2026-08-20T13:00:00'))).toBe('lunch')
    expect(groupForTime(new Date('2026-08-20T19:00:00'))).toBe('dinner')
  })

  it('covers the whole library — no recipe falls off the end', () => {
    for (const r of ALL_RECIPES) {
      const groups = groupsOf(r)
      expect(groups.length).toBeGreaterThan(0)
      for (const g of groups) expect(RECIPE_GROUPS).toContain(g)
    }
  })

  it('leaves no shelf empty', () => {
    // A tab that is always empty is a tab that should not exist. Snacks are the
    // one to watch: the plans write them as food lines, not recipes.
    const counts = new Map(RECIPE_GROUPS.map((g) => [g, 0]))
    for (const r of ALL_RECIPES) {
      for (const g of groupsOf(r)) counts.set(g, counts.get(g)! + 1)
    }
    for (const g of ['breakfast', 'lunch', 'dinner', 'dish'] as const) {
      expect(counts.get(g), `${g} is empty`).toBeGreaterThan(0)
    }
  })
})

describe('labels', () => {
  it('reads veggie from either half of the pair', () => {
    expect(hasLabel(tagged('vegan'), 'veggie')).toBe(true)
    expect(hasLabel(tagged('vegetarian'), 'veggie')).toBe(true)
    expect(hasLabel(tagged('pescatarian'), 'veggie')).toBe(false)
  })

  it('keeps the four filters down to four', () => {
    expect(RECIPE_LABELS).toHaveLength(4)
  })

  it('hands the leftovers back rather than losing them', () => {
    expect(otherTags(tagged('lunch', 'soup', 'vegan', 'batch'))).toEqual(['soup'])
  })
})

describe('editing tags through the simplified axes', () => {
  it('swaps the meal without touching anything else', () => {
    const after = withGroups(['breakfast', 'quick', 'soup'], ['dinner'])
    expect(after).toContain('dinner')
    expect(after).not.toContain('breakfast')
    expect(after).toEqual(expect.arrayContaining(['quick', 'soup']))
  })

  it('makes a meal into a dish by clearing the meal tags', () => {
    expect(withGroups(['lunch', 'batch'], ['dish'])).toEqual(['batch'])
  })

  it('adds the gentler half of the veggie pair', () => {
    expect(withLabel(['lunch'], 'veggie', true)).toContain('vegetarian')
  })

  it('does not demote a vegan recipe to vegetarian', () => {
    expect(withLabel(['vegan', 'lunch'], 'veggie', true)).toEqual(['vegan', 'lunch'])
  })

  it('clears both halves when switched off, so the chip really goes dark', () => {
    expect(withLabel(['vegan', 'vegetarian', 'lunch'], 'veggie', false)).toEqual(['lunch'])
  })

  it('round-trips a tag it has never heard of', () => {
    const exotic = ['dessert', 'lunch'] as RecipeTag[]
    const after = withLabel(withGroups(exotic, ['dinner']), 'quick', true)
    expect(after).toContain('dessert')
  })
})

describe('the same dish written at different portions', () => {
  const named = (en: string): Recipe => ({
    id: en, name: { en }, emoji: '🍲', servings: 1, prepMinutes: 0, cookMinutes: 0,
    components: [], steps: [], tags: [], createdAt: '',
  })

  it('takes the generator\'s numbering off the name', () => {
    expect(baseName('Cabbage soup (3)')).toBe('Cabbage soup')
    expect(baseName('Cabbage soup')).toBe('Cabbage soup')
  })

  it('does not mistake a number that belongs to the name', () => {
    expect(baseName('Porridge (the good one)')).toBe('Porridge (the good one)')
  })

  it('collapses the numbered versions into one entry', () => {
    const groups = groupVariants([named('Cabbage soup'), named('Cabbage soup (2)'), named('Omelette')])

    expect(groups).toHaveLength(2)
    expect(groups[0].name).toBe('Cabbage soup')
    expect(groups[0].variants).toHaveLength(2)
    expect(groups[1].variants).toHaveLength(1)
  })

  it('keeps the order it was given, so favourites stay on top', () => {
    const groups = groupVariants([named('Zebra stew'), named('Apple bake'), named('Zebra stew (2)')])
    expect(groups.map((g) => g.name)).toEqual(['Zebra stew', 'Apple bake'])
  })

  it('cuts a real third off the meal library', () => {
    // 204 generated meals, 68 of them numbered repeats of a dish already there.
    const meals = ALL_RECIPES.filter((r) => r.sourceLine)
    const grouped = groupVariants(meals)
    expect(grouped.length).toBeLessThan(meals.length * 0.75)
  })

  it('loses nothing on the way', () => {
    const grouped = groupVariants(ALL_RECIPES)
    expect(grouped.reduce((n, g) => n + g.variants.length, 0)).toBe(ALL_RECIPES.length)
  })
})
