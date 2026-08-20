import { describe, it, expect } from 'vitest'
import type { DishCategory, QuickFilter, RecipeTag } from '../types'
import {
  DISH_CATEGORIES, CATEGORY_LABELS, CATEGORY_MEAL_TIMES,
  QUICK_FILTERS, QUICK_FILTER_DEFINITIONS, HAND_APPLIED_FILTERS,
  hasQuickFilter, withQuickFilter, mealTimesOf, quickFilterLabel,
} from './dishCategories'
import { categorise, deriveQuickFilters, headOfName } from './classify'
import { buildContext } from './nutrition'
import { ALL_RECIPES, FOODS } from '../data'

const ctx = buildContext(FOODS, ALL_RECIPES)

describe('the taxonomy itself', () => {
  it('has all thirty-seven categories, each with a label and meal times', () => {
    expect(DISH_CATEGORIES).toHaveLength(37)
    expect(new Set(DISH_CATEGORIES).size).toBe(37)
    for (const c of DISH_CATEGORIES) {
      expect(CATEGORY_LABELS[c], c).toBeTruthy()
      expect(CATEGORY_MEAL_TIMES[c].length, c).toBeGreaterThan(0)
    }
  })

  it('has all fourteen filters, each with an emoji and an explanation', () => {
    expect(QUICK_FILTERS).toHaveLength(14)
    for (const f of QUICK_FILTERS) {
      const d = QUICK_FILTER_DEFINITIONS[f]
      expect(d.emoji, f).toBeTruthy()
      expect(d.note, f).toBeTruthy()
    }
  })

  it('never maps a category to "dish", which is not a meal time', () => {
    for (const c of DISH_CATEGORIES) {
      expect(CATEGORY_MEAL_TIMES[c], c).not.toContain('dish')
    }
  })

  it('says plainly which filters it cannot work out for itself', () => {
    // Lazy, Leftovers, Fridge Clean-Out, Special Occasion — and Budget, which
    // needs prices the app does not hold.
    expect(HAND_APPLIED_FILTERS).toEqual(
      expect.arrayContaining(['lazy', 'leftovers', 'budget', 'fridge-clearout', 'special']),
    )
  })
})

describe('turning a filter on and off', () => {
  const recipe = (quickFilters: QuickFilter[]) => ({ quickFilters })

  it('reads one off a recipe', () => {
    expect(hasQuickFilter(recipe(['quick']), 'quick')).toBe(true)
    expect(hasQuickFilter(recipe(['quick']), 'cozy')).toBe(false)
    expect(hasQuickFilter({ quickFilters: undefined }, 'quick')).toBe(false)
  })

  it('adds and removes without disturbing the others', () => {
    expect(withQuickFilter(['quick'], 'cozy', true)).toEqual(['quick', 'cozy'])
    expect(withQuickFilter(['quick', 'cozy'], 'quick', false)).toEqual(['cozy'])
  })

  it('keeps a stable order however they were added', () => {
    // Otherwise the chips reshuffle themselves as you tick them.
    expect(withQuickFilter(['special'], 'quick', true)).toEqual(['quick', 'special'])
  })

  it('does not duplicate one that is already on', () => {
    expect(withQuickFilter(['quick'], 'quick', true)).toEqual(['quick'])
  })

  it('starts from nothing', () => {
    expect(withQuickFilter(undefined, 'quick', true)).toEqual(['quick'])
  })

  it('labels a filter with its emoji, which is how it is read at chip size', () => {
    expect(quickFilterLabel('quick')).toContain('⚡')
    expect(quickFilterLabel('quick')).toContain('Quick')
  })
})

describe('when a recipe is eaten', () => {
  const tagged = (tags: RecipeTag[], category?: DishCategory) => ({ tags, category })

  it('believes the plans over the category', () => {
    // A pancake eaten at dinner in a real plan is a dinner, whatever pancakes
    // usually are. The evidence wins.
    expect(mealTimesOf(tagged(['dinner'], 'pancake'))).toEqual(['dinner'])
  })

  it('falls back to the category only when there is no evidence at all', () => {
    // The batch-cooked dishes were never a meal in a plan, so without this the
    // planner would never offer you the lentil stew for lunch.
    expect(mealTimesOf(tagged([], 'soup'))).toEqual(['lunch', 'dinner'])
  })

  it('leaves an uncategorised dish with nothing rather than guessing', () => {
    expect(mealTimesOf(tagged([]))).toEqual([])
  })
})

describe('reading a category off a recipe', () => {
  it('takes the dish from the head of the name, not the plate around it', () => {
    // These names are all "PRIMARY with SIDE & SIDE".
    expect(headOfName('Carrot salad with cottage cheese & wholemeal bread')).toBe('Carrot salad')
    expect(headOfName('Cod with mango salsa, brown rice')).toBe('Cod')
    expect(headOfName('Omelette')).toBe('Omelette')
  })

  const find = (name: string) => ALL_RECIPES.find((r) => r.name.en === name)!

  it('is not fooled by "pastă", which is Romanian for spread', () => {
    // Reading the source line filed fifteen spreads under Pasta.
    const spread = find('Tuna spread')
    expect(spread.sourceLine ?? spread.name.ro).toBeDefined()
    expect(categorise(spread, ctx)).toBe('dip')
  })

  it('does not call a plate a sauce because a sauce came with it', () => {
    const plate = ALL_RECIPES.find((r) => r.name.en.startsWith('Roasted vegetables with salmon'))!
    expect(categorise(plate, ctx)).not.toBe('sauce')
  })

  it('gives everything in the library a category', () => {
    for (const r of ALL_RECIPES) {
      expect(DISH_CATEGORIES, r.name.en).toContain(r.category)
    }
  })

  it('agrees with what was generated, so the file is not stale', () => {
    // If the rules change without re-running the script, this is what says so.
    for (const r of ALL_RECIPES) {
      expect(categorise(r, ctx), r.name.en).toBe(r.category)
    }
  })
})

describe('the filters the app works out for itself', () => {
  it('will not call a recipe quick when nobody wrote down how long it takes', () => {
    // Zero minutes means "unknown", and treating it as instant would mark two
    // hundred meals Quick & Easy.
    const noTime = { ...ALL_RECIPES[0], prepMinutes: 0, cookMinutes: 0 }
    expect(deriveQuickFilters(noTime, 'salad', ctx)).not.toContain('quick')
  })

  it('never applies the ones it has no business guessing at', () => {
    for (const r of ALL_RECIPES) {
      for (const f of HAND_APPLIED_FILTERS) {
        expect(r.quickFilters ?? [], `${r.name.en} / ${f}`).not.toContain(f)
      }
    }
  })

  it('applies each derived filter to some of the library but not most of it', () => {
    // A filter that matches four recipes in five narrows nothing. This is the
    // check that killed the derived Budget Friendly.
    const derived = QUICK_FILTERS.filter((f) => QUICK_FILTER_DEFINITIONS[f].derived)
    for (const f of derived) {
      const n = ALL_RECIPES.filter((r) => hasQuickFilter(r, f)).length
      expect(n, `${f} matches nothing`).toBeGreaterThan(0)
      expect(n / ALL_RECIPES.length, `${f} matches almost everything`).toBeLessThan(0.6)
    }
  })

  it('knows a soup is one pot without being told', () => {
    const soup = ALL_RECIPES.find((r) => r.category === 'soup')!
    expect(soup.quickFilters).toContain('one-pan')
    expect(soup.quickFilters).toContain('cozy')
  })
})
