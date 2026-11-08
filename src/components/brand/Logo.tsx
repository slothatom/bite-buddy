/**
 * The Bitten B: Bite Buddy's logo.
 *
 * A capital B with a bite taken out of its upper bowl, and two crumbs flying
 * off where the teeth went. It is the brand mark: the header, the sidebar, the
 * sign-in screen, and (rendered to PNG by `npm run icons`) the app icon, the
 * tab icon and the iOS launch screens. Bandit, in Mascot.tsx, is still the
 * creature who lives in the app and reacts to things; this is the name on the
 * door.
 *
 * The paths are copied from the masters in `brand/` and inlined here rather
 * than loaded as an image, so the colours can come from the tokens in
 * index.css. An `<img>` cannot read a CSS variable, and a logo that stays
 * dark teal on a dark ground disappears exactly when someone turns the lights
 * down. Change a path there, change it here.
 *
 * Decorative by default. Every route's document title already says "Bite
 * Buddy", and a screen reader announcing it again from the header of every
 * screen is noise. Pass `title` for the one place the logo *is* the name: the
 * sign-in heading.
 */

/** The B, with its bite and its two counters, as one even-odd shape. */
const B =
  'M15.5 7.5 H36.469 A4.5 4.5 0 0 0 40.29 9.995 A7 7 0 0 0 47.606 14.974 A5 5 0 0 0 48.961 19.532 '
  + 'A14 13 0 0 1 44.626 29.94 A15 14 0 0 1 38 56.5 H15.5 A3 3 0 0 1 12.5 53.5 V10.5 A3 3 0 0 1 15.5 7.5 Z '
  + 'M26.5 16 H29.5 A4.5 4.5 0 0 1 29.5 25 H26.5 A4.5 4.5 0 0 1 26.5 16 Z '
  + 'M27.5 37 H31.5 A5.5 5.5 0 0 1 31.5 48 H27.5 A5.5 5.5 0 0 1 27.5 37 Z'

/** The two crumbs off to the right of the bite. */
const CRUMBS =
  'M55 6.5 A2 2 0 1 0 59 6.5 A2 2 0 1 0 55 6.5 Z M57.9 25 A1.6 1.6 0 1 0 61.1 25 A1.6 1.6 0 1 0 57.9 25 Z'

/** "bite buddy", lower case, drawn rather than set so it needs no font. */
const WORDS =
  'M-0.5 5 V40 A4.5 4.5 0 0 0 8.5 40 V5 A4.5 4.5 0 0 0 -0.5 5 Z M-0.5 28 A16.5 16.5 0 1 0 32.5 28 '
  + 'A16.5 16.5 0 1 0 -0.5 28 Z M8.5 28 A7.5 7.5 0 1 1 23.5 28 A7.5 7.5 0 1 1 8.5 28 Z M38.5 20 V40 '
  + 'A4.5 4.5 0 0 0 47.5 40 V20 A4.5 4.5 0 0 0 38.5 20 Z M58.5 7 L58.5 33 A11.5 11.5 0 0 0 70 44.5 '
  + 'L71 44.5 A4.5 4.5 0 0 0 71 35.5 L70 35.5 A2.5 2.5 0 0 1 67.5 33 L67.5 7 A4.5 4.5 0 0 0 58.5 7 Z '
  + 'M58 11.5 A4.5 4.5 0 0 0 58 20.5 H71 A4.5 4.5 0 0 0 71 11.5 Z M114.5 28 A16.5 16.5 0 1 0 109.667 39.667 '
  + 'A4.5 4.5 0 0 0 103.303 33.303 A7.5 7.5 0 1 1 105.5 28 Z M86 23.5 A4.5 4.5 0 0 0 86 32.5 H110 '
  + 'A4.5 4.5 0 0 0 110 23.5 Z M134.5 5 V40 A4.5 4.5 0 0 0 143.5 40 V5 A4.5 4.5 0 0 0 134.5 5 Z '
  + 'M134.5 28 A16.5 16.5 0 1 0 167.5 28 A16.5 16.5 0 1 0 134.5 28 Z M143.5 28 A7.5 7.5 0 1 1 158.5 28 '
  + 'A7.5 7.5 0 1 1 143.5 28 Z M173.5 16 L173.5 28 A16.5 16.5 0 0 0 206.5 28 L206.5 16 '
  + 'A4.5 4.5 0 0 0 197.5 16 L197.5 28 A7.5 7.5 0 0 1 182.5 28 L182.5 16 A4.5 4.5 0 0 0 173.5 16 Z '
  + 'M197.5 16 V40 A4.5 4.5 0 0 0 206.5 40 V16 A4.5 4.5 0 0 0 197.5 16 Z M212.5 28 A16.5 16.5 0 1 0 245.5 28 '
  + 'A16.5 16.5 0 1 0 212.5 28 Z M221.5 28 A7.5 7.5 0 1 1 236.5 28 A7.5 7.5 0 1 1 221.5 28 Z '
  + 'M236.5 5 V40 A4.5 4.5 0 0 0 245.5 40 V5 A4.5 4.5 0 0 0 236.5 5 Z M251.5 28 A16.5 16.5 0 1 0 284.5 28 '
  + 'A16.5 16.5 0 1 0 251.5 28 Z M260.5 28 A7.5 7.5 0 1 1 275.5 28 A7.5 7.5 0 1 1 260.5 28 Z '
  + 'M275.5 5 V40 A4.5 4.5 0 0 0 284.5 40 V5 A4.5 4.5 0 0 0 275.5 5 Z M290.5 16 L290.5 28 '
  + 'A16.5 16.5 0 0 0 323.5 28 L323.5 16 A4.5 4.5 0 0 0 314.5 16 L314.5 28 A7.5 7.5 0 0 1 299.5 28 '
  + 'L299.5 16 A4.5 4.5 0 0 0 290.5 16 Z M314.5 16 L314.5 44 A5.5 5.5 0 0 1 309 49.5 L303 49.5 '
  + 'A4.5 4.5 0 0 0 303 58.5 L309 58.5 A14.5 14.5 0 0 0 323.5 44 L323.5 16 A4.5 4.5 0 0 0 314.5 16 Z'

/** The dot on the i, in the mark's teal so the word and the B belong together. */
const TITTLE = 'M37.8 6.2 A5.2 5.2 0 1 0 48.2 6.2 A5.2 5.2 0 1 0 37.8 6.2 Z'

/*
 * Colours, as tokens, so dark mode is the tokens' job and not this file's.
 *
 * bite-700 is the deep teal on cream and turns to bite-300's light teal in
 * the dark block of index.css, which is the same swap the favicon makes with
 * its own media query. ink-900 inverts with the rest of the text. The crumbs
 * are mustard-600, which does not change: it is warm enough to read on both
 * grounds, and they are two dots, not words.
 *
 * `mono` paints everything in `currentColor`, for a spot where the logo has to
 * take the colour of whatever it sits in.
 */
function palette(mono: boolean) {
  return mono
    ? { mark: 'currentColor', crumbs: 'currentColor', words: 'currentColor' }
    : {
        mark: 'var(--color-bite-700)',
        crumbs: 'var(--color-mustard-600)',
        words: 'var(--color-ink-900)',
      }
}

interface LogoProps {
  /** `mark` is the B alone; `horizontal` is the B with the name beside it. */
  variant?: 'mark' | 'horizontal'
  /** Height in pixels. The width follows the artwork. */
  size?: number
  /** Gives the logo an accessible name. Leave unset where it is decoration. */
  title?: string
  /** Everything in `currentColor` instead of the brand tokens. */
  mono?: boolean
  className?: string
}

export default function Logo({
  variant = 'horizontal',
  size = 28,
  title,
  mono = false,
  className,
}: LogoProps) {
  const c = palette(mono)
  const a11y = title
    ? { role: 'img' as const, 'aria-label': title }
    : { 'aria-hidden': true as const, focusable: 'false' as const }

  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className={className}
        {...a11y}
      >
        <path fill={c.mark} fillRule="evenodd" d={B} />
        <path fill={c.crumbs} d={CRUMBS} />
      </svg>
    )
  }

  // The horizontal lockup's own viewBox, from brand/lockup-horizontal.svg.
  const w = 401.527
  const h = 61.551
  return (
    <svg
      viewBox={`0 -3.051 ${w} ${h}`}
      width={Math.round((size * w) / h)}
      height={size}
      className={className}
      {...a11y}
    >
      <g transform="translate(-14.796 -8.378) scale(1.184)">
        <path fill={c.mark} fillRule="evenodd" d={B} />
        <path fill={c.crumbs} d={CRUMBS} />
      </g>
      <g transform="translate(78.027 0)">
        <path fill={c.words} d={WORDS} />
        <path fill={c.mark} d={TITTLE} />
      </g>
    </svg>
  )
}
