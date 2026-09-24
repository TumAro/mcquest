import type { DataIndex, IndexQuestion } from './data'

export interface SelectQuestionsResult {
  questions: IndexQuestion[]
  warnings: string[]
}

/**
 * Simple Fisher-Yates shuffle seeded from Date.now()
 */
function shuffleQuestions(questions: IndexQuestion[], seed: number): IndexQuestion[] {
  const array = [...questions]
  const rng = seed % 1000000
  let state = rng

  for (let i = array.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) % 2147483648
    const j = (state >>> 16) % (i + 1)
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

/**
 * Select questions from the index by topic slugs
 * Returns the selected questions and any warnings about pool size
 */
export function selectQuestions(
  index: DataIndex,
  topicSlugs: string[],
  maxCount: number
): SelectQuestionsResult {
  const warnings: string[] = []

  if (topicSlugs.length === 0) {
    return { questions: [], warnings: ['No topics selected'] }
  }

  if (maxCount <= 0) {
    return { questions: [], warnings: ['Question count must be greater than 0'] }
  }

  // Collect all questions from the selected topics
  const topicSet = new Set(topicSlugs)
  const filtered: IndexQuestion[] = []

  for (const exam of index.exams) {
    for (const year of exam.years) {
      for (const question of year.questions) {
        if (topicSet.has(question.topic)) {
          filtered.push(question)
        }
      }
    }
  }

  // Shuffle the filtered questions
  const shuffled = shuffleQuestions(filtered, Date.now())

  // Take up to maxCount
  const result = shuffled.slice(0, maxCount)

  // Check for short pool
  if (result.length < maxCount) {
    warnings.push(`Asked for ${maxCount} questions but only ${result.length} available in selected topics.`)
  }

  return { questions: result, warnings }
}
