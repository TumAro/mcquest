import { test, expect } from '@playwright/test'

test('E2E: App responds to requests', async ({ page }) => {
  test.setTimeout(90000)

  // Go to homepage
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' })

  // Check that we got a response
  expect(response).toBeTruthy()
  expect(response?.status()).toBeLessThan(400)

  // Check that the page has content
  const content = await page.content()
  expect(content.length).toBeGreaterThan(500)
  expect(content).toContain('root')
})

test('E2E: Subject test page responds', async ({ page }) => {
  test.setTimeout(90000)

  // Go to subject test page
  const response = await page.goto('/#/test/subject', { waitUntil: 'domcontentloaded' })

  // Check response
  expect(response).toBeTruthy()
  if (response) {
    expect(response.status()).toBeLessThan(400)
  }

  // Wait a bit for React to initialize
  await page.waitForTimeout(2000)

  // Check page has content
  const html = await page.content()
  expect(html.length).toBeGreaterThan(500)
})
