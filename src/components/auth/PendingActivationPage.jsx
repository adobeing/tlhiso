import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function PendingActivationPage() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  async function handleSignOut() { await signOut(); navigate('/login') }

  const status = profile?.status ?? 'paused'
  const isSuspended = status === 'suspended'

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-6">
      <div className="w-full max-w-md rounded-card bg-surface p-8 text-center shadow-card">
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${isSuspended ? 'bg-red-100' : 'bg-amber-100'}`}>
          {isSuspended ? '🚫' : '⏸️'}
        </div>
        <h1 className="text-xl font-bold text-ink">
          {isSuspended ? 'Account suspended' : 'Account paused'}
        </h1>
        <p className="mt-3 text-sm text-ink-secondary">
          {user?.email ? <><strong>{user.email}</strong> — </> : ''}
          {isSuspended
            ? 'Your account has been suspended. Please contact support to resolve this.'
            : 'Your account has been temporarily paused. Please contact support if you think this is a mistake.'}
        </p>
        <p className="mt-2 text-sm text-ink-secondary">
          Contact <a className="font-semibold text-primary" href="mailto:hello@tlhiso.com">hello@tlhiso.com</a>
        </p>
        <button onClick={handleSignOut}
          className="mt-6 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2">
          Sign out
        </button>
      </div>
    </div>
  )
}
