import { test, expect } from '@playwright/test'

/**
 * The topic picker is one collapsed row per subject, and the row's own checkbox
 * takes the whole subject in one click.
 */
test('a subject checkbox selects every topic under it', async ({ page }) => {
  await page.goto('/#/test/subject')

  const subject = page.locator('.topics-subject').first()
  await expect(subject.locator('.topics-subject-count')).toHaveText(/^0\//)

  // The topic list is collapsed until the row is opened.
  await expect(subject.locator('.topics-list input').first()).toBeHidden()

  await subject.locator('.topics-subject-summary input').check()
  await subject.locator('.topics-subject-summary').click()

  const topics = subject.locator('.topics-list input')
  const n = await topics.count()
  expect(n).toBeGreaterThan(1)
  for (let i = 0; i < n; i++) {
    await expect(topics.nth(i)).toBeChecked()
  }
  await expect(subject.locator('.topics-subject-count')).toHaveText(`${n}/${n}`)

  // Unchecking the subject clears them again.
  await subject.locator('.topics-subject-summary input').uncheck()
  await expect(subject.locator('.topics-subject-count')).toHaveText(`0/${n}`)
})
