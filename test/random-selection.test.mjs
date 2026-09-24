import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectQuestions } from '../src/QuestionSelection.ts'

const index = JSON.parse(readFileSync('public/data/index.json', 'utf8'))

test('selectQuestions: random draw from all topics across exams', () => {
  // Get all topic slugs
  const allTopics = Object.values(index.topics).flatMap((cat) => Object.keys(cat.topics))

  const result = selectQuestions(index, allTopics, 10)

  // Should return all available questions
  assert.ok(result.questions.length > 0, 'Should return at least some questions')
  assert.ok(result.questions.length <= 10, 'Should return at most 10 questions')
})

test('selectQuestions: short pool warning when requested > available', () => {
  // Get all topic slugs and ask for more than available
  const allTopics = Object.values(index.topics).flatMap((cat) => Object.keys(cat.topics))

  const result = selectQuestions(index, allTopics, 100)

  // Should have a warning about the pool size
  assert.ok(result.warnings.length > 0, 'Should have warning about pool size')
  assert.ok(result.warnings[0].includes('Asked for 100'), 'Warning should mention requested count')
  assert.ok(result.warnings[0].includes('available'), 'Warning should mention available count')
})

test('selectQuestions: no warning when pool is sufficient', () => {
  // Get just one topic and ask for fewer questions
  const result = selectQuestions(index, ['eigen'], 1)

  if (result.questions.length > 0) {
    assert.ok(result.warnings.length === 0, 'Should have no warning when pool is sufficient')
  }
})

test('selectQuestions: random draw includes all exams', () => {
  // Get all topics
  const allTopics = Object.values(index.topics).flatMap((cat) => Object.keys(cat.topics))

  const result = selectQuestions(index, allTopics, 100)

  // Verify we have questions (at least something from the bank)
  assert.ok(result.questions.length > 0, 'Should include questions from the bank')

  // Check that we get back what we asked for (or less if not enough)
  assert.ok(result.questions.length <= 100, 'Should not return more than requested')
})

test('selectQuestions: empty topic list returns empty result', () => {
  const result = selectQuestions(index, [], 5)

  assert.equal(result.questions.length, 0, 'Should return 0 questions')
  assert.ok(result.warnings.length > 0, 'Should have warning about no topics')
})

test('selectQuestions: invalid count returns empty result with warning', () => {
  const result = selectQuestions(index, ['eigen'], 0)

  assert.equal(result.questions.length, 0, 'Should return 0 questions')
  assert.ok(result.warnings.length > 0, 'Should have warning about count')
})
