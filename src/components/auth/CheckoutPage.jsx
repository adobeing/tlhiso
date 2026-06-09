import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../services/firebase'
import { PLANS, dashboardPathFor } from '../../utils/industries'
import AuthShell from './AuthShell'
import { CheckCircle, Shield, Loader2, ArrowLeft } from 'lucide-react'

// Feature list per plan for the checkout summary card
const PLAN_FEATURES = {
  starter: [
    '1,000 campaign messages / month',
    'All industry tools & dashboards',
    'Email & SMS campaigns',
    'POPIA compliance module',
    'Appointment booking',
  ],
  business: [
    '3,000 campaign messages / month',
    'All industry tools & dashboards',
    'Medical consultation AI transcription',
    'Email, SMS & WhatsApp campaigns',
    'POPIA compliance module',
    'Priority support',
  ],
  enterprise: [
    '10,000 campaign messages / month',
    'All industry tools & dashboards',
    'Medical consultation AI transcription',
    'Email, SMS & WhatsApp campaigns',
    'POPIA compliance module',
    'Dedicated account manager',
  ],
}

// Google "G" icon for the pay button
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#fff" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" />
    </svg>
  )
}

export default function CheckoutPage() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isComplete = location.pathname === '/checkout/complete'

  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [sdkReady, setSdkReady] = useState(false)

  const plan = profile?.plan ? PLANS[profile.plan] : null
  const features = profile?.plan ? (PLAN_FEATURES[profile.plan] ?? []) : []

  // ── Load PayFast Onsite SDK ───────────────────────────────────────────────
  useEffect(() => {
    if (isComplete) return
    const id = 'pf-onsite-sdk'
    if (document.getElementById(id)) { setSdkReady(true); return }
    const script = document.createElement('script')
    script.id = id
    script.src = 'https://www.payfast.co.za/onsite/engine.js'
    script.onload = () => setSdkReady(true)
    script.onerror = () => setError('Could not load the payment SDK. Please refresh the page.')
    document.head.appendChild(script)
    return () => {
      const el = document.getElementById(id)
      if (el) el.remove()
    }
  }, [isComplete])

  // ── Redirect already-active users to their dashboard ─────────────────────
  useEffect(() => {
    if (loading) return
    if (!user && !isComplete) { navigate('/login', { replace: true }); return }
    if (profile?.isActive) {
      navigate(dashboardPathFor(profile.industry), { replace: true })
    }
  }, [loading, user, profile, navigate, isComplete])

  // ── Start PayFast payment flow ────────────────────────────────────────────
  async function handlePay() {
    if (!user || !plan || !sdkReady) return
    setPaying(true)
    setError('')
    try {
      const fn = httpsCallable(functions, 'createPayfastCheckout')
      const result = await fn({ planKey: profile.plan })
      const { uuid } = result.data
      if (!uuid) throw new Error('No payment session returned. Please try again.')

      // Open PayFast Onsite modal — Google Pay shows automatically if supported
      window.payfast_do_onsite_payment({ uuid }, function (success) {
        if (success) {
          navigate('/checkout/complete')
        } else {
          setError('Payment was cancelled or failed. Please try again.')
          setPaying(false)
        }
      })
    } catch (e) {
      setError(e.message || 'Payment failed. Please try again.')
      setPaying(false)
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  // ── Payment success screen ─────────────────────────────────────────────────
  if (isComplete) {
    return (
      <AuthShell title="Payment successful!" subtitle="">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-lg">
            <CheckCircle size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-extrabold text-ink">You're all set!</h2>
          <p className="mt-2 text-sm text-ink-secondary">
            Your subscription is active. Your account will be ready in seconds — you'll also
            receive a confirmation email.
          </p>
          <Link
            to="/login"
            className="mt-6 flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-semibold text-white hover:bg-[#4e7d6d]"
          >
            Go to my dashboard →
          </Link>
          <p className="mt-4 text-xs text-ink-secondary">
            Questions? <a href="mailto:hello@tlhiso.com" className="text-primary font-semibold">hello@tlhiso.com</a>
          </p>
        </div>
      </AuthShell>
    )
  }

  // ── Checkout screen ────────────────────────────────────────────────────────
  return (
    <AuthShell
      title="Activate your account"
      subtitle="Complete your subscription to access your Tlhiso dashboard."
    >
      <div className="space-y-5">

        {/* Plan summary card */}
        {plan && (
          <div className="overflow-hidden rounded-2xl border border-primary/25 bg-primary-light">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Your plan</p>
                <p className="mt-0.5 text-xl font-extrabold text-ink">{plan.name}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-extrabold text-primary">
                  R{plan.price.toLocaleString()}
                </p>
                <p className="text-xs text-ink-secondary">/month</p>
              </div>
            </div>
            <div className="border-t border-primary/10 px-5 py-4">
              <ul className="space-y-2">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-ink">
                    <CheckCircle size={14} className="mt-0.5 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Google Pay / PayFast button */}
        <button
          onClick={handlePay}
          disabled={paying || !sdkReady}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#4285F4] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#3367d6] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {paying ? (
            <><Loader2 size={16} className="animate-spin" /> Processing…</>
          ) : !sdkReady ? (
            <><Loader2 size={16} className="animate-spin" /> Loading payment…</>
          ) : (
            <><GoogleIcon /> Pay with Google Pay</>
          )}
        </button>

        {/* PayFast trust badge */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
          <Shield size={16} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-xs text-ink-secondary leading-relaxed">
            Payments are processed securely by{' '}
            <strong className="text-ink">PayFast</strong>, South Africa's leading payment
            gateway. Google Pay, credit/debit cards, EFT and Instant EFT accepted.
            Your card details are never stored by Tlhiso.
          </p>
        </div>

        <p className="text-center text-xs text-ink-secondary">
          Billed monthly. Cancel any time. First billing today.
        </p>

        <div className="border-t border-border pt-4 text-center">
          <Link to="/login" className="inline-flex items-center gap-1 text-xs text-ink-secondary hover:text-ink">
            <ArrowLeft size={12} /> Back to sign in
          </Link>
        </div>
      </div>
    </AuthShell>
  )
}
