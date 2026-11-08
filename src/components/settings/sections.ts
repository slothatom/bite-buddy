import { Archive, Bell, Download, Moon, Target, UserRound, Users, type LucideIcon } from 'lucide-react'
import { useAuthStore } from '../../store/useAuth'
import { useHousehold } from '../../store/useHousehold'
import { isConfigured } from '../../lib/supabase'

/**
 * The pages Settings is made of, in the order the desktop list shows them.
 *
 * Each is an address under /settings, so the phone's back arrow, a bookmark
 * and the desktop list all agree on where you are. The household and the
 * reminders exist only with an account, and the account page is just the
 * build number without one.
 */
export interface SettingsSection {
  path: string
  label: string
  icon: LucideIcon
  /** One line under the page's heading on a wide screen. */
  blurb?: string
}

export function useSettingsSections(): SettingsSection[] {
  const account = useAuthStore((s) => isConfigured && Boolean(s.session))
  const household = useHousehold((s) => Boolean(s.household))

  return [
    ...(account && household
      ? [{ path: 'household', label: 'Household and people', icon: Users }]
      : []),
    {
      path: 'targets', label: 'Targets', icon: Target,
      blurb: 'What a day is measured against, and the shape of your week.',
    },
    {
      path: 'history', label: 'Plan history', icon: Archive,
      blurb: 'Past plans to look back on, or to load into a week again.',
    },
    ...(account
      ? [{
          path: 'reminders', label: 'Reminders', icon: Bell,
          blurb: 'What this phone tells you while the app is closed.',
        }]
      : []),
    { path: 'appearance', label: 'Appearance', icon: Moon },
    {
      path: 'backups', label: 'Backups', icon: Download,
      blurb: 'A copy you hold yourself, and the things you deleted.',
    },
    account
      ? { path: 'account', label: 'Account', icon: UserRound, blurb: 'Who is signed in, sharing, and which build this is.' }
      : { path: 'account', label: 'App version', icon: UserRound },
  ]
}
