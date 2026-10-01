import { test, expect, type Page } from '@playwright/test'

/**
 * FIX-02 / FIX-03 — the keyboard does what the focused control says, number keys
 * work on every single question, and the Bookmark button keeps one name.
 * One click on Random reaches the player; nothing here names a bank.
 */

async function openPlayer(page: Page) {
  await page.goto('/#/')
  await page.getByRole('button', { name: /^random/i }).click()
  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeVisible({ timeout: 15000 })
  if ((await page.locator('.palette-bubble').count()) < 2) {
    throw new Error('The drill has fewer than two questions; the keyboard spec needs a bank with at least two.')
  }
}

/** Put focus on the page body, as a person is after reading the question. */
const focusBody = (page: Page) => page.locator('.player-progress').click()

test('Enter on the focused Bookmark button toggles it and does not advance', async ({ page }) => {
  await openPlayer(page)
  const bookmark = page.getByRole('button', { name: 'Bookmark', exact: true })
  const progress = page.locator('.player-progress')
  const before = await progress.textContent()

  await bookmark.focus()
  await page.keyboard.press('Enter')

  await expect(bookmark).toHaveAttribute('aria-pressed', 'true')
  await expect(progress).toHaveText(before!)
  await expect(page.getByRole('button', { name: 'Bookmark', exact: true })).toBeVisible()
})

test('Enter with focus on the page saves and moves to question 2', async ({ page }) => {
  await openPlayer(page)
  await focusBody(page)
  await page.keyboard.press('Enter')
  await expect(page.locator('.player-progress')).toContainText('Question 2 of')
})

test('a number key picks that option on a single question', async ({ page }) => {
  await openPlayer(page)
  const radios = page.locator('.question-pane-option input[type="radio"]')
  const bubbles = page.locator('.palette-bubble')
  let found = false
  for (let i = 0; i < (await bubbles.count()) && !found; i++) {
    await bubbles.nth(i).click()
    found = (await radios.count()) > 1
  }
  if (!found) throw new Error('No question in the drill renders radio inputs; the number-key spec needs one.')

  await focusBody(page)
  await page.keyboard.press('2')
  await expect(radios.nth(1)).toBeChecked()
})

test('shortcuts do nothing behind the Submit modal', async ({ page }) => {
  await openPlayer(page)
  const progress = page.locator('.player-progress')
  const before = await progress.textContent()

  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('ArrowRight')

  await expect(progress).toHaveText(before!)
})
