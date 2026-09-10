import { CalorieRing } from 'bite-buddy'

/** A day sitting inside Arany's 1800, with what is left to spend said in words. */
export function OnTrack() {
  return (
    <div style={{ width: 220 }}>
      <CalorieRing value={1642} target={1800} />
    </div>
  )
}

/**
 * A day nobody has planned yet.
 *
 * Zero is still on track, so the ring stays empty and the line underneath is
 * the whole day as headroom rather than a warning about nothing.
 */
export function NothingPlannedYet() {
  return (
    <div style={{ width: 220 }}>
      <CalorieRing value={0} target={1800} />
    </div>
  )
}

/**
 * Past the target but not by much: the ring turns and a pill appears.
 *
 * Between 5% and 30% over, which in practice is a second helping of ciorbă and
 * an extra slice of pâine integrală, not a day gone wrong.
 */
export function SlightlyOver() {
  return (
    <div style={{ width: 220 }}>
      <CalorieRing value={2050} target={1800} />
    </div>
  )
}

/** More than 30% over. The pill carries an icon and the words, never the colour alone. */
export function OverTarget() {
  return (
    <div style={{ width: 220 }}>
      <CalorieRing value={2480} target={1800} />
    </div>
  )
}

/**
 * Two people, two targets, at the smaller size.
 *
 * The planner shows Arany and Oli beside each other, so the rings have to hold
 * their figures at 120px as well as they do at the default 132.
 */
export function TwoPeople() {
  return (
    <div style={{ width: 400, display: 'flex', gap: 24, justifyContent: 'center' }}>
      <CalorieRing value={1642} target={1800} size={120} />
      <CalorieRing value={2180} target={2100} size={120} />
    </div>
  )
}
