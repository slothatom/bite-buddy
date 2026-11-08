import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useHousehold, useMyRole } from '../../store/useHousehold'
import { memberName, roleAtLeast, ROLE_HINTS, ROLE_LABELS, sortMembers } from '../../lib/household'
import { PersonAvatar } from '../ui/PersonAvatar'

/**
 * The household at a glance, beside every other Settings page on a wide
 * screen: who is in it and what each can do. Read-only; the changes are made
 * on the Household page it links to, so there is one place that does them.
 */
export function HouseholdAside({ className = '' }: { className?: string }) {
  const household = useHousehold((s) => s.household)
  const members = useHousehold((s) => s.members)
  const invites = useHousehold((s) => s.invites)
  const userId = useHousehold((s) => s.userId)
  const admin = roleAtLeast(useMyRole(), 'admin')
  const sorted = useMemo(() => sortMembers(members), [members])

  if (!household) return null

  return (
    <section
      aria-labelledby="aside-household"
      className={`bg-paper border border-border-200 rounded-card px-4.5 py-4 flex-col gap-3 ${className}`}
    >
      <div className="flex flex-col gap-0.5">
        <h2 id="aside-household" className="text-[15px] leading-5 font-extrabold text-ink-900">Household</h2>
        <p className="text-[13px] leading-[18px] text-ink-700">
          Everyone here shares the plan, the recipes and the shopping list.
        </p>
      </div>
      <ul aria-label="Household members" className="flex flex-col divide-y divide-border-100">
        {sorted.map((m, i) => {
          const name = memberName(m)
          return (
            <li key={m.userId} className="flex items-center gap-2.5 py-2.5">
              <PersonAvatar person={{ id: m.personKey, name }} index={i} size="lg" />
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-sm font-bold text-ink-900 truncate">
                  {name}{m.userId === userId && <span className="font-medium text-ink-700"> (you)</span>}
                </span>
                <span className="text-xs text-ink-700">{ROLE_HINTS[m.role].replace(/\.$/, '')}</span>
              </span>
              <span className="badge py-0.5 px-2 bg-bite-100 text-bite-700 font-extrabold">{ROLE_LABELS[m.role]}</span>
            </li>
          )
        })}
      </ul>
      {admin && (
        <p className="text-xs text-ink-700">
          {invites.length === 0 ? 'No invites waiting.'
            : `${invites.length} ${invites.length === 1 ? 'invite' : 'invites'} waiting.`}
        </p>
      )}
      <Link
        to="/settings/household"
        className="btn min-h-11 rounded-lg border border-bite-700 text-bite-700 hover:bg-bite-50"
      >
        {admin ? <><UserPlus size={16} aria-hidden="true" /> Invite someone</> : 'See the household'}
      </Link>
    </section>
  )
}
