// Tests for parseNumeric: string-to-number parsing for the numeric response field.
// Critical contract: an empty box must never become a scoring 0.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseNumeric } from '../src/numeric.ts'
import { scoreQuestion } from '../scripts/lib/marking.mjs'

test('parseNumeric: empty string returns null', () => {
  assert.strictEqual(parseNumeric(''), null)
})

test('parseNumeric: whitespace-only string returns null', () => {
  assert.strictEqual(parseNumeric('   '), null)
})

test('parseNumeric: non-numeric string returns null', () => {
  assert.strictEqual(parseNumeric('abc'), null)
})

test('parseNumeric: lone minus sign returns null', () => {
  assert.strictEqual(parseNumeric('-'), null)
})

test('parseNumeric: lone decimal point returns null', () => {
  assert.strictEqual(parseNumeric('.'), null)
})

test('parseNumeric: trailing decimal point is accepted', () => {
  assert.strictEqual(parseNumeric('2.'), 2)
})

test('parseNumeric: negative number is parsed', () => {
  assert.strictEqual(parseNumeric('-3'), -3)
})

test('parseNumeric: decimal number is parsed', () => {
  assert.strictEqual(parseNumeric('2.5'), 2.5)
})

test('parseNumeric: leading and trailing whitespace is trimmed', () => {
  assert.strictEqual(parseNumeric(' 2.5 '), 2.5)
})

test('parseNumeric: zero is returned as a number, not null', () => {
  const result = parseNumeric('0')
  assert.strictEqual(result, 0)
  assert.ok(Object.is(result, 0), 'result must be 0, not any falsy value')
})

test('parseNumeric: scientific notation is parsed', () => {
  assert.strictEqual(parseNumeric('1e3'), 1000)
})

test('parseNumeric: Infinity returns null', () => {
  assert.strictEqual(parseNumeric('Infinity'), null)
})

test('parseNumeric: NaN returns null', () => {
  assert.strictEqual(parseNumeric('NaN'), null)
})

// Critical contract test: the bug this function prevents.
// On a numeric question whose answer range straddles zero, an empty box
// must score as unattempted, not as a correct answer.
test('parseNumeric contract: empty box is unattempted, typed zero is correct on a question with answer near zero', () => {
  const question = {
    id: 'test-near-zero',
    topic: 'test',
    marks: 1,
    question: 'What is the value?',
    answer: { min: -0.01, max: 0.01 },
  }

  // Empty box response (the dangerous case)
  const emptyResponse = parseNumeric('')
  const emptyScore = scoreQuestion({}, question, emptyResponse)
  assert.equal(emptyScore.status, 'unattempted', 'empty box must not score marks')

  // Typed zero response (the correct case)
  const zeroResponse = parseNumeric('0')
  const zeroScore = scoreQuestion({}, question, zeroResponse)
  assert.equal(zeroScore.status, 'correct', 'typed zero must score as correct')
})
