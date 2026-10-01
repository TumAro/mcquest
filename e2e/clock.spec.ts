import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { startPaper, submitTest } from './helpers'

/**
 * D-04 / D-10 — the clock is quiet, Submit asks in the page, time-up never asks.
 * The paper is chosen from /data/index.json at runtime; nothing here names a bank.
 */

async function firstPaper(request: APIRequestContext): Promise<{ slug: string; year: number }> {
  const index = await (await request.get('/data/index.json')).json()
  const exam = index.exams[0]
  return { slug: exam.slug, year: exam.years[0].year }
}

/** Record every native dialog and dismiss it; the list must stay empty. */
function recordNativeDialogs(page: Page): string[] {
  const seen: string[] = []
  page.on('dialog', (d) => {
    seen.push(d.message())
    void d.dismiss()
  })
  return seen
}

test('a timed test shows a small clock', async ({ page, request }) => {
  const { slug, year } = await firstPaper(request)
  await startPaper(page, slug, year, { minutes: 5 })

  const clock = page.locator('.player-clock')
  await expect(clock).toHaveText(/^\d+:\d{2}$/)
  const fontSize = (loc: typeof clock) => loc.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(await fontSize(clock)).toBeLessThanOrEqual(await fontSize(page.locator('body')))
})

test('Submit asks in the page, not in a native dialog', async ({ page, request }) => {
  const { slug, year } = await firstPaper(request)
  const native = recordNativeDialogs(page)
  await startPaper(page, slug, year)

  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Submit test' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep working' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeVisible()

  await submitTest(page)
  await expect(page).toHaveURL(/#\/results\/[^/]+$/)
  expect(native).toEqual([])
})

test('time-up submits without asking', async ({ page, request }) => {
  const { slug, year } = await firstPaper(request)
  const native = recordNativeDialogs(page)
  await page.clock.install()
  await startPaper(page, slug, year, { minutes: 1 })

  await page.clock.fastForward('01:05')
  await expect(page).toHaveURL(/#\/results\/[^/]+$/, { timeout: 15000 })
  expect(native).toEqual([])
})
