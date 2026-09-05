import { describe, it, expect, vi, afterEach } from 'vitest'
import { applyTheme, resolveTheme, THEME_ATTRIBUTE, GROUND } from './theme'

/** A stand-in for `<html>`, so nothing here depends on a real document. */
function root(): HTMLElement {
  const attributes = new Map<string, string>()
  return {
    setAttribute: (k: string, v: string) => { attributes.set(k, v) },
    removeAttribute: (k: string) => { attributes.delete(k) },
    getAttribute: (k: string) => attributes.get(k) ?? null,
    style: {} as CSSStyleDeclaration,
  } as unknown as HTMLElement
}

afterEach(() => { vi.unstubAllGlobals() })

describe('putting a theme on the document', () => {
  it('names the one you chose', () => {
    const html = root()
    applyTheme('dark', html)
    expect(html.getAttribute(THEME_ATTRIBUTE)).toBe('dark')
    expect(html.style.colorScheme).toBe('dark')
  })

  it('takes the attribute off entirely for the device default', () => {
    // Not `data-theme="system"`. There is no such palette: following the
    // device is a media query in the stylesheet, and an attribute would sit
    // above it in the cascade matching nothing, leaving the app stuck light.
    const html = root()
    applyTheme('dark', html)
    applyTheme('system', html)
    expect(html.getAttribute(THEME_ATTRIBUTE)).toBeNull()
    expect(html.style.colorScheme).toBe('')
  })

  it('treats a profile that has never been asked as following the device', () => {
    const html = root()
    applyTheme(undefined, html)
    expect(html.getAttribute(THEME_ATTRIBUTE)).toBeNull()
  })
})

describe('what it is actually rendering in', () => {
  it('takes an explicit choice at its word, whatever the device says', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('asks the device when nobody has chosen', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    expect(resolveTheme('system')).toBe('dark')
    expect(resolveTheme(undefined)).toBe('dark')
  })

  it('falls back to light where there is nothing to ask', () => {
    vi.stubGlobal('window', undefined)
    expect(resolveTheme('system')).toBe('light')
  })

  it('has a page ground for each, for the strip the stylesheet cannot reach', () => {
    expect(GROUND.light).toMatch(/^#[0-9a-f]{6}$/)
    expect(GROUND.dark).toMatch(/^#[0-9a-f]{6}$/)
    expect(GROUND.light).not.toBe(GROUND.dark)
  })
})
