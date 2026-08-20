import { useId } from 'react'

/**
 * Zig, Bite Buddy's companion.
 *
 * An abstract bite-shaped creature, deliberately not a bowl, a plate or a piece
 * of food: the silhouette is a lumpy blob with a bite taken out of one shoulder,
 * so the name is in the shape rather than illustrated literally.
 *
 * Drawn inline as SVG so it inherits theme colours and stays crisp from 30px in
 * the sidebar to 96px in an empty state. The bite is cut from two offset copies
 *, the ink body takes a smaller cut than the purple body, so the bitten edge
 * keeps the same outline weight as the rest of the silhouette.
 *
 * Zig appears in onboarding, empty states, errors and moments of delight. He
 * does *not* appear on every card, in dense food tables or beside every calorie
 * warning; the personality is concentrated, not sprayed.
 */
export type ZigMood = 'happy' | 'sleepy' | 'oops' | 'chef' | 'celebrate' | 'thinking'

export default function Zig({
  size = 64,
  mood = 'happy',
  className = '',
}: {
  size?: number
  mood?: ZigMood
  className?: string
}) {
  // Ids must be unique per instance, or a second Zig on the page reuses the
  // first one's masks.
  const uid = useId().replace(/:/g, '')
  const outer = `zig-o-${uid}`
  const inner = `zig-i-${uid}`

  const asleep = mood === 'sleepy'
  const armsUp = mood === 'celebrate'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="Zig, the Bite Buddy"
    >
      <mask id={outer} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
        <rect width="64" height="64" fill="#fff" />
        <circle cx="52" cy="17" r="7.5" fill="#000" />
        <circle cx="45" cy="9" r="6" fill="#000" />
      </mask>
      <mask id={inner} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
        <rect width="64" height="64" fill="#fff" />
        <circle cx="52" cy="17" r="9.6" fill="#000" />
        <circle cx="45" cy="9" r="8.1" fill="#000" />
      </mask>

      {/* Limbs sit behind the body so the joins never show. Deliberately thin
          and slightly uneven, the system asks for imperfect geometry. */}
      <g stroke="var(--color-ink-900)" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d={armsUp ? 'M15 34 6 25' : 'M15 35 7 41'} />
        <path d={armsUp ? 'M49 36 58 27' : mood === 'thinking' ? 'M48 36 55 30' : 'M49 37 57 43'} />
        <path d="M25 50v8" />
        <path d="M38 50v9" />
      </g>
      <g stroke="var(--color-ink-900)" strokeWidth="2.6" strokeLinecap="round">
        <path d="M22 58h6" />
        <path d="M35 59h6" />
      </g>

      {/* Body: ink silhouette, then the purple body inset inside it. */}
      <g mask={`url(#${outer})`}>
        <path
          d="M31 5c10-1 18 5 20 14 2 9 4 12 3 19-1 9-9 15-18 16-11 1-20-4-23-12-3-9-2-14-1-21C13 12 21 6 31 5Z"
          fill="var(--color-ink-900)"
        />
      </g>
      <g mask={`url(#${inner})`}>
        <path
          d="M31 8c8.6-.9 15.6 4.3 17.3 12.1 1.7 7.8 3.4 10.4 2.6 16.4-.9 7.8-7.8 13-15.6 13.9-9.5.9-17.3-3.5-19.9-10.4-2.6-7.8-1.7-12.1-.9-18.2C15.6 14.1 22.4 8.9 31 8Z"
          className="text-bite-500"
          fill="currentColor"
        />
      </g>

      {/* Cheeks, under the face so the features stay crisp. */}
      <ellipse cx="19" cy="35" rx="3.6" ry="2.6" className="text-coral-400" fill="currentColor" />
      <ellipse cx="42" cy="36" rx="3.6" ry="2.6" className="text-coral-400" fill="currentColor" />

      {/* Eyes */}
      {asleep ? (
        <g stroke="var(--color-ink-900)" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M22 27c1.6 1.8 4.2 1.8 5.8 0" />
          <path d="M34 27c1.6 1.8 4.2 1.8 5.8 0" />
        </g>
      ) : (
        <>
          <ellipse cx="25" cy="27" rx="3.4" ry="3.8" fill="var(--color-ink-900)" />
          <ellipse cx="37" cy="27" rx="3.4" ry="3.8" fill="var(--color-ink-900)" />
          <circle cx="26.2" cy="25.6" r="1.2" fill="#fff" />
          <circle cx="38.2" cy="25.6" r="1.2" fill="#fff" />
        </>
      )}

      {/* Mouth */}
      {mood === 'oops' ? (
        <ellipse cx="31" cy="38" rx="3.2" ry="3.8" fill="var(--color-ink-900)" />
      ) : mood === 'sleepy' ? (
        <path d="M27 37c1.4 1.6 3 2.4 4.4 2.4s3-.8 4.4-2.4" stroke="var(--color-ink-900)" strokeWidth="2.4" strokeLinecap="round" />
      ) : (
        <g>
          <path
            d="M23 36c1.4 5 4.6 7.6 8.4 7.6S38.4 41 39.8 36Z"
            fill="var(--color-ink-900)"
          />
          <path d="M28.5 42.6c.9-1.6 4.2-1.6 5.1 0-.7 1-4.4 1-5.1 0Z" className="text-coral-400" fill="currentColor" />
        </g>
      )}

      {/* Props, a small, characterful addition rather than a costume. */}
      {mood === 'chef' && (
        <g>
          <path
            d="M20 12c-1-4 2-7 5-6 1-3 6-3 7 0 3-1 6 2 5 6-1 3-4 3-4 3H24s-3 0-4-3Z"
            fill="#fff" stroke="var(--color-ink-900)" strokeWidth="2.4" strokeLinejoin="round"
          />
          <path d="M23 15h11" stroke="var(--color-ink-900)" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}

      {mood === 'thinking' && (
        <text
          x="53" y="16" textAnchor="middle"
          fontSize="15" fontWeight="700" fill="var(--color-ink-900)"
          fontFamily="var(--font-sans)"
        >?</text>
      )}

      {mood === 'celebrate' && (
        <g className="text-mustard-500" fill="currentColor" stroke="var(--color-ink-900)" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M9 12l1.4 3.6L14 17l-3.6 1.2L9 22l-1.4-3.8L4 17l3.6-1.4z" />
          <path d="M56 44l1.2 3L60 48l-2.8 1L56 52l-1.2-3L52 48l2.8-1z" />
        </g>
      )}

      {asleep && (
        <g className="text-ink-500" fill="currentColor">
          <text x="50" y="16" fontSize="10" fontWeight="700" fontFamily="var(--font-sans)">z</text>
          <text x="56" y="9" fontSize="7" fontWeight="700" fontFamily="var(--font-sans)">z</text>
        </g>
      )}
    </svg>
  )
}

/** The wordmark: Zig plus the name, used in the sidebar and on brand moments. */
export function Wordmark({ size = 38 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Zig size={size} />
      <span className="leading-none">
        <span className="block display text-base text-ink-900 leading-none">Bite Buddy</span>
        <span className="block text-[10px] text-ink-500 font-bold mt-1 tracking-wide">
          fuel good
        </span>
      </span>
    </span>
  )
}
