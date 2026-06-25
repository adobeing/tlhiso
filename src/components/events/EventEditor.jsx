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
  getTables, addTable, updateTable, removeTable,
  blankTier, blankQuestion, tierCapacity, tiersSold, tierRevenue,
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

const INPUT_CLS = 'w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'
const SMALL_INPUT_CLS = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'

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
      startDate: '', endDate: '', startTime: '', endTime: '',
      ticketPriceZar: '',
      accommodationNearby: '', transportDetails: '',
      eventType: 'social', dressCode: '', capacity: '',
      maxPlusOnes: '', rsvpDeadline: '', guestMessage: '',
      parkingInfo: '', accessibilityInfo: '',
      livestreamUrl: '', giftRegistryUrl: '',
      hashtag: '', whatsappContact: '',
      reminderDaysBefore: '2',
    },
  })

  // Existing toggles
  const [isMultiDay, setIsMultiDay] = useState(false)
  const [isPaidEvent, setIsPaidEvent] = useState(false)
  const [isFree, setIsFree] = useState(false)
  const [allowPlusOne, setAllowPlusOne] = useState(false)
  const [collectsDietary, setCollectsDietary] = useState(false)
  const [carpooling, setCarpooling] = useState(false)
  const [transportProvided, setTransportProvided] = useState(false)

  // New toggles
  const [useTiers, setUseTiers] = useState(false)
  const [rsvpRequired, setRsvpRequired] = useState(true)
  const [isHybrid, setIsHybrid] = useState(false)
  const [autoReminder, setAutoReminder] = useState(true)

  // New repeatable state
  const [ticketTiers, setTicketTiers] = useState([])
  const [customQuestions, setCustomQuestions] = useState([])
  const [localTables, setLocalTables] = useState([])
  const [savedTables, setSavedTables] = useState([])

  // Existing guest/cover/agenda state
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
      setValue('startTime', ev.startTime || '')
      setValue('endTime', ev.endTime || '')
      setValue('ticketPriceZar', ev.ticketPriceZar || '')
      setValue('accommodationNearby', ev.accommodationNearby || '')
      setValue('transportDetails', ev.transportDetails || '')
      setValue('eventType', ev.eventType || 'social')
      setValue('dressCode', ev.dressCode || '')
      setValue('capacity', ev.capacity || '')
      setValue('maxPlusOnes', ev.maxPlusOnes ?? '')
      setValue('rsvpDeadline', ev.rsvpDeadline || '')
      setValue('guestMessage', ev.guestMessage || '')
      setValue('parkingInfo', ev.parkingInfo || '')
      setValue('accessibilityInfo', ev.accessibilityInfo || '')
      setValue('livestreamUrl', ev.livestreamUrl || '')
      setValue('giftRegistryUrl', ev.giftRegistryUrl || '')
      setValue('hashtag', ev.hashtag || '')
      setValue('whatsappContact', ev.whatsappContact || '')
      setValue('reminderDaysBefore', ev.reminderDaysBefore ?? '2')
      setIsMultiDay(!!ev.isMultiDay)
      setIsPaidEvent(!!ev.isPaidEvent)
      setIsFree(!!ev.isFree)
      setAllowPlusOne(!!ev.allowPlusOne)
      setCollectsDietary(!!ev.collectsDietary)
      setCarpooling(!!ev.carpooling)
      setTransportProvided(!!ev.transportProvided)
      setUseTiers(!!ev.useTiers)
      setTicketTiers(ev.ticketTiers || [])
      setRsvpRequired(ev.rsvpRequired !== false)
      setCustomQuestions(ev.customQuestions || [])
      setIsHybrid(!!ev.isHybrid)
      setAutoReminder(ev.autoReminder !== false)
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

  useEffect(() => {
    if (!isEdit) return
    getTables(eventId).then(tables => {
      setSavedTables(tables)
      setLocalTables(tables.map(t => ({ ...t })))
    }).catch(console.error)
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

  // Tier helpers
  function addTierRow() {
    setTicketTiers(prev => [...prev, blankTier()])
  }

  function updateTierRow(id, field, value) {
    setTicketTiers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  function removeTierRow(id) {
    setTicketTiers(prev => prev.filter(t => t.id !== id))
  }

  // Table helpers
  function addTableRow() {
    setLocalTables(prev => [...prev, { _localId: crypto.randomUUID(), name: '', seats: '', notes: '' }])
  }

  function updateTableRow(key, field, value) {
    setLocalTables(prev => prev.map(t => (t.id === key || t._localId === key) ? { ...t, [field]: value } : t))
  }

  function removeTableRow(key) {
    setLocalTables(prev => prev.filter(t => t.id !== key && t._localId !== key))
  }

  // Question helpers
  function addQuestion() {
    setCustomQuestions(prev => [...prev, blankQuestion()])
  }

  function updateQuestion(id, field, value) {
    setCustomQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q))
  }

  function removeQuestion(id) {
    setCustomQuestions(prev => prev.filter(q => q.id !== id))
  }

  const guestCount = guests.length
  const quote = quoteForGuests(guestCount)

  const onSubmit = async (formData) => {
    if (!user?.uid) return
    setSaving(true)
    setSaveError('')
    try {
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
        startTime: formData.startTime || '',
        endTime: formData.endTime || '',
        isMultiDay,
        endDate: isMultiDay ? (formData.endDate || null) : null,
        isPaidEvent,
        isFree,
        ticketPriceZar: isPaidEvent && !useTiers ? (parseFloat(formData.ticketPriceZar) || 0) : null,
        useTiers: isPaidEvent ? useTiers : false,
        ticketTiers: isPaidEvent && useTiers ? ticketTiers.map(t => ({
          id: t.id, name: t.name, priceZar: Number(t.priceZar) || 0,
          quantity: Number(t.quantity) || 0, sold: Number(t.sold) || 0,
        })) : [],
        accommodationNearby: formData.accommodationNearby || '',
        carpooling,
        transportProvided,
        transportDetails: transportProvided ? (formData.transportDetails || '') : '',
        parkingInfo: formData.parkingInfo || '',
        accessibilityInfo: formData.accessibilityInfo || '',
        allowPlusOne,
        collectsDietary,
        rsvpRequired,
        maxPlusOnes: allowPlusOne && formData.maxPlusOnes ? parseInt(formData.maxPlusOnes, 10) : null,
        rsvpDeadline: formData.rsvpDeadline || '',
        guestMessage: formData.guestMessage || '',
        customQuestions: customQuestions.map(q => ({
          id: q.id, label: q.label, type: q.type, options: q.options, required: q.required,
        })),
        eventType: formData.eventType || 'social',
        dressCode: formData.dressCode || '',
        capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
        isHybrid,
        livestreamUrl: isHybrid ? (formData.livestreamUrl || '') : '',
        giftRegistryUrl: formData.giftRegistryUrl || '',
        hashtag: (formData.hashtag || '').replace(/^#/, ''),
        whatsappContact: formData.whatsappContact || '',
        autoReminder,
        reminderDaysBefore: autoReminder ? (parseInt(formData.reminderDaysBefore, 10) || 2) : null,
        agenda: cleanAgenda,
      }

      let targetId = eventId
      if (isEdit) {
        await updateEvent(eventId, payload)
      } else {
        const ref = await createEvent(user.uid, payload)
        targetId = ref.id
      }

      if (coverFile && targetId) {
        const url = await uploadCoverImage(targetId, coverFile)
        await updateEvent(targetId, { coverImageUrl: url })
      }

      // Sync tables subcollection
      const tableRemoveIds = savedTables
        .filter(st => !localTables.find(lt => lt.id === st.id))
        .map(st => st.id)
      for (const tId of tableRemoveIds) {
        await removeTable(targetId, tId)
      }
      for (const t of localTables.filter(lt => !!lt.id)) {
        await updateTable(targetId, t.id, {
          name: t.name || '', seats: Number(t.seats) || 0, notes: t.notes || '',
        })
      }
      for (const t of localTables.filter(lt => !lt.id)) {
        if (t.name.trim()) {
          await addTable(targetId, {
            name: t.name || '', seats: Number(t.seats) || 0, notes: t.notes || '',
          })
        }
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
              className={INPUT_CLS}
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

        {/* Event Type & Format */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">Event Type &amp; Format</h3>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Event Type</label>
            <select
              {...register('eventType')}
              className={INPUT_CLS}
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
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Max Capacity <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="number"
              min="1"
              {...register('capacity')}
              placeholder="e.g. 200"
              className={INPUT_CLS}
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
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Address</label>
            <input
              {...register('locationAddress')}
              placeholder="e.g. 161 Maude St, Sandton"
              className={INPUT_CLS}
            />
          </div>
        </div>

        {/* Date & Time */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">Date &amp; Time</h3>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Start Date</label>
            <input
              type="date"
              {...register('startDate')}
              className={INPUT_CLS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Start Time <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="time"
                {...register('startTime')}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">End Time <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="time"
                {...register('endTime')}
                className={INPUT_CLS}
              />
            </div>
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
                className={INPUT_CLS}
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
            <>
              <ToggleRow
                label="Use ticket tiers"
                description="Multiple ticket categories with separate pricing (display/tracking only)"
                checked={useTiers}
                onChange={setUseTiers}
              />
              {!useTiers ? (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Ticket Price (ZAR)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    {...register('ticketPriceZar')}
                    placeholder="0.00"
                    className={INPUT_CLS}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {ticketTiers.map(tier => (
                    <div key={tier.id} className="rounded-2xl border border-slate-200 p-3 grid gap-2 sm:grid-cols-4 items-end">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Tier name</label>
                        <input
                          value={tier.name}
                          onChange={e => updateTierRow(tier.id, 'name', e.target.value)}
                          placeholder="e.g. VIP"
                          className={SMALL_INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Price (ZAR)</label>
                        <input
                          type="number" min="0" step="0.01"
                          value={tier.priceZar}
                          onChange={e => updateTierRow(tier.id, 'priceZar', e.target.value)}
                          placeholder="0.00"
                          className={SMALL_INPUT_CLS}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Qty available</label>
                        <input
                          type="number" min="0"
                          value={tier.quantity}
                          onChange={e => updateTierRow(tier.id, 'quantity', e.target.value)}
                          placeholder="0"
                          className={SMALL_INPUT_CLS}
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="mb-1 block text-xs font-semibold text-slate-600">Sold</label>
                          <input
                            type="number" min="0"
                            value={tier.sold}
                            onChange={e => updateTierRow(tier.id, 'sold', e.target.value)}
                            placeholder="0"
                            className={SMALL_INPUT_CLS}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTierRow(tier.id)}
                          className="mb-0.5 self-end rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addTierRow}
                    className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/20"
                  >
                    <Plus size={13} /> Add tier
                  </button>
                  {ticketTiers.length > 0 && (
                    <div className="rounded-2xl bg-primary/5 px-4 py-3 text-sm">
                      <p className="font-semibold text-slate-700">
                        Capacity: {tierCapacity(ticketTiers)} · Sold: {tiersSold(ticketTiers)} · Revenue: R{tierRevenue(ticketTiers).toLocaleString('en-ZA')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Seating & Tables */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Seating &amp; Tables</h3>
            <button
              type="button"
              onClick={addTableRow}
              className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/20"
            >
              <Plus size={13} /> Add table
            </button>
          </div>
          {localTables.length === 0 && (
            <p className="text-sm text-slate-400">No tables yet. Add tables to enable seating assignments.</p>
          )}
          {localTables.map(t => {
            const k = t.id || t._localId
            return (
              <div key={k} className="grid gap-2 sm:grid-cols-3 items-end rounded-2xl border border-slate-100 p-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Table name</label>
                  <input
                    value={t.name}
                    onChange={e => updateTableRow(k, 'name', e.target.value)}
                    placeholder="e.g. Table 1"
                    className={SMALL_INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Seats</label>
                  <input
                    type="number" min="1"
                    value={t.seats}
                    onChange={e => updateTableRow(k, 'seats', e.target.value)}
                    placeholder="0"
                    className={SMALL_INPUT_CLS}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input
                      value={t.notes}
                      onChange={e => updateTableRow(k, 'notes', e.target.value)}
                      placeholder="e.g. near stage"
                      className={SMALL_INPUT_CLS}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTableRow(k)}
                    className="mb-0.5 self-end rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
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
                className={INPUT_CLS}
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Parking Information <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              {...register('parkingInfo')}
              rows={2}
              placeholder="Parking availability, cost, directions…"
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Accessibility Information <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              {...register('accessibilityInfo')}
              rows={2}
              placeholder="Wheelchair access, hearing loops, parking bays…"
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
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

        {/* RSVP Options */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">RSVP Options</h3>
          <ToggleRow
            label="RSVP required"
            description="Guests must confirm attendance before viewing event details"
            checked={rsvpRequired}
            onChange={setRsvpRequired}
          />
          <ToggleRow
            label="Allow plus-one"
            description="Guests can bring an extra person"
            checked={allowPlusOne}
            onChange={setAllowPlusOne}
          />
          {allowPlusOne && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Max plus-ones per guest <span className="text-slate-400 font-normal">(optional)</span></label>
              <input
                type="number"
                min="1"
                {...register('maxPlusOnes')}
                placeholder="e.g. 2 (leave blank for unlimited)"
                className={INPUT_CLS}
              />
            </div>
          )}
          <ToggleRow
            label="Collect dietary requirements"
            description="Ask guests about dietary needs"
            checked={collectsDietary}
            onChange={setCollectsDietary}
          />
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">RSVP Deadline <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="date"
              {...register('rsvpDeadline')}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Message to guests <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea
              {...register('guestMessage')}
              rows={2}
              placeholder="A personal note shown highlighted on the invite page…"
              className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Custom Questions */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Custom Questions</h3>
            <button
              type="button"
              onClick={addQuestion}
              className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/20"
            >
              <Plus size={13} /> Add question
            </button>
          </div>
          {customQuestions.length === 0 && (
            <p className="text-sm text-slate-400">No custom questions. Add questions to collect additional info from guests.</p>
          )}
          {customQuestions.map((q, idx) => (
            <div key={q.id} className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Question {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Question label</label>
                  <input
                    value={q.label}
                    onChange={e => updateQuestion(q.id, 'label', e.target.value)}
                    placeholder="e.g. Which session will you attend?"
                    className={SMALL_INPUT_CLS}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Answer type</label>
                  <select
                    value={q.type}
                    onChange={e => updateQuestion(q.id, 'type', e.target.value)}
                    className={SMALL_INPUT_CLS}
                  >
                    <option value="text">Short text</option>
                    <option value="select">Dropdown</option>
                    <option value="checkbox">Yes / No</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id={`q-req-${q.id}`}
                    checked={q.required}
                    onChange={e => updateQuestion(q.id, 'required', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor={`q-req-${q.id}`} className="text-xs font-semibold text-slate-600 cursor-pointer">Required</label>
                </div>
              </div>
              {q.type === 'select' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Options <span className="text-slate-400 font-normal">(comma-separated)</span></label>
                  <input
                    value={q.options.join(', ')}
                    onChange={e => updateQuestion(q.id, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="Option A, Option B, Option C"
                    className={SMALL_INPUT_CLS}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Online & Extras */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">Online &amp; Extras</h3>
          <ToggleRow
            label="Hybrid / virtual event"
            description="Event has an online livestream component"
            checked={isHybrid}
            onChange={setIsHybrid}
          />
          {isHybrid && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Livestream URL</label>
              <input
                {...register('livestreamUrl')}
                type="url"
                placeholder="https://..."
                className={INPUT_CLS}
              />
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Gift Registry URL <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              {...register('giftRegistryUrl')}
              type="url"
              placeholder="https://..."
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Event Hashtag <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              {...register('hashtag')}
              placeholder="#YourHashtag"
              className={INPUT_CLS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">WhatsApp Contact Number <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              {...register('whatsappContact')}
              placeholder="+27 81 234 5678"
              className={INPUT_CLS}
            />
          </div>
        </div>

        {/* Reminders */}
        <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800">Reminders</h3>
          <ToggleRow
            label="Send automatic reminder"
            description="Remind guests via email/SMS before the event"
            checked={autoReminder}
            onChange={setAutoReminder}
          />
          {autoReminder && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Days before event</label>
              <input
                type="number"
                min="1"
                max="30"
                {...register('reminderDaysBefore')}
                className={INPUT_CLS}
              />
            </div>
          )}
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
