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
  // One attempt is under the threshold, so the row sits in the unranked table, which has no accuracy column.
  await expect(page.getByTestId('insufficient-table').locator('tr[data-topic]')).toHaveCount(1)
})

interface SeedIndex {
  exams: { slug: string; years: { questions: { id: string; topic: string }[] }[] }[]
}

/** Topic slug -> its first question id, for topics that have at least one question, sorted by slug. */
function topicsWithQuestions(index: SeedIndex): [string, string][] {
  const first = new Map<string, string>()
  for (const exam of index.exams)
    for (const y of exam.years) for (const q of y.questions) if (!first.has(q.topic)) first.set(q.topic, q.id)
  return [...first.entries()].sort(([a], [b]) => a.localeCompare(b))
}

/**
 * Write submitted attempts straight into idb-keyval's default store. Attempt j
 * holds, for every topic with a j-th outcome, that topic's first question answered
 * with that outcome. The store only exists once the app has opened it, so load the
 * front page first.
 */
async function seedHistory(
  page: Page,
  index: SeedIndex,
  outcomes: Record<string, ('correct' | 'wrong')[]>,
) {
  const firstId = new Map(topicsWithQuestions(index))
  const exam = index.exams[0].slug
  const rounds = Math.max(...Object.values(outcomes).map((o) => o.length))
  const attempts = []
  for (let j = 0; j < rounds; j++) {
    const questions = Object.entries(outcomes)
      .filter(([, o]) => o[j] !== undefined)
      .map(([topic, o]) => ({
        id: firstId.get(topic)!,
        response: null,
        correctness: o[j],
        marks: o[j] === 'correct' ? 1 : 0,
        timeSpent: 1,
      }))
    const correct = questions.filter((q) => q.correctness === 'correct').length
    attempts.push({
      id: `seed-${j}`,
      timestamp: 1_000_000 + j,
      exam,
      mode: 'random',
      timedMinutes: null,
      revealMode: 'immediate',
      score: correct,
      max: questions.length,
      correct,
      wrong: questions.length - correct,
      unattempted: 0,
      questions,
    })
  }
  await page.goto('/#/')
  await expect(page.locator('.mode-list')).toBeVisible()
  await page.evaluate(
    (records) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('keyval-store')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const tx = open.result.transaction('keyval', 'readwrite')
          for (const r of records) tx.objectStore('keyval').put(r, `attempt:${r.id}`)
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        }
      }),
    attempts,
  )
}

test('topics are ranked worst first and a topic under the threshold is listed separately', async ({ page, request }) => {
  const index: SeedIndex = await (await request.get('/data/index.json')).json()
  const slugs = topicsWithQuestions(index).map(([slug]) => slug)
  if (slugs.length < 4) throw new Error('Need at least 4 topics with questions in public/data to test ranking.')
  const m = slugs.length - 1
  const outcomes: Record<string, ('correct' | 'wrong')[]> = {}
  for (let i = 0; i < m; i++) {
    outcomes[slugs[i]] = Array.from({ length: m }, (_, k) => (k < i ? 'correct' : 'wrong'))
  }
  const thin = slugs[m]
  // Two attempts: under the locked threshold of 3 (D-02), a literal on purpose.
  outcomes[thin] = ['wrong', 'wrong']

  await seedHistory(page, index, outcomes)
  await page.goto('/#/stats')

  const ranked = page.getByTestId('ranked-table').locator('tr[data-topic]')
  await expect(ranked).toHaveCount(m)
  expect(await ranked.evaluateAll((rs) => rs.map((r) => r.getAttribute('data-topic')))).toEqual(slugs.slice(0, m))
  await expect(ranked.first().getByTestId('stat-accuracy')).toHaveText('0%')
  for (const attempts of await ranked.getByTestId('stat-attempts').allTextContents()) expect(attempts).toBe(String(m))

  const insufficient = page.getByTestId('insufficient-table').locator('tr[data-topic]')
  await expect(insufficient).toHaveCount(1)
  await expect(insufficient.first()).toHaveAttribute('data-topic', thin)
  await expect(insufficient.first().getByTestId('stat-attempts')).toHaveText('2')
  await expect(page.getByTestId('ranked-table').locator(`tr[data-topic="${thin}"]`)).toHaveCount(0)
})

test('the front page leads to a stats page that says so when there is no history', async ({ page }) => {
  await page.goto('/#/')
  await page.getByRole('link', { name: /weak topics/i }).click()
  await expect(page).toHaveURL(/#\/stats$/)
  await expect(page.getByTestId('stats-empty')).toBeVisible()
  await expect(page.locator('tr[data-topic]')).toHaveCount(0)
  await expect(page.locator('table')).toHaveCount(0)
})

test('after one test every topic is under the threshold and the page explains it', async ({ page, request }) => {
  await submitOneWrong(page, await pickPaper(request))

  await page.goto('/#/')
  await page.getByRole('link', { name: /weak topics/i }).click()
  await expect(page.getByTestId('stats-thin')).toBeVisible()
  await expect(page.getByTestId('ranked-table')).toHaveCount(0)
  await expect(page.getByTestId('insufficient-table')).toHaveCount(1)
  const rows = page.getByTestId('insufficient-table').locator('tr[data-topic]')
  await expect(rows).toHaveCount(1)
  await expect(rows.first().getByTestId('stat-attempts')).toHaveText('1')
  await expect(page.getByTestId('stats-tests')).toHaveText(/1 submitted test/)
})
