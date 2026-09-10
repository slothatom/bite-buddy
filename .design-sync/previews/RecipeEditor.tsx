import type { ReactNode } from 'react'
import { RecipeEditor } from 'bite-buddy'

const nothing = () => {}

/*
 * Every cell here sits in a box with a height on it.
 *
 * The sheet is `position: fixed`, and the card wrapper each story renders into
 * carries a transform, which makes that wrapper the containing block rather
 * than the window. A cell whose only child is fixed is therefore 0px tall and
 * photographs flat, so the height is what gives the overlay something to fill.
 */
function Sheet({ children }: { children?: ReactNode }) {
  return <div style={{ height: 760 }}>{children}</div>
}

/** One of the shipped dishes, as the importer built it from a plan. */
const ciorba = {
  id: 'dish-ciorba-vegetable',
  name: { en: 'Vegetable sour soup', ro: 'ciorbă de legume' },
  emoji: '🍲',
  servings: 2,
  prepMinutes: 12,
  cookMinutes: 30,
  difficulty: 'easy',
  category: 'soup',
  quickFilters: ['meal-prep', 'cozy', 'freezer', 'one-pan'],
  components: [
    { kind: 'food', foodId: 'vegetables-mixed', grams: 400 },
    { kind: 'food', foodId: 'potato', grams: 100 },
    { kind: 'food', foodId: 'olive-oil', grams: 10 },
    { kind: 'food', foodId: 'water', grams: 600 },
  ],
  steps: [
    { id: 'step-1', instruction: 'Simmer all the vegetables until tender.', timerSeconds: 1800 },
    { id: 'step-2', instruction: 'Sour to taste and finish with olive oil.', timerSeconds: 0 },
  ],
  tags: ['soup', 'vegan', 'batch', 'lunch', 'dinner'],
  sourceLine: '350 g ciorbă de legume (o linguriță de ulei de măsline / porție)',
  sourcePlanId: 'plan-2026-05-ro',
  timesPlanned: 9,
  createdAt: '2026-05-04T09:00:00.000Z',
}

/** A breakfast lifted out of a plan, which therefore has no method written down. */
const porridge = {
  id: 'meal-oats-yogurt-berries-45',
  name: { en: 'Rolled oats with yogurt and berries', ro: 'fulgi de ovăz cu iaurt și fructe de pădure', hu: 'zabpehely joghurttal' },
  emoji: '🥣',
  servings: 1,
  prepMinutes: 5,
  cookMinutes: 0,
  category: 'porridge',
  quickFilters: ['quick', 'lazy', 'high-protein'],
  components: [
    { kind: 'food', foodId: 'oats', grams: 45 },
    { kind: 'food', foodId: 'yogurt', grams: 150 },
    { kind: 'food', foodId: 'berries-mixed', grams: 80 },
    { kind: 'food', foodId: 'walnuts', grams: 10 },
  ],
  steps: [],
  tags: ['breakfast'],
  variant: '45 g rolled oats',
  sourceLine: '45 g zabpehely + 150 g joghurt + erdei gyümölcs',
  sourcePlanId: 'plan-2026-03-hu',
  timesPlanned: 4,
  createdAt: '2026-03-16T06:30:00.000Z',
}

/**
 * Editing a recipe that came from the dietician.
 *
 * Everything is filled in and nothing here types a calorie: the figures at the
 * bottom are derived from the four weighed ingredients, the same derivation the
 * planner uses, so the recipe cannot disagree with its own totals.
 */
export function EditingAPlanRecipe() {
  return (
    <Sheet>
      <RecipeEditor recipe={ciorba} onClose={nothing} onSaved={nothing} />
    </Sheet>
  )
}

/**
 * Writing one from scratch.
 *
 * Worth looking at for how much of the sheet is empty and how it says so: no
 * meal times chosen, no category, an ingredient list that explains that the
 * numbers below fill themselves in, and Add recipe refused until it has a name.
 */
export function ANewOne() {
  return (
    <Sheet>
      <RecipeEditor recipe={null} onClose={nothing} onSaved={nothing} />
    </Sheet>
  )
}

/**
 * A breakfast the importer built from one line of a Hungarian plan.
 *
 * A different shape of recipe to the first cell: one serving rather than a
 * batch, a variant label carrying the portion that tells it apart from the
 * other rolled-oats mornings, and no steps at all, which the method section
 * says out loud rather than leaving as an empty box.
 */
export function NoMethodYet() {
  return (
    <Sheet>
      <RecipeEditor recipe={porridge} onClose={nothing} onSaved={nothing} />
    </Sheet>
  )
}
