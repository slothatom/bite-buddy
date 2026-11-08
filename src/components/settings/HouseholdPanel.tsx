import { useMemo, useState } from 'react'
import { AlertTriangle, Mail, Send, UserMinus, X } from 'lucide-react'
import { useHousehold, useMyRole, type ActionResult } from '../../store/useHousehold'
import {
  canChange, memberName, roleAtLeast, ROLE_HINTS, ROLE_LABELS, ROLES, sortMembers, type Role,
} from '../../lib/household'
import { PersonAvatar } from '../ui/PersonAvatar'
import { SettingsGroup } from './SettingsList'

const SELECT = 'min-h-11 px-2.5 rounded-lg border border-border-200 bg-paper text-ink-900 text-sm font-bold'

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
  // Oldest first, the same order the people are numbered in, so each avatar
  // wears the colour it wears everywhere else.
  const sorted = useMemo(() => sortMembers(members), [members])

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
    <div className="flex flex-col gap-3.5">
      <p className="mx-1 text-sm text-ink-700">
        <strong className="text-ink-900">{household.name}</strong>. Everyone here shares the plan,
        the recipes and the shopping list.
      </p>

      <SettingsGroup id="people-heading" title="People">
        <ul
          aria-label="Members"
          className="bg-paper border border-border-200 rounded-card overflow-hidden divide-y divide-border-100"
        >
          {sorted.map((m, i) => {
            const can = canChange(members, m, myRole)
            const me = m.userId === userId
            const name = memberName(m)
            return (
              <li key={m.userId} className="px-3.5 py-3 flex flex-wrap items-center gap-3">
                <PersonAvatar person={{ id: m.personKey, name }} index={i} size="xl" />
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[15px] leading-5 font-bold text-ink-900 truncate">
                    {name}{me && <span className="font-medium text-ink-700"> (you)</span>}
                  </span>
                  <span className="text-xs text-ink-700 break-all">
                    {m.email ?? ROLE_HINTS[m.role]}
                  </span>
                </span>
                {admin && can.role ? (
                  <select
                    className={SELECT}
                    aria-label={`Role for ${name}`}
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => void run(() => setRole(m.userId, e.target.value as Role),
                      `${name} is now ${ROLE_LABELS[e.target.value as Role].toLowerCase()}.`)}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                ) : (
                  <span className="badge bg-bite-100 text-bite-700 font-extrabold">{ROLE_LABELS[m.role]}</span>
                )}
                {admin && can.remove && !me && (
                  <button
                    type="button"
                    className="w-11 h-11 shrink-0 rounded-[14px] flex items-center justify-center
                               text-ink-500 hover:text-coral-600 disabled:opacity-45"
                    aria-label={`Remove ${name}`}
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Remove ${name} from ${household.name}? They lose access straight away. Their entries stay.`)) return
                      void run(() => remove(m.userId), `${name} was removed.`)
                    }}
                  >
                    <UserMinus size={20} aria-hidden="true" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {myRole && (
          <p className="mx-1 text-xs text-ink-700">
            You are {ROLE_LABELS[myRole].toLowerCase()}: {ROLE_HINTS[myRole].toLowerCase()}
          </p>
        )}
      </SettingsGroup>

      {admin && (
        <SettingsGroup id="invite-heading" title="Invite someone">
          <form
            onSubmit={onInvite}
            className="bg-paper border border-border-200 rounded-card p-3.5 flex flex-col gap-2.5"
          >
            {invites.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-ink-700">Invited, not joined yet</span>
                <ul className="flex flex-col gap-1" aria-label="Pending invites">
                  {invites.map((i) => (
                    <li key={i.id} className="flex items-center gap-2.5 pl-3 py-0.5 rounded-lg bg-mustard-100">
                      <Mail size={16} aria-hidden="true" className="shrink-0 text-mustard-800" />
                      <span className="flex-1 min-w-0 flex flex-col">
                        <span className="text-sm font-bold text-ink-900 truncate">{i.email}</span>
                        <span className="text-xs font-bold text-mustard-800">
                          {ROLE_LABELS[i.role]}{sentOn(i.createdAt)}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="w-11 h-11 shrink-0 rounded-[14px] flex items-center justify-center
                                   text-ink-700 hover:text-coral-600 disabled:opacity-45"
                        aria-label={`Cancel the invite for ${i.email}`}
                        disabled={busy}
                        onClick={() => void run(() => revokeInvite(i.id), `The invite for ${i.email} was cancelled.`)}
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-ink-700" htmlFor="invite-email">Their email</label>
              <input
                id="invite-email"
                type="email"
                className="input min-h-11 rounded-lg"
                placeholder="their@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <select
                className={`${SELECT} flex-1`}
                aria-label="Their role"
                value={role}
                onChange={(e) => setNewRole(e.target.value as Role)}
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button
                type="submit"
                className="btn min-h-11 rounded-lg border border-bite-700 text-bite-700 bg-transparent
                           hover:bg-bite-50 font-extrabold text-[15px]"
                disabled={busy || !email.trim()}
              >
                <Send size={16} aria-hidden="true" /> Send invite
              </button>
            </div>
            <p className="text-xs text-ink-500">
              {ROLE_HINTS[role]} They sign in with that email and they are in.
            </p>
          </form>
        </SettingsGroup>
      )}

      {message && (
        <p className={`mx-1 flex items-start gap-2 text-sm ${message.ok ? 'text-leaf-600' : 'text-coral-600'}`} role="status">
          {!message.ok && <AlertTriangle size={15} aria-hidden="true" className="shrink-0 mt-0.5" />} {message.text}
        </p>
      )}
    </div>
  )
}

/** " · sent 5 Nov", or nothing for an invite with no date on it. */
function sentOn(createdAt: string): string {
  const when = new Date(createdAt)
  if (!createdAt || Number.isNaN(when.getTime())) return ''
  return ` · sent ${when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}
