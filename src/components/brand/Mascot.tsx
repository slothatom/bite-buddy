import { useId } from 'react'

/**
 * Bite Buddy's mark: a big cheeky bite taken out of the logo itself.
 *
 * It draws the name rather than illustrating food, which is why it isn't a bowl
 * or a plate — those say "meal app", the chomp says *Bite* Buddy. It is one
 * silhouette with a heavy outline, so it survives being shrunk to a favicon.
 *
 * Drawn inline rather than shipped as an image so it inherits the theme colours
 * and scales cleanly at any size — 30px in the sidebar, 96px in an empty state.
 *
 * `mood` covers the three moments the app has to say something: everything is
 * fine, there is nothing here yet, and something went wrong.
 */
export type MascotMood = 'happy' | 'sleepy' | 'oops'

export default function Mascot({
  size = 64,
  mood = 'happy',
  className = '',
}: {
  size?: number
  mood?: MascotMood
  className?: string
}) {
  // Ids must be unique per instance, or a second copy on the page reuses the
  // first one's masks.
  const uid = useId().replace(/:/g, '')
  const outerMask = `chomp-outer-${uid}`
  const innerMask = `chomp-inner-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="Bite Buddy"
    >
      {/*
        The bite is cut twice, from two concentric copies: the dark body takes a
        smaller cut than the coloured body, so the bitten edge keeps the same
        outline weight as the rest of the mark. Masking a single stroked circle
        would leave the bite raw and unoutlined.
      */}
      <mask id={outerMask} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
        <rect width="64" height="64" fill="#fff" />
        <circle cx="49" cy="15" r="9" fill="#000" />
        <circle cx="56" cy="26" r="7" fill="#000" />
        <circle cx="39" cy="8" r="7" fill="#000" />
      </mask>
      <mask id={innerMask} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
        <rect width="64" height="64" fill="#fff" />
        <circle cx="49" cy="15" r="11.6" fill="#000" />
        <circle cx="56" cy="26" r="9.6" fill="#000" />
        <circle cx="39" cy="8" r="9.6" fill="#000" />
      </mask>

      {/* Leaf, tucked behind the body so the outline reads as one shape. */}
      <path
        d="M25 11c-1.5-5-5.5-8-11-8 1 5.5 5 8.5 11 8Z"
        className="text-brand-400"
        fill="currentColor"
        stroke="var(--color-ink)"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />

      <g mask={`url(#${outerMask})`}>
        <circle cx="31" cy="34" r="26" fill="var(--color-ink)" />
      </g>
      <g mask={`url(#${innerMask})`}>
        <circle cx="31" cy="34" r="23.4" className="text-clay-500" fill="currentColor" />
      </g>

      {/* Blush sits under the face so the eyes stay crisp over it. */}
      <ellipse cx="17" cy="41" rx="4.2" ry="3" className="text-clay-200" fill="currentColor" />

      {mood === 'sleepy' ? (
        <g stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round">
          <path d="M20 32c1.8 2.2 4.6 2.2 6.4 0" />
          <path d="M36.6 32c1.8 2.2 4.6 2.2 6.4 0" />
        </g>
      ) : (
        <>
          <circle cx="24" cy="32" r="4.1" fill="var(--color-ink)" />
          <circle cx="40" cy="32" r="4.1" fill="var(--color-ink)" />
          <circle cx="25.5" cy="30.4" r="1.5" fill="#fff" />
          <circle cx="41.5" cy="30.4" r="1.5" fill="#fff" />
        </>
      )}

      {mood === 'oops' ? (
        <ellipse cx="31" cy="44" rx="3.4" ry="2.8" fill="var(--color-ink)" />
      ) : (
        <path
          d={mood === 'sleepy' ? 'M26 43c1.5 2 3.3 3 5 3s3.5-1 5-3' : 'M23 42c2.3 3.5 5.3 5.2 9 5.2s6.7-1.7 9-5.2'}
          stroke="var(--color-ink)"
          strokeWidth="3.3"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

/** The wordmark: mark plus name, used in the sidebar and on the install screen. */
export function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Mascot size={size} />
      <span className="leading-none">
        <span className="block font-display font-semibold text-lg text-stone-700 leading-none">
          Bite Buddy
        </span>
        <span className="block text-[11px] text-stone-400 font-bold mt-0.5">
          your cosy kitchen
        </span>
      </span>
    </span>
  )
}
