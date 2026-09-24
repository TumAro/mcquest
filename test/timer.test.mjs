import test from 'node:test'
import assert from 'node:assert/strict'
import { remainingMs, formatTime, isTimeUp } from '../src/timer.ts'

test('remainingMs: deadline 5s in future returns ~5000ms', () => {
  const now = 1000000
  const deadline = now + 5000
  const result = remainingMs(deadline, now)
  assert.equal(result, 5000)
})

test('remainingMs: deadline in past returns 0', () => {
  const now = 1000000
  const deadline = now - 1000
  const result = remainingMs(deadline, now)
  assert.equal(result, 0)
})

test('remainingMs: Infinity deadline returns Infinity', () => {
  const now = 1000000
  const result = remainingMs(Infinity, now)
  assert.equal(result, Infinity)
})

test('formatTime: 305 seconds returns 5:05', () => {
  const result = formatTime(305)
  assert.equal(result, '5:05')
})

test('formatTime: 0 seconds returns 0:00', () => {
  const result = formatTime(0)
  assert.equal(result, '0:00')
})

test('formatTime: 61 seconds returns 1:01', () => {
  const result = formatTime(61)
  assert.equal(result, '1:01')
})

test('formatTime: 599 seconds returns 9:59', () => {
  const result = formatTime(599)
  assert.equal(result, '9:59')
})

test('isTimeUp: deadline equal to now returns true', () => {
  const now = 1000000
  const result = isTimeUp(now, now)
  assert.equal(result, true)
})

test('isTimeUp: deadline before now returns true', () => {
  const now = 1000000
  const deadline = now - 1
  const result = isTimeUp(deadline, now)
  assert.equal(result, true)
})

test('isTimeUp: deadline after now returns false', () => {
  const now = 1000000
  const deadline = now + 1000
  const result = isTimeUp(deadline, now)
  assert.equal(result, false)
})
