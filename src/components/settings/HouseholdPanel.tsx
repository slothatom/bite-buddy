import { useState } from 'react'
import { AlertTriangle, Mail, UserMinus, X } from 'lucide-react'
import { SectionHeading } from '../ui'
import { useHousehold, useMyRole, type ActionResult } from '../../store/useHousehold'
import {
  canChange, memberName, roleAtLeast, ROLE_HINTS, ROLE_LABELS, ROLES, type Role,
} from '../../lib/household'

/**
 * Who is in the household, and what each of them can do.
 *
 * Everyone sees the list. An admin also gets the controls: invite by email
 * with a role, change a role, remove someone, take back an invite. The
 * database enforces every one of those (see the households migration), so
 * what is hidden here is hidden to keep the screen honest, not to keep anyone
 * out.
 */
export function HouseholdPanel() {
  const { household, members, invites, userId, invite, revokeInvite, setRole, remove } = useHousehold()
  const myRole = useMyRole()
  const admin = roleAtLeast(myRole, 'admin')

  const [email, setEmail] = useState('')
  const [role, setNewRole] = useState<Role>('editor')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function run(what: () => Promise<ActionResult>, done: string) {
    setBusy(true)
    setMessage(null)
    const result = await what()
    setBusy(false)
    setMessage(result.ok ? { ok: true, text: done } : { ok: false, text: result.error ?? 'That did not work.' })
    return result.ok
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault()
    const address = email.trim()
    if (!address || busy) return
    const ok = await run(() => invite(address, role),
      `Invited ${address}. They join when they sign in with that email.`)
    if (ok) setEmail('')
  }

  if (!household) return null

  return (
    <section>
      <SectionHeading>Household</SectionHeading>
      <div className="card p-4 space-y-4">
        <p className="text-sm text-ink-700">
          <strong>{household.name}</strong>. Everyone here shares the plan, the recipes and the
          shopping list. {myRole && <>You are {ROLE_LABELS[myRole].toLowerCase()}: {ROLE_HINTS[myRole].toLowerCase()}</>}
        </p>

        <ul className="divide-y divide-border-200" aria-label="Members">
          {members.map((m) => {
            const can = canChange(members, m, myRole)
            const me = m.userId === userId
            return (
              <li key={m.userId} className="py-2 flex flex-wrap items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 truncate">
                    {memberName(m)}{me && <span className="text-ink-500 font-normal"> (you)</span>}
                  </p>
                  {m.email && <p className="text-xs text-ink-500 break-all">{m.email}</p>}
                </div>
                {admin && can.role ? (
                  <select
                    className="input w-auto"
                    aria-label={`Role for ${memberName(m)}`}
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => void run(() => setRole(m.userId, e.target.value as Role),
                      `${memberName(m)} is now ${ROLE_LABELS[e.target.value as Role].toLowerCase()}.`)}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                ) : (
                  <span className="text-xs font-semibold text-ink-700">{ROLE_LABELS[m.role]}</span>
                )}
                {admin && can.remove && !me && (
                  <button
                    className="btn-ghost text-ink-500 hover:text-coral-600"
                    aria-label={`Remove ${memberName(m)}`}
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Remove ${memberName(m)} from ${household.name}? They lose access straight away. Their entries stay.`)) return
                      void run(() => remove(m.userId), `${memberName(m)} was removed.`)
                    }}
                  >
                    <UserMinus size={15} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        {admin && invites.length > 0 && (
          <div>
            <p className="label">Invited, not joined yet</p>
            <ul className="space-y-1" aria-label="Pending invites">
              {invites.map((i) => (
                <li key={i.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 min-w-0 break-all text-ink-700">{i.email}</span>
                  <span className="text-xs text-ink-500">{ROLE_LABELS[i.role]}</span>
                  <button
                    className="btn-ghost text-ink-500 hover:text-coral-600"
                    aria-label={`Cancel the invite for ${i.email}`}
                    disabled={busy}
                    onClick={() => void run(() => revokeInvite(i.id), `The invite for ${i.email} was cancelled.`)}
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {admin && (
          <form onSubmit={onInvite} className="space-y-2">
            <label className="label" htmlFor="invite-email">Invite someone</label>
            <div className="flex flex-wrap gap-2">
              <input
                id="invite-email"
                type="email"
                className="input flex-1 min-w-[12rem]"
                placeholder="their@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <select
                className="input w-auto"
                aria-label="Their role"
                value={role}
                onChange={(e) => setNewRole(e.target.value as Role)}
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button type="submit" className="btn-secondary shrink-0" disabled={busy || !email.trim()}>
                <Mail size={15} /> Invite
              </button>
            </div>
            <p className="text-xs text-ink-500">{ROLE_HINTS[role]} They sign in with that email and are in.</p>
          </form>
        )}

        {message && (
          <p className={`flex items-start gap-2 text-sm ${message.ok ? 'text-leaf-600' : 'text-coral-600'}`} role="status">
            {!message.ok && <AlertTriangle size={15} className="shrink-0 mt-0.5" />} {message.text}
          </p>
        )}
      </div>
    </section>
  )
}
