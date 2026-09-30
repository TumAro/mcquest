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

async function startPaper(
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
  const answeredPerTopic = new Map<string, number>()
  for (const type of ['single', 'multi', 'numeric']) {
    const pos = paper.questions.findIndex((q) => inferType(q) === type)
    const q = paper.questions[pos]
    await jumpTo(page, pos + 1)
    await answerCorrectly(page, q)
    await page.getByRole('button', { name: 'Save & Next' }).click()
    score += q.marks
    answeredPerTopic.set(q.topic, (answeredPerTopic.get(q.topic) ?? 0) + 1)
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

  // The paper was started year-wise, so the section-total note must be on screen.
  await expect(page.getByTestId('results-scope-note')).toBeVisible()

  // Per-topic table: one row per distinct topic in the paper, this attempt only.
  const topics = [...new Set(paper.questions.map((q) => q.topic))]
  await expect(page.locator('tr[data-topic]')).toHaveCount(topics.length)
  for (const topic of topics) {
    const row = page.locator(`tr[data-topic="${topic}"]`)
    const answered = answeredPerTopic.get(topic)
    if (answered) {
      await expect(row.getByTestId('topic-correct')).toHaveText(String(answered))
      await expect(row.getByTestId('topic-accuracy')).toHaveText('100%')
    } else {
      await expect(row.getByTestId('topic-accuracy')).toHaveText('\u2014')
    }
  }

  // Reload: the screen renders only after the resume dialog decides, so seeing
  // the same score proves the stored record drove it and no in-progress attempt
  // was resurrected by the player's unmount write.
  await page.reload()
  await expect(page.getByTestId('results-score')).toHaveText(expectedScore)
})

test('a resumed year-wise attempt keeps its mode through to the results screen', async ({ page, request }) => {
  const paper = await pickPaper(request)
  await startPaper(page, paper.slug, paper.year)

  await answerCorrectly(page, paper.questions[0])
  await page.waitForTimeout(1500) // let the 1s save cadence flush

  await page.reload()
  await expect(page.getByRole('heading', { name: /resume attempt/i })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /^resume$/i }).click()

  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'Question 1, answered', exact: true })).toBeVisible()

  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page).toHaveURL(/#\/results\//)
  await expect(page.getByTestId('results-scope-note')).toBeVisible()
})

test('a resumed practice-mode attempt is still practice mode (revealMode survives resume)', async ({ page, request }) => {
  const paper = await pickPaper(request)
  await startPaper(page, paper.slug, paper.year, { practice: true })

  await answerCorrectly(page, paper.questions[0])
  await page.getByRole('button', { name: 'Save & Next' }).click()
  await page.waitForTimeout(1500) // let the 1s save cadence flush

  await page.reload()
  await expect(page.getByRole('heading', { name: /resume attempt/i })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: /^resume$/i }).click()
  await expect(page.getByRole('button', { name: 'Save & Next' })).toBeVisible({ timeout: 15000 })

  // Feedback appears only in practice mode, and only if the mode survived the resume.
  await answerCorrectly(page, paper.questions[1])
  await page.getByRole('button', { name: 'Save & Next' }).click()
  await expect(page.getByRole('button', { name: 'Question 2, answered, correct', exact: true })).toBeVisible()
})

test('timer auto-submit saves the attempt and lands on the results screen', async ({ page, request }) => {
  const paper = await pickPaper(request)
  // Fake clock: a real test would wait out the shortest timer the UI allows, a whole minute.
  await page.clock.install()
  await startPaper(page, paper.slug, paper.year, { minutes: 1 })

  const q = paper.questions[0]
  await answerCorrectly(page, q)
  await page.getByRole('button', { name: 'Save & Next' }).click()

  page.once('dialog', (d) => d.accept())
  await page.clock.fastForward('01:05')
  await expect(page).toHaveURL(/#\/results\/[^/]+$/, { timeout: 15000 })

  const max = paper.questions.reduce((a, x) => a + x.marks, 0)
  const expectedScore = `${fmt(q.marks)} / ${fmt(max)}`
  await expect(page.getByTestId('results-score')).toHaveText(expectedScore)
  await expect(page.getByTestId('results-correct')).toHaveText('1')

  // The record is stored and the in-progress attempt is gone: a reload shows the
  // same score rather than the resume dialog.
  await page.reload()
  await expect(page.getByTestId('results-score')).toHaveText(expectedScore)
})
