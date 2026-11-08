import { useSyncExternalStore } from 'react'

/**
 * Whether a media query matches, kept live as the window changes.
 *
 * For layouts that differ in structure rather than in styling, where a CSS
 * breakpoint alone cannot do it. Where there is no `matchMedia` (a test
 * environment, a server render) it answers `fallback`.
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    () => (typeof window === 'undefined' || !window.matchMedia ? fallback : window.matchMedia(query).matches),
    () => fallback,
  )
}
