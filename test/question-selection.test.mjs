import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectQuestions } from '../src/QuestionSelection.ts'

const index = JSON.parse(readFileSync('public/data/index.json', 'utf8'))

// Slugs and counts come from the live bank, so these tests survive papers
// being added or topics.json being rewritten.
const pool = index.exams.flatMap((e) => e.years.flatMap((y) => y.questions))
const countOf = (slug) => pool.filter((q) => q.topic === slug).length
const [a, b, c] = [...new Set(pool.map((q) => q.topic))]

test('selectQuestions: get questions from a single topic, warning when the pool is short', () => {
  const asked = countOf(a) + 1
  const result = selectQuestions(index, [a], asked)
  assert.equal(result.questions.length, countOf(a))
  assert.ok(result.questions.every((q) => q.topic === a))
  assert.ok(result.warnings.length > 0, 'Should warn about pool size')
})

test('selectQuestions: all questions have correct topic', () => {
  const result = selectQuestions(index, [a, b], 10)
  const validTopics = new Set([a, b])
  assert.ok(result.questions.every((q) => validTopics.has(q.topic)))
})

test('selectQuestions: unknown topic returns empty with warning', () => {
  const result = selectQuestions(index, ['unknown-topic'], 3)
  assert.equal(result.questions.length, 0)
  assert.ok(result.warnings.length > 0)
})

test('selectQuestions: zero count returns empty', () => {
  const result = selectQuestions(index, [a], 0)
  assert.equal(result.questions.length, 0)
})

test('selectQuestions: mixed topics get shuffled', () => {
  const result = selectQuestions(index, [a, b, c], 10)
  const validTopics = new Set([a, b, c])
  assert.ok(result.questions.every((q) => validTopics.has(q.topic)))
  assert.ok(result.questions.length > 0, 'Should find questions from multiple topics')
})

test('selectQuestions: requesting more than available warns', () => {
  const asked = pool.length + 1
  const result = selectQuestions(index, [a], asked)
  assert.ok(result.warnings.length > 0)
  assert.ok(result.warnings.some((w) => w.includes(`Asked for ${asked}`)))
})

test('selectQuestions: no topics selected returns empty with warning', () => {
  const result = selectQuestions(index, [], 5)
  assert.equal(result.questions.length, 0)
  assert.ok(result.warnings.length > 0)
  assert.ok(result.warnings.some((w) => w.includes('No topics selected')))
})

test('selectQuestions: results have id, topic, type', () => {
  const result = selectQuestions(index, [a, b], 5)
  for (const q of result.questions) {
    assert.ok(q.id, 'should have id')
    assert.ok(q.topic, 'should have topic')
    assert.ok(q.type, 'should have type')
  }
})
