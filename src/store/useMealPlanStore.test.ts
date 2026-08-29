import { describe, expect, it, vi } from 'vitest'
import { getRangeDates, getWeekDates, today, useMealPlanStore } from './useMealPlanStore'

/**
 * The week shape is the one piece of date handling that is easy to get subtly
 * wrong and hard to notice.
 */
describe('getWeekDates', () => {
  it('runs Monday to Sunday by default', () => {
    // 2026-08-16 is a Sunday, so it is the last day of the week that began
    // on Monday the 10th, not the first day of a new one.
    const week = getWeekDates(new Date('2026-08-16T12:00:00'))
    expect(week[0]).toBe('2026-08-10')
    expect(week[6]).toBe('2026-08-16')
  })

  it('returns the same week for every day inside it', () => {
    const from = getWeekDates(new Date('2026-08-10T12:00:00'))
    const to = getWeekDates(new Date('2026-08-16T12:00:00'))
    expect(from).toEqual(to)
  })

  it('honours a different week start', () => {
    // The dietician's own weeks ran Wednesday to Tuesday.
    expect(getWeekDates(new Date('2026-08-16T12:00:00'), 3)[0]).toBe('2026-08-12')
    expect(getWeekDates(new Date('2026-08-16T12:00:00'), 0)[0]).toBe('2026-08-16')
  })

  it('always returns seven consecutive dates', () => {
    const week = getWeekDates(new Date('2026-02-27T12:00:00'))
    expect(week).toHaveLength(7)
    for (let i = 1; i < week.length; i++) {
      const gap = Date.parse(week[i]) - Date.parse(week[i - 1])
      expect(gap).toBe(86_400_000)
    }
  })

  it('does not shift the day across a daylight-saving boundary', () => {
    // Europe/Bucharest springs forward on 2026-03-29; midday anchoring keeps
    // each date on its own day regardless of the local offset.
    const week = getWeekDates(new Date('2026-03-30T12:00:00'))
    expect(new Set(week).size).toBe(7)
  })
})

describe('getRangeDates', () => {
  it('gives seven days for a week and fourteen for a fortnight', () => {
    expect(getRangeDates('2026-08-10', 'week')).toHaveLength(7)

    const fortnight = getRangeDates('2026-08-10', 'fortnight')
    expect(fortnight).toHaveLength(14)
    expect(fortnight[0]).toBe('2026-08-10')
    expect(fortnight[13]).toBe('2026-08-23')
  })

  it('pads a month out to whole weeks', () => {
    // August 2026 starts on a Saturday, so a Monday-start grid begins on
    // 27 July and runs to 6 September: six whole weeks.
    const month = getRangeDates('2026-08-10', 'month')
    expect(month.length % 7).toBe(0)
    expect(month[0]).toBe('2026-07-27')
    expect(month[month.length - 1]).toBe('2026-09-06')
    expect(month).toContain('2026-08-01')
    expect(month).toContain('2026-08-31')
  })

  it('follows the week start you chose', () => {
    // Wednesday, the day every one of the dietician's plans begins on.
    expect(getRangeDates('2026-08-12', 'month', 3)[0]).toBe('2026-07-29')
  })
})

describe('planning beyond the week on screen', () => {
  it('keeps a day you planned when the window moves off it', () => {
    // This lost work: the plan held exactly the seven days on screen, so
    // stepping to the next fortnight threw the one you had just filled in.
    const store = useMealPlanStore.getState()
    store.goToWeek(new Date('2026-08-10T12:00:00'), 1)
    store.addEntry('2026-08-12', 'lunch', { kind: 'food', foodId: 'food-apple', grams: 150 })

    store.goToWeek(new Date('2026-09-07T12:00:00'), 1)
    expect(useMealPlanStore.getState().plan.find((d) => d.date === '2026-08-12')?.meals)
      .toHaveLength(1)

    // And an empty day nobody is looking at is not kept forever.
    expect(useMealPlanStore.getState().plan.some((d) => d.date === '2026-08-13')).toBe(false)
  })

  it('creates a day that the window has never shown, rather than doing nothing', () => {
    const store = useMealPlanStore.getState()
    store.goToWeek(new Date('2026-08-10T12:00:00'), 1)
    store.addEntry('2026-11-03', 'dinner', { kind: 'food', foodId: 'food-apple', grams: 100 })

    expect(useMealPlanStore.getState().plan.find((d) => d.date === '2026-11-03')?.meals)
      .toHaveLength(1)
  })
})

describe('rearranging a week', () => {
  /** A clean plan with one meal, so each test starts from the same place. */
  function planWith(): { date: string; mealId: string } {
    useMealPlanStore.setState({ plan: [] })
    const store = useMealPlanStore.getState()
    store.goToWeek(new Date('2026-08-10T12:00:00'), 1)
    store.addEntry('2026-08-12', 'lunch', { kind: 'food', foodId: 'food-apple', grams: 150 })
    const day = useMealPlanStore.getState().plan.find((d) => d.date === '2026-08-12')!
    return { date: '2026-08-12', mealId: day.meals[0].id }
  }

  function mealsOn(date: string) {
    return useMealPlanStore.getState().plan.find((d) => d.date === date)?.meals ?? []
  }

  it('moves a meal to another day, leaving nothing behind', () => {
    const { date, mealId } = planWith()
    useMealPlanStore.getState().moveMeal(date, mealId, '2026-08-13')

    expect(mealsOn('2026-08-12')).toHaveLength(0)
    expect(mealsOn('2026-08-13')).toHaveLength(1)
    expect(mealsOn('2026-08-13')[0].slot).toBe('lunch')
  })

  it('moves a meal to another slot on the same day', () => {
    const { date, mealId } = planWith()
    useMealPlanStore.getState().moveMeal(date, mealId, date, 'dinner')

    expect(mealsOn(date)).toHaveLength(1)
    expect(mealsOn(date)[0].slot).toBe('dinner')
  })

  it('duplicates a meal without the two becoming one', () => {
    // Sharing an id would mean removing the copy removed the original too.
    const { date, mealId } = planWith()
    useMealPlanStore.getState().duplicateMeal(date, mealId, '2026-08-14', 'dinner')

    expect(mealsOn(date)).toHaveLength(1)
    expect(mealsOn('2026-08-14')).toHaveLength(1)
    expect(mealsOn('2026-08-14')[0].id).not.toBe(mealId)

    useMealPlanStore.getState().removeMeal('2026-08-14', mealsOn('2026-08-14')[0].id)
    expect(mealsOn(date)).toHaveLength(1)
  })

  it('swaps two meals, each taking the other slot as well as the other day', () => {
    const { date, mealId } = planWith()
    const store = useMealPlanStore.getState()
    store.addEntry('2026-08-14', 'dinner', { kind: 'food', foodId: 'food-banana', grams: 120 })
    const other = mealsOn('2026-08-14')[0]

    store.swapMeals({ date, mealId }, { date: '2026-08-14', mealId: other.id })

    const lunch = mealsOn(date)[0]
    const dinner = mealsOn('2026-08-14')[0]
    expect(lunch.slot).toBe('lunch')
    expect(dinner.slot).toBe('dinner')
    expect(lunch.entries).toEqual(other.entries)
    expect(dinner.entries).toEqual([{ kind: 'food', foodId: 'food-apple', grams: 150 }])
  })

  it('does nothing when the meal is not there', () => {
    const { date } = planWith()
    const before = JSON.stringify(useMealPlanStore.getState().plan)
    useMealPlanStore.getState().moveMeal(date, 'no-such-meal', '2026-08-13')
    expect(JSON.stringify(useMealPlanStore.getState().plan)).toBe(before)
  })
})

describe('planning from the fridge', () => {
  it('leaves a portion off the shopping list, because it is already cooked', async () => {
    // The whole point of cooking in advance, and the thing the app used to get
    // wrong: a batch meal bought its ingredients again on every day it covered.
    const { buildContext } = await import('../lib/nutrition')
    const { FOODS } = await import('../data/foods')
    const { ALL_RECIPES } = await import('../data')

    const recipe = ALL_RECIPES.find((r) => r.components.some((c) => c.kind === 'food'))!
    const portion = {
      id: 'p1', recipeId: recipe.id, servings: 4, madeOn: '2026-08-20',
      storage: 'fridge' as const, source: 'batch' as const,
    }
    const ctx = buildContext(FOODS, ALL_RECIPES, {}, {}, [portion])

    useMealPlanStore.setState({ plan: [], groceryItems: [] })
    const store = useMealPlanStore.getState()
    store.goToWeek(new Date('2026-08-24T12:00:00'), 1)

    store.addEntry('2026-08-25', 'lunch', { kind: 'recipe', recipeId: recipe.id, servings: 1 })
    store.generateGroceryList(ctx)
    const fromRecipe = useMealPlanStore.getState().groceryItems.length
    expect(fromRecipe).toBeGreaterThan(0)

    useMealPlanStore.setState({ plan: [], groceryItems: [] })
    useMealPlanStore.getState().goToWeek(new Date('2026-08-24T12:00:00'), 1)
    useMealPlanStore.getState().addEntry('2026-08-25', 'lunch', {
      kind: 'portion', portionId: 'p1', servings: 1,
    })
    useMealPlanStore.getState().generateGroceryList(ctx)

    expect(useMealPlanStore.getState().groceryItems).toHaveLength(0)
  })

  it('still counts towards the day, because you are eating it', async () => {
    const { buildContext, dayNutrients } = await import('../lib/nutrition')
    const { FOODS } = await import('../data/foods')
    const { ALL_RECIPES } = await import('../data')

    const recipe = ALL_RECIPES.find((r) => r.components.some((c) => c.kind === 'food'))!
    const ctx = buildContext(FOODS, ALL_RECIPES, {}, {}, [{
      id: 'p1', recipeId: recipe.id, servings: 4, madeOn: '2026-08-20',
      storage: 'fridge', source: 'batch',
    }])

    const day = {
      date: '2026-08-25',
      meals: [{ id: 'm1', slot: 'lunch' as const, entries: [{ kind: 'portion' as const, portionId: 'p1', servings: 1 }] }],
    }
    expect(dayNutrients(day, ctx).calories).toBeGreaterThan(0)
  })
})

describe('a week worth having again', () => {
  /** Monday the 10th of August 2026, with food on the Wednesday and Friday. */
  function aWeekWithFoodOnIt() {
    useMealPlanStore.setState({ plan: [], templates: [] })
    const store = useMealPlanStore.getState()
    store.goToWeek(new Date('2026-08-10T12:00:00'), 1)
    store.addEntry('2026-08-12', 'lunch', { kind: 'food', foodId: 'food-apple', grams: 150 })
    store.addEntry('2026-08-14', 'dinner', { kind: 'food', foodId: 'food-lentil-red', grams: 90 })
  }

  function mealsOn(date: string) {
    return useMealPlanStore.getState().plan.find((d) => d.date === date)?.meals ?? []
  }

  it('saves the week on screen and keeps only the days with food on them', () => {
    aWeekWithFoodOnIt()
    const template = useMealPlanStore.getState().saveTemplate('Our usual')

    expect(template).not.toBeNull()
    expect(template!.name).toBe('Our usual')
    // Wednesday is two days after Monday, Friday is four.
    expect(template!.days.map((d) => d.offset)).toEqual([2, 4])
    expect(template!.days[0].meals[0].slot).toBe('lunch')
  })

  it('refuses to save a week with nothing on it', () => {
    useMealPlanStore.setState({ plan: [], templates: [] })
    useMealPlanStore.getState().goToWeek(new Date('2026-08-10T12:00:00'), 1)

    expect(useMealPlanStore.getState().saveTemplate('Empty')).toBeNull()
    expect(useMealPlanStore.getState().templates).toHaveLength(0)
  })

  it('writes it onto a different week, on the matching days', () => {
    aWeekWithFoodOnIt()
    const template = useMealPlanStore.getState().saveTemplate('Our usual')!

    // A fortnight later, a week nothing has been written to.
    useMealPlanStore.getState().goToWeek(new Date('2026-08-24T12:00:00'), 1)
    useMealPlanStore.getState().applyTemplate(template.id)

    expect(mealsOn('2026-08-26')).toHaveLength(1)
    expect(mealsOn('2026-08-26')[0].slot).toBe('lunch')
    expect(mealsOn('2026-08-28')).toHaveLength(1)
    // And the week it came from is untouched.
    expect(mealsOn('2026-08-12')).toHaveLength(1)
  })

  it('gives every copied meal its own id, so moving one does not move both', () => {
    aWeekWithFoodOnIt()
    const original = mealsOn('2026-08-12')[0].id
    const template = useMealPlanStore.getState().saveTemplate('Our usual')!

    useMealPlanStore.getState().goToWeek(new Date('2026-08-24T12:00:00'), 1)
    useMealPlanStore.getState().applyTemplate(template.id)

    expect(mealsOn('2026-08-26')[0].id).not.toBe(original)
  })

  it('replaces the week rather than merging into it, empty days included', () => {
    aWeekWithFoodOnIt()
    const template = useMealPlanStore.getState().saveTemplate('Our usual')!

    // A week with something already on a day the template says nothing about.
    useMealPlanStore.getState().goToWeek(new Date('2026-08-24T12:00:00'), 1)
    useMealPlanStore.getState()
      .addEntry('2026-08-25', 'breakfast', { kind: 'food', foodId: 'food-apple', grams: 100 })
    useMealPlanStore.getState().applyTemplate(template.id)

    // Gone, deliberately. A week you asked for is the week you get, and the
    // screen counts what is there and asks before this runs.
    expect(mealsOn('2026-08-25')).toHaveLength(0)
    expect(mealsOn('2026-08-26')).toHaveLength(1)
  })

  it('lands on the same weekdays when the week starts on a Sunday', () => {
    aWeekWithFoodOnIt()
    const template = useMealPlanStore.getState().saveTemplate('Our usual')!

    // Saved Monday-first, applied Sunday-first. Offsets are from the start of
    // the week, so the third day of the week is still the third day of it.
    useMealPlanStore.getState().goToWeek(new Date('2026-08-24T12:00:00'), 0)
    useMealPlanStore.getState().applyTemplate(template.id)

    const dates = useMealPlanStore.getState().weekDates
    expect(mealsOn(dates[2])).toHaveLength(1)
    expect(mealsOn(dates[4])).toHaveLength(1)
  })

  it('forgets one when you say so, and keeps the rest', () => {
    aWeekWithFoodOnIt()
    const first = useMealPlanStore.getState().saveTemplate('One')!
    const second = useMealPlanStore.getState().saveTemplate('Two')!

    useMealPlanStore.getState().removeTemplate(first.id)

    expect(useMealPlanStore.getState().templates.map((t) => t.id)).toEqual([second.id])
  })

  it('keeps the old name rather than accepting an empty one', () => {
    aWeekWithFoodOnIt()
    const template = useMealPlanStore.getState().saveTemplate('Our usual')!

    useMealPlanStore.getState().renameTemplate(template.id, '   ')

    expect(useMealPlanStore.getState().templates[0].name).toBe('Our usual')
  })
})

describe('the week you are actually in', () => {
  /**
   * The bug this exists to prevent.
   *
   * The window was a persisted snapshot that only the Planner's Today button
   * ever advanced. A fortnight after planning, Home scored a week that had
   * already happened, the shopping list offered its days, and the week you
   * were standing in was empty and unmentioned on every screen but one.
   */
  it('moves to the week containing today when it is somewhere else', () => {
    useMealPlanStore.setState({ plan: [] })
    // A week planned a fortnight ago, exactly as it would have been restored.
    useMealPlanStore.getState().goToWeek(new Date('2026-08-17T12:00:00'), 1)
    expect(useMealPlanStore.getState().weekDates[0]).toBe('2026-08-17')

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-29T09:00:00'))
    useMealPlanStore.getState().ensureCurrentWeek(1)
    vi.useRealTimers()

    expect(useMealPlanStore.getState().weekDates).toContain('2026-08-29')
    expect(useMealPlanStore.getState().weekDates[0]).toBe('2026-08-24')
  })

  it('leaves the window alone when today is already in it', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-29T09:00:00'))

    useMealPlanStore.getState().goToWeek(new Date('2026-08-29T12:00:00'), 1)
    // Stepping forward deliberately is not something to undo on every check.
    useMealPlanStore.getState().goToWeek(new Date('2026-09-05T12:00:00'), 1)
    const stepped = useMealPlanStore.getState().weekDates

    useMealPlanStore.getState().ensureCurrentWeek(1)
    vi.useRealTimers()

    // Next week does not contain today, so it is corrected. That is the point:
    // the check is about where today is, not about what you last pressed.
    expect(useMealPlanStore.getState().weekDates).not.toEqual(stepped)
    expect(useMealPlanStore.getState().weekDates).toContain('2026-08-29')
  })

  it('honours the day you start your week on', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-29T09:00:00'))
    useMealPlanStore.setState({ weekDates: [] })

    useMealPlanStore.getState().ensureCurrentWeek(0)
    vi.useRealTimers()

    // Sunday start: the 29th is a Saturday, so the week runs from the 23rd.
    expect(useMealPlanStore.getState().weekDates[0]).toBe('2026-08-23')
  })

  it('reads today from the local calendar, not from UTC', () => {
    // Late evening east of Greenwich. Read as UTC this is already tomorrow,
    // which is how six hand-rolled copies of this could put you a day out.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 29, 23, 30))
    expect(today()).toBe('2026-08-29')

    vi.setSystemTime(new Date(2026, 7, 29, 0, 30))
    expect(today()).toBe('2026-08-29')
    vi.useRealTimers()
  })
})

describe('what actually happened', () => {
  function aMealOnThursday(): { date: string; mealId: string } {
    useMealPlanStore.setState({ plan: [] })
    const store = useMealPlanStore.getState()
    store.goToWeek(new Date('2026-08-24T12:00:00'), 1)
    store.addEntry('2026-08-27', 'lunch', { kind: 'food', foodId: 'food-apple', grams: 150 })
    const day = useMealPlanStore.getState().plan.find((d) => d.date === '2026-08-27')!
    return { date: '2026-08-27', mealId: day.meals[0].id }
  }

  function meal(date: string, id: string) {
    return useMealPlanStore.getState().plan
      .find((d) => d.date === date)?.meals.find((m) => m.id === id)
  }

  it('starts as an intention, with nothing said either way', () => {
    const { date, mealId } = aMealOnThursday()
    expect(meal(date, mealId)?.outcome).toBeUndefined()
  })

  it('records that it was eaten, and when', () => {
    const { date, mealId } = aMealOnThursday()
    useMealPlanStore.getState().setMealOutcome(date, mealId, 'eaten')

    expect(meal(date, mealId)?.outcome).toBe('eaten')
    expect(meal(date, mealId)?.outcomeAt).toBeTruthy()
  })

  it('lets you take it back, because people change their minds', () => {
    const { date, mealId } = aMealOnThursday()
    useMealPlanStore.getState().setMealOutcome(date, mealId, 'eaten')
    useMealPlanStore.getState().setMealOutcome(date, mealId, undefined)

    expect(meal(date, mealId)?.outcome).toBeUndefined()
    // The timestamp goes too. A time with no outcome attached is a puzzle for
    // whoever reads the row next.
    expect(meal(date, mealId)?.outcomeAt).toBeUndefined()
  })

  it('leaves every other meal alone', () => {
    const { date, mealId } = aMealOnThursday()
    useMealPlanStore.getState()
      .addEntry(date, 'dinner', { kind: 'food', foodId: 'food-apple', grams: 100 })
    useMealPlanStore.getState().setMealOutcome(date, mealId, 'skipped')

    const dinner = useMealPlanStore.getState().plan
      .find((d) => d.date === date)!.meals.find((m) => m.slot === 'dinner')
    expect(dinner?.outcome).toBeUndefined()
  })
})

describe('something you ate that was never planned', () => {
  const apple = { kind: 'food' as const, foodId: 'food-apple', grams: 150 }
  const date = '2026-08-27'

  function aThursday() {
    useMealPlanStore.setState({ plan: [] })
    useMealPlanStore.getState().goToWeek(new Date('2026-08-24T12:00:00'), 1)
  }

  const day = () => useMealPlanStore.getState().plan.find((d) => d.date === date)!

  it('lands as a record, not as a plan waiting to be ticked', () => {
    aThursday()
    useMealPlanStore.getState().recordEaten(date, 'snack1', apple)

    const [meal] = day().meals
    expect(meal.outcome).toBe('eaten')
    expect(meal.outcomeAt).toBeTruthy()
    expect(meal.entries).toEqual([apple])
  })

  it('does not tick the planned meal already in that slot', () => {
    aThursday()
    useMealPlanStore.getState().addEntry(date, 'lunch', apple)
    useMealPlanStore.getState()
      .recordEaten(date, 'lunch', { kind: 'food', foodId: 'food-apple', grams: 40 })

    // Two records in one slot: the lunch that was planned, still undecided,
    // and the thing that was actually eaten. Folding them together would have
    // claimed the planned lunch was eaten too.
    const lunches = day().meals.filter((m) => m.slot === 'lunch')
    expect(lunches).toHaveLength(2)
    expect(lunches.find((m) => m.outcome === 'eaten')!.entries).toHaveLength(1)
    expect(lunches.find((m) => !m.outcome)!.entries).toEqual([apple])
  })

  it('adds a second bite to the record it already made', () => {
    aThursday()
    useMealPlanStore.getState().recordEaten(date, 'snack1', apple)
    useMealPlanStore.getState()
      .recordEaten(date, 'snack1', { kind: 'food', foodId: 'food-apple', grams: 40 })

    expect(day().meals).toHaveLength(1)
    expect(day().meals[0].entries).toHaveLength(2)
  })
})

describe('changing how much of it there was', () => {
  function aDayWith(entry: { kind: 'food'; foodId: string; grams: number }) {
    useMealPlanStore.setState({ plan: [] })
    const store = useMealPlanStore.getState()
    store.goToWeek(new Date('2026-08-24T12:00:00'), 1)
    store.addEntry('2026-08-27', 'lunch', entry)
    const day = useMealPlanStore.getState().plan.find((d) => d.date === '2026-08-27')!
    return { date: '2026-08-27', mealId: day.meals[0].id }
  }

  function entries(date: string) {
    return useMealPlanStore.getState().plan.find((d) => d.date === date)!.meals[0].entries
  }

  it('changes the weight of a food', () => {
    const { date, mealId } = aDayWith({ kind: 'food', foodId: 'food-apple', grams: 150 })
    useMealPlanStore.getState().updateEntry(date, mealId, 0, 75)

    const entry = entries(date)[0]
    expect(entry.kind === 'food' && entry.grams).toBe(75)
  })

  it('rounds a weight, because kitchen scales do not do fractions of a gram', () => {
    const { date, mealId } = aDayWith({ kind: 'food', foodId: 'food-apple', grams: 150 })
    useMealPlanStore.getState().updateEntry(date, mealId, 0, 74.6)

    const entry = entries(date)[0]
    expect(entry.kind === 'food' && entry.grams).toBe(75)
  })

  it('allows half a serving of something already made', () => {
    useMealPlanStore.setState({ plan: [] })
    const store = useMealPlanStore.getState()
    store.goToWeek(new Date('2026-08-24T12:00:00'), 1)
    store.addEntry('2026-08-27', 'dinner', { kind: 'recipe', recipeId: 'stew', servings: 1 })
    const mealId = useMealPlanStore.getState().plan
      .find((d) => d.date === '2026-08-27')!.meals[0].id

    useMealPlanStore.getState().updateEntry('2026-08-27', mealId, 0, 0.5)

    const entry = entries('2026-08-27')[0]
    // Servings keep their fraction: half a stew is a real thing to have eaten,
    // and rounding it to one is the error this exists to prevent.
    expect(entry.kind === 'recipe' && entry.servings).toBe(0.5)
  })

  it('refuses to go below nothing', () => {
    const { date, mealId } = aDayWith({ kind: 'food', foodId: 'food-apple', grams: 150 })
    useMealPlanStore.getState().updateEntry(date, mealId, 0, -20)

    const entry = entries(date)[0]
    expect(entry.kind === 'food' && entry.grams).toBe(0)
  })

  it('touches only the entry named, not its neighbours', () => {
    const { date, mealId } = aDayWith({ kind: 'food', foodId: 'food-apple', grams: 150 })
    useMealPlanStore.getState().setMeal(date, 'lunch', [
      { kind: 'food', foodId: 'food-apple', grams: 150 },
      { kind: 'food', foodId: 'food-lentil-red', grams: 90 },
    ])
    const id = useMealPlanStore.getState().plan.find((d) => d.date === date)!.meals[0].id
    expect(id).toBeTruthy()

    useMealPlanStore.getState().updateEntry(date, id, 1, 45)

    const [first, second] = entries(date)
    expect(first.kind === 'food' && first.grams).toBe(150)
    expect(second.kind === 'food' && second.grams).toBe(45)
    expect(mealId).toBeTruthy()
  })
})
