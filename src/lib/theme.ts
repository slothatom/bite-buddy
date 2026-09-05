import type { Theme } from '../types'

/**
 * Putting the chosen theme on the document.
 *
 * The palette lives entirely in CSS: `src/index.css` defines the light tokens
 * in `@theme` and overrides the ones that change under
 * `:root[data-theme='dark']`, and every Tailwind utility resolves its colour
 * through `var(--color-…)`. So the whole of theming, from this side, is one
 * attribute on `<html>`, and no component has to know a theme exists.
 *
 * Three values, and the third is why the attribute is sometimes removed rather
 * than set to something. 'system' means "whatever the device says", and the
 * device's answer is already carried by a `prefers-color-scheme` media query in
 * the stylesheet. Writing `data-theme="system"` would leave that query
 * outranked by nothing and the app stuck on light. Absent is the value that
 * means "let the media query decide".
 */

export const THEME_ATTRIBUTE = 'data-theme'

export function applyTheme(theme: Theme | undefined, root?: HTMLElement): void {
  const element = root ?? (typeof document === 'undefined' ? undefined : document.documentElement)
  if (!element) return

  if (!theme || theme === 'system') element.removeAttribute(THEME_ATTRIBUTE)
  else element.setAttribute(THEME_ATTRIBUTE, theme)

  // The browser's own furniture, which the stylesheet cannot reach: form
  // controls, scrollbars and the flash of background before the first paint.
  // Left to the device under 'system', which is what the word means.
  element.style.colorScheme = !theme || theme === 'system' ? '' : theme

  // And the strip above the page on a phone, which is painted by the operating
  // system from a meta tag rather than by anything in the stylesheet. Left
  // alone it stayed brand purple against a dark app, which is the one piece of
  // the screen a theme cannot afford to miss: it is the frame around everything
  // else.
  if (typeof document !== 'undefined') {
    const tag = document.querySelector('meta[name="theme-color"]')
    tag?.setAttribute('content', GROUND[resolveTheme(theme)])
  }
}

/**
 * What the app is actually rendering in, once the device has had its say.
 *
 * For the two things that need the answer rather than the preference: the
 * address bar colour, and anything drawn on a canvas, which cannot read a CSS
 * variable.
 */
export function resolveTheme(theme: Theme | undefined): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') return theme
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** The two page grounds, as the address bar wants them: a colour, not a token. */
export const GROUND: Record<'light' | 'dark', string> = {
  light: '#faf7f0',
  dark: '#17130f',
}
