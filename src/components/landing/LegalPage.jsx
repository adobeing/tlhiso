import { Link } from 'react-router-dom'
export default function LegalPage({ title }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link to="/" className="text-sm font-semibold text-primary">← Back to home</Link>
      <h1 className="mt-4 text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-3 text-sm text-ink-secondary">Full {title.toLowerCase()} content to be added.</p>
    </div>
  )
}
