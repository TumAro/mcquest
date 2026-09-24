import { useState } from 'react'
import { useParams, Link } from 'react-router'
import { loadIndex, loadPaper, assetBase, useJson } from '../data'
import type { Response } from '../data'
import { scoreAttempt } from '../../scripts/lib/marking.mjs'
import { isAnswered } from '../attempt-state'
import QuestionPane from '../QuestionPane'
import Palette from '../Palette'
import examsConfig from '../../exams.json'

export default function Player() {
  const { slug, year: yearStr } = useParams()
  const year = yearStr ? parseInt(yearStr, 10) : 0

  const { data: index } = useJson(() => loadIndex(), [])
  const { data: paper } = useJson(() => (slug && year ? loadPaper(slug, year) : Promise.reject(new Error('Missing params'))), [slug, year])

  const [current, setCurrent] = useState(0)
  const [responses, setResponses] = useState<Record<string, Response>>({})
  const [marked] = useState<Record<string, boolean>>({})
  const [visited, setVisited] = useState<Record<string, boolean>>({})
  const [result, setResult] = useState<{ score: number; max: number; correct: number; wrong: number; unattempted: number } | null>(null)

  if (!index || !paper) {
    return <div style={{ padding: '1rem' }}>Loading...</div>
  }

  const exam = index.exams.find((e) => e.slug === slug)
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

  const question = paper.questions[current]
  const draft = responses[question.id] ?? null

  const handleDraft = (next: Response) => {
    const newResponses = { ...responses, [question.id]: next }
    setResponses(newResponses)
  }

  const handleSaveNext = () => {
    if (isAnswered(draft)) {
      setResponses({ ...responses, [question.id]: draft })
    }
    if (current < paper.questions.length - 1) {
      const nextIdx = current + 1
      setCurrent(nextIdx)
      const nextQ = paper.questions[nextIdx]
      setVisited({ ...visited, [nextQ.id]: true })
    }
  }

  const handleSubmit = () => {
    const score = scoreAttempt(examsConfig, paper.questions, responses)
    setResult(score)
  }

  if (!visited[question.id]) {
    setVisited({ ...visited, [question.id]: true })
  }

  const paneAssetBase = assetBase(slug!, year)

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
        <QuestionPane
          key={question.id}
          question={question}
          number={current + 1}
          assetBase={paneAssetBase}
          draft={draft}
          onDraft={handleDraft}
        />

        <div style={{ padding: '1rem', borderTop: '1px solid #ccc', display: 'flex', gap: '1rem' }}>
          <button onClick={handleSaveNext} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Save & Next
          </button>
          <button onClick={handleSubmit} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
            Submit
          </button>
        </div>

        {result && (
          <div style={{ padding: '1rem', backgroundColor: '#f0f0f0', marginTop: '1rem' }}>
            <p>
              Score: {Math.round(result.score * 100) / 100} / {result.max} — {result.correct} correct, {result.wrong} wrong, {result.unattempted} unattempted
            </p>
          </div>
        )}
      </div>

      <div style={{ borderLeft: '1px solid #ccc', backgroundColor: '#fafafa' }}>
        <Palette
          questions={paper.questions}
          current={current}
          responses={responses}
          marked={marked}
          visited={visited}
          onJump={(idx) => {
            setCurrent(idx)
            const q = paper.questions[idx]
            setVisited({ ...visited, [q.id]: true })
          }}
        />
      </div>

      {/* Mobile: hide palette below 900px */}
      <style>{`
        @media (max-width: 900px) {
          div {
            grid-template-columns: 1fr !important;
          }
          div > div:nth-child(2) {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
