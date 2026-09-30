import { useParams, Link } from 'react-router'
import { loadIndex, useJson } from '../data'
import { loadSubmittedAttempt } from '../storage'

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
  const { attempt } = data
  if (!attempt) {
    return (
      <div className="not-found-state">
        <p>Attempt not found.</p>
        <Link to="/">Back to exams</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Results</h1>
      <p data-testid="results-score">
        {attempt.score} / {attempt.max}
      </p>
      <p>
        <span data-testid="results-correct">{attempt.correct}</span>
        <span data-testid="results-wrong">{attempt.wrong}</span>
        <span data-testid="results-unattempted">{attempt.unattempted}</span>
      </p>
      <Link to="/">Back to exams</Link>
    </div>
  )
}
