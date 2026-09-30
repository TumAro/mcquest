// Covers the pure bookmark helpers only. loadBookmarks/toggleBookmark need
// IndexedDB, which Node lacks (and no fake may be added as a dependency); the
// e2e test in e2e/results.spec.ts exercises them in a real browser.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  deserializeBookmarks,
  toggleBookmarkIn,
  serializeInProgressAttempt,
  deserializeInProgressAttempt,
  serializeSubmittedAttempt,
  deserializeSubmittedAttempt,
} from '../src/storage.ts'

test('deserializeBookmarks: non-arrays become []', () => {
  for (const v of [undefined, null, {}, 'abc', 7, { 0: 'a', length: 1 }]) {
    assert.deepEqual(deserializeBookmarks(v), [])
  }
})

test('deserializeBookmarks: keeps non-empty strings, dedupes, first-seen order', () => {
  assert.deepEqual(
    deserializeBookmarks(['b', '', 'a', 3, null, 'b', {}, 'c', 'a']),
    ['b', 'a', 'c'],
  )
})

test('toggleBookmarkIn: adds an absent id at the end', () => {
  assert.deepEqual(toggleBookmarkIn(['a', 'b'], 'c'), ['a', 'b', 'c'])
})

test('toggleBookmarkIn: removes a present id', () => {
  assert.deepEqual(toggleBookmarkIn(['a', 'b', 'c'], 'b'), ['a', 'c'])
})

test('toggleBookmarkIn: never mutates its input', () => {
  const list = Object.freeze(['a', 'b'])
  assert.deepEqual(toggleBookmarkIn(list, 'c'), ['a', 'b', 'c'])
  assert.deepEqual(toggleBookmarkIn(list, 'a'), ['b'])
})

test('toggleBookmarkIn: empty or non-string id returns the list unchanged', () => {
  for (const id of ['', undefined, null, 5, {}]) {
    assert.deepEqual(toggleBookmarkIn(['a'], id), ['a'])
  }
})

test('toggleBookmarkIn: toggling the same new id twice restores the list', () => {
  const list = ['a', 'b']
  assert.deepEqual(toggleBookmarkIn(toggleBookmarkIn(list, 'z'), 'z'), list)
})

// D-05: 'bookmarked' is a stored mode for both record kinds; one shared list validates it.
const inProgress = (mode) => ({
  current: 0,
  responses: { q1: [0], q2: null },
  marked: { q1: false },
  visited: { q1: true },
  remaining: 1000,
  revealMode: 'immediate',
  questionIds: ['q1', 'q2'],
  exam: 'sample',
  year: 2024,
  mode,
  timedMinutes: null,
  startedAt: 1696022400000,
  timePerQuestion: { q1: 5 },
})
const submitted = (mode) => ({
  id: 'attempt-1',
  timestamp: 1696022400000,
  exam: 'sample',
  year: 2024,
  mode,
  timedMinutes: null,
  revealMode: 'onSubmit',
  questions: [{ id: 'q1', response: [0], correctness: 'correct', marks: 1, timeSpent: 3 }],
  score: 1,
  max: 1,
  correct: 1,
  wrong: 0,
  unattempted: 0,
})

test('every stored mode, including bookmarked, round-trips for both record kinds', () => {
  for (const mode of ['year-wise', 'subject-wise', 'random', 'bookmarked']) {
    const a = inProgress(mode)
    assert.deepEqual(deserializeInProgressAttempt(serializeInProgressAttempt(a)), a)
    const s = submitted(mode)
    assert.deepEqual(deserializeSubmittedAttempt(serializeSubmittedAttempt(s)), s)
  }
})

test('an unknown mode is rejected by all four functions', () => {
  assert.throws(() => serializeInProgressAttempt(inProgress('nonsense')), /bookmarked/)
  assert.throws(() => serializeSubmittedAttempt(submitted('nonsense')), /bookmarked/)
  assert.equal(deserializeInProgressAttempt(inProgress('nonsense')), null)
  assert.equal(deserializeSubmittedAttempt(submitted('nonsense')), null)
})
