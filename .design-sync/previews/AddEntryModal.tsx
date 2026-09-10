import { AddEntryModal } from 'bite-buddy'

const nothing = () => {}

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
    <AddEntryModal
      date="2026-09-15"
      slot="dinner"
      onClose={nothing}
      onAdd={nothing}
      onSlotChange={nothing}
      onDateChange={nothing}
    />
  )
}

/**
 * The same picker in the other tense: a lunch that has already happened.
 *
 * The heading, the placeholder and the button on every row change, and the
 * Planning / Already had it pair is offered because the day is in the past.
 * Nothing asks how much was cooked, which is not a question to put to somebody
 * writing down what they have eaten.
 */
export function AlreadyHadIt() {
  return (
    <AddEntryModal
      date="2026-09-09"
      slot="lunch"
      mode="ate"
      onClose={nothing}
      onAdd={nothing}
      onSlotChange={nothing}
      onDateChange={nothing}
    />
  )
}

/**
 * A snack, which opens on foods rather than recipes.
 *
 * The plans write snacks as lines ("150 g mere, 10 g caju") rather than as
 * dishes, so the recipe tab for a snack was reliably empty. The two buttons sit
 * above the list instead of under forty foods, and each row carries its named
 * portions so a slice does not have to be typed as a number of grams.
 */
export function ASnack() {
  return (
    <AddEntryModal
      date="2026-09-15"
      slot="snack"
      onClose={nothing}
      onAdd={nothing}
      onSlotChange={nothing}
      onDateChange={nothing}
    />
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
    <AddEntryModal date="2026-09-16" slot="breakfast" onClose={nothing} onAdd={nothing} />
  )
}
