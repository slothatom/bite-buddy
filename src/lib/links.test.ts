import { describe, it, expect } from 'vitest'
import { safeUrl, linkLabel } from './links'

describe('a link a recipe can point at', () => {
  it('takes an ordinary address', () => {
    expect(safeUrl('https://bbcgoodfood.com/recipes/lentil-stew')?.hostname)
      .toBe('bbcgoodfood.com')
  })

  it('assumes https for something typed without a scheme', () => {
    expect(safeUrl('bbcgoodfood.com/recipes')?.protocol).toBe('https:')
  })

  it('refuses a script dressed as a link', () => {
    // Not theoretical: a recipe is data, and data that becomes an href runs on
    // your own page with your own session.
    expect(safeUrl('javascript:alert(document.cookie)')).toBeUndefined()
    expect(safeUrl('JavaScript:alert(1)')).toBeUndefined()
    expect(safeUrl('  javascript:alert(1)  ')).toBeUndefined()
  })

  it('refuses the other schemes that are not a website', () => {
    for (const bad of ['data:text/html,<script>1</script>', 'file:///etc/passwd', 'vbscript:msgbox(1)']) {
      expect(safeUrl(bad), bad).toBeUndefined()
    }
  })

  it('treats nonsense as no link rather than repairing it', () => {
    expect(safeUrl('')).toBeUndefined()
    expect(safeUrl('   ')).toBeUndefined()
    expect(safeUrl(undefined)).toBeUndefined()
    expect(safeUrl('http://')).toBeUndefined()
  })
})

describe('what a link is called on screen', () => {
  it('is the site rather than the whole address', () => {
    expect(linkLabel(safeUrl('https://www.bbcgoodfood.com/recipes/x?utm_source=y')!))
      .toBe('bbcgoodfood.com')
  })
})
