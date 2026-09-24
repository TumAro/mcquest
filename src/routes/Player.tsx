import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useLocation } from 'react-router'
import { loadIndex, loadPaper, assetBase, useJson } from '../data'
import type { Response, Question } from '../data'
import { scoreAttempt, scoreQuestion } from '../../scripts/lib/marking.mjs'
import { isAnswered } from '../attempt-state'
import { formatTime } from '../timer'
import QuestionPane from '../QuestionPane'
import Palette from '../Palette'
import examsConfig from '../../exams.json'

type RevealMode = 'immediate' | 'onSubmit'

interface SubjectConfig {
  topics: string[]
  count: number
  timedMinutes: number | null
  revealMode: 'immediate' | 'onSubmit'
  questions: { id: string; topic: string; type?: string }[]
  warnings: string[]
}

export default function Player() {
  const { slug, year: yearStr } = useParams()
  const year = yearStr ? parseInt(yearStr, 10) : 0
  const location = useLocation()

  // Entry point detection
  const isSubjectWise = location.state?.config
  const config = location.state?.config as SubjectConfig | undefined

  const { data: index } = useJson(() => loadIndex(), [])
  const { data: paper } = useJson(
    () => (slug && year ? loadPaper(slug, year) : isSubjectWise ? Promise.resolve(null) : Promise.reject(new Error('Missing params'))),
    [slug, year, isSubjectWise]
  )

  const [current, setCurrent] = useState(0)
  const [responses, setResponses] = useState<Record<string, Response>>({})
  const [marked, setMarked] = useState<Record<string, boolean>>({})
  const [visited, setVisited] = useState<Record<string, boolean>>({})
  const [result, setResult] = useState<{ score: number; max: number; correct: number; wrong: number; unattempted: number } | null>(null)
  const [correctness, setCorrectness] = useState<Record<string, 'correct' | 'wrong' | null>>({})
  const [deadline, setDeadline] = useState<number>(Infinity)
  const [remaining, setRemaining] = useState<number>(Infinity)
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(isSubjectWise)
  const autoSubmitted = useRef(false)

  // Determine questions and loading state early so they can be used in useEffects
  const finalQuestions = isSubjectWise ? questions : paper?.questions ?? []
  const isLoading = isSubjectWise ? questionsLoading : !index || !paper
  const revealMode: RevealMode = config?.revealMode ?? 'onSubmit'

  // Load questions for subject-wise tests
  useEffect(() => {
    if (!isSubjectWise || !config || !index) return

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
  }, [isSubjectWise, config, index])

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
    if (result || autoSubmitted.current || remaining > 0) return
    autoSubmitted.current = true
    // Delay slightly to avoid state update conflicts
    const timeoutId = setTimeout(() => {
      const unanswered = finalQuestions.filter((q) => !isAnswered(responses[q.id] ?? null)).length
      const confirmed = window.confirm(`Submit? ${unanswered} question(s) unanswered.`)
      if (confirmed) {
        const score = scoreAttempt(examsConfig, finalQuestions, responses)
        setResult(score)
      }
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [remaining, result, finalQuestions, responses])

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
    return <div style={{ padding: '1rem' }}>Loading...</div>
  }

  if (finalQuestions.length === 0) {
    return (
      <div style={{ padding: '1rem' }}>
        <p>No questions found.</p>
        <Link to="/">Back</Link>
      </div>
    )
  }

  if (!isSubjectWise && (!index || !paper)) {
    return (
      <div style={{ padding: '1rem' }}>
        <p>Error loading exam.</p>
        <Link to="/">Back</Link>
      </div>
    )
  }

  if (!isSubjectWise) {
    const exam = index!.exams.find((e) => e.slug === slug)
    if (!exam) {
      return (
        <div style={{ padding: '1rem' }}>
          <p>Exam not found.</p>
          <Link to="/">Back to exams</Link>
        </div>
      )
    }

    const yearData = exam.years.find((y) => y.year === year)
    if (!yearData) {
      return (
        <div style={{ padding: '1rem' }}>
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

  const handleSubmit = () => {
    const unanswered = finalQuestions.filter((q) => !isAnswered(responses[q.id] ?? null)).length
    const confirmed = window.confirm(`Submit? ${unanswered} question(s) unanswered.`)
    if (confirmed) {
      const score = scoreAttempt(examsConfig, finalQuestions, responses)
      setResult(score)
    }
  }

  if (!visited[currentQuestion.id]) {
    setVisited({ ...visited, [currentQuestion.id]: true })
  }

  const paneAssetBase = isSubjectWise ? '' : assetBase(slug!, year)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: '1rem',
        minHeight: '100vh',
      }}
    >
      <div>
        <div style={{ padding: '1rem', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            Question {current + 1} of {finalQuestions.length}
          </span>
          {deadline !== Infinity && (
            <span style={{ fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {formatTime(Math.max(0, remaining))}
            </span>
          )}
        </div>

        <QuestionPane
          key={currentQuestion.id}
          question={currentQuestion}
          number={current + 1}
          assetBase={paneAssetBase}
          draft={draft}
          onDraft={handleDraft}
        />

        {!result ? (
          <div style={{ padding: '1rem', borderTop: '1px solid #ccc', display: 'flex', gap: '1rem' }}>
            <button onClick={handleSaveNext} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
              Save &amp; Next
            </button>
            <button onClick={handleClearResponse} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
              Clear Response
            </button>
            <button onClick={handleMarkForReviewNext} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
              Mark for Review &amp; Next
            </button>
            <button onClick={handleSubmit} style={{ padding: '0.5rem 1rem', cursor: 'pointer', marginLeft: 'auto' }}>
              Submit
            </button>
          </div>
        ) : (
          <div style={{ padding: '1rem', borderTop: '1px solid #ccc' }}>
            <p style={{ margin: '0 0 0.5rem 0' }}>
              Score: {Math.round(result.score * 100) / 100} / {result.max} — {result.correct} correct, {result.wrong} wrong, {result.unattempted} unattempted
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#666' }}>Attempt submitted. Further changes are not scored.</p>
          </div>
        )}
      </div>

      <div style={{ borderLeft: '1px solid #ccc', backgroundColor: '#fafafa' }}>
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

      {/* Mobile: single column below 900px; drawer handles palette visibility */}
      <style>{`
        @media (max-width: 900px) {
          div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
