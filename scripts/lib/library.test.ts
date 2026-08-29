import { describe, it, expect } from 'vitest'
import { buildLibrary, type PlanInput } from './library.js'
import { DISHES } from '../../src/data/dishes.js'
import { FOODS } from '../../src/data/foods.js'
import { buildContext, componentsNutrients } from '../../src/lib/nutrition.js'
import type { MealSlot } from '../../src/types/index.js'

/**
 * The import rules, on lines taken from the real plans.
 *
 * Every case here was found in the shipped data rather than imagined: a
 * bruschetta that listed its own ingredients and so was made twice over, a
 * bowl of soup whose "g" had been lost in the typing, and five weeks of meals
 * that were the same meal spelt differently.
 */

let n = 0
function plan(...lines: [MealSlot, string][]): PlanInput {
  n++
  return {
    id: `plan-${n}`,
    file: `plan-${n}.docx`,
    label: `Week ${n}`,
    language: 'ro',
    issuedOn: '2022-06-06',
    subject: 'self',
    days: [{
      dayName: 'Luni',
      weekday: 1,
      meals: lines.map(([slot, text]) => ({ slot, text })),
    }],
  }
}

const names = (plans: PlanInput[]) => buildLibrary(plans).recipes.map((r) => r.name.en)

describe('a dish that lists its own ingredients', () => {
  it('does not serve them twice', () => {
    const { plans } = buildLibrary([plan(['dinner',
      'bruschete cu telemea: 50 g telemea, 50 g paine int, rosii, usturoi, busuioc, o lingurita de ulei de masline',
    ])])

    // Read literally this line is a bruschetta plus a second helping of
    // everything on it, which is where 189 kcal of food nobody ate came from.
    // Once the helpings are counted once, the line is simply the dish.
    expect(plans[0].days[0].meals[0].entries).toEqual([
      { kind: 'recipe', recipeId: 'dish-bruschetta', servings: 1 },
    ])
  })

  it('keeps the difference when more is asked for than the dish assumes', () => {
    // The spicy pan is defined with 250 g of vegetables. She wrote 300, so the
    // extra 50 is real and stays; her teaspoon of oil is already in the dish.
    const { recipes } = buildLibrary([plan(['lunch',
      'tigaie picanta: 120 g piept de pui, 300 g legume , o lingurita de ulei',
    ])])

    expect(recipes[0].components).toContainEqual(
      { kind: 'food', foodId: 'vegetables-mixed', grams: 50 })
    expect(recipes[0].components.filter((c) => c.kind === 'food' && c.foodId === 'olive-oil'))
      .toHaveLength(0)
  })

  it('leaves a genuine extra alone', () => {
    // Chocolate is not in the porridge, so it is not a duplicate of anything.
    const { recipes } = buildLibrary([plan(['breakfast',
      'terci de ovaz ( 100 ml apa, 100 ml lapte, 40 g fulgi de ovaz, scortisoara) + 15 g ciocolata neagra',
    ])])

    expect(recipes[0].components).toContainEqual(
      { kind: 'food', foodId: 'dark-chocolate', grams: 15 })
  })
})

describe('a weight that lost its unit', () => {
  it('still portions a soup by weight', () => {
    // "300 gombakremleves" is 300 g of mushroom soup. Without this it imported
    // as the whole two-serving pot, at more than twice the calories.
    const { recipes } = buildLibrary([plan(['dinner', '300 gombakremleves (1 tk. olivaolaj)'])])
    const component = recipes[0].components[0]

    expect(component).toMatchObject({ kind: 'recipe', recipeId: 'dish-soup-mushroom-cream' })
    expect(component.kind === 'recipe' && component.servings).toBeLessThan(0.6)
  })

  it('does not read a count as grams', () => {
    // "2 oua" is two eggs, not two grams of anything.
    const { recipes } = buildLibrary([plan(['breakfast',
      '50 g paine int, omleta ( din 2 oua) + jumatate de farfurie de legume',
    ])])
    const omelette = recipes[0].components.find((c) => c.kind === 'recipe')

    expect(omelette).toMatchObject({ servings: 1 })
  })
})

describe('the same meal, written twice', () => {
  it('becomes one recipe, with the other resolving to it', () => {
    const { recipes, aliases } = buildLibrary([
      plan(['lunch', '125 g somon, 250 g legume la cuptor , 50 g sos de usrutoi']),
      plan(['lunch', '125 g somon, 250 g legume la cuptor , 50 g sos de usturoi']),
    ])

    expect(recipes).toHaveLength(1)
    expect(Object.values(aliases)).toEqual([recipes[0].id])
  })

  it('sends the plan days to the one that survived', () => {
    const { plans, recipes } = buildLibrary([
      plan(['lunch', '125 g somon, 250 g legume la cuptor , 50 g sos de usrutoi']),
      plan(['lunch', '125 g somon, 250 g legume la cuptor , 50 g sos de usturoi']),
    ])

    for (const p of plans) {
      expect(p.days[0].meals[0].entries).toEqual([
        { kind: 'recipe', recipeId: recipes[0].id, servings: 1 },
      ])
    }
  })

  it('keeps a day saying what the dietician said, whichever way she said it', () => {
    // The recipe is shared; the line is not. The archive shows the day's own
    // wording, so nothing is lost by folding the recipes together.
    const { plans } = buildLibrary([
      plan(['lunch', '125 g somon, 250 g legume la cuptor , 50 g sos de usrutoi']),
      plan(['lunch', '125 g somon, 250 g legume la cuptor , 50 g sos de usturoi']),
    ])

    expect(plans.map((p) => p.days[0].meals[0].text)).toEqual([
      '125 g somon, 250 g legume la cuptor , 50 g sos de usrutoi',
      '125 g somon, 250 g legume la cuptor , 50 g sos de usturoi',
    ])
  })

  it('is the dish itself when that is all it is', () => {
    const { recipes, aliases } = buildLibrary([
      plan(['breakfast', '1 portie de fulgi de ovaz la cuptor']),
    ])

    expect(recipes).toHaveLength(0)
    expect(aliases).toEqual({ 'meal-breakfast-001': 'dish-baked-oats' })
  })
})

describe('two recipes that need telling apart', () => {
  it('never settles for a number in brackets', () => {
    const built = names([
      plan(['breakfast', '150 g iaurt , 30 g fulgi de ovaz, 100 g fructe de padure']),
      plan(['breakfast', '150 g iaurt , 45 g fulgi de ovaz, 100 g fructe de padure']),
    ])

    expect(built.some((name) => / \(\d+\)$/.test(name))).toBe(false)
    expect(new Set(built).size).toBe(built.length)
  })

  it('says the weight that differs, on both of them', () => {
    const built = names([
      plan(['breakfast', '150 g iaurt , 30 g fulgi de ovaz, 100 g fructe de padure']),
      plan(['breakfast', '150 g iaurt , 45 g fulgi de ovaz, 100 g fructe de padure']),
    ])

    expect(built).toContain('Rolled oats with yogurt & mixed berries (30 g rolled oats)')
    expect(built).toContain('Rolled oats with yogurt & mixed berries (45 g rolled oats)')
  })

  it('folds an ingredient one of them has into its name', () => {
    const built = names([
      plan(['dinner', 'salata de cruditati, 50 g feta, 15 g orez expandat']),
      plan(['dinner', 'salata de cruditati, 50 g feta, o lingurita de ulei de masline, 15 g orez expandat']),
    ])

    expect(built).toContain('Feta with puffed rice cakes & raw vegetable salad')
    expect(built).toContain('Feta with puffed rice cakes, raw vegetable salad & extra virgin olive oil')
  })

  it('does not let a meal shadow the dish it is named after', () => {
    const built = names([plan(['dinner', '300 gombakremleves (1 tk. olivaolaj)'])])

    expect(built).toEqual(['Cream of mushroom soup (300 g)'])
    expect(DISHES.map((d) => d.name.en)).toContain('Cream of mushroom soup')
  })

  it('would rather name an ingredient than a pinch of seasoning', () => {
    const built = names([
      plan(['lunch', 'mini pizza de vinete: ½ vinete , o lingurita de ulei, rosii, 65 g mozzarella in apa , busuioc + 50 g bulgur nefiert']),
      plan(['lunch', 'mini pizza de vinete: ½ vinete , o lingurita de ulei, rosii, 60 g mozzarella in apa + 40 g bulgur nefiert']),
    ])

    // One of these has a few leaves of basil and the other does not, but they
    // also carry 50 g and 40 g of bulgur, which is the difference worth saying.
    expect(built.some((name) => /basil/i.test(name))).toBe(false)
    expect(built).toContain('Eggplant mini pizzas with bulgur & tomatoes (50 g bulgur)')
    expect(built).toContain('Eggplant mini pizzas with bulgur & tomatoes (40 g bulgur)')
  })
})

describe('the whole archive', () => {
  it("costs a day what the dietician's own numbers cost", () => {
    // A day of these plans is a little over a thousand calories by design. The
    // double counting had pushed the average up by about a tenth.
    const { plans, recipes, aliases } = buildLibrary(REAL_WEEK)
    const ctx = buildContext(FOODS, [...DISHES, ...recipes], aliases)
    const day = plans[0].days[0].meals
      .reduce((sum, m) => sum + componentsNutrients(m.entries, ctx).calories, 0)

    expect(day).toBeGreaterThan(800)
    expect(day).toBeLessThan(1600)
  })
})

const REAL_WEEK: PlanInput[] = [plan(
  ['breakfast', '50 g paine int, pasta de branza ( 100 g branza de vaci, 2 lg de iaurt, ceapa), legume'],
  ['snack1', '200 g capsuni'],
  ['lunch', 'tigaie picanta: 120 g piept de pui, 300 g legume , o lingurita de ulei'],
  ['snack2', '150 g grapefruit'],
  ['dinner', '350 g ciorba de varza ( o lingurita de ulei / portie), o lg de iaurt , 25 g paine int'],
)]

describe('a seasoning is worth naming when nothing else differs', () => {
  it('says which porridge has the vanilla in it', () => {
    const built = names([
      plan(['breakfast', 'terci de ovaz cu mere: 100 ml lapte, 100 ml apa, 100 g mere, 40 g fulgi de ovaz, scortisoara']),
      plan(['breakfast', 'terci de ovaz cu mar razuit: 100 ml lapte, 100 ml apa, 100 g mar razuit, scortisoara, esenta de vanilie']),
    ])

    // The first of these is the dish itself and keeps the dish's name; the
    // second is that dish plus vanilla, and now says so.
    expect(built).toEqual(['Apple & cinnamon porridge with vanilla extract'])
  })
})

describe('what a meal takes, and how often it was made', () => {
  it('gives every imported meal a time', () => {
    // The plans are portions, not methods: not one of the 481 lines says how
    // long anything takes, so all 157 recipes used to arrive at zero and
    // "Quick tonight" could only ever see the hand-written dishes.
    const { recipes } = buildLibrary(REAL_WEEK)

    expect(recipes.length).toBeGreaterThan(0)
    expect(recipes.every((r) => r.prepMinutes > 0)).toBe(true)
  })

  it('takes its cooking from the dish it contains, not from the estimate', () => {
    const { recipes } = buildLibrary([plan(['dinner',
      '350 g ciorba de varza ( o lingurita de ulei / portie), o lg de iaurt , 25 g paine int',
    ])])
    const soup = DISHES.find((d) => d.id === 'dish-ciorba-cabbage')!

    expect(recipes[0].cookMinutes).toBe(soup.cookMinutes)
  })

  it('counts the dish inside a meal every time the meal is eaten', () => {
    const { timesPlanned } = buildLibrary([plan(
      ['dinner', '350 g ciorba de varza ( o lingurita de ulei / portie), o lg de iaurt , 25 g paine int'],
      ['lunch', '350 g ciorba de varza , 50 g paine int'],
    )])

    // Two different meals, one pot of soup, which is exactly the thing worth
    // knowing when you are deciding what to cook a lot of.
    expect(timesPlanned['dish-ciorba-cabbage']).toBe(2)
  })
})
