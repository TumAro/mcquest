// Covers the pure bookmark helpers only. loadBookmarks/toggleBookmark need
// IndexedDB, which Node lacks (and no fake may be added as a dependency); the
// e2e test in e2e/results.spec.ts exercises them in a real browser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { deserializeBookmarks, toggleBookmarkIn } from '../src/storage.ts'

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
