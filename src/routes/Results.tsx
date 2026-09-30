import { useParams, Link } from 'react-router'
import { loadIndex, useJson } from '../data'
import { loadSubmittedAttempt } from '../storage'
import type { SubmittedAttempt } from '../storage'
import { buildIndexLookup } from '../QuestionSelection'
import { formatScore, formatAccuracy, topicBreakdown, topicLabels } from '../results'
import './results.css'

// A Record over the mode union: widening the union later fails type-check until
// the new mode is given a title here.
const MODE_TITLE: Record<SubmittedAttempt['mode'], string> = {
  'year-wise': 'Year-wise test',
  'subject-wise': 'Subject-wise test',
  random: 'Random test',
}

export default function Results() {
  const { id } = useParams()

  // `attempt` may be null (unknown id), so the loader returns an object: useJson
  // reports "still loading" as data === null and a bare null could not mean not-found.
  const { data, error } = useJson(async () => {
    const attempt = id ? await loadSubmittedAttempt(id) : null
    const index = attempt ? await loadIndex() : null
    return { attempt, index }
  }, [id])

  if (error) {
    return (
      <div className="not-found-state">
        <p>Could not load results.</p>
        <Link to="/">Back</Link>
      </div>
    )
  }
  if (!data) return <div className="loading-state">Loading...</div>
  const { attempt, index } = data
  if (!attempt || !index) {
    return (
      <div className="not-found-state">
        <p>Attempt not found.</p>
        <Link to="/">Back to exams</Link>
      </div>
    )
  }

  // Everything below reads the stored record. Nothing is re-marked here.
  const lookup = buildIndexLookup(index)
  const labels = topicLabels(index.topics)
  const rows = topicBreakdown(
    attempt.questions,
    (qid) => lookup.get(qid)?.question.topic,
    (slug) => labels[slug] ?? slug,
  )

  const examLabel = index.exams.find((e) => e.slug === attempt.exam)?.label ?? attempt.exam
  const title =
    attempt.mode === 'year-wise' ? `${examLabel} ${attempt.year ?? ''}`.trim() : MODE_TITLE[attempt.mode]

  return (
    <div className="page results-page">
      <h1>Results</h1>
      <p className="results-title">{title}</p>

      <p className="results-score" data-testid="results-score">
        {formatScore(attempt.score)} / {formatScore(attempt.max)}
      </p>

      <dl className="results-counts">
        <div>
          <dt>Correct</dt>
          <dd className="results-correct" data-testid="results-correct">
            {attempt.correct}
          </dd>
        </div>
        <div>
          <dt>Wrong</dt>
          <dd className="results-wrong" data-testid="results-wrong">
            {attempt.wrong}
          </dd>
        </div>
        <div>
          <dt>Unattempted</dt>
          <dd data-testid="results-unattempted">{attempt.unattempted}</dd>
        </div>
      </dl>

      {attempt.mode === 'year-wise' && (
        <p className="results-scope-note" data-testid="results-scope-note">
          The maximum of {formatScore(attempt.max)} is the maths-section total. General Aptitude and CSIR Part A
          are not in the bank, so this is not the exam&rsquo;s headline total.
        </p>
      )}

      <table className="results-table">
        <caption>Accuracy by topic, this attempt</caption>
        <thead>
          <tr>
            <th scope="col">Topic</th>
            <th scope="col">Correct</th>
            <th scope="col">Wrong</th>
            <th scope="col">Unattempted</th>
            <th scope="col">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.topic} data-topic={r.topic}>
              <th scope="row">{r.label}</th>
              <td data-testid="topic-correct">{r.correct}</td>
              <td>{r.wrong}</td>
              <td>{r.unattempted}</td>
              <td data-testid="topic-accuracy">{formatAccuracy(r.accuracy)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>
        <Link to="/">Back to exams</Link>
      </p>
    </div>
  )
}
