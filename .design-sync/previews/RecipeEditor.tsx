import { useEffect, useRef, type ReactNode } from 'react'
import { RecipeEditor } from 'bite-buddy'

const nothing = () => {}

/*
 * Every cell here sits in a box with a height on it, and some of them start
 * part-way down the sheet.
 *
 * The height first: the sheet is `position: fixed`, and the card wrapper each
 * story renders into carries a transform, which makes that wrapper the
 * containing block rather than the window. A cell whose only child is fixed is
 * 0px tall and photographs flat.
 *
 * The scroll second: this editor is about two and a half screens long and the
 * card only ever shows the first one. `show` puts a named section at the top of
 * the panel's own scroller, which is what a finger does on the way to the
 * ingredients. Nothing else about the component is arranged.
 */
function Sheet({ children, show }: { children?: ReactNode; show?: string }) {
  const held = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!show) return
    const body = held.current?.querySelector<HTMLElement>('[role="dialog"] .overflow-y-auto')
    if (!body) return
    const heading = Array.from(body.querySelectorAll<HTMLElement>('p'))
      .find((el) => el.textContent?.trim() === show)
    if (!heading) return
    body.scrollTop += heading.getBoundingClientRect().top - body.getBoundingClientRect().top - 12
  }, [show])
  return <div ref={held} style={{ height: 760 }}>{children}</div>
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
 * The ingredients of a recipe that came from the dietician.
 *
 * Nothing in this editor types a calorie. Every line is a weighed food or
 * another recipe, each carrying what it costs, and the amount can be entered in
 * whatever unit suits while the recipe stores grams. Water is in the list
 * because the soup is sold by the bowl and the weight has to add up.
 */
export function EditingAPlanRecipe() {
  return (
    <Sheet show="What goes in">
      <RecipeEditor recipe={ciorba} onClose={nothing} onSaved={nothing} />
    </Sheet>
  )
}

/**
 * Writing one from scratch, at the top of the sheet.
 *
 * Worth looking at for how much is empty and how it says so: no meal times
 * chosen so it has fallen back to Dishes and explained what that means, no
 * category picked, and Add recipe refused until it has a name.
 */
export function ANewOne() {
  return (
    <Sheet>
      <RecipeEditor recipe={null} onClose={nothing} onSaved={nothing} />
    </Sheet>
  )
}

/**
 * The end of the same soup: what it comes to, and how to get rid of it.
 *
 * The per-serving figures are derived from the four ingredients above, by the
 * same code the planner uses, so a recipe cannot disagree with its own totals.
 * Delete sits under a border and away from Save changes because they are
 * different intentions.
 */
export function WhatItComesTo() {
  return (
    <Sheet show="Per serving">
      <RecipeEditor recipe={ciorba} onClose={nothing} onSaved={nothing} />
    </Sheet>
  )
}

/**
 * A breakfast the importer built from one line of a Hungarian plan, at the
 * method.
 *
 * It has ingredients and totals but has never had a method, because the plan
 * was a line of text rather than a recipe. The editor says that in words under
 * the empty step list instead of leaving a box nobody can explain.
 */
export function NoMethodYet() {
  return (
    <Sheet show="How to make it">
      <RecipeEditor recipe={porridge} onClose={nothing} onSaved={nothing} />
    </Sheet>
  )
}
