import { describe, it, expect } from 'vitest'
import { CATEGORY_TIMES, MEASURED, deriveTimes } from './cookingTimes'
import { buildContext } from './nutrition'
import { categorise } from './classify'
import { ALL_RECIPES, DISHES, MEAL_RECIPES, FOODS } from '../data'
import { RECIPE_CLASSIFICATION } from '../data/generated/classification'
import { DISH_CATEGORIES } from './dishCategories'
import type { DishCategory } from '../types'

const ctx = buildContext(FOODS, ALL_RECIPES)
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

describe('the estimates are the dish library, not an opinion', () => {
  it('matches the hand-written dishes in every category with enough of them', () => {
    for (const category of MEASURED) {
      const dishes = DISHES.filter((d) => RECIPE_CLASSIFICATION[d.id]?.category === category)
      expect(dishes.length, `${category} is listed as measured`).toBeGreaterThanOrEqual(3)

      // Within five minutes of what somebody actually wrote down. Exact would
      // be brittle for no gain: one new dish should not fail the build, a
      // category quietly drifting into nonsense should.
      expect(Math.abs(CATEGORY_TIMES[category].prep - median(dishes.map((d) => d.prepMinutes))),
        `${category} prep`).toBeLessThanOrEqual(5)
      expect(Math.abs(CATEGORY_TIMES[category].cook - median(dishes.map((d) => d.cookMinutes))),
        `${category} cook`).toBeLessThanOrEqual(5)
    }
  })

  it('has a figure for every category, so nothing falls through', () => {
    for (const category of DISH_CATEGORIES) {
      expect(CATEGORY_TIMES[category], category).toBeDefined()
      expect(CATEGORY_TIMES[category].prep, `${category} prep`).toBeGreaterThan(0)
    }
  })
})

describe('what a meal takes', () => {
  const only = (id: string) => ({ components: [{ kind: 'recipe' as const, recipeId: id, servings: 1 }] })

  it('is the longest thing in it, not the sum of everything', () => {
    // A salmon fillet and a tray of roasted vegetables go in the oven together.
    const roast = DISHES.find((d) => d.id === 'dish-roasted-vegetables')!
    const meal = {
      components: [
        { kind: 'recipe' as const, recipeId: 'dish-roasted-vegetables', servings: 1 },
        { kind: 'food' as const, foodId: 'salmon', grams: 125 },
      ],
    }

    expect(deriveTimes(meal, ctx, 'fish').cookMinutes).toBe(roast.cookMinutes)
  })

  it('adds a minute for each other thing to be weighed out', () => {
    const bare = deriveTimes(only('dish-roasted-vegetables'), ctx, 'vegetable')
    const withTwoMore = deriveTimes({
      components: [
        ...only('dish-roasted-vegetables').components,
        { kind: 'food' as const, foodId: 'salmon', grams: 125 },
        { kind: 'food' as const, foodId: 'yogurt', grams: 50 },
      ],
    }, ctx, 'vegetable')

    expect(withTwoMore.prepMinutes).toBe(bare.prepMinutes + 2)
  })

  it('never lets the assembly run away with a long ingredient list', () => {
    const many = {
      components: Array.from({ length: 20 }, () => ({ kind: 'food' as const, foodId: 'yogurt', grams: 10 })),
    }

    expect(deriveTimes(many, ctx, 'yogurt').prepMinutes)
      .toBe(CATEGORY_TIMES.yogurt.prep + 5)
  })

  it('falls back to the category when a meal is only food on a plate', () => {
    const bowl = {
      components: [
        { kind: 'food' as const, foodId: 'yogurt', grams: 150 },
        { kind: 'food' as const, foodId: 'oats', grams: 40 },
      ],
    }

    expect(deriveTimes(bowl, ctx, 'yogurt')).toEqual({
      prepMinutes: CATEGORY_TIMES.yogurt.prep + 1,
      cookMinutes: 0,
    })
  })

  it('agrees with what the importer wrote into the library', () => {
    for (const recipe of MEAL_RECIPES) {
      const category = (RECIPE_CLASSIFICATION[recipe.id]?.category ?? categorise(recipe, ctx)) as DishCategory
      expect(deriveTimes(recipe, ctx, category), recipe.id).toEqual({
        prepMinutes: recipe.prepMinutes,
        cookMinutes: recipe.cookMinutes,
      })
    }
  })
})

describe('the library it produces', () => {
  it('gives every imported meal a time, which is the point', () => {
    // All 157 arrived at zero, and "Quick tonight" could only see the 71 dishes.
    expect(MEAL_RECIPES.every((r) => r.prepMinutes > 0)).toBe(true)
  })

  it('gives the same bowl the same time, whichever way it was named', () => {
    // These two have identical ingredients and differ only in which of them
    // the generated name leads with. That sent one to Porridge and the other
    // to Yogurt, and charged the first eight minutes on a hob it never sees.
    const time = (name: string) => {
      const r = ALL_RECIPES.find((x) => x.name.en === name)!
      return r.prepMinutes + r.cookMinutes
    }

    expect(time('Rolled oats with yogurt & mixed berries (30 g rolled oats)'))
      .toBe(time('Yogurt with rolled oats & mixed berries'))
  })

  it('still simmers the porridge that is actually porridge', () => {
    const r = ALL_RECIPES.find((x) => x.name.en === 'Oat porridge with kefir')!
    expect(r.cookMinutes).toBeGreaterThan(0)
  })

  it('leaves a bowl of yogurt quicker than a pot of soup', () => {
    const time = (name: string) => {
      const r = ALL_RECIPES.find((x) => x.name.en === name)!
      return r.prepMinutes + r.cookMinutes
    }

    expect(time('Rolled oats with yogurt & mixed berries (30 g rolled oats)'))
      .toBeLessThan(time('Cabbage soup with wholemeal bread & yogurt'))
  })
})
