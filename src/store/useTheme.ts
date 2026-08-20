/**
 * Applying the chosen theme to the document.
 *
 * The stylesheet handles all three states on its own — an explicit choice sets
 * `data-theme`, and "system" sets nothing, leaving `prefers-color-scheme` to
 * decide. So this only has to stamp or clear one attribute.
 *
 * It also keeps the browser chrome in step: on a phone the address bar and the
 * status bar are coloured from `theme-color`, and a cream bar above a near-black
 * app is the most obvious way to look unfinished.
 */
import { useEffect } from 'react'
import { useUserStore } from './useUserStore'

const CHROME = { light: '#faf7f0', dark: '#17131a' }

export function useTheme() {
  const theme = useUserStore((s) => s.profile.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)')

    const paint = () => {
      const dark = theme === 'dark' || (theme === 'system' && prefersDark.matches)
      document.querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? CHROME.dark : CHROME.light)
    }

    paint()
    // Following the system means following it as it changes, not only at load.
    prefersDark.addEventListener('change', paint)
    return () => prefersDark.removeEventListener('change', paint)
  }, [theme])
}
