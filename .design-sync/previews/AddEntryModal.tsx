import type { ReactNode } from 'react'
import { AddEntryModal } from 'bite-buddy'

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

/*
 * The dates are May 2024 rather than the September 2026 the rest of these
 * previews use, because this is the one sheet whose wording is decided by the
 * clock: the record tense and the Planning / Already had it pair are offered
 * only for a day that is not in the future. The capture harness fixes the
 * clock at 2024-05-15, so 21 May is a day ahead and 14 May is yesterday.
 */

/**
 * Planning a dinner, opened from the planner with the day and the slot both
 * correctable.
 *
 * The card under the search box is the whole point of the sheet: it says where
 * this is going before you have chosen what, because the button that opens it
 * used to mean today and Breakfast whatever the hour. The Cooking chips are
 * only offered here, when there is still a pot to size.
 */
export function AddToDinner() {
  return (
    <Sheet>
      <AddEntryModal
        date="2024-05-21"
        slot="dinner"
        onClose={nothing}
        onAdd={nothing}
        onSlotChange={nothing}
        onDateChange={nothing}
      />
    </Sheet>
  )
}

/**
 * The same picker in the other tense: yesterday's lunch, written down after
 * the fact.
 *
 * The heading, the placeholder and the button on every row change, and the
 * Planning / Already had it pair appears because the day is not ahead. Nothing
 * asks how much was cooked, which is not a question to put to somebody writing
 * down what they have already eaten.
 */
export function AlreadyHadIt() {
  return (
    <Sheet>
      <AddEntryModal
        date="2024-05-14"
        slot="lunch"
        mode="ate"
        onClose={nothing}
        onAdd={nothing}
        onSlotChange={nothing}
        onDateChange={nothing}
      />
    </Sheet>
  )
}

/**
 * A snack, which opens on foods rather than recipes.
 *
 * The plans write snacks as lines ("150 g mere, 10 g caju") rather than as
 * dishes, so the recipe tab for a snack was reliably empty. The two ways out of
 * a library that does not have it sit above the list instead of under forty
 * foods, and each row carries its named portions so a slice does not have to be
 * typed as a number of grams.
 */
export function ASnack() {
  return (
    <Sheet>
      <AddEntryModal
        date="2024-05-21"
        slot="snack"
        onClose={nothing}
        onAdd={nothing}
        onSlotChange={nothing}
        onDateChange={nothing}
      />
    </Sheet>
  )
}

/**
 * Opened from somewhere that has already settled the day and the meal.
 *
 * Without `onSlotChange` and `onDateChange` the sheet drops the whole
 * where-is-this-going card, so the header line is the only thing saying which
 * breakfast this is. Worth comparing against the first cell: it is the same
 * component with two callbacks missing.
 */
export function DayAndSlotFixed() {
  return (
    <Sheet>
      <AddEntryModal date="2024-05-22" slot="breakfast" onClose={nothing} onAdd={nothing} />
    </Sheet>
  )
}
