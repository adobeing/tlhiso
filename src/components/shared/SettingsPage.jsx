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
  Loader2,
} from 'lucide-react'

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

  return (
    <div className="max-w-2xl space-y-6">

      {/* Page heading */}
      <div>
        <h1 className="text-xl font-bold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-secondary">Manage your account, preferences, and billing.</p>
      </div>

      {/* Identity card */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-white px-6 py-5 shadow-sm">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-ink">{profile?.name || 'Your account'}</p>
          <p className="truncate text-sm text-ink-secondary">{user?.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge color={planBadgeColor[profile?.plan ?? 'starter']}>{plan?.name ?? 'Starter'} plan</Badge>
            <span className="text-xs text-ink-secondary capitalize">{profile?.industry ?? industry}</span>
          </div>
        </div>
        <Link
          to={`/${industry}/profile`}
          className="flex-shrink-0 rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-2 transition"
        >
          Edit profile
        </Link>
      </div>

      {/* Account */}
      <Section icon={User} title="Account" description="Login credentials and identity">
        <Row
          label="Email address"
          hint={user?.email}
        />
        <Row
          label="Account status"
          hint="Your account is active and in good standing"
          action={<Badge color="green">● Active</Badge>}
        />
        <Row
          label="Member since"
          hint={profile?.createdAt?.toDate?.()?.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' }) ?? '—'}
        />
      </Section>

      {/* Plan & Usage */}
      <Section icon={CreditCard} title="Plan & Billing" description="Subscription and message quota">
        <div className="px-6 py-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-base font-bold text-ink">{plan?.name ?? 'Starter'}</p>
              <p className="text-2xl font-extrabold text-primary mt-0.5">
                R{plan?.price?.toLocaleString('en-ZA') ?? '699'}
                <span className="text-sm font-normal text-ink-secondary">/month</span>
              </p>
            </div>
            <Badge color={planBadgeColor[profile?.plan ?? 'starter']}>{plan?.name}</Badge>
          </div>

          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-ink-secondary">
            <span>Message usage</span>
            <span>{used.toLocaleString('en-ZA')} / {planLimit.toLocaleString('en-ZA')}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${usagePct > 90 ? 'bg-red-500' : usagePct > 70 ? 'bg-amber-500' : 'bg-primary'}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-secondary">
            <span className="font-semibold text-ink">{Math.max(0, planLimit - used).toLocaleString('en-ZA')}</span> messages remaining this period
          </p>

          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-secondary">Included in your plan</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {[
                `${plan?.messages?.toLocaleString('en-ZA') ?? 100} messages/month`,
                'SMS, Email & WhatsApp',
                'Campaign management',
                'POPIA compliance module',
                ...(plan?.key !== 'starter' ? ['Surveys & opt-in', 'Advanced segmentation'] : []),
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

      {/* Notifications */}
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

      {/* Security */}
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

      {/* Data & Privacy */}
      <Section icon={Mail} title="Data & Privacy" description="Your rights under South Africa's POPIA">
        <Row
          label="POPIA consent"
          hint={profile?.popiaConsent ? 'You have provided consent for data processing' : 'Consent has not been recorded yet'}
          action={<Badge color={profile?.popiaConsent ? 'green' : 'amber'}>{profile?.popiaConsent ? 'Given' : 'Pending'}</Badge>}
        />
        <Row
          label="POPIA compliance centre"
          hint="Manage consent records, data subject requests, and breach logs"
          action={
            <Link
              to={`/${industry}/popia`}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Open <ChevronRight size={13} />
            </Link>
          }
        />
      </Section>

      {/* Danger zone */}
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
