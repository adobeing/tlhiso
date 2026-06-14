import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { httpsCallable } from 'firebase/functions'
import { getDoc, doc } from 'firebase/firestore'
import { functions, db } from '../../services/firebase'
import { PLANS, dashboardPathFor } from '../../utils/industries'
import AuthShell from './AuthShell'
import { CheckCircle, Shield, Loader2, ArrowLeft, FileText, Mail, CreditCard } from 'lucide-react'


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

export default function CheckoutPage() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isComplete = location.pathname === '/checkout/complete'

  const [payingYoco,      setPayingYoco]      = useState(false)
  const [error,           setError]           = useState('')
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

  // ── Redirect already-active users to their dashboard ─────────────────────
  useEffect(() => {
    if (loading) return
    if (!user && !isComplete) { navigate('/login', { replace: true }); return }
    if (profile?.isActive) {
      navigate(dashboardPathFor(profile.industry), { replace: true })
    }
  }, [loading, user, profile, navigate, isComplete])

  // ── Yoco checkout flow ────────────────────────────────────────────────────
  async function handleYocoPay() {
    if (!user || !plan) return
    setPayingYoco(true)
    setError('')
    try {
      const fn = httpsCallable(functions, 'createYocoCheckout')
      const result = await fn({ planKey: profile.plan })
      const { redirectUrl } = result.data
      if (!redirectUrl) throw new Error('No redirect URL returned. Please try again.')
      window.location.href = redirectUrl
    } catch (e) {
      setError(e.message || 'Yoco payment failed. Please try again.')
      setPayingYoco(false)
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
          <tr style="background:#f8fafb"><td style="padding:10px;font-weight:bold">Bank</td><td style="padding:10px">${b.bank || 'Contact support@tlhiso.com'}</td></tr>
          <tr><td style="padding:10px;font-weight:bold">Account name</td><td style="padding:10px">${b.accountName || 'Contact support@tlhiso.com'}</td></tr>
          <tr style="background:#f8fafb"><td style="padding:10px;font-weight:bold">Account number</td><td style="padding:10px">${b.account || 'Contact support@tlhiso.com'}</td></tr>
          <tr><td style="padding:10px;font-weight:bold">Branch code</td><td style="padding:10px">${b.branch || '—'}</td></tr>
          <tr style="background:#f8fafb"><td style="padding:10px;font-weight:bold">Account type</td><td style="padding:10px">${b.type || '—'}</td></tr>
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

        {/* ── Yoco button ── */}
        <button
          onClick={handleYocoPay}
          disabled={payingYoco}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#1A1A2E] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#16213E] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {payingYoco ? (
            <><Loader2 size={16} className="animate-spin" /> Redirecting to Yoco…</>
          ) : (
            <><CreditCard size={16} /> Pay with Yoco</>
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
            disabled={invoiceSending}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary hover:text-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {invoiceSending
              ? <><Loader2 size={15} className="animate-spin" /> Sending invoice…</>
              : <><FileText size={15} /> Request Invoice &amp; Pay by EFT</>}
          </button>
        )}

        {/* Trust badge */}
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
          <Shield size={16} className="mt-0.5 shrink-0 text-primary" />
          <p className="text-xs text-ink-secondary leading-relaxed">
            Payments are processed securely by{' '}
            <strong className="text-ink">Yoco</strong>, trusted by thousands of South African
            businesses. Credit/debit cards accepted. Your card details are never stored by Tlhiso.
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
