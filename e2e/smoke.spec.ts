import { test, expect, type Page } from '@playwright/test'

/**
 * End-to-end checks for the paths that matter and the layout rules that are
 * easy to break without noticing.
 */

const ROUTES = [
  '/', '/plan', '/recipes', '/foods', '/grocery', '/history',
  '/prep', '/schedule', '/analytics', '/settings',
]

/** Fails the test on any uncaught error or console error, on any page. */
function trackErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    // The app is offline-only; the optional nutrition lookups are the one thing
    // that reaches the network, and a sandboxed CI run cannot reach it.
    if (/ERR_CONNECTION|Failed to load resource/.test(m.text())) return
    errors.push(`console: ${m.text()}`)
  })
  return errors
}

async function goto(page: Page, route: string) {
  await page.goto(`#${route}`)
  await page.waitForLoadState('networkidle')
}

test.describe('every screen renders', () => {
  for (const route of ROUTES) {
    test(`${route} loads without errors`, async ({ page }) => {
      const errors = trackErrors(page)
      await goto(page, route)
      await expect(page.locator('h1').first()).toBeVisible()
      expect(errors).toEqual([])
    })
  }
})

test.describe('layout', () => {
  for (const route of ROUTES) {
    test(`${route} does not scroll horizontally`, async ({ page }) => {
      await goto(page, route)
      // A page wider than its viewport is the classic mobile regression: it
      // makes every horizontal swipe fight the layout.
      const overflow = await page.evaluate(() => {
        const de = document.documentElement
        return de.scrollWidth - de.clientWidth
      })
      expect(overflow, `${route} overflows by ${overflow}px`).toBeLessThanOrEqual(1)
    })
  }

  test('nothing is clipped or hidden sideways on a phone', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'this is about the narrow layout')

    await goto(page, '/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    // Every one of these was a real defect at 390px: planner meal names cut to
    // "Potatoes with egg, Teleme…", the dietician's line reduced to a stub,
    // 829px of recipe filters and 1,578px of food categories scrolled out of
    // sight with nothing saying they existed.
    for (const route of ROUTES) {
      await goto(page, route)
      const problems = await page.evaluate(() => {
        const found: string[] = []
        const label = (el: Element) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
        for (const el of document.querySelectorAll('*')) {
          if (!(el instanceof HTMLElement)) continue
          const style = getComputedStyle(el)
          if (style.display === 'none' || style.visibility === 'hidden') continue
          const box = el.getBoundingClientRect()
          if (!box.width || !box.height) continue

          if (!el.children.length && label(el) && style.overflowX !== 'visible'
              && el.scrollWidth > el.clientWidth + 1) {
            found.push(`clipped by ${el.scrollWidth - el.clientWidth}px: "${label(el)}"`)
          }
          if (['auto', 'scroll'].includes(style.overflowX) && el.scrollWidth > el.clientWidth + 4) {
            found.push(`${el.scrollWidth - el.clientWidth}px hidden in a sideways scroller`)
          }
        }
        return [...new Set(found)]
      })
      expect(problems, `${route} hides content at phone width`).toEqual([])
    }
  })

  test('controls are large enough to tap', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'touch sizing only applies to coarse pointers')

    // Seed real content so the check sees populated screens, not empty states.
    await goto(page, '/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    for (const route of ROUTES) {
      await goto(page, route)
      const small = await page.evaluate(() => {
        const offenders: string[] = []
        for (const el of document.querySelectorAll('button, a, select')) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          if (r.height < 40 || r.width < 32) {
            const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)
            offenders.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${label}"`)
          }
        }
        return offenders
      })
      expect(small, `${route} has undersized tap targets`).toEqual([])
    }
  })
})

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' })

  test('every screen inverts, and nothing keeps a light-mode colour', async ({ page }) => {
    await goto(page, '/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    for (const route of ROUTES) {
      await goto(page, route)

      // The classic failure is a surface whose colour is only defined in the
      // light palette, leaving light text on a light card.
      const problems = await page.evaluate(() => {
        const luminance = (colour: string) => {
          const [r, g, b] = (colour.match(/\d+/g) ?? ['255', '255', '255']).map(Number)
          return (0.299 * r + 0.587 * g + 0.114 * b) / 255
        }
        const found: string[] = []

        const body = getComputedStyle(document.body).backgroundColor
        if (luminance(body) > 0.5) found.push(`body background is light: ${body}`)

        for (const el of document.querySelectorAll('*')) {
          if (!(el instanceof HTMLElement) || !el.textContent?.trim()) continue
          if (el.children.length) continue
          const style = getComputedStyle(el)
          const box = el.getBoundingClientRect()
          if (!box.width || !box.height) continue

          // Walk up for the nearest painted background.
          let node: HTMLElement | null = el
          let background = 'rgba(0, 0, 0, 0)'
          while (node) {
            const bg = getComputedStyle(node).backgroundColor
            if (bg && !bg.startsWith('rgba(0, 0, 0, 0)')) { background = bg; break }
            node = node.parentElement
          }
          const contrast = Math.abs(luminance(style.color) - luminance(background))
          if (contrast < 0.15) {
            found.push(`"${el.textContent.trim().slice(0, 24)}" is ${style.color} on ${background}`)
          }
        }
        return [...new Set(found)].slice(0, 5)
      })

      expect(problems, `${route} has unreadable text in dark mode`).toEqual([])
    }
  })
})

test.describe('the main flow', () => {
  test('load a dietician week, then build a grocery list from it', async ({ page }) => {
    const errors = trackErrors(page)

    // 1. The archive offers all 14 plans.
    await goto(page, '/history')
    await expect(page.getByRole('button', { name: /^Load$/ })).toHaveCount(14)

    // 2. Loading one fills the planner.
    await page.getByRole('button', { name: /^Load$/ }).first().click()
    await expect(page.getByRole('button', { name: /Loaded/ })).toBeVisible()

    await goto(page, '/plan')
    await expect(page.getByText('7 of 7 days planned')).toBeVisible()

    // 3. The day's calories are real numbers, not zero or NaN. Figures are
    // thousands-separated, so the pattern has to allow a comma.
    const kcal = await page.locator('text=/of [\\d,]+ kcal/').first().textContent()
    expect(kcal).toMatch(/of [\d,]+ kcal/)

    // 4. A grocery list can be generated from that week.
    await goto(page, '/grocery')
    await page.getByRole('button', { name: /Build list/i }).click()
    await expect(page.getByText(/0 of \d+ picked up/)).toBeVisible()

    const items = await page.locator('input[type=checkbox]').count()
    expect(items).toBeGreaterThan(20)

    expect(errors).toEqual([])
  })

  test('a recipe opens and shows its provenance', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByPlaceholder(/Search in English/).fill('telemea')
    // Searching a Romanian word finds meals written in Romanian.
    const first = page.locator('.card button').nth(1)
    await first.click()
    await expect(page.getByText('How your dietician wrote it')).toBeVisible()
  })

  test('every screen that lists things actually lists something', async ({ page }) => {
    // Prep and Schedule both filtered their lists on recipes having a written
    // method. Not one of the 275 does — the dietician wrote portions, not
    // instructions — so both screens shipped permanently empty and rendered
    // fine while doing it. Nothing caught that, because "renders without
    // errors" is exactly what an empty state does.
    await goto(page, '/prep')
    await expect(page.getByText('Nothing to cook yet')).toHaveCount(0)
    const cookable = await page.locator('.card').count()
    expect(cookable, 'Prep offers no recipes to cook').toBeGreaterThan(10)

    await goto(page, '/schedule')
    await page.getByRole('button', { name: /Session/ }).click()
    const pickable = await page.locator('input[type=checkbox]').count()
    expect(pickable, 'Schedule offers no recipes to batch').toBeGreaterThan(10)
  })

  test('a prep session weighs the ingredients out', async ({ page }) => {
    await goto(page, '/prep')
    await page.locator('.card').first().click()

    // The weigh-out is derived from components, so it works for recipes that
    // have no method written at all.
    await expect(page.getByText('Weigh everything out')).toBeVisible()
    const rows = await page.locator('input[type=checkbox]').count()
    expect(rows, 'weigh-out is empty').toBeGreaterThan(0)
    await expect(page.locator('text=/\\d+ g/').first()).toBeVisible()
  })

  test('targets can be taken from the plan history', async ({ page }) => {
    await goto(page, '/settings')
    await expect(page.getByText(/Averaged over \d+ full days/)).toBeVisible()
    await page.getByRole('button', { name: 'Use these' }).first().click()
    await expect(page.getByText(/set from your plans/)).toBeVisible()
  })
})

test.describe('your data survives the browser', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  test('a backup can be taken out and brought back', async ({ page }) => {
    // Nothing here syncs anywhere, so a backup is the only copy of a planned
    // week that outlives the browser storage it was written to.
    await goto(page, '/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()
    await goto(page, '/plan')
    await expect(page.getByText('7 of 7 days planned')).toBeVisible()

    await goto(page, '/settings')
    await page.getByRole('button', { name: 'Copy backup' }).click()
    const backup = await page.evaluate(() => navigator.clipboard.readText())
    expect(backup).toContain('bite-buddy-mealplan-v2')

    // Lose everything, the way clearing site data would.
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await goto(page, '/plan')
    await expect(page.getByText('0 of 7 days planned')).toBeVisible()

    await goto(page, '/settings')
    await page.getByRole('button', { name: 'Paste a backup' }).click()
    await page.getByPlaceholder(/Paste the contents/).fill(backup)
    await page.getByRole('button', { name: 'Restore', exact: true }).click()
    await expect(page.getByText(/Restored \d+ of/)).toBeVisible()

    await goto(page, '/plan')
    await expect(page.getByText('7 of 7 days planned')).toBeVisible()
  })

  test('a file from another version is refused, not half-applied', async ({ page }) => {
    await goto(page, '/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    await goto(page, '/settings')
    await page.getByRole('button', { name: 'Paste a backup' }).click()
    await page.getByPlaceholder(/Paste the contents/)
      .fill('{"app":"bite-buddy","schema":99,"stores":{"bite-buddy-mealplan-v2":{"plan":[]}}}')
    await page.getByRole('button', { name: 'Restore', exact: true }).click()

    await expect(page.getByText(/left alone/)).toBeVisible()
    await goto(page, '/plan')
    await expect(page.getByText('7 of 7 days planned')).toBeVisible()
  })
})

test.describe('resilience', () => {
  test('starts cleanly when stored data is corrupt', async ({ page }) => {
    const errors = trackErrors(page)
    await page.goto('#/')
    await page.evaluate(() => {
      localStorage.setItem('bite-buddy-mealplan-v2', '{not valid json')
      localStorage.setItem('bite-buddy-user-v2', '{"state":{"profile":null},"version":999}')
    })
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Unreadable or future-versioned state must fall back to defaults rather
    // than being interpreted under the wrong assumptions.
    await expect(page.locator('h1').first()).toBeVisible()
    expect(errors).toEqual([])
  })
})
