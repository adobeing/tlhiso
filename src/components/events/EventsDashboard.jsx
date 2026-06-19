import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Plus, Users, CheckCircle, Clock, XCircle } from 'lucide-react'
import DashboardLayout from '../shared/DashboardLayout'
import { useAuth } from '../../contexts/AuthContext'
import { watchOrganizerEvents } from '../../services/events'

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     cls: 'bg-slate-100 text-slate-600' },
  launched:  { label: 'Launched',  cls: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
}

function StatusPill({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function StatusIcon({ status }) {
  if (status === 'launched')  return <CheckCircle size={14} className="text-green-600" />
  if (status === 'completed') return <CheckCircle size={14} className="text-blue-600" />
  if (status === 'cancelled') return <XCircle size={14} className="text-red-500" />
  return <Clock size={14} className="text-slate-400" />
}

export default function EventsDashboard() {
  const { user } = useAuth()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    const unsub = watchOrganizerEvents(user.uid, (evts) => {
      setEvents(evts.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? 0
        const tb = b.createdAt?.toMillis?.() ?? 0
        return tb - ta
      }))
      setLoading(false)
    })
    return unsub
  }, [user?.uid])

  return (
    <DashboardLayout industry="events" pageTitle="Events">
      <div className="space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">My Events</h2>
            <p className="mt-1 text-sm text-slate-500">Manage invitations, RSVPs, and guest communications</p>
          </div>
          <Link
            to="/events/new"
            className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-[#4e7d6d]"
          >
            <Plus size={16} />
            New Event
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Calendar size={28} className="text-primary" />
            </div>
            <h3 className="mb-1 text-lg font-bold text-slate-800">No events yet</h3>
            <p className="mb-6 text-sm text-slate-500">Create your first event and start sending invitations</p>
            <Link
              to="/events/new"
              className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-[#4e7d6d]"
            >
              <Plus size={16} />
              Create Event
            </Link>
          </div>
        )}

        {/* Event cards grid */}
        {!loading && events.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {events.map(event => {
              const startDate = event.startDate?.toDate
                ? event.startDate.toDate().toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
                : event.startDate
                  ? new Date(event.startDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
                  : null

              return (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="group flex flex-col rounded-3xl border border-slate-200/60 bg-white shadow-sm transition-all duration-200 hover:shadow-xl hover:shadow-slate-200/40 overflow-hidden"
                >
                  {/* Cover image */}
                  {event.coverImageUrl ? (
                    <img
                      src={event.coverImageUrl}
                      alt={event.title}
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                      <Calendar size={36} className="text-primary/40" />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <h3 className="flex-1 font-bold text-slate-900 leading-snug line-clamp-2">{event.title}</h3>
                      <StatusPill status={event.status} />
                    </div>

                    {startDate && (
                      <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
                        <Calendar size={13} className="flex-shrink-0 text-primary" />
                        {startDate}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Users size={13} className="text-slate-400" />
                        <span className="font-semibold">{event.guestCount ?? 0}</span>
                        <span className="text-slate-400">guests</span>
                      </div>
                      {event.amountChargedZar != null && (
                        <span className="text-sm font-semibold text-slate-700">
                          R{Number(event.amountChargedZar).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <StatusIcon status={event.status} />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
