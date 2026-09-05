import type { WeightEntry } from '../types'

/**
 * Weights, in whichever unit they were written in.
 *
 * Every weight entry has carried its own `unit` since the beginning, and the
 * profile has carried a `weightUnit` for as long. Nothing ever converted
 * between them, which was harmless only because nothing could change either:
 * every entry said kg, the profile said kg, and the body screen printed the
 * stored number with the profile's unit next to it.
 *
 * The moment the setting became a setting that stopped being true. An entry
 * written at 154 lbs would have been printed as "154 kg" the day somebody
 * switched, and the calorie cost of a workout is computed from kilograms, so
 * the same switch would have quadrupled what an hour of cycling appeared to
 * burn. So the store keeps what you typed and the unit you typed it in, and
 * every reader comes through here.
 */

/** One kilogram, in pounds. */
export const LBS_PER_KG = 2.2046226218

export type WeightUnit = 'kg' | 'lbs'

export const UNIT_LABELS: Record<WeightUnit, string> = { kg: 'kg', lbs: 'lbs' }

export function toKg(weight: number, unit: WeightUnit): number {
  return unit === 'kg' ? weight : weight / LBS_PER_KG
}

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg * LBS_PER_KG
}

/** The same weight, said in another unit. */
export function convert(weight: number, from: WeightUnit, to: WeightUnit): number {
  return from === to ? weight : fromKg(toKg(weight, from), to)
}

/**
 * An entry as the reader's unit, rounded the way a bathroom scale reads.
 *
 * One decimal place in both units. Scales report a tenth of a kilogram and a
 * tenth of a pound, and carrying more would invent precision the number never
 * had.
 */
export function inUnit(entry: Pick<WeightEntry, 'weight' | 'unit'>, unit: WeightUnit): number {
  return round1(convert(entry.weight, entry.unit, unit))
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** For the calorie equations, which are all written in kilograms. */
export function entryKg(entry: Pick<WeightEntry, 'weight' | 'unit'>): number {
  return toKg(entry.weight, entry.unit)
}

/**
 * The most recent of a person's weights, or nothing.
 *
 * Nothing rather than a guess: a household where only one of you has ever
 * stepped on the scales must not cost the other's workouts at the first
 * person's weight, and it must not quietly cost them at zero either.
 */
export function latestKg(entries: WeightEntry[]): number | undefined {
  const last = [...entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  return last ? entryKg(last) : undefined
}
