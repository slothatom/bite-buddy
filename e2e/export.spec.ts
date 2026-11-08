import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

/**
 * A summary to take to the dietician: a stretch and a person in, a page to
 * print or a file to send out.
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

/** A week of the dietician's in the planner, so the summary has food on it. */
async function loadAWeek(page: Page) {
  await goto(page, '/settings/history')
  await page.getByRole('button', { name: /^Load$/ }).first().click()
}

const NOTE = "Calories are estimates worked out by Bite Buddy, not by your dietician. This isn't medical advice."

test.describe('a summary for the dietician', () => {
  test('is reached from Progress and covers the week, the month or two dates', async ({ page }) => {
    await goto(page, '/progress')
    await page.getByRole('link', { name: 'Summary for your dietician' }).click()
    await expect(page.getByRole('heading', { name: 'For your dietician' })).toBeVisible()

    const summary = page.locator('[data-summary]')
    await expect(summary.locator('[data-summary-day]')).toHaveCount(7)
    await expect(summary.getByText(NOTE)).toBeVisible()

    await page.getByRole('tab', { name: 'Last 4 weeks' }).click()
    await expect(summary.locator('[data-summary-day]')).toHaveCount(28)
    await expect(summary.locator('[data-summary-week]')).toHaveCount(0)

    await page.getByRole('tab', { name: 'Custom' }).click()
    await page.getByLabel('From', { exact: true }).fill('2026-03-02')
    await page.getByLabel('To', { exact: true }).fill('2026-03-04')
    await expect(summary.locator('[data-summary-day]')).toHaveCount(3)
    await expect(summary.locator('[data-summary-day="2026-03-02"]')).toContainText('Nothing written down')
  })

  test('says what was eaten, the figures against the target, the servings and the weights', async ({ page }) => {
    await loadAWeek(page)
    await goto(page, '/progress')
    await page.getByRole('tab', { name: 'Body' }).click()
    await page.getByLabel('Weight').fill('68.4')
    await page.getByRole('button', { name: /^Log$/ }).click()

    await goto(page, '/progress/summary')
    const summary = page.locator('[data-summary]')
    const day = summary.locator('[data-summary-day]').filter({ hasText: 'Not ticked' }).first()
    await expect(day).toContainText(/of [\d,]+ kcal/)
    await expect(day.locator('[data-summary-known]')).toHaveText(/^\d+ of \d+ (entry|entries) fully known$/)
    await expect(summary.locator('[data-summary-week]').first()).toContainText('Aim for')
    await expect(summary.locator('[data-summary-weights]')).toContainText('68.4 kg')
  })

  test('downloads as one HTML file that stands on its own', async ({ page }) => {
    await loadAWeek(page)
    await goto(page, '/progress/summary')

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/^bite-buddy-summary-.+\.html$/)
    const html = await readFile((await download.path())!, 'utf8')
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('Food summary for')
    expect(html).toContain('This isn&#39;t medical advice.')
    expect(html).not.toMatch(/<script|<link /)
  })

  test('prints the summary and nothing else', async ({ page }) => {
    await goto(page, '/progress/summary')
    await page.evaluate(() => {
      (window as unknown as { printed: number }).printed = 0
      window.print = () => { (window as unknown as { printed: number }).printed++ }
    })
    await page.getByRole('button', { name: 'Print / Save as PDF' }).click()
    expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1)

    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('[data-summary]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Download' })).toBeHidden()
    await expect(page.getByRole('heading', { name: 'For your dietician' })).toBeHidden()
    for (const nav of await page.getByRole('navigation').all()) await expect(nav).toBeHidden()
  })

  test('is about the person you pick', async ({ page }) => {
    await aHouseholdOfTwo(page)
    await goto(page, '/progress/summary')
    await page.getByRole('tab', { name: 'Oli' }).click()
    await expect(page.locator('[data-summary] h1')).toHaveText('Food summary for Oli')
    await page.getByRole('tab', { name: 'Arany' }).click()
    await expect(page.locator('[data-summary] h1')).toHaveText('Food summary for Arany')
  })
})
