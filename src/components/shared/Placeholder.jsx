import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

// Temporary stub for routes whose full UI is built in later phases.
export default function Placeholder({ title }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-surface-2 p-8">
      <div className="mx-auto max-w-2xl rounded-card bg-surface p-8 shadow-card">
        <p className="label-caps text-xs text-primary">Tlhiso</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          This screen is scaffolded and reachable. Its full UI lands in a later build phase.
        </p>
        {profile && (
          <div className="mt-4 rounded-xl bg-surface-2 p-4 text-sm text-ink-secondary">
            Signed in as <span className="font-semibold text-ink">{user?.email}</span>
            {' · '}industry: <span className="font-semibold text-ink">{profile.industry}</span>
            {' · '}plan: <span className="font-semibold text-ink">{profile.plan}</span>
          </div>
        )}
        <button onClick={async () => { await signOut(); navigate('/login') }}
          className="mt-6 rounded-xl border border-border px-4 py-2 text-sm font-semibold text-ink hover:bg-surface-2">
          Sign out
        </button>
      </div>
    </div>
  )
}
