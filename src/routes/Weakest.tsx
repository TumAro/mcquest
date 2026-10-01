import { Fragment } from 'react'
import { Link, useNavigate } from 'react-router'
import { loadIndex, useJson } from '../data'
import { selectQuestions } from '../QuestionSelection'
import { loadSubmittedAttempts } from '../storage'
import { statsFromHistory, weakestTopics, MIN_ATTEMPTS, WEAKEST_QUESTION_COUNT } from '../stats'
import ConfigScreen, { type TestConfig } from './ConfigScreen'

export default function Weakest() {
  const navigate = useNavigate()
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

  const { index } = data
  const weak = weakestTopics(statsFromHistory(data.attempts, index).ranked)

  if (weak.length === 0) {
    return (
      <div className="page">
        <h1>Practice weakest topics</h1>
        <div className="empty-state" data-testid="weakest-empty">
          <p>
            Nothing is ranked yet, so there is no weak topic to practise. A topic needs {MIN_ATTEMPTS} attempts before
            it can count as weak. Sit a few more tests and come back.
          </p>
          <Link to="/stats">Back to your stats</Link>
        </div>
      </div>
    )
  }

  const slugs = weak.map((t) => t.topic)
  // A pool smaller than the cap is normal: the lede states the real count.
  const { questions } = selectQuestions(index, slugs, WEAKEST_QUESTION_COUNT)
  const n = questions.length
  const lede = (
    <>
      <p className="page-lede">
        Drawn from your weakest topics, worst first:{' '}
        {weak.map((t, i) => (
          <Fragment key={t.topic}>
            {i > 0 && ', '}
            <span data-testid="weakest-topic">{t.label}</span>
          </Fragment>
        ))}
      </p>
      <p className="page-lede" data-testid="weakest-count">
        {n} question{n !== 1 ? 's' : ''}
      </p>
    </>
  )

  return (
    <ConfigScreen
      index={index}
      title="Practice weakest topics"
      fixedQuestions={questions}
      lede={lede}
      onStart={(config: TestConfig) => navigate('/test/play', { state: { config: { ...config, mode: 'subject-wise' } } })}
    />
  )
}
