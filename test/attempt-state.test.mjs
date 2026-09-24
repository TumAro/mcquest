import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isAnswered } from '../src/attempt-state.ts'
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
