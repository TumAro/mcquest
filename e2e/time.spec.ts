import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { startPaper, jumpTo, submitTest } from './helpers'

/**
 * STAT-04 / D-05 — time spent on a question is stored against that question,
 * however the user left it. Reads the submitted record straight from IndexedDB.
 * The paper is chosen from /data/index.json at runtime; nothing here names a bank.
 */

const DWELL_MS = 1400

interface LoadedPaper {
  slug: string
  year: number
  ids: string[]
}

async function pickPaper(request: APIRequestContext): Promise<LoadedPaper> {
  const index = await (await request.get('/data/index.json')).json()
  for (const exam of index.exams) {
    for (const y of exam.years) {
      const paper = await (await request.get(`/data/${exam.slug}/${y.year}.json`)).json()
      if (paper.questions.length >= 3) {
        return {
          slug: exam.slug,
          year: y.year,
          ids: paper.questions.map((q: { id: string }) => q.id),
        }
      }
    }
  }
  throw new Error('No paper in public/data has at least 3 questions; the time spec needs one.')
}

/** Submit, then return the stored per-question timeSpent keyed by question id. */
async function submitAndRead(page: Page): Promise<Record<string, number>> {
  await submitTest(page)
  await expect(page).toHaveURL(/#\/results\/[^/]+$/)
  const id = page.url().split('/results/')[1]
  const record = await page.evaluate(
    (key) =>
      new Promise<{ questions: { id: string; timeSpent: number }[] }>((resolve, reject) => {
        const open = indexedDB.open('keyval-store')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const req = open.result.transaction('keyval', 'readonly').objectStore('keyval').get(key)
          req.onerror = () => reject(req.error)
          req.onsuccess = () => resolve(req.result)
        }
      }),
    `attempt:${id}`,
  )
  expect(record, 'stored attempt record').toBeTruthy()
  const byId: Record<string, number> = {}
  for (const q of record.questions) {
    expect(Number.isInteger(q.timeSpent) && q.timeSpent >= 0, `timeSpent of ${q.id}`).toBe(true)
    byId[q.id] = q.timeSpent
  }
  return byId
}

test('a palette round trip credits each question, and the untouched one stays at 0', async ({
  page,
  request,
}) => {
  const p = await pickPaper(request)
  await startPaper(page, p.slug, p.year)

  await page.waitForTimeout(DWELL_MS)
  await jumpTo(page, 3)
  await page.waitForTimeout(DWELL_MS)
  await jumpTo(page, 1)
  await page.waitForTimeout(DWELL_MS)

  const t = await submitAndRead(page)
  expect(t[p.ids[0]], 'Q1 (visited twice)').toBeGreaterThanOrEqual(2)
  expect(t[p.ids[2]], 'Q3').toBeGreaterThanOrEqual(1)
  expect(t[p.ids[1]], 'Q2 (never visited)').toBe(0)
})

test('Save & Next credits the question that was left', async ({ page, request }) => {
  const p = await pickPaper(request)
  await startPaper(page, p.slug, p.year)

  await page.waitForTimeout(DWELL_MS)
  await page.getByRole('button', { name: 'Save & Next' }).click()

  const t = await submitAndRead(page)
  expect(t[p.ids[0]], 'Q1').toBeGreaterThanOrEqual(1)
  expect(t[p.ids[2]], 'Q3 (never visited)').toBe(0)
})
