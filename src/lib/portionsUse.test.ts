import { describe, it, expect } from 'vitest'
import type { MealSlot } from '../types'
import { offerOrder, madeWhen, portionEntries, portionsFromSession, portionLabel, spreadPortions } from './portionsUse'
import type { Portion, Recipe } from '../types'

const TODAY = new Date('2026-08-21T12:00:00')

function portion(over: Partial<Portion> = {}): Portion {
  return {
    id: 'p1', servings: 2, madeOn: '2026-08-20', storage: 'fridge', source: 'batch', ...over,
  }
}

const recipe = (id: string, name: string, servings = 4): Recipe => ({
  id, name: { en: name }, emoji: '🍲', servings, prepMinutes: 10, cookMinutes: 30,
  components: [], steps: [], tags: [], createdAt: '2026-08-01T00:00:00.000Z',
})

describe('what to offer first', () => {
  it('puts the fridge before the freezer', () => {
    // A fridge portion has days; a frozen one has months. Of the two, only one
    // is asking to be eaten.
    const order = offerOrder([
      portion({ id: 'frozen', storage: 'freezer', madeOn: '2026-06-01' }),
      portion({ id: 'fresh', storage: 'fridge', madeOn: '2026-08-20' }),
    ], TODAY)
    expect(order.map((p) => p.id)).toEqual(['fresh', 'frozen'])
  })

  it('puts the oldest first within each', () => {
    const order = offerOrder([
      portion({ id: 'newer', madeOn: '2026-08-20' }),
      portion({ id: 'older', madeOn: '2026-08-17' }),
    ], TODAY)
    expect(order.map((p) => p.id)).toEqual(['older', 'newer'])
  })

  it('does not offer an empty tub', () => {
    const order = offerOrder([portion({ id: 'gone', servings: 0 }), portion({ id: 'left' })], TODAY)
    expect(order.map((p) => p.id)).toEqual(['left'])
  })
})

describe('saying how old something is', () => {
  it('speaks the way a person would', () => {
    expect(madeWhen(portion({ madeOn: '2026-08-21' }), TODAY)).toBe('cooked today')
    expect(madeWhen(portion({ madeOn: '2026-08-20' }), TODAY)).toBe('cooked yesterday')
    expect(madeWhen(portion({ madeOn: '2026-08-18' }), TODAY)).toBe('cooked 3 days ago')
    expect(madeWhen(portion({ madeOn: '2026-08-12' }), TODAY)).toBe('cooked last week')
    expect(madeWhen(portion({ madeOn: '2026-07-20' }), TODAY)).toBe('cooked 5 weeks ago')
  })

  it('never says anything that reads as a verdict', () => {
    // The app cannot see the tub, so it reports the date and stops there.
    const old = madeWhen(portion({ madeOn: '2026-01-01' }), TODAY)
    expect(old).not.toMatch(/expired|off|bad|throw/i)
  })
})

describe('putting portions back', () => {
  it('finds the portion entries in a meal, and ignores the rest', () => {
    expect(portionEntries([
      { kind: 'food', foodId: 'f1', grams: 100 },
      { kind: 'portion', portionId: 'p1', servings: 1 },
      { kind: 'recipe', recipeId: 'r1', servings: 2 },
      { kind: 'portion', portionId: 'p2', servings: 0.5 },
    ])).toEqual([
      { portionId: 'p1', servings: 1 },
      { portionId: 'p2', servings: 0.5 },
    ])
  })
})

describe('what a cook session makes', () => {
  const recipes = new Map([['r1', recipe('r1', 'Lentil stew', 6)], ['r2', recipe('r2', 'Soup', 3)]])

  it('starts from what each recipe says it makes', () => {
    const made = portionsFromSession(['r1', 'r2'], recipes, '2026-08-23', 's1')
    expect(made.map((p) => [p.recipeId, p.servings])).toEqual([['r1', 6], ['r2', 3]])
    expect(made.every((p) => p.sessionId === 's1' && p.storage === 'fridge')).toBe(true)
  })

  it('skips a recipe it cannot find rather than inventing one', () => {
    expect(portionsFromSession(['nope'], recipes, '2026-08-23', 's1')).toEqual([])
  })

  it('names the same tub the same way twice', () => {
    // Two phones can tick the same session off, and a person can untick and
    // tick again. Either way that is one batch of stew, not two.
    const once = portionsFromSession(['r1'], recipes, '2026-08-23', 's1')
    const twice = portionsFromSession(['r1'], recipes, '2026-08-23', 's1')
    expect(once[0].id).toBe(twice[0].id)
  })
})

describe('what to call it', () => {
  it('uses the recipe name when there is one', () => {
    const recipes = new Map([['r1', recipe('r1', 'Lentil stew')]])
    expect(portionLabel(portion({ recipeId: 'r1' }), recipes)).toBe('Lentil stew')
  })

  it('falls back to what you typed', () => {
    expect(portionLabel(portion({ label: 'Half a lasagne' }), new Map())).toBe('Half a lasagne')
  })
})

describe('spreading a batch across the days ahead', () => {
  const days = ['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']
  const slots: MealSlot[] = ['dinner', 'lunch']

  it('puts one serving on each of the coming days', () => {
    const out = spreadPortions([{ id: 'tub', servings: 3 }], [], days, slots)

    expect(out).toHaveLength(3)
    expect(out.map((p) => p.date)).toEqual(['2026-08-30', '2026-08-31', '2026-09-01'])
    expect(out.every((p) => p.slot === 'dinner')).toBe(true)
  })

  it('never puts the same batch twice in one day', () => {
    const out = spreadPortions([{ id: 'tub', servings: 4 }], [], ['2026-08-30'], slots)
    expect(out).toHaveLength(1)
  })

  it('fills gaps rather than rearranging a week', () => {
    const plan = [{
      date: '2026-08-30',
      meals: [{ id: 'm', slot: 'dinner' as const, entries: [] }],
    }]

    const out = spreadPortions([{ id: 'tub', servings: 2 }], plan, days, slots)

    // Monday's dinner was already spoken for, so it uses lunch there instead.
    expect(out[0]).toMatchObject({ date: '2026-08-30', slot: 'lunch' })
    expect(out[1]).toMatchObject({ date: '2026-08-31', slot: 'dinner' })
  })

  it('stops when the portions run out rather than inventing them', () => {
    const out = spreadPortions([{ id: 'tub', servings: 1 }], [], days, slots)
    expect(out).toHaveLength(1)
  })

  it('does nothing with half a portion, which is not a meal to plan', () => {
    expect(spreadPortions([{ id: 'tub', servings: 0.5 }], [], days, slots)).toEqual([])
  })

  it('moves on to the next tub once one is spent', () => {
    const out = spreadPortions(
      [{ id: 'a', servings: 1 }, { id: 'b', servings: 1 }], [], days, slots,
    )
    expect(out.map((p) => p.portionId)).toEqual(['a', 'b'])
  })
})
