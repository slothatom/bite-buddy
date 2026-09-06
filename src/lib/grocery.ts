/**
 * Reading and writing the amounts on a shopping list.
 *
 * A generated line is grams, because that is what the recipes are written in.
 * A line you add yourself is often not: a jar of mustard, two packs of feta,
 * a bunch of parsley. Rather than making you pick a unit, the amount is typed
 * as text and read back if it happens to be a weight, so "1.5 kg" adds up with
 * the rest of the list and "2 packs" simply says what it says.
 */

import type { GroceryItem } from '../types'

export interface Amount {
  /** Set when the text was a weight. */
  grams?: number
  /** Set when it was not, and should be shown exactly as typed. */
  text?: string
}

/*
 * A weight has to say it is one.
 *
 * The unit used to be optional and defaulted to grams, so typing `1` into the
 * amount box next to "Vanilla Milk" produced one gram of vanilla milk. Nobody
 * shopping has ever meant that. A bare number is a count of the thing, and a
 * count is what the placeholder has always suggested.
 *
 * Guessing from the size of the number was the other option and it is worse:
 * a threshold that reads 500 as grams and 2 as packs is a rule nobody can see,
 * and it would be wrong about 200 eggs and 2 kg of flour in the same list.
 */
const WEIGHT = /^\s*([\d.,]+)\s*(kg|g|kilos?|kilograms?|grams?)\s*$/i

export function parseAmount(input: string): Amount {
  const trimmed = input.trim()
  if (!trimmed) return {}

  const match = WEIGHT.exec(trimmed)
  if (!match) return { text: trimmed }

  const value = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(value) || value < 0) return { text: trimmed }

  const unit = match[2].toLowerCase()
  const grams = unit.startsWith('k') ? value * 1000 : value
  return { grams: Math.round(grams) }
}

/** Kilograms once it is worth switching, which is the point a bag gets heavy. */
/**
 * Measures rather than things.
 *
 * A food's units are whatever somebody might type an amount in, and only some
 * of those are things you can put in a basket. Three tomatoes is a shopping
 * instruction; three tablespoons of oats is not, and neither is half a plate
 * of vegetables. In a shop the second kind is worse than grams, because it
 * reads like a quantity to buy and is not one.
 */
const MEASURES = new Set([
  'tbsp', 'tsp', 'cup', 'handful', 'bowl', 'plate', 'half a plate', 'glass', 'pinch',
])

/**
 * What to buy, in the terms a shop is arranged in.
 *
 * "Egg 110 g" is a correct answer to a question nobody asked standing in an
 * aisle. Only used where the arithmetic comes out close to a whole number:
 * "2 eggs" for 110 g of egg is a rounding somebody can act on, "1.4 peppers"
 * is not, and neither is a number so large it has stopped being a count.
 */
export function householdAmount(
  grams: number,
  units: { label: string; grams: number }[] | undefined,
): string | undefined {
  const unit = units?.find((u) => !MEASURES.has(u.label.toLowerCase()) && u.grams > 0)
  if (!unit || !grams) return undefined

  const exact = grams / unit.grams
  const count = Math.round(exact)
  if (count < 1 || count > 24) return undefined
  // Within a sixth of a whole one, so the rounding stays honest.
  if (Math.abs(exact - count) > 1 / 6) return undefined

  const label = count === 1 ? unit.label : plural(unit.label)
  return `${count} ${label}`
}

/**
 * Plurals for the words this database actually uses, and no more.
 *
 * Twenty five unit labels exist, so a general English pluraliser would be a
 * lot of rules for a problem that is a list. Tomato is the only one that needs
 * saying: avocado, mango and kiwi all take a plain s in ordinary use.
 */
const IRREGULAR: Record<string, string> = { tomato: 'tomatoes' }

function plural(label: string): string {
  const known = IRREGULAR[label.toLowerCase()]
  if (known) return known
  if (/(s|x|ch|sh)$/i.test(label)) return `${label}es`
  return `${label}s`
}

export function formatGrams(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`
}

/**
 * The list as text, for handing to somebody who is not in the app.
 *
 * The only way out of here was a backup file, which is not something you send
 * to a person. Grouped the way the screen groups it, because a list you can
 * read top to bottom in a shop is the whole point, and picked-up lines are
 * left out: what is left is what is left to buy.
 */
export function listAsText(
  items: GroceryItem[],
  labels: Record<string, string>,
  amountOf: (item: GroceryItem) => string,
): string {
  const remaining = items.filter((i) => !i.checked)
  if (!remaining.length) return 'Nothing left to buy.'

  const byCategory = new Map<string, GroceryItem[]>()
  for (const item of remaining) {
    const list = byCategory.get(item.category) ?? []
    list.push(item)
    byCategory.set(item.category, list)
  }

  const lines: string[] = []
  for (const [category, list] of byCategory) {
    lines.push(labels[category] ?? category)
    for (const item of list) {
      const amount = amountOf(item)
      lines.push(`  ${item.name}${amount ? ` , ${amount}` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}
