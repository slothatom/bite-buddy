/**
 * Bite Buddy's mascot: a little bowl with a face.
 *
 * Drawn inline rather than shipped as an image so it inherits the theme colours
 * and scales cleanly at any size — it appears at 28px in the sidebar and at
 * 96px in empty states.
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
      {/* Steam — only when there is something in the bowl to steam. */}
      {mood === 'happy' && (
        <g className="text-brand-300" fill="none" strokeWidth="2.4" strokeLinecap="round">
          <path d="M24 18c3-2 3-4 0-6s-3-4 0-5" stroke="currentColor" />
          <path d="M32 18c3-2.5 3-5 0-7.5s-3-5 0-6.5" stroke="currentColor" />
          <path d="M40 18c3-2 3-4 0-6s-3-4 0-5" stroke="currentColor" />
        </g>
      )}

      {/* Contents, peeking over the rim. */}
      <circle cx="24" cy="30" r="5" className="text-clay-300" fill="currentColor" />
      <circle cx="33" cy="28" r="6" className="text-butter-300" fill="currentColor" />
      <circle cx="42" cy="30" r="5" className="text-brand-300" fill="currentColor" />

      {/* The bowl. */}
      <path
        d="M8 32h48c0 13.255-10.745 22-24 22S8 45.255 8 32Z"
        className="text-brand-500"
        fill="currentColor"
      />
      {/* Rim highlight, so the bowl reads as ceramic rather than flat. */}
      <path d="M8 32h48" className="text-brand-600" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />

      {/* Face. */}
      {mood === 'sleepy' ? (
        <>
          <path d="M22 40.5c1.6 1.6 4.2 1.6 5.8 0" className="text-brand-800" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M36.2 40.5c1.6 1.6 4.2 1.6 5.8 0" className="text-brand-800" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="25" cy="41" r="2.6" className="text-brand-800" fill="currentColor" />
          <circle cx="39" cy="41" r="2.6" className="text-brand-800" fill="currentColor" />
        </>
      )}

      {mood === 'oops' ? (
        <ellipse cx="32" cy="47" rx="3" ry="2.4" className="text-brand-800" fill="currentColor" />
      ) : (
        <path
          d="M28 46.5c1.2 1.4 2.6 2.1 4 2.1s2.8-.7 4-2.1"
          className="text-brand-800"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      )}

      {/* Cheeks. */}
      <ellipse cx="19.5" cy="45" rx="3.2" ry="2.4" className="text-clay-300" fill="currentColor" />
      <ellipse cx="44.5" cy="45" rx="3.2" ry="2.4" className="text-clay-300" fill="currentColor" />
    </svg>
  )
}

/** The wordmark: mascot plus name, used in the sidebar and on the install screen. */
export function Wordmark({ size = 30 }: { size?: number }) {
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
