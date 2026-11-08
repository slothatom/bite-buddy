import type { KeyboardEvent } from 'react'
import { Moon } from 'lucide-react'
import type { Theme } from '../../types'
import { useUserStore } from '../../store/useUserStore'
import { IconTile } from './SettingsList'

/** Light, dark, or whatever the device says, in the order the design reads them. */
const CHOICES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

/**
 * Light, Dark or System, as three segments.
 *
 * A radio group: one of three, always one chosen, and the arrow keys move the
 * choice the way they do in any other radio group.
 */
export function AppearanceControl({ id = 'appearance-label', showNote = false }: {
  id?: string
  showNote?: boolean
}) {
  const theme = useUserStore((s) => s.profile.theme ?? 'system')
  const setTheme = useUserStore((s) => s.setTheme)

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const at = CHOICES.findIndex((c) => c.value === theme)
    const next = CHOICES[(at + step + CHOICES.length) % CHOICES.length]
    setTheme(next.value)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-theme-choice="${next.value}"]`)?.focus()
  }

  return (
    <div className="flex flex-col gap-2.5 px-3.5 py-3">
      <div className="flex items-center gap-3">
        <IconTile icon={Moon} tone="plain" />
        <span id={id} className="text-[15px] leading-5 font-bold text-ink-900">Appearance</span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={id}
        onKeyDown={onKey}
        className="grid grid-cols-3 gap-1 p-1 bg-border-100 rounded-lg"
      >
        {CHOICES.map((c) => {
          const on = c.value === theme
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              data-theme-choice={c.value}
              onClick={() => setTheme(c.value)}
              className={`${on ? 'segment-on' : 'segment-off'} min-h-10`}
            >
              {c.label}
            </button>
          )
        })}
      </div>
      {showNote && (
        <p className="text-xs text-ink-700">
          System follows your device and changes with it, so the app goes dark when your phone
          does. Light or Dark says otherwise.
        </p>
      )}
    </div>
  )
}
