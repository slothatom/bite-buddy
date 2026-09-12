import { describe, it, expect } from 'vitest'
import {
  CATEGORY_ORDER, DISH_CHOICES, INGREDIENT_GROUPS, categoryValue, parseCategoryValue,
} from './categories'

/**
 * One select carrying two fields.
 *
 * The food group is what the serving goals, the trends and the shopping aisles
 * read; the dish type is a label beside it. A control that offers "Soup" has to
 * record both without the reader having to know that is what it is doing.
 */
describe('choosing a food group, or a dish', () => {
  it('offers every guide group, and not the dishes hatch', () => {
    expect(INGREDIENT_GROUPS).toHaveLength(CATEGORY_ORDER.length - 1)
    expect(INGREDIENT_GROUPS).not.toContain('dishes')
    expect(INGREDIENT_GROUPS).toContain('vegetables')
  })

  it('names the dishes, with the unspecified one first', () => {
    expect(DISH_CHOICES[0]).toEqual({ value: 'dishes', label: 'Cooked dish' })
    expect(DISH_CHOICES.map((d) => d.label)).toContain('Soup')
    expect(DISH_CHOICES.map((d) => d.label)).toContain('Salad')
    expect(DISH_CHOICES.map((d) => d.label)).toContain('Pastry')
  })

  it('reads a dish back as the group plus the kind', () => {
    expect(parseCategoryValue('dish:soup')).toEqual({ category: 'dishes', dishType: 'soup' })
  })

  it('reads a plain group as itself', () => {
    expect(parseCategoryValue('dairy')).toEqual({ category: 'dairy', dishType: undefined })
  })

  it('keeps a cooked dish that is no particular kind', () => {
    expect(parseCategoryValue('dishes')).toEqual({ category: 'dishes', dishType: undefined })
  })

  /*
   * The case that would rot quietly: a soup refiled as dairy, keeping "soup"
   * on it, and later matching a filter nobody would expect it to.
   */
  it('clears the kind when the food leaves the dishes group', () => {
    expect(parseCategoryValue('dairy').dishType).toBeUndefined()
  })

  it('round-trips what it wrote', () => {
    for (const value of ['dairy', 'dishes', 'dish:salad', 'dish:pastry']) {
      expect(categoryValue(parseCategoryValue(value))).toBe(value)
    }
  })

  it('shows a typed dish as its kind, not as the hatch', () => {
    expect(categoryValue({ category: 'dishes', dishType: 'stew' })).toBe('dish:stew')
  })
})
