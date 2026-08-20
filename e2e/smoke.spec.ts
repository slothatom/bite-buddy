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

test.describe('the recipe library', () => {
  test('opens on one shelf rather than all 275', async ({ page }) => {
    // The screen this replaced showed every recipe at once, sorted
    // alphabetically — a wall you had to scroll past to reach anything.
    await goto(page, '/recipes')

    const shown = await page.locator('.card').count()
    expect(shown, 'the whole library is on screen again').toBeLessThan(150)
    expect(shown, 'the opening shelf is empty').toBeGreaterThan(5)

    // The number on a tab is the number of cards you then see, not the number
    // of recipes behind them. Read off whichever tab is open — which shelf that
    // is depends on the time of day, and hardcoding Breakfast made this pass
    // only before eleven in the morning.
    const label = await page.locator('button.tab-on').textContent()
    expect(Number(label?.replace(/\D/g, ''))).toBe(shown)

    // And the other shelves are one tap away.
    await page.getByRole('button', { name: /^Dishes/ }).click()
    await expect(page.getByText('Cooked once and eaten across several meals.', { exact: false })).toBeVisible()
    expect(await page.locator('.card').count()).toBeGreaterThan(5)
  })

  test('the same dish written four times is one card, not four', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Dinner/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('green bean soup')

    // Four lines across the plans, one dish. The numbering the generator added
    // ("(2)", "(3)") should not be on screen at all.
    await expect(page.locator('.card')).toHaveCount(1)
    await expect(page.getByText('(2)')).toHaveCount(0)
    await expect(page.getByText(/versions/)).toBeVisible()

    await page.locator('.card button').nth(1).click()
    await expect(page.getByText(/Written \d+ times across the plans/)).toBeVisible()

    // The versions are often the same meal worded differently, so what changes
    // when you flip between them is the dietician's own line.
    const line = page.locator('.card-soft').first()
    const before = await line.textContent()
    // Scoped to the sheet: the filter chips behind it are also .chip-off.
    await page.locator('.bg-paper .chip-off').first().click()
    await expect(line).not.toHaveText(before ?? '')
  })

  test('the duplicates that are only duplicates can be folded away in one tap', async ({ page }) => {
    await goto(page, '/recipes')
    const banner = page.getByText(/dishes are written down more than once/)
    await expect(banner).toBeVisible()

    const before = await page.locator('.card').count()
    await page.getByRole('button', { name: 'Merge them' }).click()

    // The offer goes away because there is nothing left to fold, and the shelf
    // is shorter than it was.
    await expect(banner).toHaveCount(0)
    expect(await page.locator('.card').count()).toBeLessThan(before)
  })

  test('a dish written at different portions is never swept up automatically', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: 'Merge them' }).click()

    // 259 kcal and 408 kcal are a real choice, so this one still has versions.
    await page.getByRole('button', { name: /^Lunch/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('spicy chicken')
    await page.locator('.card button').nth(1).click()
    await expect(page.getByText(/Written \d+ times across the plans/)).toBeVisible()
  })

  test('merging by hand keeps the version you are looking at, and can be undone', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Lunch/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('spicy chicken')
    await page.locator('.card button').nth(1).click()

    await page.getByRole('button', { name: /Merge these into one/ }).click()
    await page.getByRole('button', { name: 'Merge into this one' }).click()

    // One version left, and the sheet offers the way back.
    await expect(page.getByText(/Written \d+ times across the plans/)).toHaveCount(0)
    await expect(page.getByText(/versions were folded into this one/)).toBeVisible()

    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText(/Written \d+ times across the plans/)).toBeVisible()
  })

  test('a day already planned survives a merge', async ({ page }) => {
    // The fourteen archived weeks name recipe ids in code, so a merge must not
    // leave a planned day pointing at nothing.
    await goto(page, '/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()
    await goto(page, '/plan')
    await expect(page.getByText('7 of 7 days planned')).toBeVisible()

    await goto(page, '/recipes')
    await page.getByRole('button', { name: 'Merge them' }).click()

    await goto(page, '/plan')
    await expect(page.getByText('7 of 7 days planned')).toBeVisible()
    await expect(page.getByText('Unknown')).toHaveCount(0)
  })

  test('the filter sheet admits what the app cannot work out', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: 'Filters' }).click()

    // Budget Friendly, Lazy, Leftovers, Fridge Clean-Out and Special Occasion
    // are judgements the data cannot supply, and the sheet says so rather than
    // pre-filling them with a guess.
    await expect(page.getByText('yours to apply').first()).toBeVisible()
    expect(await page.getByText('yours to apply').count()).toBe(5)
  })

  test('the three dimensions narrow together', async ({ page }) => {
    // Meal time + dish category + quick filters, combined.
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Dinner/ }).click()
    const all = await page.locator('.card').count()

    await page.getByRole('button', { name: 'Any dish' }).click()
    await page.getByRole('button', { name: /^Soup/ }).click()
    const soups = await page.locator('.card').count()
    expect(soups).toBeGreaterThan(0)
    expect(soups).toBeLessThan(all)

    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByText('Veggie Packed').click()
    await page.getByRole('button', { name: 'Close' }).click()

    // Narrower, and still showing something: an assertion of "fewer" alone is
    // satisfied by zero, which is how a dead-end combination passed once.
    const veggieSoups = await page.locator('.card').count()
    expect(veggieSoups).toBeGreaterThan(0)
    expect(veggieSoups).toBeLessThan(soups)

    // And what you picked is visible and removable, not hidden in a sheet.
    await expect(page.getByRole('button', { name: /Soup/ })).toBeVisible()
    await page.getByRole('button', { name: /Veggie Packed/ }).click()
    expect(await page.locator('.card').count()).toBe(soups)
  })

  test('a combination with nothing in it offers the way out', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Dinner/ }).click()
    await page.getByRole('button', { name: 'Any dish' }).click()
    await page.getByRole('button', { name: /^Soup/ }).click()
    await page.getByRole('button', { name: 'Filters' }).click()
    await page.getByText('High Protein').click()
    await page.getByRole('button', { name: 'Close' }).click()

    // No soup in the library is 25 g of protein, and with every tab reading
    // zero there is no other shelf to send anyone to.
    await expect(page.getByText('That combination has nothing in it')).toBeVisible()
    await page.getByRole('button', { name: 'Clear the filters' }).click()
    expect(await page.locator('.card').count()).toBeGreaterThan(5)
  })

  test('only offers categories that have something in them', async ({ page }) => {
    // Thirty-seven exist; this library uses eighteen. Offering the rest would be
    // offering nineteen ways to see an empty screen.
    await goto(page, '/recipes')
    await page.getByRole('button', { name: 'Any dish' }).click()

    const offered = await page.locator('.bg-paper button').count()
    expect(offered).toBeGreaterThan(3)
    expect(offered).toBeLessThan(37)
    await expect(page.getByRole('button', { name: /^Taco/ })).toHaveCount(0)
  })

  test('a recipe says what it is and what it asks of you', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Dinner/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('green bean soup')
    await page.locator('.card button').nth(1).click()

    await expect(page.getByText('Soup', { exact: true })).toBeVisible()
    await expect(page.getByText(/Cozy & Comforting/)).toBeVisible()
  })

  test('a recipe of your own can be written and lands on your shelf', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /New recipe/ }).click()

    await page.getByLabel('Recipe name').fill('Midnight beans')
    await page.getByRole('button', { name: /Add ingredient/ }).click()
    await page.getByPlaceholder(/Search foods and recipes/).fill('lentil')
    await page.locator('.bg-paper button').filter({ hasText: /kcal \/ 100 g/ }).first().click()

    // The numbers are derived from what went in, never typed.
    await expect(page.getByText('Per serving')).toBeVisible()
    await page.getByRole('button', { name: 'Add recipe' }).click()

    await page.getByRole('button', { name: /^Yours/ }).click()
    await expect(page.getByText('Midnight beans')).toBeVisible()
  })

  test('a shipped recipe can be edited, and put back the way it was', async ({ page }) => {
    await goto(page, '/recipes')
    await page.locator('.card button').nth(1).click()
    const original = (await page.locator('h2').first().textContent())?.trim() ?? ''
    expect(original.length).toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Edit recipe' }).click()
    await page.getByLabel('Recipe name').fill('Renamed by me')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Renamed by me')).toBeVisible()

    // Editing a shipped recipe keeps a copy of your own; the original is still
    // underneath, and Revert is how you get back to it.
    await page.getByRole('button', { name: /^Yours/ }).click()
    await expect(page.getByText('Renamed by me')).toBeVisible()

    await page.getByText('Renamed by me').click()
    await page.getByRole('button', { name: 'Edit recipe' }).click()
    await page.getByRole('button', { name: /Undo my changes/ }).click()

    await expect(page.getByText('Renamed by me')).toHaveCount(0)
    await page.getByRole('button', { name: /^Yours/ }).click()
    await expect(page.getByText('Nothing of your own yet')).toBeVisible()
  })

  test('deleting an edited recipe removes it instead of restoring the original', async ({ page }) => {
    // The delete button used to only drop your edits, so a built-in recipe you
    // had touched reappeared unchanged and delete looked like it had failed.
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Lunch/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('chili con carne')
    await expect(page.locator('.card')).toHaveCount(1)

    await page.locator('.card button').nth(1).click()
    await page.getByRole('button', { name: 'Edit recipe' }).click()
    await page.getByLabel('Prep').fill('7')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await page.locator('.card button').nth(1).click()
    await page.getByRole('button', { name: 'Edit recipe' }).click()
    await page.getByRole('button', { name: /Delete this recipe/ }).click()
    await page.getByRole('button', { name: 'Yes, delete' }).click()

    // The empty state is itself a .card, so the absence is asserted on the text.
    await expect(page.getByText('Nothing matching that just yet')).toBeVisible()
  })

  test('the editor fits a phone', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'phone widths only')
    const errors = trackErrors(page)

    await goto(page, '/recipes')
    await page.getByRole('button', { name: /New recipe/ }).click()
    await expect(page.getByLabel('Recipe name')).toBeVisible()

    const overflow = await page.evaluate(() => {
      const de = document.documentElement
      return de.scrollWidth - de.clientWidth
    })
    expect(overflow, 'the editor pushes the page sideways').toBeLessThanOrEqual(1)
    expect(errors).toEqual([])
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
