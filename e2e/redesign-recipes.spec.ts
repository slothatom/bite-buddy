import { test, expect, type Page } from '@playwright/test'

/**
 * The Recipes section as redesigned: the library as a list with the recipe
 * beside it on a wide screen and over it on a phone, the section's tabs inside
 * its header, and Foods as a list on a phone and a table on a laptop.
 */

async function goto(page: Page, route: string) {
  await page.goto(`#${route}`)
  await page.waitForLoadState('networkidle')
}

const isPhone = (name: string) => name === 'mobile'

test.describe('the recipe library', () => {
  test('the section title comes first, then its two halves', async ({ page }) => {
    await goto(page, '/recipes')
    await expect(page.getByRole('heading', { level: 1, name: 'Recipes' })).toBeVisible()

    const library = page.getByRole('navigation', { name: 'Library' })
    await expect(library.getByRole('link', { name: 'Recipes' })).toHaveAttribute('aria-current', 'page')
    await library.getByRole('link', { name: 'Foods' }).click()
    await expect(page).toHaveURL(/#\/recipes\/foods$/)
    await expect(library.getByRole('link', { name: 'Foods' })).toHaveAttribute('aria-current', 'page')
  })

  test('the list says how many and what a serving comes to', async ({ page }) => {
    await goto(page, '/recipes')
    const rows = page.locator('[data-recipe-card]')
    await expect(rows.first()).toBeVisible()

    const count = await rows.count()
    await expect(page.getByRole('heading', { name: `${count} ${count === 1 ? 'recipe' : 'recipes'}` }))
      .toBeVisible()
    // The figure at the end of a row is its kcal per serving.
    await expect(rows.first()).toContainText(/\d+$/)
  })

  test('on a phone a recipe is a screen of its own, and back returns to the list', async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), 'the phone layout')
    await goto(page, '/recipes')
    await page.locator('[data-recipe-card]').first().click()

    const detail = page.getByRole('dialog')
    await expect(detail).toBeVisible()
    await expect(detail.getByRole('heading', { name: 'What goes in' })).toBeVisible()
    await expect(detail.getByRole('button', { name: 'Add to plan' })).toBeVisible()
    for (const macro of ['Protein', 'Carbs', 'Fat', 'Fibre']) {
      await expect(detail.getByText(macro, { exact: true })).toBeVisible()
    }

    await detail.getByRole('button', { name: 'Back to recipes' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.locator('[data-recipe-card]').first()).toBeVisible()
  })

  test('on a laptop the recipe opens beside the list, which stays put', async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), 'the wide layout')
    await goto(page, '/recipes')
    await expect(page.getByText('Pick a recipe to read it here.')).toBeVisible()

    const rows = page.locator('[data-recipe-card]')
    await rows.nth(1).click()
    await expect(rows.nth(1)).toHaveAttribute('aria-current', 'true')

    const detail = page.locator('[data-recipe-detail]')
    await expect(detail).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(detail.getByText('Energy', { exact: true })).toBeVisible()
    await expect(detail.getByRole('button', { name: 'Edit recipe' })).toBeVisible()

    // Side by side, not stacked.
    const list = await page.getByRole('list', { name: 'Recipes' }).boundingBox()
    const pane = await detail.boundingBox()
    expect(pane!.x).toBeGreaterThan(list!.x + list!.width - 1)

    // A different row swaps the pane rather than stacking a second one.
    await rows.nth(2).click()
    await expect(page.locator('[data-recipe-detail]')).toHaveCount(1)
    await expect(rows.nth(2)).toHaveAttribute('aria-current', 'true')
  })

  test('a question you can ask the list is a chip, and clearing puts it back', async ({ page }) => {
    await goto(page, '/recipes')
    await page.getByRole('button', { name: /^Breakfast/ }).click()
    const before = await page.locator('[data-recipe-card]').count()

    await page.getByRole('button', { name: /Quick tonight/ }).click()
    await expect(page.getByRole('heading', { name: /recipes?$/ })).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByRole('button', { name: /Quick tonight/ })).toHaveAttribute('aria-pressed', 'false')
    expect(await page.locator('[data-recipe-card]').count()).toBe(before)
  })
})

test.describe('the food library', () => {
  test('New food opens the sheet that writes one down', async ({ page }) => {
    await goto(page, '/recipes/foods')
    // "New food" rather than "Add food", which the sidebar uses for today.
    await page.getByRole('main').getByRole('button', { name: 'New food' }).click()
    await expect(page.getByLabel('Name (English)')).toBeVisible()
  })

  test('a phone lists foods by group, each row with its guide tier and source', async ({ page }, testInfo) => {
    test.skip(!isPhone(testInfo.project.name), 'the phone layout')
    await goto(page, '/recipes/foods')
    await expect(page.getByRole('heading', { name: /^\d+ foods?$/ })).toBeVisible()
    const row = page.locator('[data-food-row]').first()
    await expect(row).toBeVisible()
    await expect(row).toContainText(/kcal/)
    await expect(row).toContainText(/Daily|Weekly|Moderation|Occasionally|Rarely/)
  })

  test('a laptop shows the figures as a table, per 100 g', async ({ page }, testInfo) => {
    test.skip(isPhone(testInfo.project.name), 'the wide layout')
    await goto(page, '/recipes/foods')
    await expect(page.getByRole('heading', { level: 1, name: 'Foods' })).toBeVisible()
    const table = page.getByRole('table')
    for (const column of ['Food', 'kcal / 100 g', 'Protein', 'Carbs', 'Fat', 'Fibre', 'Salt', 'Source']) {
      await expect(table.getByRole('columnheader', { name: column, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Scan a barcode' })).toBeVisible()

    await page.getByLabel('Search foods').fill('asparagus')
    await page.getByRole('button', { name: /^Edit Asparagus/ }).click()
    await expect(page.getByLabel('Food name')).toHaveValue('Asparagus')
  })
})
