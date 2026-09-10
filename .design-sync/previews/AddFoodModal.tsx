import type { ReactNode } from 'react'
import { AddFoodModal } from 'bite-buddy'

const nothing = () => {}

/*
 * Every cell here sits in a box with a height on it.
 *
 * The sheet is `position: fixed`, and the card wrapper each story renders into
 * carries a transform, which makes that wrapper the containing block rather
 * than the window. A cell whose only child is fixed is therefore 0px tall and
 * photographs flat, so the height is what gives the overlay something to fill.
 */
function Sheet({ children }: { children?: ReactNode }) {
  return <div style={{ height: 760 }}>{children}</div>
}

/**
 * The way in that is used most: the food is in front of you and nobody else
 * has heard of it.
 *
 * Opened from a search that missed, so the name is already filled in and the
 * only thing left is the label. Category has no default on purpose, which is
 * why Save is refused until one is picked.
 */
export function TypeItIn() {
  return (
    <Sheet>
      <AddFoodModal initialName="Telemea de capră" onClose={nothing} onSaved={nothing} />
    </Sheet>
  )
}

/**
 * The databases tab before it has been asked anything.
 *
 * Worth looking at because this is what the planner opens onto when you press
 * "Search the databases", and because the line under the box is the one place
 * that says typing it in by hand is a real answer rather than a failure.
 *
 * No `initialName`, deliberately: with one, the sheet fires a live lookup
 * against USDA and Open Food Facts on mount, and what the cell then shows
 * depends on how the network fails.
 */
export function LookItUp() {
  return (
    <Sheet>
      <AddFoodModal initialTab="lookup" onClose={nothing} onSaved={nothing} />
    </Sheet>
  )
}

/**
 * The scan tab, which hands the whole screen to the camera.
 *
 * The card shows what a browser with no camera gets, since that is also what a
 * refused permission prompt gets. The sentence the scanner covers is doing real
 * work: Open Food Facts has a barcode for a tub of yoghurt and none for a
 * carrot, and people try the carrot.
 */
export function Scan() {
  return (
    <Sheet>
      <AddFoodModal initialTab="scan" onClose={nothing} onSaved={nothing} />
    </Sheet>
  )
}
