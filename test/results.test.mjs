import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { formatScore, formatAccuracy, topicLabels, topicBreakdown, noteOpenByDefault, statusLabel, formatMarks } from '../src/results.ts'
import { buildIndexLookup } from '../src/QuestionSelection.ts'

test('formatScore rounds to two decimals and trims trailing zeros', () => {
  assert.equal(formatScore(3), '3')
  assert.equal(formatScore(2.3333333), '2.33')
  assert.equal(formatScore(4.75), '4.75')
  assert.equal(formatScore(-0.6666667), '-0.67')
  assert.equal(formatScore(0), '0')
  assert.equal(formatScore(0.1 + 0.2), '0.3')
  assert.equal(formatScore(10), '10')
})

test('formatScore never returns "-0"', () => {
  assert.equal(formatScore(-0.001), '0')
  assert.equal(formatScore(-0), '0')
})

test('formatAccuracy: null is an em dash, otherwise a whole-number percentage', () => {
  assert.equal(formatAccuracy(null), '—')
  assert.equal(formatAccuracy(1), '100%')
  assert.equal(formatAccuracy(0), '0%')
  assert.equal(formatAccuracy(2 / 3), '67%')
})

const topicOf = (map) => (id) => map[id]
const labelOf = (slug) => `Label ${slug}`

test('topicBreakdown counts correct, wrong and unattempted per topic from stored correctness', () => {
  const qs = [
    { id: 'a1', correctness: 'correct' },
    { id: 'a2', correctness: 'wrong' },
    { id: 'a3', correctness: null },
    { id: 'b1', correctness: 'correct' },
  ]
  const rows = topicBreakdown(qs, topicOf({ a1: 'topic-a', a2: 'topic-a', a3: 'topic-a', b1: 'topic-b' }), labelOf)
  const a = rows.find((r) => r.topic === 'topic-a')
  const b = rows.find((r) => r.topic === 'topic-b')
  assert.deepEqual(
    { total: a.total, correct: a.correct, wrong: a.wrong, unattempted: a.unattempted, accuracy: a.accuracy },
    { total: 3, correct: 1, wrong: 1, unattempted: 1, accuracy: 0.5 },
  )
  assert.equal(b.accuracy, 1)
  assert.equal(a.label, 'Label topic-a')
})

test('topicBreakdown: accuracy is null when nothing in the topic was attempted', () => {
  const rows = topicBreakdown([{ id: 'x', correctness: null }], topicOf({ x: 'topic-a' }), labelOf)
  assert.equal(rows[0].accuracy, null)
  assert.equal(rows[0].unattempted, 1)
})

test('topicBreakdown orders by label, not by accuracy (no worst-first ranking)', () => {
  const qs = [
    { id: 'z1', correctness: 'wrong' },
    { id: 'm1', correctness: 'correct' },
    { id: 'a1', correctness: 'wrong' },
  ]
  const rows = topicBreakdown(qs, topicOf({ z1: 'topic-z', m1: 'topic-m', a1: 'topic-a' }), (s) => s.toUpperCase())
  assert.deepEqual(rows.map((r) => r.topic), ['topic-a', 'topic-m', 'topic-z'])
})

test('topicBreakdown: ids missing from the lookup share one "no longer in the bank" row', () => {
  const qs = [
    { id: 'gone1', correctness: 'correct' },
    { id: 'gone2', correctness: 'wrong' },
    { id: 'a1', correctness: 'correct' },
  ]
  const rows = topicBreakdown(qs, topicOf({ a1: 'topic-a' }), labelOf)
  const missing = rows.filter((r) => /no longer in the bank/i.test(r.label))
  assert.equal(missing.length, 1)
  assert.equal(missing[0].total, 2)
  assert.equal(rows.length, 2)
})

test('topicLabels flattens the two-level index.topics into slug -> label', () => {
  const labels = topicLabels({
    'group-1': { label: 'Group One', topics: { 'topic-a': 'Topic A', 'topic-b': 'Topic B' } },
    'group-2': { label: 'Group Two', topics: { 'topic-c': 'Topic C' } },
  })
  assert.deepEqual(labels, { 'topic-a': 'Topic A', 'topic-b': 'Topic B', 'topic-c': 'Topic C' })
})

test('buildIndexLookup maps every question id to { question, slug, year }; first occurrence wins', () => {
  const q = (id, topic) => ({ id, topic })
  const index = {
    topics: {},
    exams: [
      { label: 'One', slug: 'exam-one', years: [{ year: 1, count: 2, questions: [q('dup', 'topic-a'), q('x', 'topic-a')] }] },
      { label: 'Two', slug: 'exam-two', years: [{ year: 2, count: 2, questions: [q('dup', 'topic-b'), q('y', 'topic-b')] }] },
    ],
  }
  const lookup = buildIndexLookup(index)
  assert.equal(lookup.size, 3)
  assert.equal(lookup.get('dup').slug, 'exam-one')
  assert.equal(lookup.get('dup').year, 1)
  assert.equal(lookup.get('dup').question.topic, 'topic-a')
  assert.equal(lookup.get('y').slug, 'exam-two')
})

test('buildIndexLookup against the real index: size equals the distinct question count', () => {
  const index = JSON.parse(readFileSync('public/data/index.json', 'utf8'))
  const ids = new Set()
  for (const e of index.exams) for (const y of e.years) for (const q of y.questions) ids.add(q.id)
  const lookup = buildIndexLookup(index)
  assert.equal(lookup.size, ids.size)
  assert.ok(lookup.size > 0)
})

test('noteOpenByDefault: open only when the stored answer was wrong (D-04)', () => {
  assert.equal(noteOpenByDefault('wrong'), true)
  assert.equal(noteOpenByDefault('correct'), false)
  assert.equal(noteOpenByDefault(null), false)
})

test('statusLabel names the three stored states', () => {
  assert.equal(statusLabel('correct'), 'Correct')
  assert.equal(statusLabel('wrong'), 'Wrong')
  assert.equal(statusLabel(null), 'Not attempted')
})

test('formatMarks signs positive values and never prints -0', () => {
  assert.equal(formatMarks(2), '+2')
  assert.equal(formatMarks(4.75), '+4.75')
  assert.equal(formatMarks(-0.6666667), '-0.67')
  assert.equal(formatMarks(0), '0')
  assert.equal(formatMarks(-0.001), '0')
  assert.equal(formatMarks(0.001), '0')
})
