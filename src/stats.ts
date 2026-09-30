import type { DataIndex } from './data'
import { buildIndexLookup } from './QuestionSelection.ts'
import { topicLabels } from './results.ts'

/**
 * Pure all-time weakness aggregation. No DOM, no React, no storage: it only counts
 * the correctness the player already stored. An "attempt" on a topic is one
 * answered question; unattempted questions are not attempts.
 */

export interface TopicStat {
  topic: string
  label: string
  correct: number
  wrong: number
  attempts: number
  accuracy: number
}

interface AttemptLike {
  readonly questions: ReadonlyArray<{ readonly id: string; readonly correctness: 'correct' | 'wrong' | null }>
}

export function topicStats(
  attempts: readonly AttemptLike[],
  topicOf: (id: string) => string | undefined,
  labelOf: (slug: string) => string,
): TopicStat[] {
  const rows = new Map<string, TopicStat>()
  for (const attempt of attempts) {
    for (const q of attempt.questions) {
      if (q.correctness === null) continue
      const slug = topicOf(q.id)
      if (slug === undefined) continue
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
  return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export function statsFromHistory(attempts: readonly AttemptLike[], index: DataIndex): TopicStat[] {
  const lookup = buildIndexLookup(index)
  const labels = topicLabels(index.topics)
  return topicStats(
    attempts,
    (id) => lookup.get(id)?.question.topic,
    (slug) => labels[slug] ?? slug,
  )
}
