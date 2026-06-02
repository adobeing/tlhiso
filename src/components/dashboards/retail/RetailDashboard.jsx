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
import { PlusCircle, Trash2 } from 'lucide-react'

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
  const { user } = useAuth()
  const uid = user?.uid
  const customers = useCollection(uid ? `users/${uid}/customers` : null)
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)
  const campaigns = useCollection(uid ? `users/${uid}/campaigns` : null)
  const deals = useCollection(uid ? `users/${uid}/deals` : null)
  const today = new Date().toISOString().slice(0, 10)
  const todayAppts = appointments.filter(a => a.date === today)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Customers" value={customers.length} icon="👥" />
        <StatCard label="Appointments Today" value={todayAppts.length} icon="📅" color="blue" />
        <StatCard label="Campaigns Sent" value={campaigns.length} icon="📣" color="purple" />
        <StatCard label="Active Deals" value={deals.filter(d=>d.active).length} icon="🏷️" color="orange" />
      </div>
      <div className="rounded-card border border-border bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Upcoming Appointments</h3>
          <a href="/retail/appointments" className="text-xs text-primary font-semibold hover:underline">View all →</a>
        </div>
        {todayAppts.length === 0
          ? <p className="text-sm text-ink-secondary">No appointments today.</p>
          : todayAppts.map(a => (
            <div key={a.id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
              <span className="text-sm font-medium text-ink">{a.customer}</span>
              <span className="text-xs text-ink-secondary">{a.time} · {a.service}</span>
            </div>
          ))
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

  async function save() {
    if (!uid || !form.name) return
    await addDoc(collection(db, 'users', uid, 'customers'), {
      ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: serverTimestamp(),
    })
    setOpen(false)
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
      <button onClick={e => { e.stopPropagation(); deleteDoc(doc(db, 'users', uid, 'customers', r.id)) }}
        className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Customers</h2>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
          <PlusCircle size={15} /> Add Customer
        </button>
      </div>
      <DataTable columns={cols} data={customers} emptyMessage="No customers yet." />
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
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Weekly Deals</h2>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
          <PlusCircle size={15} /> Create Deal
        </button>
      </div>
      {deals.length === 0
        ? <p className="text-sm text-ink-secondary">No active deals. Create your first deal!</p>
        : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map(d => (
              <div key={d.id} className="rounded-card border border-border bg-white p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-ink">{d.title}</h3>
                  <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-bold text-primary">{d.discount}% off</span>
                </div>
                <p className="mt-1 text-sm text-ink-secondary">{d.description}</p>
                <p className="mt-2 text-xs text-ink-secondary">{d.validFrom} → {d.validTo}</p>
                <button onClick={() => deleteDoc(doc(db, 'users', uid, 'deals', d.id))}
                  className="mt-3 text-xs text-red-400 font-semibold hover:underline">Delete</button>
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
        <Route path="profile" element={<ProfilePage industry="retail" />} />
        <Route path="popia" element={<PopiaModule />} />
        <Route path="*" element={<SimplePage title="Coming Soon" />} />
      </Routes>
    </DashboardLayout>
  )
}
