import test from 'node:test'
import assert from 'node:assert/strict'
import { shortcutFor } from '../src/keys.ts'

const body = { tag: 'body' }
const button = { tag: 'button' }
const link = { tag: 'a' }
const numberInput = { tag: 'input', type: 'number' }

test('Enter saves unless a button or link has focus; the number field still saves', () => {
  assert.deepEqual(shortcutFor('Enter', body), { kind: 'save' })
  assert.deepEqual(shortcutFor('Enter', null), { kind: 'save' })
  assert.deepEqual(shortcutFor('Enter', numberInput), { kind: 'save' })
  assert.equal(shortcutFor('Enter', button), null)
  assert.equal(shortcutFor('Enter', link), null)
})

test('1-4 pick options 0-3, but not from the number field or past 4', () => {
  for (const n of [1, 2, 3, 4]) assert.deepEqual(shortcutFor(String(n), body), { kind: 'pick', index: n - 1 })
  assert.equal(shortcutFor('2', numberInput), null)
  assert.equal(shortcutFor('5', body), null)
})

test('m and M mark, but not from the number field', () => {
  assert.deepEqual(shortcutFor('m', body), { kind: 'mark' })
  assert.deepEqual(shortcutFor('M', body), { kind: 'mark' })
  assert.equal(shortcutFor('m', numberInput), null)
})

test('arrows move one question, but not from the number field', () => {
  assert.deepEqual(shortcutFor('ArrowLeft', body), { kind: 'move', delta: -1 })
  assert.deepEqual(shortcutFor('ArrowRight', body), { kind: 'move', delta: 1 })
  assert.equal(shortcutFor('ArrowLeft', numberInput), null)
  assert.equal(shortcutFor('ArrowRight', numberInput), null)
})

test('anything else is no shortcut', () => {
  assert.equal(shortcutFor('x', body), null)
  assert.equal(shortcutFor('x', null), null)
})
