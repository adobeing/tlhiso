import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import DashboardLayout from '../../shared/DashboardLayout'
import { useAuth } from '../../../contexts/AuthContext'
import { useCollection } from '../../../hooks/useCollection'
import StatCard from '../../shared/StatCard'
import DataTable from '../../shared/DataTable'
import Modal from '../../shared/Modal'
import ProfilePage from '../../shared/ProfilePage'
import PopiaModule from '../../shared/PopiaModule'
import { collection, addDoc, serverTimestamp, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../../../services/firebase'
import { PlusCircle, Trash2, Tag, Calendar, Eye, Pencil } from 'lucide-react'
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
        action={<a href="/retail/appointments" className="text-xs font-semibold text-primary hover:underline">View all →</a>}>
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

function SimplePage({ title }) {
  return <div><h2 className="text-base font-bold text-ink mb-3">{title}</h2><p className="text-sm text-ink-secondary">This section is being built.</p></div>
}

export default function RetailDashboard() {
  return (
    <DashboardLayout industry="retail" pageTitle="Consumer Business">
      <Routes>
        <Route path="dashboard" element={<Overview />} />
        <Route path="customers" element={<Customers />} />
        <Route path="weekly-deals" element={<WeeklyDeals />} />
        <Route path="campaigns" element={<CampaignsModule industry="retail" />} />
        <Route path="profile" element={<ProfilePage industry="retail" />} />
        <Route path="popia" element={<PopiaModule />} />
        <Route path="*" element={<SimplePage title="Coming Soon" />} />
      </Routes>
    </DashboardLayout>
  )
}
