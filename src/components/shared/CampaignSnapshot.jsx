// Campaign snapshot card shown on every industry dashboard overview.
// Surfaces the core of the platform — campaigning — with the monthly
// quota, the most recent campaign's performance, and a New Campaign CTA.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone, PlusCircle, Clock, Mail, Phone as PhoneIcon, ChevronRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'
import { PLANS } from '../../utils/industries'

const STATUS_STYLES = {
  Sent:          'bg-green-100 text-green-700',
  Partial:       'bg-amber-100 text-amber-700',
  Failed:        'bg-red-100 text-red-600',
  Draft:         'bg-gray-100 text-gray-500',
  Scheduled:     'bg-blue-100 text-blue-600',
  Sending:       'bg-purple-100 text-purple-600',
  QuotaExceeded: 'bg-red-100 text-red-600',
}

export default function CampaignSnapshot({ industry }) {
  const { user, profile } = useAuth()
  const uid       = user?.uid
  const campaigns = useCollection(uid ? `users/${uid}/campaigns` : null)

  const planKey   = profile?.plan ?? 'starter'
  const plan      = PLANS[planKey] ?? PLANS.starter
  const used      = profile?.messagesUsed ?? 0
  const limit     = plan.messages || 1
  const remaining = Math.max(0, limit - used)
  const pct       = Math.min(100, Math.round((used / limit) * 100))
  const barColor  = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-primary'

  const lastCampaign = useMemo(() => {
    const sent = campaigns.filter(c => c.status !== 'Scheduled')
    return [...sent].sort(
      (a, b) => (b.sentAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0)
              - (a.sentAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0)
    )[0] ?? null
  }, [campaigns])

  const scheduledCount = useMemo(
    () => campaigns.filter(c => c.status === 'Scheduled').length,
    [campaigns]
  )

  const lcOpenRate = lastCampaign?.channel === 'email' && lastCampaign?.sentCount
    ? Math.round(((lastCampaign.uniqueOpenCount ?? 0) / lastCampaign.sentCount) * 100)
    : null
  const LcIcon = lastCampaign?.channel === 'email' ? Mail : PhoneIcon

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Megaphone size={17} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Campaigns</h3>
            <p className="text-[11px] text-slate-400">Reach your contacts via SMS &amp; email</p>
          </div>
        </div>
        <Link to={`/${industry}/campaigns`}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm shadow-primary/20 transition hover:bg-[#4e7d6d]">
          <PlusCircle size={14} /> New Campaign
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Quota */}
        <div className="rounded-xl bg-slate-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Monthly quota</p>
            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
              {used.toLocaleString('en-ZA')} / {limit.toLocaleString('en-ZA')}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200/70">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            <strong className="text-slate-700">{remaining.toLocaleString('en-ZA')}</strong> messages remaining on {plan.name}
          </p>
        </div>

        {/* Last campaign */}
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Last campaign</p>
          {lastCampaign ? (
            <Link to={`/${industry}/campaigns`} className="group block">
              <div className="flex items-center gap-2">
                <LcIcon size={13} className="shrink-0 text-slate-400" />
                <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-primary">
                  {lastCampaign.campaignName || lastCampaign.subject || '—'}
                </p>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLES[lastCampaign.status] ?? STATUS_STYLES.Draft}`}>
                  {lastCampaign.status || 'Draft'}
                </span>
                <span className="text-slate-500">{lastCampaign.sentCount ?? 0} sent</span>
                {lcOpenRate !== null && <span className="text-slate-500">· {lcOpenRate}% opened</span>}
              </div>
            </Link>
          ) : (
            <p className="text-xs text-slate-400">
              No campaigns yet — send your first one to reach your contacts.
            </p>
          )}
        </div>

        {/* Scheduled */}
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Scheduled</p>
          <div className="flex items-center gap-2">
            <Clock size={14} className={scheduledCount > 0 ? 'text-blue-500' : 'text-slate-300'} />
            <p className="text-sm font-semibold text-slate-800">
              {scheduledCount > 0
                ? `${scheduledCount} campaign${scheduledCount !== 1 ? 's' : ''} queued`
                : 'Nothing queued'}
            </p>
          </div>
          <Link to={`/${industry}/campaigns`}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
            View history <ChevronRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  )
}
