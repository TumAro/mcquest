import type { DataIndex } from './data'
import { buildIndexLookup } from './QuestionSelection.ts'
import { topicLabels } from './results.ts'

/**
 * Pure all-time weakness aggregation. No DOM, no React, no storage: it only counts
 * the correctness the player already stored. An "attempt" on a topic is one
 * answered question; unattempted questions are not attempts. No recency weighting,
 * no decay, no time component (D-03).
 */

/** D-02, locked: a topic needs this many attempts before its accuracy is ranked. */
export const MIN_ATTEMPTS = 3

/** The practice-weakest test draws from this many of the worst-ranked topics, and holds at most this many questions. */
export const WEAKEST_TOPIC_COUNT = 3
export const WEAKEST_QUESTION_COUNT = 10

export interface TopicStat {
  topic: string
  label: string
  correct: number
  wrong: number
  attempts: number
  accuracy: number
}

export interface TopicStats {
  /** At least MIN_ATTEMPTS attempts, worst accuracy first. */
  ranked: TopicStat[]
  /** Fewer than MIN_ATTEMPTS attempts: shown, never ranked. Closest to qualifying first. */
  insufficient: TopicStat[]
  /** Answered questions whose id is no longer in the bank. */
  skipped: number
}

interface AttemptLike {
  readonly questions: ReadonlyArray<{ readonly id: string; readonly correctness: 'correct' | 'wrong' | null }>
}

export function topicStats(
  attempts: readonly AttemptLike[],
  topicOf: (id: string) => string | undefined,
  labelOf: (slug: string) => string,
): TopicStats {
  const rows = new Map<string, TopicStat>()
  let skipped = 0
  for (const attempt of attempts) {
    for (const q of attempt.questions) {
      if (q.correctness === null) continue
      const slug = topicOf(q.id)
      if (slug === undefined) {
        skipped++
        continue
      }
      let row = rows.get(slug)
      if (!row) {
        row = { topic: slug, label: labelOf(slug), correct: 0, wrong: 0, attempts: 0, accuracy: 0 }
        rows.set(slug, row)
      }
      if (q.correctness === 'correct') row.correct++
      else row.wrong++
      row.attempts = row.correct + row.wrong
      row.accuracy = row.correct / row.attempts
    }
  }
  const all = [...rows.values()]
  const byLabel = (a: TopicStat, b: TopicStat) => a.label.localeCompare(b.label)
  return {
    ranked: all
      .filter((r) => r.attempts >= MIN_ATTEMPTS)
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts || byLabel(a, b)),
    insufficient: all
      .filter((r) => r.attempts < MIN_ATTEMPTS)
      .sort((a, b) => b.attempts - a.attempts || byLabel(a, b)),
    skipped,
  }
}

export function statsFromHistory(attempts: readonly AttemptLike[], index: DataIndex): TopicStats {
  const lookup = buildIndexLookup(index)
  const labels = topicLabels(index.topics)
  return topicStats(
    attempts,
    (id) => lookup.get(id)?.question.topic,
    (slug) => labels[slug] ?? slug,
  )
}

/** The bottom of the ranking (D-04). `ranked` is already worst-first and above the threshold. */
export function weakestTopics(ranked: readonly TopicStat[], n: number = WEAKEST_TOPIC_COUNT): TopicStat[] {
  return ranked.slice(0, n)
}
