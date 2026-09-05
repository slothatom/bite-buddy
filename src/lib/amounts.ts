/**
 * Reading a number a person typed into a box.
 *
 * `Number(e.target.value)` was doing this everywhere, which accepts anything
 * the input element hands over and the input element hands over more than you
 * would think. Typing 999999 into a food's gram field was taken at face value
 * and reported as 2,469,998 kcal, with the digits overflowing the box. Typing
 * a minus sign left the sign behind and kept the digits, so `-50` became `050`
 * and then fifty grams.
 *
 * `min` on the element is a hint to the browser, not a rule: it colours the
 * field and blocks the stepper arrows, and does nothing at all to what you can
 * type or paste. So the rule lives here instead, on the way in.
 */

export interface Bounds {
  min?: number
  max: number
  /** Decimal places to keep. Grams are whole; servings come in quarters. */
  places?: number
}

/**
 * The value to store, given what is in the box.
 *
 * An empty box is not zero, it is somebody halfway through typing, so it comes
 * back as the minimum rather than snapping to it and fighting the cursor. NaN
 * is the same case: a lone minus sign is a value the element reports as empty.
 */
export function readAmount(raw: string, { min = 0, max, places = 0 }: Bounds): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return min

  const clamped = Math.min(max, Math.max(min, n))
  const factor = 10 ** places
  return Math.round(clamped * factor) / factor
}

/**
 * Sensible ceilings, in one place so they can be argued with in one place.
 *
 * None of these is a rule about what anybody should eat. They are the point
 * past which a number is far more likely to be a slip of a thumb on a repeating
 * button, or a stray keypress, than a meal.
 */
export const MOST = {
  /** Grams of one food in one meal. A whole 3 kg chicken is not one serving. */
  grams: 3000,
  /** Servings of a recipe or a portion in one meal. */
  servings: 20,
  /** Per 100 g, for a food's own figures. Pure fat is 900 kcal. */
  caloriesPer100g: 1000,
  /** Per 100 g, for a macro. Nothing is more than all of itself. */
  gramsPer100g: 100,
  /** Milligrams of sodium per 100 g. Salt itself is about 39,000. */
  sodiumPer100g: 40_000,
} as const
