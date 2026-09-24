import { Link, useParams } from 'react-router'
import { loadIndex } from '../data'
import { useJson } from '../data'

export function BrowseExams() {
  const { data: index, error } = useJson(() => loadIndex(), [])

  if (error) {
    return <div style={{ padding: '1rem' }}>Error: {error.message}</div>
  }

  if (!index) {
    return <div style={{ padding: '1rem' }}>Loading exams...</div>
  }

  if (!index.exams || index.exams.length === 0) {
    return (
      <div style={{ padding: '1rem' }}>
        <p>No exams found. Run <code>npm run build:data</code> to generate them.</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Exams</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {index.exams.map((exam) => (
          <li key={exam.slug} style={{ marginBottom: '1rem' }}>
            <Link to={`/exam/${exam.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
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
    return <div style={{ padding: '1rem' }}>Error: {error.message}</div>
  }

  if (!index) {
    return <div style={{ padding: '1rem' }}>Loading exam...</div>
  }

  const exam = index.exams.find((e) => e.slug === slug)

  if (!exam) {
    return (
      <div style={{ padding: '1rem' }}>
        <p>Exam not found.</p>
        <Link to="/">Back to exams</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>{exam.label}</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {exam.years.map((year) => (
          <li key={year.year} style={{ marginBottom: '1rem' }}>
            <Link
              to={`/exam/${slug}/${year.year}/config`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {year.year} ({year.count} question{year.count !== 1 ? 's' : ''})
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
