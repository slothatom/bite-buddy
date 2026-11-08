import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, MailCheck, AlertTriangle, SlidersHorizontal } from 'lucide-react'
import { useAuthStore } from '../store/useAuth'
import Logo from '../components/brand/Logo'

/**
 * The one screen you see when signed out.
 *
 * No password, no account creation, no "forgot your login", you type the
 * address you were invited with and a link arrives. Anyone not on the guest
 * list in the database cannot create an account at all, so this screen does not
 * need to reject them; it simply never leads anywhere.
 */
export default function SignIn() {
  const { signIn, error, linkSentTo } = useAuthStore()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || sending) return
    setSending(true)
    await signIn(email)
    setSending(false)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-cream-50 px-4 py-10">
      <div className="w-full max-w-sm flex flex-col gap-7">
        <div className="flex flex-col items-center gap-2.5 text-center">
          {/* The logo is the first thing you see, and the heading, so it is the
              one logo in the app with an accessible name. In the header and the
              menu it is decoration and stays silent. */}
          <h1>
            <Logo size={48} title="Bite Buddy" />
          </h1>
          <p className="text-[15px] leading-[22px] text-ink-700">Plan your week. Eat well. Feel good.</p>
        </div>

        {linkSentTo ? (
          <section
            role="status"
            className="bg-paper border border-border-200 rounded-card p-5 flex flex-col items-center gap-2.5 text-center"
          >
            <span className="w-12 h-12 rounded-full bg-leaf-50 text-leaf-700 flex items-center justify-center">
              <MailCheck size={24} aria-hidden="true" />
            </span>
            <h2 className="text-lg leading-6 font-extrabold text-ink-900">Check your email</h2>
            <p className="text-sm text-ink-700">
              If <strong className="text-ink-900 break-all">{linkSentTo}</strong> has been invited, a
              sign-in link is on its way. It works once and lasts an hour.
            </p>
            <p className="text-xs leading-[18px] text-ink-500">
              Open it on this phone. The link signs in the browser that opens it.
            </p>
            <button
              type="button"
              className="btn-ghost min-h-11 text-bite-700 font-extrabold"
              onClick={() => useAuthStore.setState({ linkSentTo: null })}
            >
              Use a different email
            </button>
          </section>
        ) : (
          <form
            onSubmit={submit}
            className="bg-paper border border-border-200 rounded-card p-5 flex flex-col gap-3.5"
          >
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-bold text-ink-700" htmlFor="email">Your email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input min-h-12 text-base"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full min-h-12 text-base font-extrabold" disabled={sending}>
              <Mail size={18} aria-hidden="true" /> {sending ? 'Sending…' : 'Email me a link'}
            </button>

            {error && (
              <p role="alert" className="flex items-start gap-2 text-sm text-coral-600">
                <AlertTriangle size={15} aria-hidden="true" className="shrink-0 mt-0.5" /> {error}
              </p>
            )}

            <p className="text-xs leading-[18px] text-ink-500">
              A private app for your household. No password to remember, and nothing to reset.
            </p>
          </form>
        )}

        {/* Settings are a property of this device rather than of an account,
            so they stay reachable without signing in, which is the state
            you are in when you want to restore a backup. */}
        <Link
          to="/settings"
          className="self-center min-h-11 px-3.5 rounded-lg flex items-center gap-2 text-sm font-bold
                     text-ink-700 hover:bg-bite-50 hover:text-bite-700"
        >
          <SlidersHorizontal size={16} aria-hidden="true" /> Settings and backups
        </Link>
      </div>
    </div>
  )
}
