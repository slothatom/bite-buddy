import { test, expect, type Page } from '@playwright/test'

/**
 * Today, as redesigned: the day so far, what is next, the meals with a tick
 * each, what is waiting, the week, and the add sheet the + opens.
 */

async function goto(page: Page, route: string) {
  await page.goto(`#${route}`)
  await page.waitForLoadState('networkidle')
}

/** Today with the planner's own suggestions on it, so there are meals to tick. */
async function aPlannedToday(page: Page) {
  await goto(page, '/plan/week')
  await page.getByRole('tab', { name: 'Day' }).click()
  await page.getByRole('button', { name: 'Fill the gaps' }).click()
  await page.getByRole('button', { name: /^Add these/ }).click()
  await expect(page.locator('[data-entry-name]').first()).toBeVisible()
  await goto(page, '/')
}

/** The household cache a signed-in phone would have. See smoke.spec.ts. */
async function aHouseholdOfTwo(page: Page) {
  await page.addInitScript(() => {
    const member = (userId: string, personKey: string, displayName: string, createdAt: string) =>
      ({ userId, personKey, displayName, role: 'admin', email: null, createdAt })
    localStorage.setItem('bite-buddy-household', JSON.stringify({
      version: 1,
      state: {
        userId: 'u1',
        household: { id: 'h1', name: 'Home' },
        members: [member('u1', 'arany', 'Arany', '1'), member('u2', 'oli', 'Oli', '2')],
        invites: [],
      },
    }))
  })
}

test.describe('Today', () => {
  test('says the date, the day so far and the week, with nothing planned', async ({ page }) => {
    await goto(page, '/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      new Date().toLocaleDateString('en-GB', { weekday: 'long' }))
    const day = page.getByRole('region', { name: 'Day so far' })
    await expect(day).toContainText(/kcal/)
    await expect(page.getByText('Nothing planned for today yet.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Next up' })).toHaveCount(0)

    // The week you are in, a column a day.
    const week = page.locator('section').filter({ has: page.getByRole('heading', { name: 'This week at a glance' }) })
    await expect(week.getByRole('listitem')).toHaveCount(7)
    await expect(week.getByText('goals reached')).toBeVisible()
    await expect(week.getByText('days planned')).toBeVisible()
  })

  test('next up can be marked eaten, and put back', async ({ page }) => {
    await aPlannedToday(page)
    const next = page.getByRole('region', { name: 'Next up' })
    await expect(next).toBeVisible()
    const meal = (await next.locator('p').nth(1).innerText()).trim()

    await next.getByRole('button', { name: 'Mark eaten' }).click()

    // The row says so, and the day's figure is no longer nought.
    const meals = page.locator('section').filter({ has: page.getByRole('heading', { name: "Today's meals" }) })
    const row = meals.getByRole('listitem').filter({ hasText: meal }).first()
    await expect(row).toContainText('eaten')
    await expect(page.getByRole('region', { name: 'Day so far' })).not.toContainText(/^0 of/)

    // And the undo bar offers it back.
    await page.getByRole('button', { name: /^Undo$/ }).last().click()
    await expect(row).not.toContainText(/· eaten/)
  })

  test('to do today links through to the screen that does it', async ({ page }) => {
    await goto(page, '/')
    const todo = page.locator('section').filter({ has: page.getByRole('heading', { name: 'To do today' }) })
    await todo.getByRole('link', { name: /Weight/ }).click()
    await expect(page).toHaveURL(/#\/progress$/)
  })

  test('the avatars choose whose day is shown', async ({ page }) => {
    await aHouseholdOfTwo(page)
    await goto(page, '/')
    const household = page.getByRole('list', { name: 'Household' })
    await household.getByRole('button', { name: 'Show Oli' }).click()
    await expect(household.getByRole('button', { name: 'Show Oli' })).toHaveAttribute('aria-pressed', 'true')
    await expect(household.getByRole('button', { name: 'Show Arany' })).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText('Showing: Oli')).toBeVisible()
  })

  test('fits the screen without scrolling sideways', async ({ page }) => {
    await aPlannedToday(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('puts the day beside the meals on a wide screen', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'two columns are a wide-screen thing')
    await page.setViewportSize({ width: 1440, height: 900 })
    await aPlannedToday(page)
    const day = await page.getByRole('region', { name: 'Day so far' }).boundingBox()
    const next = await page.getByRole('region', { name: 'Next up' }).boundingBox()
    expect(day && next && day.x > next.x + next.width).toBeTruthy()
    await expect(page.getByRole('heading', { name: 'Macros so far' })).toBeVisible()
  })
})

test.describe('the add sheet', () => {
  test('opens on today, with the meal to correct in one tap', async ({ page }, testInfo) => {
    await goto(page, '/')
    if (testInfo.project.name === 'mobile') {
      await page.getByRole('button', { name: 'Add to today' }).click()
    } else {
      await page.getByRole('button', { name: 'Add food' }).click()
    }
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('heading', { name: /^Add to / })).toBeVisible()

    const meals = sheet.getByRole('group', { name: 'Which meal' })
    await meals.getByRole('button', { name: 'Dinner' }).click()
    await expect(meals.getByRole('button', { name: 'Dinner' })).toHaveAttribute('aria-pressed', 'true')
    await expect(sheet.getByRole('heading', { name: 'Add to dinner' })).toBeVisible()

    // Plan or record, at the foot of the sheet.
    await sheet.getByRole('group', { name: 'Eaten yet' }).getByRole('button', { name: 'Already had it' }).click()
    await expect(sheet.getByRole('heading', { name: 'Had this for dinner' })).toBeVisible()
  })

  test('records something eaten from Today in one go', async ({ page }) => {
    await goto(page, '/')
    await page.getByRole('button', { name: /^I ate something/ }).click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('heading', { name: /^Had this for / })).toBeVisible()
    await sheet.getByRole('button', { name: 'foods', exact: true }).click()
    await sheet.getByPlaceholder('What did you have?').fill('apple')
    await sheet.getByRole('button', { name: 'Had it', exact: true }).first().click()

    const meals = page.locator('section').filter({ has: page.getByRole('heading', { name: "Today's meals" }) })
    await expect(meals.getByRole('listitem').first()).toContainText('eaten')
  })
})
