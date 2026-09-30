import type { Question, Response } from './data'
import { inferType } from '../scripts/lib/rules.mjs'
import { parseNumeric } from './numeric'
import Math from './Math'
import './question-pane.css'

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
  const draftString =
    type === 'numeric' && typeof draft === 'number'
      ? String(draft)
      : type === 'numeric'
        ? ''
        : undefined

  const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.currentTarget.value
    const parsed = parseNumeric(raw)
    onDraft(parsed)
  }

  return (
    <div className="question-pane">
      <div className="question-pane-header">
        <h2>Question {number}</h2>
        <div className="question-pane-meta">
          <span className="meta-marks">
            {question.marks} {question.marks === 1 ? 'mark' : 'marks'}
          </span>{' '}
          | {question.topic}
        </div>
      </div>

      <div className="question-pane-text">
        <Math text={question.question} />
      </div>

      {question.image && (
        <div className="question-pane-image">
          <img
            src={assetBase + encodeURIComponent(question.image)}
            alt={`Figure for Question ${number}`}
          />
        </div>
      )}

      {type === 'single' && question.options && (
        <fieldset className="question-pane-options">
          <legend className="visually-hidden">Question {number}, select one</legend>
          {question.options.map((option, idx) => (
            <label key={idx} className="question-pane-option">
              <input
                type="radio"
                name={question.id}
                value={idx}
                checked={Array.isArray(draft) && draft[0] === idx}
                onChange={() => onDraft([idx])}
              />
              <span className="option-text">
                <Math text={option} />
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {type === 'multi' && question.options && (
        <fieldset className="question-pane-options">
          <legend className="visually-hidden">Question {number}, select all that apply</legend>
          <div className="multi-note">All correct options must be selected; there is no partial credit.</div>
          {question.options.map((option, idx) => (
            <label key={idx} className="question-pane-option">
              <input
                type="checkbox"
                checked={Array.isArray(draft) && draft.includes(idx)}
                onChange={(e) => {
                  const newDraft = Array.isArray(draft) ? [...draft] : []
                  if (e.currentTarget.checked) {
                    newDraft.push(idx)
                  } else {
                    newDraft.splice(newDraft.indexOf(idx), 1)
                  }
                  // Sort ascending so the saved shape is stable
                  newDraft.sort((a, b) => a - b)
                  onDraft(newDraft.length > 0 ? newDraft : [])
                }}
              />
              <span className="option-text">
                <Math text={option} />
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {type === 'numeric' && (
        <div className="numeric-field-wrapper">
          <label htmlFor={question.id} className="numeric-label">
            Enter your answer:
          </label>
          <input
            id={question.id}
            type="number"
            inputMode="decimal"
            value={draftString ?? ''}
            onChange={handleNumericChange}
            className="numeric-input"
          />
        </div>
      )}
    </div>
  )
}
