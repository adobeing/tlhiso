import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import {
  Calendar, MapPin, CheckCircle, AlertCircle, ExternalLink, Clock,
  MessageSquare, Hash, Phone, CalendarPlus, ParkingCircle, Accessibility,
} from 'lucide-react'
import { db } from '../../services/firebase'
import { submitRsvp } from '../../services/events'

const INPUT_CLS = 'w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'

export default function EventInvitePublicPage() {
  const { eventId, inviteToken } = useParams()

  const [event, setEvent]     = useState(null)
  const [guest, setGuest]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // RSVP form state
  const [rsvpStatus, setRsvpStatus]       = useState('')
  const [plusOneCount, setPlusOneCount]   = useState(1)
  const [plusOneName, setPlusOneName]     = useState('')
  const [dietary, setDietary]             = useState('')
  const [customAnswers, setCustomAnswers] = useState({})
  const [guestNote, setGuestNote]         = useState('')

  const [submitting, setSubmitting]     = useState(false)
  const [submitted, setSubmitted]       = useState(false)
  const [submitError, setSubmitError]   = useState('')

  useEffect(() => {
    async function load() {
      try {
        const evSnap = await getDoc(doc(db, 'events', eventId))
        if (!evSnap.exists()) { setLoadError('Event not found.'); setLoading(false); return }
        setEvent({ id: evSnap.id, ...evSnap.data() })

        const gSnap = await getDocs(
          query(collection(db, 'events', eventId, 'guests'), where('inviteToken', '==', inviteToken))
        )
        if (gSnap.empty) { setLoadError('Invite not found or already expired.'); setLoading(false); return }
        const gDoc = gSnap.docs[0]
        const gData = { id: gDoc.id, ...gDoc.data() }
        setGuest(gData)
        if (gData.rsvpStatus && gData.rsvpStatus !== 'pending') {
          setRsvpStatus(gData.rsvpStatus)
          setPlusOneName(gData.plusOneName || '')
          setPlusOneCount(gData.plusOneCount || 1)
          setDietary(gData.dietary || '')
          setCustomAnswers(gData.customAnswers || {})
        }
      } catch (err) {
        console.error('EventInvitePublicPage load error:', err)
        setLoadError('Could not load invitation. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [eventId, inviteToken])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!rsvpStatus) return

    // Validate required custom questions
    for (const q of (event?.customQuestions || [])) {
      if (q.required && rsvpStatus === 'going' && !customAnswers[q.id]) {
        setSubmitError(`Please answer: ${q.label}`)
        return
      }
    }

    setSubmitting(true)
    setSubmitError('')
    try {
      await submitRsvp(eventId, guest.id, {
        inviteToken,
        rsvpStatus,
        ...(rsvpStatus === 'going' && event?.allowPlusOne ? { plusOneCount, plusOneName } : {}),
        ...(rsvpStatus === 'going' && event?.collectsDietary && dietary ? { dietary } : {}),
        ...(rsvpStatus === 'going' && Object.keys(customAnswers).length > 0 ? { customAnswers } : {}),
        ...(guestNote.trim() ? { guestMessage: guestNote.trim() } : {}),
      })
      setSubmitted(true)
    } catch (err) {
      console.error('submitRsvp error:', err)
      setSubmitError(err?.message || 'Could not submit your response. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function setAnswer(qId, value) {
    setCustomAnswers(prev => ({ ...prev, [qId]: value }))
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
      </div>
    )
  }

  // ── Error ──
  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <AlertCircle size={40} className="mb-4 text-red-400" />
        <h2 className="mb-2 text-xl font-bold text-slate-800">Oops</h2>
        <p className="text-slate-500">{loadError}</p>
      </div>
    )
  }

  const startDate = event?.startDate?.toDate
    ? event.startDate.toDate().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : event?.startDate || null

  const endDate = event?.endDate?.toDate
    ? event.endDate.toDate().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
    : event?.endDate || null

  const mapsUrl = event?.location?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location.address)}`
    : null

  const rsvpUrl = `https://tlhiso.com/e/${eventId}/${inviteToken}`
  const qrSrc   = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(rsvpUrl)}`

  // Google Calendar add link
  const calUrl = (() => {
    if (!event?.startDate) return null
    const rawDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate)
    const dateStr = rawDate.toISOString().split('T')[0].replace(/-/g, '')
    const start   = event.startTime
      ? `${dateStr}T${event.startTime.replace(':', '')}00`
      : dateStr
    const end = event.endTime && event.startTime
      ? `${dateStr}T${event.endTime.replace(':', '')}00`
      : dateStr
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title || '')}&dates=${start}/${end}&details=${encodeURIComponent(event.bio || '')}&location=${encodeURIComponent(event.location?.address || '')}`
  })()

  // RSVP deadline check
  const rsvpClosed = event?.rsvpDeadline && new Date() > new Date(event.rsvpDeadline + 'T23:59:59')

  const maxPlusOnes = event?.maxPlusOnes || 10

  // ── Confirmation screen ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50">
        {event?.coverImageUrl ? (
          <div className="relative h-32 w-full overflow-hidden">
            <img src={event.coverImageUrl} alt={event.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        ) : (
          <div className="h-16 w-full bg-gradient-to-br from-primary/80 to-primary/40" />
        )}

        <div className="mx-auto max-w-xl px-4 py-8">
          <div className="rounded-3xl border border-slate-200/60 bg-white shadow-xl p-8 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="mb-2 text-2xl font-black text-slate-900">
              {rsvpStatus === 'going' ? 'See you there!' : 'Response recorded'}
            </h2>
            <p className="text-slate-500">
              {rsvpStatus === 'going'
                ? `You're going to ${event?.title}. We look forward to seeing you!`
                : `You've declined ${event?.title}. Thanks for letting us know.`}
            </p>

            {rsvpStatus === 'going' && (
              <div className="mt-6 flex flex-col items-center">
                <p className="mb-3 text-sm font-semibold text-slate-700">Your entry QR code</p>
                <img src={qrSrc} alt="Entry QR code" className="h-48 w-48 rounded-2xl border border-slate-200 shadow-sm" />
                <p className="mt-2 text-xs text-slate-400">Screenshot this to show at the door</p>
              </div>
            )}

            {/* Add to calendar / social chips */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {rsvpStatus === 'going' && calUrl && (
                <a
                  href={calUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <CalendarPlus size={13} className="text-primary" />
                  Add to Calendar
                </a>
              )}
              {event?.hashtag && (
                <a
                  href={`https://twitter.com/search?q=%23${event.hashtag}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Hash size={13} className="text-primary" />
                  #{event.hashtag}
                </a>
              )}
              {event?.whatsappContact && (
                <a
                  href={`https://wa.me/${event.whatsappContact.replace(/[^+\d]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                >
                  <Phone size={13} />
                  WhatsApp the host
                </a>
              )}
            </div>

            <button
              onClick={() => setSubmitted(false)}
              className="mt-6 text-xs text-slate-400 underline hover:text-slate-600"
            >
              Change my response
            </button>

            <p className="mt-4 text-xs text-slate-400">
              Your response has been saved. You can update it by revisiting this link.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Powered by <a href="https://tlhiso.com" className="font-semibold hover:underline">Tlhiso</a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Cover banner */}
      {event?.coverImageUrl ? (
        <div className="relative h-56 w-full overflow-hidden sm:h-72 md:h-80">
          <img src={event.coverImageUrl} alt={event.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      ) : (
        <div className="h-24 w-full bg-gradient-to-br from-primary/80 to-primary/40" />
      )}

      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-xl overflow-hidden">
          {/* Event header */}
          <div className="px-6 pt-6 pb-5 border-b border-slate-100">
            <div className="flex items-start gap-3 flex-wrap mb-3">
              <h1 className="flex-1 text-2xl font-black text-slate-900 leading-tight">{event?.title}</h1>
              {event?.isFree && (
                <span className="rounded-full bg-green-100 px-3 py-0.5 text-xs font-bold text-green-700">Free</span>
              )}
              {event?.isPaidEvent && !event?.useTiers && event?.ticketPriceZar && (
                <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">
                  R{Number(event.ticketPriceZar).toLocaleString('en-ZA')}
                </span>
              )}
            </div>
            {guest && (
              <p className="text-sm text-slate-500">
                You've been personally invited, <strong className="text-slate-700">{guest.name}</strong>.
              </p>
            )}
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Guest message from organizer */}
            {event?.guestMessage && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 flex gap-3">
                <MessageSquare size={15} className="flex-shrink-0 mt-0.5 text-primary" />
                <p className="text-sm text-slate-700 leading-relaxed italic">"{event.guestMessage}"</p>
              </div>
            )}

            {/* Date & time */}
            {startDate && (
              <div className="flex items-start gap-3">
                <Calendar size={16} className="mt-0.5 flex-shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">{startDate}</p>
                  {(event?.startTime || event?.endTime) && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      <Clock size={11} className="inline mr-1" />
                      {event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}
                    </p>
                  )}
                  {endDate && <p className="text-xs text-slate-500">Until {endDate}</p>}
                </div>
              </div>
            )}

            {/* Location + map */}
            {event?.location?.name && (
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 flex-shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{event.location.name}</p>
                  {event.location.address && (
                    <p className="text-xs text-slate-500">{event.location.address}</p>
                  )}
                  {event?.location?.address && (
                    <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200">
                      <iframe
                        title="Event location map"
                        width="100%"
                        height="160"
                        style={{ border: 0, display: 'block' }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(event.location.address)}&output=embed&z=15`}
                        className="w-full"
                      />
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-primary hover:bg-slate-50"
                        >
                          <ExternalLink size={11} />
                          Get Directions on Google Maps
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Parking */}
            {event?.parkingInfo && (
              <div className="flex items-start gap-3">
                <ParkingCircle size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Parking</p>
                  <p className="text-sm text-slate-700">{event.parkingInfo}</p>
                </div>
              </div>
            )}

            {/* Accessibility */}
            {event?.accessibilityInfo && (
              <div className="flex items-start gap-3">
                <Accessibility size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Accessibility</p>
                  <p className="text-sm text-slate-700">{event.accessibilityInfo}</p>
                </div>
              </div>
            )}

            {/* Dress code */}
            {event?.dressCode && (
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Dress Code</p>
                <p className="text-sm text-slate-700">{event.dressCode}</p>
              </div>
            )}

            {/* Bio */}
            {event?.bio && (
              <p className="text-sm text-slate-600 leading-relaxed">{event.bio}</p>
            )}

            {/* Accommodation */}
            {event?.accommodationNearby && (
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Accommodation Nearby</p>
                <p className="text-sm text-slate-700">{event.accommodationNearby}</p>
              </div>
            )}

            {/* Carpooling / Transport */}
            {(event?.carpooling || event?.transportProvided) && (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 space-y-1">
                {event.carpooling && (
                  <p className="text-sm text-slate-700">Carpooling is available for this event.</p>
                )}
                {event.transportProvided && event.transportDetails && (
                  <p className="text-sm text-slate-700">{event.transportDetails}</p>
                )}
              </div>
            )}

            {/* Ticket tiers (display only) */}
            {event?.useTiers && event?.ticketTiers?.length > 0 && (
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Ticket Tiers</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {event.ticketTiers.map(tier => {
                    const remaining = (tier.quantity || 0) - (tier.sold || 0)
                    return (
                      <div key={tier.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{tier.name}</p>
                          {tier.quantity > 0 && (
                            <p className={`text-xs mt-0.5 ${remaining <= 0 ? 'text-red-500' : 'text-slate-500'}`}>
                              {remaining <= 0 ? 'Sold out' : `${remaining} remaining`}
                            </p>
                          )}
                        </div>
                        <span className="text-sm font-bold text-primary">
                          {tier.priceZar === 0 ? 'Free' : `R${Number(tier.priceZar).toLocaleString('en-ZA')}`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Agenda */}
            {event?.agenda?.length > 0 && (
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Programme</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {event.agenda.map((item, idx) => (
                    <div key={idx} className="flex gap-3 px-4 py-3">
                      {item.time && (
                        <div className="flex items-start gap-1 flex-shrink-0 w-14 pt-0.5">
                          <Clock size={11} className="mt-0.5 text-primary flex-shrink-0" />
                          <span className="text-xs font-bold text-primary leading-tight">{item.time}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                        {item.speaker && <p className="text-xs text-slate-500 mt-0.5">{item.speaker}</p>}
                        {item.description && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RSVP deadline closed */}
            {rsvpClosed && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-5 text-center">
                <p className="font-bold text-amber-800">RSVPs have closed</p>
                <p className="mt-1 text-sm text-amber-700">
                  The deadline for responding was {new Date(event.rsvpDeadline).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}.
                </p>
              </div>
            )}

            {/* No RSVP required notice */}
            {!rsvpClosed && event?.rsvpRequired === false && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-slate-700 text-center">
                No RSVP needed — just show up!
              </div>
            )}

            {/* Already responded notice */}
            {!rsvpClosed && event?.rsvpRequired !== false && guest?.rsvpStatus && guest.rsvpStatus !== 'pending' && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                You previously responded: <strong>{guest.rsvpStatus === 'going' ? 'Going' : 'Declined'}</strong>. You can update your response below.
              </div>
            )}

            {/* RSVP Form — hidden when closed or not required */}
            {!rsvpClosed && event?.rsvpRequired !== false && (
              <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                <div>
                  <p className="mb-2 text-sm font-bold text-slate-800">Will you be attending?</p>
                  <div className="flex gap-3">
                    <label className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition ${rsvpStatus === 'going' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-primary/40'}`}>
                      <input
                        type="radio"
                        name="rsvp"
                        value="going"
                        className="sr-only"
                        onChange={() => setRsvpStatus('going')}
                      />
                      Going
                    </label>
                    <label className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition ${rsvpStatus === 'declined' ? 'border-red-400 bg-red-50 text-red-600' : 'border-slate-200 text-slate-600 hover:border-red-300'}`}>
                      <input
                        type="radio"
                        name="rsvp"
                        value="declined"
                        className="sr-only"
                        onChange={() => setRsvpStatus('declined')}
                      />
                      Decline
                    </label>
                  </div>
                </div>

                {/* Plus one */}
                {rsvpStatus === 'going' && event?.allowPlusOne && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                        How many guests are you bringing?
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={maxPlusOnes}
                        value={plusOneCount}
                        onChange={e => setPlusOneCount(Math.min(Number(e.target.value), maxPlusOnes))}
                        className={INPUT_CLS}
                      />
                      {event.maxPlusOnes && (
                        <p className="mt-1 text-xs text-slate-400">Maximum {event.maxPlusOnes} extra guest{event.maxPlusOnes !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                    {plusOneCount > 0 && (
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Plus-one name <span className="text-slate-400 font-normal">(optional)</span></label>
                        <input
                          type="text"
                          value={plusOneName}
                          onChange={e => setPlusOneName(e.target.value)}
                          placeholder="Guest name"
                          className={INPUT_CLS}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Dietary */}
                {rsvpStatus === 'going' && event?.collectsDietary && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Dietary requirements <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input
                      type="text"
                      value={dietary}
                      onChange={e => setDietary(e.target.value)}
                      placeholder="e.g. Vegetarian, Halal, Nut allergy"
                      className={INPUT_CLS}
                    />
                  </div>
                )}

                {/* Custom questions */}
                {rsvpStatus === 'going' && event?.customQuestions?.filter(q => q.label).map(q => (
                  <div key={q.id}>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                      {q.label}
                      {q.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {q.type === 'text' && (
                      <input
                        type="text"
                        value={customAnswers[q.id] || ''}
                        onChange={e => setAnswer(q.id, e.target.value)}
                        required={q.required}
                        className={INPUT_CLS}
                      />
                    )}
                    {q.type === 'select' && (
                      <select
                        value={customAnswers[q.id] || ''}
                        onChange={e => setAnswer(q.id, e.target.value)}
                        required={q.required}
                        className={INPUT_CLS}
                      >
                        <option value="">Select an option…</option>
                        {(q.options || []).map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    )}
                    {q.type === 'checkbox' && (
                      <div className="flex gap-4">
                        {['Yes', 'No'].map(opt => (
                          <label key={opt} className={`flex flex-1 cursor-pointer items-center justify-center rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition ${customAnswers[q.id] === opt.toLowerCase() ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-primary/40'}`}>
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              className="sr-only"
                              onChange={() => setAnswer(q.id, opt.toLowerCase())}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Message to host */}
                {rsvpStatus === 'going' && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Message to the host <span className="text-slate-400 font-normal">(optional)</span></label>
                    <textarea
                      value={guestNote}
                      onChange={e => setGuestNote(e.target.value)}
                      rows={2}
                      placeholder="Anything you'd like the organiser to know…"
                      className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}

                {submitError && (
                  <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    <AlertCircle size={14} />
                    {submitError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!rsvpStatus || submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-[#4e7d6d] disabled:opacity-60"
                >
                  {submitting ? (
                    <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Submitting…</>
                  ) : (
                    'Submit RSVP'
                  )}
                </button>
              </form>
            )}

            {/* Social chips (always shown) */}
            {(calUrl || event?.hashtag || event?.whatsappContact) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {calUrl && (
                  <a
                    href={calUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <CalendarPlus size={12} className="text-primary" />
                    Add to Calendar
                  </a>
                )}
                {event?.hashtag && (
                  <a
                    href={`https://twitter.com/search?q=%23${event.hashtag}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <Hash size={12} className="text-primary" />
                    #{event.hashtag}
                  </a>
                )}
                {event?.whatsappContact && (
                  <a
                    href={`https://wa.me/${event.whatsappContact.replace(/[^+\d]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                  >
                    <Phone size={12} />
                    WhatsApp us
                  </a>
                )}
              </div>
            )}

            {/* POPIA notice */}
            <p className="text-xs text-slate-400 leading-relaxed">
              Your response is collected by the event organiser to manage attendance in accordance with South Africa's{' '}
              <abbr title="Protection of Personal Information Act">POPIA</abbr>.{' '}
              <Link to="/legal/privacy" className="underline hover:text-slate-600">Privacy Policy</Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Powered by <a href="https://tlhiso.com" className="font-semibold hover:underline">Tlhiso</a>
        </p>
      </div>
    </div>
  )
}
