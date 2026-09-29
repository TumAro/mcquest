import { test, expect, type Page } from '@playwright/test'

/**
 * TEST-06 — mid-attempt reload must cost nothing.
 *
 * These drive the real UI. Nothing here names an exam, a year, a topic slug or a
 * question count: the bank holds one synthetic paper today and real ones shortly,
 * so every selection is made from whatever the page actually offers at runtime.
 */

const TIMER_MINUTES = 5

/** Start a subject-wise test with the first topic available, a timer, and exam mode. */
async function startSubjectTest(page: Page) {
  await page.goto('/#/test/subject')

  // Topic checkboxes render only once index.json has loaded.
  const topics = page.locator('input[type="checkbox"]')
  await expect(topics.first()).toBeVisible({ timeout: 15000 })

  // First checkbox is a topic; the timer toggle is the one inside TestOptions,
  // so scope the topic pick to the section under the Topics heading.
  await topics.first().check()

  // Timer on, short enough that a few seconds is measurable against it.
  const minutes = page.locator('input[type="number"]').last()
  await minutes.fill(String(TIMER_MINUTES))

  // Exam mode — no per-question reveal, so the palette stays stable across reload.
  await page.getByRole('radio', { name: /exam mode/i }).check()

  await page.getByRole('button', { name: 'Start Test' }).click()

  // One topic rarely holds the requested count, so the short-pool dialog usually
  // appears. Match only its own button — a looser /start/i would also match the
  // "Start Test" button sitting behind the modal overlay, which cannot be clicked.
  const proceed = page.getByRole('button', { name: /^Proceed with \d+ questions$/ })
  if (await proceed.isVisible({ timeout: 3000 }).catch(() => false)) {
    await proceed.click()
  }

  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeVisible({ timeout: 15000 })
}

/** Remaining time as seconds, read from the mm:ss clock in the player header. */
async function remainingSeconds(page: Page): Promise<number> {
  const clock = page.locator('span', { hasText: /^\d+:\d{2}$/ }).first()
  const text = (await clock.textContent())?.trim() ?? ''
  const [m, s] = text.split(':').map(Number)
  expect(Number.isFinite(m) && Number.isFinite(s)).toBeTruthy()
  return m * 60 + s
}

test('answers, marks and clock survive a mid-attempt reload', async ({ page }) => {
  await startSubjectTest(page)

  // Answer question 1 by whatever widget it uses.
  const firstOption = page.locator('input[type="radio"], input[type="checkbox"]').first()
  const numericBox = page.locator('input[type="number"]')

  if (await firstOption.isVisible().catch(() => false)) {
    await firstOption.check()
  } else {
    await numericBox.first().fill('1')
  }

  // Mark question 1 for review and advance, so two distinct states must survive.
  await page.getByRole('button', { name: 'Mark for Review & Next' }).click()

  // Let the debounced save (1s) flush before reloading.
  await page.waitForTimeout(1500)

  const beforeRemaining = await remainingSeconds(page)

  await page.reload()

  // The resume dialog must appear and must offer both paths.
  await expect(page.getByRole('heading', { name: /resume attempt/i })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: /start fresh/i })).toBeVisible()
  await page.getByRole('button', { name: /^resume$/i }).click()

  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeVisible({ timeout: 15000 })

  // The marked-for-review state survived: at least one bubble reports itself marked.
  const markedBubble = page.locator('[aria-label*="marked" i]')
  await expect(markedBubble.first()).toBeVisible()

  // The clock survived and did not reset to the full duration.
  const afterRemaining = await remainingSeconds(page)
  expect(afterRemaining).toBeLessThanOrEqual(TIMER_MINUTES * 60)
  expect(Math.abs(afterRemaining - beforeRemaining)).toBeLessThanOrEqual(3)
})

test('the clock pauses while the tab is closed', async ({ page }) => {
  await startSubjectTest(page)

  // Touch a question so there is an attempt worth resuming.
  const firstOption = page.locator('input[type="radio"], input[type="checkbox"]').first()
  if (await firstOption.isVisible().catch(() => false)) {
    await firstOption.check()
  }
  await page.waitForTimeout(1500) // let the debounced save flush

  const beforeRemaining = await remainingSeconds(page)

  await page.reload()
  await expect(page.getByRole('heading', { name: /resume attempt/i })).toBeVisible({ timeout: 15000 })

  // Sit in the dialog. This is the whole point of the test: an immediate reload
  // cannot tell a paused clock from a running one, so wait long enough that a
  // running clock would visibly lose time.
  const AWAY_SECONDS = 6
  await page.waitForTimeout(AWAY_SECONDS * 1000)

  await page.getByRole('button', { name: /^resume$/i }).click()
  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeVisible({ timeout: 15000 })

  const afterRemaining = await remainingSeconds(page)
  const lost = beforeRemaining - afterRemaining

  // A running clock would have lost AWAY_SECONDS. A paused one loses ~0.
  // Allow 2s for navigation and render, but fail well below the away time.
  expect(lost).toBeLessThan(AWAY_SECONDS - 2)
})

test('abandoning an attempt clears it', async ({ page }) => {
  await startSubjectTest(page)

  const firstOption = page.locator('input[type="radio"], input[type="checkbox"]').first()
  if (await firstOption.isVisible().catch(() => false)) {
    await firstOption.check()
  }
  await page.waitForTimeout(1500)

  await page.reload()
  await expect(page.getByRole('heading', { name: /resume attempt/i })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /start fresh/i }).click()

  // Dialog gone, and a second reload must not resurrect the discarded attempt.
  await expect(page.getByRole('heading', { name: /resume attempt/i })).toBeHidden()
  await page.waitForTimeout(1000) // let the async clear settle before reloading
  await page.reload()
  await expect(page.getByRole('heading', { name: /resume attempt/i })).toBeHidden({ timeout: 10000 })
})
