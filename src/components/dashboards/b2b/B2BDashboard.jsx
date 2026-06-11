import { useState, useMemo } from 'react'
import { Routes, Route, NavLink, Link } from 'react-router-dom'
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
import { PlusCircle, Pencil, Trash2, Eye, Bell, Loader2, X, FileText, Users, Receipt, ClipboardList, TrendingUp, ChevronLeft, ChevronRight, Mail, Phone, Globe, MapPin, Building2, Send, CheckCircle, Flag, Clock, LayoutGrid, List as ListIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import CampaignsModule from '../../shared/CampaignsModule'
import AutomationsModule from '../../shared/AutomationsModule'
import PopiaModule from '../../shared/PopiaModule'
import SetupChecklist from '../../shared/SetupChecklist'
import CampaignSnapshot from '../../shared/CampaignSnapshot'
import AppointmentCalendar from '../../shared/AppointmentCalendar'
import SurveysModule from '../../shared/SurveysModule'
import SettingsPage from '../../shared/SettingsPage'
import { fmtDate } from '../../../utils/dates'

// ── Shared form field ─────────────────────────────────────────────────────────
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

function SectionCard({ title, action, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// Titled section card for form modals (mirrors medical ReferralFormSection)
function FormSection({ title, icon: Icon, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-200/70 bg-slate-50 px-4 py-2.5">
        {Icon && <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon size={13} /></span>}
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-800">{title}</h4>
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </div>
  )
}

function Overview() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const clients      = useCollection(uid ? `users/${uid}/customers`    : null)
  const invoices     = useCollection(uid ? `users/${uid}/invoices`     : null)
  const projects     = useCollection(uid ? `users/${uid}/projects`     : null)
  const quotations   = useCollection(uid ? `users/${uid}/quotations`   : null)
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)

  const today = new Date().toISOString().slice(0, 10)

  const outstanding      = useMemo(() => invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue'), [invoices])
  const outstandingAmt   = useMemo(() => outstanding.reduce((s, i) => s + Number(i.total ?? 0), 0), [outstanding])
  const revenueCollected = useMemo(() => invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.total ?? 0), 0), [invoices])
  const activeProjects   = useMemo(() => projects.filter(p => p.status === 'active').length, [projects])
  const pipelineValue    = useMemo(() => quotations.filter(q => q.status === 'Draft' || q.status === 'Sent').reduce((s, q) => s + Number(q.total ?? 0), 0), [quotations])

  const fmtR = n => `R ${Number(n ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const apptChartData = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      days.push({ day: d.toLocaleDateString('en-ZA', { weekday: 'short' }), count: appointments.filter(a => a.date === dateStr).length })
    }
    return days
  }, [appointments])

  const upcomingAppts = useMemo(() => {
    const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7)
    return appointments
      .filter(a => a.date >= today && a.date <= nextWeek.toISOString().slice(0, 10))
      .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
      .slice(0, 5)
  }, [appointments, today])

  const recentInvoices = useMemo(() =>
    [...invoices].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)).slice(0, 5),
    [invoices]
  )

  return (
    <div className="space-y-6">
      <SetupChecklist industry="b2b" />
      <PageHead
        title={`Welcome back${profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}`}
        subtitle="Your business at a glance."
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Clients" value={clients.length} icon="👥" />
        <StatCard label="Outstanding" value={fmtR(outstandingAmt)} icon="🧾" color="orange"
          trend={outstanding.length ? `${outstanding.length} invoice${outstanding.length !== 1 ? 's' : ''}` : 'All settled'}
          trendTone={outstanding.length ? 'down' : 'up'} />
        <StatCard label="Revenue Collected" value={fmtR(revenueCollected)} icon="💰" color="green" />
        <StatCard label="Active Projects" value={activeProjects} icon="📁" color="blue" />
        <StatCard label="Pipeline Value" value={fmtR(pipelineValue)} icon="📊" color="purple"
          trend={`${quotations.filter(q => q.status === 'Draft' || q.status === 'Sent').length} open quote${quotations.filter(q => q.status === 'Draft' || q.status === 'Sent').length !== 1 ? 's' : ''}`}
          trendTone="up" />
      </div>

      {/* Campaign snapshot */}
      <CampaignSnapshot industry="b2b" />

      {/* Chart + Upcoming */}
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
            <h3 className="text-sm font-bold text-slate-800">Upcoming Appointments</h3>
            <Link to="/b2b/appointments" className="text-xs font-semibold text-primary hover:underline">View all →</Link>
          </div>
          {upcomingAppts.length === 0
            ? <p className="py-6 text-center text-xs text-slate-400">No upcoming appointments this week.</p>
            : <div className="space-y-2">
                {upcomingAppts.map(a => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{a.clientName || a.client || '—'}</p>
                      <p className="text-[11px] text-slate-500">{a.service || '—'}</p>
                    </div>
                    <span className="text-[11px] font-medium text-slate-600">{a.date}{a.time ? ` · ${a.time}` : ''}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>

      {/* Recent invoices */}
      <SectionCard title="Recent Invoices"
        action={<Link to="/b2b/invoices" className="text-xs font-semibold text-primary hover:underline">View all →</Link>}>
        <DataTable
          columns={[
            { key: 'client', label: 'Client' },
            { key: 'total', label: 'Amount', render: r => fmtR(r.total) },
            { key: 'status', label: 'Status', render: r => (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                r.status === 'Paid' ? 'bg-green-100 text-green-700' :
                r.status === 'Overdue' ? 'bg-red-100 text-red-600' :
                'bg-amber-100 text-amber-700'
              }`}>{r.status || 'Draft'}</span>
            )},
          ]}
          data={recentInvoices}
          emptyMessage="No invoices yet."
        />
      </SectionCard>
    </div>
  )
}

// ── Clients ───────────────────────────────────────────────────────────────────
function Clients() {
  const { user } = useAuth()
  const uid      = user?.uid
  const clients   = useCollection(uid ? `users/${uid}/customers`  : null)
  const invoices  = useCollection(uid ? `users/${uid}/invoices`   : null)
  const projects  = useCollection(uid ? `users/${uid}/projects`   : null)
  const quotes    = useCollection(uid ? `users/${uid}/quotations` : null)

  const BLANK = {
    name: '', company: '', status: 'Active',
    email: '', billingEmail: '', phone: '', phone2: '',
    address: '', city: '', province: '', postalCode: '',
    website: '', linkedin: '', sector: '', vatNumber: '',
    paymentTerms: 'Net 30', creditLimit: '', source: '',
    tags: '', notes: '',
  }
  const [open,           setOpen]           = useState(false)
  const [form,           setForm]           = useState(BLANK)
  const [editing,        setEditing]        = useState(null)
  const [editForm,       setEditForm]       = useState(BLANK)
  const [selectedClient, setSelectedClient] = useState(null)
  const [tab,            setTab]            = useState('invoices')

  async function save() {
    if (!uid || !form.name) return
    await addDoc(collection(db, 'users', uid, 'customers'), {
      ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), createdAt: serverTimestamp(),
    })
    setOpen(false); setForm(BLANK)
  }

  async function saveEdit() {
    if (!uid || !editForm.name || !editing) return
    await updateDoc(doc(db, 'users', uid, 'customers', editing.id), {
      ...editForm, tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
    })
    setEditing(null)
  }

  function openEdit(c) {
    setEditing(c)
    setEditForm({
      name: c.name||'', company: c.company||'', status: c.status||'Active',
      email: c.email||'', billingEmail: c.billingEmail||'', phone: c.phone||'', phone2: c.phone2||'',
      address: c.address||'', city: c.city||'', province: c.province||'', postalCode: c.postalCode||'',
      website: c.website||'', linkedin: c.linkedin||'', sector: c.sector||'', vatNumber: c.vatNumber||'',
      paymentTerms: c.paymentTerms||'Net 30', creditLimit: c.creditLimit||'', source: c.source||'',
      tags: (c.tags||[]).join(', '), notes: c.notes||'',
    })
  }

  // ── Client detail view ────────────────────────────────────────────────────
  if (selectedClient) {
    const client    = clients.find(c => c.id === selectedClient.id) ?? selectedClient
    const cInvoices = invoices.filter(i => i.clientId === client.id || i.client === client.name)
    const cProjects = projects.filter(p => p.clientId === client.id || p.client === client.name)
    const cQuotes   = quotes.filter(q => q.clientId === client.id || q.client === client.name)
    const totalInvoiced = cInvoices.reduce((s, i) => s + Number(i.total ?? 0), 0)
    const totalPaid     = cInvoices.filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.total ?? 0), 0)
    const outstanding   = totalInvoiced - totalPaid
    const fmt = n => `R ${Number(n ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
    const sBadge = s => ({ Draft: 'bg-gray-100 text-gray-600', Sent: 'bg-blue-100 text-blue-700', Paid: 'bg-green-100 text-green-700', Overdue: 'bg-red-100 text-red-700' }[s] ?? 'bg-gray-100 text-gray-600')
    const statusColor = { Active: 'bg-green-100 text-green-700', Prospect: 'bg-blue-100 text-blue-700', Lead: 'bg-purple-100 text-purple-700', Inactive: 'bg-gray-100 text-gray-500', Archived: 'bg-red-100 text-red-600' }
    const fullAddress = [client.address, client.city, client.province, client.postalCode].filter(Boolean).join(', ')

    return (
      <div className="space-y-5">
        <button onClick={() => setSelectedClient(null)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition">
          <ChevronLeft size={16} /> Back to Clients
        </button>

        {/* Header card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-xl font-extrabold text-primary">
                {(client.name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-800">{client.name}</h2>
                  {client.status && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusColor[client.status] ?? 'bg-gray-100 text-gray-500'}`}>{client.status}</span>}
                </div>
                {client.company && <p className="text-sm text-slate-500">{client.company}</p>}
                {client.sector  && <p className="text-xs text-slate-400">{client.sector}</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openEdit(client)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                <Pencil size={13} /> Edit
              </button>
              {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Mail size={13} /> Email</a>}
              {client.phone && <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Phone size={13} /> Call</a>}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
            {client.email        && <div className="flex items-center gap-2 text-slate-600"><Mail     size={13} className="shrink-0 text-slate-400" />{client.email}</div>}
            {client.phone        && <div className="flex items-center gap-2 text-slate-600"><Phone    size={13} className="shrink-0 text-slate-400" />{client.phone}</div>}
            {client.billingEmail && <div className="flex items-center gap-2 text-slate-600"><Mail     size={13} className="shrink-0 text-slate-400" /><span className="text-slate-400 mr-1">Billing:</span>{client.billingEmail}</div>}
            {client.phone2       && <div className="flex items-center gap-2 text-slate-600"><Phone    size={13} className="shrink-0 text-slate-400" /><span className="text-slate-400 mr-1">Alt:</span>{client.phone2}</div>}
            {fullAddress         && <div className="flex items-center gap-2 text-slate-600"><MapPin   size={13} className="shrink-0 text-slate-400" />{fullAddress}</div>}
            {client.website      && <div className="flex items-center gap-2 text-slate-600"><Globe    size={13} className="shrink-0 text-slate-400" /><a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{client.website}</a></div>}
            {client.linkedin     && <div className="flex items-center gap-2 text-slate-600"><Globe    size={13} className="shrink-0 text-slate-400" /><a href={client.linkedin.startsWith('http') ? client.linkedin : `https://${client.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LinkedIn</a></div>}
            {client.vatNumber    && <div className="flex items-center gap-2 text-slate-600"><Building2 size={13} className="shrink-0 text-slate-400" />VAT: {client.vatNumber}</div>}
          </div>

          {(client.paymentTerms || client.creditLimit || client.source) && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {client.paymentTerms && (
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment Terms</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-700">{client.paymentTerms}</p>
                </div>
              )}
              {client.creditLimit && (
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Credit Limit</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-700">{fmt(client.creditLimit)}</p>
                </div>
              )}
              {client.source && (
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lead Source</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-700">{client.source}</p>
                </div>
              )}
            </div>
          )}

          {client.notes && (
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Notes</p>
              <p className="mt-1 text-sm text-slate-700">{client.notes}</p>
            </div>
          )}

          {client.tags?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {client.tags.map(t => <span key={t} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{t}</span>)}
            </div>
          )}
        </div>

        {/* Financial summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Invoiced', val: fmt(totalInvoiced), cls: 'text-slate-800' },
            { label: 'Paid',           val: fmt(totalPaid),     cls: 'text-green-600' },
            { label: 'Outstanding',    val: fmt(outstanding),   cls: outstanding > 0 ? 'text-red-500' : 'text-slate-800' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card text-center">
              <p className={`text-xl font-extrabold ${s.cls}`}>{s.val}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
          {[
            ['invoices', `Invoices (${cInvoices.length})`],
            ['projects', `Projects (${cProjects.length})`],
            ['quotes',   `Quotations (${cQuotes.length})`],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${tab === key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'invoices' && (
          <DataTable
            columns={[
              { key: 'invoiceNumber', label: '#', render: r => r.invoiceNumber || '—' },
              { key: 'total',   label: 'Amount',   render: r => fmt(r.total) },
              { key: 'dueDate', label: 'Due Date',  render: r => fmtDate(r.dueDate) },
              { key: 'status',  label: 'Status',    render: r => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sBadge(r.status)}`}>{r.status}</span> },
            ]}
            data={cInvoices}
            emptyMessage="No invoices for this client yet."
          />
        )}
        {tab === 'projects' && (
          <DataTable
            columns={[
              { key: 'title',  label: 'Project' },
              { key: 'value',  label: 'Value',  render: r => r.value ? fmt(r.value) : '—' },
              { key: 'status', label: 'Status', render: r => <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold capitalize text-green-700">{(r.status||'').replace('-',' ')}</span> },
            ]}
            data={cProjects}
            emptyMessage="No projects for this client yet."
          />
        )}
        {tab === 'quotes' && (
          <DataTable
            columns={[
              { key: 'total',      label: 'Amount',     render: r => fmt(r.total) },
              { key: 'validUntil', label: 'Valid Until' },
              { key: 'status',     label: 'Status',     render: r => <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{r.status}</span> },
            ]}
            data={cQuotes}
            emptyMessage="No quotations for this client yet."
          />
        )}

        <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Client" size="lg">
          <div className="space-y-4">
            <FormSection title="Identity" icon={Users}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Full name *" value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
                <Field label="Company" value={editForm.company} onChange={e => setEditForm(f => ({...f, company: e.target.value}))} />
              </div>
              <Field label="Status" select value={editForm.status} onChange={e => setEditForm(f => ({...f, status: e.target.value}))}>
                {['Active','Prospect','Lead','Inactive','Archived'].map(s => <option key={s}>{s}</option>)}
              </Field>
            </FormSection>

            <FormSection title="Contact Details" icon={Phone}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Email" type="email" value={editForm.email} onChange={e => setEditForm(f => ({...f, email: e.target.value}))} />
                <Field label="Billing Email" type="email" value={editForm.billingEmail} onChange={e => setEditForm(f => ({...f, billingEmail: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone (+27…)" value={editForm.phone} onChange={e => setEditForm(f => ({...f, phone: e.target.value}))} />
                <Field label="Alt Phone / Direct" value={editForm.phone2} onChange={e => setEditForm(f => ({...f, phone2: e.target.value}))} />
              </div>
            </FormSection>

            <FormSection title="Company Details" icon={Building2}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Industry / Sector" value={editForm.sector} onChange={e => setEditForm(f => ({...f, sector: e.target.value}))} />
                <Field label="VAT Number" value={editForm.vatNumber} onChange={e => setEditForm(f => ({...f, vatNumber: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Payment Terms" select value={editForm.paymentTerms} onChange={e => setEditForm(f => ({...f, paymentTerms: e.target.value}))}>
                  {['Immediate','Net 7','Net 14','Net 30','Net 60','Net 90','COD'].map(t => <option key={t}>{t}</option>)}
                </Field>
                <Field label="Credit Limit (R)" type="number" value={editForm.creditLimit} onChange={e => setEditForm(f => ({...f, creditLimit: e.target.value}))} />
              </div>
              <Field label="Lead Source" select value={editForm.source} onChange={e => setEditForm(f => ({...f, source: e.target.value}))}>
                <option value="">Select source…</option>
                {['Referral','Website','Cold Call','Exhibition / Event','Social Media','Email Campaign','Other'].map(s => <option key={s}>{s}</option>)}
              </Field>
            </FormSection>

            <FormSection title="Address" icon={MapPin}>
              <Field label="Street Address" value={editForm.address} onChange={e => setEditForm(f => ({...f, address: e.target.value}))} />
              <div className="grid grid-cols-3 gap-3">
                <Field label="City" value={editForm.city} onChange={e => setEditForm(f => ({...f, city: e.target.value}))} />
                <Field label="Province" select value={editForm.province} onChange={e => setEditForm(f => ({...f, province: e.target.value}))}>
                  <option value="">Province…</option>
                  {['Gauteng','Western Cape','KwaZulu-Natal','Eastern Cape','Limpopo','Mpumalanga','North West','Free State','Northern Cape'].map(p => <option key={p}>{p}</option>)}
                </Field>
                <Field label="Postal Code" value={editForm.postalCode} onChange={e => setEditForm(f => ({...f, postalCode: e.target.value}))} />
              </div>
            </FormSection>

            <FormSection title="Online Presence" icon={Globe}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Website" value={editForm.website} onChange={e => setEditForm(f => ({...f, website: e.target.value}))} placeholder="https://…" />
                <Field label="LinkedIn" value={editForm.linkedin} onChange={e => setEditForm(f => ({...f, linkedin: e.target.value}))} placeholder="linkedin.com/in/…" />
              </div>
            </FormSection>

            <FormSection title="Additional" icon={FileText}>
              <Field label="Tags (comma-separated)" value={editForm.tags} onChange={e => setEditForm(f => ({...f, tags: e.target.value}))} />
              <Field label="Notes" textarea value={editForm.notes} onChange={e => setEditForm(f => ({...f, notes: e.target.value}))} />
            </FormSection>

            <button onClick={saveEdit} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">Save Changes</button>
          </div>
        </Modal>
      </div>
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────
  const clientStatusColor = { Active: 'bg-green-100 text-green-700', Prospect: 'bg-blue-100 text-blue-700', Lead: 'bg-purple-100 text-purple-700', Inactive: 'bg-gray-100 text-gray-500', Archived: 'bg-red-100 text-red-600' }

  const cols = [
    { key: 'name',    label: 'Name' },
    { key: 'company', label: 'Company' },
    { key: 'status',  label: 'Status', render: r => r.status ? <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${clientStatusColor[r.status] ?? 'bg-gray-100 text-gray-500'}`}>{r.status}</span> : null },
    { key: 'email',   label: 'Email' },
    { key: 'phone',   label: 'Phone' },
    { key: 'sector',  label: 'Sector' },
    { key: 'tags',    label: 'Tags', render: r => (r.tags ?? []).map(t => (
      <span key={t} className="mr-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{t}</span>
    ))},
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex items-center gap-1">
        <button onClick={e => { e.stopPropagation(); setSelectedClient(r) }}
          title="View" className="rounded p-1 text-slate-600 hover:bg-slate-50"><Eye size={14} /></button>
        <button onClick={e => { e.stopPropagation(); openEdit(r) }}
          title="Edit" className="rounded p-1 text-primary hover:bg-primary/10"><Pencil size={14} /></button>
        <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this client? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'customers', r.id)) }}
          title="Delete" className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <PageHead title="Clients" subtitle="Your client accounts & contacts"
        action={<AddButton onClick={() => setOpen(true)}>Add Client</AddButton>} />
      <DataTable columns={cols} data={clients} onRowClick={setSelectedClient} emptyMessage="No clients yet." />

      <Modal open={open} onClose={() => setOpen(false)} title="New Client" size="lg">
        <div className="space-y-4">
          <FormSection title="Identity" icon={Users}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full name *" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
              <Field label="Company" value={form.company} onChange={e => setForm(f => ({...f, company: e.target.value}))} />
            </div>
            <Field label="Status" select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
              {['Active','Prospect','Lead','Inactive','Archived'].map(s => <option key={s}>{s}</option>)}
            </Field>
          </FormSection>

          <FormSection title="Contact Details" icon={Phone}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
              <Field label="Billing Email" type="email" value={form.billingEmail} onChange={e => setForm(f => ({...f, billingEmail: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone (+27…)" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
              <Field label="Alt Phone / Direct" value={form.phone2} onChange={e => setForm(f => ({...f, phone2: e.target.value}))} />
            </div>
          </FormSection>

          <FormSection title="Company Details" icon={Building2}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Industry / Sector" value={form.sector} onChange={e => setForm(f => ({...f, sector: e.target.value}))} />
              <Field label="VAT Number" value={form.vatNumber} onChange={e => setForm(f => ({...f, vatNumber: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Payment Terms" select value={form.paymentTerms} onChange={e => setForm(f => ({...f, paymentTerms: e.target.value}))}>
                {['Immediate','Net 7','Net 14','Net 30','Net 60','Net 90','COD'].map(t => <option key={t}>{t}</option>)}
              </Field>
              <Field label="Credit Limit (R)" type="number" value={form.creditLimit} onChange={e => setForm(f => ({...f, creditLimit: e.target.value}))} />
            </div>
            <Field label="Lead Source" select value={form.source} onChange={e => setForm(f => ({...f, source: e.target.value}))}>
              <option value="">Select source…</option>
              {['Referral','Website','Cold Call','Exhibition / Event','Social Media','Email Campaign','Other'].map(s => <option key={s}>{s}</option>)}
            </Field>
          </FormSection>

          <FormSection title="Address" icon={MapPin}>
            <Field label="Street Address" value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="City" value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))} />
              <Field label="Province" select value={form.province} onChange={e => setForm(f => ({...f, province: e.target.value}))}>
                <option value="">Province…</option>
                {['Gauteng','Western Cape','KwaZulu-Natal','Eastern Cape','Limpopo','Mpumalanga','North West','Free State','Northern Cape'].map(p => <option key={p}>{p}</option>)}
              </Field>
              <Field label="Postal Code" value={form.postalCode} onChange={e => setForm(f => ({...f, postalCode: e.target.value}))} />
            </div>
          </FormSection>

          <FormSection title="Online Presence" icon={Globe}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Website" value={form.website} onChange={e => setForm(f => ({...f, website: e.target.value}))} placeholder="https://…" />
              <Field label="LinkedIn" value={form.linkedin} onChange={e => setForm(f => ({...f, linkedin: e.target.value}))} placeholder="linkedin.com/in/…" />
            </div>
          </FormSection>

          <FormSection title="Additional" icon={FileText}>
            <Field label="Tags (comma-separated)" value={form.tags} onChange={e => setForm(f => ({...f, tags: e.target.value}))} />
            <Field label="Notes" textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
          </FormSection>

          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">Save Client</button>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Client">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full name *" value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
            <Field label="Company" value={editForm.company} onChange={e => setEditForm(f => ({...f, company: e.target.value}))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email" type="email" value={editForm.email} onChange={e => setEditForm(f => ({...f, email: e.target.value}))} />
            <Field label="Phone (+27…)" value={editForm.phone} onChange={e => setEditForm(f => ({...f, phone: e.target.value}))} />
          </div>
          <Field label="Address" value={editForm.address} onChange={e => setEditForm(f => ({...f, address: e.target.value}))} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="Website" value={editForm.website} onChange={e => setEditForm(f => ({...f, website: e.target.value}))} />
            <Field label="Industry / Sector" value={editForm.sector} onChange={e => setEditForm(f => ({...f, sector: e.target.value}))} />
          </div>
          <Field label="Tags (comma-separated)" value={editForm.tags} onChange={e => setEditForm(f => ({...f, tags: e.target.value}))} />
          <Field label="Notes" textarea value={editForm.notes} onChange={e => setEditForm(f => ({...f, notes: e.target.value}))} />
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
  const clients  = useCollection(uid ? `users/${uid}/customers` : null)
  const [open,       setOpen]       = useState(false)
  const [viewing,    setViewing]    = useState(null)
  const [emailingId, setEmailingId] = useState(null)
  const [form, setForm] = useState({ clientId: '', dueDate: '', notes: '', items: [{ desc: '', qty: 1, price: 0 }] })

  const total = form.items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0)
  const vat   = total * 0.15
  const fmt   = n => `R ${Number(n ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`

  const today = new Date().toISOString().slice(0, 10)
  const effectiveStatus = r => {
    if (r.status === 'Paid') return 'Paid'
    if (r.dueDate && r.dueDate < today && r.status !== 'Draft') return 'Overdue'
    return r.status || 'Draft'
  }
  const statusColor = s => ({
    Draft: 'bg-gray-100 text-gray-600', Sent: 'bg-blue-100 text-blue-700',
    Paid: 'bg-green-100 text-green-700', Overdue: 'bg-red-100 text-red-700',
  }[s] ?? 'bg-gray-100 text-gray-600')

  function addLine() { setForm(f => ({...f, items: [...f.items, { desc: '', qty: 1, price: 0 }]})) }

  async function save() {
    if (!uid) return
    const client = clients.find(c => c.id === form.clientId)
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`
    await addDoc(collection(db, 'users', uid, 'invoices'), {
      ...form, invoiceNumber, client: client?.name ?? '', clientId: form.clientId,
      total: total + vat, vat, status: 'Draft', createdAt: serverTimestamp(),
    })
    setOpen(false)
    setForm({ clientId: '', dueDate: '', notes: '', items: [{ desc: '', qty: 1, price: 0 }] })
  }

  async function emailInvoice(inv) {
    const client = clients.find(c => c.id === inv.clientId)
    const to = client?.email || inv.clientEmail
    if (!to) { alert('No email address on file for this client. Update the client record first.'); return }
    setEmailingId(inv.id)
    const fmtE = n => `R ${Number(n ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
    const rows = (inv.items || []).map(item =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${item.desc || ''}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${item.qty}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right">${fmtE(item.price)}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">${fmtE(Number(item.qty)*Number(item.price))}</td></tr>`
    ).join('')
    const bizName = profile?.businessName || profile?.name || 'Tlhiso'
    const htmlBody = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #5B8E7D">
        <div><h2 style="color:#5B8E7D;margin:0">INVOICE</h2>${inv.invoiceNumber ? `<p style="margin:4px 0 0;font-size:13px;color:#64748b">${inv.invoiceNumber}</p>` : ''}</div>
        <div style="text-align:right"><p style="font-weight:700;font-size:16px;margin:0">${bizName}</p>${profile?.vatNumber ? `<p style="font-size:12px;color:#64748b;margin:4px 0 0">VAT: ${profile.vatNumber}</p>` : ''}</div>
      </div>
      <div style="margin:20px 0"><p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin:0 0 4px">Bill To</p><p style="font-weight:600;margin:0">${inv.client || to}</p></div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f8fafc"><th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600">Description</th><th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:600">Qty</th><th style="padding:8px 12px;text-align:right;color:#64748b;font-weight:600">Unit Price</th><th style="padding:8px 12px;text-align:right;color:#64748b;font-weight:600">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:16px;text-align:right;font-size:13px">
        <div style="display:flex;justify-content:flex-end;gap:40px;margin-bottom:4px"><span style="color:#64748b">Subtotal</span><span>${fmtE(Number(inv.total||0)-Number(inv.vat||0))}</span></div>
        <div style="display:flex;justify-content:flex-end;gap:40px;margin-bottom:8px"><span style="color:#64748b">VAT (15%)</span><span>${fmtE(inv.vat||0)}</span></div>
        <div style="display:flex;justify-content:flex-end;gap:40px;border-top:2px solid #5B8E7D;padding-top:8px"><span style="font-weight:700">Total</span><span style="font-weight:700;color:#5B8E7D">${fmtE(inv.total||0)}</span></div>
      </div>
      ${inv.dueDate ? `<p style="margin-top:16px;font-size:13px;color:#64748b">Due: <strong>${inv.dueDate}</strong></p>` : ''}
      ${inv.notes ? `<p style="font-size:13px;color:#64748b;margin-top:8px">${inv.notes}</p>` : ''}
      <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0"/>
      <p style="font-size:12px;color:#94a3b8">Sent via Tlhiso · <a href="https://tlhiso.com" style="color:#5B8E7D">tlhiso.com</a></p>
    </div>`
    try {
      const res = await httpsCallable(functions, 'sendEmail')({
        to,
        subject: `Invoice${inv.invoiceNumber ? ` ${inv.invoiceNumber}` : ''} from ${bizName}`,
        htmlBody,
      })
      if (!res.data?.success) throw new Error(res.data?.error || 'Email send failed')
      await Promise.all([
        updateDoc(doc(db, 'users', uid, 'invoices', inv.id), { status: 'Sent' }),
        addDoc(collection(db, 'users', uid, 'messages'), { to, type: 'email', body: `Invoice sent to ${to}`, module: 'invoice', status: 'sent', sentAt: serverTimestamp() }),
      ])
      setViewing(v => v?.id === inv.id ? { ...v, status: 'Sent' } : v)
      alert(`Invoice sent to ${to}`)
    } catch(e) { alert('Failed to send invoice: ' + e.message) }
    finally { setEmailingId(null) }
  }

  const cols = [
    { key: 'invoiceNumber', label: '#', render: r => <span className="font-mono text-xs text-slate-600">{r.invoiceNumber || '—'}</span> },
    { key: 'client',  label: 'Client' },
    { key: 'total',   label: 'Amount',   render: r => fmt(r.total) },
    { key: 'dueDate', label: 'Due Date', render: r => fmtDate(r.dueDate) },
    { key: 'status',  label: 'Status',   render: r => {
      const s = effectiveStatus(r)
      return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(s)}`}>{s}</span>
    }},
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex gap-1 items-center" onClick={e => e.stopPropagation()}>
        <button onClick={() => setViewing(r)} title="View invoice"
          className="rounded p-1 text-slate-600 hover:bg-slate-50"><Eye size={14} /></button>
        <button onClick={() => emailInvoice(r)} disabled={emailingId === r.id || r.status === 'Paid'} title="Email to client"
          className="rounded p-1 text-blue-500 hover:bg-blue-50 disabled:opacity-40">
          {emailingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
        <button onClick={() => updateDoc(doc(db, 'users', uid, 'invoices', r.id), { status: 'Paid' })}
          className="rounded px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-50">Mark Paid</button>
        <button onClick={() => { if (!window.confirm('Delete this invoice? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'invoices', r.id)) }}
          className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  return (
    <div className="space-y-4">
      <PageHead title="Invoices" subtitle="Create, send and track invoices"
        action={<AddButton onClick={() => setOpen(true)}>New Invoice</AddButton>} />
      <DataTable columns={cols} data={invoices} />

      {/* ── Invoice view modal ── */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Invoice" size="lg">
        {viewing && (
          <div className="space-y-5 text-sm">
            {/* Send to client button */}
            {viewing.status !== 'Paid' && (
              <button onClick={() => emailInvoice(viewing)} disabled={emailingId === viewing.id}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d] disabled:opacity-60">
                {emailingId === viewing.id
                  ? <><Loader2 size={15} className="animate-spin" /> Sending…</>
                  : <><Send size={15} /> Send Invoice to Client</>}
              </button>
            )}
            {viewing.status === 'Paid' && (
              <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700">
                <CheckCircle size={15} /> Paid
              </div>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                {profile?.businessLogoUrl && (
                  <img src={profile.businessLogoUrl} alt="Logo" className="h-14 w-14 rounded-lg border border-slate-200 object-contain p-1" />
                )}
                <div>
                  <p className="font-bold text-slate-800">{profile?.businessName || profile?.name || '—'}</p>
                  {profile?.address   && <p className="text-xs text-slate-600">{profile.address}</p>}
                  {profile?.vatNumber && <p className="text-xs text-slate-600">VAT: {profile.vatNumber}</p>}
                  {profile?.phone     && <p className="text-xs text-slate-600">{profile.phone}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold tracking-wide text-primary">INVOICE</p>
                {viewing.invoiceNumber && <p className="text-xs text-slate-500">{viewing.invoiceNumber}</p>}
                <p className="mt-1 text-xs text-slate-600">Due: <strong>{viewing.dueDate || '—'}</strong></p>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(effectiveStatus(viewing))}`}>
                  {effectiveStatus(viewing)}
                </span>
              </div>
            </div>

            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">Bill To</p>
              <p className="font-semibold text-slate-800">{viewing.client || '—'}</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Description</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600">Unit price</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-600">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewing.items || []).map((item, i) => (
                    <tr key={i} className="border-t border-slate-200">
                      <td className="px-3 py-2">{item.desc || '—'}</td>
                      <td className="px-3 py-2 text-right">{item.qty}</td>
                      <td className="px-3 py-2 text-right">{fmt(item.price)}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmt(Number(item.qty)*Number(item.price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{fmt(Number(viewing.total||0)-Number(viewing.vat||0))}</span></div>
              <div className="flex justify-between text-slate-600"><span>VAT (15%)</span><span>{fmt(viewing.vat||0)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-primary"><span>Total</span><span>{fmt(viewing.total||0)}</span></div>
            </div>

            {viewing.notes && (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">Notes</p>
                <p className="text-slate-600">{viewing.notes}</p>
              </div>
            )}

            {profile?.bankingDetails && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600">Banking Details</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-slate-600">Bank</span><span className="font-medium">{profile.bankingDetails.bankName}</span>
                  <span className="text-slate-600">Account holder</span><span className="font-medium">{profile.bankingDetails.accountHolder}</span>
                  <span className="text-slate-600">Account number</span><span className="font-medium">{profile.bankingDetails.accountNumber}</span>
                  <span className="text-slate-600">Branch code</span><span className="font-medium">{profile.bankingDetails.branchCode}</span>
                  <span className="text-slate-600">Account type</span><span className="font-medium">{profile.bankingDetails.accountType}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="New Invoice" size="lg">
        <div className="space-y-4">
          <FormSection title="Invoice Details" icon={Receipt}>
            <Field label="Client *" select value={form.clientId} onChange={e => setForm(f => ({...f, clientId: e.target.value}))}>
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Field>
            <Field label="Due Date" type="date" value={form.dueDate} onChange={e => setForm(f => ({...f, dueDate: e.target.value}))} />
          </FormSection>

          <FormSection title="Line Items" icon={ClipboardList}>
            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-5 gap-2">
                <input placeholder="Description" value={item.desc}
                  onChange={e => setForm(f => { const items = [...f.items]; items[idx].desc = e.target.value; return {...f, items} })}
                  className="col-span-3 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
                <input type="number" placeholder="Qty" value={item.qty}
                  onChange={e => setForm(f => { const items = [...f.items]; items[idx].qty = e.target.value; return {...f, items} })}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
                <input type="number" placeholder="Price" value={item.price}
                  onChange={e => setForm(f => { const items = [...f.items]; items[idx].price = e.target.value; return {...f, items} })}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
            ))}
            <button onClick={addLine} className="text-xs font-semibold text-primary hover:underline">+ Add line</button>
          </FormSection>

          <FormSection title="Summary & Notes" icon={FileText}>
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span className="font-semibold">R{total.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-600">VAT (15%)</span><span className="font-semibold">R{vat.toFixed(2)}</span></div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2"><span className="font-bold">Total</span><span className="font-bold text-primary">R{(total + vat).toFixed(2)}</span></div>
            </div>
            <Field label="Notes" textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
          </FormSection>

          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">Save Invoice</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Appointments ──────────────────────────────────────────────────────────────
const B2B_APPT_STATUS = ['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'No-show']

function Appointments() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)
  const clients = useCollection(uid ? `users/${uid}/customers` : null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ clientId: '', date: new Date().toISOString().slice(0, 10), time: '', service: '', duration: '60', status: 'Scheduled', notes: '' })
  const [saving, setSaving] = useState(false)
  const [sendingId,     setSendingId]     = useState(null)
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
    if (!uid || !form.clientId || !form.date || !form.time) { alert('Client, date and time are required.'); return }
    setSaving(true)
    try {
      const client = clients.find(c => c.id === form.clientId)
      await addDoc(collection(db, 'users', uid, 'appointments'), {
        ...form, customer: client?.name ?? '', customerPhone: client?.phone ?? '', customerEmail: client?.email ?? '', ownerPhone: profile?.phone ?? '', ownerEmail: user?.email ?? '', createdAt: serverTimestamp(),
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
      const link = `https://tlhiso.com/appt/${uid}/${appt.id}`
      const msg = `Reminder: ${appt.customer}, you have an appointment on ${fmtDate(appt.date)} at ${appt.time}. Confirm, cancel or reschedule: ${link}`
      await fn({ to: appt.customerPhone, message: msg })
      await updateDoc(doc(db, 'users', uid, 'appointments', appt.id), { reminderSent: true })
      await addDoc(collection(db, 'users', uid, 'messages'), { to: appt.customerPhone, type: 'sms', body: msg, module: 'appointment-reminder', status: 'sent', sentAt: serverTimestamp() })
    } catch { alert('Reminder failed — check BulkSMS credentials.') } finally { setSendingId(null) }
  }

  const badge = s => ({ Scheduled: 'bg-blue-50 text-blue-600', Confirmed: 'bg-primary/10 text-primary', Completed: 'bg-green-50 text-green-600', Cancelled: 'bg-red-50 text-red-500', 'No-show': 'bg-orange-50 text-orange-500' }[s] || 'bg-slate-50 text-slate-600')

  const cols = [
    { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
    { key: 'time', label: 'Time' },
    { key: 'customer', label: 'Client' },
    { key: 'service', label: 'Service / Purpose' },
    { key: 'status', label: 'Status', render: r => (
      <div className="space-y-1">
        <select value={r.status} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); setApptStatus(r, e.target.value) }}
          className={`rounded-full border-0 px-2 py-1 text-[11px] font-semibold ${badge(r.status)}`}>
          {B2B_APPT_STATUS.map(s => <option key={s}>{s}</option>)}
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
              {r.confirmationStatus === 'confirmed' ? '✓ Client confirmed' : '✗ Client cancelled'}
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
        subtitle="Book and manage client meetings"
        headerAction={<AddButton onClick={() => { setForm({ clientId: '', date: new Date().toISOString().slice(0, 10), time: '', service: '', duration: '60', status: 'Scheduled', notes: '' }); setOpen(true) }}>Book Appointment</AddButton>}
        emptyMessage="No appointments yet."
      />
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
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card text-center">
          <p className="text-3xl font-extrabold text-green-600">{clients.filter(c => !c.marketingOptOut).length}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">Opted In</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card text-center">
          <p className="text-3xl font-extrabold text-red-500">{clients.filter(c => c.marketingOptOut).length}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">Opted Out</p>
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
    { key: 'outstanding', label: 'Outstanding', render: r => <span className={r.outstanding > 0 ? 'font-semibold text-red-500' : 'text-slate-600'}>{fmt(r.outstanding)}</span> },
  ]
  return (
    <div className="space-y-4">
      <PageHead title="Statements" subtitle="Account balances by client" />
      {statements.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <p className="text-xs font-semibold text-slate-600">Total Outstanding</p>
          <p className="mt-1 text-2xl font-extrabold text-red-500">{fmt(grandTotal)}</p>
        </div>
      )}
      <DataTable columns={cols} data={statements} emptyMessage="No invoiced clients yet. Create invoices to see statements here." />
    </div>
  )
}

// ── Quotations ────────────────────────────────────────────────────────────────
function Quotations() {
  const { user, profile } = useAuth()
  const uid = user?.uid
  const quotations = useCollection(uid ? `users/${uid}/quotations` : null)
  const clients    = useCollection(uid ? `users/${uid}/customers`  : null)
  const invoices   = useCollection(uid ? `users/${uid}/invoices`   : null)
  const [open,           setOpen]           = useState(false)
  const [emailingQuoteId, setEmailingQuoteId] = useState(null)
  const [form, setForm] = useState({ clientId: '', validUntil: '', notes: '', items: [{ desc: '', qty: 1, price: 0 }] })
  const total = form.items.reduce((s, i) => s + Number(i.qty) * Number(i.price), 0)
  const vat   = total * 0.15
  const fmt   = n => `R ${Number(n ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`

  async function save() {
    if (!uid || !form.clientId) { alert('Please select a client.'); return }
    const client = clients.find(c => c.id === form.clientId)
    await addDoc(collection(db, 'users', uid, 'quotations'), {
      ...form, client: client?.name ?? '', clientId: form.clientId,
      total: total + vat, vat, status: 'Draft', createdAt: serverTimestamp(),
    })
    setOpen(false); setForm({ clientId: '', validUntil: '', notes: '', items: [{ desc: '', qty: 1, price: 0 }] })
  }

  async function emailQuote(q) {
    const client = clients.find(c => c.id === q.clientId)
    const to = client?.email || q.clientEmail
    if (!to) { alert('No email address on file for this client. Update the client record first.'); return }
    setEmailingQuoteId(q.id)
    const bizName = profile?.businessName || profile?.name || 'Tlhiso'
    const rows = (q.items || []).map(item =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${item.desc || ''}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${item.qty}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right">${fmt(item.price)}</td><td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">${fmt(Number(item.qty)*Number(item.price))}</td></tr>`
    ).join('')
    const htmlBody = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:2px solid #5B8E7D">
        <div><h2 style="color:#5B8E7D;margin:0">QUOTATION</h2></div>
        <div style="text-align:right"><p style="font-weight:700;font-size:16px;margin:0">${bizName}</p>${profile?.vatNumber ? `<p style="font-size:12px;color:#64748b;margin:4px 0 0">VAT: ${profile.vatNumber}</p>` : ''}</div>
      </div>
      <div style="margin:20px 0"><p style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;margin:0 0 4px">Prepared For</p><p style="font-weight:600;margin:0">${q.client || to}</p>${q.validUntil ? `<p style="font-size:12px;color:#64748b;margin:4px 0 0">Valid until: <strong>${q.validUntil}</strong></p>` : ''}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#f8fafc"><th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600">Description</th><th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:600">Qty</th><th style="padding:8px 12px;text-align:right;color:#64748b;font-weight:600">Unit Price</th><th style="padding:8px 12px;text-align:right;color:#64748b;font-weight:600">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:16px;text-align:right;font-size:13px">
        <div style="display:flex;justify-content:flex-end;gap:40px;margin-bottom:4px"><span style="color:#64748b">Subtotal</span><span>${fmt(Number(q.total||0)-Number(q.vat||0))}</span></div>
        <div style="display:flex;justify-content:flex-end;gap:40px;margin-bottom:8px"><span style="color:#64748b">VAT (15%)</span><span>${fmt(q.vat||0)}</span></div>
        <div style="display:flex;justify-content:flex-end;gap:40px;border-top:2px solid #5B8E7D;padding-top:8px"><span style="font-weight:700">Total</span><span style="font-weight:700;color:#5B8E7D">${fmt(q.total||0)}</span></div>
      </div>
      ${q.notes ? `<p style="font-size:13px;color:#64748b;margin-top:16px">${q.notes}</p>` : ''}
      <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0"/>
      <p style="font-size:12px;color:#94a3b8">Sent via Tlhiso · <a href="https://tlhiso.com" style="color:#5B8E7D">tlhiso.com</a></p>
    </div>`
    try {
      const res = await httpsCallable(functions, 'sendEmail')({
        to,
        subject: `Quotation from ${bizName}`,
        htmlBody,
      })
      if (!res.data?.success) throw new Error(res.data?.error || 'Email send failed')
      await Promise.all([
        updateDoc(doc(db, 'users', uid, 'quotations', q.id), { status: 'Sent' }),
        addDoc(collection(db, 'users', uid, 'messages'), { to, type: 'email', body: `Quotation sent to ${to}`, module: 'quotation', status: 'sent', sentAt: serverTimestamp() }),
      ])
      alert(`Quotation sent to ${to}`)
    } catch(e) { alert('Failed to send quotation: ' + e.message) }
    finally { setEmailingQuoteId(null) }
  }

  const statusColor = s => ({
    Draft: 'bg-gray-100 text-gray-600', Sent: 'bg-blue-100 text-blue-700',
    Accepted: 'bg-green-100 text-green-700', Rejected: 'bg-red-100 text-red-600', Invoiced: 'bg-purple-100 text-purple-700',
  }[s] ?? '')

  const cols = [
    { key: 'client',     label: 'Client' },
    { key: 'total',      label: 'Amount',     render: r => fmt(r.total) },
    { key: 'validUntil', label: 'Valid Until' },
    { key: 'status',     label: 'Status',     render: r => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(r.status)}`}>{r.status}</span> },
    { key: 'actions', label: '', sortable: false, render: r => (
      <div className="flex gap-1 flex-wrap" onClick={e => e.stopPropagation()}>
        {(r.status === 'Draft' || r.status === 'Sent') && (
          <button onClick={() => emailQuote(r)} disabled={emailingQuoteId === r.id} title="Email quote to client"
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40">
            {emailingQuoteId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Email
          </button>
        )}
        {r.status === 'Draft' && (
          <button onClick={() => updateDoc(doc(db, 'users', uid, 'quotations', r.id), { status: 'Sent' })}
            className="rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100">Mark Sent</button>
        )}
        {r.status === 'Sent' && (
          <>
            <button onClick={() => updateDoc(doc(db, 'users', uid, 'quotations', r.id), { status: 'Accepted' })} className="rounded px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-50">Accept</button>
            <button onClick={() => updateDoc(doc(db, 'users', uid, 'quotations', r.id), { status: 'Rejected' })} className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50">Reject</button>
          </>
        )}
        {r.status === 'Accepted' && (
          <button onClick={async () => {
            const invNumber = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`
            await addDoc(collection(db, 'users', uid, 'invoices'), {
              clientId: r.clientId, client: r.client, items: r.items ?? [],
              total: r.total, vat: r.vat, notes: r.notes ?? '',
              invoiceNumber: invNumber, status: 'Draft',
              fromQuotationId: r.id, createdAt: serverTimestamp(),
            })
            await updateDoc(doc(db, 'users', uid, 'quotations', r.id), { status: 'Invoiced' })
          }} className="rounded px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-50">Convert to Invoice</button>
        )}
        <button onClick={() => { if (!window.confirm('Delete this quotation? This cannot be undone.')) return; deleteDoc(doc(db, 'users', uid, 'quotations', r.id)) }}
          className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
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
            <p className="mb-2 text-xs font-semibold text-slate-600">Line Items</p>
            {form.items.map((item, idx) => (
              <div key={idx} className="mb-2 grid grid-cols-5 gap-2">
                <input placeholder="Description" value={item.desc} onChange={e => setForm(f => { const items = [...f.items]; items[idx].desc = e.target.value; return { ...f, items } })} className="col-span-3 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
                <input type="number" placeholder="Qty" value={item.qty} onChange={e => setForm(f => { const items = [...f.items]; items[idx].qty = e.target.value; return { ...f, items } })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
                <input type="number" placeholder="Price" value={item.price} onChange={e => setForm(f => { const items = [...f.items]; items[idx].price = e.target.value; return { ...f, items } })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
            ))}
            <button onClick={() => setForm(f => ({ ...f, items: [...f.items, { desc: '', qty: 1, price: 0 }] }))} className="text-xs text-primary font-semibold hover:underline">+ Add line</button>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Subtotal</span><span className="font-semibold">R{total.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">VAT (15%)</span><span className="font-semibold">R{vat.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2"><span className="font-bold">Total</span><span className="font-bold text-primary">R{(total + vat).toFixed(2)}</span></div>
          </div>
          <Field label="Notes" textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <button onClick={save} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white">Save Quotation</button>
        </div>
      </Modal>
    </div>
  )
}

// ── Project constants ─────────────────────────────────────────────────────────
const TASK_STATUSES  = ['Not Started', 'In Progress', 'In Review', 'Done', 'Stuck']
const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const priorityColor  = p => ({ Low: 'bg-gray-100 text-gray-600', Medium: 'bg-yellow-100 text-yellow-700', High: 'bg-orange-100 text-orange-700', Critical: 'bg-red-100 text-red-600' }[p] ?? 'bg-gray-100 text-gray-600')
const taskStatusColor = s => ({ 'Not Started': 'bg-gray-100 text-gray-600', 'In Progress': 'bg-blue-100 text-blue-700', 'In Review': 'bg-purple-100 text-purple-700', Done: 'bg-green-100 text-green-700', Stuck: 'bg-red-100 text-red-600' }[s] ?? 'bg-gray-100 text-gray-600')
const taskStatusBg   = s => ({ 'Not Started': 'bg-gray-50 border-gray-200', 'In Progress': 'bg-blue-50 border-blue-200', 'In Review': 'bg-purple-50 border-purple-200', Done: 'bg-green-50 border-green-200', Stuck: 'bg-red-50 border-red-200' }[s] ?? 'bg-gray-50 border-gray-200')
const mkId = () => Math.random().toString(36).substr(2, 9)

// ── Projects ──────────────────────────────────────────────────────────────────
function Projects() {
  const { user } = useAuth()
  const uid      = user?.uid
  const projects = useCollection(uid ? `users/${uid}/projects` : null)
  const clients  = useCollection(uid ? `users/${uid}/customers` : null)

  // wizard
  const BLANK_FORM = { clientId: '', title: '', description: '', priority: 'Medium', status: 'active', startDate: '', endDate: '', value: '', budget: '', billingType: 'Fixed', notes: '' }
  const [wizardOpen,        setWizardOpen]        = useState(false)
  const [step,              setStep]              = useState(1)
  const [form,              setForm]              = useState(BLANK_FORM)
  const [wizardTasks,       setWizardTasks]       = useState([])
  const [wizardMilestones,  setWizardMilestones]  = useState([])
  const [wTask,             setWTask]             = useState({ title: '', priority: 'Medium', dueDate: '', assignee: '' })
  const [wMilestone,        setWMilestone]        = useState({ title: '', date: '' })
  const [saving,            setSaving]            = useState(false)

  // detail
  const [selectedProject, setSelectedProject] = useState(null)
  const [detailTab,       setDetailTab]       = useState('board')
  const [addingTask,      setAddingTask]      = useState(false)
  const [addingMs,        setAddingMs]        = useState(false)
  const [taskForm,        setTaskForm]        = useState({ title: '', description: '', status: 'Not Started', priority: 'Medium', dueDate: '', assignee: '' })
  const [msForm,          setMsForm]          = useState({ title: '', date: '' })

  const fmtR = n => `R ${Number(n ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`

  // ── Firestore helpers ────────────────────────────────────────────────────
  async function recalcAndSave(projectId, tasks) {
    const done = tasks.filter(t => t.status === 'Done').length
    const progress = tasks.length ? Math.round(done / tasks.length * 100) : 0
    await updateDoc(doc(db, 'users', uid, 'projects', projectId), { tasks, progress })
  }

  async function addTaskToProject(project) {
    if (!taskForm.title) return
    const tasks = [...(project.tasks || []), { ...taskForm, id: mkId(), createdAt: new Date().toISOString() }]
    await recalcAndSave(project.id, tasks)
    setTaskForm({ title: '', description: '', status: 'Not Started', priority: 'Medium', dueDate: '', assignee: '' })
    setAddingTask(false)
  }

  async function updateTaskStatus(project, taskId, status) {
    const tasks = (project.tasks || []).map(t => t.id === taskId ? { ...t, status } : t)
    await recalcAndSave(project.id, tasks)
  }

  async function removeTask(project, taskId) {
    const tasks = (project.tasks || []).filter(t => t.id !== taskId)
    await recalcAndSave(project.id, tasks)
  }

  async function addMilestoneToProject(project) {
    if (!msForm.title || !msForm.date) return
    const milestones = [...(project.milestones || []), { ...msForm, id: mkId(), completed: false }]
    await updateDoc(doc(db, 'users', uid, 'projects', project.id), { milestones })
    setMsForm({ title: '', date: '' }); setAddingMs(false)
  }

  async function toggleMilestone(project, msId) {
    const milestones = (project.milestones || []).map(m => m.id === msId ? { ...m, completed: !m.completed } : m)
    await updateDoc(doc(db, 'users', uid, 'projects', project.id), { milestones })
  }

  async function saveProject() {
    if (!uid || !form.title) { alert('Project title is required.'); return }
    setSaving(true)
    try {
      const client = clients.find(c => c.id === form.clientId)
      const tasks = wizardTasks
      const done = tasks.filter(t => t.status === 'Done').length
      await addDoc(collection(db, 'users', uid, 'projects'), {
        ...form, client: client?.name ?? '',
        tasks, milestones: wizardMilestones,
        progress: tasks.length ? Math.round(done / tasks.length * 100) : 0,
        createdAt: serverTimestamp(),
      })
      setWizardOpen(false); setStep(1); setForm(BLANK_FORM)
      setWizardTasks([]); setWizardMilestones([])
    } finally { setSaving(false) }
  }

  // ── Detail view ──────────────────────────────────────────────────────────
  if (selectedProject) {
    const project    = projects.find(p => p.id === selectedProject.id) ?? selectedProject
    const tasks      = project.tasks      || []
    const milestones = project.milestones || []
    const progress   = project.progress  ?? 0
    const done       = tasks.filter(t => t.status === 'Done').length
    const stuck      = tasks.filter(t => t.status === 'Stuck').length
    const today      = new Date().toISOString().slice(0, 10)
    const daysLeft   = project.endDate ? Math.ceil((new Date(project.endDate) - new Date()) / 86400000) : null
    const projStatusColor = { active: 'bg-green-100 text-green-700', 'on-hold': 'bg-amber-100 text-amber-700', completed: 'bg-blue-100 text-blue-700', cancelled: 'bg-red-100 text-red-600' }

    return (
      <div className="space-y-5">
        <button onClick={() => setSelectedProject(null)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition">
          <ChevronLeft size={16} /> Back to Projects
        </button>

        {/* ── Header ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold text-slate-800">{project.title}</h2>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${projStatusColor[project.status] ?? 'bg-gray-100 text-gray-600'}`}>{(project.status||'active').replace('-',' ')}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${priorityColor(project.priority)}`}>{project.priority}</span>
              </div>
              {project.client && <p className="mt-1 text-sm text-slate-500">{project.client} · {project.billingType || 'Fixed'}</p>}
              {project.description && <p className="mt-1 text-sm text-slate-600">{project.description}</p>}
            </div>
            <div className="flex gap-2">
              <select value={project.status} onChange={e => updateDoc(doc(db, 'users', uid, 'projects', project.id), { status: e.target.value })}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-primary">
                {['active','on-hold','completed','cancelled'].map(s => <option key={s} value={s}>{s.replace('-',' ')}</option>)}
              </select>
              <button onClick={() => { if (!window.confirm('Delete this project?')) return; deleteDoc(doc(db, 'users', uid, 'projects', project.id)); setSelectedProject(null) }}
                className="rounded-xl border border-red-100 px-3 py-2 text-xs text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-5">
            <div className="mb-1.5 flex justify-between">
              <span className="text-xs font-semibold text-slate-600">Overall Progress</span>
              <span className="text-xs font-bold text-primary">{progress}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100">
              <div className="h-3 rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1.5 flex gap-4 text-[11px] text-slate-500">
              <span className="text-green-600 font-semibold">{done} done</span>
              {stuck > 0 && <span className="text-red-500 font-semibold">{stuck} stuck</span>}
              <span>{tasks.length - done - stuck} in progress</span>
              {milestones.length > 0 && <span>· {milestones.filter(m => m.completed).length}/{milestones.length} milestones</span>}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {project.startDate && <div className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Start</p><p className="mt-0.5 text-sm font-semibold text-slate-700">{fmtDate(project.startDate)}</p></div>}
            {project.endDate   && <div className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deadline</p><p className="mt-0.5 text-sm font-semibold text-slate-700">{fmtDate(project.endDate)}</p></div>}
            {daysLeft !== null && <div className={`rounded-xl px-3 py-2.5 ${daysLeft < 0 ? 'bg-red-50' : daysLeft <= 7 ? 'bg-amber-50' : 'bg-slate-50'}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Days Left</p><p className={`mt-0.5 text-sm font-semibold ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-700' : 'text-slate-700'}`}>{daysLeft < 0 ? `${Math.abs(daysLeft)} overdue` : daysLeft}</p></div>}
            {project.value     && <div className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Project Value</p><p className="mt-0.5 text-sm font-semibold text-slate-700">{fmtR(project.value)}</p></div>}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
          {[['board','Board'],['list','Task List'],['milestones','Milestones'],['timeline','Timeline']].map(([key, label]) => (
            <button key={key} onClick={() => setDetailTab(key)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${detailTab === key ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Board ── */}
        {detailTab === 'board' && (
          <div>
            <div className="mb-3 flex justify-end">
              <button onClick={() => setAddingTask(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-[#4e7d6d]"><PlusCircle size={13} /> Add Task</button>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-3" style={{ minWidth: '900px' }}>
                {TASK_STATUSES.map(status => {
                  const col = tasks.filter(t => t.status === status)
                  return (
                    <div key={status} className={`flex-1 rounded-2xl border p-3 ${taskStatusBg(status)}`}>
                      <div className="mb-3 flex items-center justify-between">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${taskStatusColor(status)}`}>{status}</span>
                        <span className="text-[11px] font-semibold text-slate-400">{col.length}</span>
                      </div>
                      <div className="space-y-2">
                        {col.map(task => (
                          <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <p className="text-xs font-semibold text-slate-800">{task.title}</p>
                            {task.description && <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{task.description}</p>}
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityColor(task.priority)}`}>{task.priority}</span>
                              {task.dueDate && <span className={`text-[10px] font-medium ${task.dueDate < today && task.status !== 'Done' ? 'text-red-500' : 'text-slate-400'}`}>{fmtDate(task.dueDate)}</span>}
                            </div>
                            {task.assignee && <p className="mt-1.5 text-[10px] text-slate-400">👤 {task.assignee}</p>}
                            <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-2">
                              {TASK_STATUSES.filter(s => s !== status).map(s => (
                                <button key={s} onClick={() => updateTaskStatus(project, task.id, s)}
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold hover:opacity-80 ${taskStatusColor(s)}`}>→ {s}</button>
                              ))}
                            </div>
                            <button onClick={() => removeTask(project, task.id)} className="mt-1.5 text-[10px] text-red-400 hover:text-red-600">Remove</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Task List ── */}
        {detailTab === 'list' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button onClick={() => setAddingTask(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-[#4e7d6d]"><PlusCircle size={13} /> Add Task</button>
            </div>
            <DataTable
              columns={[
                { key: 'title',    label: 'Task' },
                { key: 'assignee', label: 'Assignee', render: r => r.assignee || '—' },
                { key: 'priority', label: 'Priority', render: r => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityColor(r.priority)}`}>{r.priority}</span> },
                { key: 'dueDate',  label: 'Due', render: r => r.dueDate ? <span className={r.dueDate < today && r.status !== 'Done' ? 'text-red-500 font-semibold' : ''}>{fmtDate(r.dueDate)}</span> : '—' },
                { key: 'status',   label: 'Status', render: r => (
                  <select value={r.status} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); updateTaskStatus(project, r.id, e.target.value) }}
                    className={`rounded-full border-0 px-2 py-1 text-[11px] font-semibold ${taskStatusColor(r.status)}`}>
                    {TASK_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                )},
                { key: 'actions', label: '', sortable: false, render: r => (
                  <button onClick={e => { e.stopPropagation(); removeTask(project, r.id) }} className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
                )},
              ]}
              data={tasks}
              emptyMessage="No tasks yet. Add your first task above."
            />
          </div>
        )}

        {/* ── Milestones ── */}
        {detailTab === 'milestones' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button onClick={() => setAddingMs(true)} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-[#4e7d6d]"><Flag size={13} /> Add Milestone</button>
            </div>
            {milestones.length === 0
              ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">No milestones yet.</div>
              : <div className="space-y-2">
                  {[...milestones].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(m => (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <button onClick={() => toggleMilestone(project, m.id)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${m.completed ? 'border-primary bg-primary' : 'border-slate-300 hover:border-primary'}`}>
                        {m.completed && <CheckCircle size={13} className="text-white" />}
                      </button>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${m.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{m.title}</p>
                        {m.date && <p className={`text-[11px] ${m.date < today && !m.completed ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>{fmtDate(m.date)}{m.date < today && !m.completed ? ' · Overdue' : ''}</p>}
                      </div>
                      <button onClick={() => { const ms = milestones.filter(x => x.id !== m.id); updateDoc(doc(db, 'users', uid, 'projects', project.id), { milestones: ms }) }}
                        className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ── Timeline ── */}
        {detailTab === 'timeline' && (() => {
          const start = project.startDate ? new Date(project.startDate) : null
          const end   = project.endDate   ? new Date(project.endDate)   : null
          if (!start || !end) return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">Set a start and end date on this project to view the timeline.</div>
          const totalMs = Math.max(end - start, 1)
          const pct = d => Math.min(100, Math.max(0, (new Date(d) - start) / totalMs * 100))
          const todayPct = pct(new Date())

          const months = []
          const cur = new Date(start.getFullYear(), start.getMonth(), 1)
          while (cur <= end) {
            months.push({ label: cur.toLocaleDateString('en-ZA', { month: 'short' }), pct: pct(cur) })
            cur.setMonth(cur.getMonth() + 1)
          }
          const tasksWithDates = tasks.filter(t => t.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))

          return (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card space-y-8">
              <div>
                <h3 className="mb-4 text-sm font-bold text-slate-800">Project Timeline</h3>
                {/* Month labels */}
                <div className="relative mb-1 h-4">
                  {months.map((m, i) => <span key={i} style={{ left: `${m.pct}%` }} className="absolute text-[10px] font-semibold text-slate-400 -translate-x-1/2">{m.label}</span>)}
                </div>
                {/* Track */}
                <div className="relative h-3 rounded-full bg-slate-100 overflow-visible">
                  <div className="h-3 rounded-full bg-primary/25" style={{ width: '100%' }} />
                  <div className="absolute top-0 h-3 rounded-full bg-primary" style={{ width: `${Math.min(100, todayPct)}%` }} />
                  {todayPct > 2 && todayPct < 98 && (
                    <div style={{ left: `${todayPct}%` }} className="absolute -top-1 bottom-0 w-0.5 bg-red-500">
                      <span className="absolute -top-5 left-1 text-[10px] font-bold text-red-500 whitespace-nowrap">Today</span>
                    </div>
                  )}
                  {milestones.map(m => m.date && (
                    <div key={m.id} title={m.title} style={{ left: `${pct(m.date)}%` }}
                      className={`absolute -top-1.5 h-6 w-6 -translate-x-1/2 rotate-45 border-2 ${m.completed ? 'bg-primary border-primary' : 'bg-white border-primary'}`} />
                  ))}
                </div>
                {/* Milestone legend */}
                {milestones.filter(m => m.date).length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {milestones.map(m => m.date && (
                      <div key={m.id} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <span className={`inline-block h-3 w-3 rotate-45 border ${m.completed ? 'bg-primary border-primary' : 'border-primary'}`} />
                        {m.title} <span className="text-slate-400">{fmtDate(m.date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Task bars */}
              {tasksWithDates.length > 0 && (
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">Tasks with Deadlines</p>
                  <div className="space-y-2">
                    {tasksWithDates.map(t => (
                      <div key={t.id} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 truncate text-[11px] font-semibold text-slate-700">{t.title}</span>
                        <div className="relative flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
                          <div style={{ width: `${Math.min(100, pct(t.dueDate))}%` }}
                            className={`h-5 rounded-full ${t.status === 'Done' ? 'bg-green-400' : t.status === 'Stuck' ? 'bg-red-400' : t.dueDate < today ? 'bg-orange-400' : 'bg-primary/70'}`} />
                        </div>
                        <span className={`w-24 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold ${taskStatusColor(t.status)}`}>{t.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-primary inline-block" /> Progress</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-400 inline-block" /> Overdue</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-400 inline-block" /> Done</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rotate-45 border-2 border-primary inline-block" /> Milestone</span>
              </div>
            </div>
          )
        })()}

        {/* Add Task modal */}
        <Modal open={addingTask} onClose={() => setAddingTask(false)} title="Add Task">
          <div className="space-y-3">
            <Field label="Task title *" value={taskForm.title} onChange={e => setTaskForm(f => ({...f, title: e.target.value}))} />
            <Field label="Description" textarea value={taskForm.description} onChange={e => setTaskForm(f => ({...f, description: e.target.value}))} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Assignee" value={taskForm.assignee} onChange={e => setTaskForm(f => ({...f, assignee: e.target.value}))} placeholder="Name or email" />
              <Field label="Due Date" type="date" value={taskForm.dueDate} onChange={e => setTaskForm(f => ({...f, dueDate: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority" select value={taskForm.priority} onChange={e => setTaskForm(f => ({...f, priority: e.target.value}))}>
                {TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </Field>
              <Field label="Status" select value={taskForm.status} onChange={e => setTaskForm(f => ({...f, status: e.target.value}))}>
                {TASK_STATUSES.map(s => <option key={s}>{s}</option>)}
              </Field>
            </div>
            <button onClick={() => addTaskToProject(project)} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">Add Task</button>
          </div>
        </Modal>

        {/* Add Milestone modal */}
        <Modal open={addingMs} onClose={() => setAddingMs(false)} title="Add Milestone">
          <div className="space-y-3">
            <Field label="Milestone title *" value={msForm.title} onChange={e => setMsForm(f => ({...f, title: e.target.value}))} />
            <Field label="Target Date *" type="date" value={msForm.date} onChange={e => setMsForm(f => ({...f, date: e.target.value}))} />
            <button onClick={() => addMilestoneToProject(project)} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">Save Milestone</button>
          </div>
        </Modal>
      </div>
    )
  }

  // ── Project list ─────────────────────────────────────────────────────────
  const projStatusColor = s => ({ active: 'bg-green-100 text-green-700', 'on-hold': 'bg-amber-100 text-amber-700', completed: 'bg-blue-100 text-blue-700', cancelled: 'bg-red-100 text-red-600' }[s] ?? 'bg-gray-100 text-gray-600')

  const cols = [
    { key: 'title',  label: 'Project', render: r => <span className="font-semibold text-slate-800">{r.title}</span> },
    { key: 'client', label: 'Client' },
    { key: 'progress', label: 'Progress', render: r => (
      <div className="flex items-center gap-2">
        <div className="h-2 w-24 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-primary" style={{ width: `${r.progress ?? 0}%` }} /></div>
        <span className="text-[11px] font-semibold text-slate-600">{r.progress ?? 0}%</span>
      </div>
    )},
    { key: 'endDate', label: 'Deadline', render: r => {
      if (!r.endDate) return '—'
      const days = Math.ceil((new Date(r.endDate) - new Date()) / 86400000)
      return <span className={r.status !== 'completed' && days < 0 ? 'font-semibold text-red-500' : ''}>{fmtDate(r.endDate)}{r.status !== 'completed' && days < 0 ? ' · Overdue' : ''}</span>
    }},
    { key: 'value',  label: 'Value', render: r => r.value ? fmtR(r.value) : '—' },
    { key: 'status', label: 'Status', render: r => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${projStatusColor(r.status)}`}>{(r.status||'').replace('-',' ')}</span> },
    { key: 'actions', label: '', sortable: false, render: r => (
      <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this project?')) return; deleteDoc(doc(db, 'users', uid, 'projects', r.id)) }}
        className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
    )},
  ]

  return (
    <div className="space-y-5">
      <PageHead title="Projects" subtitle="Plan, track and deliver client work"
        action={<AddButton onClick={() => { setStep(1); setForm(BLANK_FORM); setWizardTasks([]); setWizardMilestones([]); setWizardOpen(true) }}>New Project</AddButton>} />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active',    val: projects.filter(p => p.status === 'active').length,    color: 'text-green-600' },
          { label: 'On Hold',   val: projects.filter(p => p.status === 'on-hold').length,   color: 'text-amber-600' },
          { label: 'Completed', val: projects.filter(p => p.status === 'completed').length, color: 'text-blue-600' },
          { label: 'Total',     val: projects.length,                                        color: 'text-slate-800' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card text-center">
            <p className={`text-3xl font-extrabold ${s.color}`}>{s.val}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">{s.label}</p>
          </div>
        ))}
      </div>

      <DataTable columns={cols} data={projects} onRowClick={setSelectedProject} emptyMessage="No projects yet. Click 'New Project' to get started." />

      {/* ── Creation Wizard ── */}
      <Modal open={wizardOpen} onClose={() => setWizardOpen(false)} title={`New Project — Step ${step} of 4`} size="lg">
        {/* Step indicator */}
        <div className="mb-5 flex gap-1.5">
          {['Basics','Timeline','Tasks','Review'].map((label, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full ${step > i + 1 ? 'bg-primary' : step === i + 1 ? 'bg-primary' : 'bg-slate-200'}`} />
              <p className={`mt-1 text-[10px] font-semibold ${step === i + 1 ? 'text-primary' : 'text-slate-400'}`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Step 1 — Basics */}
        {step === 1 && (
          <div className="space-y-4">
            <FormSection title="Project Basics" icon={ClipboardList}>
              <Field label="Project Title *" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. Website Redesign" />
              <Field label="Description" textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Priority" select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}>
                  {TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </Field>
                <Field label="Status" select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}>
                  {['active','on-hold','completed','cancelled'].map(s => <option key={s} value={s}>{s.replace('-',' ')}</option>)}
                </Field>
              </div>
            </FormSection>
            <FormSection title="Client" icon={Users}>
              <Field label="Client" select value={form.clientId} onChange={e => setForm(f => ({...f, clientId: e.target.value}))}>
                <option value="">Select client…</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
              </Field>
            </FormSection>
            <button onClick={() => { if (!form.title) { alert('Title is required.'); return } setStep(2) }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
              Next: Timeline <ChevronRight size={15} />
            </button>
          </div>
        )}

        {/* Step 2 — Timeline & Budget */}
        {step === 2 && (
          <div className="space-y-4">
            <FormSection title="Timeline" icon={Clock}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date" type="date" value={form.startDate} onChange={e => setForm(f => ({...f, startDate: e.target.value}))} />
                <Field label="End / Deadline" type="date" value={form.endDate} onChange={e => setForm(f => ({...f, endDate: e.target.value}))} />
              </div>
            </FormSection>
            <FormSection title="Budget & Billing" icon={Receipt}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Project Value (R)" type="number" value={form.value} onChange={e => setForm(f => ({...f, value: e.target.value}))} placeholder="0.00" />
                <Field label="Budget (R)" type="number" value={form.budget} onChange={e => setForm(f => ({...f, budget: e.target.value}))} placeholder="0.00" />
              </div>
              <Field label="Billing Type" select value={form.billingType} onChange={e => setForm(f => ({...f, billingType: e.target.value}))}>
                {['Fixed','Hourly','Retainer','Milestone-based'].map(b => <option key={b}>{b}</option>)}
              </Field>
            </FormSection>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">← Back</button>
              <button onClick={() => setStep(3)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">Next: Tasks <ChevronRight size={15} /></button>
            </div>
          </div>
        )}

        {/* Step 3 — Tasks & Milestones */}
        {step === 3 && (
          <div className="space-y-4">
            <FormSection title="Initial Tasks" icon={ListIcon}>
              {wizardTasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityColor(t.priority)}`}>{t.priority}</span>
                  <span className="flex-1 text-xs font-semibold text-slate-700">{t.title}</span>
                  {t.assignee && <span className="text-[10px] text-slate-400">@{t.assignee}</span>}
                  <button onClick={() => setWizardTasks(wizardTasks.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Task title…" value={wTask.title} onChange={e => setWTask(f => ({...f, title: e.target.value}))}
                  className="col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
                <input placeholder="Assignee" value={wTask.assignee} onChange={e => setWTask(f => ({...f, assignee: e.target.value}))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
                <input type="date" value={wTask.dueDate} onChange={e => setWTask(f => ({...f, dueDate: e.target.value}))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
                <select value={wTask.priority} onChange={e => setWTask(f => ({...f, priority: e.target.value}))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary">
                  {TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
                <button onClick={() => { if (!wTask.title) return; setWizardTasks([...wizardTasks, { ...wTask, id: mkId(), status: 'Not Started', createdAt: new Date().toISOString() }]); setWTask({ title: '', priority: 'Medium', dueDate: '', assignee: '' }) }}
                  className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20">+ Add Task</button>
              </div>
            </FormSection>

            <FormSection title="Milestones" icon={Flag}>
              {wizardMilestones.map((m, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <Flag size={12} className="text-primary shrink-0" />
                  <span className="flex-1 text-xs font-semibold text-slate-700">{m.title}</span>
                  <span className="text-[10px] text-slate-400">{fmtDate(m.date)}</span>
                  <button onClick={() => setWizardMilestones(wizardMilestones.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2">
                <input placeholder="Milestone title…" value={wMilestone.title} onChange={e => setWMilestone(f => ({...f, title: e.target.value}))}
                  className="col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
                <input type="date" value={wMilestone.date} onChange={e => setWMilestone(f => ({...f, date: e.target.value}))}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
                <button onClick={() => { if (!wMilestone.title || !wMilestone.date) return; setWizardMilestones([...wizardMilestones, { ...wMilestone, id: mkId(), completed: false }]); setWMilestone({ title: '', date: '' }) }}
                  className="col-span-3 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20">+ Add Milestone</button>
              </div>
            </FormSection>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">← Back</button>
              <button onClick={() => setStep(4)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d]">Review <ChevronRight size={15} /></button>
            </div>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3 text-sm">
              <div className="flex justify-between"><span className="font-semibold text-slate-600">Project</span><span className="font-bold text-slate-800">{form.title}</span></div>
              {form.clientId && <div className="flex justify-between"><span className="font-semibold text-slate-600">Client</span><span className="text-slate-800">{clients.find(c => c.id === form.clientId)?.name || '—'}</span></div>}
              <div className="flex justify-between"><span className="font-semibold text-slate-600">Priority</span><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityColor(form.priority)}`}>{form.priority}</span></div>
              {form.startDate && <div className="flex justify-between"><span className="font-semibold text-slate-600">Timeline</span><span className="text-slate-800">{fmtDate(form.startDate)} → {fmtDate(form.endDate)}</span></div>}
              {form.value     && <div className="flex justify-between"><span className="font-semibold text-slate-600">Value</span><span className="text-slate-800">{fmtR(form.value)} · {form.billingType}</span></div>}
              <div className="flex justify-between"><span className="font-semibold text-slate-600">Tasks</span><span className="text-slate-800">{wizardTasks.length}</span></div>
              <div className="flex justify-between"><span className="font-semibold text-slate-600">Milestones</span><span className="text-slate-800">{wizardMilestones.length}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">← Back</button>
              <button onClick={saveProject} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d] disabled:opacity-60">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <><CheckCircle size={14} /> Create Project</>}
              </button>
            </div>
          </div>
        )}
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
  return <div className="space-y-4"><h2 className="text-base font-bold text-slate-800">{title}</h2>{children}</div>
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
        <Route path="surveys" element={<SurveysModule industry="b2b" />} />
        <Route path="marketing-optin" element={<MarketingOptIn />} />
        <Route path="campaigns"    element={<CampaignsModule industry="b2b" />} />
        <Route path="automations" element={<AutomationsModule industry="b2b" />} />
        <Route path="profile" element={<ProfilePage industry="b2b" />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<SimplePage title="Coming Soon"><p className="text-sm text-slate-600">This section is being built. Check back soon.</p></SimplePage>} />
      </Routes>
    </DashboardLayout>
  )
}
