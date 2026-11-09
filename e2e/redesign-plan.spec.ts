import { test, expect, type Page } from '@playwright/test'

/**
 * The Plan section as redesigned: the title and tabs inside each screen's
 * header, the week as a list on a phone and a grid on a laptop, a day as its
 * own screen or a panel beside the week, the shopping list by aisle with a
 * basket, and cook sessions that say plainly when they are done.
 */

async function goto(page: Page, route: string) {
  await page.goto(`#${route}`)
  await page.waitForLoadState('networkidle')
}

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

/** A week of the dietician's food, planned into next week so every day is ahead. */
async function aPlannedWeek(page: Page) {
  await goto(page, '/plan/week')
  await page.getByRole('button', { name: 'Next week' }).click()
  await goto(page, '/settings/history')
  await page.getByRole('button', { name: /^Load$/ }).first().click()
  await expect(page.getByRole('button', { name: /Loaded/ })).toBeVisible()
  // The window stays where it was put, on next week.
  await goto(page, '/plan/week')
}

async function openFirstPlannedDay(page: Page) {
  await page.locator('[data-day-row][data-has-food]').first()
    .getByRole('button', { name: /^Open / }).click()
}

test.describe('the Plan header', () => {
  test('carries the title, the three tabs and the week', async ({ page }) => {
    await goto(page, '/plan/week')
    await expect(page.getByRole('heading', { level: 1, name: 'Plan' })).toBeVisible()

    const tabs = page.getByRole('navigation', { name: 'Plan views' })
    await expect(tabs.getByRole('link')).toHaveCount(3)
    await expect(tabs.getByRole('link', { name: 'Week' })).toHaveAttribute('aria-current', 'page')

    // The week, as short as it can be said.
    await expect(page.getByText(/^\d{1,2} (\w+ )?to \d{1,2} \w+$/).filter({ visible: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Previous week' })).toBeVisible()
  })

  test('the Grocery tab counts what is left to buy', async ({ page }) => {
    await goto(page, '/plan/grocery')
    await page.getByLabel('Add an item').fill('Lemons')
    await page.getByLabel('Add an item').press('Enter')

    const tabs = page.getByRole('navigation', { name: 'Plan views' })
    await expect(tabs.getByRole('link', { name: 'Grocery · 1' })).toHaveAttribute('aria-current', 'page')

    await page.getByRole('checkbox', { name: 'Lemons' }).check()
    await expect(tabs.getByRole('link', { name: 'Grocery', exact: true })).toBeVisible()
  })
})

test.describe('the week', () => {
  test('offers to fill its gaps, and says how many there are', async ({ page }) => {
    await goto(page, '/plan/week')
    await page.getByRole('button', { name: 'Next week' }).click()
    // An empty week ahead: seven days of four slots.
    await expect(page.getByRole('button', { name: 'Fill the gaps · 28 meals' })).toBeVisible()
  })

  test('on a phone, is a list of days with a shape and a total each', async ({ page }) => {
    test.skip(!isPhone(page), 'the list is the phone layout')
    await aPlannedWeek(page)

    const rows = page.getByRole('list', { name: 'Days' }).locator('[data-day-row]')
    await expect(rows).toHaveCount(7)
    const first = page.locator('[data-day-row][data-has-food]').first()
    // A pill a slot, filled where something is planned.
    await expect(first.locator('[data-planned]').first()).toBeAttached()
    await expect(first.getByRole('button', { name: /^Open .*kcal/ })).toBeVisible()
  })

  test('on a laptop, is a column a day and a row a slot', async ({ page }) => {
    test.skip(isPhone(page), 'the grid is the wide layout')
    await aPlannedWeek(page)

    const grid = page.getByRole('region', { name: /^Week of / })
    await expect(grid.locator('[data-day-row]')).toHaveCount(7)
    for (const slot of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) {
      await expect(grid.getByText(slot, { exact: true })).toBeVisible()
    }
    // A meal opens over the week; an empty cell goes straight to the picker.
    await expect(grid.getByRole('button', { name: /^Breakfast on .+: / }).first()).toBeVisible()
  })
})

test.describe('a day', () => {
  test('on a phone, is its own screen with a way back', async ({ page }) => {
    test.skip(!isPhone(page), 'the phone layout')
    await aPlannedWeek(page)
    await openFirstPlannedDay(page)

    await expect(page.getByRole('region', { name: 'Day totals' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Plan views' })).toHaveCount(0)
    for (const slot of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) {
      await expect(page.getByRole('region', { name: slot })).toBeVisible()
    }

    await page.getByRole('button', { name: 'Back to the week' }).click()
    await expect(page.locator('[data-day-row]')).toHaveCount(7)
  })

  test('on a laptop, opens beside the week, which waits behind it', async ({ page }) => {
    test.skip(isPhone(page), 'the wide layout')
    await aPlannedWeek(page)
    await openFirstPlannedDay(page)

    const panel = page.getByRole('region', { name: /^\w+day \d+ \w+$/ })
    await expect(panel).toBeVisible()
    await expect(panel.getByRole('region', { name: 'Day totals' })).toBeVisible()
    // The week behind is out of reach while the day is open.
    await expect(page.getByRole('button', { name: /^Fill the gaps · / })).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Fill the gaps/ })).toBeVisible()
  })

  test('puts a line\'s move, skip and remove behind one button on a phone', async ({ page }) => {
    test.skip(!isPhone(page), 'inline on a wide screen')
    await aPlannedWeek(page)
    await openFirstPlannedDay(page)

    const more = page.getByRole('button', { name: /^Actions for / }).first()
    await expect(more).toHaveAttribute('aria-expanded', 'false')
    await more.click()
    const group = page.getByRole('group', { name: /^What to do with / })
    await expect(group.getByRole('button')).toHaveCount(3)

    await group.getByRole('button', { name: /^Skip / }).click()
    await expect(page.locator('[data-entry-name].line-through').first()).toBeVisible()
  })

  test('says how it stands against the target', async ({ page }) => {
    await aPlannedWeek(page)
    await openFirstPlannedDay(page)

    const totals = page.getByRole('region', { name: 'Day totals' })
    await expect(totals.getByText(/^[\d,]+ of [\d,]+ kcal$/)).toBeVisible()
    await expect(totals.getByText(/^\d of 4 meals planned$/)).toBeVisible()
    await expect(totals.getByRole('progressbar')).toBeVisible()
  })
})

test.describe('the shopping list', () => {
  test('sorts by aisle, and a phone drops what is picked up into the basket', async ({ page }) => {
    await aPlannedWeek(page)
    await goto(page, '/plan/grocery')
    await page.getByRole('button', { name: 'Build list' }).click()
    await expect(page.getByText(/^0 of \d+ picked up/)).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Picked up' })).toBeVisible()

    const first = page.getByRole('checkbox').first()
    const name = (await first.getAttribute('aria-label')) ?? ''
    await page.getByRole('checkbox', { name, exact: true }).check()
    await expect(page.getByText(/^1 of \d+ picked up/)).toBeVisible()

    if (isPhone(page)) {
      const basket = page.getByRole('region', { name: 'In the basket' })
      await expect(basket.getByRole('checkbox', { name, exact: true })).toBeChecked()
    } else {
      // A wide screen keeps the line in its aisle, and says so.
      await expect(page.getByText(/^Picked up/).first()).toBeVisible()
      await expect(page.getByRole('region', { name: 'In the basket' })).toHaveCount(0)
    }
  })

  test('says which recipe wanted a line', async ({ page }) => {
    await aPlannedWeek(page)
    await goto(page, '/plan/grocery')
    await page.getByRole('button', { name: 'Build list' }).click()
    await expect(page.getByText(/^(For |From \d+ recipes)/).first()).toBeVisible()
  })
})

test.describe('cooking', () => {
  async function aSession(page: Page, label: string, date: string) {
    await page.getByRole('button', { name: 'New cook session' }).click()
    await page.getByPlaceholder('Sunday batch cook').fill(label)
    await page.locator('input[type=date]').fill(date)
    await page.getByRole('button', { name: 'Save', exact: true }).click()
  }

  test('a done session says so in a word and a tick, not by fading', async ({ page }) => {
    await goto(page, '/plan/cooking')
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    await aSession(page, 'Soup for the week', tomorrow)
    await aSession(page, 'Weekend bake', new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10))

    // The sooner of the two is next.
    const soup = page.getByRole('listitem').filter({ hasText: 'Soup for the week' })
    await expect(soup.getByText('Up next')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'Weekend bake' }).getByText('Planned')).toBeVisible()

    await page.getByRole('button', { name: 'Mark as done: Soup for the week' }).click()
    await expect(page.getByRole('button', { name: 'Mark as not done: Soup for the week' }))
      .toHaveAttribute('aria-pressed', 'true')
    await expect(soup.getByText('Done', { exact: true })).toBeVisible()
    // And the other one is next now.
    await expect(page.getByRole('listitem').filter({ hasText: 'Weekend bake' }).getByText('Up next')).toBeVisible()

    const faded = await soup.evaluate((el) => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        if (Number(getComputedStyle(n).opacity) < 1) return true
      }
      return false
    })
    expect(faded, 'a done session was faded, which takes its text under the contrast floor').toBe(false)
  })

  test('the new session button is in reach on every screen size', async ({ page }) => {
    await goto(page, '/plan/cooking')
    await expect(page.getByRole('button', { name: 'New cook session' })).toBeVisible()
    await expect(page.getByText('Nothing cooked and waiting')).toBeVisible()
  })
})
