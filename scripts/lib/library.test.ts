import { describe, it, expect } from 'vitest'
import { buildLibrary, type PlanInput } from './library.js'
import { DISHES } from '../../src/data/dishes.js'
import { FOODS } from '../../src/data/foods.js'
import { buildContext, componentsNutrients } from '../../src/lib/nutrition.js'
import type { MealSlot } from '../../src/types/index.js'

/**
 * The import rules, on lines in the shape the real plans are written in.
 *
 * Every case here was found in the real data rather than imagined: a
 * bruschetta that listed its own ingredients and so was made twice over, a
 * bowl of soup whose "g" had been lost in the typing, and five weeks of meals
 * that were the same meal spelt differently. The plans themselves are private
 * and not in this repository, so each line below is made up, with the same
 * shape and the same fault as the one that was found.
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

const SPICY_PAN = 'tigaie picanta: 100 g piept de pui, 320 g legume , o lingurita de ulei'
const CABBAGE_SOUP = '320 g ciorba de varza ( o lingurita de ulei / portie), 30 g paine int, 1 rosie'

const names = (plans: PlanInput[]) => buildLibrary(plans).recipes.map((r) => r.name.en)
/** Name and portion as the library holds them: two fields, not one string. */
const titles = (plans: PlanInput[]) =>
  buildLibrary(plans).recipes.map((r) => [r.name.en, r.variant] as const)

describe('a dish that lists its own ingredients', () => {
  it('does not serve them twice', () => {
    const { plans } = buildLibrary([plan(['dinner',
      'bruschete cu telemea: 50 g telemea, 50 g paine int, rosii, busuioc',
    ])])

    // Read literally this line is a bruschetta plus a second helping of
    // everything on it, which is where a couple of hundred kcal of food nobody
    // ate came from.
    // Once the helpings are counted once, the line is simply the dish.
    expect(plans[0].days[0].meals[0].entries).toEqual([
      { kind: 'recipe', recipeId: 'dish-bruschetta', servings: 1 },
    ])
  })

  it('keeps the difference when more is asked for than the dish assumes', () => {
    // The spicy pan is defined with 250 g of vegetables. This says 320, so the
    // extra 70 is real and stays; the teaspoon of oil is already in the dish.
    const { recipes } = buildLibrary([plan(['lunch', SPICY_PAN])])

    expect(recipes[0].components).toContainEqual(
      { kind: 'food', foodId: 'vegetables-mixed', grams: 70 })
    expect(recipes[0].components.filter((c) => c.kind === 'food' && c.foodId === 'olive-oil'))
      .toHaveLength(0)
  })

  it('leaves a genuine extra alone', () => {
    // Chocolate is not in the porridge, so it is not a duplicate of anything.
    const { recipes } = buildLibrary([plan(['breakfast',
      'terci de ovaz ( 120 ml apa, 80 ml lapte, 35 g fulgi de ovaz) + 20 g ciocolata neagra',
    ])])

    expect(recipes[0].components).toContainEqual(
      { kind: 'food', foodId: 'dark-chocolate', grams: 20 })
  })
})

describe('a weight that lost its unit', () => {
  it('still portions a soup by weight', () => {
    // "250 gombakremleves" is 250 g of mushroom soup. Without this it imported
    // as the whole two-serving pot, at more than twice the calories.
    const { recipes } = buildLibrary([plan(['dinner', '250 gombakremleves (1 tk. olivaolaj)'])])
    const component = recipes[0].components[0]

    expect(component).toMatchObject({ kind: 'recipe', recipeId: 'dish-soup-mushroom-cream' })
    expect(component.kind === 'recipe' && component.servings).toBeLessThan(0.6)
  })

  it('does not read a count as grams', () => {
    // "2 oua" is two eggs, not two grams of anything.
    const { recipes } = buildLibrary([plan(['breakfast',
      '40 g paine int, omleta ( din 2 oua) + 150 g rosii',
    ])])
    const omelette = recipes[0].components.find((c) => c.kind === 'recipe')

    expect(omelette).toMatchObject({ servings: 1 })
  })
})

describe('the same meal, written twice', () => {
  it('becomes one recipe, with the other resolving to it', () => {
    const { recipes, aliases } = buildLibrary([
      plan(['lunch', '140 g somon, 200 g legume la cuptor , 40 g sos de usrutoi']),
      plan(['lunch', '140 g somon, 200 g legume la cuptor , 40 g sos de usturoi']),
    ])

    expect(recipes).toHaveLength(1)
    expect(Object.values(aliases)).toEqual([recipes[0].id])
  })

  it('sends the plan days to the one that survived', () => {
    const { plans, recipes } = buildLibrary([
      plan(['lunch', '140 g somon, 200 g legume la cuptor , 40 g sos de usrutoi']),
      plan(['lunch', '140 g somon, 200 g legume la cuptor , 40 g sos de usturoi']),
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
      plan(['lunch', '140 g somon, 200 g legume la cuptor , 40 g sos de usrutoi']),
      plan(['lunch', '140 g somon, 200 g legume la cuptor , 40 g sos de usturoi']),
    ])

    // The stray space before the comma goes, and both spellings stay,
    // including the typed-in-a-hurry one. Whitespace is not wording.
    expect(plans.map((p) => p.days[0].meals[0].text)).toEqual([
      '140 g somon, 200 g legume la cuptor, 40 g sos de usrutoi',
      '140 g somon, 200 g legume la cuptor, 40 g sos de usturoi',
    ])
  })

  it('tidies the typing without touching a word, a number or a unit', () => {
    // Documents typed by a person over months of weeks carry what
    // that always carries. The app shows these verbatim under "How your
    // dietician wrote it", so they are read, and they read as broken.
    const { plans } = buildLibrary([
      plan(['lunch', ': 320 g ciorba de fasole verde ( o lingurita de ulei ),  30 g paine int ']),
    ])

    expect(plans[0].days[0].meals[0].text)
      .toBe('320 g ciorba de fasole verde (o lingurita de ulei), 30 g paine int')
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
  it('never settles for a bare number, and leaves no two the same', () => {
    const built = titles([
      plan(['breakfast', '170 g iaurt , 30 g fulgi de ovaz, 90 g fructe de padure']),
      plan(['breakfast', '170 g iaurt , 45 g fulgi de ovaz, 90 g fructe de padure']),
    ])

    expect(built.some(([, portion]) => /^\d+$/.test(portion ?? ''))).toBe(false)
    expect(new Set(built.map((t) => t.join('\u0000'))).size).toBe(built.length)
  })

  it('says the weight that differs beside the name, not inside it', () => {
    const built = titles([
      plan(['breakfast', '170 g iaurt , 30 g fulgi de ovaz, 90 g fructe de padure']),
      plan(['breakfast', '170 g iaurt , 45 g fulgi de ovaz, 90 g fructe de padure']),
    ])

    expect(built).toContainEqual(['Rolled oats with yogurt & mixed berries', '30 g rolled oats'])
    expect(built).toContainEqual(['Rolled oats with yogurt & mixed berries', '45 g rolled oats'])
  })

  it('leaves the quantity out of every name it writes', () => {
    // The whole point of holding the portion in its own field. A weight in the
    // name made "Grapefruit with cashews (15 g cashews, 200 g grapefruit)" a
    // headline three lines deep on a phone, and left every screen that wanted
    // the dish stripping the bracket back off with a regular expression.
    for (const [name] of titles(A_WEEK)) {
      expect(name).not.toMatch(/\(/)
    }
  })

  it('folds an ingredient one of them has into its name', () => {
    const built = names([
      plan(['dinner', 'salata de cruditati, 60 g feta, 20 g orez expandat']),
      plan(['dinner', 'salata de cruditati, 60 g feta, o lingurita de ulei de masline, 20 g orez expandat']),
    ])

    expect(built).toContain('Feta with puffed rice cakes & raw vegetable salad')
    expect(built).toContain('Feta with puffed rice cakes, raw vegetable salad & extra virgin olive oil')
  })

  it('does not let a meal shadow the dish it is named after', () => {
    // Same name as the hand-written dish, which is right: it is that soup.
    // What stops them being the same card is the portion beside it.
    const built = titles([plan(['dinner', '250 gombakremleves (1 tk. olivaolaj)'])])

    expect(built).toEqual([['Cream of mushroom soup', '250 g']])
    expect(DISHES.map((d) => d.name.en)).toContain('Cream of mushroom soup')
  })

  it('would rather name an ingredient than a pinch of seasoning', () => {
    const built = titles([
      plan(['lunch', 'mini pizza de vinete: ½ vinete , o lingurita de ulei, rosii, 70 g mozzarella in apa , busuioc + 55 g bulgur nefiert']),
      plan(['lunch', 'mini pizza de vinete: ½ vinete , o lingurita de ulei, rosii, 65 g mozzarella in apa + 35 g bulgur nefiert']),
    ])

    // One of these has a few leaves of basil and the other does not, but they
    // also carry 55 g and 35 g of bulgur, which is the difference worth saying.
    expect(built.some(([name, portion]) => /basil/i.test(`${name} ${portion ?? ''}`))).toBe(false)
    expect(built).toContainEqual(['Eggplant mini pizzas with bulgur & tomatoes', '55 g bulgur'])
    expect(built).toContainEqual(['Eggplant mini pizzas with bulgur & tomatoes', '35 g bulgur'])
  })
})

describe('a whole day', () => {
  it("costs a day what the dietician's own numbers cost", () => {
    // A day of these plans is a little over a thousand calories by design. The
    // double counting had pushed the average up by about a tenth.
    const { plans, recipes, aliases } = buildLibrary(A_WEEK)
    const ctx = buildContext(FOODS, [...DISHES, ...recipes], aliases)
    const day = plans[0].days[0].meals
      .reduce((sum, m) => sum + componentsNutrients(m.entries, ctx).calories, 0)

    expect(day).toBeGreaterThan(800)
    expect(day).toBeLessThan(1600)
  })
})

/** A made-up day, written the way hers are. */
const A_WEEK: PlanInput[] = [plan(
  ['breakfast', '40 g paine int, pasta de branza ( 90 g branza de vaci, 1 lg de iaurt, ceapa), castraveti'],
  ['snack', '180 g capsuni'],
  ['lunch', 'tigaie picanta: 100 g piept de pui, 320 g legume , o lingurita de ulei'],
  ['snack', '200 g grapefruit'],
  ['dinner', CABBAGE_SOUP],
)]

describe('a seasoning is worth naming when nothing else differs', () => {
  it('says which porridge has the vanilla in it', () => {
    const built = names([
      plan(['breakfast', 'terci de ovaz cu mere: 120 ml lapte, 80 ml apa, 120 g mere, 35 g fulgi de ovaz, scortisoara']),
      plan(['breakfast', 'terci de ovaz cu mar razuit: 100 ml lapte, 100 ml apa, 90 g mar razuit, scortisoara, esenta de vanilie']),
    ])

    // The first of these is a plain porridge with apples added to it and keeps
    // that name; the second is the apple porridge dish plus vanilla, and says
    // so. They stopped being one recipe when the colon began separating a
    // dish's name from its contents, which let the first line match the plain
    // porridge it actually names.
    expect(built).toEqual([
      'Oat porridge with apple',
      'Apple & cinnamon porridge with vanilla extract',
    ])
  })
})

describe('what a meal takes, and how often it was made', () => {
  it('gives every imported meal a time', () => {
    // The plans are portions, not methods: not one of their lines says how
    // long anything takes, so all 157 recipes used to arrive at zero and
    // "Quick tonight" could only ever see the hand-written dishes.
    const { recipes } = buildLibrary(A_WEEK)

    expect(recipes.length).toBeGreaterThan(0)
    expect(recipes.every((r) => r.prepMinutes > 0)).toBe(true)
  })

  it('takes its cooking from the dish it contains, not from the estimate', () => {
    const { recipes } = buildLibrary([plan(['dinner', CABBAGE_SOUP])])
    const soup = DISHES.find((d) => d.id === 'dish-ciorba-cabbage')!

    expect(recipes[0].cookMinutes).toBe(soup.cookMinutes)
  })

  it('counts the dish inside a meal every time the meal is eaten', () => {
    const { timesPlanned } = buildLibrary([plan(
      ['dinner', CABBAGE_SOUP],
      ['lunch', '320 g ciorba de varza , 40 g paine int'],
    )])

    // Two different meals, one pot of soup, which is exactly the thing worth
    // knowing when you are deciding what to cook a lot of.
    expect(timesPlanned['dish-ciorba-cabbage']).toBe(2)
  })
})
