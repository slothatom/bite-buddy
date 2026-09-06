import { fragmentsOf, type RawFragment } from './plans.js'
import { FOODS } from '../../src/data/foods.js'
import { DISHES, DISH_ALIASES, DISH_BY_WEIGHT } from '../../src/data/dishes.js'
import { buildFoodIndex, resolveFood } from '../../src/lib/foodSearch.js'
import { normaliseTerm } from '../../src/lib/units.js'
import { buildContext, componentsNutrients } from '../../src/lib/nutrition.js'
import { categorise } from '../../src/lib/classify.js'
import { deriveTimes } from '../../src/lib/cookingTimes.js'
import type { RecipeComponent, MealSlot, Recipe, RecipeTag, SourcePlan } from '../../src/types/index.js'

/**
 * Turns the dietician's meal lines into the recipe library.
 *
 * Kept apart from `build-data.ts` because there are two ways in. Normally the
 * .docx originals are read and every line comes from them; but the archive
 * stores each line verbatim, so the whole library can equally be rebuilt from
 * `sourcePlans.ts`, which is what happens on a machine without the source
 * documents. Both must produce the same file, byte for byte, so the work
 * lives here and both callers hand it the same shape.
 */

const foodIndex = buildFoodIndex(FOODS)
const dishById = new Map(DISHES.map((d) => [d.id, d]))
const ctx = buildContext(FOODS, DISHES)

/** Grams the dish weighs per serving, used to convert "350 g ciorba" into servings. */
const dishGramsPerServing = new Map<string, number>()
for (const dish of DISHES) {
  const grams = dish.components.reduce((sum, c) => sum + (c.kind === 'food' ? c.grams : 0), 0)
  dishGramsPerServing.set(dish.id, grams / Math.max(1, dish.servings))
}

// Longest alias first, so "budinca de chia cu mango" beats "budinca de chia".
const dishAliases = [...DISH_ALIASES]
  .map((a) => ({ ...a, key: normaliseTerm(a.alias) }))
  .filter((a) => a.key.length >= 4)
  .sort((a, b) => b.key.length - a.key.length)

function resolveDish(term: string): string | undefined {
  const n = normaliseTerm(term)
  if (!n) return undefined
  for (const a of dishAliases) {
    if (n === a.key || n.includes(a.key)) return a.recipeId
  }
  return undefined
}

/** A fragment with no stated weight still needs a sensible portion. */
function defaultGrams(foodId: string): number {
  const food = foodIndex.all.find((f) => f.id === foodId)
  if (!food) return 0
  if (food.units.length) return food.units[0].grams
  // Seasonings and aromatics are garnish quantities, not portions.
  if (food.category === 'herbs-spices') return 3
  if (food.category === 'fats-vinegars') return 5
  return 100
}

export interface Unresolved { term: string; raw: string; slot: MealSlot; file: string }

/**
 * A component, and whether the plan actually stated its weight.
 *
 * The difference decides what happens when a dish in the same meal already
 * supplies that food: a weight the dietician wrote is worth honouring, a
 * default this script invented is not.
 */
interface Stated { component: RecipeComponent; stated: boolean }

/**
 * "300 gombakremleves" is 300 grams of mushroom soup.
 *
 * One line lost its "g" and so stated no weight at all, which made a 300 g
 * bowl import as the whole two-serving pot. A bare number in front of a dish
 * that the plans portion by weight is grams; in front of anything else it is
 * a count of something ("2 oua") and is left alone.
 */
function statedGrams(f: RawFragment, dishId: string): number | undefined {
  if (f.grams) return f.grams
  if (!DISH_BY_WEIGHT.has(dishId)) return undefined
  const bare = /^(\d{2,4})\s+\S/.exec(f.term)
  return bare ? Number(bare[1]) : undefined
}

function toComponents(f: RawFragment, slot: MealSlot, file: string, unresolved: Unresolved[]): Stated[] {
  if (!f.normalised) return []

  const dishId = resolveDish(f.term)
  if (dishId) {
    const perServing = dishGramsPerServing.get(dishId) ?? 0
    const grams = statedGrams(f, dishId)
    // "350 g ciorba a la grec" is a portion of the soup, so it scales. But
    // "tigaie picanta: 100 g piept de pui" states an ingredient weight, and
    // scaling by it would shrink the meal to a third of its real size.
    const scalable = DISH_BY_WEIGHT.has(dishId) && grams && perServing > 0
    const servings = scalable ? Math.round((grams! / perServing) * 100) / 100 : 1
    const out: Stated[] = [{
      component: { kind: 'recipe', recipeId: dishId, servings: Math.max(0.1, servings) },
      stated: Boolean(grams),
    }]

    // The parenthetical sometimes names extras the dish definition lacks -
    // "cartofi cu ou (…, sos: 100 g iaurt, 50 g telemea)". Add only what the
    // dish does not already contain, so nothing is counted twice.
    const already = new Set(
      (dishById.get(dishId)?.components ?? [])
        .filter((c): c is Extract<RecipeComponent, { kind: 'food' }> => c.kind === 'food')
        .map((c) => c.foodId),
    )
    for (const inner of f.innerFragments) {
      if (!inner.normalised || !inner.grams) continue
      const food = resolveFood(inner.term, foodIndex)
      if (!food || already.has(food.id)) continue
      already.add(food.id)
      out.push({ component: { kind: 'food', foodId: food.id, grams: inner.grams }, stated: true })
    }
    return out
  }

  const food = resolveFood(f.term, foodIndex)
  if (food) {
    return [{
      component: { kind: 'food', foodId: food.id, grams: f.grams ?? defaultGrams(food.id) },
      stated: f.grams != null,
    }]
  }

  unresolved.push({ term: f.normalised, raw: f.raw, slot, file })
  return []
}

/** Grams of each food a meal's dishes already bring with them. */
function suppliedByDishes(items: Stated[]): Map<string, number> {
  const supplied = new Map<string, number>()
  for (const { component } of items) {
    if (component.kind !== 'recipe') continue
    const dish = dishById.get(component.recipeId)
    if (!dish) continue
    const scale = component.servings / Math.max(1, dish.servings)
    for (const part of dish.components) {
      if (part.kind !== 'food') continue
      supplied.set(part.foodId, (supplied.get(part.foodId) ?? 0) + part.grams * scale)
    }
  }
  return supplied
}

/**
 * Removes food a dish in the same meal already contains.
 *
 * "bruschete cu telemea: 50 g telemea, 50 g paine int, rosii, usturoi,
 * busuioc, ulei" names the dish and then lists what is in it. Read literally
 * that is a bruschetta plus a second helping of everything on it, which is how
 * 45 of the imported meals came to carry between 20 and 271 kcal of food
 * nobody ate.
 *
 * A weight the dietician stated is honoured rather than discarded: where she
 * asked for more than the dish definition assumes, the difference is kept, so
 * "salata cezar … salata de cruditati" at 200 g against a definition of 150 g
 * still gets its extra 50 g. A weight this script defaulted carries no such
 * authority and simply goes.
 */
function withoutDishDuplicates(items: Stated[]): RecipeComponent[] {
  const supplied = suppliedByDishes(items)
  const out: RecipeComponent[] = []
  for (const { component, stated } of items) {
    if (component.kind !== 'food') { out.push(component); continue }
    const already = supplied.get(component.foodId)
    if (already == null) { out.push(component); continue }
    if (!stated) continue
    const extra = Math.round(component.grams - already)
    // Under 5 g is inside the rounding of "a teaspoon" and not worth a line.
    if (extra >= 5) out.push({ ...component, grams: extra })
  }
  return out
}

/**
 * The dietician's own line, with the typing tidied and the words left alone.
 *
 * These came out of fourteen .docx files typed by a person over fourteen
 * weeks, and they carry what that always carries: a stray colon at the start
 * of a line, a space before a comma, a space inside a bracket, the occasional
 * double space. The app shows these verbatim under "How your dietician wrote
 * it", so they are read, and they read as broken.
 *
 * Only whitespace and stray leading punctuation. Nothing here changes a word,
 * a number or a unit, because this text is evidence rather than prose: it is
 * the thing you check the app's arithmetic against.
 */
function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+([,;.!?])/g, '$1')
    .replace(/^[\s:;,.]+/, '')
    .trim()
}

// ─── Naming ───────────────────────────────────────────────────────────────────

const SLOT_TAG: Record<MealSlot, RecipeTag> = {
  breakfast: 'breakfast', snack: 'snack', lunch: 'lunch', dinner: 'dinner',
}

function labelFor(c: RecipeComponent): string {
  const raw = c.kind === 'recipe'
    ? dishById.get(c.recipeId)?.name.en ?? 'Dish'
    : foodIndex.all.find((f) => f.id === c.foodId)?.names.en ?? 'Food'
  // "Red kidney beans, cooked" is right in the food library but reads badly
  // inside a meal name, as does a parenthetical gloss.
  return raw.replace(/,\s*(cooked|dry|raw)\b/i, '').replace(/\s*\([^)]*\)/, '').trim()
}

/** Place names and personal names stay capitalised mid-sentence. */
const PROPER = /^(Telemea|Greek|Caesar|Tabbouleh|Mediterranean|Swiss)\b/

function lower(s: string): string {
  if (PROPER.test(s)) return s
  return s.charAt(0).toLowerCase() + s.slice(1)
}

function joinName(parts: string[]): string {
  const [head, ...rest] = parts
  if (!rest.length) return head
  // A dish whose own name contains "with" would otherwise read
  // "Lentils with spinach with halloumi".
  const join = /\bwith\b/i.test(head) ? ',' : ' with'
  const tail = rest.map(lower)
  const last = tail.pop()!
  return tail.length ? `${head}${join} ${tail.join(', ')} & ${last}` : `${head}${join} ${last}`
}

function componentKey(c: RecipeComponent): string {
  return c.kind === 'recipe' ? c.recipeId : c.foodId
}

/**
 * Names a meal after what dominates it.
 *
 * Components are ranked by calorie contribution, with prepared dishes promoted
 * above raw ingredients, "Lentils with spinach & wholemeal bread" reads better
 * than "Wholemeal bread with lentils", even when the bread carries more calories.
 *
 * `pinned` names a component that has to appear whatever it weighs. That is
 * how two meals that differ only by a spoonful of yogurt end up with two
 * names, rather than one name and a number in brackets.
 */
/**
 * What decides which ingredient a meal is named after.
 *
 * Calories, for a plate of food: the thing carrying the meal is the thing the
 * meal is called after, and 125 g of salmon beats 200 g of sweet potato.
 *
 * Weight, for a snack, because there the two come out the other way round.
 * 150 g of apple is 78 kcal and 15 g of cashews is 87, so ranking a snack by
 * calories produced "Cashews with apple" and, on the next line of the same
 * plan, "Apple with walnuts". Nobody calls a piece of fruit with a few nuts on
 * it after the nuts. A snack is named after what there is most of.
 */
type Ranking = 'calories' | 'weight'

/** A dish outranks any single food, whichever way round the ranking runs. */
function weightOf(c: RecipeComponent): number {
  return c.kind === 'food' ? c.grams : 1000 * c.servings
}

function nameMeal(components: RecipeComponent[], pinned?: string, by: Ranking = 'calories'): string {
  // Anything already inside a dish in this meal must not also appear in the
  // name: "Apple & cinnamon porridge with apple" reads as a mistake, because
  // it is one.
  const insideADish = new Set<string>()
  for (const c of components) {
    if (c.kind !== 'recipe') continue
    for (const part of dishById.get(c.recipeId)?.components ?? []) {
      if (part.kind === 'food') insideADish.add(part.foodId)
    }
  }

  const ranked = components
    .filter((c) => {
      if (c.kind !== 'food') return true
      if (c.foodId === pinned) return true
      if (insideADish.has(c.foodId)) return false
      // Seasonings are never what a meal is called after, however
      // calorie-dense they are per 100 g.
      const category = foodIndex.all.find((f) => f.id === c.foodId)?.category
      return category !== 'herbs-spices'
    })
    .map((c) => ({
      c,
      label: labelFor(c),
      kcal: componentsNutrients([c], ctx).calories + (c.kind === 'recipe' ? 400 : 0),
      rank: by === 'weight'
        ? weightOf(c)
        : componentsNutrients([c], ctx).calories + (c.kind === 'recipe' ? 400 : 0),
    }))
    // Still on calories: something with none of them has nothing to say about
    // what the meal is, however much of it there is.
    .filter((r) => r.kcal > 0 || componentKey(r.c) === pinned)
    .sort((a, b) => b.rank - a.rank)

  if (!ranked.length) return 'Meal'

  const seen = new Set<string>()
  const parts: string[] = []
  for (const r of ranked) {
    if (componentKey(r.c) === pinned) continue
    if (seen.has(r.label)) continue
    seen.add(r.label)
    parts.push(r.label)
    if (parts.length === 3) break
  }

  // The distinguishing ingredient goes last, where the eye lands on the
  // difference rather than having to read two long names side by side.
  const pin = ranked.find((r) => componentKey(r.c) === pinned)
  if (pin && !seen.has(pin.label)) parts.push(pin.label)

  return parts.length ? joinName(parts) : 'Meal'
}

function emojiFor(components: RecipeComponent[], slot: MealSlot): string {
  for (const c of components) {
    if (c.kind === 'recipe') {
      const e = dishById.get(c.recipeId)?.emoji
      if (e) return e
    }
  }
  // Both snack slots get the same face. They are the same kind of thing, and
  // the two were giving one apple-and-cashews a red apple and the next a green
  // one purely by which slot of the day it had been written in.
  return { breakfast: '🌅', snack: '🍎', lunch: '🍽️', dinner: '🌙' }[slot]
}

// ─── Merging ──────────────────────────────────────────────────────────────────

/** What a recipe is made of, as a string, so two of them can be compared. */
export function componentSignature(components: RecipeComponent[]): string {
  return [...components]
    .map((c) => c.kind === 'food' ? `f:${c.foodId}:${c.grams}` : `r:${c.recipeId}:${c.servings}`)
    .sort()
    .join('|')
}

// ─── Distinguishing ───────────────────────────────────────────────────────────

/**
 * How much of each food a meal comes to, counting what its dishes bring.
 *
 * Comparing whole meals rather than the lines they were typed from is what
 * makes a difference worth naming: one spicy pan has 300 g of vegetables and
 * the other 250 g, whoever wrote which number where.
 */
function amounts(components: RecipeComponent[]): Map<string, number> {
  const out = new Map(suppliedByDishes(components.map((component) => ({ component, stated: true }))))
  for (const c of components) {
    if (c.kind === 'food') out.set(c.foodId, (out.get(c.foodId) ?? 0) + c.grams)
    else out.set(c.recipeId, (dishGramsPerServing.get(c.recipeId) ?? 0) * c.servings)
  }
  return out
}

/** The same quantity as a component, so its calories can be worked out. */
function asComponent(key: string, grams: number): RecipeComponent | undefined {
  if (!grams) return undefined
  if (dishById.has(key)) {
    const perServing = dishGramsPerServing.get(key) ?? 0
    return perServing > 0 ? { kind: 'recipe', recipeId: key, servings: grams / perServing } : undefined
  }
  return { kind: 'food', foodId: key, grams }
}

interface Difference { key: string; swing: number; seasoning: boolean; absent: boolean }

/**
 * Ranks what differs across a set of same-named recipes.
 *
 * Highest calorie swing first, because that is the difference worth knowing
 * about. Seasonings sink to the bottom: a meal should not be named after three
 * grams of basil while fifty grams of bulgur goes unmentioned, though vanilla
 * will do when it is genuinely the only thing that differs.
 */
function differences(totals: Map<string, number>[]): Difference[] {
  const keys = new Set<string>()
  for (const t of totals) for (const key of t.keys()) keys.add(key)

  const out: Difference[] = []
  for (const key of keys) {
    const grams = totals.map((t) => Math.round(t.get(key) ?? 0))
    if (new Set(grams).size < 2) continue
    const kcals = grams.map((g) => {
      const c = asComponent(key, g)
      return c ? componentsNutrients([c], ctx).calories : 0
    })
    const food = foodIndex.all.find((f) => f.id === key)
    out.push({
      key,
      swing: Math.max(...kcals) - Math.min(...kcals),
      seasoning: food?.category === 'herbs-spices' || key === 'water',
      absent: grams.some((g) => g === 0),
    })
  }
  return out.sort((a, b) => Number(a.seasoning) - Number(b.seasoning) || b.swing - a.swing)
}

/**
 * Weights read the way the plans write them.
 *
 * A portion of soup arrives here as 298 g, because the servings it was
 * converted to were rounded on the way in. The dietician wrote 300, and a name
 * is not the place to show the arithmetic.
 */
function round(grams: number): number {
  return grams >= 100 ? Math.round(grams / 5) * 5 : Math.round(grams)
}

function amountLabel(key: string, amount: number, base: string): string {
  const grams = round(amount)
  const sample = asComponent(key, grams || 1)
  const name = sample ? labelFor(sample) : key
  // "Cream of mushroom soup (300 g cream of mushroom soup)" says it twice. When
  // the meal is that dish and nothing else, the weight alone is the difference.
  if (name === base) return `${grams} g`
  return grams > 0 ? `${grams} g ${lower(name)}` : `no ${lower(name)}`
}

/**
 * Gives every recipe something of its own, saying what makes it that one.
 *
 * Two rules, in order, and they put their answers in two different places.
 * Where some of them have an ingredient the others lack, that is a different
 * dish and the ingredient joins their *names*: "Feta with puffed rice cakes,
 * raw vegetable salad & extra virgin olive oil". Whatever that leaves sharing
 * a name is the same dish at a different portion, so it keeps the name and
 * gets a *variant* instead, naming the ingredient whose difference matters
 * most: "45 g rolled oats".
 *
 * The variant used to be appended to the name in brackets, which is what put
 * "Grapefruit with cashews (10 g cashews, 250 g grapefruit)" on a card as a
 * headline. Kept apart, the shelf can show one card per dish with the portions
 * inside it, which is what the library already wanted to do and was undoing
 * with a regular expression.
 *
 * A bare number tells the reader nothing and is never used. If two recipes
 * cannot be told apart by these rules they are the same recipe, and the merge
 * above will already have folded them together.
 */
function distinguish(recipes: Recipe[], dishes: Recipe[]): void {
  const reserved = new Map(dishes.map((d) => [d.name.en, d]))
  for (const group of clashes(recipes, reserved)) separate(group, reserved)
}

function clashes(recipes: Recipe[], reserved: Map<string, Recipe>): Recipe[][] {
  const groups = new Map<string, Recipe[]>()
  for (const r of recipes) {
    const list = groups.get(r.name.en) ?? []
    list.push(r)
    groups.set(r.name.en, list)
  }
  return [...groups.values()].filter((g) => g.length > 1 || reserved.has(g[0].name.en))
}

/**
 * A recipe under consideration, and what it comes to.
 *
 * A dish of the same name joins the comparison without a recipe attached: the
 * dish library is written by hand and keeps its name, but a meal that clashes
 * with it still has to say how it differs.
 */
interface Variant { recipe?: Recipe; totals: Map<string, number> }

function variantsOf(group: Recipe[], reserved: Map<string, Recipe>): Variant[] {
  const out: Variant[] = group.map((recipe) => ({ recipe, totals: amounts(recipe.components) }))
  const dish = reserved.get(group[0].name.en)
  if (dish) {
    out.push({ totals: amounts([{ kind: 'recipe', recipeId: dish.id, servings: 1 }]) })
  }
  return out
}

/** Read back off the recipe, for the passes that rename after the fact. */
function rankingFor(recipe: Recipe): Ranking {
  return recipe.tags.includes('snack') ? 'weight' : 'calories'
}

function separate(group: Recipe[], reserved: Map<string, Recipe>): void {
  const variants = variantsOf(group, reserved)
  const ranked = differences(variants.map((v) => v.totals))
  if (!ranked.length) return

  // Only the difference that matters most: naming a meal after the three grams
  // of basil one of them has, while fifty grams of bulgur goes unsaid, is worse
  // than saying nothing.
  const absentee = ranked[0].absent ? ranked[0] : undefined
  const has = absentee
    ? variants.filter((v) => v.recipe && (v.totals.get(absentee.key) ?? 0) > 0)
    : []
  if (absentee && has.length && has.length < variants.length) {
    for (const v of has) {
      v.recipe!.name.en = nameMeal(v.recipe!.components, absentee.key, rankingFor(v.recipe!))
    }
    // Naming the ingredient may still leave two recipes that both lack it
    // sharing a name. Those fall through to the weights.
    for (const sub of clashes(group, reserved)) qualify(sub, reserved)
    return
  }

  qualify(group, reserved)
}

/**
 * Gives each one the weight that tells these recipes apart.
 *
 * One ingredient is nearly always enough. A second is added only when the
 * first leaves two of them still identical, and no more than that: this is for
 * recognising a portion, not for reciting it.
 */
function qualify(group: Recipe[], reserved: Map<string, Recipe>): void {
  if (settled(group, reserved)) return
  const base = group[0].name.en
  const variants = variantsOf(group, reserved)
  const chosen: Difference[] = []

  for (const d of differences(variants.map((v) => v.totals))) {
    chosen.push(d)
    for (const v of variants) {
      if (!v.recipe) continue
      const said = chosen.map((c) => amountLabel(c.key, Math.round(v.totals.get(c.key) ?? 0), base))
      v.recipe.variant = said.join(', ')
    }
    if (settled(group, reserved) || chosen.length === 2) return
  }
}

/**
 * Whether these are all telling themselves apart yet.
 *
 * Name and variant together, because that pair is what the library shows: one
 * card per name, and the variants inside it. A hand-written dish of the same
 * name counts as holding that name with no variant, so a generated meal that
 * clashes with one still has to say which portion it is.
 */
function settled(group: Recipe[], reserved: Map<string, Recipe>): boolean {
  const seen = new Set<string>()
  const dish = reserved.get(group[0].name.en)
  if (dish) seen.add(`${dish.name.en}\u0000`)

  for (const r of group) {
    const key = `${r.name.en}\u0000${r.variant ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
  }
  return true
}

// ─── Build ────────────────────────────────────────────────────────────────────

export interface PlanInput {
  id: string
  file: string
  label: string
  language: SourcePlan['language']
  issuedOn?: string
  subject: SourcePlan['subject']
  days: { dayName: string; weekday: number; meals: { slot: MealSlot; text: string }[] }[]
}

export interface Library {
  plans: SourcePlan[]
  recipes: Recipe[]
  /** Merged-away recipe id → the recipe it became, so old plans still resolve. */
  aliases: Record<string, string>
  /** Recipe or dish id → how many meals across the fourteen weeks it feeds. */
  timesPlanned: Record<string, number>
  unresolved: Unresolved[]
  lineCount: number
  mappedLines: number
}

export function buildLibrary(plans: PlanInput[]): Library {
  const unresolved: Unresolved[] = []
  const byText = new Map<string, Recipe>()
  const recipes: Recipe[] = []
  let lineCount = 0
  let mappedLines = 0

  const sourcePlans: SourcePlan[] = plans.map((plan) => ({
    id: plan.id,
    file: plan.file,
    label: plan.label,
    language: plan.language,
    issuedOn: plan.issuedOn,
    subject: plan.subject,
    days: plan.days.map((day) => ({
      dayName: day.dayName,
      weekday: day.weekday,
      meals: day.meals.map((raw) => {
        lineCount++
        const meal = { ...raw, text: tidy(raw.text) }
        const items = fragmentsOf(meal.text)
          .flatMap((f) => toComponents(f, meal.slot, plan.file, unresolved))
        const entries = withoutDishDuplicates(items)
        if (entries.length) mappedLines++

        /**
         * Which lines become a named recipe.
         *
         * Every main meal, and a snack that is more than one thing. The snack
         * shelf was permanently empty because snacks were kept as plain food
         * entries wholesale, and the tag that would have filled it sat
         * unreachable, so the app offered four shelves and could only ever
         * stock three.
         *
         * But not every snack. 152 of the 194 in these plans are one food and
         * a weight, "150 g mere", and turning those into recipes would mirror
         * the food library onto the recipe shelf: a card called "Apple" that
         * you would never open and never cook. The other 42 pair a fruit with
         * a handful of nuts, which is a thing somebody assembles and worth a
         * card you can favourite and plan.
         */
        const isMain = meal.slot === 'breakfast' || meal.slot === 'lunch' || meal.slot === 'dinner'
        const worthNaming = isMain || entries.length > 1
        if (!worthNaming || !entries.length) return { slot: meal.slot, text: meal.text, entries }

        const key = `${meal.slot}::${normaliseTerm(meal.text)}`
        let recipe = byText.get(key)
        if (!recipe) {
          recipe = {
            id: `meal-${meal.slot}-${String(recipes.length + 1).padStart(3, '0')}`,
            name: { en: nameMeal(entries, undefined, meal.slot === 'snack' ? 'weight' : 'calories') },
            emoji: emojiFor(entries, meal.slot),
            servings: 1,
            prepMinutes: 0,
            cookMinutes: 0,
            components: entries,
            steps: [],
            tags: [SLOT_TAG[meal.slot]],
            sourceLine: meal.text,
            sourcePlanId: plan.id,
            createdAt: plan.issuedOn ? `${plan.issuedOn}T00:00:00.000Z` : '2022-01-01T00:00:00.000Z',
          }
          byText.set(key, recipe)
          recipes.push(recipe)
        }

        return {
          slot: meal.slot,
          text: meal.text,
          entries: [{ kind: 'recipe' as const, recipeId: recipe.id, servings: 1 }],
        }
      }),
    })),
  }))

  // Two lines that reduce to the same ingredients in the same amounts are the
  // same recipe, however differently they were typed: "sos de usrutoi" one
  // Tuesday and "sos de usturoi" the next. The first occurrence survives and
  // the rest become aliases, so nothing that already names them breaks.
  const aliases: Record<string, string> = {}
  const bySignature = new Map<string, Recipe>()
  const kept: Recipe[] = []
  for (const recipe of recipes) {
    /*
     * "1 portie de fulgi de ovaz la cuptor" is the baked oats in the dish
     * library, not a second recipe that happens to contain it. A meal that is
     * exactly one serving of one dish becomes that dish.
     *
     * Exactly one, and not half a pot. Two meals here are 300 g of a soup the
     * dish library already holds, which is 0.51 and 0.62 of a serving, and
     * folding those would mean the alias carrying a multiplier as well as an
     * id. The aliases are also what makes a day you planned months ago still
     * resolve, and they are read as a plain id → id map by everything that
     * resolves one; a scale threaded through there would silently restate an
     * old meal as twice the soup it was. They keep their own recipe, and the
     * variant says which portion.
     */
    const only = recipe.components.length === 1 ? recipe.components[0] : undefined
    if (only?.kind === 'recipe' && only.servings === 1 && dishById.has(only.recipeId)) {
      aliases[recipe.id] = only.recipeId
      continue
    }

    const signature = componentSignature(recipe.components)
    const first = bySignature.get(signature)
    if (!first) {
      bySignature.set(signature, recipe)
      kept.push(recipe)
      continue
    }
    aliases[recipe.id] = first.id
    for (const tag of recipe.tags) if (!first.tags.includes(tag)) first.tags.push(tag)
  }

  for (const plan of sourcePlans) {
    for (const day of plan.days) {
      for (const meal of day.meals) {
        meal.entries = meal.entries.map((e) =>
          e.kind === 'recipe' && aliases[e.recipeId]
            ? { ...e, recipeId: aliases[e.recipeId] }
            : e)
      }
    }
  }

  // Dish names are spoken for: a generated meal called "Cream of mushroom
  // soup" would otherwise shadow the dish of that name in every search.
  distinguish(kept, DISHES)

  // Times last, because the category is read partly off the name and the names
  // are only final now.
  const whole = buildContext(FOODS, [...DISHES, ...kept], aliases)
  for (const recipe of kept) {
    Object.assign(recipe, deriveTimes(recipe, whole, categorise(recipe, whole)))
  }

  return {
    plans: sourcePlans,
    recipes: kept,
    aliases,
    timesPlanned: countUses(sourcePlans, whole),
    unresolved,
    lineCount,
    mappedLines,
  }
}

/**
 * How many of the 481 meals each recipe feeds.
 *
 * Counted through the meals as well as directly: nobody cooks a batch of
 * "Roasted vegetables with salmon", but the tray of roasted vegetables inside
 * it turns up in seven of them, and that is the number worth knowing when you
 * are deciding what to make a lot of on Sunday.
 */
function countUses(plans: SourcePlan[], ctx: ReturnType<typeof buildContext>): Record<string, number> {
  const used = new Map<string, number>()
  const add = (id: string, n: number) => used.set(id, (used.get(id) ?? 0) + n)

  for (const plan of plans) {
    for (const day of plan.days) {
      for (const meal of day.meals) {
        for (const entry of meal.entries) {
          if (entry.kind !== 'recipe') continue
          add(entry.recipeId, 1)
          for (const part of ctx.recipes.get(entry.recipeId)?.components ?? []) {
            if (part.kind === 'recipe') add(part.recipeId, 1)
          }
        }
      }
    }
  }

  return Object.fromEntries([...used].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
}

// ─── Emitting ─────────────────────────────────────────────────────────────────

const BANNER = `// Generated by scripts/build-data.ts, do not edit by hand.
// Source: the 14 dietician plan documents. Re-run the script to regenerate.
`

/**
 * The generated files, as text.
 *
 * `build-data.ts` writes these and `check-data.ts` compares them against what
 * is committed, so a change to a dish definition or an import rule cannot be
 * merged without the data that follows from it.
 */
export function renderFiles(library: Library): Record<string, string> {
  return {
    'sourcePlans.ts':
      `${BANNER}import type { SourcePlan } from '../../types'\n\n` +
      `export const SOURCE_PLANS: SourcePlan[] = ${JSON.stringify(library.plans, null, 2)}\n`,

    'mealRecipes.ts':
      `${BANNER}import type { Recipe } from '../../types'\n\n` +
      `export const MEAL_RECIPES: Recipe[] = ${JSON.stringify(library.recipes, null, 2)}\n`,

    'recipeAliases.ts':
      `${BANNER}
/**
 * Recipes that turned out to be another recipe, and which one.
 *
 * Two plan lines can describe the same food in the same amounts and differ
 * only in wording or a typo. The library keeps one of them, and these entries
 * keep a day you planned against the other resolving.
 */
export const RECIPE_ALIASES: Record<string, string> = ${JSON.stringify(library.aliases, null, 2)}\n`,

    'reuse.ts':
      `${BANNER}
/**
 * How many of the fourteen weeks' meals each recipe feeds.
 *
 * Counted through the meals as well as directly, so the tray of roasted
 * vegetables inside seven different lunches is credited with all seven. This is
 * what "Worth a batch" reads: not a guess about whether something keeps, but
 * the record of the dietician cooking it again.
 */
export const TIMES_PLANNED: Record<string, number> = ${JSON.stringify(library.timesPlanned, null, 2)}\n`,
  }
}

/**
 * The archive's own words for a slot, brought up to date.
 *
 * The dietician writes a mid-morning and a mid-afternoon snack, and the app
 * carried both as numbered slots for as long as it read them that way. It has
 * one snack slot now, so both land in it, and an archive written before the
 * change still rebuilds into the shape the app holds today.
 */
function currentSlot(slot: string): MealSlot {
  return slot === 'snack1' || slot === 'snack2' ? 'snack' : slot as MealSlot
}

/** Rebuilds the library from the committed archive, for the drift check. */
export function rebuildFromArchive(plans: SourcePlan[]): Library {
  return buildLibrary(plans.map((plan) => ({
    id: plan.id,
    file: plan.file,
    label: plan.label,
    language: plan.language,
    issuedOn: plan.issuedOn,
    subject: plan.subject,
    days: plan.days.map((day) => ({
      dayName: day.dayName,
      weekday: day.weekday,
      meals: day.meals.map((meal) => ({ slot: currentSlot(meal.slot), text: meal.text })),
    })),
  })))
}
