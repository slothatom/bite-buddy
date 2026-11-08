import { Archive, Bell, Download, Info, Target, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuth'
import { useHousehold, useMyRole, usePeople } from '../../store/useHousehold'
import { useUserStore } from '../../store/useUserStore'
import { useArchive } from '../../store/useArchive'
import { isConfigured } from '../../lib/supabase'
import { ROLE_LABELS } from '../../lib/household'
import { PersonStack } from '../ui/PersonAvatar'
import { SettingsCard, SettingsGroup, SettingsLink, IconTile } from './SettingsList'
import { AppearanceControl } from './AppearanceControl'
import { SignedInRow } from './AccountPanel'

/**
 * Settings on a phone: a short list of what there is, each row saying where it
 * stands, each opening its own page. The one control simple enough to live on
 * the list itself is the appearance switch.
 */
export function SettingsHub() {
  const account = useAuthStore((s) => isConfigured && Boolean(s.session))
  const household = useHousehold((s) => s.household)
  const people = usePeople()
  const role = useMyRole()
  const targets = useUserStore((s) => s.profile.targets)
  const archive = {
    status: useArchive((s) => s.status),
    counts: useArchive((s) => s.counts),
    updatedAt: useArchive((s) => s.updatedAt),
  }

  const names = people.map((p) => p.name)
  const together = names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    : names[0] ?? ''

  return (
    <div className="flex flex-col gap-3.5">
      <SettingsGroup id="hub-household" title="Household">
        <SettingsCard>
          {account && household && (
            <SettingsLink
              to="/settings/household"
              icon={Users}
              title="Household and people"
              detail={`${together}${role ? ` · you are ${ROLE_LABELS[role].toLowerCase()}` : ''}`}
              trailing={<PersonStack people={people} size="md" />}
            />
          )}
          <SettingsLink
            to="/settings/targets"
            icon={Target}
            tone="leaf"
            title="Targets"
            detail={`${targets.calories.toLocaleString('en-GB')} kcal a day, set ${
              targets.source === 'from-plans' ? 'from your plans'
              : targets.source === 'tdee' ? 'by the calculator' : 'by hand'}`}
          />
          <SettingsLink
            to="/settings/history"
            icon={Archive}
            tone="mustard"
            title="Plan history"
            detail={archiveLine(archive)}
          />
          <AppearanceControl id="hub-appearance" />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup id="hub-phone" title="This phone">
        <SettingsCard>
          {account && (
            <SettingsLink
              to="/settings/reminders"
              icon={Bell}
              title="Reminders"
              detail="Before cooking, and when the week changes"
            />
          )}
          <SettingsLink
            to="/settings/backups"
            icon={Download}
            tone="plain"
            title="Backups"
            detail="Save a copy, or bring one back"
          />
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup id="hub-account" title={account ? 'Account' : 'This version'}>
        <SettingsCard>
          {account && (
            <div className="p-3.5">
              <SignedInRow />
            </div>
          )}
          <Link
            to="/settings/account"
            className="flex items-center gap-3 px-3.5 py-3 min-h-11 text-ink-900 hover:bg-bite-50 transition-colors"
          >
            <IconTile icon={Info} tone="plain" />
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="text-[15px] leading-5 font-bold">
                {account ? 'Your name, sharing and version' : 'App version'}
              </span>
              <span className="text-xs text-ink-700">Build {__BUILD_SHA__}</span>
            </span>
          </Link>
        </SettingsCard>
        <p className="mx-1 mt-1 text-xs text-ink-500">
          {account
            ? 'Reminders and backups belong to this phone. Everything else is shared with the household.'
            : 'Nothing here needs an account. It is all kept on this device.'}
        </p>
      </SettingsGroup>
    </div>
  )
}

function archiveLine({ status, counts, updatedAt }: {
  status: string
  counts: { plans: number } | null
  updatedAt: string | null
}): string {
  if (status !== 'ready' || !counts) return 'Your dietician\'s weeks, once uploaded'
  const when = updatedAt
    ? ` · updated ${new Date(updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : ''
  return `${counts.plans} ${counts.plans === 1 ? 'plan' : 'plans'} from your dietician${when}`
}
