import { MacroBar } from 'bite-buddy'

/** A day's protein, comfortably inside its target. */
export function OnTarget() {
  return (
    <div style={{ width: 420 }}>
      <MacroBar label="Protein" value={96} target={120} unit="g" />
    </div>
  )
}

/**
 * The four bars a day is read through.
 *
 * Calories are not one of them: they get the ring, and the unit here defaults
 * to grams, so a calorie figure would come out labelled "1800g".
 */
export function ADay() {
  return (
    <div style={{ width: 420, display: 'grid', gap: 14 }}>
      <MacroBar label="Protein" value={96} target={120} />
      <MacroBar label="Carbs" value={181} target={170} />
      <MacroBar label="Fat" value={54} target={60} />
      <MacroBar label="Fibre" value={26} target={30} />
    </div>
  )
}

/**
 * Over target, which the bar says in words as well as in colour.
 *
 * The design system forbids carrying that state by hue alone, so this is the
 * variant worth looking at rather than the pretty one.
 */
export function OverTarget() {
  return (
    <div style={{ width: 420, display: 'grid', gap: 14 }}>
      <MacroBar label="Carbs" value={181} target={170} unit="g" />
      <MacroBar label="Sodium" value={3100} target={2300} unit="mg" />
    </div>
  )
}

/**
 * A floor rather than a total.
 *
 * Some ingredient in the day said nothing about fibre, so the figure is at
 * least this and the bar is drawn so it cannot be read as a full one.
 */
export function AFloor() {
  return (
    <div style={{ width: 420 }}>
      <MacroBar label="Fibre" value={19} target={30} unit="g" partial />
    </div>
  )
}

/** No target set: the number stands on its own, with nothing to measure against. */
export function NoTarget() {
  return (
    <div style={{ width: 420 }}>
      <MacroBar label="Sugar" value={38} unit="g" />
    </div>
  )
}
