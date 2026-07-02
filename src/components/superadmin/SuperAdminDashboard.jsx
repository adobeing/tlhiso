// Super Admin Dashboard
//
// Routes:
//   /superadmin          → PlatformOverview — platform-wide KPIs, industry split, recent signups
//   /superadmin/users    → AllUsers         — full user table + per-user detail with usage stats
//   /superadmin/messages → AdminMessages    — send email to any user
//   /superadmin/settings → AdminSettings   — platform info

import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import {
  collection, getDocs, doc, updateDoc, query, orderBy,
  getCountFromServer, where, onSnapshot, addDoc, serverTimestamp, deleteDoc,
  setDoc, getDoc,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../services/firebase'
import DashboardLayout from '../shared/DashboardLayout'
import DataTable from '../shared/DataTable'
import Modal from '../shared/Modal'
import {
  CheckCircle, XCircle, Eye, Trash2, Send, PauseCircle,
  BadgeCheck, BadgeX, Ban, Loader2, CreditCard, Phone, Mail,
  Users, Building2, HeartPulse, MapPin, ShoppingBag,
  ArrowLeft, TrendingUp, MessageSquare, BarChart2, Megaphone,
  Calendar, FileText, UserCheck, UserX, Activity,
  DollarSign, Smartphone, AtSign, RefreshCw, ChevronRight,
  Shield, Clock, Star, Bell, Bot, Copy, ExternalLink,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ── Constants ─────────────────────────────────────────────────────────────────
const PLAN_META = {
  starter:    { label: 'Starter',      price: 699,  quota: 1000,  color: 'bg-slate-100 text-slate-700'    },
  business:   { label: 'Professional', price: 2699, quota: 3000,  color: 'bg-blue-100 text-blue-700'      },
  enterprise: { label: 'Business',     price: 4999, quota: 10000, color: 'bg-purple-100 text-purple-700'  },
}

const STATUS_BADGE = {
  active:    'bg-green-100 text-green-700',
  pending:   'bg-amber-100 text-amber-700',
  paused:    'bg-blue-100 text-blue-600',
  suspended: 'bg-red-100 text-red-600',
}

const INDUSTRY_META = {
  b2b:      { label: 'B2B',      Icon: Building2,  color: 'bg-blue-50 text-blue-600',    contacts: 'customers'  },
  medical:  { label: 'Medical',  Icon: HeartPulse, color: 'bg-red-50 text-red-500',      contacts: 'patients'   },
  property: { label: 'Property', Icon: MapPin,     color: 'bg-amber-50 text-amber-600',  contacts: 'tenants'    },
  retail:   { label: 'Retail',   Icon: ShoppingBag,color: 'bg-emerald-50 text-emerald-600', contacts: 'customers' },
}

function getStatus(u) { return u.status || (u.isActive ? 'active' : 'pending') }

// ── Platform Overview ─────────────────────────────────────────────────────────
function PlatformOverview() {
  const [users, setUsers]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [providerStats, setProviderStats] = useState(null)
  const [providerLoading, setProviderLoading] = useState(true)

  function fetchProviderStats() {
    setProviderLoading(true)
    httpsCallable(functions, 'getProviderStats')()
      .then(r => setProviderStats(r.data))
      .catch(() => setProviderStats(null))
      .finally(() => setProviderLoading(false))
  }

  useEffect(() => {
    getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))
      .then(snap => { setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) })
      .catch(() => setLoading(false))
    fetchProviderStats()
  }, [])

  const active    = users.filter(u => u.isActive).length
  const pending   = users.filter(u => !u.isActive).length
  const paid      = users.filter(u => u.isPaid).length
  const suspended = users.filter(u => getStatus(u) === 'suspended').length
  const mrr       = users.filter(u => u.isPaid).reduce((s, u) => s + (PLAN_META[u.plan]?.price ?? 0), 0)

  const byIndustry = users.reduce((acc, u) => {
    acc[u.industry ?? 'unknown'] = (acc[u.industry ?? 'unknown'] ?? 0) + 1
    return acc
  }, {})

  const byPlan = users.reduce((acc, u) => {
    acc[u.plan ?? 'unknown'] = (acc[u.plan ?? 'unknown'] ?? 0) + 1
    return acc
  }, {})

  const KPI = ({ label, value, sub, Icon, bg, textColor }) => (
    <div className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40">
      <div className="mb-5 flex items-start justify-between">
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-110 ${bg}`}>
          <Icon size={22} />
        </span>
      </div>
      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-4xl font-black tracking-tight ${textColor ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs font-medium text-slate-400">{sub}</p>}
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Platform Overview</h2>
        <p className="mt-1 text-sm font-medium text-slate-400">Live snapshot of all users and platform activity</p>
      </div>

      {/* Row 1 — Core KPIs */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-5">
        <KPI label="Total Users"    value={users.length} Icon={Users}       bg="bg-slate-100 text-slate-600"     />
        <KPI label="Active"         value={active}       Icon={UserCheck}   bg="bg-green-50 text-green-600"     textColor="text-green-700" />
        <KPI label="Pending"        value={pending}      Icon={Clock}       bg="bg-amber-50 text-amber-600"     textColor="text-amber-700" />
        <KPI label="Paid"           value={paid}         Icon={BadgeCheck}  bg="bg-emerald-50 text-emerald-600" textColor="text-emerald-700" />
        <KPI label="Est. MRR"       value={`R${mrr.toLocaleString('en-ZA')}`} Icon={DollarSign} bg="bg-primary/10 text-primary" textColor="text-primary" sub={`${paid} paying subscribers`} />
      </div>

      {/* Row 2 — Industry split */}
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {['b2b','medical','property','retail'].map(ind => {
          const meta  = INDUSTRY_META[ind]
          const count = byIndustry[ind] ?? 0
          const pct   = users.length > 0 ? Math.round((count / users.length) * 100) : 0
          return (
            <div key={ind} className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${meta.color}`}>
                  <meta.Icon size={18} />
                </span>
                <p className="text-sm font-bold text-slate-700">{meta.label}</p>
              </div>
              <p className="text-3xl font-black text-slate-900">{count}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">{pct}% of users</p>
            </div>
          )
        })}
      </div>

      {/* Row 3 — Provider Health */}
      <div className="grid grid-cols-2 gap-5">

        {/* BulkSMS */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Smartphone size={16} /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">BulkSMS</p>
                <p className="text-[10px] text-slate-400">Credit balance</p>
              </div>
            </div>
            <button onClick={fetchProviderStats} disabled={providerLoading}
              className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40">
              <RefreshCw size={13} className={providerLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          {providerLoading ? (
            <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
          ) : providerStats?.bulksms?.error ? (
            <p className="text-sm font-semibold text-red-500">{providerStats.bulksms.error}</p>
          ) : (
            <div>
              <p className="text-4xl font-black text-slate-900">
                {providerStats?.bulksms?.balance?.toLocaleString('en-ZA') ?? '—'}
              </p>
              <p className="mt-1 text-xs text-slate-400">{providerStats?.bulksms?.currency ?? 'ZAR'} credits remaining</p>
            </div>
          )}
        </div>

        {/* SendGrid */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><AtSign size={16} /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">SendGrid</p>
                <p className="text-[10px] text-slate-400">
                  {providerStats?.sendgrid?.period
                    ? `Since ${new Date(providerStats.sendgrid.period + 'T00:00:00').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}`
                    : 'This month'}
                </p>
              </div>
            </div>
          </div>
          {providerLoading ? (
            <div className="grid grid-cols-5 gap-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : providerStats?.sendgrid?.error ? (
            <p className="text-sm font-semibold text-red-500">{providerStats.sendgrid.error}</p>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Sent',      value: providerStats?.sendgrid?.requests,  color: 'bg-slate-50 text-slate-700' },
                { label: 'Delivered', value: providerStats?.sendgrid?.delivered, color: 'bg-emerald-50 text-emerald-700' },
                { label: 'Bounced',   value: providerStats?.sendgrid?.bounces,   color: 'bg-red-50 text-red-600' },
                { label: 'Opens',     value: providerStats?.sendgrid?.opens,     color: 'bg-blue-50 text-blue-600' },
                { label: 'Clicks',    value: providerStats?.sendgrid?.clicks,    color: 'bg-purple-50 text-purple-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className={`flex flex-col items-center justify-center rounded-2xl py-3 text-center ${color}`}>
                  <span className="text-xl font-black">{value?.toLocaleString('en-ZA') ?? '—'}</span>
                  <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4 — Plan distribution + recent signups */}
      <div className="grid grid-cols-[1fr_1.6fr] gap-5">

        {/* Plan distribution */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Plan Distribution</p>
            <p className="mt-1 text-sm text-slate-500">
              Potential MRR: <strong className="text-primary">R{Object.entries(byPlan)
                .filter(([k]) => PLAN_META[k])
                .reduce((s, [k, v]) => s + PLAN_META[k].price * v, 0).toLocaleString('en-ZA')}
              </strong>
            </p>
          </div>
          {Object.entries(PLAN_META).map(([key, meta]) => {
            const count = byPlan[key] ?? 0
            const pct   = users.length > 0 ? Math.round((count / users.length) * 100) : 0
            return (
              <div key={key}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>{meta.label}</span>
                    <span className="text-xs text-slate-400">R{meta.price.toLocaleString('en-ZA')}/mo</span>
                  </div>
                  <span className="text-xs font-bold text-slate-700">{count} user{count !== 1 ? 's' : ''}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
          {suspended > 0 && (
            <div className="mt-2 flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              <Ban size={12} /> {suspended} suspended account{suspended !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Recent signups */}
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Recent Registrations</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-slate-300" />
            </div>
          ) : users.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-slate-400">No users yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {users.slice(0, 8).map(u => {
                const st   = getStatus(u)
                const meta = INDUSTRY_META[u.industry]
                return (
                  <div key={u.id} className="flex items-center gap-3 px-6 py-3.5 hover:bg-slate-50/80 transition">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${meta?.color ?? 'bg-slate-100 text-slate-500'}`}>
                      {meta ? <meta.Icon size={15} /> : <Users size={15} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{u.name || u.businessName || u.email}</p>
                      <p className="truncate text-[11px] text-slate-400">
                        {u.email} · {u.createdAt?.toDate?.()?.toLocaleDateString('en-ZA') ?? '—'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {u.plan && <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${PLAN_META[u.plan]?.color ?? 'bg-slate-100 text-slate-600'}`}>{PLAN_META[u.plan]?.label ?? u.plan}</span>}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_BADGE[st] ?? STATUS_BADGE.pending}`}>{st}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── User Detail ───────────────────────────────────────────────────────────────
function UserDetail({ user: u, onBack, onUpdate }) {
  const [stats,    setStats]   = useState(null)
  const [loading,  setLoading] = useState(true)
  const [busy,     setBusy]    = useState(false)
  const [toast,    setToast]   = useState('')

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 4000) }

  // ── Load subcollection stats ───────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const ind = u.industry
        const base = `users/${u.id}`

        // Always count
        const always = ['campaigns', 'appointments', 'messages', 'surveys']
        const industryExtra = {
          b2b:      ['customers', 'invoices'],
          medical:  ['patients', 'consultations'],
          property: ['tenants', 'properties', 'invoices', 'maintenance'],
          retail:   ['customers', 'deals'],
        }
        const cols = [...always, ...(industryExtra[ind] ?? [])]

        const results = {}
        await Promise.all(cols.map(async col => {
          try {
            const snap = await getCountFromServer(collection(db, base, col))
            results[col] = snap.data().count
          } catch { results[col] = '—' }
        }))

        // SMS vs email breakdown from messages
        try {
          const smsSnap   = await getCountFromServer(query(collection(db, base, 'messages'), where('type', '==', 'sms')))
          const emailSnap = await getCountFromServer(query(collection(db, base, 'messages'), where('type', '==', 'email')))
          results.smsSent   = smsSnap.data().count
          results.emailSent = emailSnap.data().count
        } catch {
          results.smsSent   = '—'
          results.emailSent = '—'
        }

        setStats(results)
      } finally { setLoading(false) }
    }
    load()
  }, [u.id, u.industry])

  // ── Actions ────────────────────────────────────────────────────────────────
  async function run(fn) {
    setBusy(true)
    try { await fn() } catch (e) { showToast('Error: ' + e.message) }
    finally { setBusy(false) }
  }

  async function publish()    { await run(async () => { await updateDoc(doc(db,'users',u.id), { isActive: true,  status: 'active'    }); onUpdate(u.id, { isActive: true,  status: 'active'    }); try { await httpsCallable(functions,'sendActivationEmail')({ uid: u.id }) } catch {} showToast(`${u.name||u.email} published — activation email sent.`) }) }
  async function pause()      { await run(async () => { await updateDoc(doc(db,'users',u.id), { isActive: false, status: 'paused'    }); onUpdate(u.id, { isActive: false, status: 'paused'    }); showToast(`${u.name||u.email} paused.`) }) }
  async function suspend()    { if (!window.confirm(`Suspend ${u.name||u.email}?`)) return; await run(async () => { await updateDoc(doc(db,'users',u.id), { isActive: false, status: 'suspended' }); onUpdate(u.id, { isActive: false, status: 'suspended' }); showToast(`${u.name||u.email} suspended.`) }) }
  async function markPaid()   { await run(async () => { const paidAt = new Date().toISOString(); await updateDoc(doc(db,'users',u.id), { isPaid: true, paidAt }); onUpdate(u.id, { isPaid: true, paidAt }); showToast('Marked as paid.') }) }
  async function markUnpaid() { await run(async () => { await updateDoc(doc(db,'users',u.id), { isPaid: false, paidAt: null }); onUpdate(u.id, { isPaid: false, paidAt: null }); showToast('Marked as unpaid.') }) }
  async function deleteAcc()  {
    if (!window.confirm(`Delete ${u.name||u.email} permanently? This cannot be undone.`)) return
    await run(async () => {
      const result = await httpsCallable(functions,'deleteUserAccount')({ uid: u.id })
      if (!result.data?.success) throw new Error(result.data?.error || 'Delete failed')
      onUpdate(u.id, null)  // null = remove
      onBack()
    })
  }

  const st     = getStatus(u)
  const plan   = PLAN_META[u.plan]
  const quota  = plan?.quota ?? 1000
  const smsPct = typeof stats?.smsSent === 'number' ? Math.min(100, Math.round((stats.smsSent / quota) * 100)) : 0
  const indMeta = INDUSTRY_META[u.industry]

  function Row({ label, value }) {
    return (
      <div className="flex items-start justify-between gap-4 border-b border-slate-50 py-2.5 last:border-0">
        <span className="shrink-0 text-xs font-semibold text-slate-400">{label}</span>
        <span className="text-right text-xs font-medium text-slate-700 break-all">{value || '—'}</span>
      </div>
    )
  }

  function StatPill({ label, value, color = 'bg-slate-50 text-slate-700', sub }) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-2xl p-4 text-center ${color}`}>
        <span className="text-2xl font-black">{value ?? '—'}</span>
        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
        {sub && <span className="mt-0.5 text-[10px] opacity-60">{sub}</span>}
      </div>
    )
  }

  return (
    <div className="-mx-6 -mt-6 flex min-h-[calc(100vh-4rem)] flex-col bg-slate-50/50">

      {/* Top bar */}
      <div className="shrink-0 border-b border-slate-200/60 bg-white px-8 py-5">
        <div className="flex items-center gap-4">
          <button onClick={onBack}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary hover:text-primary">
            <ArrowLeft size={15} /> All Users
          </button>
          <div className="flex flex-1 items-center gap-3 min-w-0">
            {indMeta && (
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${indMeta.color}`}>
                <indMeta.Icon size={18} />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-slate-800">{u.name || u.businessName || u.email}</p>
              <p className="text-xs text-slate-400">{u.email}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${STATUS_BADGE[st] ?? STATUS_BADGE.pending}`}>{st}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${u.isPaid ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
              {u.isPaid ? '✓ Paid' : 'Unpaid'}
            </span>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mx-8 mt-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-700">
          {toast}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8 space-y-6">

          {/* Top row: Profile + Subscription + Actions */}
          <div className="grid grid-cols-3 gap-5">

            {/* Profile */}
            <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-1">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Profile</p>
              <Row label="Name"       value={u.name} />
              <Row label="Email"      value={u.email} />
              <Row label="Phone"      value={u.phone} />
              <Row label="Industry"   value={u.industry} />
              <Row label="Profession" value={u.profession} />
              <Row label="Registered" value={u.createdAt?.toDate?.()?.toLocaleDateString('en-ZA')} />
              <Row label="UID"        value={<span className="font-mono text-[10px]">{u.id}</span>} />
            </div>

            {/* Business */}
            <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-1">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Business</p>
              <Row label="Business name"  value={u.businessName} />
              <Row label="Address"        value={u.address} />
              <Row label="VAT number"     value={u.vatNumber} />
              <Row label="Banking"        value={u.bankingDetails ? `${u.bankingDetails.bank || ''} ${u.bankingDetails.accountNumber || ''}`.trim() : '—'} />
              <Row label="Website"        value={u.website} />
              <Row label="Profile photo"  value={u.profilePhotoUrl ? 'Uploaded' : 'None'} />
              <Row label="Logo"           value={u.businessLogoUrl ? 'Uploaded' : 'None'} />
            </div>

            {/* Subscription & Actions */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-1">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Subscription</p>
                <Row label="Plan"       value={plan ? <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${plan.color}`}>{plan.label}</span> : (u.plan || '—')} />
                <Row label="Price"      value={plan ? `R${plan.price.toLocaleString('en-ZA')}/mo` : '—'} />
                <Row label="SMS quota"  value={plan ? `${plan.quota.toLocaleString('en-ZA')} / mo` : '—'} />
                <Row label="Paid on"    value={u.paidAt ? new Date(u.paidAt).toLocaleDateString('en-ZA') : '—'} />
                <Row label="POPIA"      value={u.popiaConsent ? '✓ Consented' : 'Not consented'} />
              </div>

              {/* Actions */}
              <div className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {st !== 'active' && (
                    <button onClick={publish} disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-2xl bg-green-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50 transition">
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Publish
                    </button>
                  )}
                  {st === 'active' && (
                    <button onClick={pause} disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-2xl bg-blue-500 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-600 disabled:opacity-50 transition">
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <PauseCircle size={12} />} Pause
                    </button>
                  )}
                  {!u.isPaid
                    ? <button onClick={markPaid} disabled={busy}
                        className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition">
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <BadgeCheck size={12} />} Mark Paid
                      </button>
                    : <button onClick={markUnpaid} disabled={busy}
                        className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 hover:border-primary disabled:opacity-50 transition">
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <BadgeX size={12} />} Mark Unpaid
                      </button>
                  }
                  {st !== 'suspended' && (
                    <button onClick={suspend} disabled={busy}
                      className="flex items-center justify-center gap-1.5 rounded-2xl bg-orange-500 px-3 py-2.5 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50 transition">
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />} Suspend
                    </button>
                  )}
                  <button onClick={deleteAcc}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-red-500 px-3 py-2.5 text-xs font-bold text-white hover:bg-red-600 transition col-span-2">
                    <Trash2 size={12} /> Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Usage stats */}
          <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Usage Statistics</p>
                <p className="mt-0.5 text-xs text-slate-400">All-time data from user's Firestore subcollections</p>
              </div>
              {loading && <Loader2 size={16} className="animate-spin text-slate-300" />}
            </div>

            {loading ? (
              <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {/* SMS / email quota */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone size={14} className="text-blue-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">SMS Usage</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {typeof stats?.smsSent === 'number' ? stats.smsSent : '—'} / {quota.toLocaleString('en-ZA')} quota
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-white border border-slate-200">
                      <div className={`h-full rounded-full transition-all ${smsPct > 90 ? 'bg-red-500' : smsPct > 70 ? 'bg-amber-500' : 'bg-primary'}`}
                        style={{ width: `${smsPct}%` }} />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                      <span>{smsPct}% used</span>
                      <span className={smsPct > 90 ? 'font-bold text-red-500' : 'text-slate-400'}>
                        {typeof stats?.smsSent === 'number' ? Math.max(0, quota - stats.smsSent).toLocaleString('en-ZA') + ' remaining' : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <AtSign size={14} className="text-emerald-500" />
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Email Usage</span>
                    </div>
                    <p className="text-3xl font-black text-slate-800">
                      {typeof stats?.emailSent === 'number' ? stats.emailSent.toLocaleString('en-ZA') : '—'}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">emails sent all-time</p>
                  </div>
                </div>

                {/* Data counts */}
                <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">
                  {[
                    { key: 'campaigns',    label: 'Campaigns',    color: 'bg-primary/5 text-primary'          },
                    { key: 'appointments', label: 'Appointments', color: 'bg-blue-50 text-blue-600'           },
                    { key: 'messages',     label: 'Messages',     color: 'bg-slate-50 text-slate-600'         },
                    { key: 'surveys',      label: 'Surveys',      color: 'bg-purple-50 text-purple-600'       },
                    { key: u.industry === 'medical' ? 'patients' : u.industry === 'property' ? 'tenants' : 'customers',
                      label: u.industry === 'medical' ? 'Patients' : u.industry === 'property' ? 'Tenants' : 'Customers',
                      color: 'bg-amber-50 text-amber-600' },
                    ...(u.industry === 'medical'  ? [{ key: 'consultations', label: 'Consult.', color: 'bg-red-50 text-red-600' }] : []),
                    ...(u.industry === 'property' ? [{ key: 'properties',    label: 'Properties', color: 'bg-amber-50 text-amber-600' }] : []),
                    ...(u.industry === 'property' ? [{ key: 'maintenance',   label: 'Maintenance', color: 'bg-orange-50 text-orange-600' }] : []),
                    ...(u.industry !== 'medical' && u.industry !== 'retail' ? [{ key: 'invoices', label: 'Invoices', color: 'bg-green-50 text-green-600' }] : []),
                    ...(u.industry === 'retail'   ? [{ key: 'deals',         label: 'Deals',    color: 'bg-pink-50 text-pink-600' }] : []),
                  ].map(({ key, label, color }) => (
                    <div key={key} className={`flex flex-col items-center justify-center rounded-2xl p-3 text-center ${color}`}>
                      <span className="text-2xl font-black">{stats?.[key] ?? '—'}</span>
                      <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── All Users ─────────────────────────────────────────────────────────────────
function AllUsers() {
  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [detail,    setDetail]    = useState(null) // user object or null
  const [filter,    setFilter]    = useState({ industry: '', status: '', paid: '', search: '' })
  const [toast,     setToast]     = useState('')
  const [busy,      setBusy]      = useState(null)

  useEffect(() => {
    getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))
      .then(snap => { setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 4000) }

  function patchUser(uid, patch) {
    setUsers(prev => patch === null
      ? prev.filter(u => u.id !== uid)
      : prev.map(u => u.id === uid ? { ...u, ...patch } : u)
    )
    setDetail(v => v?.id === uid ? (patch === null ? null : { ...v, ...patch }) : v)
  }

  async function quickPublish(u, e) {
    e.stopPropagation()
    setBusy(u.id)
    try {
      await updateDoc(doc(db, 'users', u.id), { isActive: true, status: 'active' })
      patchUser(u.id, { isActive: true, status: 'active' })
      try { await httpsCallable(functions, 'sendActivationEmail')({ uid: u.id }) } catch {}
      showToast(`${u.name || u.email} published.`)
    } catch (e) { showToast('Error: ' + e.message) }
    finally { setBusy(null) }
  }

  const filtered = users.filter(u => {
    if (filter.industry && u.industry !== filter.industry) return false
    if (filter.status && getStatus(u) !== filter.status) return false
    if (filter.paid === 'paid' && !u.isPaid) return false
    if (filter.paid === 'unpaid' && u.isPaid) return false
    if (filter.search) {
      const q = filter.search.toLowerCase()
      if (!u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q) && !u.businessName?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const cols = [
    {
      key: 'name', label: 'User',
      render: r => {
        const meta = INDUSTRY_META[r.industry]
        return (
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${meta?.color ?? 'bg-slate-100 text-slate-400'}`}>
              {meta ? <meta.Icon size={14} /> : <Users size={14} />}
            </span>
            <div>
              <p className="font-semibold text-slate-800">{r.name || r.businessName || '—'}</p>
              <p className="text-xs text-slate-400">{r.email}</p>
            </div>
          </div>
        )
      }
    },
    {
      key: 'industry', label: 'Industry',
      render: r => <span className="capitalize text-sm text-slate-600">{r.industry ?? '—'}</span>
    },
    {
      key: 'plan', label: 'Plan',
      render: r => {
        const p = PLAN_META[r.plan]
        return p
          ? <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${p.color}`}>{p.label}</span>
          : <span className="text-xs text-slate-400">{r.plan || '—'}</span>
      }
    },
    {
      key: 'isPaid', label: 'Payment',
      render: r => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.isPaid ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          {r.isPaid ? '✓ Paid' : 'Unpaid'}
        </span>
      )
    },
    {
      key: 'status', label: 'Status',
      render: r => {
        const st = getStatus(r)
        return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[st] ?? STATUS_BADGE.pending}`}>{st}</span>
      }
    },
    {
      key: 'createdAt', label: 'Registered',
      render: r => <span className="text-xs text-slate-400">{r.createdAt?.toDate?.()?.toLocaleDateString('en-ZA') ?? '—'}</span>
    },
    {
      key: 'actions', label: '', sortable: false,
      render: r => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          {getStatus(r) !== 'active' && (
            <button onClick={e => quickPublish(r, e)} disabled={busy === r.id}
              className="rounded-xl p-1.5 text-green-600 hover:bg-green-50" title="Publish">
              {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); setDetail(r) }}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
            View <ChevronRight size={12} />
          </button>
        </div>
      )
    },
  ]

  // ── Detail view ────────────────────────────────────────────────────────────
  if (detail) {
    return (
      <UserDetail
        user={detail}
        onBack={() => setDetail(null)}
        onUpdate={(uid, patch) => {
          patchUser(uid, patch)
          if (patch === null) setDetail(null)
          else setDetail(v => v?.id === uid ? { ...v, ...patch } : v)
        }}
      />
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">All Users</h2>
          <p className="mt-1 text-sm text-slate-400">{filtered.length} of {users.length} users</p>
        </div>
      </div>

      {toast && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-700">{toast}</div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input placeholder="Search name, email, business…" value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
          className="w-60 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        <select value={filter.industry} onChange={e => setFilter(f => ({ ...f, industry: e.target.value }))}
          className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary">
          <option value="">All industries</option>
          {['b2b','medical','property','retail'].map(i => <option key={i} value={i} className="capitalize">{i}</option>)}
        </select>
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="suspended">Suspended</option>
        </select>
        <select value={filter.paid} onChange={e => setFilter(f => ({ ...f, paid: e.target.value }))}
          className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary">
          <option value="">All payments</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
        {loading
          ? <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin text-slate-300" /></div>
          : <DataTable columns={cols} data={filtered} emptyMessage="No users found." onRowClick={u => setDetail(u)} />
        }
      </div>
    </div>
  )
}

// ── Admin Messages ────────────────────────────────────────────────────────────
function AdminMessages() {
  const [form, setForm] = useState({ to: '', subject: '', body: '' })
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function send() {
    if (!form.to || !form.body) return
    setBusy(true)
    try {
      await httpsCallable(functions, 'sendEmail')({ to: form.to, subject: form.subject, htmlBody: form.body })
      setSent(true); setTimeout(() => setSent(false), 4000)
      setForm({ to: '', subject: '', body: '' })
    } catch (e) { alert('Failed: ' + e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Send Message</h2>
        <p className="mt-1 text-sm text-slate-400">Send a direct email to any platform user</p>
      </div>

      {sent && (
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-700">
          <CheckCircle size={16} /> Message sent successfully
        </div>
      )}

      <div className="max-w-lg rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">Recipient email</span>
          <input value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
            placeholder="user@example.com"
            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">Subject</span>
          <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            placeholder="Subject line"
            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">Message body</span>
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={6}
            placeholder="Write your message here…"
            className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </label>
        <button onClick={send} disabled={busy || !form.to || !form.body}
          className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#4e7d6d] disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Send Email
        </button>
      </div>
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────
const SETTINGS_REF = () => doc(db, 'superadmin', 'settings')
const BLANK_BANKING = { accountName: 'Tlhiso (Pty) Ltd', bank: 'First National Bank (FNB)', account: '123456789', branch: '250655', type: 'Cheque' }

function AdminSettings() {
  const [banking,    setBanking]    = useState(BLANK_BANKING)
  const [bankSaving, setBankSaving] = useState(false)
  const [bankSaved,  setBankSaved]  = useState(false)

  useEffect(() => {
    getDoc(SETTINGS_REF()).then(snap => {
      if (snap.exists() && snap.data().banking) setBanking(snap.data().banking)
    })
  }, [])

  async function saveBanking() {
    setBankSaving(true)
    try {
      await setDoc(SETTINGS_REF(), { banking }, { merge: true })
      setBankSaved(true)
      setTimeout(() => setBankSaved(false), 3000)
    } catch (e) { alert('Save failed: ' + e.message) }
    finally { setBankSaving(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Platform Settings</h2>
        <p className="mt-1 text-sm text-slate-400">Platform configuration and resource links</p>
      </div>

      {/* Banking details */}
      <div className="max-w-lg rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">EFT Banking Details</p>
        <p className="text-xs text-slate-500">Used in the invoice email sent to users on the checkout page.</p>
        {[
          ['accountName', 'Account name'],
          ['bank',        'Bank'],
          ['account',     'Account number'],
          ['branch',      'Branch code'],
          ['type',        'Account type'],
        ].map(([field, label]) => (
          <label key={field} className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">{label}</span>
            <input
              value={banking[field]}
              onChange={e => setBanking(b => ({ ...b, [field]: e.target.value }))}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>
        ))}
        {bankSaved && (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700">
            <CheckCircle size={14} /> Banking details saved
          </div>
        )}
        <button onClick={saveBanking} disabled={bankSaving}
          className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#4e7d6d] disabled:opacity-50">
          {bankSaving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Save Banking Details'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-5 max-w-3xl">
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Platform Info</p>
          {[
            ['App name',    'Tlhiso'],
            ['Tagline',     'Run Your Business. Smarter.'],
            ['Contact',     'hello@tlhiso.com'],
            ['Target',      'South African SMEs'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-slate-50 pb-2.5 last:border-0">
              <span className="text-xs font-semibold text-slate-400">{k}</span>
              <span className="text-xs font-medium text-slate-700">{v}</span>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Quick Links</p>
          {[
            ['Production', 'https://tlhiso.com'],
            ['Staging',    'https://tlhiso-staging.web.app'],
            ['Firebase',   'https://console.firebase.google.com/project/tlhiso'],
            ['GitHub',     'https://github.com/adobeing'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-slate-50 pb-2.5 last:border-0">
              <span className="text-xs font-semibold text-slate-400">{k}</span>
              <a href={v} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline">{v}</a>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3 col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Pricing Plans</p>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(PLAN_META).map(([key, p]) => (
              <div key={key} className="rounded-2xl border border-slate-100 p-4">
                <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${p.color}`}>{p.label}</span>
                <p className="mt-2 text-xl font-black text-slate-900">R{p.price.toLocaleString('en-ZA')}<span className="text-xs font-normal text-slate-400">/mo</span></p>
                <p className="mt-1 text-xs text-slate-400">{p.quota.toLocaleString('en-ZA')} campaign messages/mo</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Admin Notifications ───────────────────────────────────────────────────────
function AdminNotifications() {
  const [form, setForm]   = useState({ title: '', body: '', targetIndustry: 'all' })
  const [history, setHistory] = useState([])
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)

  useEffect(() => {
    return onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc')), snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  async function send() {
    if (!form.title.trim() || !form.body.trim()) return
    setSending(true)
    try {
      await addDoc(collection(db, 'notifications'), {
        ...form,
        readBy: [],
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        sentBy: 'superadmin',
      })
      setSent(true)
      setForm({ title: '', body: '', targetIndustry: 'all' })
      setTimeout(() => setSent(false), 3000)
    } catch (e) { alert('Failed: ' + e.message) }
    finally { setSending(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Send Notification</h2>
        <p className="mt-1 text-sm text-slate-400">Broadcast a message to users — appears instantly in their notification bell.</p>
      </div>

      {sent && (
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-700">
          <CheckCircle size={16} /> Notification sent successfully
        </div>
      )}

      <div className="max-w-lg rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">Title</span>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Platform maintenance scheduled"
            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">Message</span>
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4}
            placeholder="Full notification message…"
            className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">Target audience</span>
          <select value={form.targetIndustry} onChange={e => setForm(f => ({ ...f, targetIndustry: e.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
            <option value="all">All users</option>
            <option value="b2b">B2B only</option>
            <option value="medical">Medical only</option>
            <option value="property">Property only</option>
            <option value="retail">Retail only</option>
          </select>
        </label>
        <button onClick={send} disabled={sending || !form.title.trim() || !form.body.trim()}
          className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#4e7d6d] disabled:cursor-not-allowed disabled:opacity-40">
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
          Send Notification
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-800">Sent History</h3>
        </div>
        {history.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No notifications sent yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {history.map(n => {
              const expired = n.expiresAt && (n.expiresAt.toDate?.() ?? new Date(n.expiresAt)) < new Date()
              return (
                <div key={n.id} className={`flex items-start gap-4 px-6 py-4 ${expired ? 'opacity-50' : ''}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                    <Bell size={15} className="text-primary" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{n.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 capitalize">{n.targetIndustry || 'all'}</span>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {expired ? 'Expired' : `Expires ${n.expiresAt?.toDate?.()?.toLocaleDateString('en-ZA') ?? '—'}`}
                    </p>
                    <p className="text-[10px] text-slate-400">{(n.readBy || []).length} read</p>
                    <button onClick={() => deleteDoc(doc(db, 'notifications', n.id))}
                      className="ml-auto mt-1.5 flex items-center gap-1 rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500 transition hover:bg-red-100">
                      <Trash2 size={10} /> Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Admin Support ─────────────────────────────────────────────────────────────
function AdminSupport() {
  const [messages, setMessages] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    return onSnapshot(query(collection(db, 'support_messages'), orderBy('createdAt', 'desc')), snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
  }, [])

  async function markClosed(id) {
    await updateDoc(doc(db, 'support_messages', id), { status: 'closed' })
    setExpanded(null)
  }

  const open   = messages.filter(m => m.status !== 'closed')
  const closed = messages.filter(m => m.status === 'closed')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Support Messages</h2>
        <p className="mt-1 text-sm text-slate-400">In-app queries from users. You are notified by SMS and email on each submission.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
      ) : messages.length === 0 ? (
        <div className="rounded-3xl border border-slate-200/60 bg-white p-12 text-center shadow-sm">
          <MessageSquare size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No support messages yet</p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
                <h3 className="text-base font-bold text-slate-800">Open</h3>
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600">{open.length}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {open.map(m => {
                  const meta = INDUSTRY_META[m.fromIndustry]
                  return (
                    <div key={m.id} className="px-6 py-4">
                      <div className="flex cursor-pointer items-start gap-3" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${meta?.color ?? 'bg-slate-100 text-slate-500'}`}>
                          {meta ? <meta.Icon size={14} /> : <Users size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800">{m.fromName}</p>
                          <p className="text-xs text-slate-400">{m.fromEmail} · <span className="capitalize">{m.fromIndustry}</span></p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">{m.message}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] text-slate-400">{m.createdAt?.toDate?.()?.toLocaleDateString('en-ZA') ?? '—'}</p>
                          <ChevronRight size={14} className={`ml-auto mt-1 text-slate-400 transition-transform ${expanded === m.id ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                      {expanded === m.id && (
                        <div className="ml-12 mt-3 space-y-3">
                          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">{m.message}</div>
                          <div className="flex gap-2">
                            <a href={`mailto:${m.fromEmail}?subject=Re: Your Tlhiso support query`}
                              className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/20">
                              <Mail size={12} /> Reply by email
                            </a>
                            <button onClick={() => markClosed(m.id)}
                              className="flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 transition hover:bg-green-100">
                              <CheckCircle size={12} /> Mark resolved
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {closed.length > 0 && (
            <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-100 px-6 py-4">
                <h3 className="text-base font-bold text-slate-400">Resolved ({closed.length})</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {closed.slice(0, 10).map(m => {
                  const meta = INDUSTRY_META[m.fromIndustry]
                  return (
                    <div key={m.id} className="flex items-center gap-3 px-6 py-3.5 opacity-60">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${meta?.color ?? 'bg-slate-100 text-slate-500'}`}>
                        {meta ? <meta.Icon size={13} /> : <Users size={13} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{m.fromName}</p>
                        <p className="truncate text-xs text-slate-400">{m.message}</p>
                      </div>
                      <CheckCircle size={14} className="shrink-0 text-green-500" />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Admin Campaigns ───────────────────────────────────────────────────────────
const CAMPAIGN_TEMPLATES = {
  onboarding: {
    label: 'Onboarding Campaign',
    subject: 'Welcome to Tlhiso — Here\'s How to Get Started',
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:#5B8E7D;padding:32px 24px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:white;margin:0;font-size:24px">Welcome to Tlhiso!</h1>
  </div>
  <div style="background:#f8fafc;padding:32px 24px;border-radius:0 0 12px 12px">
    <p style="font-size:16px">Hi there,</p>
    <p>We're thrilled to have you on board. Tlhiso is built to help South African SMEs manage their business and grow through direct marketing.</p>
    <p><strong>Here's how to get started in 3 steps:</strong></p>
    <ol style="line-height:2">
      <li>Complete your <strong>Business Profile</strong> so your customers know who you are</li>
      <li>Import your <strong>contacts</strong> (clients, patients, or tenants) into the platform</li>
      <li>Send your first <strong>Campaign</strong> — SMS, email, or WhatsApp</li>
    </ol>
    <div style="text-align:center;margin:32px 0">
      <a href="https://tlhiso.com/login" style="background:#5B8E7D;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">Log in to Tlhiso</a>
    </div>
    <p style="color:#64748b;font-size:14px">Need help? Reply to this email or reach us at <a href="mailto:hello@tlhiso.com" style="color:#5B8E7D">hello@tlhiso.com</a></p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="color:#94a3b8;font-size:12px;text-align:center">Tlhiso · 9 Lemonthorn, Kosmosdal, Centurion, Gauteng · <a href="https://tlhiso.com" style="color:#94a3b8">tlhiso.com</a></p>
  </div>
</div>`,
  },
  newsletter: {
    label: 'Monthly Newsletter',
    subject: `Tlhiso Newsletter — ${new Date().toLocaleString('en-ZA', { month: 'long', year: 'numeric' })}`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
  <div style="background:#5B8E7D;padding:32px 24px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:white;margin:0;font-size:22px">Tlhiso Monthly Newsletter</h1>
    <p style="color:#d1fae5;margin:8px 0 0">${new Date().toLocaleString('en-ZA', { month: 'long', year: 'numeric' })}</p>
  </div>
  <div style="background:#f8fafc;padding:32px 24px;border-radius:0 0 12px 12px">
    <p style="font-size:16px">Hi there,</p>
    <p>Here are your growth tips for this month to help you get more clients and grow revenue through direct marketing.</p>

    <h2 style="color:#5B8E7D;font-size:18px;border-bottom:2px solid #e2e8f0;padding-bottom:8px">💡 Tip of the Month</h2>
    <p><strong>Follow up with contacts who haven't heard from you in 30+ days.</strong> A simple "We miss you" SMS or email can re-activate dormant customers. Use the Campaigns tab in your Tlhiso dashboard to send a targeted re-engagement message today.</p>

    <h2 style="color:#5B8E7D;font-size:18px;border-bottom:2px solid #e2e8f0;padding-bottom:8px">📣 What's New on Tlhiso</h2>
    <p>[Add your platform updates, new features, or announcements here.]</p>

    <h2 style="color:#5B8E7D;font-size:18px;border-bottom:2px solid #e2e8f0;padding-bottom:8px">🚀 This Month's Challenge</h2>
    <p>Send at least <strong>one campaign</strong> to your contacts this month. Businesses that communicate regularly with their clients grow up to 3x faster. Log in and send yours today.</p>

    <div style="text-align:center;margin:32px 0">
      <a href="https://tlhiso.com/login" style="background:#5B8E7D;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">Send a Campaign Now</a>
    </div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="color:#94a3b8;font-size:12px;text-align:center">Tlhiso · 9 Lemonthorn, Kosmosdal, Centurion, Gauteng · <a href="https://tlhiso.com" style="color:#94a3b8">tlhiso.com</a><br>You are receiving this because you have a Tlhiso account.</p>
  </div>
</div>`,
  },
  custom: { label: 'Custom Email', subject: '', html: '' },
}

const AUDIENCE_OPTIONS = [
  { value: 'all',      label: 'All Active Users' },
  { value: 'b2b',      label: 'B2B Users Only' },
  { value: 'medical',  label: 'Medical Users Only' },
  { value: 'property', label: 'Property Users Only' },
  { value: 'retail',   label: 'Retail Users Only' },
]

function AdminCampaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [composing, setComposing] = useState(false)
  const [template,  setTemplate]  = useState('onboarding')
  const [subject,   setSubject]   = useState(CAMPAIGN_TEMPLATES.onboarding.subject)
  const [htmlBody,  setHtmlBody]  = useState(CAMPAIGN_TEMPLATES.onboarding.html)
  const [audience,  setAudience]  = useState('all')
  const [preview,   setPreview]   = useState(false)
  const [sending,   setSending]   = useState(false)
  const [sendResult, setSendResult] = useState(null)

  useEffect(() => {
    const col = collection(db, 'superadmin', 'data', 'campaigns')
    const q   = query(col, orderBy('sentAt', 'desc'))
    return onSnapshot(q,
      snap => { setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) },
      err  => { console.error('campaigns onSnapshot:', err); setLoading(false) }
    )
  }, [])

  function pickTemplate(key) {
    setTemplate(key)
    const t = CAMPAIGN_TEMPLATES[key]
    setSubject(t.subject)
    setHtmlBody(t.html)
  }

  async function send() {
    if (!subject.trim() || !htmlBody.trim()) return
    setSending(true)
    setSendResult(null)
    try {
      const fn  = httpsCallable(functions, 'sendAdminCampaign')
      const res = await fn({ subject, htmlBody, audience })
      setSendResult({ ok: true, count: res.data.sentCount })
      setComposing(false)
    } catch (e) {
      setSendResult({ ok: false, msg: e.message })
    } finally {
      setSending(false)
    }
  }

  const audienceLabel = v => AUDIENCE_OPTIONS.find(o => o.value === v)?.label || v

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Campaigns</h1>
          <p className="text-slate-500 text-sm mt-1">Send marketing emails to your platform users</p>
        </div>
        <button
          onClick={() => { setComposing(true); setSendResult(null) }}
          className="flex items-center gap-2 bg-[#5B8E7D] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#4a7a6b] transition-colors"
        >
          <Send size={16} /> New Campaign
        </button>
      </div>

      {sendResult && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${sendResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {sendResult.ok ? `Campaign sent successfully to ${sendResult.count} user${sendResult.count !== 1 ? 's' : ''}.` : `Error: ${sendResult.msg}`}
        </div>
      )}

      {/* Campaign history */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="animate-spin text-slate-400" size={28} /></div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Mail size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No campaigns sent yet</p>
          <p className="text-sm mt-1">Create your first campaign to reach your users</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 truncate">{c.subject}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  {audienceLabel(c.audience)} · {c.sentCount} recipient{c.sentCount !== 1 ? 's' : ''}
                  {c.sentAt?.toDate && ` · ${c.sentAt.toDate().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </p>
              </div>
              <span className="shrink-0 bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full capitalize">{c.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Compose modal */}
      <Modal open={composing} onClose={() => !sending && setComposing(false)} title="New Campaign">
        <div className="space-y-4 p-1">
          {/* Template picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Template</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(CAMPAIGN_TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => pickTemplate(key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${template === key ? 'bg-[#5B8E7D] text-white border-[#5B8E7D]' : 'border-slate-200 text-slate-600 hover:border-[#5B8E7D]'}`}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {/* Audience */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Audience</label>
            <select
              value={audience}
              onChange={e => setAudience(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5B8E7D]"
            >
              {AUDIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject line</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5B8E7D]"
              placeholder="Email subject..."
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">Email body (HTML)</label>
              <button onClick={() => setPreview(p => !p)} className="text-xs text-[#5B8E7D] font-medium hover:underline">
                {preview ? 'Edit HTML' : 'Preview'}
              </button>
            </div>
            {preview ? (
              <div className="border border-slate-200 rounded-lg p-4 max-h-72 overflow-y-auto bg-white" dangerouslySetInnerHTML={{ __html: htmlBody }} />
            ) : (
              <textarea
                value={htmlBody}
                onChange={e => setHtmlBody(e.target.value)}
                rows={10}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#5B8E7D] resize-y"
                placeholder="<p>Your email HTML here...</p>"
              />
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setComposing(false)} disabled={sending} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-40">Cancel</button>
            <button
              onClick={send}
              disabled={sending || !subject.trim() || !htmlBody.trim()}
              className="flex items-center gap-2 bg-[#5B8E7D] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#4a7a6b] disabled:opacity-50 transition-colors"
            >
              {sending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send Campaign</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Insights ──────────────────────────────────────────────────────────────────
function Insights() {
  const [engagement,   setEngagement]   = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [recomputing,  setRecomputing]  = useState(false)
  const [recomputeMsg, setRecomputeMsg] = useState(null)

  async function handleRecompute() {
    setRecomputing(true)
    setRecomputeMsg(null)
    try {
      const fn  = httpsCallable(functions, 'recomputeBenchmarks')
      const res = await fn()
      setRecomputeMsg({ ok: true, text: `Benchmarks updated — period ${res.data.period}` })
    } catch (e) {
      setRecomputeMsg({ ok: false, text: e.message || 'Recompute failed' })
    } finally {
      setRecomputing(false)
    }
  }

  const [reportLinks,   setReportLinks]   = useState({})
  const [generating,    setGenerating]    = useState(null)
  const [showSendModal, setShowSendModal] = useState(false)
  const [sending,       setSending]       = useState(false)
  const [sendResult,    setSendResult]    = useState(null)

  async function handleGenerate(type) {
    setGenerating(type)
    setSendResult(null)
    try {
      const fn  = httpsCallable(functions, 'generateMonthlyReport')
      const res = await fn({ type })
      if (res.data.success) {
        setReportLinks(prev => ({
          ...prev,
          [type]: { url: res.data.downloadUrl, period: res.data.period, recipientCount: res.data.recipientCount },
        }))
      } else {
        setSendResult({ success: false, error: res.data.error || 'Generation failed' })
      }
    } catch (e) {
      setSendResult({ success: false, error: e.message || 'Generation failed' })
    } finally {
      setGenerating(null)
    }
  }

  async function handleSendNewsletter() {
    setSending(true)
    try {
      const fn  = httpsCallable(functions, 'sendMonthlyNewsletter')
      const res = await fn({ period: reportLinks.newsletter.period, confirm: true })
      setSendResult(res.data)
      setShowSendModal(false)
    } catch (e) {
      setSendResult({ success: false, error: e.message || 'Send failed' })
      setShowSendModal(false)
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const snap     = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')))
        const allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        const active   = allUsers.filter(u => u.isActive)

        const results = await Promise.all(
          active.map(async u => {
            try {
              const [campSnap, msgSnap] = await Promise.all([
                getCountFromServer(collection(db, 'users', u.id, 'campaigns')),
                getCountFromServer(collection(db, 'users', u.id, 'messages')),
              ])
              return {
                id:        u.id,
                name:      u.name || u.businessName || u.email,
                email:     u.email,
                industry:  u.industry,
                plan:      u.plan,
                campaigns: campSnap.data().count,
                messages:  msgSnap.data().count,
                createdAt: u.createdAt,
                status:    getStatus(u),
              }
            } catch {
              return {
                id:        u.id,
                name:      u.name || u.businessName || u.email,
                email:     u.email,
                industry:  u.industry,
                plan:      u.plan,
                campaigns: 0,
                messages:  0,
                createdAt: u.createdAt,
                status:    getStatus(u),
              }
            }
          })
        )
        setEngagement(results)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalCampaigns  = engagement ? engagement.reduce((s, u) => s + u.campaigns, 0) : 0
  const totalMessages   = engagement ? engagement.reduce((s, u) => s + u.messages,  0) : 0
  const activeCount     = engagement ? engagement.length : 0
  const withCampaign    = engagement ? engagement.filter(u => u.campaigns >= 1).length : 0
  const avgCampaigns    = activeCount > 0 ? (totalCampaigns / activeCount).toFixed(1) : '—'
  const pctWithCampaign = activeCount > 0 ? Math.round((withCampaign / activeCount) * 100) : 0

  const byIndustry = ['b2b', 'medical', 'property', 'retail'].map(ind => ({
    name:      INDUSTRY_META[ind]?.label ?? ind,
    campaigns: engagement ? engagement.filter(u => u.industry === ind).reduce((s, u) => s + u.campaigns, 0) : 0,
  }))

  const byPlan = Object.entries(PLAN_META).map(([key, meta]) => {
    const pu  = engagement ? engagement.filter(u => u.plan === key) : []
    const avg = pu.length > 0 ? parseFloat((pu.reduce((s, u) => s + u.campaigns, 0) / pu.length).toFixed(1)) : 0
    return { key, label: meta.label, avg, color: meta.color }
  })
  const maxPlanAvg = Math.max(...byPlan.map(p => p.avg), 1)

  const underEngaged = engagement
    ? [...engagement].sort((a, b) => a.campaigns - b.campaigns).slice(0, 25)
    : []

  const SAGE = '#5B8E7D'

  const KPI = ({ label, value, sub, Icon, bg, textColor }) => (
    <div className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40">
      <div className="mb-5 flex items-start justify-between">
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-110 ${bg}`}>
          <Icon size={22} />
        </span>
      </div>
      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-4xl font-black tracking-tight ${textColor ?? 'text-slate-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs font-medium text-slate-400">{sub}</p>}
    </div>
  )

  const ueCols = [
    {
      key: 'name', label: 'Business / Name',
      render: r => {
        const meta = INDUSTRY_META[r.industry]
        return (
          <div className="flex items-center gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${meta?.color ?? 'bg-slate-100 text-slate-400'}`}>
              {meta ? <meta.Icon size={14} /> : <Users size={14} />}
            </span>
            <div>
              <p className="font-semibold text-slate-800">{r.name}</p>
              <p className="text-xs text-slate-400">{r.email}</p>
            </div>
          </div>
        )
      }
    },
    {
      key: 'industry', label: 'Industry',
      render: r => {
        const meta = INDUSTRY_META[r.industry]
        return meta
          ? <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${meta.color}`}>{meta.label}</span>
          : <span className="text-xs capitalize text-slate-400">{r.industry ?? '—'}</span>
      }
    },
    {
      key: 'plan', label: 'Plan',
      render: r => {
        const p = PLAN_META[r.plan]
        return p
          ? <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${p.color}`}>{p.label}</span>
          : <span className="text-xs text-slate-400">{r.plan || '—'}</span>
      }
    },
    {
      key: 'status', label: 'Status',
      render: r => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[r.status] ?? STATUS_BADGE.pending}`}>{r.status}</span>
      )
    },
    {
      key: 'campaigns', label: 'Campaigns',
      render: r => <span className="text-sm font-bold text-slate-700">{r.campaigns}</span>
    },
    {
      key: 'createdAt', label: 'Registered',
      render: r => <span className="text-xs text-slate-400">{r.createdAt?.toDate?.()?.toLocaleDateString('en-ZA') ?? '—'}</span>
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Platform Insights</h2>
          <p className="mt-1 text-sm font-medium text-slate-400">Engagement intelligence across all users · operator only</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {recomputing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {recomputing ? 'Recomputing…' : 'Recompute Benchmarks'}
          </button>
          {recomputeMsg && (
            <p className={`text-xs font-medium ${recomputeMsg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
              {recomputeMsg.text}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={20} className="animate-spin text-slate-300" />
        </div>
      ) : !engagement || engagement.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">No data yet.</p>
      ) : (
        <>
          {/* Engagement KPI row */}
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            <KPI label="Total Campaigns"       value={totalCampaigns.toLocaleString('en-ZA')} Icon={Megaphone}     bg="bg-primary/10 text-primary"       textColor="text-primary"      sub="All-time across active users" />
            <KPI label="Total Messages Sent"   value={totalMessages.toLocaleString('en-ZA')}  Icon={MessageSquare} bg="bg-blue-50 text-blue-600"          sub="SMS + email all-time"         />
            <KPI label="Avg Campaigns / User"  value={avgCampaigns}                           Icon={TrendingUp}    bg="bg-emerald-50 text-emerald-600"    textColor="text-emerald-700"  sub="Active users only"             />
            <KPI label="Have Sent ≥1 Campaign" value={`${pctWithCampaign}%`}                  Icon={Activity}      bg="bg-amber-50 text-amber-600"        textColor="text-amber-700"    sub={`${withCampaign} of ${activeCount} active users`} />
          </div>

          {/* Campaign by industry + plan breakdown */}
          <div className="grid grid-cols-[1.6fr_1fr] gap-5">
            <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Campaign Activity by Industry</p>
              <p className="mb-5 text-xs text-slate-400">Total campaigns per industry (all active users)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byIndustry} barSize={36}>
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: 'none' }}
                    cursor={{ fill: '#f8fafc' }}
                  />
                  <Bar dataKey="campaigns" radius={[6, 6, 0, 0]}>
                    {byIndustry.map((_, i) => <Cell key={i} fill={SAGE} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Avg Campaigns by Plan</p>
              <p className="mb-5 text-xs text-slate-400">Average campaigns per user per subscription tier</p>
              <div className="space-y-5">
                {byPlan.map(({ key, label, avg, color }) => {
                  const pct = Math.round((avg / maxPlanAvg) * 100)
                  return (
                    <div key={key}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${color}`}>{label}</span>
                        <span className="text-sm font-bold text-slate-700">{avg}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Under-engaged users */}
          <div>
            <div className="mb-4">
              <p className="text-base font-bold text-slate-800">Growth Opportunities</p>
              <p className="mt-0.5 text-sm text-slate-400">Lowest-campaign active users · sorted ascending · capped at 25</p>
            </div>
            <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
              <DataTable columns={ueCols} data={underEngaged} emptyMessage="No active users found." />
            </div>
          </div>
        </>
      )}

      {/* Monthly Report — generates from anonymised benchmark data only */}
      <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-base font-bold text-slate-800">Monthly Report</p>
          <p className="mt-0.5 text-sm text-slate-400">Generate branded PDFs from anonymised benchmark data · no individual user data included</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleGenerate('newsletter')}
            disabled={!!generating}
            className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {generating === 'newsletter' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Generate Newsletter PDF
          </button>
          <button
            onClick={() => handleGenerate('operator')}
            disabled={!!generating}
            className="flex items-center gap-2 rounded-2xl bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {generating === 'operator' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Generate Operator PDF
          </button>
          <button
            onClick={() => setShowSendModal(true)}
            disabled={!reportLinks.newsletter || !!generating}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
          >
            <Send size={14} />
            Send Newsletter to Users
          </button>
        </div>

        {(reportLinks.newsletter || reportLinks.operator) && (
          <div className="mt-4 flex flex-wrap gap-4">
            {reportLinks.newsletter && (
              <a href={reportLinks.newsletter.url} target="_blank" rel="noreferrer"
                 className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <FileText size={13} /> View Newsletter PDF ({reportLinks.newsletter.period})
              </a>
            )}
            {reportLinks.operator && (
              <a href={reportLinks.operator.url} target="_blank" rel="noreferrer"
                 className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:underline">
                <FileText size={13} /> View Operator PDF ({reportLinks.operator.period})
              </a>
            )}
          </div>
        )}

        {sendResult && (
          <p className={`mt-3 text-sm font-medium ${sendResult.success ? 'text-emerald-600' : 'text-red-500'}`}>
            {sendResult.success
              ? `Sent to ${sendResult.sentCount} users · ${sendResult.skippedOptOut} skipped (opted out)`
              : `Error: ${sendResult.error}`}
          </p>
        )}
      </div>

      <Modal
        open={showSendModal}
        onClose={() => !sending && setShowSendModal(false)}
        title="Send Newsletter to Users"
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">This will email all opted-in users</p>
            <p className="mt-1 text-sm text-amber-700">
              {reportLinks.newsletter?.recipientCount != null
                ? `${reportLinks.newsletter.recipientCount} opted-in active user${reportLinks.newsletter.recipientCount !== 1 ? 's' : ''} will receive the newsletter PDF.`
                : 'All opted-in active users will receive the newsletter PDF.'}
            </p>
          </div>
          <p className="text-sm text-slate-500">
            Period: <strong>{reportLinks.newsletter?.period}</strong>
            <br />The newsletter PDF contains only anonymised, aggregated benchmark data — no individual user information is shared.
          </p>
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSendNewsletter}
              disabled={sending}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending…' : 'Confirm — Send Now'}
            </button>
            <button
              onClick={() => setShowSendModal(false)}
              disabled={sending}
              className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── AI Agent ──────────────────────────────────────────────────────────────────
const AGENT_DOC = doc(db, 'superadmin', 'aiAgent')
const WELCOME   = "Hi! I'm Tlhiso Intelligence — your direct marketing and business growth advisor.\n\nI help you grow your users' businesses by identifying who to reach, what to say, and when to send it. I have live access to your platform data.\n\nTry asking:\n• \"Which users haven't sent a campaign this month?\"\n• \"Suggest a campaign for my medical users\"\n• \"Who is leaving growth on the table?\"\n• \"What's the best campaign to send this week?\""

function AdminAIAgent() {
  const [messages,   setMessages]   = useState([{ role: 'assistant', text: WELCOME }])
  const [apiHistory, setApiHistory] = useState([])
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [hydrated,   setHydrated]   = useState(false)
  const bottomRef                   = useRef(null)

  // Load persisted conversation on mount
  useEffect(() => {
    getDoc(AGENT_DOC).then(snap => {
      if (snap.exists() && snap.data().messages?.length > 1) {
        setMessages(snap.data().messages)
        setApiHistory(snap.data().apiHistory || [])
      }
      setHydrated(true)
    }).catch(() => setHydrated(true))
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  async function persist(msgs, hist) {
    try {
      await setDoc(AGENT_DOC, { messages: msgs, apiHistory: hist, updatedAt: serverTimestamp() })
    } catch {}
  }

  async function send(text) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    const withUser = [...messages, { role: 'user', text: msg }]
    setMessages(withUser)
    setLoading(true)
    try {
      const res = await httpsCallable(functions, 'superAdminChat')({ message: msg, history: apiHistory })
      const withReply = [...withUser, { role: 'assistant', text: res.data.reply }]
      setMessages(withReply)
      setApiHistory(res.data.history)
      await persist(withReply, res.data.history)
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: 'Sorry, I ran into an error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  async function clearConversation() {
    const initial = [{ role: 'assistant', text: 'Conversation cleared. How can I help?' }]
    setMessages(initial)
    setApiHistory([])
    await persist(initial, [])
  }

  const starters = [
    "Which users haven't sent a campaign recently?",
    'Suggest a campaign for my retail users',
    'Who is leaving growth on the table?',
    'Which medical users should run a re-engagement campaign?',
    'What direct marketing should I push this week?',
    'Show me users with low messaging activity',
  ]

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      {/* Header */}
      <div className="mb-5 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
            <Bot size={22} className="text-primary" />
          </span>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Tlhiso Intelligence</h2>
            <p className="text-sm text-slate-400">Vertex AI · Gemini 2.0 Flash · live Firestore access</p>
          </div>
        </div>
        <button onClick={clearConversation}
          className="flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700">
          <RefreshCw size={12} /> New conversation
        </button>
      </div>

      {/* Chat panel */}
      <div className="flex flex-1 overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm flex-col">

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <span className="mr-2.5 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <Bot size={14} className="text-primary" />
                </span>
              )}
              <div className={`max-w-[76%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'rounded-br-sm bg-primary text-white'
                  : 'rounded-bl-sm border border-slate-100 bg-slate-50 text-slate-800'
              }`}>
                {m.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <span className="mr-2.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Bot size={14} className="text-primary" />
              </span>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                <Loader2 size={13} className="animate-spin text-primary" /> Analysing your data…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Starter chips — only when no conversation history exists yet */}
        {hydrated && messages.length === 1 && (
          <div className="shrink-0 border-t border-slate-100 px-6 py-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Try asking</p>
            <div className="flex flex-wrap gap-2">
              {starters.map(s => (
                <button key={s} onClick={() => send(s)} disabled={loading}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-primary hover:text-primary disabled:opacity-40">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 border-t border-slate-100 px-4 py-4">
          <div className="flex items-center gap-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask about users, revenue, activity…"
              disabled={loading}
              className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-50"
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-sm transition hover:bg-[#4e7d6d] disabled:cursor-not-allowed disabled:opacity-40">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400">Powered by Vertex AI · Super admin only</p>
        </div>
      </div>
    </div>
  )
}

// ── Resources ─────────────────────────────────────────────────────────────────
const RESOURCES = [
  {
    title: 'Property Brochure',
    description: 'Shareable A4 brochure for the property management vertical. Hidden from search engines — share the link directly with prospects.',
    url: 'https://tlhiso.com/brochure/property-brochure/',
  },
]

function AdminResources() {
  const [copiedUrl, setCopiedUrl] = useState(null)

  function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(null), 2500)
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Resources</h2>
        <p className="mt-1 text-sm text-slate-400">Marketing material and shareable links</p>
      </div>

      <div className="grid gap-5 max-w-3xl">
        {RESOURCES.map(r => (
          <div key={r.url} className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
                <FileText size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-800">{r.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{r.description}</p>
                <p className="mt-3 truncate rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-600">{r.url}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#4e7d6d]">
                    <ExternalLink size={14} /> Open
                  </a>
                  <button onClick={() => copyLink(r.url)}
                    className="flex items-center gap-2 rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                    {copiedUrl === r.url
                      ? <><CheckCircle size={14} className="text-green-600" /> Copied!</>
                      : <><Copy size={14} /> Copy Link</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  return (
    <DashboardLayout industry="superadmin" pageTitle="Super Admin">
      <Routes>
        <Route index                   element={<PlatformOverview />}    />
        <Route path="users"            element={<AllUsers />}            />
        <Route path="messages"         element={<AdminMessages />}       />
        <Route path="notifications"    element={<AdminNotifications />}  />
        <Route path="support"          element={<AdminSupport />}        />
        <Route path="resources"        element={<AdminResources />}      />
        <Route path="settings"         element={<AdminSettings />}       />
        <Route path="campaigns"        element={<AdminCampaigns />}      />
        <Route path="insights"         element={<Insights />}            />
        <Route path="agent"            element={<AdminAIAgent />}        />
      </Routes>
    </DashboardLayout>
  )
}
