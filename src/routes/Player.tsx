import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useLocation, useNavigate } from 'react-router'
import { loadIndex, loadPaper, assetBase, useJson } from '../data'
import type { Response, Question } from '../data'
import { saveInProgressAttempt, loadInProgressAttempt, clearInProgressAttempt, saveSubmittedAttempt, type InProgressAttempt, type SubmittedAttempt } from '../storage'
import { scoreAttempt, scoreQuestion } from '../../scripts/lib/marking.mjs'
import { isAnswered } from '../attempt-state'
import { formatTime } from '../timer'
import QuestionPane from '../QuestionPane'
import Palette from '../Palette'
import BookmarkButton, { useBookmarks } from '../components/BookmarkButton'
import examsConfig from '../../exams.json'
import './player.css'

type RevealMode = 'immediate' | 'onSubmit'

interface SubjectConfig {
  topics: string[]
  count: number
  timedMinutes: number | null
  revealMode: 'immediate' | 'onSubmit'
  mode?: 'bookmarked'
  questions: { id: string; topic: string; type?: string }[]
  warnings: string[]
}

export default function Player() {
  const { slug, year: yearStr } = useParams()
  const year = yearStr ? parseInt(yearStr, 10) : 0
  const location = useLocation()

  const config = location.state?.config as SubjectConfig | undefined

  // A resumed attempt is read straight from storage rather than passed through
  // router state. Storage is already the source of truth, and navigating to the
  // URL the user is already on does not reliably deliver fresh location state —
  // which silently produced a player with none of the saved answers restored.
  const [resumedAttempt, setResumedAttempt] = useState<InProgressAttempt | undefined>(undefined)
  const [resumeChecked, setResumeChecked] = useState(false)

  useEffect(() => {
    if (config) {
      setResumeChecked(true)
      return
    }
    let cancelled = false
    loadInProgressAttempt()
      .then((a) => {
        if (cancelled) return
        setResumedAttempt(a ?? undefined)
        setResumeChecked(true)
      })
      .catch(() => {
        if (!cancelled) setResumeChecked(true)
      })
    return () => {
      cancelled = true
    }
  }, [config])

  // Entry point detection
  const isSubjectWise = Boolean(config) || Boolean(resumedAttempt) || (!slug && resumeChecked)

  const { data: index } = useJson(() => loadIndex(), [])
  const { data: paper } = useJson(
    () => (slug && year ? loadPaper(slug, year) : isSubjectWise ? Promise.resolve(null) : Promise.reject(new Error('Missing params'))),
    [slug, year, isSubjectWise]
  )

  const { isBookmarked, toggle: toggleBookmarked } = useBookmarks()
  const [current, setCurrent] = useState(0)
  const [responses, setResponses] = useState<Record<string, Response>>({})
  const [marked, setMarked] = useState<Record<string, boolean>>({})
  const [visited, setVisited] = useState<Record<string, boolean>>({})
  const [correctness, setCorrectness] = useState<Record<string, 'correct' | 'wrong' | null>>({})
  const [deadline, setDeadline] = useState<number>(Infinity)
  const [remaining, setRemaining] = useState<number>(Infinity)
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(isSubjectWise)
  const [currentQuestionStartedAt, setCurrentQuestionStartedAt] = useState<number | null>(null)
  const [timePerQuestion, setTimePerQuestion] = useState<Record<string, number>>({})
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const autoSubmitted = useRef(false)
  // Set the instant a submit begins. Blocks a double submit and, crucially, the
  // save effect's unmount write, which would otherwise re-create the in-progress
  // attempt that submit just cleared and bring the resume dialog back.
  const submittedRef = useRef(false)
  const [saveError, setSaveError] = useState(false)
  const navigate = useNavigate()
  // The auto-submit effect's closure is stale relative to finishAttempt's inputs,
  // so it calls through this ref (same pattern as latestAttempt below).
  const finishRef = useRef<() => Promise<void>>(async () => {})

  // Determine questions and loading state early so they can be used in useEffects
  const finalQuestions = isSubjectWise ? questions : paper?.questions ?? []
  const isLoading = isSubjectWise ? questionsLoading : !index || !paper
  // A resumed attempt carries its own revealMode and mode: config is absent on
  // resume, so falling back to config alone flipped a resumed practice attempt to
  // exam mode. A paper started from the year page passes a config object too, so
  // mode is decided by the URL first, not by the mere presence of config.
  const revealMode: RevealMode = resumedAttempt?.revealMode ?? config?.revealMode ?? 'onSubmit'
  const mode: SubmittedAttempt['mode'] =
    resumedAttempt?.mode ??
    (slug && year
      ? 'year-wise'
      : config?.mode === 'bookmarked'
        ? 'bookmarked'
        : (config?.topics?.length ?? 0) > 0
          ? 'subject-wise'
          : 'random')

  // Restore from resumed attempt if present
  useEffect(() => {
    if (!resumedAttempt) return

    setCurrent(resumedAttempt.current)
    setResponses(resumedAttempt.responses)
    setMarked(resumedAttempt.marked)
    setVisited(resumedAttempt.visited)
    setTimePerQuestion(resumedAttempt.timePerQuestion)
    setStartedAt(resumedAttempt.startedAt)
    setCurrentQuestionStartedAt(Date.now())

    // Recompute deadline from remainingMs
    if (resumedAttempt.timedMinutes !== null && resumedAttempt.remaining > 0) {
      const newDeadline = Date.now() + resumedAttempt.remaining
      setDeadline(newDeadline)
      setRemaining(resumedAttempt.remaining / 1000)
    }
  }, [resumedAttempt])

  // Initialize startedAt on first load (if not resuming)
  useEffect(() => {
    if (finalQuestions.length === 0 || startedAt !== null) return
    if (resumedAttempt) return // Don't reinitialize if resuming
    setStartedAt(Date.now())
    setCurrentQuestionStartedAt(Date.now())
  }, [finalQuestions.length, startedAt, resumedAttempt])

  // Load questions for subject-wise tests
  useEffect(() => {
    if (!isSubjectWise || !config || !index || resumedAttempt) return

    const loadSubjectQuestions = async () => {
      try {
        const loaded: Question[] = []
        const seen = new Set<string>()

        for (const indexQ of config.questions) {
          if (seen.has(indexQ.id)) continue
          seen.add(indexQ.id)

          // Find the exam and year for this question
          for (const exam of index.exams) {
            let found = false
            for (const y of exam.years) {
              const indexQuestion = y.questions.find((q) => q.id === indexQ.id)
              if (indexQuestion) {
                const paper = await loadPaper(exam.slug, y.year)
                const fullQuestion = paper.questions.find((q) => q.id === indexQ.id)
                if (fullQuestion) {
                  loaded.push(fullQuestion)
                  found = true
                  break
                }
              }
            }
            if (found) break
          }
        }

        setQuestions(loaded)
        setQuestionsLoading(false)
        autoSubmitted.current = false

        // Set up deadline if timed
        if (config.timedMinutes !== null) {
          const deadlineTime = Date.now() + config.timedMinutes * 60000
          setDeadline(deadlineTime)
        }
      } catch (err) {
        console.error('Failed to load subject questions:', err)
        setQuestionsLoading(false)
      }
    }

    loadSubjectQuestions()
  }, [isSubjectWise, config, index, resumedAttempt])

  // Rehydrate a resumed subject-wise/random attempt.
  //
  // The stored record holds question IDs, never question copies — that is what
  // lets attempt history survive the bank being edited. So on resume the
  // questions have to be fetched back from the index, in the order they were
  // stored. Without this the player resumes with an empty paper.
  useEffect(() => {
    if (!isSubjectWise || !resumedAttempt || !index) return

    let cancelled = false

    const rehydrate = async () => {
      try {
        const byId = new Map<string, Question>()

        for (const exam of index.exams) {
          for (const y of exam.years) {
            const wanted = y.questions.filter((q) => resumedAttempt.questionIds.includes(q.id))
            if (!wanted.length) continue
            const paper = await loadPaper(exam.slug, y.year)
            for (const q of paper.questions) {
              if (resumedAttempt.questionIds.includes(q.id)) byId.set(q.id, q)
            }
          }
        }

        if (cancelled) return

        // Preserve the stored order; drop any ID the bank no longer contains.
        const ordered = resumedAttempt.questionIds
          .map((id) => byId.get(id))
          .filter((q): q is Question => Boolean(q))

        setQuestions(ordered)
        setQuestionsLoading(false)
        autoSubmitted.current = false
      } catch (err) {
        console.error('Failed to rehydrate resumed attempt:', err)
        if (!cancelled) setQuestionsLoading(false)
      }
    }

    rehydrate()
    return () => {
      cancelled = true
    }
  }, [isSubjectWise, resumedAttempt, index])

  // Track time per question when current changes
  useEffect(() => {
    if (finalQuestions.length === 0 || currentQuestionStartedAt === null) return

    const prevIndex = current > 0 ? current - 1 : -1
    if (prevIndex >= 0) {
      const prevQ = finalQuestions[prevIndex]
      const elapsed = Date.now() - currentQuestionStartedAt
      setTimePerQuestion((prev) => ({
        ...prev,
        [prevQ.id]: (prev[prevQ.id] ?? 0) + elapsed,
      }))
    }

    setCurrentQuestionStartedAt(Date.now())
  }, [current, finalQuestions])

  // Timer interval
  useEffect(() => {
    if (deadline === Infinity) return

    const interval = setInterval(() => {
      const now = Date.now()
      const rem = Math.max(0, deadline - now)
      setRemaining(rem / 1000)
    }, 100)

    return () => clearInterval(interval)
  }, [deadline])

  // Auto-submit when time runs out
  useEffect(() => {
    if (submittedRef.current || autoSubmitted.current || remaining > 0) return
    autoSubmitted.current = true
    // Delay slightly to avoid state update conflicts
    const timeoutId = setTimeout(() => {
      const unanswered = finalQuestions.filter((q) => !isAnswered(responses[q.id] ?? null)).length
      const confirmed = window.confirm(`Submit? ${unanswered} question(s) unanswered.`)
      if (confirmed) void finishRef.current()
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [remaining, finalQuestions, responses])

  // Debounced save of in-progress attempt
  // Keep the latest attempt snapshot in a ref, rewritten on every render.
  //
  // The save cadence MUST NOT be driven by an effect that depends on `remaining`:
  // the timer updates it every 100ms, so a debounce timeout created in such an
  // effect is cleared by the cleanup ten times a second and never fires. That is
  // exactly why nothing was persisted on a timed test.
  const latestAttempt = useRef<InProgressAttempt | null>(null)
  latestAttempt.current =
    finalQuestions.length && startedAt && !questionsLoading
      ? {
          exam: slug || 'subject',
          year: year || undefined,
          mode,
          timedMinutes: deadline === Infinity ? null : Math.ceil((deadline - Date.now()) / 60000),
          revealMode,
          questionIds: finalQuestions.map((q) => q.id),
          responses,
          marked,
          visited,
          current,
          remaining: remaining * 1000, // seconds to ms; the clock pauses while closed
          startedAt,
          timePerQuestion,
        }
      : null

  // Write on a fixed cadence, independent of render frequency, plus once on the
  // way out so the final state is never lost.
  useEffect(() => {
    const write = () => {
      // After submit the in-progress attempt is gone on purpose; writing it back
      // (this also runs on unmount) would resurrect the resume dialog.
      if (submittedRef.current) return
      const attempt = latestAttempt.current
      if (attempt) {
        saveInProgressAttempt(attempt).catch((err) => {
          console.error('Failed to save in-progress attempt:', err)
        })
      }
    }

    const id = setInterval(write, 1000)

    // A reload or a closed tab does not run React cleanup reliably, so without
    // this the last up-to-1s of progress is lost — including the clock reading,
    // which is what makes a reload appear to consume time.
    const onLeave = () => write()
    window.addEventListener('pagehide', onLeave)
    document.addEventListener('visibilitychange', onLeave)

    return () => {
      clearInterval(id)
      window.removeEventListener('pagehide', onLeave)
      document.removeEventListener('visibilitychange', onLeave)
      write()
    }
  }, [])

  // Keyboard handler
  useEffect(() => {
    if (finalQuestions.length === 0) return

    const handleKeydown = (e: KeyboardEvent) => {
      // Don't fire number keys if focus is in a numeric input
      const active = document.activeElement
      const isNumericFocused = active instanceof HTMLInputElement && active.type === 'number'

      const q = finalQuestions[current]
      if (!q) return

      // Number keys (1-4): select options, but not if numeric input is focused
      if (!isNumericFocused && (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4')) {
        const idx = parseInt(e.key, 10) - 1
        if (q.type === 'single' && q.options && idx < q.options.length) {
          setResponses({ ...responses, [q.id]: [idx] })
        } else if (q.type === 'multi' && q.options && idx < q.options.length) {
          const curr = responses[q.id]
          const selected = Array.isArray(curr) ? [...curr] : []
          const pos = selected.indexOf(idx)
          if (pos >= 0) {
            selected.splice(pos, 1)
          } else {
            selected.push(idx)
          }
          setResponses({ ...responses, [q.id]: selected })
        }
      }

      // Enter: Save and Next (always works, even if numeric focused)
      if (e.key === 'Enter') {
        e.preventDefault()
        // Save current response if answered
        const draft = responses[q.id] ?? null
        const newResponses = { ...responses }
        if (isAnswered(draft)) {
          newResponses[q.id] = draft
        }
        setResponses(newResponses)

        // Compute correctness in practice mode
        if (revealMode === 'immediate' && isAnswered(draft)) {
          const result = scoreQuestion(examsConfig, q, draft)
          const c = result.status === 'correct' ? 'correct' : result.status === 'wrong' ? 'wrong' : null
          setCorrectness({ ...correctness, [q.id]: c })
        }

        // Clear the review flag when saving
        const newMarked = { ...marked }
        delete newMarked[q.id]
        setMarked(newMarked)

        if (current < finalQuestions.length - 1) {
          const nextIdx = current + 1
          setCurrent(nextIdx)
          const nextQ = finalQuestions[nextIdx]
          setVisited({ ...visited, [nextQ.id]: true })
        }
      }

      // M or m: Mark for Review and Next (not if numeric focused)
      if (!isNumericFocused && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault()
        const draft = responses[q.id] ?? null
        const newResponses = { ...responses }
        if (isAnswered(draft)) {
          newResponses[q.id] = draft
        } else {
          delete newResponses[q.id]
        }
        setResponses(newResponses)
        setMarked({ ...marked, [q.id]: true })

        if (current < finalQuestions.length - 1) {
          const nextIdx = current + 1
          setCurrent(nextIdx)
          const nextQ = finalQuestions[nextIdx]
          setVisited({ ...visited, [nextQ.id]: true })
        }
      }

      // Arrow keys: Navigate between questions (not if numeric focused)
      if (!isNumericFocused) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          if (current > 0) {
            setCurrent(current - 1)
            const prevQ = finalQuestions[current - 1]
            setVisited({ ...visited, [prevQ.id]: true })
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          if (current < finalQuestions.length - 1) {
            setCurrent(current + 1)
            const nextQ = finalQuestions[current + 1]
            setVisited({ ...visited, [nextQ.id]: true })
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [responses, finalQuestions, current, marked, visited, revealMode, correctness])

  if (isLoading) {
    return <div className="loading-state">Loading...</div>
  }

  if (finalQuestions.length === 0) {
    return (
      <div className="not-found-state">
        <p>No questions found.</p>
        <Link to="/">Back</Link>
      </div>
    )
  }

  if (!isSubjectWise && (!index || !paper)) {
    return (
      <div className="not-found-state">
        <p>Error loading exam.</p>
        <Link to="/">Back</Link>
      </div>
    )
  }

  if (!isSubjectWise) {
    const exam = index!.exams.find((e) => e.slug === slug)
    if (!exam) {
      return (
        <div className="not-found-state">
          <p>Exam not found.</p>
          <Link to="/">Back to exams</Link>
        </div>
      )
    }

    const yearData = exam.years.find((y) => y.year === year)
    if (!yearData) {
      return (
        <div className="not-found-state">
          <p>Year not found.</p>
          <Link to={`/exam/${slug}`}>Back to years</Link>
        </div>
      )
    }
  }

  const currentQuestion = finalQuestions[current]
  const draft = responses[currentQuestion.id] ?? null

  const handleDraft = (next: Response) => {
    const newResponses = { ...responses, [currentQuestion.id]: next }
    setResponses(newResponses)
  }

  const handleSaveNext = () => {
    if (isAnswered(draft)) {
      setResponses({ ...responses, [currentQuestion.id]: draft })
    }

    // Compute correctness in practice mode
    if (revealMode === 'immediate' && isAnswered(draft)) {
      const result = scoreQuestion(examsConfig, currentQuestion, draft)
      const c = result.status === 'correct' ? 'correct' : result.status === 'wrong' ? 'wrong' : null
      setCorrectness({ ...correctness, [currentQuestion.id]: c })
    }

    // Clear the review flag when saving
    const newMarked = { ...marked }
    delete newMarked[currentQuestion.id]
    setMarked(newMarked)

    if (current < finalQuestions.length - 1) {
      const nextIdx = current + 1
      setCurrent(nextIdx)
      const nextQ = finalQuestions[nextIdx]
      setVisited({ ...visited, [nextQ.id]: true })
    }
  }

  const handleClearResponse = () => {
    const newResponses = { ...responses }
    delete newResponses[currentQuestion.id]
    setResponses(newResponses)
  }

  const handleMarkForReviewNext = () => {
    if (isAnswered(draft)) {
      setResponses({ ...responses, [currentQuestion.id]: draft })
    } else {
      const newResponses = { ...responses }
      delete newResponses[currentQuestion.id]
      setResponses(newResponses)
    }
    setMarked({ ...marked, [currentQuestion.id]: true })

    if (current < finalQuestions.length - 1) {
      const nextIdx = current + 1
      setCurrent(nextIdx)
      const nextQ = finalQuestions[nextIdx]
      setVisited({ ...visited, [nextQ.id]: true })
    }
  }

  const finishAttempt = async () => {
    if (submittedRef.current) return
    submittedRef.current = true

    const score = scoreAttempt(examsConfig, finalQuestions, responses)

    // Record submitted attempt with per-question detail
    const timeOnCurrentQ = currentQuestionStartedAt ? Date.now() - currentQuestionStartedAt : 0
    const attemptRecord: SubmittedAttempt = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      exam: slug || 'subject',
      year: year || undefined,
      mode,
      timedMinutes: deadline === Infinity ? null : Math.ceil((deadline - Date.now()) / 60000),
      revealMode,
      score: score.score,
      max: score.max,
      correct: score.correct,
      wrong: score.wrong,
      unattempted: score.unattempted,
      questions: finalQuestions.map(q => {
        const qResult = score.results.find((r: any) => r.id === q.id)
        // Add elapsed time for the current question if still on it
        let timeOnQ = timePerQuestion[q.id] ?? 0
        if (q.id === finalQuestions[current].id) {
          timeOnQ += timeOnCurrentQ
        }
        const status = qResult?.status ?? 'unattempted'
        const correctness: 'correct' | 'wrong' | null =
          status === 'correct' ? 'correct' : status === 'wrong' ? 'wrong' : null
        return {
          id: q.id,
          response: responses[q.id] ?? null,
          correctness,
          marks: qResult?.score ?? 0,
          timeSpent: Math.floor(timeOnQ / 1000), // Convert ms to seconds
        }
      })
    }

    // The in-progress attempt is cleared only after the record is safely stored,
    // so a failed save leaves the attempt resumable.
    try {
      await saveSubmittedAttempt(attemptRecord)
      await clearInProgressAttempt()
      navigate(`/results/${attemptRecord.id}`, { replace: true })
    } catch (err) {
      console.error('Failed to save submitted attempt:', err)
      submittedRef.current = false
      setSaveError(true)
    }
  }
  finishRef.current = finishAttempt

  const handleSubmit = () => {
    const unanswered = finalQuestions.filter((q) => !isAnswered(responses[q.id] ?? null)).length
    const confirmed = window.confirm(`Submit? ${unanswered} question(s) unanswered.`)
    if (confirmed) void finishAttempt()
  }

  if (!visited[currentQuestion.id]) {
    setVisited({ ...visited, [currentQuestion.id]: true })
  }

  const paneAssetBase = isSubjectWise ? '' : assetBase(slug!, year)

  return (
    <div className="player">
      <div className="player-main">
        <div className="player-header">
          <span className="player-progress">
            Question <span className="mono-num">{current + 1}</span> of{' '}
            <span className="mono-num">{finalQuestions.length}</span>
          </span>
          {deadline !== Infinity && Number.isFinite(remaining) && (
            <span className="player-clock">{formatTime(Math.max(0, remaining))}</span>
          )}
        </div>

        <div className="player-question-body">
          <QuestionPane
            key={currentQuestion.id}
            question={currentQuestion}
            number={current + 1}
            assetBase={paneAssetBase}
            draft={draft}
            onDraft={handleDraft}
          />
        </div>

        {saveError && (
          <div className="alert-error" role="alert">
            Your attempt could not be saved. Press Submit again.
          </div>
        )}
        <div className="player-controls">
          <button className="btn" onClick={handleSaveNext}>
            Save &amp; Next
          </button>
          <button className="btn" onClick={handleClearResponse}>
            Clear Response
          </button>
          <button className="btn" onClick={handleMarkForReviewNext}>
            Mark for Review &amp; Next
          </button>
          <BookmarkButton
            bookmarked={isBookmarked(currentQuestion.id)}
            onToggle={() => toggleBookmarked(currentQuestion.id)}
          />
          <button className="btn btn-primary player-submit" onClick={handleSubmit}>
            Submit
          </button>
        </div>
      </div>

      <div className="player-rail">
        <Palette
          questions={finalQuestions}
          current={current}
          responses={responses}
          marked={marked}
          visited={visited}
          correctness={correctness}
          onJump={(idx) => {
            setCurrent(idx)
            const q = finalQuestions[idx]
            setVisited({ ...visited, [q.id]: true })
          }}
        />
      </div>
    </div>
  )
}
