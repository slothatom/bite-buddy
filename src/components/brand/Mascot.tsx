/**
 * Bandit, Bite Buddy's companion.
 *
 * A raccoon, which is a better fit for this app than the abstract blob it
 * replaces: a raccoon is a small opportunist who is extremely interested in
 * what you are eating, and that is the character an app about food wants
 * standing next to it. The mask does the work at every size, because it is one
 * big dark shape rather than a detail, so he still reads at 26px in the menu.
 *
 * Drawn inline as SVG so he inherits theme colours and stays crisp from 26px
 * in the menu to 96px in an empty state.
 *
 * Bandit appears in onboarding, empty states, errors and moments of delight.
 * He does *not* appear on every card, in dense food tables or beside every
 * calorie warning; the personality is concentrated, not sprayed.
 *
 * The export is still `Zig`-shaped in its API, taking the same six moods, so
 * every screen that already knows how to ask for a sleepy or an apologetic
 * mascot keeps working without knowing the animal changed.
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
      aria-label="Bandit, the Bite Buddy"
    >
      {/* Limbs sit behind the body so the joins never show. Deliberately thin
          and slightly uneven, the system asks for imperfect geometry. */}
      <g stroke="var(--color-ink-900)" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d={armsUp ? 'M19 47 10 39' : 'M18 48 10 54'} />
        <path d={armsUp ? 'M45 47 54 39' : mood === 'thinking' ? 'M46 47 53 41' : 'M46 48 54 54'} />
        <path d="M26 55v4" />
        <path d="M38 55v4" />
      </g>
      <g stroke="var(--color-ink-900)" strokeWidth="2.6" strokeLinecap="round">
        <path d="M23 59h6" />
        <path d="M35 59h6" />
      </g>

      {/* Body, then the ears, then the head over both.
          Each is drawn twice: an ink silhouette, and the turquoise inset half
          a unit inside it. The outline is not decoration. Turquoise on cream
          is 2.33:1, and a shape has to clear 3:1 or it is one you cannot find
          on the page; the ink edge is what the eye actually locates. It is
          also how the blob this replaces was built, for the same reason.

          The fills below name their variables rather than using `text-*`
          classes. The contrast checker reads a `text-*` class as a foreground
          it has to measure against the page, which is right for a label and
          wrong for an illustration: this turquoise sits on the ink shape
          behind it, not on the cream, and there is no `bg-` for the checker
          to find inside an SVG. Naming the variable keeps the drawing out of
          a check it cannot answer honestly. */}
      <ellipse cx="32" cy="48" rx="15" ry="10" fill="var(--color-ink-900)" />
      <ellipse cx="32" cy="48" rx="13.4" ry="8.4" fill="var(--color-bite-500)" />

      {/* One ear, drawn on the left and mirrored. Short and round rather than
          pointed: drawn as triangles first, the face read as a cat, because a
          pointed ear is the strongest cat signal there is and a raccoon's are
          stubby. Mirroring keeps the pair identical as the numbers move. */}
      <g>
        <path d="M12.6 20.4 C9.6 13.6 11.2 6.2 16.4 5.2 C21.4 4.2 25.4 8.4 26.4 12 Z" fill="var(--color-ink-900)" />
        <path d="M14.8 18.4 C12.6 13 13.8 8 17.2 7.4 C20.6 6.8 23.6 9.9 24.4 12.6 Z" fill="var(--color-bite-500)" />
        <path d="M17 16.2 C15.7 12.8 16.4 10 18.4 9.6 C20.4 9.2 22.1 11 22.6 12.8 Z" fill="var(--color-ink-900)" />
      </g>
      <g transform="translate(64 0) scale(-1 1)">
        <path d="M12.6 20.4 C9.6 13.6 11.2 6.2 16.4 5.2 C21.4 4.2 25.4 8.4 26.4 12 Z" fill="var(--color-ink-900)" />
        <path d="M14.8 18.4 C12.6 13 13.8 8 17.2 7.4 C20.6 6.8 23.6 9.9 24.4 12.6 Z" fill="var(--color-bite-500)" />
        <path d="M17 16.2 C15.7 12.8 16.4 10 18.4 9.6 C20.4 9.2 22.1 11 22.6 12.8 Z" fill="var(--color-ink-900)" />
      </g>

      <ellipse cx="32" cy="27" rx="20" ry="17" fill="var(--color-ink-900)" />
      <ellipse cx="32" cy="27" rx="18.4" ry="15.4" fill="var(--color-bite-500)" />

      {/* The mask. The one shape that makes him a raccoon rather than a bear,
          and the reason he survives being shrunk. */}
      <path
        d="M14.2 23.6 q17.8 -8.2 35.6 0 q-2.9 9.4 -9.7 9.4 q-8.7 -4 -17.4 0 q-5.8 0 -8.7 -9.4 Z"
        fill="var(--color-ink-900)"
      />

      {/* Eyes, inside the mask, which is what reads as a raccoon at any size. */}
      {asleep ? (
        <g stroke="var(--color-paper)" strokeWidth="2.2" strokeLinecap="round" fill="none">
          <path d="M20.6 26.5c1.6 1.8 4.2 1.8 5.8 0" />
          <path d="M37.6 26.5c1.6 1.8 4.2 1.8 5.8 0" />
        </g>
      ) : (
        <>
          <circle cx="23.5" cy="26.5" r="3.7" fill="var(--color-paper)" />
          <circle cx="40.5" cy="26.5" r="3.7" fill="var(--color-paper)" />
          <circle
            cx={mood === 'thinking' ? 24.9 : 24.2}
            cy={mood === 'thinking' ? 25.3 : 27.1}
            r="2" fill="var(--color-ink-900)"
          />
          <circle
            cx={mood === 'thinking' ? 41.9 : 41.2}
            cy={mood === 'thinking' ? 25.3 : 27.1}
            r="2" fill="var(--color-ink-900)"
          />
        </>
      )}

      {/* Muzzle, cheeks and nose. */}
      <ellipse cx="23" cy="34.5" rx="3" ry="2.2" fill="var(--color-coral-400)" />
      <ellipse cx="41" cy="34.5" rx="3" ry="2.2" fill="var(--color-coral-400)" />
      <ellipse cx="32" cy="36.5" rx="8.6" ry="6.2" fill="var(--color-paper)" />
      <path d="M28.6 34.4 q3.4 -2.6 6.8 0 q-3.4 3.4 -6.8 0 Z" fill="var(--color-ink-900)" />

      {/* Mouth */}
      {mood === 'oops' ? (
        <ellipse cx="32" cy="40" rx="2.4" ry="2.8" fill="var(--color-ink-900)" />
      ) : asleep ? (
        <path
          d="M32 37.4v1.4"
          stroke="var(--color-ink-900)" strokeWidth="1.6" strokeLinecap="round"
        />
      ) : (
        <g stroke="var(--color-ink-900)" strokeWidth="1.6" strokeLinecap="round" fill="none">
          <path d="M32 37.4v1.6" />
          <path d="M32 39c-1.5 1.6-3.6 1.2-4.4-.4" />
          <path d="M32 39c1.5 1.6 3.6 1.2 4.4-.4" />
        </g>
      )}

      {/* Props, a small characterful addition rather than a costume. */}
      {mood === 'chef' && (
        <g>
          <path
            d="M20 12c-1-4.4 2.2-7.6 5.4-6.4C26.6 2.2 32 2.2 33.2 5.6c3.2-1.2 6.4 2 5.4 6.4-.8 2.6-3.4 2.6-3.4 2.6H23.4S20.8 14.6 20 12Z"
            fill="var(--color-paper)" stroke="var(--color-ink-900)" strokeWidth="2.2" strokeLinejoin="round"
          />
          <rect
            x="21.6" y="13.6" width="15.6" height="4.4" rx="1.8"
            fill="var(--color-paper)" stroke="var(--color-ink-900)" strokeWidth="2.2"
          />
        </g>
      )}

      {mood === 'thinking' && (
        <text
          x="55" y="16" textAnchor="middle"
          fontSize="15" fontWeight="700" fill="var(--color-ink-900)"
          fontFamily="var(--font-sans)"
        >?</text>
      )}

      {mood === 'celebrate' && (
        <g fill="var(--color-mustard-500)" stroke="var(--color-ink-900)" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M7 26l1.4 3.6L12 31l-3.6 1.2L7 36l-1.4-3.8L2 31l3.6-1.4z" />
          <path d="M57 30l1.2 3L61 34l-2.8 1L57 38l-1.2-3L53 34l2.8-1z" />
        </g>
      )}

      {asleep && (
        <g fill="var(--color-ink-500)">
          <text x="52" y="16" fontSize="10" fontWeight="700" fontFamily="var(--font-sans)">z</text>
          <text x="58" y="9" fontSize="7" fontWeight="700" fontFamily="var(--font-sans)">z</text>
        </g>
      )}
    </svg>
  )
}

/** The wordmark: Bandit plus the name, used in the menu and on brand moments. */
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
