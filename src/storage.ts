import { set, get, del } from 'idb-keyval'

export type Response = number[] | number | null

export interface InProgressAttempt {
  current: number
  responses: Record<string, Response>
  marked: Record<string, boolean>
  visited: Record<string, boolean>
  remaining: number
  revealMode: 'immediate' | 'onSubmit'
  questionIds: string[]
  exam: string
  year?: number
  mode: 'year-wise' | 'subject-wise' | 'random'
  timedMinutes: number | null
  startedAt: number
  timePerQuestion: Record<string, number>
}

export interface QuestionAttempt {
  id: string
  response: Response
  correctness: 'correct' | 'wrong' | null
  marks: number
  timeSpent: number
}

export interface SubmittedAttempt {
  id: string
  questionAttempts: QuestionAttempt[]
  score: number
  max: number
  correct: number
  wrong: number
  unattempted: number
  timestamp: number
}

/**
 * Pure serialization — converts in-progress attempt to storable shape.
 * Validates all required fields present. Returns same shape or throws.
 * No browser globals, fully testable in Node.
 */
export function serializeInProgressAttempt(attempt: InProgressAttempt): InProgressAttempt {
  // Validate required fields
  if (attempt.current === undefined || attempt.current === null || typeof attempt.current !== 'number') {
    throw new Error('Invalid in-progress attempt: current must be a number')
  }
  if (!attempt.responses || typeof attempt.responses !== 'object') {
    throw new Error('Invalid in-progress attempt: responses must be an object')
  }
  if (!attempt.marked || typeof attempt.marked !== 'object') {
    throw new Error('Invalid in-progress attempt: marked must be an object')
  }
  if (!attempt.visited || typeof attempt.visited !== 'object') {
    throw new Error('Invalid in-progress attempt: visited must be an object')
  }
  if (attempt.remaining === undefined || attempt.remaining === null || typeof attempt.remaining !== 'number') {
    throw new Error('Invalid in-progress attempt: remaining must be a number')
  }
  if (!attempt.revealMode || !['immediate', 'onSubmit'].includes(attempt.revealMode)) {
    throw new Error('Invalid in-progress attempt: revealMode must be "immediate" or "onSubmit"')
  }
  if (!Array.isArray(attempt.questionIds)) {
    throw new Error('Invalid in-progress attempt: questionIds must be an array')
  }
  if (!attempt.exam || typeof attempt.exam !== 'string') {
    throw new Error('Invalid in-progress attempt: exam must be a non-empty string')
  }
  if (attempt.year !== undefined && typeof attempt.year !== 'number') {
    throw new Error('Invalid in-progress attempt: year must be a number or undefined')
  }
  if (!['year-wise', 'subject-wise', 'random'].includes(attempt.mode)) {
    throw new Error('Invalid in-progress attempt: mode must be "year-wise", "subject-wise", or "random"')
  }
  if (attempt.timedMinutes !== null && typeof attempt.timedMinutes !== 'number') {
    throw new Error('Invalid in-progress attempt: timedMinutes must be a number or null')
  }
  if (typeof attempt.startedAt !== 'number') {
    throw new Error('Invalid in-progress attempt: startedAt must be a number')
  }
  if (!attempt.timePerQuestion || typeof attempt.timePerQuestion !== 'object') {
    throw new Error('Invalid in-progress attempt: timePerQuestion must be an object')
  }

  return attempt
}

/**
 * Pure deserialization — reverses serializeInProgressAttempt.
 * Returns object if valid, null if missing/malformed fields.
 * Never throws.
 */
export function deserializeInProgressAttempt(stored: unknown): InProgressAttempt | null {
  if (!stored || typeof stored !== 'object') {
    return null
  }

  const obj = stored as Record<string, unknown>

  if (typeof obj.current !== 'number') return null
  if (!obj.responses || typeof obj.responses !== 'object') return null
  if (!obj.marked || typeof obj.marked !== 'object') return null
  if (!obj.visited || typeof obj.visited !== 'object') return null
  if (typeof obj.remaining !== 'number') return null
  if (!['immediate', 'onSubmit'].includes(obj.revealMode as string)) return null
  if (!Array.isArray(obj.questionIds)) return null
  if (typeof obj.exam !== 'string' || !obj.exam) return null
  if (obj.year !== undefined && typeof obj.year !== 'number') return null
  if (!['year-wise', 'subject-wise', 'random'].includes(obj.mode as string)) return null
  if (obj.timedMinutes !== null && typeof obj.timedMinutes !== 'number') return null
  if (typeof obj.startedAt !== 'number') return null
  if (!obj.timePerQuestion || typeof obj.timePerQuestion !== 'object') return null

  return {
    current: obj.current,
    responses: obj.responses as Record<string, Response>,
    marked: obj.marked as Record<string, boolean>,
    visited: obj.visited as Record<string, boolean>,
    remaining: obj.remaining,
    revealMode: obj.revealMode as 'immediate' | 'onSubmit',
    questionIds: obj.questionIds as string[],
    exam: obj.exam as string,
    year: obj.year as number | undefined,
    mode: obj.mode as 'year-wise' | 'subject-wise' | 'random',
    timedMinutes: obj.timedMinutes as number | null,
    startedAt: obj.startedAt as number,
    timePerQuestion: obj.timePerQuestion as Record<string, number>,
  }
}

/**
 * Pure serialization — converts scored attempt to storable shape.
 * Validates all required fields present, timeSpent is number >= 0 for each question.
 * Returns same shape or throws.
 */
export function serializeSubmittedAttempt(attempt: SubmittedAttempt): SubmittedAttempt {
  if (!attempt.id || typeof attempt.id !== 'string') {
    throw new Error('Invalid submitted attempt: id must be a non-empty string')
  }
  if (!Array.isArray(attempt.questionAttempts)) {
    throw new Error('Invalid submitted attempt: questionAttempts must be an array')
  }
  if (typeof attempt.score !== 'number') {
    throw new Error('Invalid submitted attempt: score must be a number')
  }
  if (typeof attempt.max !== 'number') {
    throw new Error('Invalid submitted attempt: max must be a number')
  }
  if (typeof attempt.correct !== 'number') {
    throw new Error('Invalid submitted attempt: correct must be a number')
  }
  if (typeof attempt.wrong !== 'number') {
    throw new Error('Invalid submitted attempt: wrong must be a number')
  }
  if (typeof attempt.unattempted !== 'number') {
    throw new Error('Invalid submitted attempt: unattempted must be a number')
  }
  if (typeof attempt.timestamp !== 'number') {
    throw new Error('Invalid submitted attempt: timestamp must be a number')
  }

  // Validate each question attempt
  for (const qa of attempt.questionAttempts) {
    if (!qa.id || typeof qa.id !== 'string') {
      throw new Error('Invalid question attempt: id must be a non-empty string')
    }
    if (typeof qa.marks !== 'number') {
      throw new Error('Invalid question attempt: marks must be a number')
    }
    if (typeof qa.timeSpent !== 'number' || qa.timeSpent < 0) {
      throw new Error('Invalid question attempt: timeSpent must be a non-negative number')
    }
    if (qa.correctness !== null && !['correct', 'wrong'].includes(qa.correctness)) {
      throw new Error('Invalid question attempt: correctness must be "correct", "wrong", or null')
    }
  }

  return attempt
}

/**
 * Pure deserialization — reverses serializeSubmittedAttempt.
 * Returns object if valid, null if malformed.
 * Never throws.
 */
export function deserializeSubmittedAttempt(stored: unknown): SubmittedAttempt | null {
  if (!stored || typeof stored !== 'object') {
    return null
  }

  const obj = stored as Record<string, unknown>

  if (typeof obj.id !== 'string' || !obj.id) return null
  if (!Array.isArray(obj.questionAttempts)) return null
  if (typeof obj.score !== 'number') return null
  if (typeof obj.max !== 'number') return null
  if (typeof obj.correct !== 'number') return null
  if (typeof obj.wrong !== 'number') return null
  if (typeof obj.unattempted !== 'number') return null
  if (typeof obj.timestamp !== 'number') return null

  // Validate each question attempt
  const questionAttempts: QuestionAttempt[] = []
  for (const qa of obj.questionAttempts as unknown[]) {
    if (!qa || typeof qa !== 'object') return null
    const qaObj = qa as Record<string, unknown>
    if (typeof qaObj.id !== 'string' || !qaObj.id) return null
    if (typeof qaObj.marks !== 'number') return null
    if (typeof qaObj.timeSpent !== 'number' || qaObj.timeSpent < 0) return null
    if (qaObj.correctness !== null && !['correct', 'wrong'].includes(qaObj.correctness as string)) return null

    questionAttempts.push({
      id: qaObj.id,
      response: qaObj.response as Response,
      correctness: qaObj.correctness as 'correct' | 'wrong' | null,
      marks: qaObj.marks,
      timeSpent: qaObj.timeSpent,
    })
  }

  return {
    id: obj.id,
    questionAttempts,
    score: obj.score,
    max: obj.max,
    correct: obj.correct,
    wrong: obj.wrong,
    unattempted: obj.unattempted,
    timestamp: obj.timestamp,
  }
}

/**
 * IndexedDB wrapper — serialize and save in-progress attempt.
 * Stores under key 'in-progress-attempt'.
 * Returns a Promise. Safe to call repeatedly (overwrites OK).
 */
export async function saveInProgressAttempt(attempt: InProgressAttempt): Promise<void> {
  try {
    const serialized = serializeInProgressAttempt(attempt)
    await set('in-progress-attempt', serialized)
  } catch (err) {
    console.error('Failed to save in-progress attempt:', err)
  }
}

/**
 * IndexedDB wrapper — load and deserialize in-progress attempt.
 * Returns object or null if not found or malformed.
 * Returns a Promise.
 */
export async function loadInProgressAttempt(): Promise<InProgressAttempt | null> {
  try {
    const stored = await get('in-progress-attempt')
    return deserializeInProgressAttempt(stored)
  } catch (err) {
    console.error('Failed to load in-progress attempt:', err)
    return null
  }
}

/**
 * IndexedDB wrapper — serialize and save submitted attempt.
 * Stores in 'attempts' ObjectStore keyed by attempt.id.
 * Initializes ObjectStore on first access if needed.
 * Returns a Promise with the id.
 */
export async function saveSubmittedAttempt(attempt: SubmittedAttempt): Promise<string> {
  try {
    const serialized = serializeSubmittedAttempt(attempt)
    // idb-keyval uses the default store, so we store with a namespaced key
    const key = `attempt:${attempt.id}`
    await set(key, serialized)
    return attempt.id
  } catch (err) {
    console.error('Failed to save submitted attempt:', err)
    throw err
  }
}

/**
 * IndexedDB wrapper — delete in-progress attempt.
 * Safe to call twice (no-op if already deleted).
 * Returns a Promise.
 */
export async function clearInProgressAttempt(): Promise<void> {
  try {
    await del('in-progress-attempt')
  } catch (err) {
    console.error('Failed to clear in-progress attempt:', err)
  }
}
