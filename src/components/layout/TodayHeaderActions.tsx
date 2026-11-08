import { Link } from 'react-router-dom'
import { PersonAvatar } from '../ui/PersonAvatar'
import { usePeople } from '../../store/useHousehold'
import { SETTINGS } from './nav'

/**
 * The right-hand end of Today's header: the household, then a gear.
 *
 * The gear is the phone's only way into Settings, which left the bottom bar;
 * from md up the sidebar has its own Settings link, so the gear stays a phone
 * thing. The avatars only show who is here for now. Choosing whose day Today
 * shows is a later change, and will turn each one into a button.
 */
export default function TodayHeaderActions() {
  const people = usePeople()
  const Gear = SETTINGS.icon

  return (
    <div className="flex items-center shrink-0">
      <ul aria-label="Household" className="flex items-center">
        {people.map((p, i) => (
          <li key={p.id} className="flex items-center justify-center w-11 h-11">
            <PersonAvatar person={p} index={i} label={p.name} />
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
