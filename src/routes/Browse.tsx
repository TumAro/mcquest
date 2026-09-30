import { Link, useParams } from 'react-router'
import { loadIndex } from '../data'
import { useJson } from '../data'

export function BrowseExams() {
  const { data: index, error } = useJson(() => loadIndex(), [])

  if (error) {
    return <div className="not-found-state">Error: {error.message}</div>
  }

  if (!index) {
    return <div className="loading-state">Loading exams...</div>
  }

  if (!index.exams || index.exams.length === 0) {
    return (
      <div className="empty-state">
        <p>No exams found. Run <code>npm run build:data</code> to generate them.</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Exams</h1>
      <ul className="exam-list">
        {index.exams.map((exam) => (
          <li key={exam.slug} className="exam-item">
            <Link to={`/exam/${exam.slug}`}>
              {exam.label} ({exam.years.length} year{exam.years.length !== 1 ? 's' : ''})
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BrowseYears() {
  const { slug } = useParams()
  const { data: index, error } = useJson(() => loadIndex(), [])

  if (error) {
    return <div className="not-found-state">Error: {error.message}</div>
  }

  if (!index) {
    return <div className="loading-state">Loading exam...</div>
  }

  const exam = index.exams.find((e) => e.slug === slug)

  if (!exam) {
    return (
      <div className="not-found-state">
        <p>Exam not found.</p>
        <Link to="/">Back to exams</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>{exam.label}</h1>
      <ul className="year-list">
        {exam.years.map((year) => (
          <li key={year.year} className="year-item">
            <Link to={`/exam/${slug}/${year.year}/config`}>
              {year.year} ({year.count} question{year.count !== 1 ? 's' : ''})
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
