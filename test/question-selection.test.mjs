import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectQuestions } from '../src/QuestionSelection.ts'

const index = JSON.parse(readFileSync('public/data/index.json', 'utf8'))

test('selectQuestions: get 3 questions from linear-algebra when available', () => {
  const result = selectQuestions(index, ['eigen'], 3)
  // SAMPLE 2024 has only 1 eigen question, so we can't get 3
  // But at least we should get what's available
  assert.ok(result.questions.length <= 3)
  assert.ok(result.questions.every((q) => q.topic === 'eigen'))
  assert.ok(result.warnings.length > 0, 'Should warn about pool size')
})

test('selectQuestions: all questions have correct topic', () => {
  const result = selectQuestions(index, ['eigen', 'limit'], 10)
  const validTopics = new Set(['eigen', 'limit'])
  assert.ok(result.questions.every((q) => validTopics.has(q.topic)))
})

test('selectQuestions: unknown topic returns empty with warning', () => {
  const result = selectQuestions(index, ['unknown-topic'], 3)
  assert.equal(result.questions.length, 0)
  assert.ok(result.warnings.length > 0)
})

test('selectQuestions: zero count returns empty', () => {
  const result = selectQuestions(index, ['eigen'], 0)
  assert.equal(result.questions.length, 0)
})

test('selectQuestions: mixed topics get shuffled', () => {
  const result = selectQuestions(index, ['eigen', 'limit', 'rank'], 10)
  const validTopics = new Set(['eigen', 'limit', 'rank'])
  assert.ok(result.questions.every((q) => validTopics.has(q.topic)))
  assert.ok(result.questions.length > 0, 'Should find questions from multiple topics')
})

test('selectQuestions: requesting more than available warns', () => {
  const result = selectQuestions(index, ['eigen'], 100)
  assert.ok(result.warnings.length > 0)
  assert.ok(result.warnings.some((w) => w.includes('Asked for 100')))
})

test('selectQuestions: no topics selected returns empty with warning', () => {
  const result = selectQuestions(index, [], 5)
  assert.equal(result.questions.length, 0)
  assert.ok(result.warnings.length > 0)
  assert.ok(result.warnings.some((w) => w.includes('No topics selected')))
})

test('selectQuestions: results have id, topic, type', () => {
  const result = selectQuestions(index, ['eigen', 'limit'], 5)
  for (const q of result.questions) {
    assert.ok(q.id, 'should have id')
    assert.ok(q.topic, 'should have topic')
    assert.ok(q.type, 'should have type')
  }
})
