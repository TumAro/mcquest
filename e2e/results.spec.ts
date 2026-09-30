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

/** Check the first option that is not in the answer key. Returns its index. */
async function answerWrongSingle(page: Page, q: PaperQuestion): Promise<number> {
  const wrong = q.options!.findIndex((_, i) => !q.correct!.includes(i))
  await page.locator('.question-pane-option input').nth(wrong).check()
  return wrong
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

test('review pairs each response with the answer key for every question', async ({ page, request }) => {
  const paper = await pickPaper(request)
  await startPaper(page, paper.slug, paper.year)

  const withNote = (t: string) =>
    paper.questions.find((q) => inferType(q) === t && q.note) ?? paper.questions.find((q) => inferType(q) === t)!
  const single = withNote('single')
  const numeric = withNote('numeric')

  await jumpTo(page, paper.questions.indexOf(single) + 1)
  const wrongIdx = await answerWrongSingle(page, single)
  await page.getByRole('button', { name: 'Save & Next' }).click()

  await jumpTo(page, paper.questions.indexOf(numeric) + 1)
  await answerCorrectly(page, numeric)
  await page.getByRole('button', { name: 'Save & Next' }).click()

  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page).toHaveURL(/#\/results\/[^/]+$/)

  await expect(page.locator('[data-question-id]')).toHaveCount(paper.questions.length)

  const wrongItem = page.locator(`[data-question-id="${single.id}"]`)
  const options = wrongItem.locator('.question-pane-option')
  await expect(options.nth(wrongIdx)).toContainText('Your answer')
  await expect(options.nth(wrongIdx)).not.toContainText('Correct answer')
  await expect(options.nth(single.correct![0])).toContainText('Correct answer')
  await expect(options.nth(single.correct![0])).not.toContainText('Your answer')

  const numItem = page.locator(`[data-question-id="${numeric.id}"]`)
  const { min, max } = numeric.answer!
  await expect(numItem.locator('input[type="number"]')).toHaveValue(String((min + max) / 2))
  await expect(numItem.locator('.numeric-key')).toContainText(String(min))

  // D-04: the solution is open for the wrong answer, collapsed-but-available for the right one.
  await expect(wrongItem.locator('.review-status')).toHaveText(/Wrong$/)
  if (single.note) expect(await wrongItem.locator('details').evaluate((d: HTMLDetailsElement) => d.open)).toBe(true)

  await expect(numItem.locator('.review-status')).toHaveText(/Correct$/)
  await expect(numItem.locator('.review-marks')).toHaveText(`+${fmt(numeric.marks)}`)
  if (numeric.note) {
    const details = numItem.locator('details')
    expect(await details.evaluate((d: HTMLDetailsElement) => d.open)).toBe(false)
    await details.locator('summary').click()
    expect(await details.evaluate((d: HTMLDetailsElement) => d.open)).toBe(true)
  }
})

test('bookmarks persist across reloads and attempts and are independent of mark-for-review', async ({ page, request }) => {
  const paper = await pickPaper(request)
  const bookmark = () => page.getByRole('button', { name: /^bookmark/i })
  const markedBubble = (n: number) => page.getByRole('button', { name: new RegExp(`^Question ${n},.*marked`) })

  await startPaper(page, paper.slug, paper.year)
  await bookmark().click()
  await expect(bookmark()).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Save & Next' }).click()
  await expect(bookmark()).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Mark for Review & Next' }).click()

  // Marking question 2 did not bookmark it.
  await jumpTo(page, 2)
  await expect(markedBubble(2)).toHaveCount(1)
  await expect(bookmark()).toHaveAttribute('aria-pressed', 'false')

  // Bookmarking question 1 did not mark it.
  await jumpTo(page, 1)
  await expect(bookmark()).toHaveAttribute('aria-pressed', 'true')
  await expect(markedBubble(1)).toHaveCount(0)

  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page).toHaveURL(/#\/results\/[^/]+$/)

  const first = page.locator(`[data-question-id="${paper.questions[0].id}"]`)
  const third = page.locator(`[data-question-id="${paper.questions[2].id}"]`)
  const pressed = (item: typeof first) => item.getByRole('button', { name: /^bookmark/i })

  // A bookmark made inside the test shows in the review; add another from the review.
  await expect(pressed(first)).toHaveAttribute('aria-pressed', 'true')
  await expect(pressed(third)).toHaveAttribute('aria-pressed', 'false')
  await pressed(third).click()
  await expect(pressed(third)).toHaveAttribute('aria-pressed', 'true')

  // Persisted in storage, read back on load.
  await page.reload()
  await expect(first).toBeVisible()
  await expect(pressed(first)).toHaveAttribute('aria-pressed', 'true')
  await expect(pressed(third)).toHaveAttribute('aria-pressed', 'true')

  // Survives into a later attempt; mark-for-review did not.
  await startPaper(page, paper.slug, paper.year)
  await expect(bookmark()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: /^Question \d+,.*marked/ })).toHaveCount(0)
})

test('Bookmarked mode builds a test from exactly the bookmarked questions', async ({ page, request }) => {
  const paper = await pickPaper(request)
  const bookmark = () => page.getByRole('button', { name: /^bookmark/i })
  const first = (t: string) => paper.questions.findIndex((q) => inferType(q) === t)

  await startPaper(page, paper.slug, paper.year)
  for (const t of ['single', 'numeric']) {
    await jumpTo(page, first(t) + 1)
    await bookmark().click()
    await expect(bookmark()).toHaveAttribute('aria-pressed', 'true')
  }
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page).toHaveURL(/#\/results\/[^/]+$/)

  // Third bookmark comes from the review, not the test.
  const multi = page.locator(`[data-question-id="${paper.questions[first('multi')].id}"]`)
  await multi.getByRole('button', { name: /^bookmark/i }).click()
  await expect(multi.getByRole('button', { name: /^bookmark/i })).toHaveAttribute('aria-pressed', 'true')

  await page.goto('/#/')
  await page.getByRole('link', { name: /bookmarked/i }).click()
  await expect(page.getByTestId('bookmarked-count')).toHaveText(/^3 /)
  await page.getByRole('button', { name: 'Start Test' }).click()

  await expect(page.locator('.player-progress')).toHaveText(/Question 1 of 3/, { timeout: 15000 })
  await expect(page.locator('.palette-bubble')).toHaveCount(3)
  for (let n = 1; n <= 3; n++) {
    await jumpTo(page, n)
    await expect(bookmark()).toHaveAttribute('aria-pressed', 'true')
  }

  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page).toHaveURL(/#\/results\/[^/]+$/)
  await expect(page.locator('.results-title')).toHaveText(/bookmarked/i)
  await expect(page.getByTestId('results-score')).toBeVisible()
  await expect(page.getByTestId('results-scope-note')).toHaveCount(0)
})

test('Bookmarked mode shows an empty state when nothing is bookmarked', async ({ page }) => {
  await page.goto('/#/test/bookmarked')
  await expect(page.getByText(/no bookmarks yet/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start Test' })).toHaveCount(0)
})
