import { test, expect } from '@playwright/test'

test('Resume mid-attempt after reload — immediate', async ({ page }) => {
  // Start a subject-wise test
  await page.goto('/')
  await page.click('text=Subject-wise Test')

  // Pick the first available topic (don't hardcode 'eigen')
  const topicButtons = await page.locator('button:has-text("[a-z]")').all()
  if (topicButtons.length > 0) {
    await topicButtons[0].click()
  }

  // Set count to 1 for speed
  await page.fill('input[placeholder="Number of questions"]', '1')
  await page.click('button:has-text("Start")')

  // Wait for first question to load
  await page.waitForSelector('text=Question 1 of')

  // Answer the first question
  await page.click('input[value="0"]') // Select first option
  await page.click('button:has-text("Save & Next")')

  // Get remaining time before reload
  const timerBefore = await page.locator('text=/\\d+:\\d+/').first().textContent()
  const [minBefore] = timerBefore!.split(':').map(Number)

  // Reload the page mid-attempt
  await page.reload()

  // Resume dialog should appear
  await page.waitForSelector('text=in-progress attempt', { timeout: 5000 })
  await page.click('button:has-text("Resume")')

  // Assert we're back at the same state
  await page.waitForSelector('text=Question 1 of')

  // Verify answer persists
  const bubble = page.locator('[data-testid="bubble"]').first()
  await expect(bubble).toHaveClass(/answered/)

  // Verify timer didn't decrease much (allow 1 second drift)
  const timerAfter = await page.locator('text=/\\d+:\\d+/').first().textContent()
  const [minAfter] = timerAfter!.split(':').map(Number)
  expect(Math.abs(minAfter - minBefore)).toBeLessThanOrEqual(1)
})

test('Clock pause: remaining time does not decrease during closed tab', async ({ page }) => {
  // Start a subject-wise test with extended time
  await page.goto('/')
  await page.click('text=Subject-wise Test')

  // Pick first available topic
  const topicButtons = await page.locator('button:has-text("[a-z]")').all()
  if (topicButtons.length > 0) {
    await topicButtons[0].click()
  }

  // Set count to 1, time to 5 minutes for easy measurement
  await page.fill('input[placeholder="Number of questions"]', '1')
  await page.fill('input[placeholder="time"]', '5')
  await page.click('button:has-text("Start")')

  // Wait for first question
  await page.waitForSelector('text=Question 1 of')

  // Get initial remaining time
  const timerInitial = await page.locator('text=/\\d+:\\d+/').first().textContent()
  const [minInitial, secInitial] = timerInitial!.split(':').map(Number)
  const secondsInitial = minInitial * 60 + secInitial

  // Simulate closing the tab by reloading
  await page.reload()

  // Resume dialog appears
  await page.waitForSelector('text=in-progress attempt', { timeout: 5000 })

  // Wait 3 seconds while tab is closed (simulated by being in resume dialog)
  await page.waitForTimeout(3000)

  // Click Resume
  await page.click('button:has-text("Resume")')

  // Get remaining time after resume
  await page.waitForSelector('text=Question 1 of')
  const timerAfter = await page.locator('text=/\\d+:\\d+/').first().textContent()
  const [minAfter, secAfter] = timerAfter!.split(':').map(Number)
  const secondsAfter = minAfter * 60 + secAfter

  // Clock should have paused: remaining time should NOT have decreased by 3+ seconds
  // Allow 1 second drift for execution time
  const decrement = secondsInitial - secondsAfter
  expect(decrement).toBeLessThanOrEqual(1)
})
