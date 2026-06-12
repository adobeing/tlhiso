import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { deleteUser } from 'firebase/auth'
import { db, auth } from '../../services/firebase'
import { PLANS } from '../../utils/industries'
import {
  User, Shield, Bell, CreditCard, Trash2, LogOut,
  AlertTriangle, CheckCircle, Mail, Lock, ChevronRight,
  Loader2, HelpCircle, ChevronDown, ShieldCheck, Settings2,
  Copy, ExternalLink, CalendarDays, FileText,
} from 'lucide-react'
import PopiaModule from './PopiaModule'

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, description, children, danger }) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${danger ? 'border-red-200' : 'border-border'}`}>
      <div className={`flex items-center gap-3 px-6 py-4 ${danger ? 'border-b border-red-100 bg-red-50/50' : 'border-b border-border'}`}>
        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${danger ? 'bg-red-100 text-red-500' : 'bg-primary-light text-primary'}`}>
          <Icon size={15} />
        </span>
        <div>
          <p className={`text-sm font-bold ${danger ? 'text-red-700' : 'text-ink'}`}>{title}</p>
          {description && <p className={`mt-0.5 text-xs ${danger ? 'text-red-400' : 'text-ink-secondary'}`}>{description}</p>}
        </div>
      </div>
      <div className={`divide-y ${danger ? 'divide-red-100' : 'divide-border'}`}>{children}</div>
    </div>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────
function Row({ label, hint, action }) {
  return (
    <div className="flex items-center justify-between gap-6 px-6 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-secondary">{hint}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-checked={checked}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-40 ${checked ? 'bg-primary' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
    </button>
  )
}

// ── Pill badge ────────────────────────────────────────────────────────────────
function Badge({ children, color = 'gray' }) {
  const colors = {
    gray:   'bg-gray-100 text-gray-700',
    green:  'bg-green-100 text-green-700',
    amber:  'bg-amber-100 text-amber-700',
    blue:   'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[color]}`}>
      {children}
    </span>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'How do I send a campaign to my contacts?',
    a: 'Go to Campaigns in the sidebar, click "New Campaign", choose SMS or email, select your recipients, write your message, and hit Send. Campaign messages count toward your monthly quota.',
  },
  {
    q: 'What counts as a campaign message?',
    a: 'Only messages sent through the Campaigns module count toward your monthly quota. Appointment reminders, booking confirmations, and direct messages sent from a contact or tenant record are free and unlimited.',
  },
  {
    q: 'How do I book an appointment?',
    a: 'Open the Appointments section from the sidebar. Click "Book Appointment", select the contact (optional), set the date, time, location, and purpose, then save. An SMS reminder can be sent directly from the appointments table.',
  },
  {
    q: 'How do I add customers or contacts?',
    a: 'Use the Customers (or Patients / Tenants) section in the sidebar. Click the "Add" button, fill in the details, and save. All contacts are stored privately under your account and are never shared with other users.',
  },
  {
    q: 'Can I send WhatsApp messages?',
    a: 'Yes — WhatsApp messaging is available on Professional and Business plans. Use the Messages section or the campaign module and select WhatsApp as the channel. Numbers must be in +27 format.',
  },
  {
    q: 'How do phone numbers need to be formatted?',
    a: 'All South African numbers should be entered in international format: +27 followed by 9 digits (e.g. +27821234567). Drop the leading 0 and add +27. The app does this automatically where possible.',
  },
  {
    q: 'How do I upgrade my plan?',
    a: 'Email hello@tlhiso.com to request a plan upgrade. Upgrades take effect at the start of your next billing cycle. See the Plan & Billing section above for current plan details.',
  },
  {
    q: 'Is my data and my customers\' data secure?',
    a: 'Yes. All data is stored in Google Firebase (Firestore) with per-account isolation enforced at the database rules level. Data is encrypted in transit (TLS 1.2+) and at rest (AES-256). API keys are stored in Google Secret Manager and are never exposed to the browser.',
  },
  {
    q: 'What is POPIA and do I need to worry about it?',
    a: 'POPIA (Protection of Personal Information Act) is South Africa\'s data privacy law. As a Tlhiso user, you are the Responsible Party for your customers\' data. You must have their consent before messaging them. Use the POPIA Compliance Centre in the sidebar to manage consent records, data subject requests, and breach logs.',
  },
  {
    q: 'How do I export or delete my data?',
    a: 'To request a data export in CSV or JSON format, email hello@tlhiso.com. To delete your account and all associated data, use the Delete Account option in the Danger Zone below. Deletion is permanent and cannot be undone.',
  },
]

function FAQ() {
  const [open, setOpen] = useState(null)
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
          <HelpCircle size={15} />
        </span>
        <div>
          <p className="text-sm font-bold text-ink">Help &amp; FAQ</p>
          <p className="mt-0.5 text-xs text-ink-secondary">Common questions about using Tlhiso</p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {FAQ_ITEMS.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-surface-2"
            >
              <span className="text-sm font-medium text-ink">{item.q}</span>
              <ChevronDown
                size={15}
                className={`flex-shrink-0 text-ink-secondary transition-transform duration-200 ${open === i ? 'rotate-180' : ''}`}
              />
            </button>
            {open === i && (
              <div className="border-t border-border/60 bg-surface-2/50 px-6 py-4">
                <p className="text-sm leading-relaxed text-ink-secondary">{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SettingsPage({ industry }) {
  const { user, profile, signOut, resetPassword } = useAuth()
  const navigate = useNavigate()
  const uid = user?.uid

  const [saving,      setSaving]      = useState(null)
  const [resetSent,   setResetSent]   = useState(false)
  const [deleteOpen,  setDeleteOpen]  = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [activeTab,   setActiveTab]   = useState('settings')
  const [linkCopied,  setLinkCopied]  = useState(false)

  const subCollection = { medical: 'patients', property: 'tenants' }[industry] ?? 'customers'

  const plan      = PLANS[profile?.plan ?? 'starter']
  const planLimit = plan?.messages ?? 100
  const used      = profile?.messagesUsed ?? 0
  const usagePct  = Math.min((used / planLimit) * 100, 100)

  const emailNotifs = profile?.emailNotifications !== false
  const smsNotifs   = profile?.smsNotifications   === true
  const marketingOn = profile?.marketingOptOut    !== true

  async function toggle(key, currentValue) {
    if (!uid) return
    setSaving(key)
    try { await updateDoc(doc(db, 'users', uid), { [key]: !currentValue }) }
    finally { setSaving(null) }
  }

  async function sendPasswordReset() {
    if (!user?.email) return
    setSaving('reset')
    try {
      await resetPassword(user.email)
      setResetSent(true)
      setTimeout(() => setResetSent(false), 5000)
    } finally { setSaving(null) }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  async function handleDeleteAccount() {
    if (deleteInput.trim().toLowerCase() !== user?.email?.toLowerCase()) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteDoc(doc(db, 'users', uid))
      await deleteUser(auth.currentUser)
      navigate('/login')
    } catch (e) {
      setDeleteError(
        e.code === 'auth/requires-recent-login'
          ? 'Please sign out and sign back in before deleting your account.'
          : e.message
      )
    } finally { setDeleting(false) }
  }

  const planBadgeColor = { starter: 'gray', business: 'blue', enterprise: 'purple' }
  const initials = (profile?.name ?? user?.email ?? '?').charAt(0).toUpperCase()
  const memberSince = profile?.createdAt?.toDate?.()?.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short' }) ?? '—'

  return (
    <div className="max-w-4xl space-y-6">

      {/* ── Tab nav ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        <button onClick={() => setActiveTab('settings')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${activeTab === 'settings' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
          <Settings2 size={14} /> Settings
        </button>
        <button onClick={() => setActiveTab('popia')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${activeTab === 'popia' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
          <ShieldCheck size={14} /> POPIA Compliance
        </button>
      </div>

      {/* ── POPIA tab ───────────────────────────────────────────────────── */}
      {activeTab === 'popia' && <PopiaModule subCollection={subCollection} />}

      {/* ── Settings tab ────────────────────────────────────────────────── */}
      {activeTab === 'settings' && <>

      {/* ── Public booking link ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary-light/60 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
            <CalendarDays size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">Public booking link</p>
            <p className="truncate text-xs text-ink-secondary">
              {`https://tlhiso.com/book/${uid ?? ''}`} — share it so customers can book themselves in
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(`https://tlhiso.com/book/${uid}`)
              setLinkCopied(true)
              setTimeout(() => setLinkCopied(false), 2000)
            }}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#4e7d6d]">
            {linkCopied ? <CheckCircle size={13} /> : <Copy size={13} />}
            {linkCopied ? 'Copied!' : 'Copy link'}
          </button>
          <a href={`/book/${uid}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-white px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-primary/5">
            <ExternalLink size={13} /> Preview
          </a>
        </div>
      </div>

      {/* ── Monthly auto-statements (B2B) ────────────────────────────────── */}
      {industry === 'b2b' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
              <FileText size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">Monthly auto-statements</p>
              <p className="text-xs text-ink-secondary">
                On the 1st of each month, email every client a summary of their open invoices.
              </p>
            </div>
          </div>
          <button
            onClick={() => toggle('autoStatements', profile?.autoStatements === true)}
            disabled={saving === 'autoStatements'}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              profile?.autoStatements === true ? 'bg-primary' : 'bg-slate-300'
            }`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              profile?.autoStatements === true ? 'left-[22px]' : 'left-0.5'
            }`} />
          </button>
        </div>
      )}

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary-light/50 to-surface-2 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white shadow-md">
            {initials}
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-ink">{profile?.name || 'Your account'}</h1>
            <p className="text-sm text-ink-secondary">{user?.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge color={planBadgeColor[profile?.plan ?? 'starter']}>{plan?.name ?? 'Starter'} plan</Badge>
              <span className="text-xs text-ink-secondary capitalize">{profile?.industry ?? industry}</span>
              <Badge color="green">● Active</Badge>
            </div>
          </div>
        </div>
        <Link
          to={`/${industry}/profile`}
          className="flex items-center gap-1.5 rounded-xl bg-white border border-border px-4 py-2 text-sm font-semibold text-ink shadow-sm hover:bg-surface-2 transition"
        >
          <User size={13} /> Edit profile
        </Link>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Plan */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">Current Plan</p>
          <p className="mt-1.5 text-lg font-extrabold text-ink">{plan?.name ?? 'Starter'}</p>
          <p className="text-xs text-primary font-semibold">R{plan?.price?.toLocaleString('en-ZA') ?? '699'}/mo</p>
        </div>
        {/* Messages */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">Messages Left</p>
          <p className="mt-1.5 text-lg font-extrabold text-ink">{Math.max(0, planLimit - used).toLocaleString('en-ZA')}</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full rounded-full ${usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${100 - usagePct}%` }} />
          </div>
        </div>
        {/* Status */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">Account Status</p>
          <p className="mt-1.5 text-lg font-extrabold text-green-600">Active</p>
          <p className="text-xs text-ink-secondary">In good standing</p>
        </div>
        {/* Member since */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">Member Since</p>
          <p className="mt-1.5 text-lg font-extrabold text-ink">{memberSince}</p>
          <p className="text-xs text-ink-secondary capitalize">{profile?.industry ?? industry} dashboard</p>
        </div>
      </div>

      {/* ── Account + Security (2-col) ───────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={User} title="Account" description="Login credentials and identity">
          <Row label="Email address" hint={user?.email} />
          <Row
            label="Account status"
            hint="Active and in good standing"
            action={<Badge color="green">● Active</Badge>}
          />
          <Row label="Member since" hint={memberSince} />
        </Section>

        <Section icon={Shield} title="Security" description="Password and session management">
          <Row
            label="Password"
            hint="We'll send a reset link to your email address"
            action={
              resetSent ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
                  <CheckCircle size={13} /> Link sent
                </span>
              ) : (
                <button
                  onClick={sendPasswordReset}
                  disabled={saving === 'reset'}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-2 disabled:opacity-50 transition"
                >
                  {saving === 'reset' ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                  Reset password
                </button>
              )
            }
          />
          <Row
            label="Sign out"
            hint="End your current session on this device"
            action={
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-ink hover:bg-surface-2 transition"
              >
                <LogOut size={12} /> Sign out
              </button>
            }
          />
        </Section>
      </div>

      {/* ── Notifications + Data & Privacy (2-col) ──────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={Bell} title="Notifications" description="Control how and when we contact you">
          <Row
            label="Email notifications"
            hint="System alerts, account updates and security emails"
            action={
              <Toggle
                checked={emailNotifs}
                onChange={() => toggle('emailNotifications', emailNotifs)}
                disabled={saving === 'emailNotifications'}
              />
            }
          />
          <Row
            label="SMS appointment reminders"
            hint="Receive a text reminder before each appointment"
            action={
              <Toggle
                checked={smsNotifs}
                onChange={() => toggle('smsNotifications', smsNotifs)}
                disabled={saving === 'smsNotifications'}
              />
            }
          />
          <Row
            label="Marketing communications"
            hint="Product news, tips and offers from Tlhiso"
            action={
              <Toggle
                checked={marketingOn}
                onChange={() => toggle('marketingOptOut', marketingOn)}
                disabled={saving === 'marketingOptOut'}
              />
            }
          />
        </Section>

        <Section icon={Mail} title="Data & Privacy" description="Your rights under South Africa's POPIA">
          <Row
            label="POPIA consent"
            hint={profile?.popiaConsent ? 'Consent provided for data processing' : 'Consent has not been recorded yet'}
            action={<Badge color={profile?.popiaConsent ? 'green' : 'amber'}>{profile?.popiaConsent ? 'Given' : 'Pending'}</Badge>}
          />
          <Row
            label="POPIA compliance centre"
            hint="Consent records, data requests, breach logs"
            action={
              <button onClick={() => setActiveTab('popia')}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                Open <ChevronRight size={13} />
              </button>
            }
          />
          <Row
            label="Privacy policy"
            hint="How we collect, use and protect your data"
            action={
              <Link to="/legal/privacy" target="_blank"
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                View <ChevronRight size={13} />
              </Link>
            }
          />
        </Section>
      </div>

      {/* ── Plan & Billing (full width) ──────────────────────────────────── */}
      <Section icon={CreditCard} title="Plan & Billing" description="Subscription and message quota">
        <div className="px-6 py-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-bold text-ink">{plan?.name ?? 'Starter'}</p>
              <p className="mt-0.5 text-2xl font-extrabold text-primary">
                R{plan?.price?.toLocaleString('en-ZA') ?? '699'}
                <span className="text-sm font-normal text-ink-secondary">/month</span>
              </p>
            </div>
            <Badge color={planBadgeColor[profile?.plan ?? 'starter']}>{plan?.name}</Badge>
          </div>

          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-ink-secondary">
            <span>Campaign message usage</span>
            <span>{used.toLocaleString('en-ZA')} / {planLimit.toLocaleString('en-ZA')}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-amber-500' : 'bg-primary'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-secondary">
            <span className="font-semibold text-ink">{Math.max(0, planLimit - used).toLocaleString('en-ZA')}</span> campaign messages remaining this period
          </p>
          <p className="mt-0.5 text-[11px] text-ink-secondary/70">Booking confirmations & appointment reminders are free and do not count toward this quota.</p>

          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Included in your plan</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                `${plan?.messages?.toLocaleString('en-ZA') ?? 1000} campaign messages/month`,
                'SMS & email campaigns',
                'Bookings & reminders (unlimited)',
                'POPIA compliance module',
                ...(plan?.key !== 'starter' ? ['Surveys & opt-in', 'WhatsApp campaigns'] : []),
                ...(plan?.key === 'enterprise' ? ['Dedicated support'] : []),
              ].map(f => (
                <li key={f} className="flex items-center gap-1.5 text-xs text-ink">
                  <CheckCircle size={11} className="flex-shrink-0 text-primary" /> {f}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-xs text-ink-secondary">
            To upgrade your plan or discuss billing, email{' '}
            <a href="mailto:hello@tlhiso.com" className="font-semibold text-primary hover:underline">hello@tlhiso.com</a>.
          </p>
        </div>
      </Section>

      {/* ── FAQ (full width) ────────────────────────────────────────────── */}
      <FAQ />

      {/* ── Danger zone (full width) ────────────────────────────────────── */}
      <Section icon={AlertTriangle} title="Danger Zone" description="Irreversible actions — proceed with caution" danger>
        <Row
          label="Unsubscribe from all marketing"
          hint="Stop receiving all promotional messages from Tlhiso"
          action={
            <button
              onClick={() => toggle('marketingOptOut', !profile?.marketingOptOut)}
              disabled={saving === 'marketingOptOut'}
              className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
            >
              {profile?.marketingOptOut ? 'Re-subscribe' : 'Unsubscribe'}
            </button>
          }
        />
        <Row
          label="Delete account"
          hint="Permanently remove your account and all associated data"
          action={
            <button
              onClick={() => { setDeleteOpen(true); setDeleteInput(''); setDeleteError('') }}
              className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
            >
              <Trash2 size={12} /> Delete account
            </button>
          }
        />
      </Section>

      </>}

      {/* Delete confirmation modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-ink">Delete your account?</h3>
                <p className="mt-0.5 text-sm text-ink-secondary">
                  This is permanent. All your data will be deleted immediately and cannot be recovered.
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700 space-y-1">
              <p className="font-semibold">What will be deleted:</p>
              <ul className="list-disc list-inside space-y-0.5 text-red-600">
                <li>All customers, patients or tenants</li>
                <li>All invoices, campaigns and messages</li>
                <li>Your profile, settings and account history</li>
              </ul>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-ink">
                Type <span className="font-bold text-red-600">{user?.email}</span> to confirm
              </span>
              <input
                type="email"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder={user?.email}
                className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              />
            </label>

            {deleteError && (
              <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{deleteError}</p>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setDeleteOpen(false)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-ink hover:bg-surface-2 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteInput.trim().toLowerCase() !== user?.email?.toLowerCase()}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {deleting
                  ? <Loader2 size={15} className="animate-spin mx-auto" />
                  : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
