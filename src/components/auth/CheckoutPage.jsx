import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { httpsCallable } from 'firebase/functions'
import { getDoc, doc } from 'firebase/firestore'
import { functions, db } from '../../services/firebase'
import { PLANS, dashboardPathFor } from '../../utils/industries'
import AuthShell from './AuthShell'
import { CheckCircle, Shield, Loader2, ArrowLeft, FileText, Mail } from 'lucide-react'


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

  const [paying,          setPaying]          = useState(false)
  const [error,           setError]           = useState('')
  const [sdkReady,        setSdkReady]        = useState(false)
  const [invoiceSending,   setInvoiceSending]   = useState(false)
  const [invoiceRequested, setInvoiceRequested] = useState(false)
  const [banking,          setBanking]          = useState(null)

  useEffect(() => {
    getDoc(doc(db, 'superadmin', 'settings')).then(snap => {
      if (snap.exists() && snap.data().banking) setBanking(snap.data().banking)
    })
  }, [])

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

  // ── Request invoice (temporary EFT option) ───────────────────────────────
  async function handleInvoiceRequest() {
    if (!user || !plan) return
    setInvoiceSending(true)
    setError('')
    const ref = user.email
    const b = banking || {}
    const invoiceHtml = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h2 style="color:#5B8E7D">Tlhiso — Invoice Request</h2>
        <p>Hi ${profile?.name || 'there'},</p>
        <p>Thank you for choosing Tlhiso. Please use the details below to complete your EFT payment.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr style="background:#f8fafb"><td style="padding:10px;font-weight:bold">Plan</td><td style="padding:10px">${plan.name}</td></tr>
          <tr><td style="padding:10px;font-weight:bold">Amount</td><td style="padding:10px">R${plan.price.toLocaleString('en-ZA')}/month</td></tr>
          <tr style="background:#f8fafb"><td style="padding:10px;font-weight:bold">Bank</td><td style="padding:10px">${b.bank || ''}</td></tr>
          <tr><td style="padding:10px;font-weight:bold">Account name</td><td style="padding:10px">${b.accountName || ''}</td></tr>
          <tr style="background:#f8fafb"><td style="padding:10px;font-weight:bold">Account number</td><td style="padding:10px">${b.account || ''}</td></tr>
          <tr><td style="padding:10px;font-weight:bold">Branch code</td><td style="padding:10px">${b.branch || ''}</td></tr>
          <tr style="background:#f8fafb"><td style="padding:10px;font-weight:bold">Account type</td><td style="padding:10px">${b.type || ''}</td></tr>
          <tr><td style="padding:10px;font-weight:bold;color:#5B8E7D">Payment reference</td><td style="padding:10px;font-weight:bold;color:#5B8E7D">${ref}</td></tr>
        </table>
        <p style="background:#fffbeb;border:1px solid #fcd34d;padding:12px;border-radius:8px;font-size:13px">
          <strong>Important:</strong> Use <strong>${ref}</strong> as your payment reference so we can match your payment. Your account will be activated within 24 hours of payment confirmation.
        </p>
        <p style="color:#64748b;font-size:12px">Questions? <a href="mailto:support@tlhiso.com">support@tlhiso.com</a></p>
      </div>`
    try {
      await Promise.all([
        httpsCallable(functions, 'sendEmail')({
          to: user.email,
          subject: `Tlhiso Invoice — ${plan.name} Plan (R${plan.price.toLocaleString('en-ZA')}/mo)`,
          htmlBody: invoiceHtml,
        }),
        httpsCallable(functions, 'sendEmail')({
          to: 'support@tlhiso.com',
          subject: `Invoice requested — ${profile?.name || user.email} (${plan.name})`,
          htmlBody: `<p><strong>${profile?.name || user.email}</strong> requested an invoice for the <strong>${plan.name}</strong> plan (R${plan.price.toLocaleString('en-ZA')}/mo).</p><p>Email: ${user.email}</p><p>Activate their account once payment is confirmed.</p>`,
        }),
      ])
      setInvoiceRequested(true)
    } catch (e) {
      setError('Could not send invoice. Please email support@tlhiso.com directly.')
    } finally {
      setInvoiceSending(false)
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

        {/* ── Divider ── */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium text-ink-secondary">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* ── Invoice / EFT option ── */}
        {invoiceRequested ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-center">
            <CheckCircle size={24} className="mx-auto mb-2 text-green-600" />
            <p className="text-sm font-bold text-green-800">Invoice sent!</p>
            <p className="mt-1 text-xs text-green-700">
              Check your inbox at <strong>{user?.email}</strong>. Your account will be activated within 24 hours of payment confirmation.
            </p>
          </div>
        ) : (
          <button
            onClick={handleInvoiceRequest}
            disabled={invoiceSending || !banking}
            title={!banking ? 'Banking details not configured yet — contact support@tlhiso.com' : ''}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary hover:text-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {invoiceSending
              ? <><Loader2 size={15} className="animate-spin" /> Sending invoice…</>
              : <><FileText size={15} /> Request Invoice &amp; Pay by EFT</>}
          </button>
        )}

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
