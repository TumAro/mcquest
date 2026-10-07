import { Link } from 'react-router'

/** One back affordance for every screen below the front page. */
export default function BackLink({ to = '/', label = 'Back' }: { to?: string; label?: string }) {
  return (
    <Link to={to} className="back-link">
      <span aria-hidden="true">{'←'}</span> {label}
    </Link>
  )
}
