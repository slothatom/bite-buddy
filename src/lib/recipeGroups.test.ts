import { describe, it, expect } from 'vitest'
import type { RecipeTag } from '../types'
import {
  groupsOf, primaryGroupOf, groupForTime, withGroups, baseName, groupVariants, variantLabel,
  RECIPE_GROUPS,
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

  it('covers the whole library, no recipe falls off the end', () => {
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


  it('round-trips a tag it has never heard of', () => {
    const exotic = ['dessert', 'lunch'] as RecipeTag[]
    expect(withGroups(exotic, ['dinner'])).toContain('dessert')
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

  it('puts one dish written at three portions on one shelf', () => {
    // The importer folds away the repeats that are the same food, so what is
    // left to group is genuinely different portions of a dish: 30, 40 and 45 g
    // of oats under the same yogurt and berries.
    const oats = groupVariants(ALL_RECIPES)
      .find((g) => g.name === 'Rolled oats with yogurt & mixed berries')!
    expect(oats.variants).toHaveLength(3)
  })

  it('leaves a portion in brackets but not a name in brackets', () => {
    expect(baseName('Cream of mushroom soup (300 g)')).toBe('Cream of mushroom soup')
    expect(baseName('Creamed spinach with halloumi (80 g halloumi)')).toBe('Creamed spinach with halloumi')
    expect(baseName('Salmon with sweet potato (no yogurt garlic sauce)')).toBe('Salmon with sweet potato')
    expect(baseName('Porridge (the good one)')).toBe('Porridge (the good one)')
  })

  it('holds the portion in its own field, out of the name', () => {
    // Finding 30. "Grapefruit with cashews (10 g cashews, 250 g grapefruit)"
    // was a headline three lines deep on a phone, and every screen that wanted
    // the dish had to take the bracket back off. The library ships the two
    // apart now, so nothing in it needs stripping.
    for (const r of ALL_RECIPES) {
      expect(r.name.en, r.id).not.toMatch(/\(/)
    }
    const grapefruit = ALL_RECIPES.filter((r) => r.name.en === 'Grapefruit with cashews')
    expect(grapefruit).toHaveLength(4)
    expect(grapefruit.map((r) => r.variant)).toContain('20 g cashews, 150 g grapefruit')
  })

  it('labels a version by what it is, not by where it sits', () => {
    const oats = ALL_RECIPES.filter((r) => r.name.en === 'Rolled oats with yogurt & mixed berries')
    expect(oats.map((r, i) => variantLabel(r, i)).sort())
      .toEqual(['30 g rolled oats', '40 g rolled oats', '45 g rolled oats'])
  })

  it('falls back to a position for a version with no portion to report', () => {
    // A hand-written dish sharing a name with an imported meal has no portion,
    // and neither has a second copy you made yourself.
    expect(variantLabel({ name: { en: 'Omelette' } }, 1)).toBe('Version 2')
  })

  it('reads the portion back out of a name saved before the split', () => {
    // Your own copy of a shipped recipe, persisted from an older build, still
    // carries the bracket. It is a portion, so it is shown as one.
    expect(variantLabel({ name: { en: 'Creamed spinach with halloumi (80 g halloumi)' } }, 0))
      .toBe('80 g halloumi')
  })

  it('loses nothing on the way', () => {
    const grouped = groupVariants(ALL_RECIPES)
    expect(grouped.reduce((n, g) => n + g.variants.length, 0)).toBe(ALL_RECIPES.length)
  })
})

/**
 * The snack shelf was permanently empty. Every snack line was kept as plain
 * food entries, so the app offered four shelves and could only ever stock
 * three, and the tag that would have filled the fourth sat unreachable in the
 * importer.
 */
describe('the shelf that used to have nothing on it', () => {
  const snacks = ALL_RECIPES.filter((r) => r.tags.includes('snack'))

  it('has snacks on it', () => {
    expect(snacks.length).toBeGreaterThan(20)
  })

  it('holds combinations, not a mirror of the food library', () => {
    // 152 of the 194 snack lines in these plans are one food and a weight,
    // "150 g mere". A card called "Apple" is one nobody would open or cook,
    // so those stay lines and only the assembled ones become recipes.
    for (const snack of snacks) {
      expect(snack.components.length, snack.name.en).toBeGreaterThan(1)
    }
  })

  it('names a snack after what there is most of, not what has most calories', () => {
    // 150 g of apple is 78 kcal and 15 g of cashews is 87, so ranking a snack
    // the way a dinner is ranked produced "Cashews with apple" on one line and
    // "Apple with walnuts" on the next.
    const nuts = /^(Cashews|Walnuts|Almonds|Peanuts|Hazelnuts)\b/
    for (const snack of snacks) {
      expect(nuts.test(snack.name.en), `${snack.name.en} leads with the nuts`).toBe(false)
    }
  })

  it('gives both snack slots the same face', () => {
    // One apple-and-cashews got a red apple and the next a green one, purely
    // by which slot of the day it had been written in.
    const faces = new Set(snacks.filter((r) =>
      r.components.every((c) => c.kind === 'food')).map((r) => r.emoji))
    expect(faces.size).toBe(1)
  })

  it('costs no time on a hob, because nothing is cooked', () => {
    for (const snack of snacks) {
      expect(snack.cookMinutes, snack.name.en).toBe(0)
      expect(snack.prepMinutes, snack.name.en).toBeGreaterThan(0)
    }
  })
})
