import { useState } from 'react'
import { selectQuestions } from '../QuestionSelection'
import TestOptions, { type RevealMode } from './TestOptions'
import type { DataIndex, IndexQuestion } from '../data'

interface ConfigScreenProps {
  index: DataIndex
  title: string
  showTopics?: boolean
  initialTopics?: Set<string>
  initialRevealMode?: RevealMode
  onStart: (config: TestConfig) => void
}

export interface TestConfig {
  topics: string[]
  count: number
  timedMinutes: number | null
  revealMode: RevealMode
  questions: IndexQuestion[]
  warnings: string[]
}

export default function ConfigScreen({
  index,
  title,
  showTopics = true,
  initialTopics = new Set(),
  initialRevealMode = 'immediate',
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

  const handleStart = () => {
    setError('')
    setPoolWarning(null)

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
    <div style={{ padding: '1rem', maxWidth: '600px' }}>
      <h1>{title}</h1>

      {showTopics && (
        <div style={{ marginBottom: '2rem' }}>
          <h2>Topics</h2>
          {Object.entries(topicsMap).map(([categorySlug, category]) => (
            <div key={categorySlug} style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>{category.label}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {Object.entries(category.topics).map(([topicSlug, topicLabel]) => (
                  <label key={topicSlug} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedTopics.has(topicSlug)}
                      onChange={() => handleTopicChange(topicSlug)}
                    />
                    <span>{topicLabel}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <h2>Question Count</h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label>
            <span style={{ marginRight: '0.5rem' }}>Questions:</span>
            <input
              type="number"
              min="1"
              max={maxAvailable}
              value={count}
              onChange={(e) => setCount(parseInt(e.currentTarget.value, 10) || 1)}
              style={{ width: '80px' }}
            />
          </label>
          <span style={{ fontSize: '0.875rem', color: '#666' }}>
            (max {maxAvailable} available)
          </span>
        </div>
      </div>

      <TestOptions
        timed={timed}
        setTimed={setTimed}
        minutes={minutes}
        setMinutes={setMinutes}
        revealMode={revealMode}
        setRevealMode={setRevealMode}
      />

      {error && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#ffe0e0', border: '1px solid #dd0000' }}>
          <p style={{ margin: 0, color: '#cc0000' }}>{error}</p>
        </div>
      )}

      <button
        onClick={handleStart}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          cursor: 'pointer',
          backgroundColor: '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        Start Test
      </button>

      {/* Pool warning dialog */}
      {poolWarning && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setPoolWarning(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '2rem',
              borderRadius: '8px',
              maxWidth: '400px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '1rem', color: '#333' }}>
              Fewer questions available
            </h2>
            <p style={{ marginBottom: '1.5rem', color: '#666', lineHeight: 1.5 }}>
              {poolWarning.message}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => setPoolWarning(null)}
                style={{
                  padding: '0.75rem 1.5rem',
                  cursor: 'pointer',
                  backgroundColor: '#f0f0f0',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleProceedWithWarning}
                style={{
                  padding: '0.75rem 1.5rem',
                  cursor: 'pointer',
                  backgroundColor: '#0066cc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '1rem',
                }}
              >
                Proceed with {poolWarning.actualCount} questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
