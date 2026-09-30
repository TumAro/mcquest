import { Link, useNavigate } from 'react-router'
import { loadIndex, useJson } from '../data'
import { buildIndexLookup } from '../QuestionSelection'
import { loadBookmarks } from '../storage'
import ConfigScreen, { type TestConfig } from './ConfigScreen'

export default function Bookmarked() {
  const navigate = useNavigate()
  const { data: index } = useJson(() => loadIndex(), [])
  const { data: ids } = useJson(() => loadBookmarks(), [])

  if (!index || !ids) {
    return <div className="loading-state">Loading...</div>
  }

  // Ids survive bank edits, the questions may not (D-06): skip what is gone.
  const lookup = buildIndexLookup(index)
  const questions = ids.flatMap((id) => lookup.get(id)?.question ?? [])
  const missing = ids.length - questions.length

  if (questions.length === 0) {
    return (
      <div className="page">
        <h1>Bookmarked test</h1>
        <div className="empty-state">
          <p>
            {ids.length === 0
              ? 'No bookmarks yet. Bookmark a question during a test, or from the review screen, and it will show up here.'
              : 'Your bookmarks are no longer in the bank, so there is nothing to sit.'}
          </p>
          <Link to="/">Back to the front page</Link>
        </div>
      </div>
    )
  }

  const n = questions.length
  const lede = (
    <>
      <p className="page-lede" data-testid="bookmarked-count">
        {n} bookmarked question{n !== 1 ? 's' : ''}
      </p>
      {missing > 0 && (
        <p className="page-lede">
          {missing} bookmark{missing !== 1 ? 's were' : ' was'} skipped because {missing !== 1 ? 'they' : 'it'} left the bank.
        </p>
      )}
    </>
  )

  return (
    <ConfigScreen
      index={index}
      title="Bookmarked test"
      fixedQuestions={questions}
      mode="bookmarked"
      lede={lede}
      onStart={(config: TestConfig) => navigate('/test/play', { state: { config } })}
    />
  )
}
