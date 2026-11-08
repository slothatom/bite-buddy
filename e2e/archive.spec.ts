import { test, expect, type Page } from '@playwright/test'

/**
 * The plan archive, which the app no longer ships.
 *
 * The test build has no database, so it runs as a local copy does: the
 * archive is a file kept on the device, and anybody may load one. (Uploading
 * to the household as an admin goes through the same checks and is covered,
 * policies included, by `npm run db:check` and the unit tests.)
 */

async function goto(page: Page, route: string) {
  await page.goto(`#${route}`)
  await page.waitForLoadState('networkidle')
}

const tiny = {
  version: 1,
  sourcePlans: [{
    id: 'plan-99', file: 'made-up.docx', label: 'A made-up week', language: 'ro', subject: 'self',
    issuedOn: '2026-01-05',
    days: [{ dayName: 'Luni', weekday: 1, meals: [
      { slot: 'breakfast', text: '200 g pere', entries: [{ kind: 'food', foodId: 'pear', grams: 200 }] },
    ] }],
  }],
  mealRecipes: [],
  classification: {},
  recipeAliases: {},
  timesPlanned: {},
}

test.describe('the plan archive', () => {
  test('says what is loaded and where it came from', async ({ page }) => {
    await goto(page, '/settings/history')
    const panel = page.locator('[data-archive-panel]')
    await expect(panel).toContainText(/\d+ plans, \d+ days, \d+ recipes\. On this device only\./)
    await expect(panel.getByText('Load plan archive')).toBeVisible()
  })

  test('refuses a file that is not an archive, and keeps the one it has', async ({ page }) => {
    await goto(page, '/settings/history')
    const before = await page.getByRole('button', { name: /^Load$/ }).count()

    await page.getByLabel('Load plan archive').setInputFiles({
      name: 'backup.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ app: 'bite-buddy', schema: 4, stores: {} })),
    })
    await expect(page.getByRole('status')).toContainText('This is not a plan archive.')
    await expect(page.getByRole('button', { name: /^Load$/ })).toHaveCount(before)
  })

  test('takes a new one, and every screen reads it at once', async ({ page }) => {
    await goto(page, '/settings/history')
    await page.getByLabel('Load plan archive').setInputFiles({
      name: 'archive.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(tiny)),
    })

    const panel = page.locator('[data-archive-panel]')
    await expect(panel).toContainText('1 plan, 1 day, 0 recipes.')
    // Said in words, and still said after the screens remount around it.
    await expect(page.getByRole('status')).toHaveText('Loaded. 1 plan, 1 day, 0 recipes.')
    await expect(page.getByRole('button', { name: /^Load$/ })).toHaveCount(1)
    await expect(page.getByText('A made-up week')).toBeVisible()

    // Kept on the device: a reload comes back to the same archive.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('A made-up week')).toBeVisible()

    // And the recipe library is the hand-written dishes and nothing else, so
    // nothing from the archive it replaced lingers anywhere.
    await goto(page, '/recipes')
    await page.getByPlaceholder(/Search in English/).fill('rolled oats with yogurt')
    await expect(page.locator('[data-recipe-card]')).toHaveCount(0)
  })
})
