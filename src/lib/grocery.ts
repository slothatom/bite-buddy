/**
 * Reading and writing the amounts on a shopping list.
 *
 * A generated line is grams, because that is what the recipes are written in.
 * A line you add yourself is often not: a jar of mustard, two packs of feta,
 * a bunch of parsley. Rather than making you pick a unit, the amount is typed
 * as text and read back if it happens to be a weight, so "1.5 kg" adds up with
 * the rest of the list and "2 packs" simply says what it says.
 */

export interface Amount {
  /** Set when the text was a weight. */
  grams?: number
  /** Set when it was not, and should be shown exactly as typed. */
  text?: string
}

const WEIGHT = /^\s*([\d.,]+)\s*(kg|g|kilos?|kilograms?|grams?)?\s*$/i

export function parseAmount(input: string): Amount {
  const trimmed = input.trim()
  if (!trimmed) return {}

  const match = WEIGHT.exec(trimmed)
  if (!match) return { text: trimmed }

  const value = Number(match[1].replace(',', '.'))
  if (!Number.isFinite(value) || value < 0) return { text: trimmed }

  const unit = (match[2] ?? 'g').toLowerCase()
  const grams = unit.startsWith('k') ? value * 1000 : value
  return { grams: Math.round(grams) }
}

/** Kilograms once it is worth switching, which is the point a bag gets heavy. */
export function formatGrams(grams: number): string {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`
}
