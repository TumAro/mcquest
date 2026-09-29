import test from 'node:test'
import assert from 'node:assert/strict'
import {
  serializeInProgressAttempt,
  deserializeInProgressAttempt,
  serializeSubmittedAttempt,
  deserializeSubmittedAttempt,
} from '../src/storage.ts'

test('Test 1: serialize and deserialize in-progress attempt — all fields survive with correct types', () => {
  const original = {
    current: 2,
    responses: {
      'q1': [0],
      'q2': 5,
      'q3': null,
    },
    marked: {
      'q1': true,
      'q2': false,
    },
    visited: {
      'q1': true,
      'q2': true,
      'q3': false,
    },
    remaining: 45000,
    revealMode: 'immediate',
    questionIds: ['q1', 'q2', 'q3'],
  }

  // Serialize should return the same shape
  const serialized = serializeInProgressAttempt(original)
  assert.deepEqual(serialized, original)

  // Deserialize should restore everything correctly
  const deserialized = deserializeInProgressAttempt(serialized)
  assert.deepEqual(deserialized, original)

  // Verify types are preserved
  assert.equal(typeof deserialized.current, 'number')
  assert.equal(typeof deserialized.responses, 'object')
  assert.equal(typeof deserialized.marked, 'object')
  assert.equal(typeof deserialized.visited, 'object')
  assert.equal(typeof deserialized.remaining, 'number')
  assert.equal(typeof deserialized.revealMode, 'string')
  assert.ok(Array.isArray(deserialized.questionIds))
})

test('Test 2: deserialize rejects malformed input — returns null for each invalid case', () => {
  // Missing current
  let malformed = {
    responses: {},
    marked: {},
    visited: {},
    remaining: 1000,
    revealMode: 'immediate',
    questionIds: [],
  }
  assert.equal(deserializeInProgressAttempt(malformed), null)

  // current is not a number
  malformed = {
    current: 'not a number',
    responses: {},
    marked: {},
    visited: {},
    remaining: 1000,
    revealMode: 'immediate',
    questionIds: [],
  }
  assert.equal(deserializeInProgressAttempt(malformed), null)

  // Missing responses object
  malformed = {
    current: 0,
    marked: {},
    visited: {},
    remaining: 1000,
    revealMode: 'immediate',
    questionIds: [],
  }
  assert.equal(deserializeInProgressAttempt(malformed), null)

  // Invalid revealMode
  malformed = {
    current: 0,
    responses: {},
    marked: {},
    visited: {},
    remaining: 1000,
    revealMode: 'invalid-mode',
    questionIds: [],
  }
  assert.equal(deserializeInProgressAttempt(malformed), null)

  // questionIds is not an array
  malformed = {
    current: 0,
    responses: {},
    marked: {},
    visited: {},
    remaining: 1000,
    revealMode: 'immediate',
    questionIds: 'not-an-array',
  }
  assert.equal(deserializeInProgressAttempt(malformed), null)

  // null input
  assert.equal(deserializeInProgressAttempt(null), null)

  // undefined input
  assert.equal(deserializeInProgressAttempt(undefined), null)

  // non-object input
  assert.equal(deserializeInProgressAttempt('string'), null)
})

test('Test 3: serialize and deserialize submitted attempt — all per-question fields present and correct', () => {
  const original = {
    id: 'attempt-123',
    questionAttempts: [
      {
        id: 'q1',
        response: [0],
        correctness: 'correct',
        marks: 1,
        timeSpent: 23.5,
      },
      {
        id: 'q2',
        response: 7.5,
        correctness: 'wrong',
        marks: 0,
        timeSpent: 45.0,
      },
      {
        id: 'q3',
        response: null,
        correctness: null,
        marks: 0,
        timeSpent: 0,
      },
    ],
    score: 1,
    max: 3,
    correct: 1,
    wrong: 1,
    unattempted: 1,
    timestamp: 1696022400000,
  }

  // Serialize should return the same shape
  const serialized = serializeSubmittedAttempt(original)
  assert.deepEqual(serialized, original)

  // Deserialize should restore everything correctly
  const deserialized = deserializeSubmittedAttempt(serialized)
  assert.deepEqual(deserialized, original)

  // Verify structure and types
  assert.equal(deserialized.id, 'attempt-123')
  assert.equal(deserialized.questionAttempts.length, 3)
  assert.equal(deserialized.questionAttempts[0].id, 'q1')
  assert.equal(deserialized.questionAttempts[0].marks, 1)
  assert.equal(deserialized.questionAttempts[0].timeSpent, 23.5)
  assert.equal(deserialized.questionAttempts[0].correctness, 'correct')
  assert.equal(deserialized.questionAttempts[1].timeSpent, 45.0)
  assert.equal(deserialized.questionAttempts[2].timeSpent, 0)
})

test('Test 4: serialize submitted attempt rejects invalid timeSpent or non-number timeSpent', () => {
  // timeSpent is negative
  let invalid = {
    id: 'attempt-456',
    questionAttempts: [
      {
        id: 'q1',
        response: [0],
        correctness: 'correct',
        marks: 1,
        timeSpent: -5,
      },
    ],
    score: 1,
    max: 1,
    correct: 1,
    wrong: 0,
    unattempted: 0,
    timestamp: Date.now(),
  }
  assert.throws(() => serializeSubmittedAttempt(invalid), /timeSpent must be a non-negative number/)

  // timeSpent is not a number
  invalid = {
    id: 'attempt-456',
    questionAttempts: [
      {
        id: 'q1',
        response: [0],
        correctness: 'correct',
        marks: 1,
        timeSpent: 'not-a-number',
      },
    ],
    score: 1,
    max: 1,
    correct: 1,
    wrong: 0,
    unattempted: 0,
    timestamp: Date.now(),
  }
  assert.throws(() => serializeSubmittedAttempt(invalid), /timeSpent must be a non-negative number/)

  // null timeSpent
  invalid = {
    id: 'attempt-456',
    questionAttempts: [
      {
        id: 'q1',
        response: [0],
        correctness: 'correct',
        marks: 1,
        timeSpent: null,
      },
    ],
    score: 1,
    max: 1,
    correct: 1,
    wrong: 0,
    unattempted: 0,
    timestamp: Date.now(),
  }
  assert.throws(() => serializeSubmittedAttempt(invalid), /timeSpent must be a non-negative number/)
})
