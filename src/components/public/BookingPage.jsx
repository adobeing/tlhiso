// Public self-service booking page — /book/:userId
// No auth: reads business info and creates the appointment via callable
// Cloud Functions (getPublicBookingInfo / getPublicBookingSlots /
// createPublicBooking). Confirmation SMS goes out server-side.

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../services/firebase'
import { Calendar, Clock, CheckCircle, Loader2, AlertTriangle, User, Phone, Mail } from 'lucide-react'

const SLOT_TIMES = []
for (let h = 8; h < 17; h++) {
  SLOT_TIMES.push(`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`)
}

export default function BookingPage() {
  const { userId } = useParams()

  const [biz,     setBiz]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState({ name: '', phone: '', email: '', service: '', notes: '' })
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [taken, setTaken] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [done,       setDone]       = useState(false)
  const [error,      setError]      = useState('')

  useEffect(() => {
    httpsCallable(functions, 'getPublicBookingInfo')({ uid: userId })
      .then(res => setBiz(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    if (!date) { setTaken([]); return }
    setLoadingSlots(true)
    setTime('')
    httpsCallable(functions, 'getPublicBookingSlots')({ uid: userId, date })
      .then(res => setTaken(res.data?.taken ?? []))
      .catch(() => setTaken([]))
      .finally(() => setLoadingSlots(false))
  }, [date, userId])

  async function submit(e) {
    e.preventDefault()
    if (submitting) return
    setError('')
    if (!form.name.trim() || !form.phone.trim() || !date || !time) {
      setError('Please fill in your name, phone number, date and time.')
      return
    }
    setSubmitting(true)
    try {
      await httpsCallable(functions, 'createPublicBooking')({
        uid: userId, ...form, date, time,
      })
      setDone(true)
    } catch (err) {
      setError(err.message?.replace(/^.*?: /, '') || 'Could not complete your booking. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const inputCls = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle size={28} className="mx-auto mb-3 text-amber-500" />
          <p className="font-bold text-slate-800">Booking page not available</p>
          <p className="mt-1 text-sm text-slate-500">This link may be incorrect or no longer active.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg">
        {/* Business header */}
        <div className="mb-6 text-center">
          {biz?.logoUrl
            ? <img src={biz.logoUrl} alt="" className="mx-auto mb-3 h-16 w-16 rounded-2xl object-contain shadow-sm" />
            : <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-white shadow-md">
                {(biz?.businessName || '?').charAt(0).toUpperCase()}
              </div>}
          <h1 className="text-2xl font-black text-slate-900">{biz?.businessName}</h1>
          <p className="mt-1 text-sm text-slate-500">Book an appointment online — it takes less than a minute.</p>
        </div>

        {done ? (
          <div className="rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">Booking request sent!</h2>
            <p className="mt-2 text-sm text-slate-500">
              Thanks {form.name.split(' ')[0]} — we've received your request for{' '}
              <strong className="text-slate-700">{date} at {time}</strong>.
              You'll get an SMS confirmation shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><User size={12} /> Full name *</span>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Your full name" className={inputCls} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Phone size={12} /> Phone *</span>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="082 123 4567" className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Mail size={12} /> Email</span>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Optional" className={inputCls} />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">What is the appointment for?</span>
              <input value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))}
                placeholder="e.g. Consultation, viewing, haircut…" className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Calendar size={12} /> Date *</span>
              <input type="date" min={today} value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </label>

            {date && (
              <div>
                <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Clock size={12} /> Time *</span>
                {loadingSlots ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
                    <Loader2 size={13} className="animate-spin" /> Checking availability…
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {SLOT_TIMES.map(t => {
                      const isTaken = taken.includes(t)
                      const active = time === t
                      return (
                        <button key={t} type="button" disabled={isTaken}
                          onClick={() => setTime(t)}
                          className={`rounded-lg border px-1 py-2 text-xs font-semibold transition ${
                            active ? 'border-primary bg-primary text-white'
                            : isTaken ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through'
                            : 'border-slate-200 text-slate-700 hover:border-primary hover:text-primary'
                          }`}>
                          {t}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Notes</span>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Anything we should know? (optional)" className={`${inputCls} resize-none`} />
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <button type="submit" disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#4e7d6d] disabled:opacity-50">
              {submitting ? <><Loader2 size={15} className="animate-spin" /> Booking…</> : <>Request booking</>}
            </button>
            <p className="text-center text-[11px] text-slate-400">
              Powered by <a href="https://tlhiso.com" className="font-semibold text-primary">Tlhiso</a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
