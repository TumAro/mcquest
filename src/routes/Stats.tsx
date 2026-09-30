import { Link } from 'react-router'
import { loadIndex, useJson } from '../data'
import { loadSubmittedAttempts } from '../storage'
import { statsFromHistory } from '../stats'
import { formatAccuracy } from '../results'
import './results.css'

export default function Stats() {
  const { data, error } = useJson(
    async () => ({ attempts: await loadSubmittedAttempts(), index: await loadIndex() }),
    [],
  )

  if (error) {
    return (
      <div className="not-found-state">
        <p>Could not load your stats.</p>
        <Link to="/">Back</Link>
      </div>
    )
  }
  if (!data) return <div className="loading-state">Loading...</div>

  const rows = statsFromHistory(data.attempts, data.index)

  return (
    <div className="page">
      <h1>Weak topics</h1>
      {rows.length === 0 ? (
        <p>No answered questions yet.</p>
      ) : (
        <table className="results-table">
          <caption>Accuracy by topic, all submitted tests</caption>
          <thead>
            <tr>
              <th scope="col">Topic</th>
              <th scope="col">Accuracy</th>
              <th scope="col">Attempts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.topic} data-topic={r.topic}>
                <th scope="row">{r.label}</th>
                <td className="mono-num" data-testid="stat-accuracy">
                  {formatAccuracy(r.accuracy)}
                </td>
                <td className="mono-num" data-testid="stat-attempts">
                  {r.attempts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
