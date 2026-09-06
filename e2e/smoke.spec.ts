import { test, expect, type Page } from '@playwright/test'

/**
 * End-to-end checks for the paths that matter and the layout rules that are
 * easy to break without noticing.
 */

const ROUTES = [
  '/', '/plan', '/recipes', '/foods', '/grocery',
  '/schedule', '/movement', '/analytics', '/settings', '/settings/history',
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

/**
 * A tub in the fridge, without cooking a session to get one.
 *
 * These used to be created through a "Leftovers" dialog on the schedule, which
 * has since gone: a tub arrives by being cooked, and a form asking you to
 * describe food you had already made was a second way to the same shelf that
 * nobody used. The tests that only wanted a tub to exist seed one, which is
 * what they always meant.
 */
async function putATubInTheFridge(page: Page, label: string) {
  await page.evaluate((what) => {
    localStorage.setItem('bite-buddy-portions', JSON.stringify({
      version: 3,
      state: { portions: [{
        id: 'tub-1', label: what, servings: 2,
        madeOn: new Date().toISOString().slice(0, 10),
        storage: 'fridge', source: 'leftover',
      }] },
    }))
  }, label)
  await page.reload()
}

/**
 * Moves the planner's window on to a week that has not started yet.
 *
 * Several of these tests plan a whole week and then read it back, and the app
 * will not plan or shop for a day that has gone. Run on a Wednesday that is
 * fine; run on a Sunday the current week has one day left in it, and the same
 * tests measured one seventh of what they meant to. The window is the
 * planner's own and nothing else follows it, so this only moves the screen the
 * test is working on.
 */
async function planAheadOfToday(page: Page) {
  await goto(page, '/plan')
  await page.getByRole('button', { name: 'Next week' }).click()
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

    await goto(page, '/settings/history')
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
    await goto(page, '/settings/history')
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

test.describe('the main flow', () => {
  test('load a dietician week, then build a grocery list from it', async ({ page }) => {
    const errors = trackErrors(page)

    // 1. The archive offers all 14 plans.
    await goto(page, '/settings/history')
    await expect(page.getByRole('button', { name: /^Load$/ })).toHaveCount(14)

    // 2. Loading one fills the planner. Into next week, so all seven days are
    // still ahead and the shopping list further down will offer all of them.
    await planAheadOfToday(page)
    await goto(page, '/settings/history')
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

  test('the snack shelf has snacks on it', async ({ page }) => {
    // It was permanently empty: every snack line was kept as plain food
    // entries, so the app offered four shelves and could stock three, and said
    // so in an empty state rather than fixing it.
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Snacks/ }).click()

    await expect(page.locator('[data-recipe-card]').first()).toBeVisible()
    await expect(page.getByText('Snacks are not recipes here')).toHaveCount(0)
  })

  test('a planned meal opens the recipe it is', async ({ page }) => {
    // The planner had no way through to a recipe at all. You read a name on
    // Tuesday, wondered what went in it, and had to search for it by name.
    await planAheadOfToday(page)
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()
    await goto(page, '/plan')

    const named = page.locator('a[data-entry-name]').first()
    await expect(named).toBeVisible()
    const name = (await named.innerText()).trim()
    await named.click()

    // On the recipe, and on the wording that was planned rather than whichever
    // of them happens to be first.
    await expect(page.getByText('How your dietician wrote it')).toBeVisible()
    await expect(page.getByRole('heading', { name: new RegExp(name.slice(0, 14).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }))
      .toBeVisible()
  })

  test('a recipe sheet fills its macro bars', async ({ page }) => {
    // Protein 12 g, Carbs 39 g, Fat 17 g were printed above four bars that
    // computed a zero fill every time, because a per-serving figure was passed
    // no reference value at all.
    await goto(page, '/recipes')
    await page.locator('[data-recipe-card]').first().click()

    const dialog = page.getByRole('dialog').first()
    await expect(dialog.getByText(/one serving against .+s day/)).toBeVisible()

    const filled = await dialog.locator('[data-macro-fill]').evaluateAll(
      (bars) => bars.filter((b) => parseFloat((b as HTMLElement).style.width) > 0).length)
    expect(filled, 'every macro bar rendered empty').toBeGreaterThan(0)
  })

  test('a recipe can be starred while you are reading it', async ({ page }) => {
    await goto(page, '/recipes')
    await page.locator('[data-recipe-card]').first().click()

    // The star was only ever on the card, so deciding you liked something
    // while reading it meant closing the sheet to say so.
    const star = page.getByRole('dialog').or(page.locator('body'))
      .getByRole('button', { name: 'Add to favourites' }).last()
    await star.click()
    await expect(page.getByRole('button', { name: 'Remove from favourites' }).last())
      .toBeVisible()

    // And the card underneath agrees, because a dish is favourited, not one
    // wording of it.
    await page.getByRole('button', { name: 'Close' }).click()
    await page.getByRole('button', { name: /^Favourites/ }).click()
    await expect(page.locator('[data-recipe-card]')).toHaveCount(1)
  })

  test('every screen that lists things actually lists something', async ({ page }) => {
    // Schedule filtered its list on recipes having a written method. Not one of
    // the 228 does, the dietician wrote portions, not instructions, so the
    // screen shipped permanently empty and rendered fine while doing it.
    // Nothing caught that, because "renders without errors" is exactly what an
    // empty state does.
    await goto(page, '/schedule')
    await page.getByRole('button', { name: /Session/ }).click()
    const pickable = await page.locator('input[type=checkbox]').count()
    expect(pickable, 'Schedule offers no recipes to batch').toBeGreaterThan(10)
  })

  test('a cook session says when it will email both of you', async ({ page }) => {
    await goto(page, '/schedule')
    await page.getByRole('button', { name: /Session/ }).click()
    await page.getByPlaceholder('Sunday batch cook').fill('Evening cook')

    // Tomorrow, so the reminder is genuinely in the future whatever time the
    // test runs at.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await page.locator('input[type=date]').fill(tomorrow)
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    // Not "both phones": the household is however many people have signed in.
    await expect(page.getByText(/A nudge at .*, on every phone signed in/)).toBeVisible()
    // Eighteen hundred less a quarter of an hour.
    await expect(page.getByText(/17:45/)).toBeVisible()
  })

  test('a cook session is built from what is planned, and its buttons stay in the card', async ({ page }) => {
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    await goto(page, '/schedule')
    await page.getByRole('button', { name: /Session/ }).click()

    // The week's own dishes come first, ahead of two hundred you are not
    // cooking.
    await expect(page.getByText('Planned this week')).toBeVisible()

    // Search narrows it.
    const before = await page.locator('input[type=checkbox]').count()
    await page.getByLabel('Search dishes').fill('soup')
    const after = await page.locator('input[type=checkbox]').count()
    expect(after, 'search returned nothing at all').toBeGreaterThan(0)
    expect(after, 'search did not narrow the list').toBeLessThan(before)

    // Save sits inside the dialog. The inline safe-area padding used to
    // replace the card's bottom padding rather than add to it, so the buttons
    // sat flush against the edge.
    const save = page.getByRole('button', { name: 'Save' })
    const box = await save.boundingBox()
    const card = await page.locator('.bg-paper.shadow-xl').boundingBox()
    expect(box && card && box.y + box.height).toBeLessThanOrEqual((card?.y ?? 0) + (card?.height ?? 0))
  })

  test('the food check reports on the library without changing it', async ({ page }) => {
    await goto(page, '/settings')
    await expect(page.getByText(/foods checked against their own numbers/)).toBeVisible()

    await page.getByRole('button', { name: 'Show me' }).click()
    // The shipped library has a handful of questions in it and nothing
    // impossible, so this is the shape the panel should be in.
    await expect(page.getByText(/worth a look/)).toBeVisible()
    await expect(page.getByText(/cannot be right/)).toHaveCount(0)
  })

  test('the calorie calculator shows its arithmetic', async ({ page }) => {
    await goto(page, '/settings')
    await page.getByLabel('Sex').selectOption('female')
    await page.getByLabel('Age').fill('34')
    await page.getByLabel('Height (cm)').fill('168')
    await page.getByLabel('Weight (kg)').fill('68')

    await page.getByText('How that was worked out').click()

    // The resting rate, worked by hand: 10 x 68 + 6.25 x 168 - 5 x 34 - 161.
    await expect(page.getByText('10 x 68 kg + 6.25 x 168 cm - 5 x 34 - 161')).toBeVisible()
    await expect(page.getByText('= 1399 kcal')).toBeVisible()
  })

  test('targets can be taken from the plan history', async ({ page }) => {
    await goto(page, '/settings')
    await expect(page.getByText(/Averaged over \d+ full days/)).toBeVisible()
    await page.getByRole('button', { name: 'Use these' }).first().click()
    await expect(page.getByText(/set from your plans/)).toBeVisible()
  })
})

test.describe('the home screen', () => {
  test('answers the glance: numbers, a trend, today, and something to try', async ({ page }) => {
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()
    await goto(page, '/')

    // Four tiles across the top.
    await expect(page.getByText('Mediterranean', { exact: false }).first()).toBeVisible()
    // Goals reached, not goals-plus-limits: a limit is met by eating nothing,
    // and an empty week used to report a quarter of the guide achieved.
    await expect(page.getByText('goals reached')).toBeVisible()
    await expect(page.getByText('days planned').first()).toBeVisible()

    // A fortnight of bars rather than a week: fourteen columns.
    const bars = page.locator('[title*="kcal"]')
    await expect(bars).toHaveCount(14)

    // And ideas, every one of which is grounded in the plan or the guide.
    await expect(page.getByText('Worth a thought')).toBeVisible()
    await expect(page.getByText('Nothing here is invented.')).toBeVisible()
  })
})

test.describe('the shopping list', () => {
  test('is built from the days you choose, and can be corrected afterwards', async ({ page }) => {
    await planAheadOfToday(page)
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()
    await goto(page, '/grocery')

    // Everything planned, then one day only: a shorter list, because nobody
    // shops for a fortnight at once.
    await page.getByRole('button', { name: 'Build list' }).click()
    const all = await page.locator('input[type=checkbox]').count()
    expect(all).toBeGreaterThan(20)

    await page.getByRole('button', { name: 'None' }).click()
    // The first day that can actually be ticked. Days with nothing planned are
    // shown but disabled, and the plan is in next week, so the first few cells
    // in the picker are empty ones.
    const firstDay = page.locator('button[aria-pressed]:not([disabled])').first()
    await firstDay.click()
    await page.getByRole('button', { name: 'Rebuild' }).click()
    const one = await page.locator('input[type=checkbox]').count()
    expect(one, 'one day should need less shopping than a fortnight').toBeLessThan(all)

    // A line you add by hand survives a rebuild, since the plan never knew
    // about it.
    await page.getByLabel('Add an item').fill('Washing-up liquid')
    await page.getByLabel('How much').fill('2 bottles')
    await page.getByRole('button', { name: 'Add to list' }).click()
    await expect(page.getByText('2 bottles')).toBeVisible()

    await page.getByRole('button', { name: 'Rebuild' }).click()
    await expect(page.getByText('Washing-up liquid')).toBeVisible()

    // And it can be corrected, or thrown away.
    await page.getByRole('button', { name: 'Edit Washing-up liquid' }).click()
    await page.getByLabel('Amount').fill('1.5 kg')
    await page.getByRole('button', { name: 'Save item' }).click()
    await expect(page.getByText('1.5 kg')).toBeVisible()

    await page.getByRole('button', { name: 'Edit Washing-up liquid' }).click()
    await page.getByRole('button', { name: 'Remove Washing-up liquid' }).click()
    // The row, not the text: the undo bar names the line it just took away.
    await expect(page.getByRole('button', { name: 'Washing-up liquid', exact: true }))
      .toHaveCount(0)
  })
})

test.describe('the planner', () => {
  test('shows a week or a fortnight, and keeps what you planned', async ({ page }) => {
    await goto(page, '/plan')

    const days = page.locator('button[aria-pressed]')
    await expect(days).toHaveCount(7)

    await page.getByRole('tab', { name: '2 weeks' }).click()
    await expect(days).toHaveCount(14)

    // A month is not offered any more. 150 meal slots is a grid where a day is
    // a rectangle with nothing readable in it, so the view that showed the
    // most showed the least.
    await expect(page.getByRole('tab', { name: '1 month' })).toHaveCount(0)

    // Plan something, step forward and back: it is still there. The plan used
    // to hold only the seven days on screen, so moving the window threw the
    // rest away.
    await page.getByRole('tab', { name: '1 week' }).click()
    await page.getByRole('button', { name: /Pop something in/ }).first().click()
    await page.getByPlaceholder(/What are we having/).fill('Bruschetta')
    await page.getByText('Bruschetta', { exact: false }).nth(1).click()
    await expect(page.locator('[data-entry-name]').first()).toBeVisible()

    const planned = page.locator('button[aria-pressed]').filter({ hasText: /\d\d\d/ })
    await expect(planned).toHaveCount(1)

    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(planned).toHaveCount(0)
    await page.getByRole('button', { name: 'Previous week' }).click()
    await expect(planned).toHaveCount(1)
  })
})

test.describe('the recipe library', () => {
  test('opens on one shelf rather than all 228', async ({ page }) => {
    // The screen this replaced showed every recipe at once, sorted
    // alphabetically, a wall you had to scroll past to reach anything.
    await goto(page, '/recipes')

    const shown = await page.locator('.card').count()
    expect(shown, 'the whole library is on screen again').toBeLessThan(150)
    expect(shown, 'the opening shelf is empty').toBeGreaterThan(5)

    // The number on a tab is the number of cards you then see, not the number
    // of recipes behind them. Read off whichever tab is open, which shelf that
    // is depends on the time of day, and hardcoding Breakfast made this pass
    // only before eleven in the morning.
    const label = await page.locator('button.tab-on').textContent()
    expect(Number(label?.replace(/\D/g, ''))).toBe(shown)

    // And the other shelves are one tap away.
    await page.getByRole('button', { name: /^Dishes/ }).click()
    await expect(page.getByText('Cooked once and eaten across several meals.', { exact: false })).toBeVisible()
    expect(await page.locator('.card').count()).toBeGreaterThan(5)
  })

  test('the same dish written four times is one recipe, not four', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Dinner/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('green bean soup')

    // Four lines across the plans, worded four ways, down to a typo in "sos de
    // usturoi". The importer reads them as the one dinner they are, so there is
    // nothing here to group and no numbering to hide.
    await expect(page.locator('.card')).toHaveCount(1)
    await expect(page.getByText('(2)')).toHaveCount(0)
    await expect(page.getByText(/versions/)).toHaveCount(0)
  })

  test('the same dish at three portions is one card, with the portions inside it', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Breakfast/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('rolled oats with yogurt')

    // 30, 40 and 45 g of oats is a real choice rather than a repeat, so all
    // three survive the import, and each name says which one it is.
    await expect(page.locator('.card')).toHaveCount(1)
    await expect(page.getByText(/3 versions/)).toBeVisible()

    // Finding 30: the quantity is not in the headline. It used to be, and
    // "Grapefruit with cashews (10 g cashews, 250 g grapefruit)" ran to three
    // lines on a phone.
    await expect(page.locator('.card')).not.toContainText('(30 g rolled oats)')

    await page.locator('.card button').nth(1).click()
    await expect(page.getByText(/Written 3 times across the plans/)).toBeVisible()

    // The chips said "1", "2", "3", so the one thing you opened this to
    // decide, which portion, was the one thing they would not tell you.
    for (const oats of ['30 g rolled oats', '40 g rolled oats', '45 g rolled oats']) {
      await expect(page.locator('.bg-paper').getByRole('button', { name: new RegExp(oats) }))
        .toBeVisible()
    }

    // What changes when you flip between them is the dietician's own line.
    const line = page.locator('.card-soft').first()
    const before = await line.textContent()
    // Scoped to the sheet: the filter chips behind it are also .chip-off.
    await page.locator('.bg-paper .chip-off').first().click()
    await expect(line).not.toHaveText(before ?? '')
  })

  test('there is nothing left in the shipped library to fold away', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Breakfast/ }).click()

    // This banner used to greet everyone, because 68 of the 204 imported meals
    // were repeats the importer had numbered rather than recognised. It now
    // recognises them, so the only duplicates left to offer are ones you make.
    await expect(page.getByText(/dishes are written down more than once/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Merge them' })).toHaveCount(0)
  })

  test('a dish written at different portions is never swept up automatically', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Breakfast/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('rolled oats with yogurt')

    // 30 g and 45 g of oats are a real choice, so this one keeps its versions
    // and nothing offers to fold them together.
    await page.locator('.card button').nth(1).click()
    await expect(page.getByText(/Written 3 times across the plans/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Merge them' })).toHaveCount(0)
  })

  test('merging by hand keeps the version you are looking at, and can be undone', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Breakfast/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('rolled oats with yogurt')
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
    // leave a planned day pointing at nothing. Nor must the importer's own
    // merging: a week loaded from the archive names the recipes that survived
    // it, and any id it folded away resolves through the aliases it wrote.
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()
    await goto(page, '/plan')
    await expect(page.getByText('7 of 7 days planned')).toBeVisible()
    await expect(page.getByText('Unknown')).toHaveCount(0)

    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Breakfast/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('rolled oats with yogurt')
    await page.locator('.card button').nth(1).click()
    await page.getByRole('button', { name: /Merge these into one/ }).click()
    await page.getByRole('button', { name: 'Merge into this one' }).click()

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
    await expect(page.getByText('you set this').first()).toBeVisible()
    expect(await page.getByText('you set this').count()).toBe(5)
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

  test('a recipe can be scaled, and a serving stays a serving', async ({ page }) => {
    await goto(page, '/recipes')
    await page.locator('.card button').nth(1).click()

    // The per-serving figure is the headline. Doubling the batch must not touch
    // it: twice as much food is not a more filling portion.
    const perServing = (await page.locator('p.font-mono.text-3xl').first().textContent())?.trim() ?? ''
    const first = page.locator('li').filter({ hasText: /\d+ g$/ }).first()
    const before = Number(((await first.textContent()) ?? '').match(/(\d+) g/)?.[1] ?? 0)
    expect(before, 'no weighed ingredient to scale').toBeGreaterThan(0)

    await page.getByRole('button', { name: 'One serving more' }).click()

    await expect(page.getByText(/Scaled from \d+/)).toBeVisible()
    expect((await page.locator('p.font-mono.text-3xl').first().textContent())?.trim()).toBe(perServing)
    const after = Number(((await first.textContent()) ?? '').match(/(\d+) g/)?.[1] ?? 0)
    expect(after).toBeGreaterThan(before)
  })

  test('a recipe of your own can be written and lands on your shelf', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /New recipe/ }).click()

    await page.getByLabel('Recipe name').fill('Midnight beans')
    await page.getByRole('button', { name: /Add ingredient/ }).click()
    await page.getByPlaceholder(/Anything: yours/).fill('lentil')
    await page.locator('button').filter({ hasText: /kcal \/ 100 g/ }).first().click()

    // The numbers are derived from what went in, never typed.
    await expect(page.getByText('Per serving')).toBeVisible()
    await page.getByRole('button', { name: 'Add recipe' }).click()

    // It says it saved, and offers the way back. Adding was the one action in
    // the app that happened in silence while removing announced itself.
    await expect(page.getByText('Saved Midnight beans')).toBeVisible()

    // And it is on screen without being asked for. This used to close on
    // Dishes, because a new recipe has no meal tags and that is where the tag
    // rules put it, so the thing you had just written was nowhere in sight.
    // No clicking through to Yours first: that is the whole assertion.
    await expect(page.locator('[data-recipe-card]').filter({ hasText: 'Midnight beans' }))
      .toBeVisible()
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

  test('deleting a recipe takes it out of everything but leaves history alone', async ({ page }) => {
    // Built as a scenario rather than picked out of the library, so every clause
    // is exercised on one recipe whose name and contents are known.
    await goto(page, '/recipes')
    await page.getByRole('button', { name: 'New recipe' }).click()
    await page.getByLabel('Recipe name').fill('Doomed dinner')
    await page.getByRole('button', { name: /Add ingredient/ }).click()
    await page.getByPlaceholder(/Anything: yours/).fill('chicken breast')
    await page.locator('button').filter({ hasText: /kcal \/ 100 g/ }).first().click()
    await page.getByRole('button', { name: 'Add recipe' }).click()

    // Put it in a day, and remember what that day came to.
    await goto(page, '/plan')
    await page.getByRole('button', { name: /Pop something in/ }).first().click()
    await page.getByPlaceholder(/What are we having/).fill('Doomed dinner')
    await page.getByText('Doomed dinner').first().click()
    await expect(page.locator('[data-entry-name]').filter({ hasText: 'Doomed dinner' })).toBeVisible()
    const dayTotal = await page.locator('text=/\\d+ of 7 days planned/').first().textContent()

    // Star it, so the delete has a favourite to clear.
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Yours/ }).click()
    await expect(page.locator('[data-recipe-card]').filter({ hasText: 'Doomed dinner' }))
      .toBeVisible()
    await page.getByRole('button', { name: 'Add to favourites' }).first().click()

    // Delete it. The confirmation names it and says what will not be affected.
    await page.locator('.card button').nth(1).click()
    await page.getByRole('button', { name: 'Edit recipe' }).click()
    await page.getByRole('button', { name: /Delete this recipe/ }).click()
    await expect(page.getByText('Delete “Doomed dinner”?')).toBeVisible()
    await expect(page.getByText(/[Hh]istorical meal data/)).toBeVisible()
    await page.getByRole('button', { name: 'Yes, delete' }).click()

    // Gone from the list, from search, and from favourites. The card rather
    // than the text: the undo bar names what it just did, and the delete
    // confirmation named it a moment ago.
    await expect(page.locator('[data-recipe-card]').filter({ hasText: 'Doomed dinner' }))
      .toHaveCount(0)
    await page.getByPlaceholder(/Search in English/).fill('Doomed dinner')
    // The card, not the text: the empty state now names what it could not
    // find, which is the point of it.
    await expect(page.locator('[data-recipe-card]')).toHaveCount(0)
    await page.getByPlaceholder(/Search in English/).fill('')
    await page.getByRole('button', { name: /Favourites/ }).click()
    await expect(page.locator('[data-recipe-card]').filter({ hasText: 'Doomed dinner' }))
      .toHaveCount(0)

    // Gone from the planner's picker. Scoped to the sheet, since the plan
    // behind it still shows the meal, that is the point of the next assertion.
    await goto(page, '/plan')
    await page.getByRole('button', { name: /Pop something in/ }).first().click()
    await page.getByRole('button', { name: 'recipes' }).click()
    await page.getByPlaceholder(/What are we having/).fill('Doomed dinner')
    // Asserted on the empty state rather than on the absence of the name: the
    // name is in the "no matches" message itself, so counting it always found one.
    await expect(page.getByText(/No recipes match/)).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()

    // But the day it was planned into is exactly as it was, and says why.
    await expect(page.locator('text=/\\d+ of 7 days planned/').first()).toHaveText(dayTotal ?? '')
    const line = page.locator('[data-entry-name]').filter({ hasText: 'Doomed dinner' })
    await expect(line).toBeVisible()
    await expect(line).toContainText('deleted')

    // And it can be put back.
    await goto(page, '/settings')
    await page.getByRole('button', { name: 'Restore' }).first().click()
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Yours/ }).click()
    // The card. An undo offer stands for its window and is deliberately found
    // again on coming back to the screen it was made on, so within these few
    // seconds "Saved Doomed dinner" is still on the page and the bare text
    // matches twice.
    await expect(page.locator('[data-recipe-card]').filter({ hasText: 'Doomed dinner' }))
      .toBeVisible()
  })

  test('deleting a recipe leaves its ingredients alone', async ({ page }) => {
    // Other recipes use them.
    await goto(page, '/foods')
    const before = await page.locator('.card').count()

    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Lunch/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('chili con carne')
    await page.locator('.card button').nth(1).click()
    await page.getByRole('button', { name: 'Edit recipe' }).click()
    await page.getByRole('button', { name: /Delete this recipe/ }).click()
    await page.getByRole('button', { name: 'Yes, delete' }).click()

    await goto(page, '/foods')
    expect(await page.locator('.card').count()).toBe(before)
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

    // The meal is gone. The batch dish of the same name that it was built from
    // is not, and searching now falls through to it, which is the point of
    // deleting a meal rather than its ingredients.
    await expect(page.getByText('Chili con carne with bulgur & pickles')).toHaveCount(0)
    await expect(page.getByText('Nothing on this shelf, so this is every shelf.')).toBeVisible()
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

test.describe('building a recipe from the food database', () => {
  test('an ingredient can be entered in any unit and is stored in grams', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: 'New recipe' }).click()
    await page.getByLabel('Recipe name').fill('Unit test dinner')

    await page.getByRole('button', { name: /Add ingredient/ }).click()
    await page.getByPlaceholder(/Anything: yours/).fill('olive oil')
    await page.locator('button').filter({ hasText: /kcal \/ 100 g/ }).first().click()

    // Switching to tablespoons restates the same weight rather than changing it.
    const amount = page.getByLabel(/Amount of/).first()
    const unit = page.getByLabel(/Unit for/).first()
    await amount.fill('30')
    const kcalAt30g = await page.locator('p.text-2xl').first().textContent()

    await unit.selectOption('tbsp')
    await expect(amount).toHaveValue('2')
    expect(await page.locator('p.text-2xl').first().textContent()).toBe(kcalAt30g)

    // And entering 3 tbsp is 45 g, which the row says in grams underneath.
    // Scoped to the sheet: recipe cards behind it mention grams too.
    await amount.fill('3')
    await expect(page.locator('.bg-paper').getByText(/kcal · 45 g/)).toBeVisible()
  })

  test('changing a quantity recalculates immediately', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: 'New recipe' }).click()
    await page.getByLabel('Recipe name').fill('Recalculation')
    await page.getByRole('button', { name: /Add ingredient/ }).click()
    await page.getByPlaceholder(/Anything: yours/).fill('chicken breast')
    await page.locator('button').filter({ hasText: /kcal \/ 100 g/ }).first().click()

    const headline = page.locator('p.text-2xl').first()
    await page.getByLabel(/Amount of/).first().fill('100')
    const at100 = Number((await headline.textContent())?.replace(/\D/g, ''))

    await page.getByLabel(/Amount of/).first().fill('180')
    const at180 = Number((await headline.textContent())?.replace(/\D/g, ''))

    expect(at100).toBeGreaterThan(0)
    expect(at180 / at100).toBeCloseTo(1.8, 1)
  })

  test('a partial total says so instead of claiming a figure', async ({ page }) => {
    // The curated foods do not all carry every micronutrient, so a recipe made
    // of two of them can have a fibre floor rather than a fibre total.
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Dinner/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('green bean soup')
    await page.locator('.card button').nth(1).click()

    const note = page.getByText(/means a floor, not a total/)
    const plus = page.locator('text=/\\d+(\\.\\d+)? g\\u2009\\+/')
    // Either the total is complete, or it is marked, never a bare number that
    // silently treats unknown as zero.
    if (await plus.count() > 0) await expect(note).toBeVisible()
  })
})

test.describe('progress, per person', () => {
  test('weight and the five measurements are logged and shown separately', async ({ page }) => {
    await goto(page, '/analytics')
    await page.getByRole('tab', { name: 'Body' }).click()

    await page.getByLabel('Weight').fill('68.4')
    await page.getByRole('button', { name: /^Log$/ }).click()
    await expect(page.getByText('68.4 kg')).toBeVisible()

    // Only what was actually measured: a blank is not a zero.
    await page.getByLabel('Waist').fill('80')
    await page.getByLabel('Thighs').fill('55')
    await page.getByRole('button', { name: /Log measurements/ }).click()

    await expect(page.getByText('waist 80 · thighs 55')).toBeVisible()

    // A summary card per measurement taken. Anchored to the start of the card's
    // text, since the entry form and the history list mention the same words.
    await expect(page.locator('.card').filter({ hasText: /^Waist\d/ })).toBeVisible()
    await expect(page.locator('.card').filter({ hasText: /^Thighs\d/ })).toBeVisible()
    // Chest was left blank, so it gets no card: a blank is not a zero.
    await expect(page.locator('.card').filter({ hasText: /^Chest\d/ })).toHaveCount(0)
  })

  test('the two people have their own histories, signed in or not', async ({ page }) => {
    await goto(page, '/analytics')
    await page.getByRole('tab', { name: 'Body' }).click()

    // Both tabs are there before anybody signs in. They used to appear only
    // once the household list loaded, which meant never on a device that was
    // signed out, and the one history on screen belonged to whoever was
    // holding the phone.
    await expect(page.getByRole('tab', { name: 'Arany' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Oli' })).toBeVisible()

    await page.getByLabel('Weight').fill('68.4')
    await page.getByRole('button', { name: /^Log$/ }).click()
    await expect(page.getByText('68.4 kg')).toBeVisible()

    await page.getByRole('tab', { name: 'Oli' }).click()
    await expect(page.getByText('68.4 kg')).toHaveCount(0)

    await page.getByLabel('Weight').fill('61.2')
    await page.getByRole('button', { name: /^Log$/ }).click()
    await expect(page.getByText('61.2 kg')).toBeVisible()

    await page.getByRole('tab', { name: 'Arany' }).click()
    await expect(page.getByText('68.4 kg')).toBeVisible()
    await expect(page.getByText('61.2 kg')).toHaveCount(0)
  })

  test('a measurement can be taken back off', async ({ page }) => {
    await goto(page, '/analytics')
    await page.getByRole('tab', { name: 'Body' }).click()
    await page.getByLabel('Hips').fill('95')
    await page.getByRole('button', { name: /Log measurements/ }).click()
    await expect(page.getByText('hips 95')).toBeVisible()

    await page.getByRole('button', { name: 'Remove' }).first().click()
    await expect(page.getByText('hips 95')).toHaveCount(0)
  })
})

test.describe('movement, per person', () => {
  test('a session is built from the exercise list and costed from your weight', async ({ page }) => {
    // A weight first: without one the app refuses to guess a calorie figure.
    await goto(page, '/analytics')
    await page.getByRole('tab', { name: 'Body' }).click()
    await page.getByLabel('Weight').fill('70')
    await page.getByRole('button', { name: /^Log$/ }).click()

    await goto(page, '/movement')
    await page.getByRole('button', { name: 'Build a session' }).click()
    await page.getByLabel('Search exercises').fill('running')
    await page.getByRole('button', { name: /Running \(10 km\/h\)/ }).click()
    await page.getByRole('button', { name: 'Save session' }).click()

    // 10 METs, 70 kg, 30 minutes: 10 x 3.5 x 70 / 200 x 30 = 368 kcal.
    await expect(page.getByText(/30 min · about 368 kcal/)).toBeVisible()
  })

  test('a session can be logged in one lump, with the figure your watch gave', async ({ page }) => {
    await goto(page, '/movement')
    await page.getByRole('button', { name: 'Log it in one go' }).click()
    await page.getByLabel('What was it').fill('Climbing')
    await page.getByLabel('kcal, if known').fill('430')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByText('Climbing')).toBeVisible()
    await expect(page.getByText(/about 430 kcal/)).toBeVisible()
  })

  test('the two people keep separate logs', async ({ page }) => {
    await goto(page, '/movement')
    await page.getByRole('button', { name: 'Log it in one go' }).click()
    await page.getByLabel('What was it').fill('Arany swim')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Arany swim')).toBeVisible()

    await page.getByRole('tab', { name: 'Oli' }).click()
    await expect(page.getByText('Arany swim')).toHaveCount(0)
  })

  test('sleep is logged per person and kept per night', async ({ page }) => {
    await goto(page, '/movement')
    await page.getByRole('tab', { name: 'Sleep' }).click()
    await page.getByLabel('Hours slept').fill('7.5')
    await page.getByRole('button', { name: /^Log$/ }).click()
    await expect(page.getByText('7.5 h', { exact: true })).toBeVisible()

    await page.getByRole('tab', { name: 'Oli' }).click()
    await expect(page.getByText('7.5 h', { exact: true })).toHaveCount(0)
  })
})

test.describe('the food library', () => {
  test('a food can be edited, and the edit sticks', async ({ page }) => {
    await goto(page, '/foods')
    await page.getByPlaceholder(/Search/).first().fill('asparagus')
    await page.getByRole('button', { name: /^Edit / }).first().click()

    await expect(page.getByLabel('Food name')).toHaveValue('Asparagus')
    await page.getByLabel('Food name').fill('Asparagus spears')
    await page.getByRole('button', { name: 'Save changes' }).click()

    // First, because the rename reaches the archive too: the dietician's lines
    // are read through the food database, so renaming a food renames it there
    // as well. That is the point of building the reading on the food names
    // rather than on a second list of translated strings.
    await expect(page.getByText('Asparagus spears').first()).toBeVisible()
  })

  test('the name line no longer claims a language it is not', async ({ page }) => {
    // It joined the Romanian name, the Hungarian name and the weighing state
    // into one string and labelled the lot "RO".
    await goto(page, '/foods')
    await page.getByPlaceholder(/Search/).first().fill('asparagus')

    await expect(page.getByText('sparanghel · spárga', { exact: false })).toBeVisible()
    await expect(page.locator('text=/^RO$/')).toHaveCount(0)
  })

  test('duplicate ingredients can be folded together, and stay folded', async ({ page }) => {
    await goto(page, '/foods')

    // Add the same food twice, the way two sources would.
    for (const _ of [1, 2]) {
      await page.getByRole('button', { name: 'Add food' }).click()
      await page.getByLabel('Name (English)').fill('Test kefir')
      await page.getByRole('button', { name: 'Save food' }).click()
    }

    await expect(page.getByText('Test kefir')).toHaveCount(2)

    await page.getByRole('button', { name: 'Merge them' }).click()
    await expect(page.getByText('Test kefir')).toHaveCount(1)

    // And it is still one after a reload, which is the whole point.
    await page.reload()
    await expect(page.getByText('Test kefir')).toHaveCount(1)
  })

  test('deleting a food leaves the recipes that use it intact', async ({ page }) => {
    // A food is named by every recipe containing it, and directly by the snack
    // lines in a plan. Destroying it would blank them all at once.
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()
    await goto(page, '/plan')
    const before = await page.locator('text=/\\d+ of 7 days planned/').first().textContent()

    await goto(page, '/foods')
    await page.getByPlaceholder(/Search/).first().fill('olive oil')
    await page.getByRole('button', { name: /^Edit / }).first().click()
    await page.getByRole('button', { name: /Delete this food/ }).click()
    await expect(page.getByText(/Delete “Extra virgin olive oil”\?/)).toBeVisible()
    await expect(page.getByText(/nothing you have already eaten is affected/i)).toBeVisible()
    await page.getByRole('button', { name: 'Yes, delete' }).click()

    // Gone from the library…
    await page.getByPlaceholder(/Search/).first().fill('olive oil')
    await expect(page.getByRole('button', { name: /^Edit Extra virgin olive oil/ })).toHaveCount(0)

    // …and the week is untouched.
    await goto(page, '/plan')
    expect(await page.locator('text=/\\d+ of 7 days planned/').first().textContent()).toBe(before)

    // And it can be put back.
    await goto(page, '/settings')
    await expect(page.getByText('Deleted foods')).toBeVisible()
    await page.getByRole('button', { name: 'Restore' }).first().click()
    await goto(page, '/foods')
    await page.getByPlaceholder(/Search/).first().fill('olive oil')
    await expect(page.getByRole('button', { name: /^Edit Extra virgin olive oil/ })).toBeVisible()
  })
})

test.describe('finding an ingredient', () => {
  test('one search covers your foods, your recipes and the open databases', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: 'New recipe' }).click()
    await page.getByRole('button', { name: /Add ingredient/ }).click()

    // One box, no tabs to choose between first.
    await expect(page.getByPlaceholder(/Anything: yours, USDA, Open Food Facts/)).toBeVisible()
    await page.getByPlaceholder(/Anything: yours/).fill('chicken')

    // Your own things appear immediately, with no network involved.
    await expect(page.getByText('Your foods')).toBeVisible()
    await expect(page.getByText('Chicken breast', { exact: false }).first()).toBeVisible()
  })

  test('says why nothing came back, rather than just showing nothing', async ({ page }) => {
    // A sandboxed run cannot reach USDA or Open Food Facts, which is the same
    // situation as being in a shop with no signal, and must not look like
    // "this food does not exist".
    await goto(page, '/recipes')
    await page.getByRole('button', { name: 'New recipe' }).click()
    await page.getByRole('button', { name: /Add ingredient/ }).click()
    await page.getByPlaceholder(/Anything: yours/).fill('zzzznotafood')

    await expect(page.getByText(/no signal|rate-limiting|unreachable|Nothing anywhere matches/i))
      .toBeVisible({ timeout: 15_000 })
  })
})

test.describe('settings without an account', () => {
  test('every screen still renders with no dark palette to fall back to', async ({ page }) => {
    // The theme is gone; what is left has to be legible on its own.
    const errors = trackErrors(page)
    for (const route of ROUTES) {
      await goto(page, route)
      await expect(page.locator('h1').first()).toBeVisible()
    }
    expect(errors).toEqual([])
  })
})

test.describe('your data survives the browser', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

  test('a backup can be taken out and brought back', async ({ page }) => {
    // Nothing here syncs anywhere, so a backup is the only copy of a planned
    // week that outlives the browser storage it was written to.
    await goto(page, '/settings/history')
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

    // Reading it and doing it are two steps now, with what would be replaced
    // named in between.
    await page.getByRole('button', { name: 'Read it' }).click()
    await expect(page.getByText('your plan, weeks and shopping list')).toBeVisible()
    await page.getByRole('button', { name: 'Replace it all' }).click()
    await expect(page.getByText(/Restored everything/)).toBeVisible()

    await goto(page, '/plan')
    await expect(page.getByText('7 of 7 days planned')).toBeVisible()
  })

  test('a file from another version is refused, not half-applied', async ({ page }) => {
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    await goto(page, '/settings')
    await page.getByRole('button', { name: 'Paste a backup' }).click()
    await page.getByPlaceholder(/Paste the contents/)
      .fill('{"app":"bite-buddy","schema":99,"stores":{"bite-buddy-mealplan-v2":{"plan":[]}}}')
    await page.getByRole('button', { name: 'Read it' }).click()

    await expect(page.getByText(/left alone/)).toBeVisible()
    // Refused at the reading step, so there is nothing to agree to.
    await expect(page.getByRole('button', { name: 'Replace it all' })).toHaveCount(0)
    await goto(page, '/plan')
    await expect(page.getByText('7 of 7 days planned')).toBeVisible()
  })
})

test.describe('rearranging the week', () => {
  test('a meal moves to another day and slot, and can be copied instead', async ({ page }) => {
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    await goto(page, '/plan')
    // A day with meals on it, rather than whichever day today happens to be.
    await page.locator('button[aria-pressed]').filter({ hasText: /\d\d\d/ }).first().click()

    const lunch = page.locator('.card').filter({ hasText: 'Lunch' }).first()
    const moved = (await lunch.locator('[data-entry-name]').first().textContent())?.trim() ?? ''
    expect(moved.length, 'no lunch to move').toBeGreaterThan(0)

    await lunch.getByRole('button', { name: 'Move or copy meal' }).first().click()
    // One shared picker now, the same one every other screen asks with.
    await page.getByRole('button', { name: 'Dinner', exact: true }).click()
    await page.getByRole('button', { name: 'Move it' }).click()

    // Same day, different slot: it left lunch and arrived at dinner.
    await expect(page.locator('.card').filter({ hasText: 'Dinner' }).first()
      .locator('[data-entry-name]').filter({ hasText: moved })).toBeVisible()
  })

  test('a copy leaves the original where it was', async ({ page }) => {
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    await goto(page, '/plan')
    await page.locator('button[aria-pressed]').filter({ hasText: /\d\d\d/ }).first().click()

    const breakfast = page.locator('.card').filter({ hasText: 'Breakfast' }).first()
    const name = (await breakfast.locator('[data-entry-name]').first().textContent())?.trim() ?? ''

    await breakfast.getByRole('button', { name: 'Move or copy meal' }).first().click()
    await page.getByRole('button', { name: 'Snack 1', exact: true }).click()
    await page.getByRole('button', { name: 'Copy it' }).click()

    await expect(breakfast.locator('[data-entry-name]').filter({ hasText: name })).toBeVisible()
    await expect(page.locator('.card').filter({ hasText: 'Snack 1' }).first()
      .locator('[data-entry-name]').filter({ hasText: name })).toBeVisible()
  })
})

test.describe('cooking once and eating twice', () => {
  test('a cook session fills the fridge, and the fridge fills a meal slot', async ({ page }) => {
    await goto(page, '/schedule')

    // Nothing cooked yet, so the app says so rather than showing an empty list.
    await expect(page.getByText('Nothing cooked and waiting')).toBeVisible()

    await page.getByRole('button', { name: 'Session' }).click()
    await page.getByPlaceholder('Search your recipes').fill('soup')
    await page.locator('label').filter({ hasText: /soup/i }).first().click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    // Ticking it off asks what came out of the pan.
    await page.getByRole('button', { name: 'Mark as done' }).first().click()
    await expect(page.getByText('What came out?')).toBeVisible()
    await page.getByRole('button', { name: 'Into the fridge' }).click()

    await expect(page.getByText('In the fridge')).toBeVisible()

    // And it is offered first the next time a meal needs filling in.
    await goto(page, '/plan')
    await page.getByRole('button', { name: /Pop something in/ }).first().click()
    await expect(page.getByRole('button', { name: /^fridge/ })).toBeVisible()
    await page.locator('button').filter({ hasText: /portions? left/ }).first().click()

    await expect(page.locator('[data-entry-name]').first()).toBeVisible()
    await expect(page.getByText('fridge').first()).toBeVisible()
  })

})

test.describe('the cupboard', () => {
  test('what you already have comes off the shopping list', async ({ page }) => {
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    await goto(page, '/grocery')
    await page.getByRole('button', { name: /Build list/ }).click()

    const lines = page.locator('.card input[type="checkbox"]')
    const before = await lines.count()
    expect(before, 'nothing on the list to test with').toBeGreaterThan(2)

    // Say you have the first thing, which puts it in the cupboard rather than
    // merely off the list: the difference shows on the next rebuild.
    const first = page.locator('.card button.text-left').first()
    const name = ((await first.textContent()) ?? '').trim()
    await first.click()
    await page.getByRole('button', { name: /We already have/ }).click()

    await expect(page.locator('.card button.text-left').filter({ hasText: name })).toHaveCount(0)

    await page.getByRole('button', { name: /Rebuild/ }).click()
    await expect(
      page.locator('.card button.text-left').filter({ hasText: name }),
      'the list asked for something the cupboard already has',
    ).toHaveCount(0)

    // And it is listed as something you have.
    await page.getByRole('button', { name: /^Cupboard/ }).click()
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible()
  })

  test('a staple never appears again', async ({ page }) => {
    await goto(page, '/grocery')
    await page.getByRole('button', { name: /^Cupboard/ }).click()

    await page.getByPlaceholder('Search your foods').fill('olive oil')
    await page.locator('button').filter({ hasText: /olive oil/i }).first().click()

    await page.getByRole('button', { name: /Always have/ }).first().click()
    await expect(page.getByRole('button', { name: /Always have/ }).first()).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('filling the gaps', () => {
  test('offers a week, lets you drop one, and only then writes anything', async ({ page }) => {
    await planAheadOfToday(page)
    await page.getByRole('button', { name: 'Fill the gaps' }).click()

    await expect(page.getByText('A week, if you like it')).toBeVisible()

    const rows = page.locator('.card').filter({ hasText: /Breakfast|Lunch|Dinner/ }).locator('button[aria-label^="Not "]')
    const offered = await rows.count()
    expect(offered, 'nothing was proposed').toBeGreaterThan(3)

    // Nothing is written while you are still looking at it.
    await expect(page.locator('[data-entry-name]')).toHaveCount(0)

    await rows.first().click()
    await expect(page.getByRole('button', { name: `Add these ${offered - 1} meals` })).toBeVisible()

    await page.getByRole('button', { name: /^Add these/ }).click()
    await expect(page.locator('[data-entry-name]').first()).toBeVisible()
  })

  test('every proposal says why it is there', async ({ page }) => {
    await goto(page, '/plan')
    await page.getByRole('button', { name: 'Fill the gaps' }).click()

    // The whole argument for doing this without a model is that each suggestion
    // can be checked against the plan in front of you.
    const reasons = page.locator('p.text-xs.text-ink-500')
    expect(await reasons.count()).toBeGreaterThan(0)
    await expect(reasons.first()).not.toBeEmpty()
  })
})

test.describe('what the kitchen has to say', () => {
  test('leftovers with nothing planned to eat them reach the home screen', async ({ page }) => {
    await goto(page, '/schedule')
    await putATubInTheFridge(page, 'Half a lasagne')

    await goto(page, '/')
    await expect(page.getByText(/waiting|cooked and waiting/).first()).toBeVisible()
  })

  test('it stops once something is planned to eat them', async ({ page }) => {
    await goto(page, '/schedule')
    await putATubInTheFridge(page, 'Half a lasagne')

    await goto(page, '/plan')
    await page.getByRole('button', { name: /Pop something in/ }).first().click()
    await page.locator('button').filter({ hasText: /portions? left/ }).first().click()

    await goto(page, '/')
    await expect(page.getByText('Half a lasagne is waiting')).toHaveCount(0)
  })

  test('home never turns into an alert centre', async ({ page }) => {
    // Four is the cap. A screen that raises five things is one people learn to
    // scroll past, which costs the one that actually needed saying.
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    await goto(page, '/')
    const section = page.locator('section').filter({ hasText: 'Worth a thought' })
    if (await section.count()) {
      expect(await section.locator('a').count()).toBeLessThanOrEqual(4)
    }
  })
})

test.describe('asking the recipe list a question', () => {
  test('quick tonight narrows the list and says what it did', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Breakfast/ }).click()
    const before = await page.locator('.card').count()

    await page.getByRole('button', { name: /Quick tonight/ }).click()
    await expect(page.getByText(/Twenty minutes or less/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Quick tonight/ })).toHaveAttribute('aria-pressed', 'true')

    // Narrower, and not empty. The dietician wrote portions rather than
    // methods, so every imported meal used to have no time at all and this
    // filter could only see the hand-written dishes.
    const after = await page.locator('.card').count()
    expect(after).toBeGreaterThan(0)
    expect(after).toBeLessThan(before)

    // Pressing it again puts everything back.
    await page.getByRole('button', { name: /Quick tonight/ }).click()
    await expect(page.getByText(/Twenty minutes or less/)).toHaveCount(0)
  })

  test('worth a batch offers what the plans actually cooked again', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Dishes/ }).click()

    await page.getByRole('button', { name: /Worth a batch/ }).click()
    await expect(page.getByText(/the plans came back to it/)).toBeVisible()

    // Nothing in this library makes four servings, so the old rule matched
    // nothing at all. A pot of soup that did two dinners twice over is the
    // real answer.
    expect(await page.locator('.card').count()).toBeGreaterThan(0)
  })

  test('a time nobody wrote down is offered as an estimate', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Dinner/ }).click()
    await page.getByPlaceholder(/Search in English/).fill('green bean soup with')
    await page.locator('.card button').first().click()

    await expect(page.getByText(/about \d+ min/).first()).toBeVisible()
  })

  test('a lens it cannot answer says what is missing rather than showing nothing', async ({ page }) => {
    // An empty cupboard cannot answer "from the cupboard". Saying so is the
    // honest version; an empty screen would read as "you have no recipes".
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /From the cupboard/ }).click()
    await expect(page.getByText(/Nothing in the cupboard yet/)).toBeVisible()
    // And a way straight to the screen that fixes it, rather than its name.
    await expect(page.getByRole('link', { name: 'Open the cupboard' })).toBeVisible()
  })

  test('the cupboard lens works once there is something in it', async ({ page }) => {
    await goto(page, '/grocery')
    await page.getByRole('button', { name: /^Cupboard/ }).click()
    await page.getByPlaceholder('Search your foods').fill('olive oil')
    await page.locator('button').filter({ hasText: /olive oil/i }).first().click()

    await goto(page, '/recipes')
    await page.getByRole('button', { name: /From the cupboard/ }).click()
    await expect(page.getByText(/Everything it needs is something you have/)).toBeVisible()
  })
})

test.describe('a laptop is not a large phone', () => {
  test.use({ viewport: { width: 1512, height: 950 } })

  test('a whole day fits on the planner without scrolling', async ({ page }, testInfo) => {
    // A laptop assertion, and only that. The phone viewport is 844px tall, so
    // a 950px ceiling sits below its fold and never asserted anything there:
    // on a phone you scroll a day, which is what a phone is for.
    test.skip(testInfo.project.name !== 'desktop', 'this fold belongs to a laptop')

    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()
    await goto(page, '/plan')

    // All five slots, in the viewport, at once. Stacked full width a laptop
    // showed two and put the rest below the fold, which is the one thing a big
    // screen should never do to a day.
    for (const slot of ['Breakfast', 'Snack 1', 'Lunch', 'Snack 2', 'Dinner']) {
      const box = await page.getByText(slot, { exact: true }).first().boundingBox()
      expect(box, `${slot} is missing`).not.toBeNull()
      expect(box!.y, `${slot} is below the fold`).toBeLessThan(950)
    }
  })

  test('the shopping list uses both halves of the screen', async ({ page }) => {
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()
    await goto(page, '/grocery')
    await page.getByRole('button', { name: /Build list/ }).click()

    const rows = page.locator('.card input[type="checkbox"]')
    await expect(rows.first()).toBeVisible()

    // Two columns means two distinct left edges. Every row has to be measured,
    // not the first twenty: a column layout fills the left column first, so a
    // sample from the top is all in one column by definition.
    const lefts = new Set<number>()
    for (let i = 0; i < await rows.count(); i++) {
      const box = await rows.nth(i).boundingBox()
      if (box) lefts.add(Math.round(box.x / 50))
    }
    expect(lefts.size, 'the list is still one column on a laptop').toBeGreaterThan(1)
  })

  test('a dietician line never runs past two lines on a card', async ({ page }) => {
    // `block` and `line-clamp-2` both set display, and block was winning, so
    // the clamp did nothing and a 187-character line took six lines of a card.
    await goto(page, '/recipes')
    const line = page.locator('.card span.line-clamp-2').first()
    await expect(line).toBeVisible()
    const box = await line.boundingBox()
    expect(box!.height).toBeLessThan(48)
  })
})

test.describe('a recipe of your own, with your own notes on it', () => {
  test('notes, a link and a difficulty survive being saved and reopened', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /New recipe/ }).first().click()

    await page.getByLabel('Recipe name').fill('Sunday lasagne')
    await page.getByRole('button', { name: 'A project' }).click()
    await page.getByLabel('Notes').fill('Oli likes it with more béchamel.')
    await page.getByLabel('Where it came from').fill('bbcgoodfood.com/recipes/lasagne')
    await page.getByRole('button', { name: 'Add recipe' }).click()

    await page.getByText('Sunday lasagne').first().click()

    await expect(page.getByText('Oli likes it with more béchamel.')).toBeVisible()
    await expect(page.getByRole('link', { name: /bbcgoodfood.com/ })).toBeVisible()
    await expect(page.getByText('A project')).toBeVisible()
  })

  test('a link that is not a link is refused rather than rendered', async ({ page }) => {
    // A recipe is data, and data that becomes an href runs on this page with
    // this session. Only http and https ever get that far.
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /New recipe/ }).first().click()

    await page.getByLabel('Recipe name').fill('Suspicious pie')
    await page.getByLabel('Where it came from').fill('javascript:alert(1)')
    await expect(page.getByText(/not a web address/)).toBeVisible()

    await page.getByRole('button', { name: 'Add recipe' }).click()
    await page.getByText('Suspicious pie').first().click()

    // The property that matters, rather than a count of links: nothing on the
    // page points at a script, and the recipe shows no outward link at all.
    await expect(page.locator('a[href^="javascript"]')).toHaveCount(0)
    await expect(page.locator('a[target="_blank"]')).toHaveCount(0)
  })
})

test.describe('whether tonight can actually be cooked', () => {
  test('says nothing at all until the cupboard has something in it', async ({ page }) => {
    // With an empty cupboard every meal is missing everything, and saying so on
    // thirty five slots is the kind of noise that teaches people to stop
    // reading an app.
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    await goto(page, '/plan')
    await expect(page.getByText(/to buy:/i)).toHaveCount(0)
    await expect(page.getByText('Everything in')).toHaveCount(0)
  })

  test('names what is short once it knows what you have', async ({ page }) => {
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    await goto(page, '/grocery')
    await page.getByRole('button', { name: /^Cupboard/ }).click()
    await page.getByPlaceholder('Search your foods').fill('olive oil')
    await page.locator('button').filter({ hasText: /olive oil/i }).first().click()

    await goto(page, '/plan')
    await page.locator('button[aria-pressed]').filter({ hasText: /\d\d\d/ }).first().click()

    // Named rather than counted, and never a verdict on the kitchen.
    const line = page.getByText(/to buy:/i).first()
    await expect(line).toBeVisible()
    expect(await line.textContent()).not.toMatch(/cannot|impossible|not cookable/i)
  })
})

test.describe('what you enter is still there tomorrow', () => {
  /**
   * The check that nothing else makes.
   *
   * Every store writes to localStorage through the same persist wrapper, and a
   * store that stops writing looks completely normal until the page is
   * reloaded. Screens are tested for what they show; this is the only test that
   * closes the app and opens it again.
   */
  test('a week, a target, a weight, a workout and a cook session all survive a reload', async ({ page }) => {
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    await goto(page, '/analytics')
    await page.getByRole('tab', { name: 'Body' }).click()
    await page.getByLabel('Weight').fill('69.2')
    await page.getByRole('button', { name: /^Log$/ }).click()
    await expect(page.getByText('69.2 kg')).toBeVisible()

    await goto(page, '/movement')
    await page.getByRole('button', { name: 'Log it in one go' }).click()
    await page.getByLabel('What was it').fill('Long walk')
    await page.getByLabel('kcal, if known').fill('310')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Long walk')).toBeVisible()

    await goto(page, '/schedule')
    await page.getByRole('button', { name: /Session/ }).click()
    await page.getByPlaceholder('Sunday batch cook').fill('Reload cook')
    await page.locator('input[type=date]')
      .fill(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Reload cook')).toBeVisible()

    await goto(page, '/settings')
    await page.getByRole('button', { name: 'Use these' }).first().click()
    await expect(page.getByText(/set from your plans/)).toBeVisible()

    // Reload is the whole point: this is the app being closed and opened.
    await page.reload()
    await page.waitForLoadState('networkidle')

    await goto(page, '/plan')
    await expect(page.getByText('7 of 7 days planned')).toBeVisible()

    await goto(page, '/analytics')
    await page.getByRole('tab', { name: 'Body' }).click()
    await expect(page.getByText('69.2 kg')).toBeVisible()

    await goto(page, '/movement')
    await expect(page.getByText('Long walk')).toBeVisible()

    await goto(page, '/schedule')
    await expect(page.getByText('Reload cook')).toBeVisible()

    await goto(page, '/settings')
    await expect(page.getByText(/set from your plans/)).toBeVisible()

    // Every store that holds something is on disk under its own key, which is
    // also the key it syncs under. A store missing here saves nowhere.
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('bite-buddy')))
    for (const key of ['bite-buddy-mealplan-v2', 'bite-buddy-user-v2', 'bite-buddy-body',
                       'bite-buddy-activity', 'bite-buddy-cook']) {
      expect(keys, `${key} was never written`).toContain(key)
    }
  })

  test('a recipe of your own is still yours after a reload', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /New recipe/ }).click()
    await page.getByLabel('Recipe name').fill('Reload test omelette')
    await page.getByRole('button', { name: /Add ingredient/ }).click()
    await page.getByPlaceholder(/Anything: yours/).fill('lentil')
    await page.locator('button').filter({ hasText: /kcal \/ 100 g/ }).first().click()
    await page.getByRole('button', { name: 'Add recipe' }).click()

    await page.reload()
    await page.waitForLoadState('networkidle')
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Yours/ }).click()
    await expect(page.getByText('Reload test omelette')).toBeVisible()
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

test.describe('a week worth having again', () => {
  test('says there is nothing to save before you have planned anything', async ({ page }) => {
    await goto(page, '/plan')
    await page.getByRole('button', { name: 'Saved weeks' }).click()

    await expect(page.getByText('Nothing on this week to save yet.')).toBeVisible()
    await expect(page.getByText('Nothing saved yet.')).toBeVisible()
  })

  test('keeps a planned week and writes it onto another one', async ({ page }) => {
    await planAheadOfToday(page)

    // A week with something on it, courtesy of the assistant.
    await page.getByRole('button', { name: 'Fill the gaps' }).click()
    await page.getByRole('button', { name: /^Add these/ }).click()
    await expect(page.locator('[data-entry-name]').first()).toBeVisible()

    await page.getByRole('button', { name: 'Saved weeks' }).click()
    await page.getByLabel('Name this week').fill('Our usual')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText(/meals across .* days/)).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()

    // A different week, with nothing on it.
    await page.getByRole('button', { name: 'Next week' }).click()
    await expect(page.locator('[data-entry-name]')).toHaveCount(0)

    await page.getByRole('button', { name: 'Saved weeks' }).click()
    await page.getByRole('button', { name: 'Use it' }).click()
    // Nothing on this week, so it does not threaten to replace anything.
    await page.getByRole('button', { name: 'Write the week' }).click()

    // Asserted across the week rather than on the day that happens to be
    // selected. Fill the gaps only proposes days still ahead, so which days
    // carry food depends on what day of the week the suite is run.
    const filled = page.locator('button[aria-pressed]').filter({ hasText: /\d{2,}/ })
    await expect(filled.first()).toBeVisible()
  })

  test('counts what it would overwrite, and writes nothing until you agree', async ({ page }) => {
    await goto(page, '/plan')
    await page.getByRole('button', { name: 'Fill the gaps' }).click()
    await page.getByRole('button', { name: /^Add these/ }).click()
    await expect(page.locator('[data-entry-name]').first()).toBeVisible()

    await page.getByRole('button', { name: 'Saved weeks' }).click()
    await page.getByLabel('Name this week').fill('Our usual')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    // Still on the same week, which is full. It has to say so.
    await page.getByRole('button', { name: 'Use it' }).click()
    await expect(page.getByText(/replaces the whole week, including \d+ meals? already on it/))
      .toBeVisible()

    // Backing out leaves the week exactly as it was.
    const before = await page.locator('[data-entry-name]').count()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Close' }).click()
    expect(await page.locator('[data-entry-name]').count()).toBe(before)
  })

  test('a week can be forgotten', async ({ page }) => {
    await goto(page, '/plan')
    await page.getByRole('button', { name: 'Fill the gaps' }).click()
    await page.getByRole('button', { name: /^Add these/ }).click()
    await expect(page.locator('[data-entry-name]').first()).toBeVisible()

    await page.getByRole('button', { name: 'Saved weeks' }).click()
    await page.getByLabel('Name this week').fill('Our usual')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await page.getByRole('button', { name: 'Forget Our usual' }).click()
    await expect(page.getByText('Nothing saved yet.')).toBeVisible()
  })
})

test.describe('the app when there is no signal', () => {
  /**
   * The service worker is hand written now, because a generated one has
   * nowhere to put a push handler. That makes this the test that matters: the
   * caching it used to generate is transcribed by hand, and a mistake in the
   * transcription is invisible until somebody is standing in a shop with no
   * bars wondering where their shopping list went.
   */
  test('opens with the network cut off, once it has been seen once', async ({ page, context }) => {
    await page.goto('#/grocery')
    await page.waitForLoadState('networkidle')

    // Wait for the worker to actually be in charge, rather than merely present.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
      // A worker that is ready still may not control this page on first load.
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
        })
      }
    })

    await context.setOffline(true)
    await page.reload()

    await expect(page.locator('h1').first()).toBeVisible()
    // Whichever navigation this viewport uses: the sidebar on a laptop, the
    // bottom bar on a phone. The other one is in the page and hidden.
    await expect(page.locator('nav:visible').first()).toBeVisible()

    await context.setOffline(false)
  })

  test('knows how to be told something while it is closed', async ({ page }) => {
    await page.goto('#/')
    await page.waitForLoadState('networkidle')

    // The registration is what carries the push handler onto the device. If
    // this is absent, notifications cannot arrive however well the server
    // sends them.
    const ready = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return {
        active: Boolean(registration.active),
        canSubscribe: 'pushManager' in registration,
      }
    })

    expect(ready.active).toBe(true)
    expect(ready.canSubscribe).toBe(true)
  })
})

test.describe('the week you are actually in', () => {
  /** Today, as the app writes it: local calendar, not UTC. */
  function todayIso(): string {
    const now = new Date()
    now.setHours(12, 0, 0, 0)
    return now.toISOString().slice(0, 10)
  }

  function longDate(iso: string): string {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  }

  /**
   * The whole app used to agree on the wrong week.
   *
   * The planner's window was persisted and only ever advanced by the Today
   * button, so a fortnight after planning, Home counted the old week, Progress
   * charted it and the shopping list offered its days, while the week you were
   * standing in sat empty and unmentioned. This walks the window back and
   * reloads, which is what a person does every time they open the app.
   */
  test('a window left in the past does not survive a reload', async ({ page }) => {
    await goto(page, '/plan')
    await expect(page.getByRole('button', { name: longDate(todayIso()) })).toBeVisible()

    for (let i = 0; i < 3; i += 1) {
      await page.getByRole('button', { name: 'Previous week' }).click()
    }
    await expect(page.getByRole('button', { name: longDate(todayIso()) })).toHaveCount(0)

    // A window is about right now, so it has no business in storage, in a
    // backup, or on its way to the other phone.
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('bite-buddy-mealplan-v2')
      return raw ? JSON.parse(raw).state?.weekDates ?? null : null
    })
    expect(stored, 'the window was written to storage').toBeNull()

    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: longDate(todayIso()) })).toBeVisible()
  })

  test('the shopping list offers the days you are about to live', async ({ page }) => {
    await goto(page, '/grocery')

    // The day picker is anchored on the planner's window. Anchored on a stale
    // one it offered a fortnight that had already been and gone, so the list
    // was built for food somebody ate a fortnight ago.
    await expect(page.getByRole('button', { name: longDate(todayIso()) })).toBeVisible()

    // And yesterday is not on offer at all. Nobody shops backwards.
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    await expect(page.getByRole('button', { name: longDate(yesterday) })).toHaveCount(0)
  })

  test('stepping the planner back leaves every other screen where it was', async ({ page }) => {
    await goto(page, '/plan')
    for (let i = 0; i < 2; i += 1) {
      await page.getByRole('button', { name: 'Previous week' }).click()
    }
    await expect(page.getByRole('button', { name: longDate(todayIso()) })).toHaveCount(0)

    // The planner's window used to be the app's only idea of "this week", so
    // looking back at what you ate a fortnight ago moved the shopping list
    // there too and left it there.
    await goto(page, '/grocery')
    await expect(page.getByRole('button', { name: longDate(todayIso()) })).toBeVisible()
  })

  test('one picker asks the same question everywhere', async ({ page }) => {
    // Four of these disagreed about everything: 42 days including ones long
    // gone, the current week, only days before today, and the next eight.
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()
    await goto(page, '/plan')
    await page.locator('button[aria-pressed]').filter({ hasText: /\d\d\d/ }).first().click()

    const days = () => page.locator('[data-when-day]').count()

    // Moving a meal.
    await page.getByRole('button', { name: 'Move or copy meal' }).first().click()
    const moving = await days()
    expect(moving, 'the picker offered nothing').toBeGreaterThan(20)
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Copying a whole day: the same window, and it now confirms rather than
    // acting on the first tap.
    await page.getByRole('button', { name: /^Copy day to/ }).click()
    expect(await days()).toBe(moving)
    await expect(page.getByRole('button', { name: 'Copy it there' })).toBeDisabled()
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('the plus button means today, wherever it is pressed', async ({ page }, testInfo) => {
    // The bar is the phone layout only; on a laptop there is no centre button.
    test.skip(testInfo.project.name !== 'mobile', 'the bottom bar is a phone thing')

    await goto(page, '/plan')
    await page.getByRole('button', { name: 'Previous week' }).click()

    // Leave the planner entirely, which is where this went wrong: the day came
    // from a screen that was no longer mounted.
    await goto(page, '/analytics')
    await page.getByRole('button', { name: 'Add a meal' }).click()

    await expect(page.getByRole('heading', { name: /^Add to / })).toBeVisible()
    await expect(page.getByRole('button', { name: longDate(todayIso()), exact: true }))
      .toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('what actually happened', () => {
  /**
   * The plan was the only record the app had.
   *
   * A ring on the home screen said "0 kcal of 1,400" and read like a tracker,
   * while nothing anywhere could say a meal had been eaten, skipped or halved.
   * For somebody on a target, that is the point of the app.
   */
  async function aPlannedDay(page: Page) {
    await goto(page, '/plan')
    await page.getByRole('button', { name: 'Fill the gaps' }).click()
    await page.getByRole('button', { name: /^Add these/ }).click()
    await expect(page.locator('[data-entry-name]').first()).toBeVisible()
  }

  test('a meal can be ticked off, and untidied again', async ({ page }) => {
    await aPlannedDay(page)

    const tick = page.getByRole('button', { name: 'Mark as eaten' }).first()
    await tick.click()

    // Eaten. The same button now offers the other thing you might mean, and
    // the day counts how far through it is rather than picking one of two
    // words for four different situations.
    await expect(page.getByRole('button', { name: /^Eaten\./ }).first()).toBeVisible()
    await expect(page.getByText(/\d+ of \d+ eaten/)).toBeVisible()

    await page.getByRole('button', { name: /^Eaten\./ }).first().click()
    await expect(page.getByRole('button', { name: /^Skipped\./ }).first()).toBeVisible()

    // And round to nothing said, because people change their minds.
    await page.getByRole('button', { name: /^Skipped\./ }).first().click()
    await expect(page.getByRole('button', { name: 'Mark as eaten' }).first()).toBeVisible()
  })

  test('a meal nobody has spoken about stays in the day', async ({ page }) => {
    await aPlannedDay(page)

    // Before anything is said, the day is about the plan and says so.
    await expect(page.getByText('planned', { exact: true })).toBeVisible()
    const before = await page.locator('[data-day-kcal]').innerText()

    await page.getByRole('button', { name: 'Mark as eaten' }).first().click()

    // The badge moves on, and the total does not. Ticking breakfast used to
    // drop dinner, still hours away and untouched, out of the day.
    await expect(page.getByText(/\d+ of \d+ eaten/)).toBeVisible()
    await expect(page.getByText('planned', { exact: true })).toHaveCount(0)
    expect(await page.locator('[data-day-kcal]').innerText(), 'the total moved').toBe(before)
  })

  test('a skipped meal leaves the day, and the rest of it stays', async ({ page }) => {
    await aPlannedDay(page)
    const before = Number((await page.locator('[data-day-kcal]').innerText()).replace(/\D/g, ''))

    await page.getByRole('button', { name: 'Mark as eaten' }).first().click()
    await page.getByRole('button', { name: /^Eaten\./ }).first().click()

    const after = Number((await page.locator('[data-day-kcal]').innerText()).replace(/\D/g, ''))
    expect(after, 'skipping took nothing off').toBeLessThan(before)
    expect(after, 'skipping one meal emptied the day').toBeGreaterThan(0)
  })

  test('a skipped meal is dimmed rather than told off', async ({ page }) => {
    await aPlannedDay(page)

    await page.getByRole('button', { name: 'Mark as eaten' }).first().click()
    await page.getByRole('button', { name: /^Eaten\./ }).first().click()

    // Struck through and quieter. Nothing red, nothing scolding: not eating
    // what you planned is a Tuesday, not a failure.
    const struck = page.locator('[data-entry-name].line-through')
    await expect(struck.first()).toBeVisible()
  })

  test('how much of it there was can be changed after the fact', async ({ page }) => {
    await aPlannedDay(page)

    await page.getByRole('button', { name: /^Change how much/ }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const dialog = page.getByRole('dialog')
    const before = await dialog.innerText()
    await dialog.getByRole('button', { name: 'Less' }).click()
    const after = await dialog.innerText()
    expect(after, 'the amount did not move').not.toBe(before)

    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  /**
   * The commonest thing to record was the one thing there was no way to say.
   *
   * Adding a biscuit to the plan and then ticking it is two actions, and in
   * between them the day claims you are going to eat something you already
   * have. This is the one-tap version, from the screen you were already on.
   */
  test('something eaten that was never planned goes down in one go', async ({ page }) => {
    await goto(page, '/')
    await page.getByRole('button', { name: /^I ate something/ }).click()

    const sheet = page.getByRole('heading', { name: /^Ate this for / })
    await expect(sheet).toBeVisible()

    // The sheet says where this is going before you have chosen what, and the
    // clock's guess can be corrected there.
    await expect(page.getByText(/, today$/)).toBeVisible()
    await page.getByRole('button', { name: 'Change' }).click()
    await page.getByRole('button', { name: 'Snack 1', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Ate this for snack 1' })).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()

    await page.getByRole('button', { name: 'foods', exact: true }).click()
    await page.getByPlaceholder('What did you have?').fill('apple')
    await page.getByRole('button', { name: 'Ate it' }).first().click()

    // It lands on the planner already a record. Nothing to tick afterwards.
    await goto(page, '/plan')
    await expect(page.getByText('eaten', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /^Eaten\./ }).first()).toBeVisible()
  })

  test('a recipe can go into a day without leaving the recipe', async ({ page }) => {
    await goto(page, '/recipes')
    await page.locator('[data-recipe-card]').first().click()

    await page.getByRole('button', { name: 'Put it in a day' }).click()
    // Named, because the recipe sheet behind it is a dialog too now that every
    // one of them announces itself.
    const dialog = page.getByRole('dialog', { name: /^Put .* in a day$/ })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Put it in', exact: true }).click()

    await goto(page, '/plan')
    await expect(page.locator('[data-entry-name]').first()).toBeVisible()
  })
})

test.describe('a list you can take to a shop', () => {
  test('the box for typing a line is above the list, not under it', async ({ page }) => {
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()
    await goto(page, '/grocery')
    await page.getByRole('button', { name: /Build list/ }).click()

    const box = page.getByLabel('Add an item')
    await expect(box).toBeVisible()

    // Under a categorised list of forty lines this was off the bottom of the
    // screen, and a walkthrough reported the feature as missing entirely.
    const adder = await box.boundingBox()
    const firstRow = await page.locator('.card input[type="checkbox"]').first().boundingBox()
    expect(adder!.y, 'the adder is below the list again').toBeLessThan(firstRow!.y)
  })

  test('a typed line joins the list', async ({ page }) => {
    await goto(page, '/grocery')
    await page.getByLabel('Add an item').fill('Washing-up liquid')
    await page.getByLabel('Add an item').press('Enter')

    await expect(page.getByText('Washing-up liquid')).toBeVisible()
  })

  test('the list can leave the app', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await goto(page, '/grocery')
    await page.getByLabel('Add an item').fill('Washing-up liquid')
    await page.getByLabel('Add an item').press('Enter')
    await expect(page.getByText('Washing-up liquid')).toBeVisible()

    await page.getByRole('button', { name: 'Share' }).click()
    await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()

    const text = await page.evaluate(() => navigator.clipboard.readText())
    expect(text).toContain('Washing-up liquid')
  })
})

test.describe('a batch that lands in the week', () => {
  /**
   * Cooking four portions is the reason to have a cook schedule at all, and
   * until now everything went into the fridge and you planned it back out one
   * slot at a time from the picker. The batch and the week were two screens
   * that knew nothing about each other.
   */
  test('the portions go into the days ahead, not just the fridge', async ({ page }) => {
    await goto(page, '/schedule')
    await page.getByRole('button', { name: 'Session' }).click()
    await page.getByPlaceholder('Search your recipes').fill('soup')
    await page.locator('label').filter({ hasText: /soup/i }).first().click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await page.getByRole('button', { name: 'Mark as done' }).first().click()
    await expect(page.getByText('What came out?')).toBeVisible()

    // Off until asked for, like everything else here that writes to the week.
    const spread = page.getByLabel('Put them in the days ahead')
    await expect(spread).not.toBeChecked()
    await spread.check()

    // Ticking it opens the choice of days and which meal, and says what would
    // actually land rather than leaving it as a promise with no number.
    await expect(page.getByText(/portions? go into \d+ of those days|Nothing would land/))
      .toBeVisible()

    // Lunch instead of dinner, and only two of the days on offer.
    await page.getByRole('button', { name: 'lunch', exact: true }).click()
    const dayChips = page.locator('.card-soft button[aria-pressed]')
    const spare = await dayChips.count()
    for (let i = 2; i < spare; i += 1) await dayChips.nth(i).click()

    await page.getByRole('button', { name: 'Into the fridge' }).click()

    await goto(page, '/plan')
    // Somewhere in the week ahead there is now a meal from the fridge.
    const week = page.locator('button[aria-pressed]').filter({ hasText: /\d{2,}/ })
    await expect(week.first()).toBeVisible()
  })

  test('it can be turned off, and then nothing is planned', async ({ page }) => {
    await goto(page, '/schedule')
    await page.getByRole('button', { name: 'Session' }).click()
    await page.getByPlaceholder('Search your recipes').fill('soup')
    await page.locator('label').filter({ hasText: /soup/i }).first().click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await page.getByRole('button', { name: 'Mark as done' }).first().click()
    await expect(page.getByLabel('Put them in the days ahead')).not.toBeChecked()
    await page.getByRole('button', { name: 'Into the fridge' }).click()

    // The portions still exist, they are simply nobody's dinner yet.
    await expect(page.getByText('In the fridge')).toBeVisible()
    await goto(page, '/plan')
    await expect(page.locator('[data-entry-name]')).toHaveCount(0)
  })
})

/**
 * One step back, for a short while.
 *
 * Deleting a meal had neither a confirmation nor a way back, on a screen where
 * the bin sits a thumb's width from the tick that says you ate it.
 */
test.describe('taking it back', () => {
  async function aPlannedDay(page: Page) {
    await goto(page, '/plan')
    await page.getByRole('button', { name: 'Fill the gaps' }).click()
    await page.getByRole('button', { name: /^Add these/ }).click()
    await expect(page.locator('[data-entry-name]').first()).toBeVisible()
  }

  test('a removed meal can be put back, with its name in the offer', async ({ page }) => {
    await aPlannedDay(page)
    const before = await page.locator('[data-entry-name]').count()
    const name = await page.locator('[data-entry-name]').first().innerText()

    await page.getByRole('button', { name: 'Remove meal' }).first().click()
    await expect(page.locator('[data-entry-name]')).toHaveCount(before - 1)

    // Named, so it can be checked against what was meant. "Item deleted" tells
    // you nothing you did not just watch happen.
    const bar = page.getByRole('status').filter({ hasText: 'Removed' })
    await expect(bar).toContainText(name.split('\n')[0].trim().slice(0, 12))

    await bar.getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('[data-entry-name]')).toHaveCount(before)
  })

  test('a cleared day comes back whole', async ({ page }) => {
    await aPlannedDay(page)
    const before = await page.locator('[data-entry-name]').count()

    await page.getByRole('button', { name: 'Clear day' }).click()
    await page.getByRole('button', { name: /^Clear \d+ meals?$/ }).click()
    await expect(page.locator('[data-entry-name]')).toHaveCount(0)

    await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
    await expect(page.locator('[data-entry-name]')).toHaveCount(before)
  })

  test('an emptied shopping list comes back, typed lines included', async ({ page }) => {
    await goto(page, '/grocery')
    await page.getByLabel('Add an item').fill('Washing-up liquid')
    await page.getByLabel('Add an item').press('Enter')
    await expect(page.getByText('Washing-up liquid')).toBeVisible()

    await page.getByRole('button', { name: 'Empty list' }).click()

    // A typed line cannot be rebuilt from the plan, so it is counted out
    // separately rather than folded into a total that reads as recoverable.
    await expect(page.getByText(/lines? you typed/)).toBeVisible()

    await page.getByRole('button', { name: /^Throw away \d+ lines?$/ }).click()
    await expect(page.getByText('Washing-up liquid')).toHaveCount(0)

    await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByText('Washing-up liquid')).toBeVisible()
  })

  test('the offer stays on the screen it belongs to', async ({ page }) => {
    await aPlannedDay(page)
    await page.getByRole('button', { name: 'Remove meal' }).first().click()
    await expect(page.getByRole('status').filter({ hasText: 'Removed' })).toBeVisible()

    // It used to travel, and on Settings it sat over the restore confirmation,
    // which is the one card on that screen that has to be read before it is
    // answered.
    await goto(page, '/settings')
    await expect(page.getByRole('status').filter({ hasText: 'Removed' })).toHaveCount(0)
  })

  test('one line off the list comes back where it was', async ({ page }) => {
    await goto(page, '/grocery')
    await page.getByLabel('Add an item').fill('Bicarbonate of soda')
    await page.getByLabel('Add an item').press('Enter')

    // The bin lives inside the row's edit mode, which the name opens.
    await page.getByRole('button', { name: 'Bicarbonate of soda', exact: true }).click()
    await page.getByRole('button', { name: 'Remove Bicarbonate of soda' }).click()

    // The row, not the text: the undo bar names the line too, which is rather
    // the point of it.
    const row = page.getByRole('button', { name: 'Bicarbonate of soda', exact: true })
    await expect(row).toHaveCount(0)

    await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
    await expect(row).toBeVisible()
  })
})

/**
 * A restore replaces everything, which makes it the largest thing this app can
 * do and the one place a confirmation is worth the interruption.
 */
test.describe('bringing a backup back', () => {
  test('says what it is about to replace, and does nothing until told', async ({ page }) => {
    await goto(page, '/settings')
    await page.getByRole('button', { name: 'Paste a backup' }).click()

    // Written out here rather than exported from the running app: the panel's
    // own copy path needs clipboard permissions, and a backup of an app that
    // has not been touched yet is empty anyway.
    await page.getByPlaceholder(/Paste the contents of a backup/).fill(JSON.stringify({
      app: 'bite-buddy',
      schema: 3,
      exportedAt: '2026-08-01T10:00:00.000Z',
      stores: {
        'bite-buddy-user-v2': { profile: { name: 'From the backup' } },
        'bite-buddy-body': { weightEntries: [] },
      },
    }))
    await page.getByRole('button', { name: 'Read it' }).click()

    // Named in words, not counted in sections, and dated from the file.
    await expect(page.getByText(/from a backup saved on 1 August 2026/)).toBeVisible()
    await expect(page.getByText('your profile and targets')).toBeVisible()
    await expect(page.getByText('your weights and measurements')).toBeVisible()

    // Reading it is not doing it.
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText(/This will replace/)).toHaveCount(0)
  })

  test('refuses a file that is the wrong shape, and changes nothing', async ({ page }) => {
    await goto(page, '/settings')
    await page.getByRole('button', { name: 'Paste a backup' }).click()

    await page.getByPlaceholder(/Paste the contents of a backup/).fill(JSON.stringify({
      app: 'bite-buddy',
      schema: 3,
      exportedAt: '2026-08-01T10:00:00.000Z',
      stores: { 'bite-buddy-body': { weightEntries: 'not a list at all' } },
    }))
    await page.getByRole('button', { name: 'Read it' }).click()

    await expect(page.getByText(/nothing has been changed/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Replace it all' })).toHaveCount(0)
  })
})

test.describe('the small sharp edges', () => {
  test('a dialog can be escaped, and gives focus back', async ({ page }) => {
    // Clicking the backdrop always worked, which hid the gap: on a phone that
    // is the only way most people would close one, so nothing looked broken.
    await goto(page, '/plan')

    const opener = page.getByRole('button', { name: 'Saved weeks' })
    await opener.click()
    await expect(page.getByRole('dialog', { name: 'Saved weeks' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Saved weeks' })).toHaveCount(0)

    // And focus is back where it came from, rather than on the page body.
    await expect(opener).toBeFocused()
  })

  test('a filter that cannot answer says why, and where to fix it', async ({ page }) => {
    // The chip sat at half opacity with the reason hidden until you tapped it,
    // and the fix was a sentence naming a screen you then had to find: the
    // Cupboard is behind More, then Grocery, then a tab.
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /From the cupboard/ }).click()

    await expect(page.getByText(/Nothing in the cupboard yet/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open the cupboard' })).toBeVisible()
  })

  test('a search that finds nothing offers a way out', async ({ page }) => {
    // "No recipes match zzqq" was the whole answer: no way to write the thing
    // you were looking for, and no hint that Foods is a separate library.
    await goto(page, '/recipes')
    await page.getByPlaceholder(/Search in English/).fill('zzqq')

    await expect(page.getByText(/Nothing here matches/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Write it' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Look in Foods' })).toBeVisible()
  })

  test('the tab is named after the screen', async ({ page }) => {
    await goto(page, '/plan')
    await expect(page).toHaveTitle(/^Planner · Bite Buddy$/)

    await goto(page, '/grocery')
    await expect(page).toHaveTitle(/^Shopping · Bite Buddy$/)

    // Every route used to be "Bite Buddy", so two tabs of this app were
    // indistinguishable and so was a month of history.
    await goto(page, '/settings/history')
    await expect(page).toHaveTitle(/^Plan history · Bite Buddy$/)
  })

  test('clearing a day asks first, and says how much it would throw away', async ({ page }) => {
    await goto(page, '/plan')
    await page.getByRole('button', { name: 'Fill the gaps' }).click()
    await page.getByRole('button', { name: /^Add these/ }).click()
    await expect(page.locator('[data-entry-name]').first()).toBeVisible()

    await page.getByRole('button', { name: 'Clear day' }).click()
    const confirm = page.getByRole('button', { name: /^Clear \d+ meals?$/ })
    await expect(confirm).toBeVisible()

    // Backing out leaves the day exactly as it was.
    await page.getByRole('button', { name: 'Keep them' }).click()
    await expect(page.locator('[data-entry-name]').first()).toBeVisible()

    await page.getByRole('button', { name: 'Clear day' }).click()
    await page.getByRole('button', { name: /^Clear \d+ meals?$/ }).click()
    await expect(page.locator('[data-entry-name]')).toHaveCount(0)
  })

  test('emptying the shopping list asks first', async ({ page }) => {
    await goto(page, '/grocery')
    await page.getByLabel('Add an item').fill('Washing-up liquid')
    await page.getByLabel('Add an item').press('Enter')

    await page.getByRole('button', { name: 'Empty list' }).click()
    await expect(page.getByRole('button', { name: /^Throw away \d+ lines?$/ })).toBeVisible()

    await page.getByRole('button', { name: 'Keep them' }).click()
    await expect(page.getByText('Washing-up liquid')).toBeVisible()
  })

  test('signed out, the backup panel does not promise an account it lacks', async ({ page }) => {
    await goto(page, '/settings')
    // These tests never sign in, so the honest sentence is the local one.
    await expect(page.getByText(/lives in this browser and nowhere else/)).toBeVisible()
    await expect(page.getByText(/Signed in as/)).toHaveCount(0)
  })

  test('a weight can be given somewhere to head', async ({ page }) => {
    await goto(page, '/analytics')
    await page.getByRole('tab', { name: 'Body' }).click()

    await page.getByLabel('Weight', { exact: true }).fill('72')
    // Two Log buttons on this screen: weight and measurements. The first one
    // sits under the weight field.
    await page.getByRole('button', { name: 'Log' }).first().click()

    await page.getByLabel('Aiming for').fill('68')
    await expect(page.getByText(/to go\.|below your goal\.|At your goal\./)).toBeVisible()
  })
})

test.describe('the dietician, in English', () => {
  test('the archive says what a line means, and keeps what it said', async ({ page }) => {
    await goto(page, '/settings/history')

    // Opened, because nothing is expanded to begin with. It used to unfold one
    // week of June 2022 on every visit, and not even the top row: the first of
    // the fourteen in import order, while the list is sorted newest first.
    await page.getByRole('button', { name: /Show|Open|week/i }).first().click()

    // Both, because the original is the record: a plan you cannot check
    // against what was actually prescribed is one you have to take on faith.
    await expect(page.getByText(/half a plate of vegetables|raw vegetable salad|wholemeal bread/i).first())
      .toBeVisible()
    await expect(page.getByText(/paine int|salata de cruditati|legume/i).first()).toBeVisible()
  })

  test('a food keeps its own foreign names, which are the point of them', async ({ page }) => {
    await goto(page, '/foods')
    await page.getByPlaceholder(/Search/).first().fill('asparagus')

    // Translating these would turn "sparanghel · spárga" into
    // "asparagus · asparagus", which is the opposite of why they are shown.
    await expect(page.getByText('sparanghel · spárga', { exact: false })).toBeVisible()
  })
})

test.describe('after dark', () => {
  /** The page ground, as the browser has actually painted it. */
  const ground = (page: Page) =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor)

  test('follows the device when nobody has said otherwise', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await goto(page, '/')

    // No attribute for the device default: following the device is a media
    // query, and an attribute would sit above it in the cascade matching
    // nothing at all.
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./)

    // Dark by the only test that matters, which is what was painted. The
    // ground is a warm near-black, so every channel is low and none is zero.
    const painted = await ground(page)
    const [r, g, b] = painted.match(/\d+/g)!.map(Number)
    expect(Math.max(r, g, b)).toBeLessThan(60)
  })

  test('takes light over a device set to dark, when you ask it to', async ({ page }) => {
    // The preference this exists for: a phone on dark and a person who wants
    // this one app light. Following the device blindly makes that unsayable.
    await page.emulateMedia({ colorScheme: 'dark' })
    await goto(page, '/settings')

    await page.getByLabel('Appearance').selectOption('light')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    const painted = await ground(page)
    expect(Math.min(...painted.match(/\d+/g)!.map(Number))).toBeGreaterThan(220)
  })

  test('remembers it, and gets there before the first paint', async ({ page }) => {
    await goto(page, '/settings')
    await page.getByLabel('Appearance').selectOption('dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    // Reloaded, the attribute is on the document from the start rather than
    // after React's first effect, which would be a frame of cream on every
    // launch for somebody who chose dark.
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(Math.max(...(await ground(page)).match(/\d+/g)!.map(Number))).toBeLessThan(60)
  })

  test('paints the strip above the page to match', async ({ page }) => {
    await goto(page, '/settings')
    await page.getByLabel('Appearance').selectOption('dark')

    // The one piece of a phone screen a stylesheet cannot reach. Left alone it
    // stayed brand purple around a dark app.
    await expect(page.locator('meta[name="theme-color"]'))
      .toHaveAttribute('content', '#17130f')
  })
})

test.describe('cooking three and eating one', () => {
  test('scaling a recipe does not book the whole pot against a day', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Dinner/ }).click()
    await page.locator('[data-recipe-card]').first().click()

    // Cook three. The sheet has always called this "how many you are cooking",
    // and it used to be handed to the planner as how many you were eating, so
    // one lunch was booked at three times its per-serving figures.
    const more = page.getByRole('button', { name: 'One serving more' })
    await more.click()
    await more.click()
    await expect(page.getByText(/3 servings/)).toBeVisible()

    await page.getByRole('button', { name: /Put it in a day/i }).first().click()

    // The dialog asks its own question, and starts where the honest answer is.
    const eating = page.getByLabel('How much are you eating')
    await expect(eating).toHaveValue('1')
    await expect(page.getByText(/You scaled this to 3/)).toBeVisible()
  })
})
