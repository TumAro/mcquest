import type { DataIndex, IndexQuestion } from './data'
import type { RevealMode, Settings, TestMode } from './storage'
import { selectQuestions } from './QuestionSelection.ts'

/** The one object every entry point hands to the player. */
export interface StartConfig {
  mode: TestMode
  questions: IndexQuestion[]
  timedMinutes: number | null
  revealMode: RevealMode
  exam?: string
  year?: number
}

/** Paper versus drill, decided in one place (D-01, D-03, D-05). */
export function startConfig(
  settings: Settings,
  mode: TestMode,
  questions: IndexQuestion[],
  paper?: { exam: string; year: number },
): StartConfig {
  const isPaper = mode === 'year-wise'
  return {
    mode,
    questions,
    timedMinutes: isPaper ? settings.paperMinutes : settings.drillMinutes,
    revealMode: !isPaper && settings.drillFeedback ? 'immediate' : 'onSubmit',
    ...paper,
  }
}

export function randomStart(index: DataIndex, settings: Settings): StartConfig | null {
  const topics = Object.values(index.topics).flatMap((g) => Object.keys(g.topics))
  const { questions } = selectQuestions(index, topics, settings.questionCount)
  return questions.length ? startConfig(settings, 'random', questions) : null
}
