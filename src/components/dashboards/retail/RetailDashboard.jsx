import { useState, useMemo } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import DashboardLayout from '../../shared/DashboardLayout'
import { useAuth } from '../../../contexts/AuthContext'
import { useCollection } from '../../../hooks/useCollection'
import StatCard from '../../shared/StatCard'
import DataTable from '../../shared/DataTable'
import Modal from '../../shared/Modal'
import ProfilePage from '../../shared/ProfilePage'
import PopiaModule from '../../shared/PopiaModule'
import { collection, addDoc, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { db, functions } from '../../../services/firebase'
import { httpsCallable } from 'firebase/functions'
import { PlusCircle, Trash2, Tag, Calendar, Eye, Pencil, Bell, Loader2, X } from 'lucide-react'
import CampaignsModule from '../../shared/CampaignsModule'
import SetupChecklist from '../../shared/SetupChecklist'

// ── Shared layout helpers ───────────────────────────────────────────────────
function PageHead({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

function AddButton({ onClick, children }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4e7d6d]">
      <PlusCircle size={15} /> {children}
    </button>
  )
}

function SectionCard({ icon: Icon, title, action, children }) {
  return (
    <div className="rounded-card border border-border bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          {Icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-light text-primary"><Icon size={14} /></span>}
          <h3 className="text-sm font-bold text-ink">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function EmptyState({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      {Icon && <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-secondary"><Icon size={20} /></span>}
      <p className="text-sm text-ink-secondary">{message}</p>
    </div>
  )
}

function Field({ label, error, textarea, select, children, ...props }) {
  const cls = 'w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30'
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">{label}</span>
      {textarea ? <textarea {...props} className={cls + ' resize-none h-24'} /> :
       select ? <select {...props} className={cls}>{children}</select> :
       <input {...props} className={cls} />}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </label>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const customers = useCollection(uid ? `users/${uid}/customers` : null)
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)
  const campaigns = useCollection(uid ? `users/${uid}/campaigns` : null)
  const deals = useCollection(uid ? `users/${uid}/deals` : null)
  const today = new Date().toISOString().slice(0, 10)
  const todayAppts = appointments.filter(a => a.date === today)

  return (
    <div className="space-y-6">
      <SetupChecklist industry="retail" />
      <PageHead
        title={`Welcome back${profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}`}
        subtitle="Your customers and campaigns at a glance."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Customers" value={customers.length} icon="👥" />
        <StatCard label="Appointments Today" value={todayAppts.length} icon="📅" color="blue" />
        <StatCard label="Campaigns Sent" value={campaigns.length} icon="📣" color="purple" />
        <StatCard label="Active Deals" value={deals.filter(d=>d.active).length} icon="🏷️" color="orange" trend={deals.length ? `${deals.length} total` : 'None yet'} trendTone="flat" />
      </div>
      <SectionCard icon={Calendar} title="Upcoming Appointments"
        action={<Link to="/retail/appointments" className="text-xs font-semibold text-primary hover:underline">View all →</Link>}>
        {todayAppts.length === 0
          ? <EmptyState icon={Calendar} message="No appointments today." />
          : <div className="divide-y divide-border">
              {todayAppts.map(a => (
                <div key={a.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
                      {(a.customer || '?').slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-ink">{a.customer}</span>
                  </div>
                  <span className="text-xs text-ink-secondary">{a.time} · {a.service}</span>
                </div>
              ))}
            </div>
        }
      </SectionCard>
    </div>
  )
}

// ── Customers ─────────────────────────────────────────────────────────────────
function Customers() {
  const { user } = useAuth()
  const uid = user?.uid
  const customers = useCollection(uid ? `users/${uid}/customers` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', birthday: '', notes: '', tags: '' })
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', birthday: '', notes: '', tags: '' })
  async function save() {
    if (!uid || !form.name) return
    await addDoc(collection(db, 'users', uid, 'customers'), {
      ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: serverTimestamp(),
    })
    setOpen(false)
  }

  async function saveEdit() {
    if (!uid || !editForm.name || !editing) return
    await updateDoc(doc(db, 'users', uid, 'customers', editing.id), {
      ...editForm, tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
    })
    setEditing(null)
  }

  const cols = [
    { key: 'name', label: 'Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'birthday', label: 'Birthday' },
    { key: 'tags', label: 'Tags', render: r => (r.tags ?? []).map(t => (
      <span key={t} className="mr-1 rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary">{t}</span>
    ))},
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex items-center gap-1">
        <button onClick={e => { e.stopPropagation(); setViewing(r) }}
          title="View" className="rounded p-1 text-ink-secondary hover:bg-surface-2"><Eye size={14} /></button>
        <button onClick={e => { e.stopPropagation(); setEditing(r); setEditForm({ name: r.name||'', phone: r.phone||'', email: r.email||'', birthday: r.birthday||'', notes: r.notes||'', tags: (r.tags||[]).join(', ') }) }}
          title="Edit" className="rounded p-1 text-primary hover:bg-primary-light"><Pencil size={14} /></button>
        <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this customer? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'customers', r.id)) }}
          title="Delete" className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <PageHead title="Customers" subtitle="Your customer list & contact details"
        action={<AddButton onClick={() => setOpen(true)}>Add Customer</AddButton>} />
      <DataTable columns={cols} data={customers} emptyMessage="No customers yet." />

      {/* Add modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Customer">
        <div className="space-y-4">
          <Field label="Full Name *" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} />
          <Field label="Phone (+27…)" value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} />
          <Field label="Email" type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
          <Field label="Birthday" type="date" value={form.birthday} onChange={e => setForm(f=>({...f,birthday:e.target.value}))} />
          <Field label="Notes" textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} />
          <Field label="Tags (comma-separated)" value={form.tags} onChange={e => setForm(f=>({...f,tags:e.target.value}))} />
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Save Customer</button>
        </div>
      </Modal>

      {/* View modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Customer Details">
        {viewing && (
          <div className="space-y-3 text-sm">
            {[
              { label: 'Full Name', value: viewing.name },
              { label: 'Phone', value: viewing.phone },
              { label: 'Email', value: viewing.email },
              { label: 'Birthday', value: viewing.birthday },
              { label: 'Notes', value: viewing.notes },
            ].map(({ label, value }) => value ? (
              <div key={label} className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-4 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">{label}</span>
                <span className="text-sm text-ink">{value}</span>
              </div>
            ) : null)}
            {viewing.tags?.length > 0 && (
              <div className="rounded-xl bg-surface-2 px-4 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">Tags</span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {viewing.tags.map(t => <span key={t} className="rounded-full bg-primary-light px-2.5 py-0.5 text-[11px] font-semibold text-primary">{t}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Customer">
        <div className="space-y-4">
          <Field label="Full Name *" value={editForm.name} onChange={e => setEditForm(f=>({...f,name:e.target.value}))} />
          <Field label="Phone (+27…)" value={editForm.phone} onChange={e => setEditForm(f=>({...f,phone:e.target.value}))} />
          <Field label="Email" type="email" value={editForm.email} onChange={e => setEditForm(f=>({...f,email:e.target.value}))} />
          <Field label="Birthday" type="date" value={editForm.birthday} onChange={e => setEditForm(f=>({...f,birthday:e.target.value}))} />
          <Field label="Notes" textarea value={editForm.notes} onChange={e => setEditForm(f=>({...f,notes:e.target.value}))} />
          <Field label="Tags (comma-separated)" value={editForm.tags} onChange={e => setEditForm(f=>({...f,tags:e.target.value}))} />
          <button onClick={saveEdit} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Save Changes</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Weekly Deals ──────────────────────────────────────────────────────────────
function WeeklyDeals() {
  const { user } = useAuth()
  const uid = user?.uid
  const deals = useCollection(uid ? `users/${uid}/deals` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', discount: '', validFrom: '', validTo: '', active: true })

  async function save() {
    if (!uid || !form.title) return
    await addDoc(collection(db, 'users', uid, 'deals'), { ...form, createdAt: serverTimestamp() })
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <PageHead title="Weekly Deals" subtitle="Promotions to send to opted-in customers"
        action={<AddButton onClick={() => setOpen(true)}>Create Deal</AddButton>} />
      {deals.length === 0
        ? <SectionCard icon={Tag} title="Active Deals"><EmptyState icon={Tag} message="No active deals. Create your first deal!" /></SectionCard>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map(d => (
              <div key={d.id} className="group relative overflow-hidden rounded-card border border-border bg-white shadow-card transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2 border-b border-border bg-gradient-to-r from-primary-light to-surface-2 px-5 py-4">
                  <h3 className="font-bold leading-tight text-ink">{d.title}</h3>
                  <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-white">{d.discount}% off</span>
                </div>
                <div className="p-5">
                  <p className="text-sm text-ink-secondary">{d.description}</p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-secondary">
                    <Calendar size={13} className="text-primary" />
                    {d.validFrom} → {d.validTo}
                  </div>
                  <button onClick={() => { if (!window.confirm('Delete this deal? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'deals', d.id)) }}
                    className="mt-4 text-xs font-semibold text-red-400 hover:underline">Delete deal</button>
                </div>
              </div>
            ))}
          </div>
      }
      <Modal open={open} onClose={() => setOpen(false)} title="New Weekly Deal">
        <div className="space-y-4">
          <Field label="Deal Title *" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} />
          <Field label="Description" textarea value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} />
          <Field label="Discount %" type="number" value={form.discount} onChange={e => setForm(f=>({...f,discount:e.target.value}))} />
          <Field label="Valid From" type="date" value={form.validFrom} onChange={e => setForm(f=>({...f,validFrom:e.target.value}))} />
          <Field label="Valid To" type="date" value={form.validTo} onChange={e => setForm(f=>({...f,validTo:e.target.value}))} />
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Create Deal</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Appointments ──────────────────────────────────────────────────────────────
const RETAIL_APPT_STATUS = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No-show']

function Appointments() {
  const { user } = useAuth()
  const uid = user?.uid
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)
  const customers = useCollection(uid ? `users/${uid}/customers` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ customerId: '', date: new Date().toISOString().slice(0, 10), time: '', service: '', duration: '60', status: 'Scheduled', notes: '' })
  const [saving, setSaving] = useState(false)
  const [sendingId, setSendingId] = useState(null)

  async function save() {
    if (!uid || !form.date || !form.time) { alert('Date and time are required.'); return }
    setSaving(true)
    try {
      const customer = customers.find(c => c.id === form.customerId)
      await addDoc(collection(db, 'users', uid, 'appointments'), {
        ...form, customer: customer?.name ?? '', customerPhone: customer?.phone ?? '', createdAt: serverTimestamp(),
      })
      setForm({ customerId: '', date: new Date().toISOString().slice(0, 10), time: '', service: '', duration: '60', status: 'Scheduled', notes: '' })
      setOpen(false)
    } finally { setSaving(false) }
  }

  async function sendReminder(appt) {
    if (!appt.customerPhone) { alert('No phone number on file for this customer.'); return }
    setSendingId(appt.id)
    try {
      const fn = httpsCallable(functions, 'sendSMS')
      const msg = `Reminder: ${appt.customer}, you have an appointment on ${appt.date} at ${appt.time}${appt.service ? ` for ${appt.service}` : ''}. Reply to reschedule.`
      await fn({ to: appt.customerPhone, message: msg })
      await updateDoc(doc(db, 'users', uid, 'appointments', appt.id), { reminderSent: true })
      await addDoc(collection(db, 'users', uid, 'messages'), { to: appt.customerPhone, type: 'sms', body: msg, module: 'appointment-reminder', status: 'sent', sentAt: serverTimestamp() })
    } catch { alert('Reminder failed — check BulkSMS credentials.') } finally { setSendingId(null) }
  }

  const badge = s => ({ Scheduled: 'bg-blue-50 text-blue-600', Confirmed: 'bg-primary-light text-primary', Completed: 'bg-green-50 text-green-600', Cancelled: 'bg-red-50 text-red-500', 'No-show': 'bg-orange-50 text-orange-500' }[s] || 'bg-surface-2 text-ink-secondary')

  const cols = [
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Time' },
    { key: 'customer', label: 'Customer' },
    { key: 'service', label: 'Service' },
    { key: 'status', label: 'Status', render: r => (
      <select value={r.status} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); updateDoc(doc(db, 'users', uid, 'appointments', r.id), { status: e.target.value }) }}
        className={`rounded-full border-0 px-2 py-1 text-[11px] font-semibold ${badge(r.status)}`}>
        {RETAIL_APPT_STATUS.map(s => <option key={s}>{s}</option>)}
      </select>
    )},
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => sendReminder(r)} disabled={sendingId === r.id} title="Send SMS reminder" className="rounded p-1 text-primary hover:bg-primary-light disabled:opacity-50">
          {sendingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
        </button>
        <button onClick={() => { if (!window.confirm('Delete this appointment? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'appointments', r.id)) }}
          className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <PageHead title="Appointments" subtitle="Bookings and scheduling"
        action={<AddButton onClick={() => { setForm({ customerId: '', date: new Date().toISOString().slice(0, 10), time: '', service: '', duration: '60', status: 'Scheduled', notes: '' }); setOpen(true) }}>Book Appointment</AddButton>} />
      <DataTable columns={cols} data={appointments} emptyMessage="No appointments yet." />
      <Modal open={open} onClose={() => setOpen(false)} title="Book Appointment">
        <div className="space-y-4">
          <Field label="Customer" select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date *" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <Field label="Time *" type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
          </div>
          <Field label="Service" value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} placeholder="e.g. Haircut, Massage, Session" />
          <Field label="Duration" select value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}>
            {['30', '60', '90', '120'].map(d => <option key={d} value={d}>{d} min</option>)}
          </Field>
          <Field label="Status" select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {RETAIL_APPT_STATUS.map(s => <option key={s}>{s}</option>)}
          </Field>
          <Field label="Notes" textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <button onClick={save} disabled={saving} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save Appointment'}</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Messages ──────────────────────────────────────────────────────────────────
function Messages() {
  const { user } = useAuth()
  const uid = user?.uid
  const messages = useCollection(uid ? `users/${uid}/messages` : null)
  const sorted = useMemo(() => [...messages].sort((a, b) => (b.sentAt?.toMillis?.() ?? 0) - (a.sentAt?.toMillis?.() ?? 0)), [messages])
  const counts = useMemo(() => { const c = { sms: 0, email: 0, whatsapp: 0 }; messages.forEach(m => { if (m.type in c) c[m.type]++ }); return c }, [messages])
  const channelBadge = t => ({ sms: 'bg-blue-100 text-blue-600', email: 'bg-emerald-100 text-emerald-700', whatsapp: 'bg-green-100 text-green-600' }[t] ?? 'bg-gray-100 text-gray-500')
  const cols = [
    { key: 'type', label: 'Channel', render: r => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${channelBadge(r.type)}`}>{r.type}</span> },
    { key: 'to', label: 'Recipient' },
    { key: 'body', label: 'Message', render: r => <span className="line-clamp-2 max-w-xs text-sm text-ink-secondary">{r.body}</span> },
    { key: 'module', label: 'Source', render: r => <span className="capitalize text-xs text-ink-secondary">{(r.module || '—').replace(/-/g, ' ')}</span> },
    { key: 'sentAt', label: 'Sent', render: r => <span className="text-xs text-ink-secondary">{r.sentAt?.toDate?.()?.toLocaleDateString('en-ZA') ?? '—'}</span> },
  ]
  return (
    <div className="space-y-4">
      <PageHead title="Messages" subtitle="Log of all messages sent from your account" />
      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'SMS Sent', val: counts.sms, color: 'text-blue-600' }, { label: 'Emails Sent', val: counts.email, color: 'text-emerald-600' }, { label: 'WhatsApp Sent', val: counts.whatsapp, color: 'text-green-600' }].map(s => (
          <div key={s.label} className="rounded-card border border-border bg-white p-4 shadow-card text-center">
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.val}</p>
            <p className="mt-1 text-xs font-semibold text-ink-secondary">{s.label}</p>
          </div>
        ))}
      </div>
      <DataTable columns={cols} data={sorted} emptyMessage="No messages sent yet. Use Campaigns or send appointment reminders to get started." />
    </div>
  )
}

// ── Surveys ───────────────────────────────────────────────────────────────────
function Surveys() {
  const { user } = useAuth()
  const uid = user?.uid
  const surveys = useCollection(uid ? `users/${uid}/surveys` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', questions: [''] })
  function addQ() { setForm(f => ({ ...f, questions: [...f.questions, ''] })) }
  function updateQ(i, v) { setForm(f => { const q = [...f.questions]; q[i] = v; return { ...f, questions: q } }) }
  function removeQ(i) { setForm(f => ({ ...f, questions: f.questions.filter((_, idx) => idx !== i) })) }
  async function save() {
    if (!uid || !form.title) return
    await addDoc(collection(db, 'users', uid, 'surveys'), { ...form, questions: form.questions.filter(q => q.trim()), status: 'Draft', responses: 0, createdAt: serverTimestamp() })
    setForm({ title: '', description: '', questions: [''] }); setOpen(false)
  }
  const statusColor = s => ({ Draft: 'bg-gray-100 text-gray-600', Active: 'bg-green-100 text-green-700', Closed: 'bg-amber-100 text-amber-700' }[s] ?? '')
  const cols = [
    { key: 'title', label: 'Survey' },
    { key: 'questions', label: 'Questions', render: r => `${(r.questions || []).length}` },
    { key: 'responses', label: 'Responses', render: r => r.responses ?? 0 },
    { key: 'status', label: 'Status', render: r => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(r.status)}`}>{r.status || 'Draft'}</span> },
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex gap-1">
        {r.status !== 'Active' && <button onClick={e => { e.stopPropagation(); updateDoc(doc(db, 'users', uid, 'surveys', r.id), { status: 'Active' }) }} className="rounded px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-50">Activate</button>}
        {r.status === 'Active' && <button onClick={e => { e.stopPropagation(); updateDoc(doc(db, 'users', uid, 'surveys', r.id), { status: 'Closed' }) }} className="rounded px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50">Close</button>}
        <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this survey? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'surveys', r.id)) }} className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]
  return (
    <div className="space-y-4">
      <PageHead title="Surveys" subtitle="Collect feedback from customers" action={<AddButton onClick={() => setOpen(true)}>New Survey</AddButton>} />
      <DataTable columns={cols} data={surveys} emptyMessage="No surveys yet." />
      <Modal open={open} onClose={() => setOpen(false)} title="New Survey" size="lg">
        <div className="space-y-4">
          <Field label="Survey Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Field label="Description" textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-secondary">Questions</p>
            {form.questions.map((q, i) => (
              <div key={i} className="mb-2 flex items-center gap-2">
                <input value={q} onChange={e => updateQ(i, e.target.value)} placeholder={`Question ${i + 1}`}
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
                {form.questions.length > 1 && <button onClick={() => removeQ(i)} className="text-red-400 hover:text-red-600"><X size={15} /></button>}
              </div>
            ))}
            <button onClick={addQ} className="text-xs font-semibold text-primary hover:underline">+ Add question</button>
          </div>
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Create Survey</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Opt-In ────────────────────────────────────────────────────────────────────
function OptIn() {
  const { user } = useAuth()
  const uid = user?.uid
  const customers = useCollection(uid ? `users/${uid}/customers` : null)
  const [toggling, setToggling] = useState(null)
  async function toggle(customer) {
    setToggling(customer.id)
    await updateDoc(doc(db, 'users', uid, 'customers', customer.id), { marketingOptOut: !customer.marketingOptOut })
    setToggling(null)
  }
  const cols = [
    { key: 'name', label: 'Customer' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Marketing Status', render: r => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.marketingOptOut ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{r.marketingOptOut ? 'Opted Out' : 'Opted In'}</span> },
    { key: 'actions', label: '', sortable: false, render: r => (
      <button onClick={e => { e.stopPropagation(); toggle(r) }} disabled={toggling === r.id}
        className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${r.marketingOptOut ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}>
        {toggling === r.id ? '…' : r.marketingOptOut ? 'Opt In' : 'Opt Out'}
      </button>
    )},
  ]
  return (
    <div className="space-y-4">
      <PageHead title="Marketing Opt-In" subtitle="Manage customer marketing consent" />
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-card border border-border bg-white p-4 shadow-card text-center">
          <p className="text-3xl font-extrabold text-green-600">{customers.filter(c => !c.marketingOptOut).length}</p>
          <p className="mt-1 text-xs font-semibold text-ink-secondary">Opted In</p>
        </div>
        <div className="rounded-card border border-border bg-white p-4 shadow-card text-center">
          <p className="text-3xl font-extrabold text-red-500">{customers.filter(c => c.marketingOptOut).length}</p>
          <p className="mt-1 text-xs font-semibold text-ink-secondary">Opted Out</p>
        </div>
      </div>
      <DataTable columns={cols} data={customers} emptyMessage="No customers yet." />
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────
function Settings() {
  const { user } = useAuth()
  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-ink">Settings</h2>
      <div className="rounded-card border border-border bg-white p-6 shadow-card space-y-3">
        <p className="text-sm text-ink-secondary">Email: <strong className="text-ink">{user?.email}</strong></p>
        <p className="text-sm text-ink-secondary">To change your password, use the{' '}
          <a href="/forgot-password" className="text-primary font-semibold hover:underline">password reset</a> flow.
        </p>
      </div>
    </div>
  )
}

export default function RetailDashboard() {
  return (
    <DashboardLayout industry="retail" pageTitle="Consumer Business">
      <Routes>
        <Route path="dashboard" element={<Overview />} />
        <Route path="customers" element={<Customers />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="messages" element={<Messages />} />
        <Route path="weekly-deals" element={<WeeklyDeals />} />
        <Route path="surveys" element={<Surveys />} />
        <Route path="optin" element={<OptIn />} />
        <Route path="campaigns" element={<CampaignsModule industry="retail" />} />
        <Route path="profile" element={<ProfilePage industry="retail" />} />
        <Route path="popia" element={<PopiaModule />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<div><h2 className="text-base font-bold text-ink mb-3">Coming Soon</h2><p className="text-sm text-ink-secondary">This section is being built.</p></div>} />
      </Routes>
    </DashboardLayout>
  )
}
