/**
 * Bandit, Bite Buddy's companion.
 *
 * A raccoon, which is a better fit for this app than the abstract blob it
 * replaced: a raccoon is a small opportunist who is extremely interested in
 * what you are eating, and that is the character an app about food wants
 * standing next to it.
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
 *
 * What makes him read as cute rather than merely small is proportion, not
 * decoration, so the numbers are the design:
 *
 *  - **The head is most of him.** 21x18.5 against a 14x11 body. Infant
 *    proportions are the whole trick; a realistic raccoon head on a realistic
 *    body reads as wildlife rather than as a companion.
 *  - **The eyes are enormous.** 5.2 radius in a 21-wide head, where they were
 *    3.7. Each carries a highlight up and to the left, which is what stops a
 *    round pupil looking like a button.
 *  - **A dark band on a pale face, not patches on a grey one.** This is the
 *    line between a raccoon and a panda, and it is arrangement rather than
 *    outline: isolated dark ovals on uniform fur read panda at any shape, so
 *    the face carries its own pale field and one continuous band crosses it.
 *  - **The tail is the signature.** The old drawing had none, which threw away
 *    the one shape that says raccoon from across a room. It is a single curve
 *    stroked three times - dark rim, fur, then a dashed dark stroke for the
 *    rings - so the rings follow the curve for free.
 *  - **The paws are solid and dark.** Chunky ellipses rather than hairlines:
 *    thin limbs on a round body read as an insect.
 *
 * The fur greys are literals that do not invert (see `--color-fur-*` in
 * index.css, and the note there about why). The turquoise is his, though: the
 * inner ears and the neckerchief are where the brand shows, and the
 * neckerchief is drawn last so it survives being shrunk to a single turquoise
 * note under the chin of a 26px mascot.
 *
 * The fills name their variables rather than using `text-*` classes. The
 * contrast checker reads a `text-*` class as a foreground it has to measure
 * against the page, which is right for a label and wrong for an illustration:
 * there is no `bg-` for it to find inside an SVG. Naming the variable keeps
 * the drawing out of a check it cannot answer honestly.
 */
export type ZigMood = 'happy' | 'sleepy' | 'oops' | 'chef' | 'celebrate' | 'thinking'

/** One ear: dark rim, fur inside it, and the brand in the middle. */
function Ear({ cx }: { cx: number }) {
  return (
    <g>
      <circle cx={cx} cy={12.5} r="7.6" fill="var(--color-fur-800)" />
      <circle cx={cx} cy={12.5} r="5.8" fill="var(--color-fur-400)" />
      <circle cx={cx} cy={13.2} r="2.4" fill="var(--color-bite-400)" />
    </g>
  )
}

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

  /* Pupils drift up for thinking and sit level otherwise. The highlight
     travels with them, or it detaches and he looks glassy. */
  const pupilY = mood === 'thinking' ? 23.4 : 25.4

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
      {/* The tail, behind everything. One curve stroked three times: the dark
          rim, the fur, then the same path again with a dash pattern, which is
          what makes the rings sit along the curve instead of being placed one
          by one. The round cap leaves the tip dark, which is how a raccoon's
          tail ends. */}
      <g fill="none" strokeLinecap="round">
        <path d="M42.5 52 C56 53 61 43 57 29.5" stroke="var(--color-fur-800)" strokeWidth="10.2" />
        <path d="M42.5 52 C56 53 61 43 57 29.5" stroke="var(--color-fur-400)" strokeWidth="9.2" />
        <path
          d="M42.5 52 C56 53 61 43 57 29.5"
          stroke="var(--color-fur-800)"
          strokeWidth="9.2"
          strokeDasharray="4 6.2"
          strokeDashoffset="-7.5"
        />
      </g>

      {/* Arms. Chunky strokes with round caps - the old hairlines made a round
          body look like it had wires pinned to it. */}
      <g stroke="var(--color-fur-800)" strokeWidth="5.2" strokeLinecap="round" fill="none">
        <path d={armsUp ? 'M22 48 15 38' : 'M21 48 15 53'} />
        <path d={armsUp ? 'M42 48 49 38' : mood === 'thinking' ? 'M43 48 49 42' : 'M43 48 49 53'} />
      </g>

      {/* Body, then the belly over it. */}
      <ellipse cx="32" cy="48" rx="14" ry="11" fill="var(--color-fur-800)" />
      <ellipse cx="32" cy="48" rx="12.4" ry="9.5" fill="var(--color-fur-400)" />
      <ellipse cx="32" cy="50.5" rx="7.6" ry="7" fill="var(--color-fur-100)" />

      {/* Paws. */}
      <ellipse cx="25" cy="57.4" rx="4.4" ry="2.9" fill="var(--color-fur-800)" />
      <ellipse cx="39" cy="57.4" rx="4.4" ry="2.9" fill="var(--color-fur-800)" />

      {/* Ears behind the head, so the head's own edge trims them. */}
      <Ear cx={16} />
      <Ear cx={48} />

      <ellipse cx="32" cy="25" rx="21" ry="18.5" fill="var(--color-fur-800)" />
      <ellipse cx="32" cy="25" rx="19.4" ry="16.9" fill="var(--color-fur-400)" />

      {/* The pale face, and then the mask across it. This pair is the whole
          difference between a raccoon and a panda, and it took three attempts
          to get right.

          A panda is isolated dark ovals on a pale face. A raccoon is one dark
          BAND across a pale face, running ear to ear with pale above it and
          pale below. Drawing two patches on a uniformly grey face - which is
          what this was first - produces a panda however the patches are
          shaped, because the eye is reading the arrangement, not the outline.
          So the face gets its own pale field, and the mask is a single
          continuous shape laid over it, pinched at the bridge and dropping to
          cup each eye. */}
      <ellipse cx="32" cy="29" rx="16.6" ry="13.4" fill="var(--color-fur-100)" />
      <path
        d="M14.4 24.2 Q21 16.8 32 21.2 Q43 16.8 49.6 24.2 Q47.6 33.4 40.4 33.6
           Q32 29.4 23.6 33.6 Q16.4 33.4 14.4 24.2 Z"
        fill="var(--color-fur-800)"
      />

      {/* Eyes. Big, with a highlight up and to the left of each pupil. */}
      {asleep ? (
        <g stroke="var(--color-fur-100)" strokeWidth="2.4" strokeLinecap="round" fill="none">
          <path d="M19.9 25.4c1.9 2.2 5 2.2 6.9 0" />
          <path d="M37.1 25.4c1.9 2.2 5 2.2 6.9 0" />
        </g>
      ) : (
        <>
          <circle cx="23.4" cy="25.4" r="5" fill="var(--color-paper)" />
          <circle cx="40.6" cy="25.4" r="5" fill="var(--color-paper)" />
          <circle cx="23.8" cy={pupilY} r="2.9" fill="var(--color-fur-800)" />
          <circle cx="41.4" cy={pupilY} r="2.9" fill="var(--color-fur-800)" />
          <circle cx="22.6" cy={pupilY - 1.2} r="1.2" fill="var(--color-paper)" />
          <circle cx="40.2" cy={pupilY - 1.2} r="1.2" fill="var(--color-paper)" />
        </>
      )}

      {/* Cheeks sit on the fur, just outside the muzzle. */}
      <ellipse cx="19.8" cy="36" rx="3.3" ry="2.4" fill="var(--color-coral-400)" />
      <ellipse cx="44.2" cy="36" rx="3.3" ry="2.4" fill="var(--color-coral-400)" />

      {/* Muzzle and nose. */}
      <ellipse cx="32" cy="36" rx="8.2" ry="6" fill="var(--color-paper)" />
      <path d="M29 33.4 q3 -2.3 6 0 q-3 3 -6 0 Z" fill="var(--color-fur-800)" />

      {/* Mouth */}
      {mood === 'oops' ? (
        <ellipse cx="32" cy="39.2" rx="2.3" ry="2.7" fill="var(--color-fur-800)" />
      ) : asleep ? (
        <path
          d="M32 36.4v1.3"
          stroke="var(--color-fur-800)" strokeWidth="1.6" strokeLinecap="round"
        />
      ) : (
        <g stroke="var(--color-fur-800)" strokeWidth="1.6" strokeLinecap="round" fill="none">
          <path d="M32 36.4v1.5" />
          <path d="M32 37.9c-1.5 1.6-3.6 1.2-4.4-.4" />
          <path d="M32 37.9c1.5 1.6 3.6 1.2 4.4-.4" />
        </g>
      )}

      {/* The neckerchief: where the brand sits on him. Last, so that at 26px in
          a menu it is still a clear turquoise note under the chin. */}
      <path
        d="M23.6 40.6 Q32 44.4 40.4 40.6 L36.4 47.6 Q32 49.4 27.6 47.6 Z"
        fill="var(--color-bite-500)"
        stroke="var(--color-fur-800)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Props, a small characterful addition rather than a costume. */}
      {mood === 'chef' && (
        <g>
          <path
            d="M20 10c-1-4.4 2.2-7.6 5.4-6.4C26.6.2 32 .2 33.2 3.6c3.2-1.2 6.4 2 5.4 6.4-.8 2.6-3.4 2.6-3.4 2.6H23.4S20.8 12.6 20 10Z"
            fill="var(--color-paper)" stroke="var(--color-fur-800)" strokeWidth="2.2" strokeLinejoin="round"
          />
          <rect
            x="21.6" y="11.6" width="15.6" height="4.4" rx="1.8"
            fill="var(--color-paper)" stroke="var(--color-fur-800)" strokeWidth="2.2"
          />
        </g>
      )}

      {mood === 'thinking' && (
        <text
          x="57" y="14" textAnchor="middle"
          fontSize="15" fontWeight="700" fill="var(--color-ink-900)"
          fontFamily="var(--font-sans)"
        >?</text>
      )}

      {mood === 'celebrate' && (
        <g fill="var(--color-mustard-500)" stroke="var(--color-fur-800)" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M7 24l1.4 3.6L12 29l-3.6 1.2L7 34l-1.4-3.8L2 29l3.6-1.4z" />
          <path d="M58 26l1.2 3L62 30l-2.8 1L58 34l-1.2-3L54 30l2.8-1z" />
        </g>
      )}

      {asleep && (
        <g fill="var(--color-ink-500)">
          <text x="52" y="14" fontSize="10" fontWeight="700" fontFamily="var(--font-sans)">z</text>
          <text x="58" y="7" fontSize="7" fontWeight="700" fontFamily="var(--font-sans)">z</text>
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
