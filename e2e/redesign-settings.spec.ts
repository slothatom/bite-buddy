import { test, expect, type Page } from '@playwright/test'

/**
 * Settings, as redesigned: a list of pages on a phone, a list beside the page
 * on a desktop, each page at its own address under /settings.
 *
 * This build has no database, so there is no account: the household and the
 * reminders pages do not exist here, and the account page is the version.
 */

async function goto(page: Page, route: string) {
  await page.goto(`#${route}`)
  await page.waitForLoadState('networkidle')
}

const PAGES = [
  ['/settings/targets', 'Targets', 'Daily targets'],
  ['/settings/history', 'Plan history', 'Plans'],
  ['/settings/appearance', 'Appearance', 'How the app looks'],
  ['/settings/backups', 'Backups', 'Your data'],
  ['/settings/account', 'App version', 'This version'],
] as const

test.describe('settings on a phone', () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, 'the phone layout'))

  test('is a list of pages, each opened and left by its own arrow', async ({ page }) => {
    await goto(page, '/settings')
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
    // No bottom bar: the way out is the arrow.
    await expect(page.getByRole('link', { name: 'Back to Today' })).toBeVisible()

    for (const heading of ['Household', 'This phone', 'This version']) {
      await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeVisible()
    }
    await expect(page.getByRole('link', { name: /^Targets/ })).toContainText(/kcal a day/)

    await page.getByRole('link', { name: /^Backups/ }).click()
    await expect(page).toHaveURL(/#\/settings\/backups$/)
    await expect(page.getByRole('heading', { name: 'Backups', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy backup' })).toBeVisible()

    await page.getByRole('link', { name: 'Back to Settings' }).click()
    await expect(page).toHaveURL(/#\/settings$/)
    await page.getByRole('link', { name: 'Back to Today' }).click()
    await expect(page).toHaveURL(/#\/$/)
  })

  test('every row on the list is big enough for a thumb', async ({ page }) => {
    await goto(page, '/settings')
    const targets = page.locator('main a[href^="#/settings/"], main [role="radio"], main button')
    const count = await targets.count()
    expect(count).toBeGreaterThan(4)
    for (let i = 0; i < count; i++) {
      const box = await targets.nth(i).boundingBox()
      expect(box?.height ?? 0, `target ${i} is too short`).toBeGreaterThanOrEqual(40)
    }
  })

  test('the appearance switch on the list changes the look straight away', async ({ page }) => {
    await goto(page, '/settings')
    const group = page.getByRole('radiogroup', { name: 'Appearance' })
    await expect(group.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')
    await group.getByRole('radio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(group.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
    // Arrow keys move the choice, as in any radio group.
    await page.keyboard.press('ArrowRight')
    await expect(group.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')
  })

  test('a page this copy does not have goes back to the list', async ({ page }) => {
    await goto(page, '/settings/household')
    await expect(page).toHaveURL(/#\/settings$/)
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
  })
})

test.describe('settings on a desktop', () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, 'the desktop layout'))

  test('opens its first page with the list of pages beside it', async ({ page }) => {
    await goto(page, '/settings')
    await expect(page).toHaveURL(/#\/settings\/targets$/)
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Settings sections' })
    await expect(nav.getByRole('link', { name: 'Targets' })).toHaveAttribute('aria-current', 'page')
    // No account in this build, so no household and no reminders to list.
    await expect(nav.getByRole('link')).toHaveText(['Targets', 'Plan history', 'Appearance', 'Backups', 'App version'])

    await nav.getByRole('link', { name: 'Backups' }).click()
    await expect(nav.getByRole('link', { name: 'Backups' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { name: 'Backups', level: 2 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy backup' })).toBeVisible()
    // The sidebar has the way out, so no back arrow.
    await expect(page.getByRole('link', { name: /^Back to/ })).toHaveCount(0)
  })
})

test.describe('settings pages', () => {
  test('each one renders, is named, and fits the screen', async ({ page }) => {
    for (const [route, title, inside] of PAGES) {
      await goto(page, route)
      await expect(page).toHaveTitle(new RegExp(`^${title === 'App version' ? 'Account' : title} · Bite Buddy$`))
      await expect(page.getByRole('heading', { name: inside }).first()).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `${route} scrolls sideways`).toBeLessThanOrEqual(0)
    }
  })

  test('plan history lists each week with its language and opens it in place', async ({ page }) => {
    await goto(page, '/settings/history')
    const plans = page.getByRole('list', { name: 'Plans' })
    const first = plans.getByRole('listitem').first()
    await expect(first.locator('abbr')).toHaveText(/^(RO|HU)$/)

    const toggle = first.getByRole('button', { expanded: false })
    await toggle.click()
    await expect(first.getByRole('button', { expanded: true })).toBeVisible()
    await expect(first.getByRole('button', { name: 'Take this day' }).first()).toBeVisible()
    await expect(first.getByRole('button', { name: /^Load$/ })).toBeVisible()
  })

  test('the targets page keeps the week and the weight unit, and appearance has its own page', async ({ page }) => {
    await goto(page, '/settings/targets')
    await expect(page.getByLabel('Week starts on')).toBeVisible()
    await expect(page.getByLabel('Weights read in')).toBeVisible()
    await expect(page.getByRole('radiogroup', { name: 'Appearance' })).toHaveCount(0)

    await goto(page, '/settings/appearance')
    await page.getByRole('radio', { name: 'Light' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })
})
