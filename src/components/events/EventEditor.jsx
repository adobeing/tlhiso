import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Papa from 'papaparse'
import { Plus, Trash2, Upload, Users, X, Clock } from 'lucide-react'
import DashboardLayout from '../shared/DashboardLayout'
import { useAuth } from '../../contexts/AuthContext'
import {
  createEvent, updateEvent, uploadCoverImage,
  addGuest, getGuests, watchEvent,
  quoteForGuests, GUEST_PRICE_ZAR, VAT_RATE,
} from '../../services/events'

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-primary/30">
      <div className="flex-1">
        <p className="font-semibold text-slate-800">{label}</p>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </label>
  )
}

const EVENT_TYPES = [
  { value: 'social', label: 'Social' },
  { value: 'corporate_conference', label: 'Corporate Conference' },
  { value: 'gala_dinner', label: 'Gala Dinner' },
  { value: 'team_building', label: 'Team Building' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'networking', label: 'Networking' },
]

export default function EventEditor() {
  const { eventId } = useParams()
  const isEdit = Boolean(eventId)
  const { user } = useAuth()
  const navigate = useNavigate()
  const csvRef = useRef(null)
  const coverRef = useRef(null)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      title: '', bio: '', locationName: '', locationAddress: '',
      startDate: '', endDate: '', ticketPriceZar: '',
      accommodationNearby: '', transportDetails: '',
      eventType: 'social', dressCode: '', capacity: '',
    },
  })

  const [isMultiDay, setIsMultiDay] = useState(false)
  const [isPaidEvent, setIsPaidEvent] = useState(false)
  const [isFree, setIsFree] = useState(false)
  const [allowPlusOne, setAllowPlusOne] = useState(false)
  const [collectsDietary, setCollectsDietary] = useState(false)
  const [carpooling, setCarpooling] = useState(false)
  const [transportProvided, setTransportProvided] = useState(false)

  const [guests, setGuests] = useState([])
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestCompany, setGuestCompany] = useState('')
  const [guestJobTitle, setGuestJobTitle] = useState('')
  const [guestTableNumber, setGuestTableNumber] = useState('')
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [loadingEvent, setLoadingEvent] = useState(isEdit)

  // Agenda state
  const [agenda, setAgenda] = useState([])

  // Load existing event + guests in edit mode
  useEffect(() => {
    if (!isEdit) return
    const unsub = watchEvent(eventId, (ev) => {
      if (!ev?.title) return
      setValue('title', ev.title || '')
      setValue('bio', ev.bio || '')
      setValue('locationName', ev.location?.name || '')
      setValue('locationAddress', ev.location?.address || '')
      setValue('startDate', ev.startDate
        ? (ev.startDate.toDate ? ev.startDate.toDate().toISOString().slice(0, 10) : ev.startDate)
        : '')
      setValue('endDate', ev.endDate
        ? (ev.endDate.toDate ? ev.endDate.toDate().toISOString().slice(0, 10) : ev.endDate)
        : '')
      setValue('ticketPriceZar', ev.ticketPriceZar || '')
      setValue('accommodationNearby', ev.accommodationNearby || '')
      setValue('transportDetails', ev.transportDetails || '')
      setValue('eventType', ev.eventType || 'social')
      setValue('dressCode', ev.dressCode || '')
      setValue('capacity', ev.capacity || '')
      setIsMultiDay(!!ev.isMultiDay)
      setIsPaidEvent(!!ev.isPaidEvent)
      setIsFree(!!ev.isFree)
      setAllowPlusOne(!!ev.allowPlusOne)
      setCollectsDietary(!!ev.collectsDietary)
      setCarpooling(!!ev.carpooling)
      setTransportProvided(!!ev.transportProvided)
      if (ev.coverImageUrl) setCoverPreview(ev.coverImageUrl)
      if (ev.agenda) setAgenda(ev.agenda)
      setLoadingEvent(false)
    })
    return unsub
  }, [isEdit, eventId, setValue])

  useEffect(() => {
    if (!isEdit) return
    getGuests(eventId).then(setGuests).catch(console.error)
  }, [isEdit, eventId])

  function handleCoverChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setCoverPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  function addGuestManually() {
    const name = guestName.trim()
    const email = guestEmail.trim()
    const phone = guestPhone.trim()
    const company = guestCompany.trim()
    const jobTitle = guestJobTitle.trim()
    const tableNumber = guestTableNumber.trim()
    if (!name) return
    setGuests(prev => [...prev, {
      _localId: crypto.randomUUID(),
      name, email, phone,
      ...(company ? { company } : {}),
      ...(jobTitle ? { jobTitle } : {}),
      ...(tableNumber ? { tableNumber } : {}),
    }])
    setGuestName(''); setGuestEmail(''); setGuestPhone('')
    setGuestCompany(''); setGuestJobTitle(''); setGuestTableNumber('')
  }

  function removeGuest(localId, firestoreId) {
    setGuests(prev => prev.filter(g => (firestoreId ? g.id !== firestoreId : g._localId !== localId)))
  }

  function handleCsvImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const imported = result.data
          .map(row => ({
            _localId: crypto.randomUUID(),
            name:  (row.name  || row.Name  || '').trim(),
            email: (row.email || row.Email || '').trim(),
            phone: (row.phone || row.Phone || '').trim(),
            company: (row.company || row.Company || '').trim() || undefined,
            jobTitle: (row.jobTitle || row['Job Title'] || '').trim() || undefined,
            tableNumber: (row.tableNumber || row['Table Number'] || '').trim() || undefined,
          }))
          .filter(g => g.name)
        setGuests(prev => [...prev, ...imported])
      },
      error: (err) => setSaveError('CSV parse error: ' + err.message),
    })
    e.target.value = ''
  }

  // Agenda helpers
  function addAgendaItem() {
    setAgenda(prev => [...prev, { _id: crypto.randomUUID(), time: '', title: '', description: '', speaker: '' }])
  }

  function updateAgendaItem(id, field, value) {
    setAgenda(prev => prev.map(item => item._id === id ? { ...item, [field]: value } : item))
  }

  function removeAgendaItem(id) {
    setAgenda(prev => prev.filter(item => item._id !== id))
  }

  const guestCount = guests.length
  const quote = quoteForGuests(guestCount)

  const onSubmit = async (formData) => {
    if (!user?.uid) return
    setSaving(true)
    setSaveError('')
    try {
      // Clean up agenda — remove internal _id before saving
      const cleanAgenda = agenda
        .filter(item => item.title.trim())
        .map(({ _id, ...rest }) => ({
          time: rest.time || '',
          title: rest.title.trim(),
          description: rest.description || '',
          speaker: rest.speaker || '',
        }))

      const payload = {
        title: formData.title,
        bio: formData.bio || '',
        location: {
          name: formData.locationName || '',
          address: formData.locationAddress || '',
        },
        startDate: formData.startDate || null,
        isMultiDay,
        endDate: isMultiDay ? (formData.endDate || null) : null,
        isPaidEvent,
        isFree,
        ticketPriceZar: isPaidEvent ? (parseFloat(formData.ticketPriceZar) || 0) : null,
        accommodationNearby: formData.accommodationNearby || '',
        carpooling,
        transportProvided,
        transportDetails: transportProvided ? (formData.transportDetails || '') : '',
        allowPlusOne,
        collectsDietary,
        eventType: formData.eventType || 'social',
        dressCode: formData.dressCode || '',
        capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
        agenda: cleanAgenda,
      }

      let targetId = eventId
      if (isEdit) {
        await updateEvent(eventId, payload)
      } else {
        const ref = await createEvent(user.uid, payload)
        targetId = ref.id
      }

      // Upload cover if selected
      if (coverFile && targetId) {
        const url = await uploadCoverImage(targetId, coverFile)
        await updateEvent(targetId, { coverImageUrl: url })
      }

      // Add new (local-only) guests to Firestore
      const newGuests = guests.filter(g => !g.id)
      for (const g of newGuests) {
        await addGuest(targetId, {
          name: g.name,
          email: g.email || '',
          phone: g.phone || '',
          ...(g.company ? { company: g.company } : {}),
          ...(g.jobTitle ? { jobTitle: g.jobTitle } : {}),
          ...(g.tableNumber ? { tableNumber: g.tableNumber } : {}),
        })
      }

      navigate(`/events/${targetId}`)
    } catch (err) {
      console.error('EventEditor save error:', err)
      setSaveError(err.message || 'Failed to save event. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingEvent) {
    return (
      <DashboardLayout industry="events" pageTitle={isEdit ? 'Edit Event' : 'New Event'}>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout industry="events" pageTitle={isEdit ? 'Edit Event' : 'New Event'}>
      <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl space-y-6">

        {/* Basic info */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">Event Details</h3>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Event Title <span className="text-red-500">*</span></label>
            <input
              {...register('title', { required: 'Title is required' })}
              placeholder="e.g. Annual Staff Gala"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Description / Bio</label>
            <textarea
              {...register('bio')}
              rows={3}
              placeholder="What's this event about?"
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Cover image */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cover Image</label>
            {coverPreview && (
              <img src={coverPreview} alt="Cover preview" className="mb-3 h-40 w-full rounded-2xl object-cover" />
            )}
            <button
              type="button"
              onClick={() => coverRef.current?.click()}
              className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-primary hover:text-primary"
            >
              <Upload size={15} />
              {coverPreview ? 'Change cover image' : 'Upload cover image'}
            </button>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
          </div>
        </div>

        {/* Corporate / Event Type */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">Event Type &amp; Format</h3>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Event Type</label>
            <select
              {...register('eventType')}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {EVENT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Dress Code <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              {...register('dressCode')}
              placeholder="e.g. Black tie, Smart casual"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Max Capacity <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="number"
              min="1"
              {...register('capacity')}
              placeholder="e.g. 200"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Location */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">Location</h3>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Venue Name</label>
            <input
              {...register('locationName')}
              placeholder="e.g. Sandton Convention Centre"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Address</label>
            <input
              {...register('locationAddress')}
              placeholder="e.g. 161 Maude St, Sandton"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Dates */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">Date &amp; Time</h3>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Start Date</label>
            <input
              type="date"
              {...register('startDate')}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <ToggleRow
            label="Multi-day event"
            description="Enable if the event spans more than one day"
            checked={isMultiDay}
            onChange={setIsMultiDay}
          />
          {isMultiDay && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">End Date</label>
              <input
                type="date"
                {...register('endDate')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>

        {/* Ticketing */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">Ticketing</h3>
          <ToggleRow label="Free event" checked={isFree} onChange={setIsFree} />
          <ToggleRow label="Paid event (ticket price)" checked={isPaidEvent} onChange={setIsPaidEvent} />
          {isPaidEvent && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ticket Price (ZAR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                {...register('ticketPriceZar')}
                placeholder="0.00"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>

        {/* Logistics */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">Logistics</h3>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Accommodation Nearby</label>
            <textarea
              {...register('accommodationNearby')}
              rows={2}
              placeholder="Nearby hotels, B&Bs, etc."
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <ToggleRow label="Carpooling available" checked={carpooling} onChange={setCarpooling} />
          <ToggleRow label="Transport provided" checked={transportProvided} onChange={setTransportProvided} />
          {transportProvided && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Transport Details</label>
              <input
                {...register('transportDetails')}
                placeholder="e.g. Bus departs from Sandton City at 18:00"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}
        </div>

        {/* Agenda / Programme */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Agenda / Programme</h3>
            <button
              type="button"
              onClick={addAgendaItem}
              className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/20"
            >
              <Plus size={13} />
              Add item
            </button>
          </div>

          {agenda.length === 0 && (
            <p className="text-sm text-slate-400">No agenda items yet. Add items to display a programme on the invite page.</p>
          )}

          {agenda.map((item, idx) => (
            <div key={item._id} className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Item {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeAgendaItem(item._id)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Time</label>
                  <div className="relative">
                    <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={item.time}
                      onChange={e => updateAgendaItem(item._id, 'time', e.target.value)}
                      placeholder="e.g. 09:00"
                      className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Title <span className="text-red-400">*</span></label>
                  <input
                    value={item.title}
                    onChange={e => updateAgendaItem(item._id, 'title', e.target.value)}
                    placeholder="e.g. Welcome Address"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Speaker / Host <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  value={item.speaker}
                  onChange={e => updateAgendaItem(item._id, 'speaker', e.target.value)}
                  placeholder="e.g. Jane Smith, CEO"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Description <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea
                  value={item.description}
                  onChange={e => updateAgendaItem(item._id, 'description', e.target.value)}
                  rows={2}
                  placeholder="Brief description of this session"
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          ))}
        </div>

        {/* RSVP options */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">RSVP Options</h3>
          <ToggleRow
            label="Allow plus-one"
            description="Guests can bring an extra person"
            checked={allowPlusOne}
            onChange={setAllowPlusOne}
          />
          <ToggleRow
            label="Collect dietary requirements"
            description="Ask guests about dietary needs"
            checked={collectsDietary}
            onChange={setCollectsDietary}
          />
        </div>

        {/* Guest list */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Guest List</h3>
            <div className="flex items-center gap-2">
              <Users size={14} className="text-slate-400" />
              <span className="text-sm font-semibold text-slate-600">{guestCount}</span>
            </div>
          </div>

          {/* Manual add */}
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuestManually())}
              placeholder="Name *"
              className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <input
              value={guestEmail}
              onChange={e => setGuestEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuestManually())}
              placeholder="Email"
              type="email"
              className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <input
              value={guestPhone}
              onChange={e => setGuestPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuestManually())}
              placeholder="Phone"
              className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <input
              value={guestCompany}
              onChange={e => setGuestCompany(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuestManually())}
              placeholder="Company (optional)"
              className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <input
              value={guestJobTitle}
              onChange={e => setGuestJobTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuestManually())}
              placeholder="Job title (optional)"
              className="rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex gap-2">
              <input
                value={guestTableNumber}
                onChange={e => setGuestTableNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGuestManually())}
                placeholder="Table # (optional)"
                className="flex-1 rounded-2xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={addGuestManually}
                disabled={!guestName.trim()}
                className="flex items-center gap-1 rounded-2xl bg-primary px-3 py-2.5 text-sm font-bold text-white transition hover:bg-[#4e7d6d] disabled:opacity-40"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* CSV import */}
          <div>
            <button
              type="button"
              onClick={() => csvRef.current?.click()}
              className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-primary hover:text-primary"
            >
              <Upload size={14} />
              Import CSV (name, email, phone, company, jobTitle, tableNumber)
            </button>
            <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvImport} />
          </div>

          {/* Guest list display */}
          {guests.length > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-100">
              {guests.map((g, i) => (
                <div
                  key={g.id || g._localId}
                  className={`flex items-center gap-3 px-4 py-2.5 ${i !== 0 ? 'border-t border-slate-100' : ''}`}
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {g.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{g.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[g.email, g.phone, g.company, g.tableNumber ? `Table ${g.tableNumber}` : ''].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {!g.id && (
                    <button
                      type="button"
                      onClick={() => removeGuest(g._localId, g.id)}
                      className="flex-shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Price quote */}
          {guestCount > 0 && (
            <div className="rounded-2xl bg-primary/5 px-4 py-3 text-sm">
              <p className="font-semibold text-slate-700">
                {guestCount} guests × R{GUEST_PRICE_ZAR} = R{quote.net.toLocaleString('en-ZA')}
                {' '}+ 15% VAT = <span className="text-primary font-bold">R{quote.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">Charged when you launch the event</p>
            </div>
          )}
        </div>

        {saveError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {saveError}
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-white transition hover:bg-[#4e7d6d] disabled:opacity-60"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving…
              </>
            ) : (
              isEdit ? 'Save Changes' : 'Create Event'
            )}
          </button>
        </div>
      </form>
    </DashboardLayout>
  )
}
