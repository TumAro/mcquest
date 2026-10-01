import test from 'node:test'
import assert from 'node:assert/strict'
import {
  topicStats,
  statsFromHistory,
  MIN_ATTEMPTS,
  weakestTopics,
  WEAKEST_TOPIC_COUNT,
  WEAKEST_QUESTION_COUNT,
} from '../src/stats.ts'
import { attemptsFromEntries } from '../src/storage.ts'

// Neutral made-up fixtures: no bank names.
const topicOf = (id) => (id.startsWith('orphan') ? undefined : id.split('-')[0] === 'q' ? `topic-${id[2]}` : undefined)
const labelOf = (slug) => `Label ${slug}`

let clock = 1000
/** A complete, valid SubmittedAttempt from [id, correctness] pairs; distinct timeSpent per question. */
function attempt(pairs, timestamp = clock++) {
  return {
    id: `a${timestamp}`,
    timestamp,
    exam: 'exam-x',
    mode: 'random',
    timedMinutes: null,
    revealMode: 'immediate',
    score: 0,
    max: 0,
    correct: pairs.filter(([, c]) => c === 'correct').length,
    wrong: pairs.filter(([, c]) => c === 'wrong').length,
    unattempted: pairs.filter(([, c]) => c === null).length,
    questions: pairs.map(([id, correctness], i) => ({
      id,
      response: null,
      correctness,
      marks: correctness === 'correct' ? 1 : 0,
      timeSpent: 7 + i * 3,
    })),
  }
}

// Ids q-a1 .. map to topic-a, q-b1 to topic-b, and so on.
const C = 'correct'
const W = 'wrong'
const repeat = (id, outcomes) => outcomes.map((o) => [id, o])
const find = (list, topic) => list.find((r) => r.topic === topic)

test('counting accumulates across attempts', () => {
  const r = topicStats([attempt([['q-a1', C]]), attempt([['q-a1', C], ['q-a2', W]])], topicOf, labelOf)
  const a = r.ranked.concat(r.insufficient).find((x) => x.topic === 'topic-a')
  assert.equal(a.attempts, 3)
  assert.equal(a.correct, 2)
  assert.equal(a.wrong, 1)
  assert.equal(a.accuracy, 2 / 3)
})

test('unattempted questions are not attempts and never lower accuracy', () => {
  const r = topicStats([attempt([['q-a1', C], ['q-a2', null], ['q-b1', null]])], topicOf, labelOf)
  const all = r.ranked.concat(r.insufficient)
  assert.equal(find(all, 'topic-a').attempts, 1)
  assert.equal(find(all, 'topic-a').accuracy, 1)
  assert.equal(find(all, 'topic-b'), undefined, 'a topic with only unattempted questions is in neither list')
})

test('MIN_ATTEMPTS is pinned to 3 (D-02, locked)', () => {
  assert.equal(MIN_ATTEMPTS, 3)
})

test('threshold: one under goes to insufficient, exactly MIN_ATTEMPTS is ranked', () => {
  const r = topicStats(
    [
      attempt([
        ...repeat('q-a1', Array(MIN_ATTEMPTS - 1).fill(W)),
        ...repeat('q-b1', Array(MIN_ATTEMPTS).fill(W)),
      ]),
    ],
    topicOf,
    labelOf,
  )
  assert.deepEqual(r.ranked.map((x) => x.topic), ['topic-b'])
  assert.deepEqual(r.insufficient.map((x) => x.topic), ['topic-a'])
  assert.equal(r.insufficient[0].attempts, MIN_ATTEMPTS - 1)
})

test('ranking is worst first regardless of input order', () => {
  const n = MIN_ATTEMPTS
  const all = (o) => Array(n).fill(o)
  const half = [C, ...Array(n - 1).fill(W)]
  const r = topicStats(
    [attempt([...repeat('q-c1', all(C)), ...repeat('q-a1', all(W)), ...repeat('q-b1', half)])],
    topicOf,
    labelOf,
  )
  assert.deepEqual(r.ranked.map((x) => x.topic), ['topic-a', 'topic-b', 'topic-c'])
  assert.equal(r.ranked[0].accuracy, 0)
  assert.equal(r.ranked[2].accuracy, 1)
})

test('equal accuracy: more attempts first, then label; deterministic', () => {
  const n = MIN_ATTEMPTS
  const build = (order) =>
    topicStats(
      [
        attempt(
          order.flatMap((t) => repeat(`q-${t}1`, Array(t === 'c' ? n + 2 : n).fill(W))),
        ),
      ],
      topicOf,
      labelOf,
    )
  const one = build(['a', 'b', 'c'])
  const two = build(['c', 'b', 'a'])
  assert.deepEqual(one.ranked.map((x) => x.topic), ['topic-c', 'topic-a', 'topic-b'])
  assert.deepEqual(two.ranked, one.ranked)
})

test('insufficient list: never overlaps ranked, more attempts first then label, carries counts', () => {
  const r = topicStats(
    [
      attempt([
        ...repeat('q-a1', [W]),
        ...repeat('q-b1', [W, W]),
        ...repeat('q-c1', [C, C]),
        ...repeat('q-d1', Array(MIN_ATTEMPTS).fill(C)),
      ]),
    ],
    topicOf,
    labelOf,
  )
  assert.deepEqual(r.insufficient.map((x) => x.topic), ['topic-b', 'topic-c', 'topic-a'])
  assert.deepEqual(r.insufficient.map((x) => x.attempts), [2, 2, 1])
  const ranked = new Set(r.ranked.map((x) => x.topic))
  for (const row of r.insufficient) assert.ok(!ranked.has(row.topic))
})

test('orphans: answered ids with no topic are skipped and counted; unattempted orphans are not', () => {
  const r = topicStats(
    [attempt([['orphan-1', W], ['orphan-2', C], ['orphan-3', null], ['q-a1', C]])],
    topicOf,
    labelOf,
  )
  assert.equal(r.skipped, 2)
  assert.deepEqual(r.ranked.concat(r.insufficient).map((x) => x.topic), ['topic-a'])
})

test('empty history returns empty lists and skipped 0', () => {
  assert.deepEqual(topicStats([], topicOf, labelOf), { ranked: [], insufficient: [], skipped: 0 })
})

test('input attempts are not mutated', () => {
  const input = [attempt([['q-a1', C], ['q-a2', W], ['orphan-1', W]])]
  const before = JSON.stringify(input)
  topicStats(input, topicOf, labelOf)
  assert.equal(JSON.stringify(input), before)
})

test('statsFromHistory joins through the index and falls back to the slug for a missing label', () => {
  const index = {
    topics: {
      g1: { label: 'Group 1', topics: { 'topic-a': 'Alpha topic' } },
      g2: { label: 'Group 2', topics: {} },
    },
    exams: [
      {
        label: 'Exam X',
        slug: 'exam-x',
        years: [
          {
            year: 1,
            count: 2,
            questions: [
              { id: 'id-1', topic: 'topic-a' },
              { id: 'id-2', topic: 'topic-nolabel' },
            ],
          },
        ],
      },
    ],
  }
  const r = statsFromHistory([attempt([['id-1', C], ['id-2', W], ['gone', W]])], index)
  assert.equal(r.skipped, 1)
  const rows = r.insufficient
  assert.equal(find(rows, 'topic-a').label, 'Alpha topic')
  assert.equal(find(rows, 'topic-nolabel').label, 'topic-nolabel')
})

test('attemptsFromEntries keeps only attempt: records, oldest first, timeSpent exact', () => {
  const newer = attempt([['q-a1', C], ['q-a2', W]], 5000)
  const older = attempt([['q-a1', W]], 4000)
  const entries = [
    ['attempt:' + newer.id, newer],
    ['in-progress-attempt', { current: 0 }],
    ['bookmarks', ['q-a1']],
    [42, newer],
    ['attempt:broken', { id: 'x' }],
    ['attempt:' + older.id, older],
  ]
  const out = attemptsFromEntries(entries)
  assert.deepEqual(out.map((a) => a.timestamp), [4000, 5000])
  assert.deepEqual(out[1].questions.map((q) => q.timeSpent), newer.questions.map((q) => q.timeSpent))
  assert.deepEqual(out[0].questions.map((q) => q.timeSpent), older.questions.map((q) => q.timeSpent))
  assert.deepEqual(attemptsFromEntries([]), [])
})

const row = (topic) => ({ topic, label: topic, correct: 0, wrong: 0, attempts: 3, accuracy: 0 })

test('weakestTopics takes the front of the ranking, copies, and honours an override', () => {
  const ranked = Array.from({ length: WEAKEST_TOPIC_COUNT + 2 }, (_, i) => row(`t${i}`))
  const copy = [...ranked]
  const out = weakestTopics(ranked)
  assert.deepEqual(out.map((r) => r.topic), ranked.slice(0, WEAKEST_TOPIC_COUNT).map((r) => r.topic))
  assert.deepEqual(ranked, copy, 'input is not mutated')
  assert.notEqual(out, ranked)
  assert.equal(weakestTopics(ranked, 1).length, 1)
  assert.deepEqual(weakestTopics([row('only')]).map((r) => r.topic), ['only'])
  assert.deepEqual(weakestTopics([]), [])
})

test('weakest topics through the real chain: lowest accuracy first, never a sub-threshold topic', () => {
  // topic i (a..e) has MIN_ATTEMPTS outcomes with i correct; accuracy rises with i. 'z' has one wrong, under threshold.
  const letters = ['a', 'b', 'c', 'd', 'e']
  const pairs = []
  letters.forEach((l, i) => {
    for (let k = 0; k < MIN_ATTEMPTS; k++) pairs.push(['q-' + l + '1', k < i ? C : W])
  })
  pairs.push(['q-z1', W])
  const scrambled = pairs.reverse()
  const { ranked } = topicStats([attempt(scrambled)], topicOf, labelOf)
  const weak = weakestTopics(ranked).map((r) => r.topic)
  assert.deepEqual(weak, letters.slice(0, WEAKEST_TOPIC_COUNT).map((l) => `topic-${l}`))
  assert.ok(!weak.includes('topic-z'))
})

test('the weakest constants are positive integers and the question cap covers every topic', () => {
  for (const n of [WEAKEST_TOPIC_COUNT, WEAKEST_QUESTION_COUNT]) assert.ok(Number.isInteger(n) && n > 0)
  assert.ok(WEAKEST_QUESTION_COUNT >= WEAKEST_TOPIC_COUNT)
})
