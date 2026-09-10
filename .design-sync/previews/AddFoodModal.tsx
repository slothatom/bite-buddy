import { AddFoodModal } from 'bite-buddy'

const nothing = () => {}

/**
 * The way in that is used most: the food is in front of you and nobody else
 * has heard of it.
 *
 * Opened from a search that missed, so the name is already filled in and the
 * only thing left is the label. Category has no default on purpose, which is
 * why Save is refused until one is picked.
 */
export function TypeItIn() {
  return <AddFoodModal initialName="Telemea de capră" onClose={nothing} onSaved={nothing} />
}

/**
 * The databases tab before it has been asked anything.
 *
 * Worth looking at because this is what the planner opens onto when you press
 * "Search the databases", and because the line under the box is the one place
 * that says typing it in by hand is a real answer rather than a failure.
 */
export function LookItUp() {
  return <AddFoodModal initialTab="lookup" onClose={nothing} onSaved={nothing} />
}

/**
 * The scan tab, which hands the whole screen to the camera.
 *
 * The card shows what a browser with no camera gets, since that is also what a
 * refused permission prompt gets. The sentence above the scanner is doing real
 * work: Open Food Facts has a barcode for a tub of yoghurt and none for a
 * carrot, and people try the carrot.
 */
export function Scan() {
  return <AddFoodModal initialTab="scan" onClose={nothing} onSaved={nothing} />
}
