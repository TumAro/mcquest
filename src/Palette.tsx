import type { Question, Response } from './data'

export interface PaletteProps {
  questions: Question[]
  current: number
  responses: Record<string, Response>
  marked: Record<string, boolean>
  visited: Record<string, boolean>
  onJump: (index: number) => void
}

export default function Palette({
  questions,
  current,
  onJump,
}: PaletteProps) {
  return (
    <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {questions.map((q, idx) => (
        <button
          key={q.id}
          onClick={() => onJump(idx)}
          aria-current={idx === current ? 'true' : undefined}
          style={{
            padding: '0.5rem 0.75rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            backgroundColor: idx === current ? '#e3f2fd' : '#f5f5f5',
            fontWeight: idx === current ? 'bold' : 'normal',
          }}
        >
          {idx + 1}
        </button>
      ))}
    </div>
  )
}
