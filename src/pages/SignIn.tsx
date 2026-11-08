import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Check, AlertTriangle, SlidersHorizontal } from 'lucide-react'
import { useAuthStore } from '../store/useAuth'
import Zig from '../components/brand/Mascot'
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
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-7">
          {/* Bandit reacts (he celebrates once the link is on its way), and the
              logo underneath is the name. It is the heading, so it is the one
              logo in the app with an accessible name. In the header and the
              menu it is decoration and stays silent. */}
          <Zig mood={linkSentTo ? 'celebrate' : 'happy'} size={84} />
          <h1 className="mt-4">
            <Logo size={34} title="Bite Buddy" />
          </h1>
          <p className="text-sm text-ink-700 mt-1">Plan your week. Eat well. Feel good.</p>
        </div>

        {linkSentTo ? (
          <div className="card p-5 text-center space-y-3">
            <p className="flex items-center justify-center gap-2 font-semibold text-ink-900">
              <Check size={18} className="text-leaf-600" /> Check your email
            </p>
            <p className="text-sm text-ink-700">
              If <strong className="break-all">{linkSentTo}</strong> has been invited, a sign-in
              link is on its way. It works once and expires in an hour.
            </p>
            <p className="text-xs text-ink-500">
              Open it on the device you want to use. The link signs in the browser that opens it.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-5 space-y-4">
            <div>
              <label className="label" htmlFor="email">Your email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full justify-center" disabled={sending}>
              <Mail size={16} /> {sending ? 'Sending…' : 'Email me a link'}
            </button>

            {error && (
              <p className="flex items-start gap-2 text-sm text-coral-600">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {error}
              </p>
            )}

            <p className="text-xs text-ink-500">
              This is a private app for your household. No password to remember, and nothing to reset.
            </p>

            {/* Settings are a property of this device rather than of an account,
                so they stay reachable without signing in, which is the state
                you are in when you want to restore a backup. */}
            <Link to="/settings" className="btn-ghost w-full justify-center text-ink-500">
              <SlidersHorizontal size={15} /> Settings and backups
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
