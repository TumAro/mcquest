import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { loadIndex, loadQuestionsById, useJson } from '../data'
import type { Response, Question } from '../data'
import { saveInProgressAttempt, loadInProgressAttempt, clearInProgressAttempt, saveSubmittedAttempt, type InProgressAttempt, type SubmittedAttempt } from '../storage'
import type { StartConfig } from '../start'
import { scoreAttempt, scoreQuestion } from '../../scripts/lib/marking.mjs'
import { isAnswered } from '../attempt-state'
import { formatTime } from '../timer'
import QuestionPane from '../QuestionPane'
import Palette from '../Palette'
import BookmarkButton, { useBookmarks } from '../components/BookmarkButton'
import examsConfig from '../../exams.json'
import './player.css'

export default function Player() {
  const location = useLocation()

  // A fresh start is a config in router state. With none, this is a resume: the
  // attempt is read straight from storage, which is already the source of truth
  // (navigating to the URL the user is already on does not reliably deliver
  // fresh location state).
  const config = location.state?.config as StartConfig | undefined

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

  const { data: index } = useJson(() => loadIndex(), [])

  const { isBookmarked, toggle: toggleBookmarked } = useBookmarks()
  const [current, setCurrent] = useState(0)
  const [responses, setResponses] = useState<Record<string, Response>>({})
  const [marked, setMarked] = useState<Record<string, boolean>>({})
  const [visited, setVisited] = useState<Record<string, boolean>>({})
  const [correctness, setCorrectness] = useState<Record<string, 'correct' | 'wrong' | null>>({})
  const [deadline, setDeadline] = useState<number>(Infinity)
  const [remaining, setRemaining] = useState<number>(Infinity)
  const [questions, setQuestions] = useState<Question[]>([])
  const [assetBases, setAssetBases] = useState<Record<string, string>>({})
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [currentQuestionStartedAt, setCurrentQuestionStartedAt] = useState<number | null>(null)
  const [timePerQuestion, setTimePerQuestion] = useState<Record<string, number>>({})
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const autoSubmitted = useRef(false)
  const clockIndexRef = useRef(0)
  // Set the instant a submit begins. Blocks a double submit and, crucially, the
  // save effect's unmount write, which would otherwise re-create the in-progress
  // attempt that submit just cleared and bring the resume dialog back.
  const submittedRef = useRef(false)
  const [saveError, setSaveError] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const navigate = useNavigate()
  // The auto-submit effect's closure is stale relative to finishAttempt's inputs,
  // so it calls through this ref (same pattern as latestAttempt below).
  const finishRef = useRef<() => Promise<void>>(async () => {})

  // A resumed attempt carries its own revealMode, mode, exam and year: config is
  // absent on resume, so falling back to config alone flipped a resumed practice
  // attempt to exam mode.
  const revealMode = resumedAttempt?.revealMode ?? config?.revealMode ?? 'onSubmit'
  const mode: SubmittedAttempt['mode'] = resumedAttempt?.mode ?? config?.mode ?? 'random'
  const exam = resumedAttempt?.exam ?? config?.exam ?? 'subject'
  const year = resumedAttempt?.year ?? config?.year

  // Restore from resumed attempt if present
  useEffect(() => {
    if (!resumedAttempt) return

    setCurrent(resumedAttempt.current)
    clockIndexRef.current = resumedAttempt.current
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
    if (questions.length === 0 || startedAt !== null) return
    if (resumedAttempt) return // Don't reinitialize if resuming
    setStartedAt(Date.now())
    setCurrentQuestionStartedAt(Date.now())
  }, [questions.length, startedAt, resumedAttempt])

  // The one load path. The stored record holds question IDs, never question
  // copies, so a fresh config and a resumed attempt both come back through the
  // ids; loadQuestionsById keeps each question's own asset base beside it.
  useEffect(() => {
    if (!index || !resumeChecked) return
    const wanted = config ? config.questions.map((q) => q.id) : (resumedAttempt?.questionIds ?? [])

    let cancelled = false
    loadQuestionsById(index, wanted)
      .then((byId) => {
        if (cancelled) return
        // Keep the stored order; drop any ID the bank no longer holds.
        const loaded = wanted.flatMap((id) => byId.get(id) ?? [])
        setQuestions(loaded.map((l) => l.question))
        setAssetBases(Object.fromEntries(loaded.map((l) => [l.question.id, l.assetBase])))
        setQuestionsLoading(false)
        autoSubmitted.current = false
        if (config && config.timedMinutes !== null) setDeadline(Date.now() + config.timedMinutes * 60000)
      })
      .catch((err) => {
        console.error('Failed to load questions:', err)
        if (!cancelled) setQuestionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [index, resumeChecked, config, resumedAttempt])

  // Track time per question when current changes. The ref holds the index whose
  // clock is running, so the time is credited to the question that was left
  // however it was left (Save & Next, palette jump either way, arrow key).
  useEffect(() => {
    if (questions.length === 0 || currentQuestionStartedAt === null) return
    if (clockIndexRef.current === current) return

    const leftQ = questions[clockIndexRef.current]
    if (leftQ) {
      const elapsed = Date.now() - currentQuestionStartedAt
      setTimePerQuestion((prev) => ({
        ...prev,
        [leftQ.id]: (prev[leftQ.id] ?? 0) + elapsed,
      }))
    }

    clockIndexRef.current = current
    setCurrentQuestionStartedAt(Date.now())
  }, [current, questions])

  // Timer interval
  useEffect(() => {
    if (deadline === Infinity) return

    const interval = setInterval(() => {
      const now = Date.now()
      const rem = Math.max(0, deadline - now)
      setRemaining(rem / 1000)
    }, 1000)

    return () => clearInterval(interval)
  }, [deadline])

  // Auto-submit when time runs out
  useEffect(() => {
    if (submittedRef.current || autoSubmitted.current || remaining > 0) return
    autoSubmitted.current = true
    void finishRef.current() // time-up submits without asking
  }, [remaining])

  useEffect(() => {
    if (!confirming) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirming(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirming])

  // Debounced save of in-progress attempt
  // Keep the latest attempt snapshot in a ref, rewritten on every render.
  //
  // The save cadence MUST NOT be driven by an effect that depends on `remaining`:
  // a debounce timeout created in such an effect is cleared by the cleanup on
  // every tick and never fires. That is exactly why nothing was persisted on a
  // timed test. `remaining` is not in the snapshot: write() computes it from the
  // deadline at write time, so it is exact however rarely the clock re-renders.
  const deadlineRef = useRef(deadline)
  deadlineRef.current = deadline
  const latestAttempt = useRef<Omit<InProgressAttempt, 'remaining'> | null>(null)
  latestAttempt.current =
    questions.length && startedAt && !questionsLoading
      ? {
          exam,
          year,
          mode,
          timedMinutes: deadline === Infinity ? null : Math.ceil((deadline - Date.now()) / 60000),
          revealMode,
          questionIds: questions.map((q) => q.id),
          responses,
          marked,
          visited,
          current,
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
        // The clock pauses while closed; infinite when there is no deadline.
        const remaining = Math.max(0, deadlineRef.current - Date.now())
        saveInProgressAttempt({ ...attempt, remaining }).catch((err) => {
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
    if (questions.length === 0) return

    const handleKeydown = (e: KeyboardEvent) => {
      // Don't fire number keys if focus is in a numeric input
      const active = document.activeElement
      const isNumericFocused = active instanceof HTMLInputElement && active.type === 'number'

      const q = questions[current]
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

        if (current < questions.length - 1) {
          const nextIdx = current + 1
          setCurrent(nextIdx)
          const nextQ = questions[nextIdx]
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

        if (current < questions.length - 1) {
          const nextIdx = current + 1
          setCurrent(nextIdx)
          const nextQ = questions[nextIdx]
          setVisited({ ...visited, [nextQ.id]: true })
        }
      }

      // Arrow keys: Navigate between questions (not if numeric focused)
      if (!isNumericFocused) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          if (current > 0) {
            setCurrent(current - 1)
            const prevQ = questions[current - 1]
            setVisited({ ...visited, [prevQ.id]: true })
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          if (current < questions.length - 1) {
            setCurrent(current + 1)
            const nextQ = questions[current + 1]
            setVisited({ ...visited, [nextQ.id]: true })
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [responses, questions, current, marked, visited, revealMode, correctness])

  if (questionsLoading) {
    return <div className="loading-state">Loading...</div>
  }

  if (questions.length === 0) {
    return (
      <div className="not-found-state">
        <p>No questions found.</p>
        <Link to="/">Back</Link>
      </div>
    )
  }

  const currentQuestion = questions[current]
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

    if (current < questions.length - 1) {
      const nextIdx = current + 1
      setCurrent(nextIdx)
      const nextQ = questions[nextIdx]
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

    if (current < questions.length - 1) {
      const nextIdx = current + 1
      setCurrent(nextIdx)
      const nextQ = questions[nextIdx]
      setVisited({ ...visited, [nextQ.id]: true })
    }
  }

  const finishAttempt = async () => {
    if (submittedRef.current) return
    submittedRef.current = true

    const score = scoreAttempt(examsConfig, questions, responses)

    // Record submitted attempt with per-question detail
    const timeOnCurrentQ = currentQuestionStartedAt ? Date.now() - currentQuestionStartedAt : 0
    const attemptRecord: SubmittedAttempt = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      exam,
      year,
      mode,
      timedMinutes: deadline === Infinity ? null : Math.ceil((deadline - Date.now()) / 60000),
      revealMode,
      score: score.score,
      max: score.max,
      correct: score.correct,
      wrong: score.wrong,
      unattempted: score.unattempted,
      questions: questions.map(q => {
        const qResult = score.results.find((r: any) => r.id === q.id)
        // Add elapsed time for the current question if still on it
        let timeOnQ = timePerQuestion[q.id] ?? 0
        if (q.id === questions[current].id) {
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

  const unanswered = questions.filter((q) => !isAnswered(responses[q.id] ?? null)).length

  if (!visited[currentQuestion.id]) {
    setVisited({ ...visited, [currentQuestion.id]: true })
  }

  return (
    <div className="player">
      <div className="player-main">
        <div className="player-header">
          <span className="player-progress">
            Question <span className="mono-num">{current + 1}</span> of{' '}
            <span className="mono-num">{questions.length}</span>
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
            assetBase={assetBases[currentQuestion.id]}
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
          <button className="btn btn-primary player-submit" onClick={() => setConfirming(true)}>
            Submit
          </button>
        </div>
      </div>

      {confirming && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="submit-title">
            <h2 className="modal-title" id="submit-title">Submit test?</h2>
            <p className="modal-body">
              {unanswered === 0 ? 'Every question is answered.' : `${unanswered} question(s) unanswered.`}
            </p>
            <div className="modal-actions">
              <button className="btn" autoFocus onClick={() => setConfirming(false)}>
                Keep working
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setConfirming(false)
                  void finishAttempt()
                }}
              >
                Submit test
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="player-rail">
        <Palette
          questions={questions}
          current={current}
          responses={responses}
          marked={marked}
          visited={visited}
          correctness={correctness}
          onJump={(idx) => {
            setCurrent(idx)
            const q = questions[idx]
            setVisited({ ...visited, [q.id]: true })
          }}
        />
      </div>
    </div>
  )
}
