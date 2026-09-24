import type { Question, Response } from './data'
import { inferType } from '../scripts/lib/rules.mjs'
import Math from './Math'

export interface QuestionPaneProps {
  question: Question
  number: number
  assetBase: string
  draft: Response
  onDraft: (next: Response) => void
}

export default function QuestionPane({
  question,
  number,
  assetBase,
  draft,
  onDraft,
}: QuestionPaneProps) {
  const type = inferType(question)

  return (
    <div style={{ padding: '1rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '1rem',
          borderBottom: '1px solid #ccc',
          paddingBottom: '0.5rem',
        }}
      >
        <h2>Question {number}</h2>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          {question.marks} marks | {question.topic}
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <Math text={question.question} />
      </div>

      {question.image && (
        <div style={{ marginBottom: '1.5rem' }}>
          <img
            src={assetBase + question.image}
            alt="question image"
            style={{ maxWidth: '100%', maxHeight: '300px' }}
          />
        </div>
      )}

      {type === 'single' && question.options && (
        <div>
          {question.options.map((option, idx) => (
            <label key={idx} style={{ display: 'block', marginBottom: '0.5rem' }}>
              <input
                type="radio"
                name={question.id}
                value={idx}
                checked={Array.isArray(draft) && draft[0] === idx}
                onChange={() => onDraft([idx])}
              />
              <span style={{ marginLeft: '0.5rem' }}>
                <Math text={option} />
              </span>
            </label>
          ))}
        </div>
      )}

      {type !== 'single' && (
        <div style={{ color: '#999' }}>Unsupported type: {type}</div>
      )}
    </div>
  )
}
