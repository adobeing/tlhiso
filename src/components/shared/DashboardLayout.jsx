import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'
import {
  onSnapshot, collection, query, orderBy,
  updateDoc, doc, arrayUnion, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../services/firebase'
import { PLANS } from '../../utils/industries'
import Modal from './Modal'
import {
  LayoutDashboard, Users, FileText, Receipt, ClipboardList, FolderKanban,
  Wrench, Calendar, Megaphone, BarChart2, ShieldCheck,
  Settings, LogOut, Bell, Search, ChevronLeft, ChevronRight, Home,
  Building2, HeartPulse, Map, ShoppingBag, Menu, X,
  Stethoscope, FileCheck, ArrowRightLeft, ClipboardSignature, HardHat,
  Star, Tag, List, CalendarClock, Zap, HelpCircle, Loader2, CheckCircle, Send, MessageSquare,
  Wallet, Bot, PartyPopper, Plus, User,
} from 'lucide-react'

const NAV_MAP = {
  b2b: [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/b2b/dashboard' },
    { label: 'Clients', icon: Users, to: '/b2b/clients' },
    { label: 'Invoices', icon: Receipt, to: '/b2b/invoices' },
    { label: 'Statements', icon: FileText, to: '/b2b/statements' },
    { label: 'Quotations', icon: ClipboardList, to: '/b2b/quotations' },
    { label: 'Finance', icon: Wallet, to: '/b2b/finance' },
    { label: 'Projects', icon: FolderKanban, to: '/b2b/projects' },
    { label: 'Service List', icon: ClipboardSignature, to: '/b2b/service-list' },
    { label: 'Appointments', icon: Calendar, to: '/b2b/appointments' },
    { label: 'Campaigns',    icon: Megaphone, to: '/b2b/campaigns' },
    { label: 'Inbox', icon: MessageSquare, to: '/b2b/inbox' },
    { label: 'Automations', icon: Zap,      to: '/b2b/automations' },
    { label: 'Surveys', icon: BarChart2, to: '/b2b/surveys' },
    { label: 'Marketing Opt-In', icon: Tag, to: '/b2b/marketing-optin' },
    { label: 'Settings', icon: Settings, to: '/b2b/settings' },
  ],
  medical: [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/medical/dashboard' },
    { label: 'Patients', icon: Users, to: '/medical/patients' },
    { label: 'Consultations', icon: Stethoscope, to: '/medical/consultations' },
    { label: 'Medical Reports', icon: FileCheck, to: '/medical/reports' },
    { label: 'Referrals', icon: ArrowRightLeft, to: '/medical/referrals' },
    { label: 'Appointments', icon: Calendar, to: '/medical/appointments' },
    { label: 'Campaigns',    icon: Megaphone, to: '/medical/campaigns' },
    { label: 'Inbox', icon: MessageSquare, to: '/medical/inbox' },
    { label: 'Recalls', icon: CalendarClock, to: '/medical/recalls' },
    { label: 'Automations', icon: Zap,      to: '/medical/automations' },
    { label: 'Surveys', icon: BarChart2, to: '/medical/surveys' },
    { label: 'Practitioners', icon: HeartPulse, to: '/medical/practitioners' },
    { label: 'Settings', icon: Settings, to: '/medical/settings' },
  ],
  property: [
    { label: 'Dashboard',        icon: LayoutDashboard, to: '/property/dashboard' },
    { label: 'Properties',       icon: Building2,       to: '/property/properties' },
    { label: 'Tenants',          icon: Users,           to: '/property/tenants' },
    { label: 'Rent Roll',        icon: List,            to: '/property/rent-roll' },
    { label: 'Owner Statements', icon: FileText,        to: '/property/statements' },
    { label: 'Invoices',         icon: Receipt,         to: '/property/invoices'   },
    { label: 'Finance',          icon: Wallet,          to: '/property/finance' },
    { label: 'Maintenance',      icon: Wrench,          to: '/property/maintenance' },
    { label: 'Appointments',     icon: Calendar,        to: '/property/appointments' },
    { label: 'Campaigns',        icon: Megaphone,       to: '/property/campaigns' },
    { label: 'Inbox',            icon: MessageSquare,   to: '/property/inbox' },
    { label: 'Automations',     icon: Zap,             to: '/property/automations' },
    { label: 'Surveys',          icon: BarChart2,       to: '/property/surveys' },
    { label: 'Documents',        icon: FolderKanban,    to: '/property/documents' },
    { label: 'Settings',         icon: Settings,        to: '/property/settings' },
  ],
  retail: [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/retail/dashboard' },
    { label: 'Customers', icon: Users, to: '/retail/customers' },
    { label: 'Appointments', icon: Calendar, to: '/retail/appointments' },
    { label: 'Campaigns',    icon: Megaphone, to: '/retail/campaigns' },
    { label: 'Inbox', icon: MessageSquare, to: '/retail/inbox' },
    { label: 'Automations', icon: Zap,      to: '/retail/automations' },
    { label: 'Weekly Deals', icon: Star, to: '/retail/weekly-deals' },
    { label: 'Surveys', icon: BarChart2, to: '/retail/surveys' },
    { label: 'Opt-In', icon: Tag, to: '/retail/optin' },
    { label: 'Settings', icon: Settings, to: '/retail/settings' },
  ],
  superadmin: [
    { label: 'Overview',       icon: LayoutDashboard, to: '/superadmin' },
    { label: 'Insights',       icon: BarChart2,       to: '/superadmin/insights' },
    { label: 'All Users',      icon: Users,           to: '/superadmin/users' },
    { label: 'Campaigns',      icon: Megaphone,       to: '/superadmin/campaigns' },
    { label: 'AI Agent',       icon: Bot,             to: '/superadmin/agent' },
    { label: 'Notifications',  icon: Bell,            to: '/superadmin/notifications' },
    { label: 'Support',        icon: MessageSquare,   to: '/superadmin/support' },
    { label: 'Settings',       icon: Settings,        to: '/superadmin/settings' },
  ],
  events: [
    { label: 'My Events', icon: Calendar,      to: '/events' },
    { label: 'New Event', icon: Plus,          to: '/events/new' },
    { label: 'Profile',   icon: User,           to: '/events/profile' },
    { label: 'Settings',  icon: Settings,      to: '/events/settings' },
  ],
}

const INDUSTRY_ICONS = { b2b: Building2, medical: HeartPulse, property: Map, retail: ShoppingBag, superadmin: ShieldCheck, events: PartyPopper }

// Per-industry accent colour used for the sidebar top strip and topbar title indicator
const INDUSTRY_ACCENT = {
  b2b:        '#3B82F6',
  medical:    '#EF4444',
  property:   '#F97316',
  retail:     '#8B5CF6',
  superadmin: '#5B8E7D',
  events:     '#5B8E7D',
}

const STATUS_DOT = {
  confirmed:   'bg-green-500',
  pending:     'bg-amber-400',
  rescheduled: 'bg-blue-500',
  cancelled:   'bg-red-400',
}

function NotifItem({ appt, industry, onClose, showDate = false }) {
  const name   = getApptName(appt)
  const time   = formatApptTime(appt.time)
  const status = (appt.status || 'confirmed').toLowerCase()
  const dot    = STATUS_DOT[status] ?? 'bg-gray-400'
  const dayLabel = showDate && appt.date
    ? new Date(appt.date + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric' })
    : null

  return (
    <Link
      to={`/${industry}/appointments`}
      onClick={onClose}
      className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-surface-2"
    >
      <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{name}</p>
        <p className="text-xs text-ink-secondary">
          {dayLabel ? `${dayLabel}${time ? ` · ${time}` : ''}` : time || 'Time TBD'}
          {appt.type ? ` · ${appt.type}` : ''}
        </p>
      </div>
      {status === 'pending' && (
        <span className="ml-auto flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
          Pending
        </span>
      )}
    </Link>
  )
}

function RescheduleItem({ appt, industry, onClose }) {
  const name = getApptName(appt)
  const requestedDate = appt.rescheduleDate
    ? new Date(appt.rescheduleDate + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
    : null
  const requestedTime = formatApptTime(appt.rescheduleTime)

  return (
    <Link
      to={`/${industry}/appointments`}
      onClick={onClose}
      className="flex items-start gap-3 px-4 py-2.5 transition hover:bg-amber-50"
    >
      <CalendarClock size={15} className="mt-0.5 flex-shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{name}</p>
        <p className="text-xs text-ink-secondary">
          {requestedDate
            ? `Wants: ${requestedDate}${requestedTime ? ` at ${requestedTime}` : ''}`
            : 'New time requested'}
        </p>
        {appt.rescheduleNote && (
          <p className="mt-0.5 truncate text-[11px] italic text-ink-secondary">"{appt.rescheduleNote}"</p>
        )}
      </div>
      <span className="ml-auto mt-0.5 flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
        Reschedule
      </span>
    </Link>
  )
}

function getApptName(a) {
  return a.patientName || a.patient || a.clientName || a.tenantName || a.name || a.title || 'Appointment'
}

function formatApptTime(t) {
  if (!t) return ''
  const [hRaw, mRaw] = String(t).split(':')
  const h = parseInt(hRaw, 10)
  if (isNaN(h)) return t
  const m    = (mRaw || '00').slice(0, 2)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12  = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${h12}:${m} ${ampm}`
}

export default function DashboardLayout({ industry, children, pageTitle }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed,   setCollapsed]   = useState(false)
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [notifOpen,      setNotifOpen]      = useState(false)
  const [sysNotifs,      setSysNotifs]      = useState([])
  const [supportOpen,    setSupportOpen]    = useState(false)
  const [supportMsg,     setSupportMsg]     = useState('')
  const [supportSending, setSupportSending] = useState(false)
  const [supportSent,    setSupportSent]    = useState(false)
  const [searchQ,        setSearchQ]        = useState('')
  const searchRef = useRef(null)

  const navItems    = NAV_MAP[industry] ?? []
  const IndustryIcon = INDUSTRY_ICONS[industry] ?? Home
  const accentColor  = INDUSTRY_ACCENT[industry] ?? '#5B8E7D'
  const uid          = user?.uid

  // Load appointments for notification panel
  const appointments = useCollection(uid ? `users/${uid}/appointments` : null)

  // Subscribe to platform notifications (not for superadmin)
  useEffect(() => {
    if (!uid || industry === 'superadmin') return
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      const now = new Date()
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setSysNotifs(all.filter(n => {
        const rightAudience = !n.targetIndustry || n.targetIndustry === 'all' || n.targetIndustry === industry
        const notExpired = !n.expiresAt || (n.expiresAt.toDate?.() ?? new Date(n.expiresAt)) > now
        return rightAudience && notExpired
      }))
    })
  }, [uid, industry])

  async function sendSupport() {
    if (!supportMsg.trim() || supportSending) return
    setSupportSending(true)
    try {
      await addDoc(collection(db, 'support_messages'), {
        fromUid: uid,
        fromName: profile?.businessName || profile?.name || user?.email || 'Unknown',
        fromEmail: user?.email || '',
        fromIndustry: industry,
        message: supportMsg.trim(),
        createdAt: serverTimestamp(),
        status: 'open',
      })
      await Promise.all([
        httpsCallable(functions, 'sendSMS')({
          to: '+27728918551',
          message: `Tlhiso support from ${profile?.name || user?.email} (${industry}): ${supportMsg.trim().slice(0, 120)}`,
        }),
        httpsCallable(functions, 'sendEmail')({
          to: 'support@tlhiso.com',
          subject: `Support query from ${profile?.name || user?.email}`,
          htmlBody: `<p><strong>From:</strong> ${profile?.businessName || profile?.name || user?.email} (${industry})</p><p><strong>Email:</strong> ${user?.email}</p><p><strong>Message:</strong></p><p style="white-space:pre-wrap">${supportMsg.trim()}</p>`,
        }),
      ])
      setSupportSent(true)
      setSupportMsg('')
      setTimeout(() => { setSupportSent(false); setSupportOpen(false) }, 3000)
    } catch (e) {
      alert('Failed to send: ' + e.message)
    } finally {
      setSupportSending(false)
    }
  }

  // Upcoming appointments: future time slot only, not cancelled/completed
  const upcoming = useMemo(() => {
    const now  = new Date()
    const in7  = new Date(now.getTime() + 7 * 86400000)
    return appointments
      .filter(a => {
        if (!a.date) return false
        const status = (a.status || '').toLowerCase()
        if (status === 'cancelled' || status === 'completed') return false
        // Compare full datetime so passed time slots are excluded
        const apptDt = new Date(`${a.date}T${a.time || '23:59'}`)
        if (isNaN(apptDt.getTime())) return false
        return apptDt > now && apptDt <= in7
      })
      .sort((a, b) => {
        const da = `${a.date}T${a.time || '00:00'}`
        const db = `${b.date}T${b.time || '00:00'}`
        return da < db ? -1 : da > db ? 1 : 0
      })
  }, [appointments])

  // Appointments where client requested a reschedule — shown regardless of time window
  const rescheduleRequests = useMemo(() =>
    appointments.filter(a => a.confirmationStatus === 'reschedule-requested'),
    [appointments]
  )

  // Seen appointment IDs — persisted per user in localStorage
  const [seenIds, setSeenIds] = useState(new Set())

  useEffect(() => {
    if (!uid) return
    try {
      const stored = JSON.parse(localStorage.getItem(`tlhiso_notif_${uid}`) || '[]')
      setSeenIds(new Set(stored))
    } catch {}
  }, [uid])

  // Mark all visible appointments as seen + system notifs as read, then close
  function closeNotif() {
    const allIds = [
      ...upcoming.map(a => a.id),
      ...rescheduleRequests.map(a => a.id),
    ].filter(Boolean)
    if (uid && allIds.length) {
      setSeenIds(prev => {
        const next = new Set([...prev, ...allIds])
        try {
          localStorage.setItem(`tlhiso_notif_${uid}`, JSON.stringify([...next].slice(-500)))
        } catch {}
        return next
      })
    }
    // Mark unread system notifs as read
    const unread = sysNotifs.filter(n => !(n.readBy || []).includes(uid))
    unread.forEach(n => updateDoc(doc(db, 'notifications', n.id), { readBy: arrayUnion(uid) }))
    setNotifOpen(false)
  }

  const today    = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  // Exclude reschedule-requested from day groups — they appear in their own section above
  const upcomingNonReschedule = upcoming.filter(a => a.confirmationStatus !== 'reschedule-requested')
  const todayAppts    = upcomingNonReschedule.filter(a => a.date === today)
  const tomorrowAppts = upcomingNonReschedule.filter(a => a.date === tomorrow)
  const laterAppts    = upcomingNonReschedule.filter(a => a.date > tomorrow)
  // Badge counts unseen reschedule requests + unseen upcoming + unread system notifs
  const unreadSysNotifs = sysNotifs.filter(n => !(n.readBy || []).includes(uid))
  const notifCount = useMemo(() => {
    const allIds = new Set([
      ...rescheduleRequests.map(a => a.id).filter(Boolean),
      ...upcomingNonReschedule.map(a => a.id).filter(Boolean),
    ])
    return [...allIds].filter(id => !seenIds.has(id)).length + unreadSysNotifs.length
  }, [rescheduleRequests, upcomingNonReschedule, seenIds, unreadSysNotifs])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  // Quick-nav: searchable sections = sidebar items + pages reachable elsewhere
  const searchableSections = useMemo(() => {
    if (industry === 'superadmin') return navItems
    return [
      ...navItems,
      { label: 'Profile', icon: Users,       to: `/${industry}/profile` },
      { label: 'POPIA',   icon: ShieldCheck, to: `/${industry}/settings` },
    ]
  }, [navItems, industry])

  const navMatches = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    if (!q) return []
    return searchableSections.filter(n => n.label.toLowerCase().includes(q)).slice(0, 8)
  }, [searchQ, searchableSections])

  // "/" focuses the quick-nav from anywhere outside a form field
  useEffect(() => {
    const onKey = e => {
      const el = document.activeElement
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(el?.tagName ?? '') && !el?.isContentEditable) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const avatarContent = profile?.businessLogoUrl
    ? <img src={profile.businessLogoUrl} alt="logo" className="h-full w-full object-contain" />
    : (profile?.name ?? user?.email ?? '?').charAt(0).toUpperCase()

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={`flex items-center px-5 py-5 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
              <IndustryIcon size={18} />
            </div>
            <img src="/tlhiso-logo-white.png?v=3" alt="Tlhiso" className="h-7 w-auto" />
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)}
          className="hidden rounded-lg p-1.5 text-sidebar-text transition hover:bg-white/10 hover:text-white lg:flex">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-sidebar-text transition hover:bg-white/10 hover:text-white lg:hidden">
          <X size={16} />
        </button>
      </div>

      {/* Profile card */}
      {!collapsed && (
        <div className="px-4 mb-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 text-sm font-bold text-white shadow-inner">
              {typeof avatarContent === 'string' ? avatarContent : avatarContent}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{profile?.businessName || profile?.name || user?.email}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="capitalize">{industry === 'superadmin' ? 'Super Admin' : industry}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.endsWith('/dashboard') || item.to === '/superadmin'}
              className={({ isActive }) =>
                `mb-0.5 flex items-center gap-3.5 rounded-xl px-4 py-3 text-[14px] transition-all duration-200 ${
                  isActive
                    ? 'bg-primary/10 font-semibold text-primary border-r-[3px] border-primary'
                    : 'font-medium text-sidebar-text hover:bg-white/5 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={17}
                    className={`flex-shrink-0 transition-colors duration-150 ${isActive ? 'text-primary' : ''}`}
                  />
                  {!collapsed && (
                    <span className="flex-1">{item.label}</span>
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Campaign quota meter */}
      {!collapsed && industry !== 'superadmin' && (() => {
        const plan  = PLANS[profile?.plan] ?? PLANS.starter
        const used  = profile?.messagesUsed ?? 0
        const limit = plan.messages || 1
        const pct   = Math.min(100, Math.round((used / limit) * 100))
        return (
          <div className="px-4 pb-2">
            <Link to={`/${industry}/campaigns`}
              className="block rounded-2xl border border-white/5 bg-white/5 p-3 transition hover:bg-white/10">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <Megaphone size={11} /> Campaigns
                </span>
                <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
                  {used.toLocaleString('en-ZA')}/{limit.toLocaleString('en-ZA')}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-primary'}`}
                  style={{ width: `${pct}%` }} />
              </div>
            </Link>
          </div>
        )
      })()}

      {/* Bottom actions */}
      <div className="border-t border-white/10 px-2 py-3">
        <button onClick={handleSignOut}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-text transition-all duration-150 hover:bg-white/[0.08] hover:text-white ${collapsed ? 'justify-center' : ''}`}>
          <LogOut size={16} />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-surface-2">
      {/* Desktop sidebar */}
      <aside className={`hidden flex-shrink-0 bg-sidebar transition-all duration-200 lg:flex ${collapsed ? 'w-16' : 'w-60'}`}>
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-sidebar">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200/60 bg-white px-6 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)}
              className="rounded-xl p-2 text-ink-secondary transition hover:bg-surface-2 hover:text-ink lg:hidden">
              <Menu size={18} />
            </button>
            {/* Page title */}
            <div className="flex items-center gap-3">
              <div className="h-8 w-1.5 rounded-full bg-primary" />
              <h1 className="text-xl font-bold text-slate-800">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden md:block group">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-primary" />
              <input
                ref={searchRef}
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onBlur={() => setTimeout(() => setSearchQ(''), 150)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && navMatches[0]) {
                    navigate(navMatches[0].to)
                    setSearchQ('')
                    e.currentTarget.blur()
                  }
                  if (e.key === 'Escape') {
                    setSearchQ('')
                    e.currentTarget.blur()
                  }
                }}
                placeholder="Jump to section…  ( / )"
                className="w-72 rounded-2xl border-transparent bg-slate-100/80 py-2.5 pl-11 pr-4 text-sm outline-none transition focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary/20 placeholder:text-slate-400"
              />
              {searchQ.trim() && (
                <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-white py-1 shadow-2xl">
                  {navMatches.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-slate-400">No matching section.</p>
                  ) : navMatches.map((item, i) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.to}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { navigate(item.to); setSearchQ('') }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-surface-2 hover:text-primary"
                      >
                        <Icon size={15} className="shrink-0 text-slate-400" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {i === 0 && <span className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-400">↵</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {/* Bell with notification panel */}
            {notifOpen && (
              <div className="fixed inset-0 z-40" onClick={closeNotif} />
            )}
            <div className="relative z-50">
              <button
                onClick={() => notifOpen ? closeNotif() : setNotifOpen(true)}
                className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition ${notifOpen ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <Bell size={18} />
                {notifCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-white shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h4 className="text-sm font-bold text-ink">Notifications</h4>
                    <Link
                      to={`/${industry}/appointments`}
                      onClick={closeNotif}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      View all
                    </Link>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {sysNotifs.length === 0 && rescheduleRequests.length === 0 && upcomingNonReschedule.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <Bell size={28} className="mx-auto mb-2 text-ink-secondary/30" />
                        <p className="text-sm font-medium text-ink-secondary">No notifications</p>
                        <p className="mt-0.5 text-xs text-ink-secondary/60">You're all caught up</p>
                      </div>
                    ) : (
                      <>
                        {sysNotifs.length > 0 && (
                          <div>
                            <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-primary/80">From Tlhiso</p>
                            {sysNotifs.map(n => (
                              <div key={n.id} className={`px-4 py-2.5 ${!(n.readBy || []).includes(uid) ? 'bg-primary/5' : ''}`}>
                                <p className="text-sm font-semibold text-ink">{n.title}</p>
                                <p className="mt-0.5 text-xs text-ink-secondary">{n.body}</p>
                                {n.createdAt && (
                                  <p className="mt-0.5 text-[10px] text-ink-secondary/50">
                                    {n.createdAt.toDate?.()?.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {rescheduleRequests.length > 0 && (
                          <div>
                            <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-amber-600/80">Reschedule Requested</p>
                            {rescheduleRequests.map(a => (
                              <RescheduleItem key={a.id} appt={a} industry={industry} onClose={closeNotif} />
                            ))}
                          </div>
                        )}
                        {todayAppts.length > 0 && (
                          <div>
                            <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-ink-secondary/60">Today</p>
                            {todayAppts.map(a => (
                              <NotifItem key={a.id} appt={a} industry={industry} onClose={closeNotif} />
                            ))}
                          </div>
                        )}
                        {tomorrowAppts.length > 0 && (
                          <div>
                            <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-ink-secondary/60">Tomorrow</p>
                            {tomorrowAppts.map(a => (
                              <NotifItem key={a.id} appt={a} industry={industry} onClose={closeNotif} />
                            ))}
                          </div>
                        )}
                        {laterAppts.length > 0 && (
                          <div>
                            <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-ink-secondary/60">This Week</p>
                            {laterAppts.map(a => (
                              <NotifItem key={a.id} appt={a} industry={industry} onClose={closeNotif} showDate />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {(rescheduleRequests.length > 0 || upcomingNonReschedule.length > 0) && (
                    <div className="border-t border-border px-4 py-2.5">
                      <Link
                        to={`/${industry}/appointments`}
                        onClick={() => setNotifOpen(false)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-light py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                      >
                        <Calendar size={12} /> Go to Appointments
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Help / Support button (hidden for superadmin) */}
            {industry !== 'superadmin' && (
              <button
                onClick={() => setSupportOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                title="Contact support">
                <HelpCircle size={18} />
              </button>
            )}
            {/* Avatar → Profile */}
            <Link to={`/${industry}/profile`} className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-primary text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:scale-105">
              {avatarContent}
            </Link>

            {/* Support modal */}
            {supportOpen && (
              <Modal open onClose={() => { setSupportOpen(false); setSupportMsg(''); setSupportSent(false) }} title="Contact Support">
                {supportSent ? (
                  <div className="space-y-3 py-6 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                      <CheckCircle size={28} className="text-green-600" />
                    </div>
                    <p className="font-bold text-slate-800">Message sent!</p>
                    <p className="text-sm text-slate-500">We'll get back to you at {user?.email}.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500">Have a question or issue? Send us a message and we'll respond shortly.</p>
                    <textarea
                      value={supportMsg}
                      onChange={e => setSupportMsg(e.target.value)}
                      placeholder="Describe your question or issue…"
                      rows={5}
                      className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      onClick={sendSupport}
                      disabled={supportSending || !supportMsg.trim()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white transition hover:bg-[#4e7d6d] disabled:opacity-50">
                      {supportSending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send Message</>}
                    </button>
                  </div>
                )}
              </Modal>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
