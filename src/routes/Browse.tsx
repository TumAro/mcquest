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

  const questionCount = index.exams.reduce(
    (total, exam) => total + exam.years.reduce((n, y) => n + y.count, 0),
    0
  )

  return (
    <div className="page">
      <h1>mcquest</h1>
      <p className="page-lede">
        {questionCount} question{questionCount !== 1 ? 's' : ''} in the bank.
      </p>

      <section className="mode-section">
        <h2>Practise</h2>
        <ul className="mode-list">
          <li>
            <Link to="/test/random" className="mode-card">
              <span className="mode-name">Random</span>
              <span className="mode-hint">A mixed set drawn from every exam and year</span>
            </Link>
          </li>
          <li>
            <Link to="/test/subject" className="mode-card">
              <span className="mode-name">By topic</span>
              <span className="mode-hint">Pick the topics you want to drill</span>
            </Link>
          </li>
          <li>
            <Link to="/test/bookmarked" className="mode-card">
              <span className="mode-name">Bookmarked</span>
              <span className="mode-hint">Re-sit the questions you saved</span>
            </Link>
          </li>
          <li>
            <Link to="/stats" className="mode-card">
              <span className="mode-name">Weak topics</span>
              <span className="mode-hint">See which topics are costing marks</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="mode-section">
        <h2>Sit a paper</h2>
        <ul className="exam-list">
          {index.exams.map((exam) => (
            <li key={exam.slug} className="exam-item">
              <Link to={`/exam/${exam.slug}`}>
                {exam.label} ({exam.years.length} year{exam.years.length !== 1 ? 's' : ''})
              </Link>
            </li>
          ))}
        </ul>
      </section>
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
