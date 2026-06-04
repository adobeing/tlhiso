import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  LayoutDashboard, Users, FileText, Receipt, ClipboardList, FolderKanban,
  Wrench, Calendar, MessageSquare, Megaphone, BarChart2, ShieldCheck,
  Settings, LogOut, Bell, Search, ChevronLeft, ChevronRight, Home,
  Building2, HeartPulse, Map, ShoppingBag, Menu, X, UserCircle,
  Stethoscope, FileCheck, ArrowRightLeft, ClipboardSignature, HardHat,
  Star, Tag, List,
} from 'lucide-react'

const NAV_MAP = {
  b2b: [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/b2b/dashboard' },
    { label: 'Clients', icon: Users, to: '/b2b/clients' },
    { label: 'Invoices', icon: Receipt, to: '/b2b/invoices' },
    { label: 'Statements', icon: FileText, to: '/b2b/statements' },
    { label: 'Quotations', icon: ClipboardList, to: '/b2b/quotations' },
    { label: 'Projects', icon: FolderKanban, to: '/b2b/projects' },
    { label: 'Service List', icon: ClipboardSignature, to: '/b2b/service-list' },
    { label: 'Appointments', icon: Calendar, to: '/b2b/appointments' },
    { label: 'Messages', icon: MessageSquare, to: '/b2b/messages' },
    { label: 'Campaigns', icon: Megaphone, to: '/b2b/campaigns' },
    { label: 'Surveys', icon: BarChart2, to: '/b2b/surveys' },
    { label: 'Marketing Opt-In', icon: Tag, to: '/b2b/marketing-optin' },
    { label: 'Profile', icon: UserCircle, to: '/b2b/profile' },
    { label: 'Settings', icon: Settings, to: '/b2b/settings' },
  ],
  medical: [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/medical/dashboard' },
    { label: 'Patients', icon: Users, to: '/medical/patients' },
    { label: 'Consultations', icon: Stethoscope, to: '/medical/consultations' },
    { label: 'Medical Reports', icon: FileCheck, to: '/medical/reports' },
    { label: 'Referrals', icon: ArrowRightLeft, to: '/medical/referrals' },
    { label: 'Appointments', icon: Calendar, to: '/medical/appointments' },
    { label: 'Messages', icon: MessageSquare, to: '/medical/messages' },
    { label: 'Campaigns', icon: Megaphone, to: '/medical/campaigns' },
    { label: 'Surveys', icon: BarChart2, to: '/medical/surveys' },
    { label: 'Practitioners', icon: HeartPulse, to: '/medical/practitioners' },
    { label: 'Profile', icon: UserCircle, to: '/medical/profile' },
    { label: 'Settings', icon: Settings, to: '/medical/settings' },
  ],
  property: [
    { label: 'Dashboard',        icon: LayoutDashboard, to: '/property/dashboard' },
    { label: 'Properties',       icon: Building2,       to: '/property/properties' },
    { label: 'Tenants',          icon: Users,           to: '/property/tenants' },
    { label: 'Rent Roll',        icon: List,            to: '/property/rent-roll' },
    { label: 'Owner Statements', icon: FileText,        to: '/property/statements' },
    { label: 'Maintenance',      icon: Wrench,          to: '/property/maintenance' },
    { label: 'Appointments',     icon: Calendar,        to: '/property/appointments' },
    { label: 'Messages',         icon: MessageSquare,   to: '/property/messages' },
    { label: 'Campaigns',        icon: Megaphone,       to: '/property/campaigns' },
    { label: 'Documents',        icon: FolderKanban,    to: '/property/documents' },
    { label: 'Profile',          icon: UserCircle,      to: '/property/profile' },
    { label: 'Settings',         icon: Settings,        to: '/property/settings' },
  ],
  retail: [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/retail/dashboard' },
    { label: 'Customers', icon: Users, to: '/retail/customers' },
    { label: 'Appointments', icon: Calendar, to: '/retail/appointments' },
    { label: 'Messages', icon: MessageSquare, to: '/retail/messages' },
    { label: 'Campaigns', icon: Megaphone, to: '/retail/campaigns' },
    { label: 'Weekly Deals', icon: Star, to: '/retail/weekly-deals' },
    { label: 'Surveys', icon: BarChart2, to: '/retail/surveys' },
    { label: 'Opt-In', icon: Tag, to: '/retail/optin' },
    { label: 'Profile', icon: UserCircle, to: '/retail/profile' },
    { label: 'Settings', icon: Settings, to: '/retail/settings' },
  ],
  superadmin: [
    { label: 'Overview', icon: LayoutDashboard, to: '/superadmin' },
    { label: 'All Users', icon: Users, to: '/superadmin/users' },
    { label: 'Messages', icon: MessageSquare, to: '/superadmin/messages' },
    { label: 'Settings', icon: Settings, to: '/superadmin/settings' },
  ],
}

const INDUSTRY_ICONS = { b2b: Building2, medical: HeartPulse, property: Map, retail: ShoppingBag, superadmin: ShieldCheck }

export default function DashboardLayout({ industry, children, pageTitle }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navItems = NAV_MAP[industry] ?? []
  const IndustryIcon = INDUSTRY_ICONS[industry] ?? Home

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={`flex items-center border-b border-white/10 px-4 py-5 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && <span className="text-lg font-extrabold text-white">Tlhiso</span>}
        <button onClick={() => setCollapsed(!collapsed)}
          className="hidden rounded-lg p-1.5 text-sidebar-text hover:bg-white/10 lg:flex">
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-sidebar-text hover:bg-white/10 lg:hidden">
          <X size={16} />
        </button>
      </div>

      {/* User info */}
      <div className={`flex items-center gap-3 border-b border-white/10 px-4 py-4 ${collapsed ? 'justify-center' : ''}`}>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/30 text-sm font-bold text-white">
          {(profile?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{profile?.name ?? user?.email}</p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-sidebar-text">
              <IndustryIcon size={10} />
              <span className="capitalize">{industry === 'superadmin' ? 'Super Admin' : industry}</span>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink key={item.to} to={item.to} end={item.to.endsWith('/dashboard') || item.to === '/superadmin'}
              className={({ isActive }) =>
                `mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-primary/25 font-semibold text-white shadow-sm'
                    : 'text-sidebar-text hover:bg-white/10 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`
              }>
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="tracking-[-0.01em]">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="border-t border-white/10 px-2 py-3">
        <button onClick={handleSignOut}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-text hover:bg-white/8 hover:text-white ${collapsed ? 'justify-center' : ''}`}>
          <LogOut size={17} />
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
        <header className="flex flex-shrink-0 items-center justify-between border-b border-border/70 bg-white px-4 py-2.5 shadow-sm lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)}
              className="rounded-xl p-2 text-ink-secondary transition hover:bg-surface-2 hover:text-ink lg:hidden">
              <Menu size={18} />
            </button>
            <h1 className="text-sm font-semibold text-ink">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary/60" />
              <input
                placeholder="Search…"
                className="w-56 rounded-full border border-border bg-surface-2 py-2 pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button className="relative rounded-full border border-border p-2 text-ink-secondary transition hover:bg-surface-2 hover:text-ink">
              <Bell size={16} />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm">
              {(profile?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
