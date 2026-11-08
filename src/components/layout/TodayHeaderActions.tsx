import { Link } from 'react-router-dom'
import { PersonAvatar } from '../ui/PersonAvatar'
import { usePeople, useResolvedPerson } from '../../store/useHousehold'
import { useUiStore } from '../../store/useUiStore'
import { SETTINGS } from './nav'

/**
 * The right-hand end of Today's header: the household, then a gear.
 *
 * The gear is the phone's only way into Settings, which left the bottom bar;
 * from md up the sidebar has its own Settings link, so the gear stays a phone
 * thing.
 *
 * Each avatar says whose day Today is showing, the same choice Progress and
 * Movement make. The plan is shared, so the meals do not change with it; what
 * does is everything about a person, such as what they moved today. With one
 * person there is nothing to choose, and the avatar is only a picture.
 */
export default function TodayHeaderActions() {
  const people = usePeople()
  const viewing = useResolvedPerson(useUiStore((s) => s.viewingAs))
  const setViewingAs = useUiStore((s) => s.setViewingAs)
  const Gear = SETTINGS.icon
  const choosing = people.length > 1

  return (
    <div className="flex items-center shrink-0">
      <ul aria-label="Household" className="flex items-center">
        {people.map((p, i) => (
          <li key={p.id} className="flex items-center justify-center w-11 h-11">
            {choosing ? (
              <button
                type="button"
                aria-label={`Show ${p.name}`}
                aria-pressed={p.id === viewing}
                onClick={() => setViewingAs(p.id)}
                className="w-11 h-11 flex items-center justify-center rounded-full"
              >
                <PersonAvatar person={p} index={i} selected={p.id === viewing} />
              </button>
            ) : (
              <PersonAvatar person={p} index={i} label={p.name} />
            )}
          </li>
        ))}
      </ul>
      <Link
        to={SETTINGS.to}
        aria-label="Settings"
        className="md:hidden flex items-center justify-center w-11 h-11 rounded-[14px] text-ink-700
                   hover:bg-bite-50 hover:text-bite-700"
      >
        <Gear size={22} aria-hidden="true" />
      </Link>
    </div>
  )
}
