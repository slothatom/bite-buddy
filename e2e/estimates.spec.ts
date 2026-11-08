import { test, expect, type Page } from '@playwright/test'

/**
 * The numbers say where they come from.
 *
 * The dietician wrote meals, not calories, so every figure is the app's own
 * estimate, and a day's totals say how many of its entries they are sure of.
 */

async function goto(page: Page, route: string) {
  await page.goto(`#${route}`)
  await page.waitForLoadState('networkidle')
}

const NOTE = "Calories are estimates worked out by Bite Buddy, not by your dietician. This isn't medical advice."

test.describe('estimates, not medical advice', () => {
  test('Settings says so next to the targets', async ({ page }) => {
    await goto(page, '/settings')
    const targets = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Daily targets' }) })
    await expect(targets.getByText(NOTE)).toBeVisible()
  })

  test('Progress says so under its heading', async ({ page }) => {
    await goto(page, '/analytics')
    await expect(page.getByText(NOTE)).toBeVisible()
  })

  test('the note is a readable caption, not fine print', async ({ page }) => {
    await goto(page, '/analytics')
    const size = await page.locator('[data-estimates-note]').evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize))
    expect(size).toBeGreaterThanOrEqual(12)
  })

  test('a day with food says how many of its entries are fully known', async ({ page }) => {
    // A week of the dietician's, so there is a day with food on it.
    await goto(page, '/settings/history')
    await page.getByRole('button', { name: /^Load$/ }).first().click()

    await goto(page, '/plan')
    await page.getByRole('tab', { name: '1 week' }).click()
    const row = page.locator('[data-day-row]')
      .filter({ has: page.locator('[data-planned]') })
      .first()
    if ((page.viewportSize()?.width ?? 0) >= 640) {
      await row.getByRole('button', { name: /the full names/ }).click()
    }
    await row.getByRole('button', { name: /^Open / }).click()

    const hint = page.locator('[data-completeness]')
    await expect(hint).toBeVisible()
    await expect(hint).toHaveText(/^\d+ of \d+ (entry|entries) fully known$/)
    const [known, total] = (await hint.innerText()).match(/\d+/g)!.map(Number)
    expect(known).toBeLessThanOrEqual(total)
    expect(total).toBeGreaterThan(0)
  })
})
