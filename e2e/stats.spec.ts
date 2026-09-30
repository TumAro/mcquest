import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { inferType } from '../scripts/lib/rules.mjs'

/**
 * STAT-01/02 — the weak-topics page. Drives the real UI. Nothing here names an
 * exam, a year, a topic or a question count: the paper is chosen from
 * /data/index.json at runtime and every expectation comes from the paper's data.
 */

interface PaperQuestion {
  id: string
  topic: string
  correct?: number[]
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

/** First paper that has a single-correct question. */
async function pickPaper(request: APIRequestContext): Promise<LoadedPaper> {
  const hit = (await loadPapers(request)).find((p) => p.questions.some((q) => inferType(q) === 'single'))
  if (!hit) throw new Error('No paper in public/data has a single-correct question; the stats spec needs one.')
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

/** Check the first option that is not in the answer key. */
async function answerWrongSingle(page: Page, q: PaperQuestion) {
  const wrong = q.options!.findIndex((_, i) => !q.correct!.includes(i))
  await page.locator('.question-pane-option input').nth(wrong).check()
}

/** Sit one paper: answer its first single question wrongly, submit, land on results. */
async function submitOneWrong(page: Page, paper: LoadedPaper): Promise<PaperQuestion> {
  const pos = paper.questions.findIndex((q) => inferType(q) === 'single')
  const q = paper.questions[pos]
  await startPaper(page, paper.slug, paper.year)
  await jumpTo(page, pos + 1)
  await answerWrongSingle(page, q)
  await page.getByRole('button', { name: 'Save & Next' }).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page).toHaveURL(/#\/results\/[^/]+$/)
  return q
}

test('a submitted test appears on the stats page, joined to its topic', async ({ page, request }) => {
  const paper = await pickPaper(request)
  const q = await submitOneWrong(page, paper)

  await page.goto('/#/stats')
  const rows = page.locator('tr[data-topic]')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toHaveAttribute('data-topic', q.topic)
  await expect(rows.first().getByTestId('stat-attempts')).toHaveText('1')
  await expect(rows.first().getByTestId('stat-accuracy')).toHaveText('0%')
})
