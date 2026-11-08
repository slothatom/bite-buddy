import type { UserProfile, WeekStart } from '../../types'
import { useUserStore } from '../../store/useUserStore'
import { SectionHeading } from '../ui'

const WEEKDAYS: { value: WeekStart; label: string }[] = [
  { value: 1, label: 'Monday' }, { value: 2, label: 'Tuesday' }, { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' }, { value: 5, label: 'Friday' }, { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

/** Your name, the day the week starts on, and the weight unit. The look has its own page. */
export function WeekSection() {
  const { profile, setName, setWeekStart, setWeightUnit } = useUserStore()

  return (
    <section>
      <SectionHeading>Your week</SectionHeading>
      <div className="card p-4 space-y-4">
        <div>
          <label className="label" htmlFor="profile-name">Name</label>
          <input id="profile-name" className="input" value={profile.name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="week-start">Week starts on</label>
          <select id="week-start" className="input" value={profile.weekStartsOn}
            onChange={(e) => setWeekStart(Number(e.target.value) as WeekStart)}>
            {WEEKDAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          <p className="text-xs text-ink-500 mt-1">
            Monday to Sunday by default. Your dietician's own plans ran Wednesday to
            Tuesday; loading one lines its days up by weekday either way.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="weight-unit">Weights read in</label>
          <select
            id="weight-unit"
            className="input"
            value={profile.weightUnit}
            onChange={(e) => setWeightUnit(e.target.value as UserProfile['weightUnit'])}
          >
            <option value="kg">Kilograms</option>
            <option value="lbs">Pounds</option>
          </select>
          <p className="text-xs text-ink-500 mt-1">
            {/* The reassurance is the point. This setting has existed as a
                field since the beginning with nothing to change it, and the
                body screen printed the stored number with whatever this
                said next to it, so making it settable without saying what
                it touches would look like a switch that rewrites your
                history. It does not: every entry keeps the unit you typed
                it in, and this changes the reading. */}
            Changes how weights are shown, not what was saved. Every entry keeps the unit you
            typed it in, and one logged in the other unit says so beside it.
          </p>
        </div>
      </div>
    </section>
  )
}
