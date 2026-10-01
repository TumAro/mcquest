import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_SETTINGS } from '../src/storage.ts'
import { startConfig, randomStart } from '../src/start.ts'

const index = JSON.parse(readFileSync('public/data/index.json', 'utf8'))
const all = index.exams.flatMap((e) => e.years.flatMap((y) => y.questions))
const qs = all.slice(0, 2)
const settings = { ...DEFAULT_SETTINGS, paperMinutes: 77, drillMinutes: null }

test('a paper gets the paper minutes, exam mode and its exam and year', () => {
  const c = startConfig(settings, 'year-wise', qs, { exam: 'e', year: 1999 })
  assert.equal(c.timedMinutes, 77)
  assert.equal(c.revealMode, 'onSubmit')
  assert.equal(c.exam, 'e')
  assert.equal(c.year, 1999)
  assert.equal(c.mode, 'year-wise')
  assert.equal(c.questions, qs)
})

test('every other mode gets the drill minutes and the feedback setting', () => {
  for (const mode of ['random', 'subject-wise', 'bookmarked']) {
    const c = startConfig(settings, mode, qs)
    assert.equal(c.timedMinutes, null)
    assert.equal(c.revealMode, 'immediate')
    assert.equal(startConfig({ ...settings, drillMinutes: 5 }, mode, qs).timedMinutes, 5)
    assert.equal(startConfig({ ...settings, drillFeedback: false }, mode, qs).revealMode, 'onSubmit')
  }
})

test('randomStart draws at most questionCount questions from the index', () => {
  const ids = new Set(all.map((q) => q.id))
  const c = randomStart(index, { ...settings, questionCount: 3 })
  assert.equal(c.mode, 'random')
  assert.equal(c.questions.length, Math.min(3, all.length))
  assert.ok(c.questions.every((q) => ids.has(q.id)))
})

test('randomStart returns null for an index with no questions', () => {
  assert.equal(randomStart({ topics: index.topics, exams: [] }, settings), null)
})
