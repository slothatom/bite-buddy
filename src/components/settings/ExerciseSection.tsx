import { useUiStore } from '../../store/useUiStore'
import { usePeople, useResolvedPerson } from '../../store/useHousehold'
import { SectionHeading } from '../ui'

/**
 * Whose exercise Home and Progress show. Only offered when there is more than
 * one person to choose between.
 */
export function ExerciseSection() {
  // The same person the rest of the app is showing figures for, so setting a
  // target and then reading it back are about the same human being.
  const people = usePeople()
  const whose = useResolvedPerson(useUiStore((s) => s.viewingAs))
  const setViewingAs = useUiStore((s) => s.setViewingAs)

  if (people.length <= 1) return null

  return (
    <section>
      <SectionHeading>Whose exercise</SectionHeading>
      {/* All that is left of a switch that used to sit on three screens.
          Food is one target now, because the household cooks once. What
          somebody did in a gym is not shared, and Home and Progress have
          to show one person's, so this says which. Movement itself, and
          Body, are per person on their own screens and ignore this. */}
      <p className="text-sm text-ink-700 mb-3">
        Home and Progress show one person's sessions and steps. This is who.
        The Movement and Body screens ask for themselves.
      </p>
      <div className="flex gap-1 p-1 bg-cream-50 rounded-xl w-fit" role="tablist">
        {people.map((person) => (
          <button
            key={person.id}
            role="tab"
            aria-selected={whose === person.id}
            aria-label={`Show ${person.name}'s exercise on Home and Progress`}
            onClick={() => setViewingAs(person.id)}
            className={whose === person.id ? 'tab-on' : 'tab-off'}
          >
            {person.name}
          </button>
        ))}
      </div>
    </section>
  )
}
