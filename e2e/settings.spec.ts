import { test, expect, type Page } from '@playwright/test'
import { THEME_KEY } from '../src/storage'

/**
 * SET-01/02, DARK-01/02 — the settings panel and the theme plumbing. Drives the
 * real UI; nothing here names anything from the bank.
 */

async function openSettings(page: Page) {
  await page.goto('/')
  await expect(page.locator('.mode-list')).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  return page.getByRole('dialog', { name: 'Settings' })
}

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme)
const mirror = (page: Page) => page.evaluate((k) => localStorage.getItem(k), THEME_KEY)

test('the panel holds exactly the five preferences', async ({ page }) => {
  const dialog = await openSettings(page)
  await expect(dialog.getByRole('radio')).toHaveCount(3)
  await expect(dialog.getByRole('spinbutton')).toHaveCount(2)
  await expect(dialog.getByRole('checkbox')).toHaveCount(2)
  await expect(dialog.getByRole('button', { name: /clock/i })).toHaveCount(0)
  await expect(dialog.getByLabel(/clock/i)).toHaveCount(0)

  await dialog.getByRole('checkbox', { name: 'Time drills' }).check()
  await expect(dialog.getByRole('spinbutton')).toHaveCount(3)
  await expect(dialog.getByRole('spinbutton', { name: 'Drill time (minutes)' })).toBeVisible()
})

test('settings persist across a reload', async ({ page }) => {
  let dialog = await openSettings(page)
  await dialog.getByRole('spinbutton', { name: 'Paper time (minutes)' }).fill('90')
  await dialog.getByRole('spinbutton', { name: 'Questions per drill' }).fill('7')
  await dialog.getByRole('checkbox', { name: 'Time drills' }).check()
  await dialog.getByRole('spinbutton', { name: 'Drill time (minutes)' }).fill('45')
  await dialog.getByRole('checkbox', { name: 'Show the answer as I go in drills' }).uncheck()
  await dialog.getByRole('radio', { name: 'Dark' }).check()
  await expect.poll(() => mirror(page)).toBe('dark')
  await dialog.getByRole('button', { name: 'Done' }).click()

  await page.reload()
  dialog = await openSettings(page)
  await expect(dialog.getByRole('spinbutton', { name: 'Paper time (minutes)' })).toHaveValue('90')
  await expect(dialog.getByRole('spinbutton', { name: 'Questions per drill' })).toHaveValue('7')
  await expect(dialog.getByRole('checkbox', { name: 'Time drills' })).toBeChecked()
  await expect(dialog.getByRole('spinbutton', { name: 'Drill time (minutes)' })).toHaveValue('45')
  await expect(dialog.getByRole('checkbox', { name: 'Show the answer as I go in drills' })).not.toBeChecked()
  await expect(dialog.getByRole('radio', { name: 'Dark' })).toBeChecked()
  expect(await theme(page)).toBe('dark')
})

test('System removes the explicit theme', async ({ page }) => {
  const dialog = await openSettings(page)
  await dialog.getByRole('radio', { name: 'Dark' }).check()
  await expect.poll(() => theme(page)).toBe('dark')
  await dialog.getByRole('radio', { name: 'System' }).check()
  await expect.poll(() => theme(page)).toBeUndefined()
  await expect.poll(() => mirror(page)).toBe('system')
})

test('the stored theme is applied before the app loads', async ({ page }) => {
  // Block the app entry so React never mounts: only the inline script can set the attribute.
  await page.route(/\/src\/main\.tsx/, (route) => route.abort())

  await page.addInitScript((k) => localStorage.setItem(k, 'dark'), THEME_KEY)
  await page.goto('/')
  expect(await theme(page)).toBe('dark')

  await page.addInitScript((k) => localStorage.setItem(k, 'purple'), THEME_KEY)
  await page.goto('/')
  expect(await theme(page)).toBeUndefined()
})

test('the front page links to stats', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.mode-list')).toBeVisible()
  await page.getByRole('link', { name: 'Stats', exact: true }).click()
  await expect(page).toHaveURL(/#\/stats$/)
})
