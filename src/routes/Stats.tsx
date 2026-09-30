import { Link } from 'react-router'
import { loadIndex, useJson } from '../data'
import { loadSubmittedAttempts } from '../storage'
import { statsFromHistory, MIN_ATTEMPTS } from '../stats'
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

  const { ranked, insufficient, skipped } = statsFromHistory(data.attempts, data.index)

  const n = data.attempts.length

  return (
    <div className="page">
      <h1>Weak topics</h1>
      {ranked.length === 0 && insufficient.length === 0 ? (
        <div className="empty-state" data-testid="stats-empty">
          <p>No answered questions yet. Finish a test and your accuracy by topic will show up here.</p>
          <Link to="/">Back to the front page</Link>
        </div>
      ) : (
        <>
          <p className="page-lede" data-testid="stats-tests">
            Across {n} submitted test{n !== 1 ? 's' : ''}.
          </p>
          {ranked.length === 0 && (
            <p className="field-hint" data-testid="stats-thin">
              Nothing is ranked yet. A topic needs {MIN_ATTEMPTS} attempts before its accuracy means anything, so keep
              sitting tests and the weakest will surface here.
            </p>
          )}
          {ranked.length > 0 && (
            <>
              <h2>Weakest first</h2>
              <p className="field-hint">
                An attempt is one answered question. Questions you left unattempted do not count.
              </p>
              <table className="results-table" data-testid="ranked-table">
                <caption>Accuracy by topic, all submitted tests</caption>
                <thead>
                  <tr>
                    <th scope="col">Topic</th>
                    <th scope="col">Accuracy</th>
                    <th scope="col">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => (
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
            </>
          )}
          {insufficient.length > 0 && (
            <>
              <h2>Not enough data yet</h2>
              <p className="field-hint">
                These topics have fewer than {MIN_ATTEMPTS} attempts, so they are not ranked.
              </p>
              <table className="results-table" data-testid="insufficient-table">
                <caption>Topics with too few attempts to rank</caption>
                <thead>
                  <tr>
                    <th scope="col">Topic</th>
                    <th scope="col">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {insufficient.map((r) => (
                    <tr key={r.topic} data-topic={r.topic}>
                      <th scope="row">{r.label}</th>
                      <td className="mono-num" data-testid="stat-attempts">
                        {r.attempts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {skipped > 0 && (
            <p className="field-hint" data-testid="stats-skipped">
              {skipped} answered question{skipped !== 1 ? 's' : ''} left the bank and {skipped !== 1 ? 'are' : 'is'} not
              counted.
            </p>
          )}
        </>
      )}
    </div>
  )
}
