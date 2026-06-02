import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function PendingActivationPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  async function handleSignOut() { await signOut(); navigate('/login') }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 px-6">
      <div className="w-full max-w-md rounded-card bg-surface p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-2xl">⏳</div>
        <h1 className="text-xl font-bold text-ink">Account pending activation</h1>
        <p className="mt-3 text-sm text-ink-secondary">
          Your account{user?.email ? ` (${user.email})` : ''} has been created and is
          awaiting admin approval. You’ll get an email once it’s activated.
        </p>
        <p className="mt-2 text-sm text-ink-secondary">
          Questions? Contact <a className="font-semibold text-primary" href="mailto:hello@tlhiso.com">hello@tlhiso.com</a>.
        </p>
        <button onClick={handleSignOut}
          className="mt-6 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-ink hover:bg-surface-2">
          Sign out
        </button>
      </div>
    </div>
  )
}
