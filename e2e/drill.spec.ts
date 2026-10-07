import { test, expect, type Page } from '@playwright/test'
import { DEFAULT_SETTINGS } from '../src/storage'

/**
 * The tracer for the settings phase: one click on Random opens a drill that took
 * its size, timer and feedback from the stored settings, and its figures load.
 * Nothing here names an exam, a year, a topic or a count: all of it is read from
 * /data/index.json at runtime.
 */

// The stored questionCount is clamped on read, so a bank bigger than the cap
// cannot be drawn whole.
const MAX_DRILL_QUESTIONS = 200

async function bankSize(request: { get: (url: string) => Promise<{ json: () => Promise<any> }> }): Promise<number> {
  const index = await (await request.get('/data/index.json')).json()
  return index.exams.reduce((n: number, e: any) => n + e.years.reduce((m: number, y: any) => m + y.count, 0), 0)
}

async function seedSettings(page: Page, settings: object) {
  await page.goto('/#/')
  await expect(page.locator('.mode-list')).toBeVisible()
  await page.evaluate(
    (record) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite')
          tx.objectStore('keyval').put(record, 'settings')
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
      }),
    settings,
  )
  await page.reload()
  await expect(page.locator('.mode-list')).toBeVisible()
}

test('Random starts a drill in one click on the defaults', async ({ page, request }) => {
  const n = Math.min(DEFAULT_SETTINGS.questionCount, await bankSize(request))
  await page.goto('/#/')
  await page.getByRole('button', { name: /^random/i }).click()

  await expect(page.locator('.player-progress')).toContainText(`Question 1 of ${n}`)
  await expect(page.locator('.palette-bubble')).toHaveCount(n)
  // The clock appears on the first tick after the deadline is set, so give it one.
  await page.waitForTimeout(500)
  await expect(page.locator('.player-clock')).toHaveCount(0)
})

test('a drill shows its figures', async ({ page, request }) => {
  const total = Math.min(await bankSize(request), MAX_DRILL_QUESTIONS)
  await seedSettings(page, { ...DEFAULT_SETTINGS, questionCount: total })
  await page.getByRole('button', { name: /^random/i }).click()

  const bubbles = page.locator('.palette-bubble')
  await expect(bubbles).toHaveCount(total)
  let checked = 0
  for (let i = 0; i < total; i++) {
    await bubbles.nth(i).click()
    await expect(page.locator('.player-progress')).toContainText(`Question ${i + 1} of `)
    const img = page.locator('.player-question-body img')
    if ((await img.count()) === 0) continue
    await expect
      .poll(() => img.first().evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true)
    checked++
  }
  if (checked === 0) throw new Error('No question in public/data has an image; the figure spec needs one.')
})

test('practice mode shows the verdict and the key once an answer is saved', async ({ page }) => {
  // The default settings turn drill feedback on, so Random is a practice drill.
  await page.goto('/#/')
  await page.getByRole('button', { name: /^random/i }).click()
  await expect(page.locator('.player-progress')).toContainText('Question 1 of')

  const option = page.locator('.question-pane-option input').first()
  if ((await option.count()) === 0) {
    // A numeric question has no options; the next one in the drill will.
    await page.getByRole('button', { name: 'Save & Next' }).click()
  }
  await page.locator('.question-pane-option input').first().check()
  await page.getByRole('button', { name: 'Save & Next' }).click()

  // Back to the question that was just answered.
  await page.locator('.palette-bubble').nth(0).click()
  await expect(page.locator('.player-verdict')).toHaveText(/Correct|Wrong/)
  await expect(page.locator('.option-tag--key').first()).toBeVisible()
  await expect(page.locator('.question-pane-option input').first()).toBeDisabled()
})
