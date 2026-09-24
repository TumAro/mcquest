import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { loadIndex, loadPaper, useJson } from '../data'

export default function YearConfig() {
  const navigate = useNavigate()
  const { slug, year: yearStr } = useParams()
  const year = yearStr ? parseInt(yearStr, 10) : 0

  const { data: index } = useJson(() => loadIndex(), [])
  const { data: paper } = useJson(
    () => slug && year ? loadPaper(slug, year) : Promise.reject(new Error('Missing params')),
    [slug, year]
  )

  // UI state
  const [timed, setTimed] = useState(true)
  const [minutes, setMinutes] = useState(120)
  const [revealMode, setRevealMode] = useState<'onSubmit' | 'immediate'>('onSubmit')

  const handleStart = () => {
    if (!paper) return

    navigate(`/exam/${slug}/${year}/play`, {
      state: {
        config: {
          timedMinutes: timed ? minutes : null,
          revealMode,
          questions: paper.questions,
          topics: [],
          count: paper.questions.length,
          warnings: [],
        },
      },
    })
  }

  if (!index || !paper) {
    return <div style={{ padding: '1rem' }}>Loading...</div>
  }

  const exam = index.exams.find((e) => e.slug === slug)
  if (!exam) {
    return (
      <div style={{ padding: '1rem' }}>
        <p>Exam not found.</p>
      </div>
    )
  }

  const yearData = exam.years.find((y) => y.year === year)
  if (!yearData) {
    return (
      <div style={{ padding: '1rem' }}>
        <p>Year not found.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>
        {exam.label} — {year}
      </h1>

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
              onChange={(e) => setMinutes(parseInt(e.currentTarget.value, 10) || 120)}
              style={{ width: '80px' }}
            />
          </label>
        )}
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Reveal Mode</h2>
        <label style={{ display: 'block', marginBottom: '1rem' }}>
          <input type="radio" checked={revealMode === 'onSubmit'} onChange={() => setRevealMode('onSubmit')} />
          <span style={{ marginLeft: '0.5rem' }}>Exam mode (no feedback until submit)</span>
        </label>
        <label style={{ display: 'block' }}>
          <input type="radio" checked={revealMode === 'immediate'} onChange={() => setRevealMode('immediate')} />
          <span style={{ marginLeft: '0.5rem' }}>Practice mode (immediate feedback)</span>
        </label>
      </div>

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
