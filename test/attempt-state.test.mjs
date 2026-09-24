import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isAnswered, bubbleState } from '../src/attempt-state.ts'
import { scoreQuestion } from '../scripts/lib/marking.mjs'

const cfg = JSON.parse(readFileSync('exams.json', 'utf8'))

const optionQuestion = {
  id: 'q-opt',
  exam: 'SAMPLE',
  marks: 1,
  question: 'Test option q',
  options: ['A', 'B', 'C', 'D'],
  correct: [0],
  type: 'single'
}

const numericQuestion = {
  id: 'q-num',
  exam: 'SAMPLE',
  marks: 1,
  question: 'Test numeric q',
  answer: { min: 0, max: 10 },
  type: 'numeric'
}

test('isAnswered: null on option question is not answered', () => {
  const response = null
  assert.equal(isAnswered(response), scoreQuestion(cfg, optionQuestion, response).status !== 'unattempted')
  assert.equal(isAnswered(response), false)
})

test('isAnswered: undefined on option question is not answered', () => {
  const response = undefined
  assert.equal(isAnswered(response), scoreQuestion(cfg, optionQuestion, response).status !== 'unattempted')
  assert.equal(isAnswered(response), false)
})

test('isAnswered: [] on option question is not answered', () => {
  const response = []
  assert.equal(isAnswered(response), scoreQuestion(cfg, optionQuestion, response).status !== 'unattempted')
  assert.equal(isAnswered(response), false)
})

test('isAnswered: [0] on option question is answered', () => {
  const response = [0]
  assert.equal(isAnswered(response), scoreQuestion(cfg, optionQuestion, response).status !== 'unattempted')
  assert.equal(isAnswered(response), true)
})

test('isAnswered: [1, 2] on option question is answered', () => {
  const response = [1, 2]
  assert.equal(isAnswered(response), scoreQuestion(cfg, optionQuestion, response).status !== 'unattempted')
  assert.equal(isAnswered(response), true)
})

test('isAnswered: null on numeric question is not answered', () => {
  const response = null
  assert.equal(isAnswered(response), scoreQuestion(cfg, numericQuestion, response).status !== 'unattempted')
  assert.equal(isAnswered(response), false)
})

test('isAnswered: 0 on numeric question is answered', () => {
  const response = 0
  assert.equal(isAnswered(response), scoreQuestion(cfg, numericQuestion, response).status !== 'unattempted')
  assert.equal(isAnswered(response), true)
})

test('isAnswered: 2.5 on numeric question is answered', () => {
  const response = 2.5
  assert.equal(isAnswered(response), scoreQuestion(cfg, numericQuestion, response).status !== 'unattempted')
  assert.equal(isAnswered(response), true)
})

test('bubbleState: (null, false, false) returns unvisited', () => {
  assert.equal(bubbleState(null, false, false), 'unvisited')
})

test('bubbleState: (null, false, true) returns visited', () => {
  assert.equal(bubbleState(null, false, true), 'visited')
})

test('bubbleState: ([], false, true) returns visited', () => {
  assert.equal(bubbleState([], false, true), 'visited')
})

test('bubbleState: ([1], false, true) returns answered', () => {
  assert.equal(bubbleState([1], false, true), 'answered')
})

test('bubbleState: (0, false, true) returns answered', () => {
  assert.equal(bubbleState(0, false, true), 'answered')
})

test('bubbleState: (2.5, false, true) returns answered', () => {
  assert.equal(bubbleState(2.5, false, true), 'answered')
})

test('bubbleState: (null, true, true) returns marked', () => {
  assert.equal(bubbleState(null, true, true), 'marked')
})

test('bubbleState: ([], true, true) returns marked', () => {
  assert.equal(bubbleState([], true, true), 'marked')
})

test('bubbleState: (null, true, false) returns marked', () => {
  assert.equal(bubbleState(null, true, false), 'marked')
})

test('bubbleState: ([1], true, true) returns answered-marked', () => {
  assert.equal(bubbleState([1], true, true), 'answered-marked')
})

test('bubbleState: (0, true, true) returns answered-marked', () => {
  assert.equal(bubbleState(0, true, true), 'answered-marked')
})

test('bubbleState: exactly five distinct states exist', () => {
  const cases = [
    [null, false, false],
    [null, false, true],
    [[], false, true],
    [[1], false, true],
    [0, false, true],
    [2.5, false, true],
    [null, true, true],
    [[], true, true],
    [null, true, false],
    [[1], true, true],
    [0, true, true],
  ]
  const seen = new Set()
  for (const [r, m, v] of cases) {
    seen.add(bubbleState(r, m, v))
  }
  assert.equal(seen.size, 5, `Expected 5 distinct states, got ${seen.size}: ${[...seen].join(', ')}`)
  const expected = new Set(['unvisited', 'visited', 'answered', 'marked', 'answered-marked'])
  for (const state of seen) {
    assert.ok(expected.has(state), `Unexpected state: ${state}`)
  }
})
