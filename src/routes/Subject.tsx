import { useState } from 'react'
import { useNavigate } from 'react-router'
import { loadIndex, useJson } from '../data'
import { selectQuestions } from '../QuestionSelection'
import type { IndexQuestion } from '../data'

interface SubjectConfig {
  topics: string[]
  count: number
  timedMinutes: number | null
  revealMode: 'immediate'
  questions: IndexQuestion[]
  warnings: string[]
}

export default function Subject() {
  const navigate = useNavigate()
  const { data: index } = useJson(() => loadIndex(), [])
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())
  const [count, setCount] = useState(5)
  const [timed, setTimed] = useState(true)
  const [minutes, setMinutes] = useState(120)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])

  if (!index) {
    return <div style={{ padding: '1rem' }}>Loading...</div>
  }

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
    setWarnings([])

    if (selectedTopics.size === 0) {
      setError('Please select at least one topic')
      return
    }

    if (count <= 0) {
      setError('Question count must be greater than 0')
      return
    }

    // Select questions from the pool
    const selection = selectQuestions(index, Array.from(selectedTopics), count)
    if (selection.warnings.length > 0) {
      setWarnings(selection.warnings)
    }

    if (selection.questions.length === 0) {
      setError('No questions found for the selected topics')
      return
    }

    // Navigate to player with config
    const config: SubjectConfig = {
      topics: Array.from(selectedTopics),
      count,
      timedMinutes: timed ? minutes : null,
      revealMode: 'immediate',
      questions: selection.questions,
      warnings: selection.warnings,
    }

    navigate('/test/play', { state: { config } })
  }

  const maxAvailable = index.exams.reduce((sum, exam) => {
    return sum + exam.years.reduce((yearSum, year) => yearSum + year.count, 0)
  }, 0)

  const topicsMap = index.topics

  return (
    <div style={{ padding: '1rem', maxWidth: '600px' }}>
      <h1>Subject-wise Test</h1>

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

      <div style={{ marginBottom: '2rem' }}>
        <h2>Timer</h2>
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.currentTarget.checked)} />
          <span>Timed mode</span>
        </label>
        {timed && (
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span>Minutes:</span>
            <input
              type="number"
              min="1"
              value={minutes}
              onChange={(e) => setMinutes(parseInt(e.currentTarget.value, 10) || 1)}
              style={{ width: '80px' }}
            />
          </label>
        )}
      </div>

      {warnings.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fffacd', border: '1px solid #ddd' }}>
          {warnings.map((w, i) => (
            <p key={i} style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>
              ⚠️ {w}
            </p>
          ))}
        </div>
      )}

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
    </div>
  )
}
