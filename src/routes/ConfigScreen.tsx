import { useState, type ReactNode } from 'react'
import { selectQuestions } from '../QuestionSelection'
import TestOptions from './TestOptions'
import BackLink from '../components/BackLink'
import type { RevealMode } from '../storage'
import type { DataIndex, IndexQuestion } from '../data'
import './config-screen.css'

interface ConfigScreenProps {
  index: DataIndex
  title: string
  showTopics?: boolean
  initialTopics?: Set<string>
  initialRevealMode?: RevealMode
  /** A pre-built pool (bookmarks): no topic or count controls, Start uses exactly these. */
  fixedQuestions?: IndexQuestion[]
  mode?: 'bookmarked'
  lede?: ReactNode
  /** Where the back link goes. The front page unless an entry point says otherwise. */
  backTo?: string
  onStart: (config: TestConfig) => void
}

export interface TestConfig {
  topics: string[]
  count: number
  timedMinutes: number | null
  revealMode: RevealMode
  questions: IndexQuestion[]
  warnings: string[]
  mode?: 'bookmarked'
}

export default function ConfigScreen({
  index,
  title,
  showTopics = true,
  initialTopics = new Set(),
  initialRevealMode = 'immediate',
  fixedQuestions,
  mode,
  lede,
  backTo = '/',
  onStart,
}: ConfigScreenProps) {
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(initialTopics)
  const [count, setCount] = useState(5)
  const [timed, setTimed] = useState(true)
  const [minutes, setMinutes] = useState(120)
  const [revealMode, setRevealMode] = useState<RevealMode>(initialRevealMode)
  const [error, setError] = useState('')
  const [poolWarning, setPoolWarning] = useState<{ message: string; actualCount: number } | null>(null)

  const handleTopicChange = (topic: string) => {
    const newSelected = new Set(selectedTopics)
    if (newSelected.has(topic)) {
      newSelected.delete(topic)
    } else {
      newSelected.add(topic)
    }
    setSelectedTopics(newSelected)
  }

  const handleSubjectChange = (slugs: string[], select: boolean) => {
    const newSelected = new Set(selectedTopics)
    for (const slug of slugs) {
      if (select) newSelected.add(slug)
      else newSelected.delete(slug)
    }
    setSelectedTopics(newSelected)
  }

  const handleStart = () => {
    setError('')
    setPoolWarning(null)

    if (fixedQuestions) {
      onStart({
        topics: [],
        count: fixedQuestions.length,
        timedMinutes: timed ? minutes : null,
        revealMode,
        questions: fixedQuestions,
        warnings: [],
        mode,
      })
      return
    }

    const topicsToUse = showTopics ? selectedTopics : new Set(Object.keys(index.topics).flatMap(categorySlug => Object.keys(index.topics[categorySlug].topics)))

    if (topicsToUse.size === 0) {
      setError('Please select at least one topic')
      return
    }

    if (count <= 0) {
      setError('Question count must be greater than 0')
      return
    }

    // Select questions from the pool
    const selection = selectQuestions(index, Array.from(topicsToUse), count)

    if (selection.questions.length === 0) {
      setError('No questions found for the selected topics')
      return
    }

    // If there's a warning, show the warning dialog instead of navigating
    if (selection.warnings.length > 0) {
      setPoolWarning({
        message: selection.warnings[0],
        actualCount: selection.questions.length,
      })
      return
    }

    // No warning, proceed directly
    proceedToTest(selection, topicsToUse)
  }

  const proceedToTest = (selection: { questions: IndexQuestion[]; warnings: string[] }, topicsToUse: Set<string>) => {
    const config: TestConfig = {
      topics: Array.from(topicsToUse),
      count,
      timedMinutes: timed ? minutes : null,
      revealMode,
      questions: selection.questions,
      warnings: selection.warnings,
    }

    onStart(config)
  }

  const handleProceedWithWarning = () => {
    const topicsToUse = showTopics ? selectedTopics : new Set(Object.keys(index.topics).flatMap(categorySlug => Object.keys(index.topics[categorySlug].topics)))
    const selection = selectQuestions(index, Array.from(topicsToUse), count)
    proceedToTest(selection, topicsToUse)
  }

  const maxAvailable = index.exams.reduce((sum, exam) => {
    return sum + exam.years.reduce((yearSum, year) => yearSum + year.count, 0)
  }, 0)

  const topicsMap = index.topics

  return (
    <div className="page">
      <BackLink to={backTo} />
      <h1>{title}</h1>
      {lede}

      {showTopics && !fixedQuestions && (
        <div className="field-group">
          <h2>Topics</h2>
          {Object.entries(topicsMap).map(([categorySlug, category]) => {
            const slugs = Object.keys(category.topics)
            const chosen = slugs.filter((s) => selectedTopics.has(s)).length
            return (
              <details key={categorySlug} className="topics-subject">
                <summary className="topics-subject-summary">
                  <input
                    type="checkbox"
                    aria-label={`All of ${category.label}`}
                    checked={chosen === slugs.length}
                    // Partial selection reads as neither on nor off.
                    ref={(el) => {
                      if (el) el.indeterminate = chosen > 0 && chosen < slugs.length
                    }}
                    // A checkbox inside a summary would otherwise also toggle the disclosure.
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => handleSubjectChange(slugs, chosen < slugs.length)}
                  />
                  <span className="topics-subject-name">{category.label}</span>
                  <span className="topics-subject-count">
                    {chosen}/{slugs.length}
                  </span>
                </summary>
                <div className="topics-list">
                  {Object.entries(category.topics).map(([topicSlug, topicLabel]) => (
                    <label key={topicSlug} className="option-row">
                      <input
                        type="checkbox"
                        checked={selectedTopics.has(topicSlug)}
                        onChange={() => handleTopicChange(topicSlug)}
                      />
                      <span>{topicLabel}</span>
                    </label>
                  ))}
                </div>
              </details>
            )
          })}
        </div>
      )}

      {!fixedQuestions && <div className="field-group">
        <h2>Question Count</h2>
        <div className="field-row">
          <label>
            <span className="field-label-inline">Questions:</span>
            <input
              type="number"
              min="1"
              max={maxAvailable}
              value={count}
              onChange={(e) => setCount(parseInt(e.currentTarget.value, 10) || 1)}
              className="text-input count-input"
            />
          </label>
          <span className="field-hint">(max {maxAvailable} available)</span>
        </div>
      </div>}

      <TestOptions
        timed={timed}
        setTimed={setTimed}
        minutes={minutes}
        setMinutes={setMinutes}
        revealMode={revealMode}
        setRevealMode={setRevealMode}
      />

      {error && (
        <div className="alert-error">
          <p className="alert-text">{error}</p>
        </div>
      )}

      <button className="btn btn-primary start-button" onClick={handleStart}>
        Start Test
      </button>

      {/* Pool warning dialog */}
      {poolWarning && (
        <div className="modal-overlay" onClick={() => setPoolWarning(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Fewer questions available</h2>
            <p className="modal-body">{poolWarning.message}</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setPoolWarning(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleProceedWithWarning}>
                Proceed with {poolWarning.actualCount} questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
