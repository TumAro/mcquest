import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { loadIndex, loadPaper, useJson } from '../data'
import TestOptions, { type RevealMode } from './TestOptions'
import './config-screen.css'

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
  const [revealMode, setRevealMode] = useState<RevealMode>('onSubmit')

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
    return <div className="loading-state">Loading...</div>
  }

  const exam = index.exams.find((e) => e.slug === slug)
  if (!exam) {
    return (
      <div className="not-found-state">
        <p>Exam not found.</p>
      </div>
    )
  }

  const yearData = exam.years.find((y) => y.year === year)
  if (!yearData) {
    return (
      <div className="not-found-state">
        <p>Year not found.</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>
        {exam.label} — {year}
      </h1>

      <TestOptions
        timed={timed}
        setTimed={setTimed}
        minutes={minutes}
        setMinutes={setMinutes}
        revealMode={revealMode}
        setRevealMode={setRevealMode}
      />

      <button className="btn btn-primary start-button" onClick={handleStart}>
        Start Test
      </button>
    </div>
  )
}
