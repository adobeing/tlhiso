import { useState, useMemo } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import DashboardLayout from '../../shared/DashboardLayout'
import { useAuth } from '../../../contexts/AuthContext'
import { useCollection } from '../../../hooks/useCollection'
import StatCard from '../../shared/StatCard'
import DataTable from '../../shared/DataTable'
import Modal from '../../shared/Modal'
import ProfilePage from '../../shared/ProfilePage'
import { collection, addDoc, serverTimestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { db, functions } from '../../../services/firebase'
import { httpsCallable } from 'firebase/functions'
import { PlusCircle, Trash2, Tag, Calendar, Eye, Pencil, Bell, Loader2, X } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import CampaignsModule from '../../shared/CampaignsModule'
import AutomationsModule from '../../shared/AutomationsModule'
import PopiaModule from '../../shared/PopiaModule'
import SurveysModule from '../../shared/SurveysModule'
import SetupChecklist from '../../shared/SetupChecklist'
import CampaignPromoCard from '../../shared/CampaignPromoCard'
import AppointmentCalendar from '../../shared/AppointmentCalendar'
import SettingsPage from '../../shared/SettingsPage'
import { fmtDate } from '../../../utils/dates'

// ── Shared layout helpers ───────────────────────────────────────────────────
function PageHead({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>}
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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <div className="flex items-center gap-2">
          {Icon && <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon size={14} /></span>}
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
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
      {Icon && <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-600"><Icon size={20} /></span>}
      <p className="text-sm text-slate-600">{message}</p>
    </div>
  )
}

function Field({ label, error, textarea, select, children, ...props }) {
  const cls = 'w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
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
  const customers   = useCollection(uid ? `users/${uid}/customers`    : null)
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)
  const campaigns   = useCollection(uid ? `users/${uid}/campaigns`    : null)
  const deals       = useCollection(uid ? `users/${uid}/deals`        : null)

  const today = new Date().toISOString().slice(0, 10)
  const todayAppts = useMemo(() => appointments.filter(a => a.date === today), [appointments, today])
  const activeDeals = useMemo(() => deals.filter(d => d.active), [deals])

  const thisMonth = new Date().toISOString().slice(0, 7)
  const newCustomersThisMonth = useMemo(() =>
    customers.filter(c => c.createdAt?.toDate?.()?.toISOString?.()?.slice(0, 7) === thisMonth).length,
    [customers, thisMonth]
  )

  const apptChartData = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      days.push({ day: d.toLocaleDateString('en-ZA', { weekday: 'short' }), count: appointments.filter(a => a.date === dateStr).length })
    }
    return days
  }, [appointments])

  const recentCustomers = useMemo(() =>
    [...customers].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)).slice(0, 5),
    [customers]
  )

  return (
    <div className="space-y-6">
      <SetupChecklist industry="retail" />
      <PageHead
        title={`Welcome back${profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}`}
        subtitle="Your customers and campaigns at a glance."
      />

      <CampaignPromoCard campaignsPath="/retail/campaigns" />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Customers" value={customers.length} icon="👥"
          trend={newCustomersThisMonth ? `+${newCustomersThisMonth} this month` : undefined} trendTone="up" />
        <StatCard label="Appointments Today" value={todayAppts.length} icon="📅" color="blue" />
        <StatCard label="Campaigns Sent" value={campaigns.length} icon="📣" color="purple" />
        <StatCard label="Active Deals" value={activeDeals.length} icon="🏷️" color="orange"
          trend={deals.length ? `${deals.length} total` : 'None yet'} trendTone="flat" />
      </div>

      {/* Chart + Today */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="mb-4 text-sm font-bold text-slate-800">Appointments — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={apptChartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="count" name="Appointments" fill="#5B8E7D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Today's Appointments</h3>
            <Link to="/retail/appointments" className="text-xs font-semibold text-primary hover:underline">View all →</Link>
          </div>
          {todayAppts.length === 0
            ? <p className="py-6 text-center text-xs text-slate-400">No appointments today.</p>
            : <div className="space-y-2">
                {todayAppts.map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {(a.customer || '?').slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{a.customer}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">{a.time} · {a.service}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* Recent customers */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">Recent Customers</h3>
          <Link to="/retail/customers" className="text-xs font-semibold text-primary hover:underline">View all →</Link>
        </div>
        {recentCustomers.length === 0
          ? <p className="py-4 text-center text-xs text-slate-400">No customers yet.</p>
          : <div className="divide-y divide-slate-100">
              {recentCustomers.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {(c.name || '?').slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{c.name}</p>
                      <p className="text-[11px] text-slate-500">{c.phone || c.email || '—'}</p>
                    </div>
                  </div>
                  {c.tags?.length > 0 && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">{c.tags[0]}</span>
                  )}
                </div>
              ))}
            </div>
        }
      </div>
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
    { key: 'birthday', label: 'Birthday', render: r => fmtDate(r.birthday) },
    { key: 'tags', label: 'Tags', render: r => (r.tags ?? []).map(t => (
      <span key={t} className="mr-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{t}</span>
    ))},
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex items-center gap-1">
        <button onClick={e => { e.stopPropagation(); setViewing(r) }}
          title="View" className="rounded p-1 text-slate-600 hover:bg-slate-50"><Eye size={14} /></button>
        <button onClick={e => { e.stopPropagation(); setEditing(r); setEditForm({ name: r.name||'', phone: r.phone||'', email: r.email||'', birthday: r.birthday||'', notes: r.notes||'', tags: (r.tags||[]).join(', ') }) }}
          title="Edit" className="rounded p-1 text-primary hover:bg-primary/10"><Pencil size={14} /></button>
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
              <div key={label} className="flex flex-col gap-0.5 rounded-xl bg-slate-50 px-4 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{label}</span>
                <span className="text-sm text-slate-800">{value}</span>
              </div>
            ) : null)}
            {viewing.tags?.length > 0 && (
              <div className="rounded-xl bg-slate-50 px-4 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Tags</span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {viewing.tags.map(t => <span key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{t}</span>)}
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
              <div key={d.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                <div className="flex items-start justify-between gap-2 border-b border-slate-200 bg-gradient-to-r from-primary-light to-surface-2 px-5 py-4">
                  <h3 className="font-bold leading-tight text-slate-800">{d.title}</h3>
                  <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-white">{d.discount}% off</span>
                </div>
                <div className="p-5">
                  <p className="text-sm text-slate-600">{d.description}</p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
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
  const { user, profile } = useAuth()
  const uid = user?.uid
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)
  const customers = useCollection(uid ? `users/${uid}/customers` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ customerId: '', date: new Date().toISOString().slice(0, 10), time: '', service: '', duration: '60', status: 'Scheduled', notes: '' })
  const [saving, setSaving] = useState(false)
  const [sendingId,      setSendingId]      = useState(null)
  const [rescheduleBusy, setRescheduleBusy] = useState(null)

  async function acceptReschedule(appt) {
    if (!uid) return
    setRescheduleBusy(appt.id)
    try {
      await updateDoc(doc(db, 'users', uid, 'appointments', appt.id), {
        date: appt.rescheduleDate, time: appt.rescheduleTime,
        status: 'Confirmed', confirmationStatus: 'confirmed',
        rescheduleDate: null, rescheduleTime: null, rescheduleNote: null,
      })
      if (appt.customerPhone) {
        try {
          const fn  = httpsCallable(functions, 'sendSMS')
          const msg = `Hi ${appt.customer}, your reschedule request has been accepted. Your new appointment is confirmed for ${fmtDate(appt.rescheduleDate)} at ${appt.rescheduleTime}.`
          await fn({ to: appt.customerPhone, message: msg })
          await addDoc(collection(db, 'users', uid, 'messages'), {
            to: appt.customerPhone, type: 'sms', body: msg,
            module: 'reschedule-accepted', status: 'sent', sentAt: serverTimestamp(),
          })
        } catch { /* non-blocking */ }
      } else if (appt.customerEmail) {
        try {
          const fn      = httpsCallable(functions, 'sendEmail')
          const subject = 'Appointment Reschedule Confirmed'
          const htmlBody = `<p>Hi ${appt.customer}, your reschedule request has been accepted. Your new appointment is confirmed for ${fmtDate(appt.rescheduleDate)} at ${appt.rescheduleTime}.</p>`
          await fn({ to: appt.customerEmail, subject, htmlBody })
          await addDoc(collection(db, 'users', uid, 'messages'), {
            to: appt.customerEmail, type: 'email', body: subject,
            module: 'reschedule-accepted', status: 'sent', sentAt: serverTimestamp(),
          })
        } catch { /* non-blocking */ }
      }
    } finally { setRescheduleBusy(null) }
  }

  async function declineReschedule(appt) {
    if (!uid) return
    setRescheduleBusy(appt.id)
    try {
      await updateDoc(doc(db, 'users', uid, 'appointments', appt.id), {
        confirmationStatus: null, rescheduleDate: null, rescheduleTime: null, rescheduleNote: null,
      })
      if (appt.customerPhone) {
        try {
          const fn  = httpsCallable(functions, 'sendSMS')
          const msg = `Hi ${appt.customer}, your reschedule request could not be accommodated. Your original appointment remains on ${fmtDate(appt.date)} at ${appt.time}.`
          await fn({ to: appt.customerPhone, message: msg })
          await addDoc(collection(db, 'users', uid, 'messages'), {
            to: appt.customerPhone, type: 'sms', body: msg,
            module: 'reschedule-declined', status: 'sent', sentAt: serverTimestamp(),
          })
        } catch { /* non-blocking */ }
      } else if (appt.customerEmail) {
        try {
          const fn      = httpsCallable(functions, 'sendEmail')
          const subject = 'Appointment Reschedule Request Update'
          const htmlBody = `<p>Hi ${appt.customer}, your reschedule request could not be accommodated. Your original appointment remains on ${fmtDate(appt.date)} at ${appt.time}.</p>`
          await fn({ to: appt.customerEmail, subject, htmlBody })
          await addDoc(collection(db, 'users', uid, 'messages'), {
            to: appt.customerEmail, type: 'email', body: subject,
            module: 'reschedule-declined', status: 'sent', sentAt: serverTimestamp(),
          })
        } catch { /* non-blocking */ }
      }
    } finally { setRescheduleBusy(null) }
  }

  async function setApptStatus(appt, status) {
    await updateDoc(doc(db, 'users', uid, 'appointments', appt.id), { status })
    if (status === 'Completed' && profile?.googleReviewLink) {
      const phone = appt.customerPhone
      const email = appt.customerEmail
      if (phone || email) {
        const alreadySent = appt.reviewSent ||
          appointments.some(a => a.reviewSent && a.id !== appt.id && (phone ? a.customerPhone === phone : a.customerEmail === email))
        if (alreadySent) return
        const firstName = (appt.customer || 'there').split(' ')[0]
        const link = profile.googleReviewLinkShort || profile.googleReviewLink
        try {
          if (phone) {
            await httpsCallable(functions, 'sendSMS')({ to: phone, message: `Hi ${firstName}, thank you! We'd love your feedback. Please leave us a Google review: ${link}` })
          } else {
            await httpsCallable(functions, 'sendEmail')({
              to: email,
              subject: 'Thank you — please leave us a review',
              htmlBody: `<p>Hi ${firstName}, thank you for your visit! We would love your feedback.</p><p><a href="${link}">Leave a Google Review</a></p>`,
            })
          }
          await Promise.all([
            addDoc(collection(db, 'users', uid, 'messages'), {
              to: phone || email, type: phone ? 'sms' : 'email',
              body: `Review request sent to ${firstName}`,
              module: 'review-request', status: 'sent', sentAt: serverTimestamp(),
            }),
            updateDoc(doc(db, 'users', uid, 'appointments', appt.id), { reviewSent: true }),
          ])
        } catch { /* non-blocking */ }
      }
    }
  }

  async function save() {
    if (!uid || !form.date || !form.time) { alert('Date and time are required.'); return }
    setSaving(true)
    try {
      const customer = customers.find(c => c.id === form.customerId)
      await addDoc(collection(db, 'users', uid, 'appointments'), {
        ...form, customer: customer?.name ?? '', customerPhone: customer?.phone ?? '', customerEmail: customer?.email ?? '', ownerPhone: profile?.phone ?? '', ownerEmail: user?.email ?? '', createdAt: serverTimestamp(),
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
      const link = `https://tlhiso.com/appt/${uid}/${appt.id}`
      const msg = `Reminder: ${appt.customer}, you have an appointment on ${fmtDate(appt.date)} at ${appt.time}${appt.service ? ` for ${appt.service}` : ''}. Confirm, cancel or reschedule: ${link}`
      await fn({ to: appt.customerPhone, message: msg })
      await updateDoc(doc(db, 'users', uid, 'appointments', appt.id), { reminderSent: true })
      await addDoc(collection(db, 'users', uid, 'messages'), { to: appt.customerPhone, type: 'sms', body: msg, module: 'appointment-reminder', status: 'sent', sentAt: serverTimestamp() })
    } catch { alert('Reminder failed — check BulkSMS credentials.') } finally { setSendingId(null) }
  }

  const badge = s => ({ Scheduled: 'bg-blue-50 text-blue-600', Confirmed: 'bg-primary/10 text-primary', Completed: 'bg-green-50 text-green-600', Cancelled: 'bg-red-50 text-red-500', 'No-show': 'bg-orange-50 text-orange-500' }[s] || 'bg-slate-50 text-slate-600')

  const cols = [
    { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
    { key: 'time', label: 'Time' },
    { key: 'customer', label: 'Customer' },
    { key: 'service', label: 'Service' },
    { key: 'status', label: 'Status', render: r => (
      <div className="space-y-1">
        <select value={r.status} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); setApptStatus(r, e.target.value) }}
          className={`rounded-full border-0 px-2 py-1 text-[11px] font-semibold ${badge(r.status)}`}>
          {RETAIL_APPT_STATUS.map(s => <option key={s}>{s}</option>)}
        </select>
        {r.confirmationStatus && (
          r.confirmationStatus === 'reschedule-requested' ? (
            <div className="mt-1 space-y-1" onClick={e => e.stopPropagation()}>
              <span className="block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">⟳ Reschedule requested</span>
              {r.rescheduleDate && <p className="text-[10px] text-slate-600">{fmtDate(r.rescheduleDate)} {r.rescheduleTime || ''}</p>}
              {r.rescheduleNote && <p className="text-[10px] italic text-slate-600">{r.rescheduleNote}</p>}
              <div className="flex gap-1">
                <button onClick={() => acceptReschedule(r)} disabled={rescheduleBusy === r.id}
                  className="rounded px-2 py-0.5 text-[10px] font-semibold bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50 transition">Accept</button>
                <button onClick={() => declineReschedule(r)} disabled={rescheduleBusy === r.id}
                  className="rounded px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition">Decline</button>
              </div>
            </div>
          ) : (
            <span className={`block w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.confirmationStatus === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {r.confirmationStatus === 'confirmed' ? '✓ Customer confirmed' : '✗ Customer cancelled'}
            </span>
          )
        )}
      </div>
    )},
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => sendReminder(r)} disabled={sendingId === r.id} title="Send SMS reminder" className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-50">
          {sendingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
        </button>
        <button onClick={() => { if (!window.confirm('Delete this appointment? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'appointments', r.id)) }}
          className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <AppointmentCalendar
        appointments={appointments}
        onSlotClick={(ds, h) => { setForm(f => ({ ...f, date: ds, time: `${String(h).padStart(2, '0')}:00` })); setOpen(true) }}
        onApptClick={() => {}}
        listColumns={cols}
        title="Appointments"
        subtitle="Bookings and scheduling"
        headerAction={<AddButton onClick={() => { setForm({ customerId: '', date: new Date().toISOString().slice(0, 10), time: '', service: '', duration: '60', status: 'Scheduled', notes: '' }); setOpen(true) }}>Book Appointment</AddButton>}
        emptyMessage="No appointments yet."
      />
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <p className="text-3xl font-extrabold text-green-600">{customers.filter(c => !c.marketingOptOut).length}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">Opted In</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-center">
          <p className="text-3xl font-extrabold text-red-500">{customers.filter(c => c.marketingOptOut).length}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">Opted Out</p>
        </div>
      </div>
      <DataTable columns={cols} data={customers} emptyMessage="No customers yet." />
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────
function Settings() {
  return <SettingsPage industry="retail" />
}

export default function RetailDashboard() {
  return (
    <DashboardLayout industry="retail" pageTitle="Consumer Business">
      <Routes>
        <Route path="dashboard" element={<Overview />} />
        <Route path="customers" element={<Customers />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="weekly-deals" element={<WeeklyDeals />} />
        <Route path="surveys" element={<SurveysModule industry="retail" />} />
        <Route path="optin" element={<OptIn />} />
        <Route path="campaigns"    element={<CampaignsModule industry="retail" />} />
        <Route path="automations" element={<AutomationsModule industry="retail" />} />
        <Route path="profile" element={<ProfilePage industry="retail" />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<div><h2 className="text-base font-bold text-slate-800 mb-3">Coming Soon</h2><p className="text-sm text-slate-600">This section is being built.</p></div>} />
      </Routes>
    </DashboardLayout>
  )
}
