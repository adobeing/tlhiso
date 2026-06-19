import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Document, Page, View, Text, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import Papa from 'papaparse'
import {
  Calendar, Users, MapPin, DollarSign, Rocket, Send, CheckCircle,
  Clock, Loader2, AlertCircle, Edit2, Download, QrCode, UserCheck,
  Badge,
} from 'lucide-react'
import DashboardLayout from '../shared/DashboardLayout'
import { db } from '../../services/firebase'
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

const TABS = ['Overview', 'Guests', 'Reminders', 'Check-in']

// ── Name Tags PDF ─────────────────────────────────────────────────────────────

const tagStyles = StyleSheet.create({
  page: {
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  tag: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1pt solid #e2e8f0',
    padding: 16,
    minHeight: 180,
    position: 'relative',
  },
  eventName: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#5B8E7D',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  guestName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  sub: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 2,
  },
  table: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#5B8E7D',
    marginTop: 4,
  },
  footer: {
    fontSize: 7,
    color: '#94a3b8',
    marginTop: 8,
    borderTop: '0.5pt solid #e2e8f0',
    paddingTop: 6,
  },
  qr: {
    width: 60,
    height: 60,
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
})

function NameTagDoc({ event, guests }) {
  const pages = []
  for (let i = 0; i < guests.length; i += 4) pages.push(guests.slice(i, i + 4))
  return (
    <Document>
      {pages.map((chunk, pi) => (
        <Page key={pi} size="A4" orientation="landscape" style={tagStyles.page}>
          <View style={tagStyles.grid}>
            {chunk.map(g => {
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`https://tlhiso.com/e/${event.id}/${g.inviteToken}`)}`
              return (
                <View key={g.id} style={tagStyles.tag}>
                  <Text style={tagStyles.eventName}>{event.title}</Text>
                  <Text style={tagStyles.guestName}>{g.name}</Text>
                  {(g.company || g.jobTitle) && (
                    <Text style={tagStyles.sub}>
                      {g.company}{g.company && g.jobTitle ? ` — ${g.jobTitle}` : g.jobTitle || ''}
                    </Text>
                  )}
                  {g.tableNumber && (
                    <Text style={tagStyles.table}>Table {g.tableNumber}</Text>
                  )}
                  <Text style={tagStyles.footer}>tlhiso.com · powered by Tlhiso Events</Text>
                  {g.inviteToken && (
                    <Image src={qrUrl} style={tagStyles.qr} />
                  )}
                </View>
              )
            })}
          </View>
        </Page>
      ))}
    </Document>
  )
}

async function downloadNameTags(event, guests) {
  const blob = await pdf(<NameTagDoc event={event} guests={guests} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.title || 'event'}-name-tags.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

// ── QR Modal ─────────────────────────────────────────────────────────────────

function QrModal({ guest, eventId, onClose }) {
  if (!guest) return null
  const rsvpUrl = `https://tlhiso.com/e/${eventId}/${guest.inviteToken}`
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(rsvpUrl)}`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-slate-900">{guest.name}</p>
            {guest.company && <p className="text-xs text-slate-500">{guest.company}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        <img
          src={qrSrc}
          alt={`QR code for ${guest.name}`}
          className="w-full rounded-2xl"
        />
        <p className="mt-3 text-center text-xs text-slate-400 break-all">{rsvpUrl}</p>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const [qrGuest, setQrGuest] = useState(null)
  const [nameTagsLoading, setNameTagsLoading] = useState(false)
  const [checkingIn, setCheckingIn] = useState({}) // guestId -> bool

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

  // Check-in helpers
  const goingGuests = guests.filter(g => g.rsvpStatus === 'going')
  const checkedInCount = goingGuests.filter(g => g.checkedIn).length

  async function handleCheckIn(guest) {
    setCheckingIn(prev => ({ ...prev, [guest.id]: true }))
    try {
      await updateDoc(doc(db, 'events', eventId, 'guests', guest.id), {
        checkedIn: true,
        checkedInAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('Check-in error:', err)
    } finally {
      setCheckingIn(prev => ({ ...prev, [guest.id]: false }))
    }
  }

  async function handleMarkAllCheckedIn() {
    const notYet = goingGuests.filter(g => !g.checkedIn)
    for (const g of notYet) {
      await handleCheckIn(g)
    }
  }

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
      Name:          g.name,
      Email:         g.email || '',
      Phone:         g.phone || '',
      Company:       g.company || '',
      'Job Title':   g.jobTitle || '',
      'Table Number':g.tableNumber || '',
      RSVP:          g.rsvpStatus || 'pending',
      'Plus One':    g.plusOne ? (g.plusOneName || 'Yes') : 'No',
      Dietary:       g.dietary || '',
      'Checked In':  g.checkedIn ? 'Yes' : 'No',
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

  async function handleDownloadNameTags() {
    setNameTagsLoading(true)
    try {
      await downloadNameTags(event, guests)
    } catch (err) {
      console.error('Name tags PDF error:', err)
    } finally {
      setNameTagsLoading(false)
    }
  }

  const statusCfg = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.draft

  return (
    <DashboardLayout industry="events" pageTitle={event.title || 'Event'}>
      {/* QR Modal */}
      {qrGuest && (
        <QrModal guest={qrGuest} eventId={eventId} onClose={() => setQrGuest(null)} />
      )}

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
        <div className="space-y-6">
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

              {event.eventType && (
                <div className="flex items-start gap-3">
                  <Badge size={16} className="mt-0.5 flex-shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Event Type</p>
                    <p className="text-sm font-semibold text-slate-800 capitalize">{event.eventType.replace(/_/g, ' ')}</p>
                    {event.dressCode && <p className="text-xs text-slate-500">Dress code: {event.dressCode}</p>}
                    {event.capacity && <p className="text-xs text-slate-500">Capacity: {event.capacity}</p>}
                  </div>
                </div>
              )}

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

          {/* Agenda on Overview tab */}
          {event.agenda?.length > 0 && (
            <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-bold text-slate-800">Agenda / Programme</h3>
              <div className="space-y-3">
                {event.agenda.map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    {item.time && (
                      <div className="flex-shrink-0 w-16 text-right">
                        <span className="text-xs font-bold text-primary">{item.time}</span>
                      </div>
                    )}
                    <div className={`flex-1 pb-3 ${idx < event.agenda.length - 1 ? 'border-b border-slate-100' : ''}`}>
                      <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                      {item.speaker && <p className="text-xs text-slate-500 mt-0.5">{item.speaker}</p>}
                      {item.description && <p className="text-xs text-slate-400 mt-1">{item.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Guests Tab ── */}
      {tab === 'Guests' && (
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">{guests.length} Guests</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadNameTags}
                disabled={nameTagsLoading || guests.length === 0}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {nameTagsLoading
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Download size={13} />}
                Name Tags PDF
              </button>
              <button
                type="button"
                onClick={exportGuestsCsv}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <Download size={13} />
                Export CSV
              </button>
            </div>
          </div>

          {guests.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-400">
              No guests added yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-6 py-3">Guest</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3">RSVP</th>
                    <th className="px-6 py-3">Plus One</th>
                    <th className="px-6 py-3">Dietary</th>
                    <th className="px-6 py-3">QR</th>
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
                            <div>
                              <span className="font-semibold text-slate-800">{g.name}</span>
                              {g.company && (
                                <p className="text-xs text-slate-500">{g.company}{g.jobTitle ? ` · ${g.jobTitle}` : ''}</p>
                              )}
                              {g.tableNumber && (
                                <p className="text-xs text-primary font-semibold">Table {g.tableNumber}</p>
                              )}
                            </div>
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
                        <td className="px-6 py-3">
                          {g.inviteToken ? (
                            <button
                              type="button"
                              onClick={() => setQrGuest(g)}
                              className="flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-primary/5 hover:border-primary/30 hover:text-primary"
                            >
                              <QrCode size={12} />
                              QR
                            </button>
                          ) : '—'}
                        </td>
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

      {/* ── Check-in Tab ── */}
      {tab === 'Check-in' && (
        <div className="space-y-4 max-w-2xl">
          {/* Stats bar */}
          <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Check-in Manager</h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  <span className="font-bold text-slate-800 text-base">{checkedInCount}</span>
                  {' / '}
                  <span className="font-semibold">{goingGuests.length}</span>
                  {' '}checked in
                </p>
              </div>
              {goingGuests.length > 0 && checkedInCount < goingGuests.length && (
                <button
                  type="button"
                  onClick={handleMarkAllCheckedIn}
                  className="flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/20"
                >
                  <UserCheck size={14} />
                  Mark all in
                </button>
              )}
            </div>

            {/* Progress bar */}
            {goingGuests.length > 0 && (
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(checkedInCount / goingGuests.length) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Guest list */}
          {goingGuests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 py-16 text-center">
              <UserCheck size={32} className="mb-3 text-slate-300" />
              <p className="text-sm text-slate-400">No guests have RSVPed as going yet</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
              {goingGuests.map((g, i) => {
                const checkedInAt = g.checkedInAt?.toDate
                  ? g.checkedInAt.toDate().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
                  : null
                return (
                  <div
                    key={g.id}
                    className={`flex items-center gap-4 px-5 py-4 ${i !== 0 ? 'border-t border-slate-100' : ''} ${g.checkedIn ? 'bg-green-50/40' : ''}`}
                  >
                    {/* Avatar */}
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${g.checkedIn ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'}`}>
                      {g.name?.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 truncate">{g.name}</p>
                      {g.company && <p className="text-xs text-slate-500 truncate">{g.company}</p>}
                      {g.tableNumber && <p className="text-xs text-primary font-semibold">Table {g.tableNumber}</p>}
                    </div>

                    {/* Check-in status */}
                    {g.checkedIn ? (
                      <div className="flex flex-shrink-0 items-center gap-1.5 text-green-600">
                        <CheckCircle size={16} />
                        <span className="text-xs font-semibold">
                          {checkedInAt ? `Checked in ${checkedInAt}` : 'Checked in'}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCheckIn(g)}
                        disabled={checkingIn[g.id]}
                        className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#4e7d6d] disabled:opacity-60"
                      >
                        {checkingIn[g.id]
                          ? <Loader2 size={12} className="animate-spin" />
                          : <UserCheck size={12} />}
                        Check in
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
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
