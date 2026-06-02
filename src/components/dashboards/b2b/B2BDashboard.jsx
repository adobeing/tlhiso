import { useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import DashboardLayout from '../../shared/DashboardLayout'
import { useAuth } from '../../../contexts/AuthContext'
import { useCollection } from '../../../hooks/useCollection'
import StatCard from '../../shared/StatCard'
import DataTable from '../../shared/DataTable'
import Modal from '../../shared/Modal'
import ProfilePage from '../../shared/ProfilePage'
import PopiaModule from '../../shared/PopiaModule'
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../../services/firebase'
import { PlusCircle, Pencil, Trash2 } from 'lucide-react'

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
function Overview() {
  const { user } = useAuth()
  const uid = user?.uid
  const clients = useCollection(uid ? `users/${uid}/customers` : null)
  const invoices = useCollection(uid ? `users/${uid}/invoices` : null)
  const projects = useCollection(uid ? `users/${uid}/projects` : null)
  const messages = useCollection(uid ? `users/${uid}/messages` : null)

  const outstanding = invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue').length
  const active = projects.filter(p => p.status === 'active').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Clients" value={clients.length} icon="👥" />
        <StatCard label="Outstanding Invoices" value={outstanding} icon="🧾" color="orange" />
        <StatCard label="Active Projects" value={active} icon="📁" color="blue" />
        <StatCard label="Messages Sent" value={messages.length} icon="✉️" color="purple" />
      </div>
      <div className="rounded-card border border-border bg-white p-5 shadow-card">
        <h3 className="mb-4 text-sm font-bold text-ink">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { label: '+ New Invoice', href: '/b2b/invoices' },
            { label: '+ New Client', href: '/b2b/clients' },
            { label: 'Send Message', href: '/b2b/messages' },
          ].map(a => (
            <a key={a.label} href={a.href}
              className="rounded-xl border border-primary/30 bg-primary-light px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white transition">
              {a.label}
            </a>
          ))}
        </div>
      </div>
      <DataTable
        columns={[
          { key: 'name', label: 'Client' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
        ]}
        data={clients.slice(0, 5)}
        emptyMessage="No clients yet. Add your first client."
      />
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

  async function save() {
    if (!uid || !form.name) return
    await addDoc(collection(db, 'users', uid, 'customers'), {
      ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: serverTimestamp(),
    })
    setOpen(false); setForm({ name: '', company: '', email: '', phone: '', tags: '' })
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
      <button onClick={e => { e.stopPropagation(); deleteDoc(doc(db, 'users', uid, 'customers', r.id)) }}
        className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Clients</h2>
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> Add Client
        </button>
      </div>
      <DataTable columns={cols} data={clients} emptyMessage="No clients yet." />
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
        <button onClick={e => { e.stopPropagation(); deleteDoc(doc(db, 'users', uid, 'invoices', r.id)) }}
          className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Invoices</h2>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> New Invoice
        </button>
      </div>
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

// ── Generic simple page stubs ─────────────────────────────────────────────────
function SimplePage({ title, children }) {
  return <div className="space-y-4"><h2 className="text-base font-bold text-ink">{title}</h2>{children}</div>
}

function Settings() {
  const { user } = useAuth()
  return (
    <SimplePage title="Settings">
      <div className="rounded-card border border-border bg-white p-6 shadow-card space-y-3">
        <p className="text-sm text-ink-secondary">Email: <strong className="text-ink">{user?.email}</strong></p>
        <p className="text-sm text-ink-secondary">To change your password, use the{' '}
          <a href="/forgot-password" className="text-primary font-semibold hover:underline">password reset</a> flow.
        </p>
      </div>
    </SimplePage>
  )
}

// ── Campaigns stub ────────────────────────────────────────────────────────────
function Campaigns() {
  const { user } = useAuth()
  const uid = user?.uid
  const campaigns = useCollection(uid ? `users/${uid}/campaigns` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ subject: '', body: '', type: 'email' })

  async function save() {
    if (!uid) return
    await addDoc(collection(db, 'users', uid, 'campaigns'), { ...form, status: 'Draft', createdAt: serverTimestamp() })
    setOpen(false); setForm({ subject: '', body: '', type: 'email' })
  }

  const cols = [
    { key: 'subject', label: 'Subject' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status', render: r => <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{r.status}</span> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-ink">Campaigns</h2>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> New Campaign
        </button>
      </div>
      <DataTable columns={cols} data={campaigns} emptyMessage="No campaigns yet." />
      <Modal open={open} onClose={() => setOpen(false)} title="New Campaign">
        <div className="space-y-4">
          <Field label="Type" select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </Field>
          <Field label="Subject" value={form.subject} onChange={e => setForm(f => ({...f, subject: e.target.value}))} />
          <Field label="Body" textarea value={form.body} onChange={e => setForm(f => ({...f, body: e.target.value}))} />
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Save Campaign</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Router wrapper ────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  dashboard: 'B2B Dashboard', clients: 'Clients', invoices: 'Invoices',
  statements: 'Statements', quotations: 'Quotations', projects: 'Projects',
  'service-list': 'Service List', appointments: 'Appointments', messages: 'Messages',
  campaigns: 'Campaigns', surveys: 'Surveys', 'marketing-optin': 'Marketing Opt-In',
  profile: 'Profile', popia: 'POPIA Compliance', settings: 'Settings',
}

function resolveTitle(pathname) {
  const seg = pathname.split('/').pop()
  return PAGE_TITLES[seg] ?? 'B2B'
}

export default function B2BDashboard() {
  return (
    <DashboardLayout industry="b2b" pageTitle="B2B">
      <Routes>
        <Route path="dashboard" element={<Overview />} />
        <Route path="clients" element={<Clients />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="profile" element={<ProfilePage industry="b2b" />} />
        <Route path="popia" element={<PopiaModule />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<SimplePage title="Coming Soon"><p className="text-sm text-ink-secondary">This section is being built. Check back soon.</p></SimplePage>} />
      </Routes>
    </DashboardLayout>
  )
}
