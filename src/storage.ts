import { set, get, del, update, entries } from 'idb-keyval'

const TEST_MODES = ['year-wise', 'subject-wise', 'random', 'bookmarked'] as const
export type TestMode = (typeof TEST_MODES)[number]
const isTestMode = (m: unknown): m is TestMode => (TEST_MODES as readonly unknown[]).includes(m)

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
  mode: TestMode
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
  timestamp: number
  exam: string
  year?: number
  mode: TestMode
  timedMinutes: number | null
  revealMode: 'immediate' | 'onSubmit'
  score: number
  max: number
  correct: number
  wrong: number
  unattempted: number
  questions: QuestionAttempt[]
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
  if (!isTestMode(attempt.mode)) {
    throw new Error('Invalid in-progress attempt: mode must be "year-wise", "subject-wise", "random", or "bookmarked"')
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
  if (!isTestMode(obj.mode)) return null
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
    mode: obj.mode as TestMode,
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
  if (typeof attempt.timestamp !== 'number') {
    throw new Error('Invalid submitted attempt: timestamp must be a number')
  }
  if (!attempt.exam || typeof attempt.exam !== 'string') {
    throw new Error('Invalid submitted attempt: exam must be a non-empty string')
  }
  if (attempt.year !== undefined && typeof attempt.year !== 'number') {
    throw new Error('Invalid submitted attempt: year must be a number or undefined')
  }
  if (!isTestMode(attempt.mode)) {
    throw new Error('Invalid submitted attempt: mode must be "year-wise", "subject-wise", "random", or "bookmarked"')
  }
  if (attempt.timedMinutes !== null && typeof attempt.timedMinutes !== 'number') {
    throw new Error('Invalid submitted attempt: timedMinutes must be a number or null')
  }
  if (!['immediate', 'onSubmit'].includes(attempt.revealMode)) {
    throw new Error('Invalid submitted attempt: revealMode must be "immediate" or "onSubmit"')
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
  if (!Array.isArray(attempt.questions)) {
    throw new Error('Invalid submitted attempt: questions must be an array')
  }

  // Validate each question attempt
  for (const qa of attempt.questions) {
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
  if (typeof obj.timestamp !== 'number') return null
  if (typeof obj.exam !== 'string' || !obj.exam) return null
  if (obj.year !== undefined && typeof obj.year !== 'number') return null
  if (!isTestMode(obj.mode)) return null
  if (obj.timedMinutes !== null && typeof obj.timedMinutes !== 'number') return null
  if (!['immediate', 'onSubmit'].includes(obj.revealMode as string)) return null
  if (typeof obj.score !== 'number') return null
  if (typeof obj.max !== 'number') return null
  if (typeof obj.correct !== 'number') return null
  if (typeof obj.wrong !== 'number') return null
  if (typeof obj.unattempted !== 'number') return null
  if (!Array.isArray(obj.questions)) return null

  // Validate each question attempt
  const questions: QuestionAttempt[] = []
  for (const qa of obj.questions as unknown[]) {
    if (!qa || typeof qa !== 'object') return null
    const qaObj = qa as Record<string, unknown>
    if (typeof qaObj.id !== 'string' || !qaObj.id) return null
    if (typeof qaObj.marks !== 'number') return null
    if (typeof qaObj.timeSpent !== 'number' || qaObj.timeSpent < 0) return null
    if (qaObj.correctness !== null && !['correct', 'wrong'].includes(qaObj.correctness as string)) return null

    questions.push({
      id: qaObj.id,
      response: qaObj.response as Response,
      correctness: qaObj.correctness as 'correct' | 'wrong' | null,
      marks: qaObj.marks,
      timeSpent: qaObj.timeSpent,
    })
  }

  return {
    id: obj.id,
    timestamp: obj.timestamp as number,
    exam: obj.exam as string,
    year: obj.year as number | undefined,
    mode: obj.mode as TestMode,
    timedMinutes: obj.timedMinutes as number | null,
    revealMode: obj.revealMode as 'immediate' | 'onSubmit',
    score: obj.score as number,
    max: obj.max as number,
    correct: obj.correct as number,
    wrong: obj.wrong as number,
    unattempted: obj.unattempted as number,
    questions,
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
 * IndexedDB wrapper — load one submitted attempt by id.
 * Reads the key saveSubmittedAttempt writes. Returns null when missing or
 * malformed, like loadInProgressAttempt.
 */
export async function loadSubmittedAttempt(id: string): Promise<SubmittedAttempt | null> {
  try {
    const stored = await get(`attempt:${id}`)
    return deserializeSubmittedAttempt(stored)
  } catch (err) {
    console.error('Failed to load submitted attempt:', err)
    return null
  }
}

/**
 * Pure: every stored submitted attempt, oldest first. Only `attempt:`-prefixed
 * string keys are read (the same store also holds 'in-progress-attempt' and
 * 'bookmarks'); malformed values are dropped. Records pass through untouched,
 * so every question's `timeSpent` survives into stats history.
 */
export function attemptsFromEntries(all: ReadonlyArray<readonly [unknown, unknown]>): SubmittedAttempt[] {
  const out: SubmittedAttempt[] = []
  for (const [key, value] of all) {
    if (typeof key !== 'string' || !key.startsWith('attempt:')) continue
    const attempt = deserializeSubmittedAttempt(value)
    if (attempt) out.push(attempt)
  }
  return out.sort((a, b) => a.timestamp - b.timestamp)
}

/** IndexedDB wrapper — every stored submitted attempt, oldest first. Empty on failure. */
export async function loadSubmittedAttempts(): Promise<SubmittedAttempt[]> {
  try {
    return attemptsFromEntries(await entries())
  } catch (err) {
    console.error('Failed to load submitted attempts:', err)
    return []
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

// Permanent bookmarks: a plain array of question ids, nothing else (D-06).
// Deliberately separate from per-attempt `marked` flags (D-05).
const BOOKMARKS_KEY = 'bookmarks'

/** Pure: anything but an array of non-empty strings degrades to a clean, de-duplicated list. */
export function deserializeBookmarks(stored: unknown): string[] {
  if (!Array.isArray(stored)) return []
  return [...new Set(stored.filter((x): x is string => typeof x === 'string' && x !== ''))]
}

/** Pure: returns a new list with `id` added (at the end) or removed. Never mutates `list`. */
export function toggleBookmarkIn(list: readonly string[], id: string): string[] {
  if (typeof id !== 'string' || id === '') return [...list]
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

export async function loadBookmarks(): Promise<string[]> {
  try {
    return deserializeBookmarks(await get(BOOKMARKS_KEY))
  } catch (err) {
    console.error('Failed to load bookmarks:', err)
    return []
  }
}

/**
 * Toggle one bookmark and return the resulting list. idb-keyval `update` does the
 * read and the write in one transaction, so two quick toggles cannot lose one.
 */
export async function toggleBookmark(id: string): Promise<string[]> {
  try {
    await update(BOOKMARKS_KEY, (cur) => toggleBookmarkIn(deserializeBookmarks(cur), id))
  } catch (err) {
    console.error('Failed to toggle bookmark:', err)
  }
  return loadBookmarks()
}
