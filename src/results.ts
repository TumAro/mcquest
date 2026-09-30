import type { DataIndex } from './data'

/**
 * Pure results presentation logic. No DOM, no React, no storage: it only counts
 * the correctness the player already stored. Correctness has one source
 * (the marking module, used only by the player); nothing here decides right or wrong.
 */

export const EM_DASH = '—'
export const MISSING_TOPIC = '__missing__'
export const MISSING_LABEL = 'No longer in the bank'

/** Two decimals, trailing zeros trimmed, never "-0". */
export function formatScore(n: number): string {
  const rounded = Math.round(n * 100) / 100
  // `+ 0` turns -0 into 0 so String() cannot print "-0".
  return String(rounded + 0)
}

export function formatAccuracy(a: number | null): string {
  return a === null ? EM_DASH : `${Math.round(a * 100)}%`
}

export interface TopicRow {
  topic: string
  label: string
  total: number
  correct: number
  wrong: number
  unattempted: number
  accuracy: number | null
}

export function topicLabels(topics: DataIndex['topics']): Record<string, string> {
  const out: Record<string, string> = {}
  for (const group of Object.values(topics)) Object.assign(out, group.topics)
  return out
}

export function topicBreakdown(
  questions: { id: string; correctness: 'correct' | 'wrong' | null }[],
  topicOf: (id: string) => string | undefined,
  labelOf: (slug: string) => string,
): TopicRow[] {
  const rows = new Map<string, TopicRow>()
  for (const q of questions) {
    const slug = topicOf(q.id)
    const key = slug ?? MISSING_TOPIC
    let row = rows.get(key)
    if (!row) {
      row = {
        topic: key,
        label: slug === undefined ? MISSING_LABEL : labelOf(slug),
        total: 0,
        correct: 0,
        wrong: 0,
        unattempted: 0,
        accuracy: null,
      }
      rows.set(key, row)
    }
    row.total++
    if (q.correctness === 'correct') row.correct++
    else if (q.correctness === 'wrong') row.wrong++
    else row.unattempted++
  }
  for (const row of rows.values()) {
    const attempted = row.correct + row.wrong
    row.accuracy = attempted === 0 ? null : row.correct / attempted
  }
  // Label order, deliberately not accuracy: a worst-first ranking is Phase 7.
  return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label))
}

type Correctness = 'correct' | 'wrong' | null

/** D-04: a wrong answer opens its solution; right or unattempted stays collapsed but available. */
export function noteOpenByDefault(correctness: Correctness): boolean {
  return correctness === 'wrong'
}

export function statusLabel(correctness: Correctness): string {
  return correctness === 'correct' ? 'Correct' : correctness === 'wrong' ? 'Wrong' : 'Not attempted'
}

/** formatScore with an explicit plus on positive values. */
export function formatMarks(n: number): string {
  const s = formatScore(n)
  return n > 0 && s !== '0' ? `+${s}` : s
}
