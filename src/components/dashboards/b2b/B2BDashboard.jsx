import { useState, useMemo } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import DashboardLayout from '../../shared/DashboardLayout'
import { useAuth } from '../../../contexts/AuthContext'
import { useCollection } from '../../../hooks/useCollection'
import StatCard from '../../shared/StatCard'
import DataTable from '../../shared/DataTable'
import Modal from '../../shared/Modal'
import ProfilePage from '../../shared/ProfilePage'
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db, functions } from '../../../services/firebase'
import { httpsCallable } from 'firebase/functions'
import { PlusCircle, Pencil, Trash2, Eye, Bell, Loader2, X } from 'lucide-react'
import CampaignsModule from '../../shared/CampaignsModule'
import SetupChecklist from '../../shared/SetupChecklist'
import SettingsPage from '../../shared/SettingsPage'

// ── Shared form field ─────────────────────────────────────────────────────────
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

function SectionCard({ title, action, children }) {
  return (
    <div className="rounded-card border border-border bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Overview() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const clients = useCollection(uid ? `users/${uid}/customers` : null)
  const invoices = useCollection(uid ? `users/${uid}/invoices` : null)
  const projects = useCollection(uid ? `users/${uid}/projects` : null)
  const messages = useCollection(uid ? `users/${uid}/messages` : null)

  const outstanding = invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue').length
  const active = projects.filter(p => p.status === 'active').length

  return (
    <div className="space-y-6">
      <SetupChecklist industry="b2b" />
      <PageHead
        title={`Welcome back${profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}`}
        subtitle="Your business at a glance."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Clients" value={clients.length} icon="👥" />
        <StatCard label="Outstanding Invoices" value={outstanding} icon="🧾" color="orange" trend={outstanding ? 'Awaiting payment' : 'All settled'} trendTone={outstanding ? 'down' : 'up'} />
        <StatCard label="Active Projects" value={active} icon="📁" color="blue" />
        <StatCard label="Messages Sent" value={messages.length} icon="✉️" color="purple" />
      </div>
      <SectionCard title="Quick Actions">
        <div className="flex flex-wrap gap-3">
          {[
            { label: '+ New Invoice', href: '/b2b/invoices' },
            { label: '+ New Client', href: '/b2b/clients' },
            { label: 'Send Message', href: '/b2b/messages' },
          ].map(a => (
            <a key={a.label} href={a.href}
              className="rounded-lg border border-primary/30 bg-primary-light px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
              {a.label}
            </a>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Recent Clients"
        action={<a href="/b2b/clients" className="text-xs font-semibold text-primary hover:underline">View all →</a>}>
        <DataTable
          columns={[
            { key: 'name', label: 'Client' },
            { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' },
          ]}
          data={clients.slice(0, 5)}
          emptyMessage="No clients yet. Add your first client."
        />
      </SectionCard>
    </div>
  )
}

// ── Clients ───────────────────────────────────────────────────────────────────
function Clients() {
  const { user } = useAuth()
  const uid = user?.uid
  const clients = useCollection(uid ? `users/${uid}/customers` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', tags: '' })
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', company: '', email: '', phone: '', tags: '' })

  async function save() {
    if (!uid || !form.name) return
    await addDoc(collection(db, 'users', uid, 'customers'), {
      ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: serverTimestamp(),
    })
    setOpen(false); setForm({ name: '', company: '', email: '', phone: '', tags: '' })
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
    { key: 'company', label: 'Company' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'tags', label: 'Tags', render: r => (r.tags ?? []).map(t => (
      <span key={t} className="mr-1 rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary">{t}</span>
    ))},
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex items-center gap-1">
        <button onClick={e => { e.stopPropagation(); setViewing(r) }}
          title="View" className="rounded p-1 text-ink-secondary hover:bg-surface-2"><Eye size={14} /></button>
        <button onClick={e => { e.stopPropagation(); setEditing(r); setEditForm({ name: r.name||'', company: r.company||'', email: r.email||'', phone: r.phone||'', tags: (r.tags||[]).join(', ') }) }}
          title="Edit" className="rounded p-1 text-primary hover:bg-primary-light"><Pencil size={14} /></button>
        <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this client? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'customers', r.id)) }}
          title="Delete" className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <PageHead title="Clients" subtitle="Your client accounts & contacts"
        action={<AddButton onClick={() => setOpen(true)}>Add Client</AddButton>} />
      <DataTable columns={cols} data={clients} emptyMessage="No clients yet." />

      {/* Add modal */}
      <Modal open={open} onClose={() => setOpen(false)} title="New Client">
        <div className="space-y-4">
          <Field label="Full name *" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          <Field label="Company" value={form.company} onChange={e => setForm(f => ({...f, company: e.target.value}))} />
          <Field label="Email" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
          <Field label="Phone (+27…)" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
          <Field label="Tags (comma-separated)" value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))} />
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">Save Client</button>
        </div>
      </Modal>

      {/* View modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Client Details">
        {viewing && (
          <div className="space-y-3 text-sm">
            {[
              { label: 'Full Name', value: viewing.name },
              { label: 'Company', value: viewing.company },
              { label: 'Email', value: viewing.email },
              { label: 'Phone', value: viewing.phone },
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
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Client">
        <div className="space-y-4">
          <Field label="Full name *" value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
          <Field label="Company" value={editForm.company} onChange={e => setEditForm(f => ({...f, company: e.target.value}))} />
          <Field label="Email" type="email" value={editForm.email} onChange={e => setEditForm(f => ({...f, email: e.target.value}))} />
          <Field label="Phone (+27…)" value={editForm.phone} onChange={e => setEditForm(f => ({...f, phone: e.target.value}))} />
          <Field label="Tags (comma-separated)" value={editForm.tags} onChange={e => setEditForm(f => ({...f, tags: e.target.value}))} />
          <button onClick={saveEdit} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">Save Changes</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Invoices ──────────────────────────────────────────────────────────────────
function Invoices() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const invoices = useCollection(uid ? `users/${uid}/invoices` : null)
  const clients = useCollection(uid ? `users/${uid}/customers` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ clientId: '', dueDate: '', notes: '', items: [{ desc: '', qty: 1, price: 0 }] })

  const total = form.items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0)
  const vat = total * 0.15

  function addLine() { setForm(f => ({...f, items: [...f.items, { desc: '', qty: 1, price: 0 }]})) }

  async function save() {
    if (!uid) return
    const client = clients.find(c => c.id === form.clientId)
    await addDoc(collection(db, 'users', uid, 'invoices'), {
      ...form, client: client?.name ?? '', total: total + vat, vat, status: 'Draft',
      createdAt: serverTimestamp(),
    })
    setOpen(false)
  }

  const statusColor = s => ({
    Draft: 'bg-gray-100 text-gray-600', Sent: 'bg-blue-100 text-blue-700',
    Paid: 'bg-green-100 text-green-700', Overdue: 'bg-red-100 text-red-700',
  }[s] ?? 'bg-gray-100 text-gray-600')

  const cols = [
    { key: 'client', label: 'Client' },
    { key: 'total', label: 'Amount', render: r => `R${Number(r.total ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'status', label: 'Status', render: r => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(r.status)}`}>{r.status}</span> },
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex gap-2">
        <button onClick={e => { e.stopPropagation(); updateDoc(doc(db, 'users', uid, 'invoices', r.id), { status: 'Paid' }) }}
          className="rounded px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-50">Mark Paid</button>
        <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this invoice? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'invoices', r.id)) }}
          className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <PageHead title="Invoices" subtitle="Create, send and track invoices"
        action={<AddButton onClick={() => setOpen(true)}>New Invoice</AddButton>} />
      <DataTable columns={cols} data={invoices} />
      <Modal open={open} onClose={() => setOpen(false)} title="New Invoice" size="lg">
        <div className="space-y-4">
          <Field label="Client" select value={form.clientId} onChange={e => setForm(f => ({...f, clientId: e.target.value}))}>
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Field>
          <Field label="Due Date" type="date" value={form.dueDate} onChange={e => setForm(f => ({...f, dueDate: e.target.value}))} />
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-secondary">Line Items</p>
            {form.items.map((item, idx) => (
              <div key={idx} className="mb-2 grid grid-cols-5 gap-2">
                <input placeholder="Description" value={item.desc}
                  onChange={e => setForm(f => { const items = [...f.items]; items[idx].desc = e.target.value; return {...f, items} })}
                  className="col-span-3 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                <input type="number" placeholder="Qty" value={item.qty}
                  onChange={e => setForm(f => { const items = [...f.items]; items[idx].qty = e.target.value; return {...f, items} })}
                  className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                <input type="number" placeholder="Price" value={item.price}
                  onChange={e => setForm(f => { const items = [...f.items]; items[idx].price = e.target.value; return {...f, items} })}
                  className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
            ))}
            <button onClick={addLine} className="text-xs text-primary font-semibold hover:underline">+ Add line</button>
          </div>
          <div className="rounded-xl bg-surface-2 p-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-secondary">Subtotal</span><span className="font-semibold">R{total.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-ink-secondary">VAT (15%)</span><span className="font-semibold">R{vat.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 mt-2"><span className="font-bold">Total</span><span className="font-bold text-primary">R{(total + vat).toFixed(2)}</span></div>
          </div>
          <Field label="Notes" textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">Save Invoice</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Appointments ──────────────────────────────────────────────────────────────
const B2B_APPT_STATUS = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No-show']

function Appointments() {
  const { user } = useAuth()
  const uid = user?.uid
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)
  const clients = useCollection(uid ? `users/${uid}/customers` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ clientId: '', date: new Date().toISOString().slice(0, 10), time: '', service: '', duration: '60', status: 'Scheduled', notes: '' })
  const [saving, setSaving] = useState(false)
  const [sendingId, setSendingId] = useState(null)

  async function save() {
    if (!uid || !form.clientId || !form.date || !form.time) { alert('Client, date and time are required.'); return }
    setSaving(true)
    try {
      const client = clients.find(c => c.id === form.clientId)
      await addDoc(collection(db, 'users', uid, 'appointments'), {
        ...form, customer: client?.name ?? '', customerPhone: client?.phone ?? '', createdAt: serverTimestamp(),
      })
      setForm({ clientId: '', date: new Date().toISOString().slice(0, 10), time: '', service: '', duration: '60', status: 'Scheduled', notes: '' })
      setOpen(false)
    } finally { setSaving(false) }
  }

  async function sendReminder(appt) {
    if (!appt.customerPhone) { alert('No phone number on file for this client.'); return }
    setSendingId(appt.id)
    try {
      const fn = httpsCallable(functions, 'sendSMS')
      const msg = `Reminder: ${appt.customer}, you have an appointment on ${appt.date} at ${appt.time}. Reply to reschedule.`
      await fn({ to: appt.customerPhone, message: msg })
      await updateDoc(doc(db, 'users', uid, 'appointments', appt.id), { reminderSent: true })
      await addDoc(collection(db, 'users', uid, 'messages'), { to: appt.customerPhone, type: 'sms', body: msg, module: 'appointment-reminder', status: 'sent', sentAt: serverTimestamp() })
    } catch { alert('Reminder failed — check BulkSMS credentials.') } finally { setSendingId(null) }
  }

  const badge = s => ({ Scheduled: 'bg-blue-50 text-blue-600', Confirmed: 'bg-primary-light text-primary', Completed: 'bg-green-50 text-green-600', Cancelled: 'bg-red-50 text-red-500', 'No-show': 'bg-orange-50 text-orange-500' }[s] || 'bg-surface-2 text-ink-secondary')

  const cols = [
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Time' },
    { key: 'customer', label: 'Client' },
    { key: 'service', label: 'Service / Purpose' },
    { key: 'status', label: 'Status', render: r => (
      <select value={r.status} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); updateDoc(doc(db, 'users', uid, 'appointments', r.id), { status: e.target.value }) }}
        className={`rounded-full border-0 px-2 py-1 text-[11px] font-semibold ${badge(r.status)}`}>
        {B2B_APPT_STATUS.map(s => <option key={s}>{s}</option>)}
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
      <PageHead title="Appointments" subtitle="Book and manage client meetings"
        action={<AddButton onClick={() => { setForm({ clientId: '', date: new Date().toISOString().slice(0, 10), time: '', service: '', duration: '60', status: 'Scheduled', notes: '' }); setOpen(true) }}>Book Appointment</AddButton>} />
      <DataTable columns={cols} data={appointments} emptyMessage="No appointments yet." />
      <Modal open={open} onClose={() => setOpen(false)} title="Book Appointment">
        <div className="space-y-4">
          <Field label="Client *" select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date *" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <Field label="Time *" type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
          </div>
          <Field label="Service / Purpose" value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} />
          <Field label="Duration" select value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}>
            {['30', '60', '90', '120'].map(d => <option key={d} value={d}>{d} min</option>)}
          </Field>
          <Field label="Status" select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {B2B_APPT_STATUS.map(s => <option key={s}>{s}</option>)}
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
      <PageHead title="Surveys" subtitle="Collect feedback from clients" action={<AddButton onClick={() => setOpen(true)}>New Survey</AddButton>} />
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

// ── Marketing Opt-In ──────────────────────────────────────────────────────────
function MarketingOptIn() {
  const { user } = useAuth()
  const uid = user?.uid
  const clients = useCollection(uid ? `users/${uid}/customers` : null)
  const [toggling, setToggling] = useState(null)
  async function toggle(client) {
    setToggling(client.id)
    await updateDoc(doc(db, 'users', uid, 'customers', client.id), { marketingOptOut: !client.marketingOptOut })
    setToggling(null)
  }
  const cols = [
    { key: 'name', label: 'Client' },
    { key: 'company', label: 'Company' },
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
      <PageHead title="Marketing Opt-In" subtitle="Manage client marketing consent" />
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-card border border-border bg-white p-4 shadow-card text-center">
          <p className="text-3xl font-extrabold text-green-600">{clients.filter(c => !c.marketingOptOut).length}</p>
          <p className="mt-1 text-xs font-semibold text-ink-secondary">Opted In</p>
        </div>
        <div className="rounded-card border border-border bg-white p-4 shadow-card text-center">
          <p className="text-3xl font-extrabold text-red-500">{clients.filter(c => c.marketingOptOut).length}</p>
          <p className="mt-1 text-xs font-semibold text-ink-secondary">Opted Out</p>
        </div>
      </div>
      <DataTable columns={cols} data={clients} emptyMessage="No clients yet." />
    </div>
  )
}

// ── Statements ────────────────────────────────────────────────────────────────
function Statements() {
  const { user } = useAuth()
  const uid = user?.uid
  const clients = useCollection(uid ? `users/${uid}/customers` : null)
  const invoices = useCollection(uid ? `users/${uid}/invoices` : null)
  const fmt = n => `R ${Number(n ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
  const statements = useMemo(() => clients.map(client => {
    const inv = invoices.filter(i => i.clientId === client.id || i.client === client.name)
    const totalInvoiced = inv.reduce((s, i) => s + Number(i.total ?? 0), 0)
    const totalPaid = inv.filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.total ?? 0), 0)
    return { ...client, totalInvoiced, totalPaid, outstanding: totalInvoiced - totalPaid, invoiceCount: inv.length }
  }).filter(c => c.invoiceCount > 0), [clients, invoices])
  const grandTotal = statements.reduce((s, c) => s + c.outstanding, 0)
  const cols = [
    { key: 'name', label: 'Client' },
    { key: 'company', label: 'Company' },
    { key: 'invoiceCount', label: 'Invoices' },
    { key: 'totalInvoiced', label: 'Total Invoiced', render: r => fmt(r.totalInvoiced) },
    { key: 'totalPaid', label: 'Paid', render: r => <span className="font-semibold text-green-700">{fmt(r.totalPaid)}</span> },
    { key: 'outstanding', label: 'Outstanding', render: r => <span className={r.outstanding > 0 ? 'font-semibold text-red-500' : 'text-ink-secondary'}>{fmt(r.outstanding)}</span> },
  ]
  return (
    <div className="space-y-4">
      <PageHead title="Statements" subtitle="Account balances by client" />
      {statements.length > 0 && (
        <div className="rounded-card border border-border bg-white p-4 shadow-card">
          <p className="text-xs font-semibold text-ink-secondary">Total Outstanding</p>
          <p className="mt-1 text-2xl font-extrabold text-red-500">{fmt(grandTotal)}</p>
        </div>
      )}
      <DataTable columns={cols} data={statements} emptyMessage="No invoiced clients yet. Create invoices to see statements here." />
    </div>
  )
}

// ── Quotations ────────────────────────────────────────────────────────────────
function Quotations() {
  const { user } = useAuth()
  const uid = user?.uid
  const quotations = useCollection(uid ? `users/${uid}/quotations` : null)
  const clients = useCollection(uid ? `users/${uid}/customers` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ clientId: '', validUntil: '', notes: '', items: [{ desc: '', qty: 1, price: 0 }] })
  const total = form.items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0)
  const vat = total * 0.15
  async function save() {
    if (!uid || !form.clientId) { alert('Please select a client.'); return }
    const client = clients.find(c => c.id === form.clientId)
    await addDoc(collection(db, 'users', uid, 'quotations'), { ...form, client: client?.name ?? '', total: total + vat, vat, status: 'Draft', createdAt: serverTimestamp() })
    setOpen(false); setForm({ clientId: '', validUntil: '', notes: '', items: [{ desc: '', qty: 1, price: 0 }] })
  }
  const statusColor = s => ({ Draft: 'bg-gray-100 text-gray-600', Sent: 'bg-blue-100 text-blue-700', Accepted: 'bg-green-100 text-green-700', Rejected: 'bg-red-100 text-red-600', Invoiced: 'bg-purple-100 text-purple-700' }[s] ?? '')
  const cols = [
    { key: 'client', label: 'Client' },
    { key: 'total', label: 'Amount', render: r => `R ${Number(r.total ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` },
    { key: 'validUntil', label: 'Valid Until' },
    { key: 'status', label: 'Status', render: r => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(r.status)}`}>{r.status}</span> },
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex gap-1 flex-wrap">
        {r.status === 'Draft' && <button onClick={e => { e.stopPropagation(); updateDoc(doc(db, 'users', uid, 'quotations', r.id), { status: 'Sent' }) }} className="rounded px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">Mark Sent</button>}
        {r.status === 'Sent' && <><button onClick={e => { e.stopPropagation(); updateDoc(doc(db, 'users', uid, 'quotations', r.id), { status: 'Accepted' }) }} className="rounded px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-50">Accept</button><button onClick={e => { e.stopPropagation(); updateDoc(doc(db, 'users', uid, 'quotations', r.id), { status: 'Rejected' }) }} className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Reject</button></>}
        {r.status === 'Accepted' && <button onClick={e => { e.stopPropagation(); updateDoc(doc(db, 'users', uid, 'quotations', r.id), { status: 'Invoiced' }) }} className="rounded px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-50">Convert to Invoice</button>}
        <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this quotation? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'quotations', r.id)) }} className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]
  return (
    <div className="space-y-4">
      <PageHead title="Quotations" subtitle="Create and track client quotes" action={<AddButton onClick={() => setOpen(true)}>New Quote</AddButton>} />
      <DataTable columns={cols} data={quotations} emptyMessage="No quotations yet." />
      <Modal open={open} onClose={() => setOpen(false)} title="New Quotation" size="lg">
        <div className="space-y-4">
          <Field label="Client *" select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Field>
          <Field label="Valid Until" type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-secondary">Line Items</p>
            {form.items.map((item, idx) => (
              <div key={idx} className="mb-2 grid grid-cols-5 gap-2">
                <input placeholder="Description" value={item.desc} onChange={e => setForm(f => { const items = [...f.items]; items[idx].desc = e.target.value; return { ...f, items } })} className="col-span-3 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                <input type="number" placeholder="Qty" value={item.qty} onChange={e => setForm(f => { const items = [...f.items]; items[idx].qty = e.target.value; return { ...f, items } })} className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                <input type="number" placeholder="Price" value={item.price} onChange={e => setForm(f => { const items = [...f.items]; items[idx].price = e.target.value; return { ...f, items } })} className="rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
            ))}
            <button onClick={() => setForm(f => ({ ...f, items: [...f.items, { desc: '', qty: 1, price: 0 }] }))} className="text-xs text-primary font-semibold hover:underline">+ Add line</button>
          </div>
          <div className="rounded-xl bg-surface-2 p-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-secondary">Subtotal</span><span className="font-semibold">R{total.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-ink-secondary">VAT (15%)</span><span className="font-semibold">R{vat.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 mt-2"><span className="font-bold">Total</span><span className="font-bold text-primary">R{(total + vat).toFixed(2)}</span></div>
          </div>
          <Field label="Notes" textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Save Quotation</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Projects ──────────────────────────────────────────────────────────────────
function Projects() {
  const { user } = useAuth()
  const uid = user?.uid
  const projects = useCollection(uid ? `users/${uid}/projects` : null)
  const clients = useCollection(uid ? `users/${uid}/customers` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ clientId: '', title: '', description: '', startDate: '', endDate: '', status: 'active', value: '' })
  async function save() {
    if (!uid || !form.title) { alert('Project title is required.'); return }
    const client = clients.find(c => c.id === form.clientId)
    await addDoc(collection(db, 'users', uid, 'projects'), { ...form, client: client?.name ?? '', createdAt: serverTimestamp() })
    setOpen(false); setForm({ clientId: '', title: '', description: '', startDate: '', endDate: '', status: 'active', value: '' })
  }
  const statusColor = s => ({ active: 'bg-green-100 text-green-700', 'on-hold': 'bg-amber-100 text-amber-700', completed: 'bg-blue-100 text-blue-700', cancelled: 'bg-red-100 text-red-600' }[s] ?? '')
  const cols = [
    { key: 'title', label: 'Project' },
    { key: 'client', label: 'Client' },
    { key: 'value', label: 'Value', render: r => r.value ? `R ${Number(r.value).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}` : '—' },
    { key: 'startDate', label: 'Start' },
    { key: 'endDate', label: 'End' },
    { key: 'status', label: 'Status', render: r => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusColor(r.status)}`}>{(r.status || '').replace('-', ' ')}</span> },
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex gap-1">
        <select value={r.status} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); updateDoc(doc(db, 'users', uid, 'projects', r.id), { status: e.target.value }) }} className="rounded-lg border border-border px-2 py-1 text-xs outline-none">
          {['active', 'on-hold', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
        </select>
        <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this project? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'projects', r.id)) }} className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]
  return (
    <div className="space-y-4">
      <PageHead title="Projects" subtitle="Track client projects & deliverables" action={<AddButton onClick={() => setOpen(true)}>New Project</AddButton>} />
      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'Active', val: projects.filter(p => p.status === 'active').length, color: 'text-green-600' }, { label: 'Completed', val: projects.filter(p => p.status === 'completed').length, color: 'text-blue-600' }, { label: 'Total', val: projects.length, color: 'text-ink' }].map(s => (
          <div key={s.label} className="rounded-card border border-border bg-white p-4 shadow-card text-center">
            <p className={`text-3xl font-extrabold ${s.color}`}>{s.val}</p>
            <p className="mt-1 text-xs font-semibold text-ink-secondary">{s.label}</p>
          </div>
        ))}
      </div>
      <DataTable columns={cols} data={projects} emptyMessage="No projects yet." />
      <Modal open={open} onClose={() => setOpen(false)} title="New Project" size="lg">
        <div className="space-y-4">
          <Field label="Project Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Field label="Client" select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Field>
          <Field label="Description" textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            <Field label="End Date" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
          <Field label="Project Value (R)" type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
          <Field label="Status" select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {['active', 'on-hold', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s.replace('-', ' ')}</option>)}
          </Field>
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Save Project</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Service List ──────────────────────────────────────────────────────────────
function ServiceList() {
  const { user } = useAuth()
  const uid = user?.uid
  const services = useCollection(uid ? `users/${uid}/services` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', price: '', unit: 'per hour', category: '' })
  async function save() {
    if (!uid || !form.name) { alert('Service name is required.'); return }
    await addDoc(collection(db, 'users', uid, 'services'), { ...form, createdAt: serverTimestamp() })
    setOpen(false); setForm({ name: '', description: '', price: '', unit: 'per hour', category: '' })
  }
  const fmt = n => `R ${Number(n ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
  const cols = [
    { key: 'name', label: 'Service' },
    { key: 'category', label: 'Category' },
    { key: 'description', label: 'Description' },
    { key: 'price', label: 'Price', render: r => r.price ? `${fmt(r.price)} ${r.unit || ''}` : '—' },
    { key: 'actions', label: '', sortable: false, render: r => (
      <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this service? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'services', r.id)) }} className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
    )},
  ]
  return (
    <div className="space-y-4">
      <PageHead title="Service List" subtitle="Services and pricing you offer to clients" action={<AddButton onClick={() => setOpen(true)}>Add Service</AddButton>} />
      <DataTable columns={cols} data={services} emptyMessage="No services listed yet." />
      <Modal open={open} onClose={() => setOpen(false)} title="New Service">
        <div className="space-y-4">
          <Field label="Service Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Field label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Consulting, Development, Support" />
          <Field label="Description" textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (R)" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            <Field label="Unit" select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
              {['per hour', 'per day', 'per item', 'per project', 'monthly', 'fixed'].map(u => <option key={u}>{u}</option>)}
            </Field>
          </div>
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Save Service</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Generic simple page ───────────────────────────────────────────────────────
function SimplePage({ title, children }) {
  return <div className="space-y-4"><h2 className="text-base font-bold text-ink">{title}</h2>{children}</div>
}

function Settings() {
  return <SettingsPage industry="b2b" />
}

export default function B2BDashboard() {
  return (
    <DashboardLayout industry="b2b" pageTitle="B2B">
      <Routes>
        <Route path="dashboard" element={<Overview />} />
        <Route path="clients" element={<Clients />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="statements" element={<Statements />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="projects" element={<Projects />} />
        <Route path="service-list" element={<ServiceList />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="messages" element={<Messages />} />
        <Route path="surveys" element={<Surveys />} />
        <Route path="marketing-optin" element={<MarketingOptIn />} />
        <Route path="campaigns" element={<CampaignsModule industry="b2b" />} />
        <Route path="profile" element={<ProfilePage industry="b2b" />} />

        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<SimplePage title="Coming Soon"><p className="text-sm text-ink-secondary">This section is being built. Check back soon.</p></SimplePage>} />
      </Routes>
    </DashboardLayout>
  )
}
