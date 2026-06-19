import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Papa from 'papaparse'
import {
  Calendar, Users, MapPin, DollarSign, Rocket, Send, CheckCircle,
  Clock, Loader2, AlertCircle, Edit2, Download,
} from 'lucide-react'
import DashboardLayout from '../shared/DashboardLayout'
import { watchEvent, watchGuests, sendEventReminder, sendEventThankYou } from '../../services/events'
import EventLaunchModal from './EventLaunchModal'

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     cls: 'bg-slate-100 text-slate-600' },
  launched:  { label: 'Launched',  cls: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
}

const RSVP_CONFIG = {
  going:    { label: 'Going',    cls: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', cls: 'bg-red-100 text-red-600' },
  pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-700' },
}

const DONUT_COLORS = { going: '#22c55e', declined: '#ef4444', pending: '#f59e0b' }

const TABS = ['Overview', 'Guests', 'Reminders']

export default function EventDetail() {
  const { eventId } = useParams()
  const [event, setEvent] = useState(null)
  const [guests, setGuests] = useState([])
  const [tab, setTab] = useState('Overview')
  const [launchOpen, setLaunchOpen] = useState(false)
  const [reminderLoading, setReminderLoading] = useState(false)
  const [thankyouLoading, setThankyouLoading] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    const unsub = watchEvent(eventId, setEvent)
    return unsub
  }, [eventId])

  useEffect(() => {
    const unsub = watchGuests(eventId, setGuests)
    return unsub
  }, [eventId])

  if (!event) {
    return (
      <DashboardLayout industry="events" pageTitle="Event">
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        </div>
      </DashboardLayout>
    )
  }

  const startDate = event.startDate?.toDate
    ? event.startDate.toDate().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : event.startDate || null

  const going    = guests.filter(g => g.rsvpStatus === 'going').length
  const declined = guests.filter(g => g.rsvpStatus === 'declined').length
  const pending  = guests.filter(g => g.rsvpStatus === 'pending').length

  const donutData = [
    { name: 'Going',    value: going    },
    { name: 'Declined', value: declined },
    { name: 'Pending',  value: pending  },
  ].filter(d => d.value > 0)

  const inviteSent    = guests.filter(g => g.touchpoints?.invite).length
  const reminderSent  = guests.filter(g => g.touchpoints?.reminder).length
  const thankyouSent  = guests.filter(g => g.touchpoints?.thankyou).length

  const canLaunch   = event.status === 'draft' && guests.length > 0
  const canReminder = (event.status === 'launched' || event.status === 'completed')
  const canThankyou = (event.status === 'launched' || event.status === 'completed')

  async function handleReminder() {
    setReminderLoading(true)
    setActionMsg('')
    setActionError('')
    try {
      await sendEventReminder(eventId)
      setActionMsg('Reminders sent successfully.')
    } catch (err) {
      setActionError(err?.message || 'Failed to send reminders.')
    } finally {
      setReminderLoading(false)
    }
  }

  async function handleThankyou() {
    setThankyouLoading(true)
    setActionMsg('')
    setActionError('')
    try {
      await sendEventThankYou(eventId)
      setActionMsg('Thank-you messages sent successfully.')
    } catch (err) {
      setActionError(err?.message || 'Failed to send thank-you messages.')
    } finally {
      setThankyouLoading(false)
    }
  }

  function exportGuestsCsv() {
    const rows = guests.map(g => ({
      Name:     g.name,
      Email:    g.email || '',
      Phone:    g.phone || '',
      RSVP:     g.rsvpStatus || 'pending',
      'Plus One': g.plusOne ? (g.plusOneName || 'Yes') : 'No',
      Dietary:  g.dietary || '',
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.title || 'event'}-guests.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const statusCfg = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.draft

  return (
    <DashboardLayout industry="events" pageTitle={event.title || 'Event'}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-black text-slate-900 truncate">{event.title}</h2>
            <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold ${statusCfg.cls}`}>
              {statusCfg.label}
            </span>
          </div>
          {startDate && <p className="mt-1 text-sm text-slate-500">{startDate}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            to={`/events/${eventId}/edit`}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Edit2 size={14} />
            Edit
          </Link>
          {canLaunch && (
            <button
              type="button"
              onClick={() => setLaunchOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-[#4e7d6d]"
            >
              <Rocket size={14} />
              Launch Event
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-slate-100 p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === t
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === 'Overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Donut chart */}
          <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-bold text-slate-800">RSVP Breakdown</h3>
            {donutData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={DONUT_COLORS[entry.name.toLowerCase()] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} guests`]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                No RSVPs yet
              </div>
            )}
          </div>

          {/* Key facts */}
          <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800">Event Details</h3>

            {startDate && (
              <div className="flex items-start gap-3">
                <Calendar size={16} className="mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Date</p>
                  <p className="text-sm font-semibold text-slate-800">{startDate}</p>
                </div>
              </div>
            )}

            {event.location?.name && (
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Location</p>
                  <p className="text-sm font-semibold text-slate-800">{event.location.name}</p>
                  {event.location.address && (
                    <p className="text-xs text-slate-500">{event.location.address}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Users size={16} className="mt-0.5 flex-shrink-0 text-primary" />
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Guests</p>
                <p className="text-sm font-semibold text-slate-800">
                  {guests.length} total · {going} going · {declined} declined · {pending} pending
                </p>
              </div>
            </div>

            {event.amountChargedZar != null && (
              <div className="flex items-start gap-3">
                <DollarSign size={16} className="mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Amount Charged</p>
                  <p className="text-sm font-semibold text-slate-800">
                    R{Number(event.amountChargedZar).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Guests Tab ── */}
      {tab === 'Guests' && (
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">{guests.length} Guests</h3>
            <button
              type="button"
              onClick={exportGuestsCsv}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Download size={13} />
              Export CSV
            </button>
          </div>

          {guests.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              No guests added yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-3">Guest</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3">RSVP</th>
                    <th className="px-6 py-3">Plus One</th>
                    <th className="px-6 py-3">Dietary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {guests.map(g => {
                    const rsvpCfg = RSVP_CONFIG[g.rsvpStatus] ?? RSVP_CONFIG.pending
                    return (
                      <tr key={g.id} className="hover:bg-slate-50/60">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {g.name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-slate-800">{g.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-500">
                          <div>{g.email || '—'}</div>
                          {g.phone && <div className="text-xs">{g.phone}</div>}
                        </td>
                        <td className="px-6 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${rsvpCfg.cls}`}>
                            {rsvpCfg.label}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-600">
                          {g.plusOne ? (g.plusOneName || 'Yes') : '—'}
                        </td>
                        <td className="px-6 py-3 text-slate-500">{g.dietary || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Reminders Tab ── */}
      {tab === 'Reminders' && (
        <div className="space-y-4 max-w-xl">
          {/* Touchpoints summary */}
          <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800">Communication Status</h3>

            {[
              { key: 'invite',    label: 'Invitations sent', count: inviteSent,   icon: Send },
              { key: 'reminder',  label: 'Reminders sent',   count: reminderSent, icon: Clock },
              { key: 'thankyou',  label: 'Thank-yous sent',  count: thankyouSent, icon: CheckCircle },
            ].map(({ key, label, count, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Icon size={15} className={count > 0 ? 'text-primary' : 'text-slate-400'} />
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                </div>
                <span className="text-sm font-bold text-slate-800">
                  {count} / {guests.length}
                </span>
              </div>
            ))}
          </div>

          {/* Action feedback */}
          {actionMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle size={14} />
              {actionMsg}
            </div>
          )}
          {actionError && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={14} />
              {actionError}
            </div>
          )}

          {/* Send Reminder */}
          <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
            <div>
              <h4 className="font-bold text-slate-800">Send Reminder</h4>
              <p className="mt-0.5 text-sm text-slate-500">
                Sends a reminder to all going and pending guests who haven't received one yet.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReminder}
              disabled={!canReminder || reminderLoading}
              className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#4e7d6d] disabled:opacity-50"
            >
              {reminderLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send Reminder Now
            </button>
            {!canReminder && (
              <p className="text-xs text-slate-400">Available after event is launched</p>
            )}
          </div>

          {/* Send Thank-You */}
          <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
            <div>
              <h4 className="font-bold text-slate-800">Send Thank-You</h4>
              <p className="mt-0.5 text-sm text-slate-500">
                Sends a thank-you message to all guests who RSVPed as going.
              </p>
            </div>
            <button
              type="button"
              onClick={handleThankyou}
              disabled={!canThankyou || thankyouLoading}
              className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#4e7d6d] disabled:opacity-50"
            >
              {thankyouLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              Send Thank-You Now
            </button>
            {!canThankyou && (
              <p className="text-xs text-slate-400">Available after event is launched</p>
            )}
          </div>
        </div>
      )}

      {/* Launch modal */}
      <EventLaunchModal
        open={launchOpen}
        onClose={() => setLaunchOpen(false)}
        event={event}
        guests={guests}
        onLaunched={() => setLaunchOpen(false)}
      />
    </DashboardLayout>
  )
}
