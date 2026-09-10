import { WhenPicker } from 'bite-buddy'

/**
 * The days that already carry something.
 *
 * Marked with a dot rather than a colour, so the grid can say "there is
 * already food here" without spending the one strong colour it has on it.
 */
const busy = new Set([
  '2024-05-13', '2024-05-14', '2024-05-15', '2024-05-16',
  '2024-05-20', '2024-05-21', '2024-05-23', '2024-05-27',
])

const panel = { width: 380 }

/**
 * Both halves of the question, which is how the planner asks it: which day,
 * then which meal.
 *
 * The window is the same five weeks wherever this is used, a week back and a
 * fortnight forward, so moving a meal and copying one offer the same days.
 */
export function ADayAndAMeal() {
  return (
    <div style={panel}>
      <WhenPicker
        date="2024-05-16"
        onDate={() => {}}
        slot="dinner"
        onSlot={() => {}}
        busy={busy}
      />
    </div>
  )
}

/**
 * Only the day, which is what copying a whole day asks.
 *
 * Leaving `slot` out drops the second half rather than showing it disabled: a
 * question that does not apply should not be on the screen.
 */
export function JustTheDay() {
  return (
    <div style={panel}>
      <WhenPicker date="2024-05-22" onDate={() => {}} busy={busy} />
    </div>
  )
}

/**
 * A day that has already gone.
 *
 * Dimmed rather than removed, because "I ate that on Monday" is a real thing
 * to want to say, and the line underneath says so in words as well.
 */
export function ADayThatHasGone() {
  return (
    <div style={panel}>
      <WhenPicker
        date="2024-05-13"
        onDate={() => {}}
        slot="lunch"
        onSlot={() => {}}
        busy={busy}
      />
    </div>
  )
}

/**
 * Days that cannot be chosen at all, struck through rather than faded.
 *
 * The archive uses this: a week that was never planned has nothing to put
 * anywhere, so those days are closed. Struck rather than greyed keeps the date
 * readable, which matters when the thing being disabled is a number.
 */
export function DaysYouCannotChoose() {
  return (
    <div style={panel}>
      <WhenPicker
        date="2024-05-20"
        onDate={() => {}}
        slot="breakfast"
        onSlot={() => {}}
        busy={busy}
        disabled={(d) => d < '2024-05-15'}
      />
    </div>
  )
}
