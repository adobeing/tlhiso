// Public unsubscribe page — no login required.
// Route: /unsubscribe?t=<base64-token>
// Decodes the token { uid, col, id } and calls unsubscribeContact Cloud Function.

import { useState, useEffect } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../services/firebase'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function UnsubscribePage() {
  const [status, setStatus] = useState('loading') // 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('t')
    if (!token) { setErrorMsg('Invalid unsubscribe link.'); setStatus('error'); return }

    httpsCallable(functions, 'unsubscribeContact')({ token })
      .then(() => setStatus('success'))
      .catch(e => { setErrorMsg(e.message || 'Something went wrong.'); setStatus('error') })
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-10 text-center shadow-sm">
        {/* Logo */}
        <p className="mb-8 text-2xl font-extrabold tracking-tight text-primary">Tlhiso</p>

        {status === 'loading' && (
          <>
            <Loader2 size={40} className="mx-auto mb-4 animate-spin text-primary" />
            <p className="text-sm text-ink-secondary">Processing your request…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 size={48} className="mx-auto mb-4 text-green-500" />
            <h1 className="mb-2 text-xl font-bold text-ink">You've been unsubscribed</h1>
            <p className="text-sm text-ink-secondary">
              You will no longer receive marketing messages from this business.
              You can still receive important service-related communications.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={48} className="mx-auto mb-4 text-red-400" />
            <h1 className="mb-2 text-xl font-bold text-ink">Link not valid</h1>
            <p className="text-sm text-ink-secondary">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  )
}
