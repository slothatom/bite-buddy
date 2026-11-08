import { test, expect, type Page } from '@playwright/test'

/**
 * Progress, as redesigned: one header across Overview, Movement and Summary,
 * with the person picker in it, and the old inner tabs folded into the
 * overview and its "In detail" section.
 */

async function goto(page: Page, route: string) {
  await page.goto(`#${route}`)
  await page.waitForLoadState('networkidle')
}

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

async function loadAWeek(page: Page) {
  await goto(page, '/settings/history')
  await page.getByRole('button', { name: /^Load$/ }).first().click()
}

const ROUTES = ['/progress', '/progress/movement', '/progress/summary']

test.describe('the Progress redesign', () => {
  test('every screen carries the title and the three tabs, with the current one marked', async ({ page }) => {
    for (const route of ROUTES) {
      await goto(page, route)
      await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeVisible()
      const tabs = page.getByRole('navigation', { name: 'Progress views' })
      await expect(tabs.getByRole('link')).toHaveCount(3)
      await expect(tabs.locator('[aria-current="page"]')).toHaveAttribute('href', `#${route}`)
    }
  })

  test('the overview charts the week and keeps body, servings and trends below it', async ({ page }) => {
    await loadAWeek(page)
    await goto(page, '/progress')

    await expect(page.getByRole('img', { name: /^Calories by day against a target of/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Daily averages' })).toBeVisible()

    const detail = page.getByRole('tablist', { name: 'Which detail' })
    await expect(detail.getByRole('tab', { name: 'Body', selected: true })).toBeVisible()
    await expect(page.getByLabel('Weight', { exact: true })).toBeVisible()

    await detail.getByRole('tab', { name: 'Mediterranean' }).click()
    await expect(page.getByText('Aim for', { exact: true })).toBeVisible()

    await detail.getByRole('tab', { name: 'Trends' }).click()
    await expect(detail.getByRole('tab', { name: 'Trends', selected: true })).toBeVisible()
  })

  test('a weight logged below shows in the overview', async ({ page }, info) => {
    await goto(page, '/progress')
    await page.getByLabel('Weight', { exact: true }).fill('70.4')
    await page.getByRole('button', { name: /^Log$/ }).click()

    // The phone has a Weight card; the desktop has a Weight tile.
    const glance = info.project.name === 'mobile'
      ? page.locator('section').filter({ has: page.getByRole('heading', { name: 'Weight', exact: true }) })
      : page.locator('dl').filter({ hasText: /^Daily average/ })
    await expect(glance).toContainText('70.4')
  })

  test('the person picked in the header is the one both Overview and Movement show', async ({ page }) => {
    await aHouseholdOfTwo(page)
    await goto(page, '/progress')
    const oli = page.getByRole('button', { name: 'Show Oli' })
    await expect(page.getByRole('button', { name: 'Show Arany' })).toHaveAttribute('aria-pressed', 'true')
    await oli.click()
    await expect(oli).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('navigation', { name: 'Progress views' }).getByRole('link', { name: 'Movement' }).click()
    await expect(page.getByRole('button', { name: 'Show Oli' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('movement switches between exercise and sleep, and lists this week first', async ({ page }) => {
    await goto(page, '/progress/movement')
    const exercise = page.getByRole('button', { name: 'Exercise', exact: true })
    const sleep = page.getByRole('button', { name: 'Sleep', exact: true })
    await expect(exercise).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('img', { name: /^Minutes moved each day this week/ })).toBeVisible()

    await page.getByRole('button', { name: 'Log in one go' }).click()
    await page.getByLabel('What was it').fill('Swim')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    const week = page.getByRole('region', { name: 'Logged this week' })
    await expect(week.getByText('Swim')).toBeVisible()
    await expect(week.getByRole('button', { name: 'Remove Swim' })).toBeVisible()

    await sleep.click()
    await expect(sleep).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Hours slept')).toBeVisible()
  })

  test('the summary picks days and a person with toggles, and prints only itself', async ({ page }) => {
    await aHouseholdOfTwo(page)
    await goto(page, '/progress/summary')

    const month = page.getByRole('button', { name: 'Last 4 weeks' })
    await month.click()
    await expect(month).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/, 28 days$/)).toBeVisible()

    await page.getByRole('button', { name: 'Oli', exact: true }).click()
    await expect(page.locator('[data-summary] h1')).toHaveText('Food summary for Oli')

    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('[data-summary]')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Progress' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Last 4 weeks' })).toBeHidden()
  })

  test('nothing scrolls sideways and every control is big enough to tap', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'a phone-sized check')
    await aHouseholdOfTwo(page)
    await loadAWeek(page)
    for (const route of ROUTES) {
      await goto(page, route)
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
      expect(wide, `${route} scrolls sideways`).toBe(false)

      const small = await page.locator('main button:visible, main a:visible').evaluateAll((els) =>
        els.filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && Math.min(r.height, r.width) < 44
            && !el.closest('[data-summary]') && !el.closest('[role="img"]')
        }).map((el) => `${el.tagName} ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}`))
      expect(small, `${route} has small targets`).toEqual([])
    }
  })
})
