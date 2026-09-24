import { useMemo, useState } from 'react'
import type { Question, Response } from './data'
import { bubbleState } from './attempt-state'
import './palette.css'

export interface PaletteProps {
  questions: Question[]
  current: number
  responses: Record<string, Response>
  marked: Record<string, boolean>
  visited: Record<string, boolean>
  onJump: (index: number) => void
}

const stateLabels = {
  unvisited: 'not visited',
  visited: 'not answered',
  answered: 'answered',
  marked: 'marked for review, not answered',
  'answered-marked': 'answered and marked for review',
}

export default function Palette({
  questions,
  current,
  responses,
  marked,
  visited,
  onJump,
}: PaletteProps) {
  const [open, setOpen] = useState(false)

  const states = useMemo(() => {
    return questions.map((q) =>
      bubbleState(responses[q.id] ?? null, Boolean(marked[q.id]), Boolean(visited[q.id]))
    )
  }, [questions, responses, marked, visited])

  const counts = useMemo(() => {
    let answered = 0
    let markedCount = 0
    let unanswered = 0

    for (const state of states) {
      if (state === 'answered' || state === 'answered-marked') {
        answered++
      }
      if (state === 'marked' || state === 'answered-marked') {
        markedCount++
      }
      if (state === 'visited' || state === 'marked') {
        unanswered++
      }
    }

    return { answered, marked: markedCount, unanswered }
  }, [states])

  const handleJump = (index: number) => {
    setOpen(false)
    onJump(index)
  }

  const handleEscape = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const panelId = 'palette-panel'

  return (
    <div className="palette-container">
      <button
        className="palette-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        Questions — {counts.answered} answered, {counts.marked} marked
      </button>

      <div
        id={panelId}
        className={`palette-panel ${!open ? 'palette-closed' : ''}`}
        onKeyDown={handleEscape}
      >
        <div className="palette-grid">
          {questions.map((q, idx) => {
            const state = states[idx]
            const label = stateLabels[state as keyof typeof stateLabels]

            return (
              <button
                key={q.id}
                className={`palette-bubble palette-${state}`}
                onClick={() => handleJump(idx)}
                aria-label={`Question ${idx + 1}, ${label}`}
                aria-current={idx === current ? 'page' : undefined}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>

        <div className="palette-legend">
          <div className="legend-item">
            <div className="legend-bubble palette-unvisited" />
            <div className="legend-label">not visited</div>
          </div>
          <div className="legend-item">
            <div className="legend-bubble palette-visited" />
            <div className="legend-label">not answered</div>
          </div>
          <div className="legend-item">
            <div className="legend-bubble palette-answered" />
            <div className="legend-label">answered</div>
          </div>
          <div className="legend-item">
            <div className="legend-bubble palette-marked" />
            <div className="legend-label">marked for review, not answered</div>
          </div>
          <div className="legend-item">
            <div className="legend-bubble palette-answered-marked" />
            <div className="legend-label">answered and marked for review</div>
          </div>
        </div>
      </div>
    </div>
  )
}
