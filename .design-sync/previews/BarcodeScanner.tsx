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
 */
export function NoCameraHere() {
  return <BarcodeScanner onDetected={nothing} onClose={nothing} />
}

/**
 * The same screen at the size it is actually used at.
 *
 * The scanner is full-bleed and fixed, so at 1100 px wide the corner marks and
 * the two lines of text sit in the middle of a lot of black and read as
 * under-designed. A barcode is scanned with a phone in one hand, and this is
 * the frame that shape was drawn for.
 *
 * The transform on the wrapper is what confines it: a transformed ancestor
 * becomes the containing block for `position: fixed` children, so the sheet
 * fills the phone rather than the card. Nothing in the component changes.
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
