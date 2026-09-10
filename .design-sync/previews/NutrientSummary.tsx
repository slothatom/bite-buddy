import { NutrientSummary } from 'bite-buddy'

const day = {
  calories: 1642, protein: 96, carbs: 181, fat: 54,
  fiber: 26, sugar: 41, sodium: 1900,
}

const targets = { calories: 1800, protein: 120, carbs: 170, fat: 60, fiber: 30 }

/** A day that resolved cleanly, measured against Arany's targets. */
export function AgainstTargets() {
  return (
    <div style={{ width: 460 }}>
      <NutrientSummary n={day} targets={targets} />
    </div>
  )
}

/** The same day with nothing to measure against: figures, no verdict. */
export function NoTargets() {
  return (
    <div style={{ width: 460 }}>
      <NutrientSummary n={day} />
    </div>
  )
}

/**
 * Two nutrients that are floors rather than totals.
 *
 * Something in the day did not state its fibre or its sodium, so those two are
 * marked and the rest are not. Unknown is not zero, and the summary is the
 * place that has to say so.
 */
export function PartialFigures() {
  return (
    <div style={{ width: 460 }}>
      <NutrientSummary n={day} targets={targets} partial={['fiber', 'sodium']} />
    </div>
  )
}

/**
 * A day that lost an ingredient altogether.
 *
 * Worse than a floor: a food was named that the library no longer holds, so
 * every figure below is short by an unknown amount.
 */
export function LostAnIngredient() {
  return (
    <div style={{ width: 460 }}>
      <NutrientSummary n={day} targets={targets} unresolved={2} />
    </div>
  )
}
