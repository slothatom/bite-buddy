import { Zig } from 'bite-buddy'

/**
 * All six moods at the size an empty state uses.
 *
 * The axis worth looking at, because every mood is a change to the face rather
 * than a badge stuck on it: sleepy closes the eyes and adds the zeds, oops
 * opens the mouth, chef and celebrate add a prop, thinking looks up and away
 * and lifts one arm.
 */
export function SixMoods() {
  return (
    <div style={{ width: 520, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <Zig size={72} mood="happy" />
      <Zig size={72} mood="sleepy" />
      <Zig size={72} mood="oops" />
      <Zig size={72} mood="chef" />
      <Zig size={72} mood="celebrate" />
      <Zig size={72} mood="thinking" />
    </div>
  )
}

/**
 * Every size the app actually asks for, from the menu to an empty state.
 *
 * 26 is the wordmark in the collapsed menu and 96 is the biggest an empty
 * state goes. The mask is one big dark shape rather than a detail, which is
 * the whole reason he still reads as a raccoon at the small end.
 */
export function FromMenuToEmptyState() {
  return (
    <div style={{ width: 460, display: 'flex', alignItems: 'flex-end', gap: 14 }}>
      <Zig size={26} />
      <Zig size={38} />
      <Zig size={44} />
      <Zig size={58} />
      <Zig size={84} />
      <Zig size={96} />
    </div>
  )
}

/**
 * The apologetic one, at the size the error boundary draws him.
 *
 * Worth seeing on his own: oops is the only mood that changes the mouth to an
 * open circle, and at 80 that is the whole expression.
 */
export function Apologetic() {
  return (
    <div style={{ width: 220 }}>
      <Zig size={80} mood="oops" className="mx-auto" />
    </div>
  )
}

/**
 * Celebrating, which is the sign-in screen once the link has gone out.
 *
 * Both arms go up and the sparkles arrive outside the body, so this is the one
 * mood that needs room around it rather than a tight box.
 */
export function Celebrating() {
  return (
    <div style={{ width: 220 }}>
      <Zig size={84} mood="celebrate" className="mx-auto" />
    </div>
  )
}

/**
 * Thinking, which is what the app shows while it is working something out.
 *
 * The question mark sits at the top right of the viewBox and the raised arm
 * reaches for it, so a container that clips will cut both off.
 */
export function Waiting() {
  return (
    <div style={{ width: 220 }}>
      <Zig size={64} mood="thinking" className="mx-auto" />
    </div>
  )
}
