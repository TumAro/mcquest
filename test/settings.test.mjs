import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS, deserializeSettings } from '../src/storage.ts'

test('defaults: system theme, 120 minute paper, untimed drills, 10 questions, feedback on', () => {
  assert.deepEqual(DEFAULT_SETTINGS, {
    theme: 'system',
    paperMinutes: 120,
    drillMinutes: null,
    questionCount: 10,
    drillFeedback: true,
  })
})

test('garbage input yields a copy of the defaults', () => {
  for (const bad of [undefined, null, 'x', 7, [], {}]) {
    const s = deserializeSettings(bad)
    assert.deepEqual(s, DEFAULT_SETTINGS)
    assert.notEqual(s, DEFAULT_SETTINGS)
  }
})

test('each field falls back on its own', () => {
  const s = deserializeSettings({ theme: 'purple', paperMinutes: 90, questionCount: 'many', drillFeedback: 'yes' })
  assert.equal(s.theme, DEFAULT_SETTINGS.theme)
  assert.equal(s.paperMinutes, 90)
  assert.equal(s.questionCount, DEFAULT_SETTINGS.questionCount)
  assert.equal(s.drillFeedback, DEFAULT_SETTINGS.drillFeedback)
})

test('theme accepts only system, light, dark', () => {
  for (const theme of ['system', 'light', 'dark']) assert.equal(deserializeSettings({ theme }).theme, theme)
  assert.equal(deserializeSettings({ theme: 'Dark' }).theme, 'system')
})

test('numbers round to integers and clamp; drillMinutes null stays null', () => {
  assert.equal(deserializeSettings({ paperMinutes: 0 }).paperMinutes, 1)
  assert.equal(deserializeSettings({ paperMinutes: 99999 }).paperMinutes, 600)
  assert.equal(deserializeSettings({ paperMinutes: 45.6 }).paperMinutes, 46)
  assert.equal(deserializeSettings({ drillMinutes: null }).drillMinutes, null)
  assert.equal(deserializeSettings({ drillMinutes: 15.2 }).drillMinutes, 15)
  assert.equal(deserializeSettings({ drillMinutes: -4 }).drillMinutes, 1)
  assert.equal(deserializeSettings({ drillMinutes: 'x' }).drillMinutes, null)
  assert.equal(deserializeSettings({ questionCount: 0 }).questionCount, 1)
  assert.equal(deserializeSettings({ questionCount: 5000 }).questionCount, 200)
  assert.equal(deserializeSettings({ questionCount: NaN }).questionCount, DEFAULT_SETTINGS.questionCount)
})

test('drillFeedback keeps a real boolean', () => {
  assert.equal(deserializeSettings({ drillFeedback: false }).drillFeedback, false)
})
