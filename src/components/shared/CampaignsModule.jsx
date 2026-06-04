// Shared Campaigns Module — used by all 4 industry dashboards.
//
// Channels:  SMS (BulkSMS)  ·  Email (SendGrid)  ·  WhatsApp (Twilio)
//
// "Send to" modes:
//   all     — every contact in the collection
//   tagged  — contacts whose tags[] overlap the selected tag set (multi-select)
//   custom  — contacts that pass ALL selected filter predicates (AND logic)
//
// marketingOptOut === true contacts are always excluded; count reported separately.
// The resolved segment definition (mode + tags/filters) is persisted on the
// campaign Firestore document alongside the counts.
//
// Sending:
//   Send now      — quota-checked, iterates recipients, updates sentCount/sentAt,
//                   increments users/{uid}.messagesUsed via Firestore increment().
//   Schedule later — writes status:'Scheduled' + scheduledFor Timestamp;
//                   the Cloud Function processScheduledCampaigns fires every 5 min.

import { useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'
import {
  addDoc, updateDoc, doc,
  collection, serverTimestamp, increment, Timestamp,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { sendMessage } from '../../services/messaging'
import Modal from './Modal'
import DataTable from './DataTable'
import {
  PlusCircle, Send, Users, Mail, MessageSquare, Phone as PhoneIcon,
  CheckCircle, Loader2, Tag, Filter, X, Clock, AlertTriangle, Calendar,
} from 'lucide-react'
import { PLANS } from '../../utils/industries'

// ── SA phone normalisation ────────────────────────────────────────────────────
function normalizeSAPhone(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, '')
  if (digits.startsWith('27') && digits.length === 11) return '+' + digits
  if (digits.startsWith('0') && digits.length === 10) return '+27' + digits.slice(1)
  if (digits.length === 9) return '+27' + digits
  return '+' + digits
}

// ── Industry config ───────────────────────────────────────────────────────────
const INDUSTRY_CONFIG = {
  medical: {
    contactCollection: 'patients',
    contactLabel:      'Patient',
    getName: c => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || '—',
    defaultTemplate:   'Hello {name}, this is a message from our practice. Please contact us if you have any questions.',
    customFilters: [
      { key: 'has_email',       label: 'Has email address',                filter: c => !!c.email },
      { key: 'has_phone',       label: 'Has phone number',                 filter: c => !!c.phone },
      { key: 'no_recent_appt',  label: 'No appointment in last 90 days',   needsAppointments: true },
      { key: 'has_chronic',     label: 'Has chronic condition',            filter: c => Array.isArray(c.chronicConditions) && c.chronicConditions.length > 0 },
      { key: 'has_medical_aid', label: 'Has medical aid',                  filter: c => !!c.medicalAid },
      { key: 'no_medical_aid',  label: 'No medical aid (private)',         filter: c => !c.medicalAid },
    ],
  },

  b2b: {
    contactCollection: 'customers',
    contactLabel:      'Client',
    getName: c => c.company || c.name || c.email || '—',
    defaultTemplate:   'Dear {name}, we would like to reach out to you regarding your account with us.',
    customFilters: [
      { key: 'has_email',      label: 'Has email address',                 filter: c => !!c.email },
      { key: 'has_phone',      label: 'Has phone number',                  filter: c => !!c.phone },
      { key: 'no_recent_appt', label: 'No appointment in last 90 days',    needsAppointments: true },
    ],
  },

  property: {
    contactCollection: 'tenants',
    contactLabel:      'Tenant',
    getName: c => [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email || '—',
    defaultTemplate:   'Dear {name}, this is a message from your property manager. Please contact us if you have any queries.',
    customFilters: [
      { key: 'has_email',       label: 'Has email address',                filter: c => !!c.email },
      { key: 'has_phone',       label: 'Has phone number',                 filter: c => !!c.phone },
      { key: 'no_recent_appt',  label: 'No appointment in last 90 days',   needsAppointments: true },
      {
        key: 'lease_ending_60', label: 'Lease ending within 60 days',
        filter: c => {
          if (!c.leaseEnd) return false
          const diff = (new Date(c.leaseEnd) - new Date()) / (1000 * 60 * 60 * 24)
          return diff >= 0 && diff <= 60
        },
      },
      {
        key: 'lease_ending_30', label: 'Lease ending within 30 days',
        filter: c => {
          if (!c.leaseEnd) return false
          const diff = (new Date(c.leaseEnd) - new Date()) / (1000 * 60 * 60 * 24)
          return diff >= 0 && diff <= 30
        },
      },
    ],
  },

  retail: {
    contactCollection: 'customers',
    contactLabel:      'Customer',
    getName: c => c.name || c.email || '—',
    defaultTemplate:   'Hi {name}, we have something exciting to share with you!',
    customFilters: [
      { key: 'has_email',      label: 'Has email address',                 filter: c => !!c.email },
      { key: 'has_phone',      label: 'Has phone number',                  filter: c => !!c.phone },
      { key: 'no_recent_appt', label: 'No appointment in last 90 days',    needsAppointments: true },
      {
        key: 'birthday_month', label: 'Birthday this month',
        filter: c => {
          const raw = c.birthday || c.dob
          if (!raw) return false
          return new Date(raw).getMonth() === new Date().getMonth()
        },
      },
    ],
  },
}

// ── Shared UI constants ───────────────────────────────────────────────────────
const STATUS_STYLES = {
  Sent:          'bg-green-100 text-green-700',
  Partial:       'bg-amber-100 text-amber-700',
  Failed:        'bg-red-100 text-red-600',
  Draft:         'bg-gray-100 text-gray-500',
  Scheduled:     'bg-blue-100 text-blue-600',
  Sending:       'bg-purple-100 text-purple-600',
  QuotaExceeded: 'bg-red-100 text-red-600',
}

const CHANNEL_META = {
  sms:      { label: 'SMS',      icon: PhoneIcon,     desc: 'BulkSMS',  color: 'text-blue-600' },
  email:    { label: 'Email',    icon: Mail,          desc: 'SendGrid', color: 'text-emerald-600' },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, desc: 'Twilio',   color: 'text-green-500' },
}

const BLANK_SENDTO = { mode: 'all', tags: [], filters: [] }

// ── Component ─────────────────────────────────────────────────────────────────
export default function CampaignsModule({ industry }) {
  const { user, profile } = useAuth()
  const uid    = user?.uid
  const config = INDUSTRY_CONFIG[industry]

  // Collections
  const contacts     = useCollection(uid && config ? `users/${uid}/${config.contactCollection}` : null)
  const campaigns    = useCollection(uid ? `users/${uid}/campaigns` : null)
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)

  // Modal & send state
  const [open,      setOpen]      = useState(false)
  const [sending,   setSending]   = useState(false)
  const [done,      setDone]      = useState(false)      // send-now completed
  const [scheduled, setScheduled] = useState(false)     // schedule-later completed
  const [progress,  setProgress]  = useState({ sent: 0, failed: 0, total: 0 })
  const [quotaError, setQuotaError] = useState(null)

  // Compose state
  const [sendTo,         setSendTo]         = useState(BLANK_SENDTO)
  const [channel,        setChannel]        = useState('sms')
  const [subject,        setSubject]        = useState('')
  const [body,           setBody]           = useState('')
  const [sendMode,       setSendMode]       = useState('now')   // 'now' | 'later'
  const [scheduledDate,  setScheduledDate]  = useState('')
  const [scheduledTime,  setScheduledTime]  = useState('09:00')

  // ── Tag extraction ──────────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const s = new Set()
    contacts.forEach(c => {
      if (Array.isArray(c.tags)) c.tags.forEach(t => { if (t?.trim()) s.add(t.trim()) })
    })
    return [...s].sort()
  }, [contacts])

  // ── 90-day appointment set ─────────────────────────────────────────────────
  const recentApptNames = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const s = new Set()
    appointments
      .filter(a => a.date && a.date >= cutoffStr)
      .forEach(a => { if (a.patient) s.add(a.patient) })
    return s
  }, [appointments])

  // ── Recipient resolution ───────────────────────────────────────────────────
  const resolution = useMemo(() => {
    if (!contacts.length || !config) return { included: [], optedOut: 0, noContactInfo: 0 }

    let pool = contacts.slice()

    if (sendTo.mode === 'tagged') {
      pool = sendTo.tags.length === 0
        ? []
        : contacts.filter(c =>
            Array.isArray(c.tags) && sendTo.tags.some(t => c.tags.includes(t))
          )
    } else if (sendTo.mode === 'custom') {
      if (sendTo.filters.length > 0) {
        pool = contacts.filter(c =>
          sendTo.filters.every(fKey => {
            const fDef = config.customFilters.find(f => f.key === fKey)
            if (!fDef) return true
            if (fDef.needsAppointments) return !recentApptNames.has(config.getName(c))
            return fDef.filter(c)
          })
        )
      }
    }

    const optedOut = pool.filter(c => c.marketingOptOut === true).length
    pool = pool.filter(c => c.marketingOptOut !== true)

    const hasContact   = c => channel === 'email' ? !!c.email : !!c.phone
    const noContactInfo = pool.filter(c => !hasContact(c)).length
    const included      = pool.filter(hasContact)

    return { included, optedOut, noContactInfo }
  }, [contacts, config, sendTo, channel, recentApptNames])

  const { included: recipients, optedOut, noContactInfo } = resolution

  // ── Quota helpers ─────────────────────────────────────────────────────────
  const planKey   = profile?.plan ?? 'starter'
  const planLimit = PLANS[planKey]?.messages ?? 100
  const used      = profile?.messagesUsed ?? 0
  const remaining = planLimit - used

  function checkQuota(count) {
    if (count > remaining) {
      setQuotaError(
        `This campaign would send ${count} message${count !== 1 ? 's' : ''}, ` +
        `but you only have ${remaining} remaining on your ${planKey} plan ` +
        `(${used.toLocaleString('en-ZA')} / ${planLimit.toLocaleString('en-ZA')} used). ` +
        `Please reduce your recipient list or upgrade your plan.`
      )
      return false
    }
    setQuotaError(null)
    return true
  }

  // ── Segment label builder ─────────────────────────────────────────────────
  function buildSegmentLabel() {
    if (sendTo.mode === 'tagged') {
      return sendTo.tags.length
        ? `Tagged: ${sendTo.tags.join(', ')}`
        : 'Tagged with (none selected)'
    }
    if (sendTo.mode === 'custom') {
      const labels = sendTo.filters.map(
        fKey => config.customFilters.find(f => f.key === fKey)?.label ?? fKey
      )
      return labels.length ? labels.join(' + ') : 'Custom filter'
    }
    return 'All contacts'
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function toggleTag(tag) {
    setSendTo(s => ({
      ...s,
      tags: s.tags.includes(tag) ? s.tags.filter(t => t !== tag) : [...s.tags, tag],
    }))
  }

  function toggleFilter(key) {
    setSendTo(s => ({
      ...s,
      filters: s.filters.includes(key) ? s.filters.filter(k => k !== key) : [...s.filters, key],
    }))
  }

  function openModal() {
    setSendTo(BLANK_SENDTO)
    setChannel('sms')
    setSubject('')
    setBody(config?.defaultTemplate ?? '')
    setDone(false)
    setScheduled(false)
    setSending(false)
    setProgress({ sent: 0, failed: 0, total: 0 })
    setSendMode('now')
    setScheduledDate('')
    setScheduledTime('09:00')
    setQuotaError(null)
    setOpen(true)
  }

  function closeModal() {
    if (sending) return
    setOpen(false)
  }

  // ── Shared campaign payload builder ───────────────────────────────────────
  function baseCampaignPayload() {
    const segmentLabel = buildSegmentLabel()
    return {
      subject: subject.trim() || segmentLabel,
      body,
      channel,
      segmentDefinition: {
        mode:    sendTo.mode,
        tags:    sendTo.mode === 'tagged' ? sendTo.tags    : [],
        filters: sendTo.mode === 'custom' ? sendTo.filters : [],
      },
      segmentLabel,
      recipientCount: recipients.length,
      optOutCount:    optedOut,
      industry,
      createdAt:      serverTimestamp(),
    }
  }

  // ── Send now ───────────────────────────────────────────────────────────────
  async function sendNow() {
    if (!uid || !body.trim() || recipients.length === 0) return
    if (!checkQuota(recipients.length)) return

    setSending(true)
    const total = recipients.length
    setProgress({ sent: 0, failed: 0, total })

    // Create campaign doc immediately so it appears in history as Sending
    const campaignRef = await addDoc(
      collection(db, 'users', uid, 'campaigns'),
      { ...baseCampaignPayload(), status: 'Sending' }
    )

    let sent = 0, failed = 0

    for (const contact of recipients) {
      const name    = config.getName(contact)
      const msgBody = body.replace(/\{name\}/gi, name)
      const to      = channel === 'email'
        ? contact.email
        : normalizeSAPhone(contact.phone)
      try {
        await sendMessage({
          type:    channel,
          to,
          subject: channel === 'email'
            ? (subject.trim() || `Message from your ${config.contactLabel.toLowerCase()} service`)
            : undefined,
          body:    msgBody,
          module:  'campaigns',
        })
        sent++
      } catch {
        failed++
      }
      setProgress({ sent, failed, total })
    }

    const finalStatus = failed === 0 ? 'Sent' : sent === 0 ? 'Failed' : 'Partial'

    // Update campaign doc with final counts
    await updateDoc(campaignRef, {
      sentCount:   sent,
      failedCount: failed,
      status:      finalStatus,
      sentAt:      serverTimestamp(),
    })

    // Increment messagesUsed on the user doc
    if (sent > 0) {
      await updateDoc(doc(db, 'users', uid), { messagesUsed: increment(sent) })
    }

    setSending(false)
    setDone(true)
  }

  // ── Schedule for later ─────────────────────────────────────────────────────
  async function scheduleLater() {
    if (!uid || !body.trim() || recipients.length === 0) return

    if (!scheduledDate || !scheduledTime) {
      setQuotaError('Please choose a date and time for the scheduled send.')
      return
    }

    const scheduledForDate = new Date(`${scheduledDate}T${scheduledTime}`)
    if (isNaN(scheduledForDate.getTime()) || scheduledForDate <= new Date()) {
      setQuotaError('Scheduled time must be in the future.')
      return
    }

    if (!checkQuota(recipients.length)) return

    await addDoc(
      collection(db, 'users', uid, 'campaigns'),
      {
        ...baseCampaignPayload(),
        status:       'Scheduled',
        scheduledFor: Timestamp.fromDate(scheduledForDate),
      }
    )

    setScheduled(true)
  }

  // ── History table ──────────────────────────────────────────────────────────
  const sortedCampaigns = useMemo(
    () => [...campaigns].sort(
      (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
    ),
    [campaigns],
  )

  const cols = [
    {
      key: 'subject', label: 'Campaign',
      render: r => (
        <div>
          <p className="font-semibold text-ink">{r.subject || '—'}</p>
          <p className="text-xs text-ink-secondary">{r.segmentLabel || '—'}</p>
        </div>
      ),
    },
    {
      key: 'channel', label: 'Channel',
      render: r => {
        const meta = CHANNEL_META[r.channel]
        if (!meta) return <span className="text-xs capitalize">{r.channel ?? '—'}</span>
        const Icon = meta.icon
        return (
          <span className={`flex items-center gap-1.5 text-xs font-semibold ${meta.color}`}>
            <Icon size={13} /> {meta.label}
          </span>
        )
      },
    },
    {
      key: 'recipientCount', label: 'Recipients',
      render: r => <span className="text-sm font-semibold text-ink">{r.recipientCount ?? '—'}</span>,
    },
    {
      key: 'sentCount', label: 'Sent',
      render: r => r.status === 'Scheduled'
        ? <span className="text-xs text-ink-secondary">—</span>
        : <span className="text-sm font-semibold text-green-700">{r.sentCount ?? '—'}</span>,
    },
    {
      key: 'failedCount', label: 'Failed',
      render: r => r.failedCount
        ? <span className="text-sm font-semibold text-red-500">{r.failedCount}</span>
        : <span className="text-sm text-ink-secondary">0</span>,
    },
    {
      key: 'status', label: 'Status',
      render: r => (
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.status] ?? STATUS_STYLES.Draft}`}>
          {r.status || 'Draft'}
        </span>
      ),
    },
    {
      key: 'createdAt', label: 'Date',
      render: r => {
        if (r.status === 'Scheduled' && r.scheduledFor) {
          const d = r.scheduledFor.toDate?.()
          return (
            <div>
              <p className="text-xs font-semibold text-blue-600">
                {d?.toLocaleDateString('en-ZA') ?? '—'}
              </p>
              <p className="text-[11px] text-ink-secondary">
                {d?.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }) ?? ''}
              </p>
            </div>
          )
        }
        const sent = r.sentAt?.toDate?.() ?? r.createdAt?.toDate?.()
        return <span className="text-xs text-ink-secondary">{sent?.toLocaleDateString('en-ZA') ?? '—'}</span>
      },
    },
  ]

  if (!config) {
    return <p className="text-sm text-ink-secondary">Campaigns not available for this industry.</p>
  }

  const totalSent      = campaigns.reduce((s, c) => s + (c.sentCount ?? 0), 0)
  const sentCampaigns  = campaigns.filter(c => c.status === 'Sent' || c.status === 'Partial').length
  const scheduledCount = campaigns.filter(c => c.status === 'Scheduled').length

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Campaigns</h2>
          <p className="mt-0.5 text-sm text-ink-secondary">
            Send targeted messages to your {config.contactLabel.toLowerCase()}s via SMS, Email, or WhatsApp.
          </p>
        </div>
        <button onClick={openModal}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> New Campaign
        </button>
      </div>

      {/* Quota bar */}
      <div className="rounded-xl border border-border bg-white px-5 py-3 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-secondary">
                Plan quota — {planKey.charAt(0).toUpperCase() + planKey.slice(1)}
              </span>
              <span className="text-xs font-semibold text-ink">
                {used.toLocaleString('en-ZA')} / {planLimit.toLocaleString('en-ZA')} messages
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className={`h-full rounded-full transition-all ${
                  used / planLimit > 0.9 ? 'bg-red-500' : used / planLimit > 0.7 ? 'bg-amber-500' : 'bg-primary'
                }`}
                style={{ width: `${Math.min((used / planLimit) * 100, 100)}%` }}
              />
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-extrabold text-ink">{remaining.toLocaleString('en-ZA')}</p>
            <p className="text-[11px] text-ink-secondary">remaining</p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-card border border-border bg-white p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Campaigns</p>
          <p className="mt-2 text-3xl font-extrabold text-ink">{campaigns.length}</p>
          <p className="mt-1 text-xs text-ink-secondary">{sentCampaigns} sent successfully</p>
        </div>
        <div className="rounded-card border border-border bg-white p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Messages Sent</p>
          <p className="mt-2 text-3xl font-extrabold text-green-600">{totalSent.toLocaleString('en-ZA')}</p>
          <p className="mt-1 text-xs text-ink-secondary">across all campaigns</p>
        </div>
        <div className="rounded-card border border-border bg-white p-4 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">Scheduled</p>
          <p className="mt-2 text-3xl font-extrabold text-blue-600">{scheduledCount}</p>
          <p className="mt-1 text-xs text-ink-secondary">
            {contacts.length} {config.contactLabel.toLowerCase()}s in base
          </p>
        </div>
      </div>

      {/* History table */}
      <DataTable
        columns={cols}
        data={sortedCampaigns}
        emptyMessage={`No campaigns yet. Click "New Campaign" to get started.`}
      />

      {/* ── Compose modal ─────────────────────────────────────────────────── */}
      <Modal open={open} onClose={closeModal} title="New Campaign" size="lg">

        {/* ── Scheduled success ── */}
        {scheduled && (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Clock size={32} className="text-blue-600" />
            </div>
            <h3 className="text-base font-bold text-ink">Campaign Scheduled!</h3>
            <p className="text-sm text-ink-secondary">
              Your campaign will be sent on{' '}
              <strong className="text-ink">
                {scheduledDate} at {scheduledTime}
              </strong>{' '}
              to <strong>{recipients.length}</strong>{' '}
              {config.contactLabel.toLowerCase()}{recipients.length !== 1 ? 's' : ''}.
            </p>
            <button onClick={closeModal}
              className="mx-auto flex items-center gap-2 rounded-xl bg-primary px-8 py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
              Close
            </button>
          </div>
        )}

        {/* ── Send-now done ── */}
        {done && !scheduled && (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h3 className="text-base font-bold text-ink">Campaign Sent!</h3>
            <p className="text-sm text-ink-secondary">
              Successfully sent to{' '}
              <strong className="text-green-700">{progress.sent}</strong>{' '}
              {config.contactLabel.toLowerCase()}{progress.sent !== 1 ? 's' : ''}.
              {progress.failed > 0 && (
                <> <strong className="text-red-600">{progress.failed}</strong> failed.</>
              )}
            </p>
            <button onClick={closeModal}
              className="mx-auto flex items-center gap-2 rounded-xl bg-primary px-8 py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
              Close
            </button>
          </div>
        )}

        {/* ── Sending progress ── */}
        {!done && !scheduled && sending && (
          <div className="space-y-5 py-4">
            <div className="flex items-center gap-3">
              <Loader2 size={22} className="animate-spin text-primary" />
              <div>
                <p className="text-sm font-bold text-ink">Sending campaign…</p>
                <p className="text-xs text-ink-secondary">
                  {progress.sent + progress.failed} of {progress.total} processed
                </p>
              </div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress.total ? ((progress.sent + progress.failed) / progress.total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-green-600">✓ {progress.sent} sent</span>
              {progress.failed > 0 && <span className="text-red-500">✗ {progress.failed} failed</span>}
            </div>
          </div>
        )}

        {/* ── Compose form ── */}
        {!done && !scheduled && !sending && (
          <div className="space-y-5">

            {/* 1 · Channel */}
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-secondary">Channel</p>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(CHANNEL_META).map(([key, meta]) => {
                  const Icon   = meta.icon
                  const active = channel === key
                  return (
                    <button key={key} type="button" onClick={() => setChannel(key)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition ${
                        active
                          ? 'border-primary bg-primary-light text-primary shadow-sm'
                          : 'border-border text-ink-secondary hover:border-primary/60'
                      }`}>
                      <Icon size={20} />
                      {meta.label}
                      <span className="text-[10px] opacity-60">{meta.desc}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2 · Send to */}
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-secondary">Send to</p>

              {/* Mode tab bar */}
              <div className="flex overflow-hidden rounded-xl border border-border">
                {[
                  { key: 'all',    label: 'All contacts',  icon: Users  },
                  { key: 'tagged', label: 'Tagged with',   icon: Tag    },
                  { key: 'custom', label: 'Custom filter', icon: Filter },
                ].map(mode => {
                  const Icon   = mode.icon
                  const active = sendTo.mode === mode.key
                  return (
                    <button key={mode.key} type="button"
                      onClick={() => setSendTo({ mode: mode.key, tags: [], filters: [] })}
                      className={`flex flex-1 items-center justify-center gap-1.5 border-r border-border py-2.5 text-xs font-semibold transition last:border-0 ${
                        active
                          ? 'bg-primary-light text-primary'
                          : 'bg-white text-ink-secondary hover:bg-surface-2'
                      }`}>
                      <Icon size={13} /> {mode.label}
                    </button>
                  )
                })}
              </div>

              {/* Tagged mode */}
              {sendTo.mode === 'tagged' && (
                <div className="mt-3">
                  {allTags.length === 0 ? (
                    <p className="text-xs text-ink-secondary">
                      No tags found on your {config.contactLabel.toLowerCase()}s yet.
                      Add tags to contacts to use this mode.
                    </p>
                  ) : (
                    <>
                      <p className="mb-2 text-[11px] text-ink-secondary">
                        Contacts matching <strong>any</strong> selected tag are included.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {allTags.map(tag => {
                          const active = sendTo.tags.includes(tag)
                          return (
                            <button key={tag} type="button" onClick={() => toggleTag(tag)}
                              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                                active
                                  ? 'border-primary bg-primary-light text-primary'
                                  : 'border-border text-ink-secondary hover:border-primary/60'
                              }`}>
                              {active && <X size={10} />}
                              {tag}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Custom filter mode */}
              {sendTo.mode === 'custom' && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] text-ink-secondary">
                    All ticked conditions must match (<strong>AND</strong> logic).
                    Leave all unticked to include everyone.
                  </p>
                  {config.customFilters.map(f => {
                    const active = sendTo.filters.includes(f.key)
                    return (
                      <label key={f.key}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-2.5 text-sm transition hover:bg-surface-2">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleFilter(f.key)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span className="font-medium text-ink">{f.label}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 3 · Live recipient summary */}
            <div className={`rounded-xl border p-4 space-y-3 transition-colors ${
              recipients.length > 0
                ? 'border-primary/30 bg-primary-light/30'
                : 'border-border bg-surface-2'
            }`}>
              <div className="flex items-center gap-2">
                <Users size={16} className={recipients.length > 0 ? 'text-primary' : 'text-ink-secondary'} />
                <span className={`text-sm font-bold ${recipients.length > 0 ? 'text-primary' : 'text-ink'}`}>
                  Will send to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
                </span>
              </div>

              {(optedOut > 0 || noContactInfo > 0) && (
                <div className="space-y-0.5">
                  {optedOut > 0 && (
                    <p className="text-xs text-ink-secondary">
                      <span className="font-semibold text-amber-600">{optedOut} excluded</span>
                      {' '}— opted out of marketing
                    </p>
                  )}
                  {noContactInfo > 0 && (
                    <p className="text-xs text-ink-secondary">
                      <span className="font-semibold text-ink">{noContactInfo} skipped</span>
                      {' '}— no {channel === 'email' ? 'email address' : 'phone number'} on file
                    </p>
                  )}
                </div>
              )}

              {recipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {recipients.slice(0, 8).map(c => (
                    <span key={c.id}
                      className="rounded-lg border border-primary/20 bg-white px-2 py-0.5 text-xs font-semibold text-primary">
                      {config.getName(c)}
                    </span>
                  ))}
                  {recipients.length > 8 && (
                    <span className="rounded-lg border border-border px-2 py-0.5 text-xs text-ink-secondary">
                      +{recipients.length - 8} more
                    </span>
                  )}
                </div>
              )}

              {recipients.length === 0 && sendTo.mode === 'tagged' && sendTo.tags.length === 0 && (
                <p className="text-xs font-semibold text-amber-600">Select at least one tag to see recipients.</p>
              )}
              {recipients.length === 0 && sendTo.mode !== 'tagged' && (
                <p className="text-xs font-semibold text-amber-600">
                  No {config.contactLabel.toLowerCase()}s match this selection for the {CHANNEL_META[channel].label} channel.
                </p>
              )}
            </div>

            {/* 4 · Subject (email only) */}
            {channel === 'email' && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">Subject *</span>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Important update from your practice"
                  className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              </label>
            )}

            {/* 5 · Message body */}
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-ink-secondary">
                <span>Message</span>
                <span className="font-normal opacity-70">
                  Use <code className="rounded bg-surface-2 px-1">{'{name}'}</code> to personalise
                </span>
              </span>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={5}
                placeholder="Type your message here…"
                className="w-full resize-none rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
              />
              <span className="mt-1 block text-right text-[11px] text-ink-secondary">
                {body.length} characters
                {channel === 'sms' && body.length > 160 && (
                  <span className="ml-2 font-semibold text-amber-600">
                    · {Math.ceil(body.length / 153)} SMS parts
                  </span>
                )}
              </span>
            </label>

            {/* 6 · When to send */}
            <div>
              <p className="mb-2 text-xs font-semibold text-ink-secondary">When to send</p>
              <div className="flex overflow-hidden rounded-xl border border-border">
                {[
                  { key: 'now',   label: 'Send now',           icon: Send  },
                  { key: 'later', label: 'Schedule for later', icon: Clock },
                ].map(m => {
                  const Icon   = m.icon
                  const active = sendMode === m.key
                  return (
                    <button key={m.key} type="button"
                      onClick={() => { setSendMode(m.key); setQuotaError(null) }}
                      className={`flex flex-1 items-center justify-center gap-2 border-r border-border py-2.5 text-xs font-semibold transition last:border-0 ${
                        active
                          ? 'bg-primary-light text-primary'
                          : 'bg-white text-ink-secondary hover:bg-surface-2'
                      }`}>
                      <Icon size={13} /> {m.label}
                    </button>
                  )
                })}
              </div>

              {/* Schedule date + time picker */}
              {sendMode === 'later' && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
                      <Calendar size={12} /> Date
                    </span>
                    <input
                      type="date"
                      value={scheduledDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={e => { setScheduledDate(e.target.value); setQuotaError(null) }}
                      className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
                      <Clock size={12} /> Time
                    </span>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={e => { setScheduledTime(e.target.value); setQuotaError(null) }}
                      className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Quota / validation error */}
            {quotaError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-xs leading-relaxed text-red-700">{quotaError}</p>
              </div>
            )}

            {/* 7 · Action button */}
            {sendMode === 'now' ? (
              <button
                onClick={sendNow}
                disabled={!body.trim() || recipients.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white transition hover:bg-[#4e7d6d] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={15} />
                Send now to {recipients.length} {config.contactLabel.toLowerCase()}{recipients.length !== 1 ? 's' : ''}
              </button>
            ) : (
              <button
                onClick={scheduleLater}
                disabled={!body.trim() || recipients.length === 0 || !scheduledDate || !scheduledTime}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Clock size={15} />
                Schedule for {scheduledDate || '…'} at {scheduledTime}
              </button>
            )}

          </div>
        )}
      </Modal>
    </div>
  )
}
