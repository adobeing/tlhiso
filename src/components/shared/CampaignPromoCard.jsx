// Campaign promo card — shown at the top of every dashboard overview.
// Campaigns are the core revenue-driving feature, so this card actively
// pushes users toward creating one:
//   · zero campaigns  → large warm call-to-action
//   · has campaigns   → slim strip with the last campaign + New Campaign CTA

import { Link } from 'react-router-dom'
import { Megaphone, ArrowRight, PlusCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'

export default function CampaignPromoCard({ campaignsPath }) {
  const { user } = useAuth()
  const campaigns = useCollection(user?.uid ? `users/${user.uid}/campaigns` : null)

  // ── Zero campaigns: big warm CTA ────────────────────────────────────────
  if (campaigns.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[#3d6b5c] p-6 shadow-card sm:p-8">
        {/* soft decorative circles */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-14 right-24 h-32 w-32 rounded-full bg-white/5" />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-white">
            <Megaphone size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              Grow your sales with your first campaign
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              Reach your customers via SMS, email or WhatsApp — targeted messages that bring people back.
            </p>
          </div>
          <Link
            to={campaignsPath}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-primary shadow-md transition hover:bg-primary-light"
          >
            Create your first campaign <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    )
  }

  // ── Has campaigns: slim strip ───────────────────────────────────────────
  const last = [...campaigns].sort(
    (a, b) => (b.sentAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0)
            - (a.sentAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0)
  )[0]
  const lastDate = last?.sentAt?.toDate?.() ?? last?.createdAt?.toDate?.()

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent px-5 py-4 shadow-card">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm shadow-primary/20">
        <Megaphone size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-800">
          {last?.campaignName || last?.subject || 'Your last campaign'}
        </p>
        <p className="text-xs text-slate-500">
          {lastDate
            ? `Last campaign · ${lastDate.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : 'Last campaign'}
        </p>
      </div>
      <Link
        to={campaignsPath}
        className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-primary/20 transition hover:bg-[#4e7d6d]"
      >
        <PlusCircle size={15} /> New Campaign
      </Link>
    </div>
  )
}
