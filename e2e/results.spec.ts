import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { inferType } from '../scripts/lib/rules.mjs'

/**
 * TEST-05 — a submitted test is scored on the results screen.
 *
 * These drive the real UI. Nothing here names an exam, a year, a topic or a
 * question count: the paper is chosen from /data/index.json at runtime and every
 * expected value is computed from the paper's own data, never from src/.
 */

interface PaperQuestion {
  id: string
  topic: string
  marks: number
  correct?: number[]
  answer?: { min: number; max: number } | null
  options?: string[]
  type?: string
}
interface LoadedPaper {
  slug: string
  year: number
  questions: PaperQuestion[]
}

async function loadPapers(request: APIRequestContext): Promise<LoadedPaper[]> {
  const index = await (await request.get('/data/index.json')).json()
  const papers: LoadedPaper[] = []
  for (const exam of index.exams) {
    for (const y of exam.years) {
      const paper = await (await request.get(`/data/${exam.slug}/${y.year}.json`)).json()
      papers.push({ slug: exam.slug, year: y.year, questions: paper.questions })
    }
  }
  return papers
}

/** First paper whose questions cover single, multi and numeric. */
async function pickPaper(request: APIRequestContext): Promise<LoadedPaper> {
  const papers = await loadPapers(request)
  const all = ['single', 'multi', 'numeric']
  const hit = papers.find((p) => all.every((t) => p.questions.some((q) => inferType(q) === t)))
  if (!hit) {
    throw new Error(
      'No paper in public/data has all three question types (single, multi, numeric); TEST-05 needs one of each.',
    )
  }
  return hit
}

async function startPaper(page: Page, slug: string, year: number) {
  await page.goto(`/#/exam/${slug}/${year}/config`)
  await page.getByRole('button', { name: 'Start Test' }).click()
  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeVisible({ timeout: 15000 })
}

async function jumpTo(page: Page, n: number) {
  await page.getByRole('button', { name: new RegExp(`^Question ${n},`) }).click()
}

async function answerCorrectly(page: Page, q: PaperQuestion) {
  const type = inferType(q)
  if (type === 'numeric') {
    const { min, max } = q.answer!
    await page.locator('input[type="number"]').fill(String((min + max) / 2))
  } else {
    for (const i of q.correct!) {
      await page.locator('.question-pane-option input').nth(i).check()
    }
  }
}

const fmt = (n: number) => Number(n.toFixed(2)).toString()

test('TEST-05: one question of each type, submitted, scored on the results screen', async ({ page, request }) => {
  const paper = await pickPaper(request)
  await startPaper(page, paper.slug, paper.year)

  let score = 0
  for (const type of ['single', 'multi', 'numeric']) {
    const pos = paper.questions.findIndex((q) => inferType(q) === type)
    const q = paper.questions[pos]
    await jumpTo(page, pos + 1)
    await answerCorrectly(page, q)
    await page.getByRole('button', { name: 'Save & Next' }).click()
    score += q.marks
  }
  const max = paper.questions.reduce((a, q) => a + q.marks, 0)

  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page).toHaveURL(/#\/results\/[^/]+$/)

  const expectedScore = `${fmt(score)} / ${fmt(max)}`
  await expect(page.getByTestId('results-score')).toHaveText(expectedScore)
  await expect(page.getByTestId('results-correct')).toHaveText('3')
  await expect(page.getByTestId('results-wrong')).toHaveText('0')
  await expect(page.getByTestId('results-unattempted')).toHaveText(String(paper.questions.length - 3))

  // Reload: the screen renders only after the resume dialog decides, so seeing
  // the same score proves the stored record drove it and no in-progress attempt
  // was resurrected by the player's unmount write.
  await page.reload()
  await expect(page.getByTestId('results-score')).toHaveText(expectedScore)
})
