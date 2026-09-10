import { BarcodeScanner } from 'bite-buddy'

const nothing = () => {}

/**
 * What the scanner shows when there is no camera to open.
 *
 * The only state it can be photographed in: a headless browser has no camera,
 * and neither does a phone whose owner said no, so this is the same screen both
 * of them get. The live state is a video feed behind the four corner marks, and
 * nothing static can stand in for it.
 *
 * Worth looking at for the way out. A dead end with a black screen and no
 * button is how a refused permission usually ends; this says what happened in
 * two lines and offers Go back, which returns to typing the numbers off the
 * label by hand.
 *
 * The box with a height on it is what the sheet fills: it is `position: fixed`
 * and the card wrapper each story renders into carries a transform, so a cell
 * whose only child is fixed is 0px tall and photographs flat.
 */
export function NoCameraHere() {
  return (
    <div style={{ height: 760 }}>
      <BarcodeScanner onDetected={nothing} onClose={nothing} />
    </div>
  )
}

/**
 * The same screen at the size it is actually used at.
 *
 * The scanner is full-bleed, so across the width of a card the corner marks and
 * the two lines of text sit in the middle of a lot of black and read as
 * under-designed. A barcode is scanned with a phone in one hand, and this is
 * the frame that shape was drawn for.
 *
 * The transform on the wrapper is what confines it: the nearest transformed
 * ancestor is the containing block for a `fixed` child, so putting one here
 * takes that job off the card and the sheet fills the phone instead. Nothing in
 * the component changes.
 */
export function AtPhoneSize() {
  return (
    <div
      style={{
        transform: 'translateZ(0)',
        position: 'relative',
        width: 390,
        height: 760,
        overflow: 'hidden',
        borderRadius: 28,
      }}
    >
      <BarcodeScanner onDetected={nothing} onClose={nothing} />
    </div>
  )
}
