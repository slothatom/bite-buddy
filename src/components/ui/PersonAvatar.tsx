import type { Person } from '../../lib/people'
import { personInitial, personTone } from '../../lib/personTone'

/**
 * A person, as their initial in a circle of their colour.
 *
 * Decorative unless given a `label`: almost everywhere it sits next to the
 * person's name, and a screen reader saying "A, Arany" is noise. `index` is the
 * person's place in the household, which picks the colour for anyone other
 * than the two original people (see lib/personTone.ts).
 */
const SIZES = {
  // 12px is the floor for any text, an initial included.
  sm: 'w-5 h-5 text-xs',
  md: 'w-7 h-7 text-[13px]',
  lg: 'w-8 h-8 text-sm',
} as const

export function PersonAvatar({ person, index = 0, size = 'lg', selected = false, label, className = '' }: {
  person: Person
  index?: number
  size?: keyof typeof SIZES
  /** Ringed in bite-700, for "this is who you are looking at". */
  selected?: boolean
  label?: string
  className?: string
}) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={person.name}
      className={`inline-flex items-center justify-center shrink-0 rounded-full font-extrabold leading-none
                  ${SIZES[size]} ${personTone(person.id, index)}
                  ${selected ? 'ring-2 ring-bite-700 ring-offset-2 ring-offset-cream-50' : ''} ${className}`}
    >
      {personInitial(person.name, person.id)}
    </span>
  )
}

/**
 * The household, as a little overlapping stack of avatars. Each one wears a
 * ring of the surface it sits on, so the overlap reads as a cut.
 */
export function PersonStack({ people, size = 'md', ring = 'ring-paper' }: {
  people: readonly Person[]
  size?: keyof typeof SIZES
  /** The surface behind the stack, as a ring class. */
  ring?: string
}) {
  return (
    <span className="flex" aria-hidden="true">
      {people.map((p, i) => (
        <PersonAvatar
          key={p.id}
          person={p}
          index={i}
          size={size}
          className={`ring-2 ${ring} ${i ? '-ml-2' : ''}`}
        />
      ))}
    </span>
  )
}
