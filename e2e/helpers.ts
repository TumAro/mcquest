import { expect, type Page } from '@playwright/test'

/** Open the paper's config route, optionally pick practice mode or a timer, start, and wait for the player. */
export async function startPaper(
  page: Page,
  slug: string,
  year: number,
  opts: { practice?: boolean; minutes?: number } = {},
) {
  await page.goto(`/#/exam/${slug}/${year}/config`)
  if (opts.practice) await page.getByRole('radio', { name: /practice mode/i }).check()
  if (opts.minutes) await page.locator('input[type="number"]').fill(String(opts.minutes))
  await page.getByRole('button', { name: 'Start Test' }).click()
  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeVisible({ timeout: 15000 })
}

export async function jumpTo(page: Page, n: number) {
  await page.getByRole('button', { name: new RegExp(`^Question ${n},`) }).click()
}

/** Submit through the in-page confirmation modal. */
export async function submitTest(page: Page) {
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit test' }).click()
}
