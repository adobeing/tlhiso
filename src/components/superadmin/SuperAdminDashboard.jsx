import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../services/firebase'
import { useCollection } from '../../hooks/useCollection'
import DashboardLayout from '../shared/DashboardLayout'
import DataTable from '../shared/DataTable'
import Modal from '../shared/Modal'
import StatCard from '../shared/StatCard'
import { CheckCircle, XCircle, Eye, Pencil, Trash2, Send } from 'lucide-react'

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview() {
  const users = useCollection('superadmin/data/users')

  const byIndustry = users.reduce((acc, u) => {
    acc[u.industry ?? 'unknown'] = (acc[u.industry ?? 'unknown'] ?? 0) + 1
    return acc
  }, {})
  const pending = users.filter(u => !u.isActive).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Users" value={users.length} icon="👥" />
        <StatCard label="Pending Activation" value={pending} icon="⏳" color="orange" />
        <StatCard label="B2B Users" value={byIndustry.b2b ?? 0} icon="🏢" color="blue" />
        <StatCard label="Medical Users" value={byIndustry.medical ?? 0} icon="🏥" color="purple" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Property Users" value={byIndustry.property ?? 0} icon="🏘️" />
        <StatCard label="Retail Users" value={byIndustry.retail ?? 0} icon="🛍️" color="orange" />
      </div>
    </div>
  )
}

// ── Users ─────────────────────────────────────────────────────────────────────
function AllUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewUser, setViewUser] = useState(null)
  const [filter, setFilter] = useState({ industry: '', status: '', search: '' })
  const [message, setMessage] = useState('')

  // Load directly from /users collection (super admin has read access via security rules)
  useState(() => {
    const load = async () => {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    load()
  })

  async function activate(uid) {
    await updateDoc(doc(db, 'users', uid), { isActive: true })
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, isActive: true } : u))
    // Trigger activation email via Cloud Function
    try {
      await httpsCallable(functions, 'sendActivationEmail')({ uid })
    } catch { /* non-fatal */ }
    setMessage(`User activated successfully.`)
    setTimeout(() => setMessage(''), 3000)
  }

  async function deactivate(uid) {
    await updateDoc(doc(db, 'users', uid), { isActive: false })
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, isActive: false } : u))
  }

  async function deleteUser(uid) {
    if (!window.confirm('Delete this user permanently? This cannot be undone.')) return
    await deleteDoc(doc(db, 'users', uid))
    setUsers(prev => prev.filter(u => u.id !== uid))
  }

  const filtered = users.filter(u => {
    if (filter.industry && u.industry !== filter.industry) return false
    if (filter.status === 'active' && !u.isActive) return false
    if (filter.status === 'pending' && u.isActive) return false
    if (filter.search) {
      const q = filter.search.toLowerCase()
      if (!u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const cols = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'industry', label: 'Industry', render: r => <span className="capitalize">{r.industry ?? '—'}</span> },
    { key: 'plan', label: 'Plan', render: r => <span className="capitalize">{r.plan ?? '—'}</span> },
    { key: 'isActive', label: 'Status', render: r => (
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
        {r.isActive ? 'Active' : 'Pending'}
      </span>
    )},
    { key: 'createdAt', label: 'Registered', render: r => r.createdAt?.toDate?.()?.toLocaleDateString('en-ZA') ?? '—' },
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex items-center gap-1">
        <button onClick={e => { e.stopPropagation(); setViewUser(r) }}
          className="rounded p-1.5 text-blue-500 hover:bg-blue-50" title="View"><Eye size={14} /></button>
        {!r.isActive
          ? <button onClick={e => { e.stopPropagation(); activate(r.id) }}
              className="rounded p-1.5 text-green-600 hover:bg-green-50" title="Activate"><CheckCircle size={14} /></button>
          : <button onClick={e => { e.stopPropagation(); deactivate(r.id) }}
              className="rounded p-1.5 text-amber-600 hover:bg-amber-50" title="Deactivate"><XCircle size={14} /></button>
        }
        <button onClick={e => { e.stopPropagation(); deleteUser(r.id) }}
          className="rounded p-1.5 text-red-400 hover:bg-red-50" title="Delete"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      {message && <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm font-semibold text-green-700">{message}</div>}
      <div className="flex flex-wrap gap-3">
        <input placeholder="Search name or email…" value={filter.search}
          onChange={e => setFilter(f => ({...f, search: e.target.value}))}
          className="rounded-xl border border-border px-4 py-2 text-sm outline-none focus:border-primary w-52" />
        <select value={filter.industry} onChange={e => setFilter(f=>({...f,industry:e.target.value}))}
          className="rounded-xl border border-border px-4 py-2 text-sm outline-none focus:border-primary">
          <option value="">All industries</option>
          {['b2b','medical','property','retail'].map(i=><option key={i} value={i} className="capitalize">{i}</option>)}
        </select>
        <select value={filter.status} onChange={e => setFilter(f=>({...f,status:e.target.value}))}
          className="rounded-xl border border-border px-4 py-2 text-sm outline-none focus:border-primary">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      {loading ? <p className="text-sm text-ink-secondary">Loading users…</p> :
        <DataTable columns={cols} data={filtered} emptyMessage="No users found." />
      }
      <Modal open={!!viewUser} onClose={() => setViewUser(null)} title="User Profile">
        {viewUser && (
          <div className="space-y-2 text-sm">
            {[
              ['Name', viewUser.name],
              ['Email', viewUser.email],
              ['Phone', viewUser.phone],
              ['Industry', viewUser.industry],
              ['Plan', viewUser.plan],
              ['Status', viewUser.isActive ? 'Active' : 'Pending Activation'],
              ['Profession', viewUser.profession],
              ['UID', viewUser.id],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-border py-2">
                <span className="font-semibold text-ink-secondary">{k}</span>
                <span className="text-ink capitalize">{v ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Send Message ──────────────────────────────────────────────────────────────
function AdminMessages() {
  const [form, setForm] = useState({ to: '', subject: '', body: '' })
  const [sent, setSent] = useState(false)

  async function send() {
    if (!form.to || !form.body) return
    try {
      await httpsCallable(functions, 'sendEmail')({ to: form.to, subject: form.subject, htmlBody: form.body })
      setSent(true); setTimeout(() => setSent(false), 3000)
      setForm({ to: '', subject: '', body: '' })
    } catch (e) { alert('Failed: ' + e.message) }
  }

  return (
    <div className="max-w-lg space-y-4">
      <h2 className="text-base font-bold text-ink">Send Message to User</h2>
      {sent && <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-semibold">Message sent ✓</div>}
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">Recipient email</span>
        <input value={form.to} onChange={e => setForm(f=>({...f,to:e.target.value}))}
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">Subject</span>
        <input value={form.subject} onChange={e => setForm(f=>({...f,subject:e.target.value}))}
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">Message</span>
        <textarea value={form.body} onChange={e => setForm(f=>({...f,body:e.target.value}))} rows={5}
          className="w-full resize-none rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary" />
      </label>
      <button onClick={send}
        className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
        <Send size={14} /> Send Email
      </button>
    </div>
  )
}

function AdminSettings() {
  return (
    <div className="rounded-card border border-border bg-white p-6 shadow-card max-w-lg">
      <h2 className="mb-4 text-base font-bold text-ink">Platform Settings</h2>
      <div className="space-y-3 text-sm text-ink-secondary">
        <p><strong className="text-ink">App name:</strong> Tlhiso</p>
        <p><strong className="text-ink">Contact:</strong> <a href="mailto:hello@tlhiso.com" className="text-primary">hello@tlhiso.com</a></p>
        <p><strong className="text-ink">Production URL:</strong> <a href="https://tlhiso.com" className="text-primary">https://tlhiso.com</a></p>
        <p><strong className="text-ink">GitHub:</strong> <a href="https://github.com/adobeing" className="text-primary">github.com/adobeing</a></p>
      </div>
    </div>
  )
}

export default function SuperAdminDashboard() {
  return (
    <DashboardLayout industry="superadmin" pageTitle="Super Admin">
      <Routes>
        <Route index element={<Overview />} />
        <Route path="users" element={<AllUsers />} />
        <Route path="messages" element={<AdminMessages />} />
        <Route path="settings" element={<AdminSettings />} />
      </Routes>
    </DashboardLayout>
  )
}
