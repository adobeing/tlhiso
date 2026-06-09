// Public appointment response page — no login required.
// Route: /appt/:userId/:appointmentId
// Patient can confirm, cancel, or request a reschedule.
// Writes confirmationStatus back to users/{userId}/appointments/{appointmentId}.

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../services/firebase'
import { CheckCircle2, XCircle, CalendarClock, Loader2, CalendarDays, Clock } from 'lucide-react'

const STATUS_COLORS = {
  confirmed:             'bg-green-100 text-green-700',
  cancelled:             'bg-red-100 text-red-700',
  'reschedule-requested':'bg-amber-100 text-amber-700',
}

export default function AppointmentResponsePage() {
  const { userId, appointmentId } = useParams()

  const [appt,       setAppt]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [action,     setAction]     = useState(null)  // 'confirm' | 'cancel' | 'reschedule'
  const [reschedule, setReschedule] = useState({ date: '', time: '', note: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(null)  // action that was completed

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'users', userId, 'appointments', appointmentId))
        if (!snap.exists()) { setError('Appointment not found.'); return }
        setAppt({ id: snap.id, ...snap.data() })
      } catch { setError('Unable to load appointment. Please try again.') }
      finally { setLoading(false) }
    }
    load()
  }, [userId, appointmentId])

  const name = appt?.patient || appt?.customer || 'Patient'
  const detail = appt?.appointmentType || appt?.service || appt?.purpose || appt?.reason || ''

  async function submit() {
    setSubmitting(true)
    try {
      if (action === 'confirm') {
        await updateDoc(doc(db, 'users', userId, 'appointments', appointmentId), {
          status: 'Confirmed',
          confirmationStatus: 'confirmed',
          responseAt: serverTimestamp(),
        })
        setDone('confirm')
      } else if (action === 'cancel') {
        await updateDoc(doc(db, 'users', userId, 'appointments', appointmentId), {
          status: 'Cancelled',
          confirmationStatus: 'cancelled',
          responseAt: serverTimestamp(),
        })
        setDone('cancel')
      } else if (action === 'reschedule') {
        if (!reschedule.date || !reschedule.time) { alert('Please select a preferred date and time.'); setSubmitting(false); return }
        await updateDoc(doc(db, 'users', userId, 'appointments', appointmentId), {
          confirmationStatus: 'reschedule-requested',
          rescheduleDate: reschedule.date,
          rescheduleTime: reschedule.time,
          rescheduleNote: reschedule.note,
          responseAt: serverTimestamp(),
        })
        setDone('reschedule')
      }
    } catch { alert('Something went wrong. Please try again.') }
    finally { setSubmitting(false) }
  }

  /* ── Loading ── */
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Loader2 size={28} className="animate-spin text-teal-600" />
    </div>
  )

  /* ── Error ── */
  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-md">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    </div>
  )

  /* ── Already responded ── */
  if (appt?.confirmationStatus && !done) {
    const label = {
      confirmed:              'You have already confirmed this appointment.',
      cancelled:              'You have already cancelled this appointment.',
      'reschedule-requested': 'Your reschedule request has been submitted.',
    }[appt.confirmationStatus]
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-md">
          <p className="mb-1 text-base font-bold text-gray-900">Already responded</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    )
  }

  /* ── Done ── */
  if (done) {
    const msgs = {
      confirm:    { icon: <CheckCircle2 size={36} className="text-green-500" />, title: 'Appointment Confirmed', body: 'Thank you! The practice has been notified. Please arrive 10 minutes early.' },
      cancel:     { icon: <XCircle      size={36} className="text-red-400"   />, title: 'Appointment Cancelled', body: 'Your appointment has been cancelled. Please contact the practice to rebook.' },
      reschedule: { icon: <CalendarClock size={36} className="text-amber-500"/>, title: 'Reschedule Requested',  body: `Your preferred time of ${reschedule.date} at ${reschedule.time} has been sent to the practice. They will confirm with you shortly.` },
    }[done]
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-10 text-center shadow-md">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
            {msgs.icon}
          </div>
          <h2 className="text-lg font-extrabold text-gray-900">{msgs.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">{msgs.body}</p>
        </div>
      </div>
    )
  }

  /* ── Main ── */
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-sm">

        {/* Header */}
        <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 px-6 py-6 text-white shadow-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-200">Appointment</p>
          <h1 className="mt-1 text-xl font-extrabold">Hi {name.split(' ')[0]},</h1>
          <p className="mt-0.5 text-sm text-teal-100">Please confirm or update your appointment below.</p>
        </div>

        {/* Appointment details card */}
        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <CalendarDays size={16} className="flex-shrink-0 text-teal-600" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Date</p>
                <p className="font-semibold text-gray-900">{appt.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock size={16} className="flex-shrink-0 text-teal-600" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Time</p>
                <p className="font-semibold text-gray-900">{appt.time}</p>
              </div>
            </div>
            {detail && (
              <div className="rounded-xl bg-gray-50 px-4 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Purpose</p>
                <p className="font-medium text-gray-900">{detail}</p>
              </div>
            )}
          </div>
        </div>

        {/* Action selection */}
        {!action && (
          <div className="space-y-3">
            <button onClick={() => setAction('confirm')}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-green-200 bg-green-50 px-5 py-4 text-left transition hover:border-green-400 hover:bg-green-100">
              <CheckCircle2 size={22} className="flex-shrink-0 text-green-600" />
              <div>
                <p className="font-bold text-green-800">Confirm appointment</p>
                <p className="text-xs text-green-600">I'll be there on {appt.date} at {appt.time}</p>
              </div>
            </button>

            <button onClick={() => setAction('reschedule')}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 text-left transition hover:border-amber-400 hover:bg-amber-100">
              <CalendarClock size={22} className="flex-shrink-0 text-amber-600" />
              <div>
                <p className="font-bold text-amber-800">Request reschedule</p>
                <p className="text-xs text-amber-600">Suggest a different date and time</p>
              </div>
            </button>

            <button onClick={() => setAction('cancel')}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4 text-left transition hover:border-red-400 hover:bg-red-100">
              <XCircle size={22} className="flex-shrink-0 text-red-500" />
              <div>
                <p className="font-bold text-red-800">Cancel appointment</p>
                <p className="text-xs text-red-500">I can no longer make this appointment</p>
              </div>
            </button>
          </div>
        )}

        {/* Reschedule form */}
        {action === 'reschedule' && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
            <p className="font-bold text-gray-900">Preferred date &amp; time</p>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500">Date *</span>
              <input type="date" value={reschedule.date}
                onChange={e => setReschedule(r => ({ ...r, date: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500">Time *</span>
              <input type="time" value={reschedule.time}
                onChange={e => setReschedule(r => ({ ...r, time: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500">Reason (optional)</span>
              <textarea value={reschedule.note} rows={2}
                onChange={e => setReschedule(r => ({ ...r, note: e.target.value }))}
                placeholder="e.g. Work conflict, travelling"
                className="w-full resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
            </label>
            <button onClick={() => setAction(null)}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              ← Back
            </button>
          </div>
        )}

        {/* Confirm / cancel selection */}
        {action === 'cancel' && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-red-800">Are you sure you want to cancel?</p>
            <p className="text-xs text-red-600">This will notify the practice. You can contact them directly to rebook.</p>
            <button onClick={() => setAction(null)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              ← Back
            </button>
          </div>
        )}

        {/* Submit button */}
        {action && (
          <button onClick={submit} disabled={submitting}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition disabled:opacity-60 ${
              action === 'confirm'    ? 'bg-green-600 hover:bg-green-700' :
              action === 'cancel'     ? 'bg-red-600 hover:bg-red-700' :
                                        'bg-amber-500 hover:bg-amber-600'
            }`}>
            {submitting
              ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
              : action === 'confirm'    ? '✓ Confirm my appointment'
              : action === 'cancel'     ? '✗ Cancel my appointment'
              :                           '→ Send reschedule request'}
          </button>
        )}

        <p className="mt-6 text-center text-[11px] text-gray-400">
          Your response is sent securely to the practice. POPIA-compliant.
        </p>
      </div>
    </div>
  )
}
