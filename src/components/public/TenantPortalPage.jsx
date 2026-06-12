// Tenant self-service portal — /tenant?t=<base64 {uid, id}>
// Read-only view of lease, rent and invoices plus a maintenance request form.
// All data flows through callable Cloud Functions (getTenantPortal /
// createTenantMaintenance); the random tenant doc ID inside the token acts
// as the capability, same pattern as the unsubscribe link.

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../services/firebase'
import {
  Home, Loader2, AlertTriangle, Wrench, CheckCircle,
  Receipt, CalendarDays, PlusCircle,
} from 'lucide-react'

const fmtR = n => `R ${Number(n ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`

const INV_STYLE = {
  Paid:    'bg-green-100 text-green-700',
  Sent:    'bg-blue-100 text-blue-700',
  Overdue: 'bg-red-100 text-red-600',
  Draft:   'bg-slate-100 text-slate-500',
}
const MAINT_STYLE = {
  Open:        'bg-amber-100 text-amber-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed:   'bg-green-100 text-green-700',
  Closed:      'bg-slate-100 text-slate-500',
}

export default function TenantPortalPage() {
  const [params] = useSearchParams()
  const token = params.get('t')

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)

  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState({ title: '', description: '', priority: 'Medium' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return }
    httpsCallable(functions, 'getTenantPortal')({ token })
      .then(res => setData(res.data))
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false))
  }, [token])

  async function submitMaintenance(e) {
    e.preventDefault()
    if (!form.title.trim() || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await httpsCallable(functions, 'createTenantMaintenance')({ token, ...form })
      setSubmitted(true)
      setShowForm(false)
      setForm({ title: '', description: '', priority: 'Medium' })
    } catch (err) {
      setError(err.message?.replace(/^.*?: /, '') || 'Could not submit your request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  if (invalid || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle size={28} className="mx-auto mb-3 text-amber-500" />
          <p className="font-bold text-slate-800">Portal link not valid</p>
          <p className="mt-1 text-sm text-slate-500">
            This link may be incorrect or expired. Please contact your property manager for a new one.
          </p>
        </div>
      </div>
    )
  }

  const { tenant, agency, invoices, maintenance } = data

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Header */}
        <div className="rounded-2xl bg-gradient-to-br from-primary to-[#3d6b5c] p-6 text-white shadow-sm">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
              <Home size={22} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-black">{tenant.name}</h1>
              <p className="text-sm text-white/80">
                {tenant.property || 'Your home'}{tenant.unit ? ` · Unit ${tenant.unit}` : ''} — managed by {agency.name}
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/10 px-2 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Monthly rent</p>
              <p className="mt-0.5 text-sm font-black">{tenant.rentAmount != null ? fmtR(tenant.rentAmount) : '—'}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-2 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Lease ends</p>
              <p className="mt-0.5 text-sm font-black">{tenant.leaseEnd || '—'}</p>
            </div>
            <div className="rounded-xl bg-white/10 px-2 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Status</p>
              <p className="mt-0.5 text-sm font-black capitalize">{tenant.status || '—'}</p>
            </div>
          </div>
        </div>

        {/* Maintenance */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Wrench size={15} /></span>
              <h2 className="text-sm font-bold text-slate-800">Maintenance</h2>
            </div>
            {!showForm && (
              <button onClick={() => { setShowForm(true); setSubmitted(false) }}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#4e7d6d]">
                <PlusCircle size={13} /> Log a request
              </button>
            )}
          </div>

          {submitted && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <CheckCircle size={16} className="shrink-0 text-green-600" />
              <p className="text-xs text-green-800">
                Request submitted — {agency.name} has been notified and will be in touch.
              </p>
            </div>
          )}

          {showForm && (
            <form onSubmit={submitMaintenance} className="mb-5 space-y-3 rounded-xl bg-slate-50 p-4">
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="What needs fixing? e.g. Leaking kitchen tap *" className={inputCls} />
              <textarea rows={3} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Add any helpful details (where, since when, how bad)…"
                className={`${inputCls} resize-none`} />
              <div className="flex items-center gap-2">
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary">
                  {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p}>{p}</option>)}
                </select>
                <button type="submit" disabled={!form.title.trim() || submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-white transition hover:bg-[#4e7d6d] disabled:opacity-40">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />} Submit request
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-white">
                  Cancel
                </button>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </form>
          )}

          {maintenance.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">No maintenance requests on record.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {maintenance.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{m.title || '—'}</p>
                    <p className="text-[11px] text-slate-400">
                      {m.createdAt?._seconds
                        ? new Date(m.createdAt._seconds * 1000).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
                        : ''} · {m.priority}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${MAINT_STYLE[m.status] ?? MAINT_STYLE.Open}`}>
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Receipt size={15} /></span>
            <h2 className="text-sm font-bold text-slate-800">Recent Invoices</h2>
          </div>
          {invoices.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">No invoices on record.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {invoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{inv.invoiceNumber || 'Invoice'}</p>
                    <p className="flex items-center gap-1 text-[11px] text-slate-400">
                      <CalendarDays size={10} /> Due {inv.dueDate || '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{fmtR(inv.total)}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${INV_STYLE[inv.status] ?? INV_STYLE.Draft}`}>
                      {inv.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-400">
          Powered by <a href="https://tlhiso.com" className="font-semibold text-primary">Tlhiso</a>
        </p>
      </div>
    </div>
  )
}
