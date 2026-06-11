// Automations Module — shared across all 4 industry dashboards.
//
// List view:  stat cards + automation cards with live run metrics
// Wizard:     3-step full-page builder (Trigger → Message → Review)
// Cloud Function: processAutomations runs every 60 min server-side

import { useState } from 'react'
import {
  addDoc, updateDoc, deleteDoc,
  doc, collection, serverTimestamp,
} from 'firebase/firestore'
import {
  Zap, PlusCircle, Pencil, Trash2, ToggleLeft, ToggleRight,
  Clock, UserPlus, Calendar, Gift, Mail, Phone, MessageSquare,
  AlertTriangle, CheckCircle, Loader2, ArrowLeft, ChevronRight,
  Play, Pause, BarChart2, RefreshCw, Sparkles,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'
import { db } from '../../services/firebase'

// ── Constants ─────────────────────────────────────────────────────────────────
const TRIGGERS = [
  {
    key: 'new_contact',
    label: 'New Contact',
    Icon: UserPlus,
    color: 'bg-blue-50 text-blue-600',
    ring:  'ring-blue-200',
    description: 'Send a welcome message the moment a new contact is added to your account.',
    delayOptions: [
      { value: 0,    label: 'Immediately' },
      { value: 60,   label: '1 hour later' },
      { value: 1440, label: '24 hours later' },
      { value: 4320, label: '3 days later'  },
    ],
  },
  {
    key: 'appointment_booked',
    label: 'Appointment Booked',
    Icon: Calendar,
    color: 'bg-emerald-50 text-emerald-600',
    ring:  'ring-emerald-200',
    description: 'Automatically confirm, remind or prepare a contact after a booking is made.',
    delayOptions: [
      { value: 0,    label: 'Immediately' },
      { value: 60,   label: '1 hour later' },
      { value: 1440, label: '1 day later'  },
    ],
  },
  {
    key: 'birthday',
    label: 'Contact Birthday',
    Icon: Gift,
    color: 'bg-amber-50 text-amber-600',
    ring:  'ring-amber-200',
    description: 'Wish contacts a happy birthday automatically. Requires date of birth on their profile.',
    delayOptions: [
      { value: 0,   label: 'On the day'    },
      { value: -60, label: '1 day before'  },
    ],
  },
  {
    key: 'inactive',
    label: 'Re-engagement',
    Icon: Clock,
    color: 'bg-purple-50 text-purple-600',
    ring:  'ring-purple-200',
    description: 'Reach out to contacts you haven\'t been in touch with for a while.',
    delayOptions: [
      { value: 30, label: 'After 30 days of silence' },
      { value: 60, label: 'After 60 days of silence' },
      { value: 90, label: 'After 90 days of silence' },
    ],
  },
]

const CHANNELS = [
  { key: 'sms',      label: 'SMS',      Icon: Phone,          color: 'text-blue-600',    bg: 'bg-blue-50',    description: 'Text message to mobile number'   },
  { key: 'email',    label: 'Email',    Icon: Mail,           color: 'text-emerald-600', bg: 'bg-emerald-50', description: 'Rich email with subject line'     },
  { key: 'whatsapp', label: 'WhatsApp', Icon: MessageSquare,  color: 'text-green-600',   bg: 'bg-green-50',   description: 'WhatsApp message via Twilio'      },
]

const MERGE_TAGS = [
  { tag: '{name}',    label: 'Name'    },
  { tag: '{email}',   label: 'Email'   },
  { tag: '{phone}',   label: 'Phone'   },
  { tag: '{company}', label: 'Company' },
]

const BLANK = {
  name:    '',
  trigger: 'new_contact',
  delay:   0,
  channel: 'sms',
  subject: '',
  body:    '',
  active:  true,
}

function triggerMeta(key) { return TRIGGERS.find(t => t.key === key) ?? TRIGGERS[0] }
function channelMeta(key) { return CHANNELS.find(c => c.key === key) ?? CHANNELS[0] }

function delayLabel(trigger, delay) {
  const opts = triggerMeta(trigger).delayOptions
  return opts.find(o => o.value === delay)?.label ?? `${delay}m delay`
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AutomationsModule({ industry }) {
  const { user } = useAuth()
  const uid = user?.uid
  const automations = useCollection(uid ? `users/${uid}/automations` : null)

  const [view,    setView]    = useState('list')   // 'list' | 'wizard'
  const [step,    setStep]    = useState(1)
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState(BLANK)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const [deleteId,setDeleteId]= useState(null)

  // ── Open wizard ─────────────────────────────────────────────────────────────
  function openNew() {
    setEditing(null); setForm(BLANK); setStep(1); setError(null); setView('wizard')
  }
  function openEdit(a) {
    setEditing(a)
    setForm({
      name:    a.name    ?? '',
      trigger: a.trigger ?? 'new_contact',
      delay:   a.delay   ?? 0,
      channel: a.channel ?? 'sms',
      subject: a.subject ?? '',
      body:    a.body    ?? '',
      active:  a.active  ?? true,
    })
    setStep(1); setError(null); setView('wizard')
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function save() {
    if (!form.name.trim()) return setError('Automation name is required.')
    if (!form.body.trim()) return setError('Message body is required.')
    if (form.channel === 'email' && !form.subject.trim()) return setError('Email subject is required.')
    setSaving(true); setError(null)
    try {
      const payload = {
        name:      form.name.trim(),
        trigger:   form.trigger,
        delay:     form.delay,
        channel:   form.channel,
        subject:   form.channel === 'email' ? form.subject.trim() : null,
        body:      form.body.trim(),
        active:    form.active,
        industry,
        updatedAt: serverTimestamp(),
      }
      if (editing) {
        await updateDoc(doc(db, 'users', uid, 'automations', editing.id), payload)
      } else {
        await addDoc(collection(db, 'users', uid, 'automations'), {
          ...payload, createdAt: serverTimestamp(), runCount: 0,
        })
      }
      setView('list')
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false) }
  }

  async function toggleActive(a) {
    await updateDoc(doc(db, 'users', uid, 'automations', a.id), { active: !a.active })
  }

  async function confirmDelete() {
    if (!deleteId) return
    await deleteDoc(doc(db, 'users', uid, 'automations', deleteId))
    setDeleteId(null)
  }

  function insertTag(tag) {
    setForm(f => ({ ...f, body: f.body + tag }))
  }

  const step1Ready = !!form.name.trim()
  const step2Ready = !!form.body.trim() && (form.channel !== 'email' || !!form.subject.trim())

  const activeCount = automations.filter(a => a.active).length
  const totalRuns   = automations.reduce((s, a) => s + (a.runCount ?? 0), 0)

  // ── WIZARD view ─────────────────────────────────────────────────────────────
  if (view === 'wizard') {
    const STEPS = [
      { n: 1, label: 'Trigger'  },
      { n: 2, label: 'Message'  },
      { n: 3, label: 'Review'   },
    ]
    const canGoNext = step === 1 ? step1Ready : step === 2 ? step2Ready : false
    const tm = triggerMeta(form.trigger)
    const ch = channelMeta(form.channel)

    return (
      <div className="-mx-6 -mt-6 flex min-h-[calc(100vh-4rem)] flex-col bg-slate-50/50">

        {/* Progress bar */}
        <div className="shrink-0 border-b border-slate-200/60 bg-white px-8 py-4">
          <div className="flex items-center gap-6">
            <button onClick={() => step === 1 ? setView('list') : setStep(s => s - 1)}
              className="flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary hover:text-primary">
              <ArrowLeft size={15} /> {step === 1 ? 'Automations' : 'Back'}
            </button>
            <div className="flex flex-1 items-center justify-center gap-1">
              {STEPS.map((s, i) => {
                const isDone   = step > s.n
                const isActive = step === s.n
                return (
                  <div key={s.n} className="flex items-center">
                    <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                      isActive ? 'bg-primary text-white shadow-md shadow-primary/25'
                      : isDone  ? 'text-primary' : 'text-slate-400'
                    }`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                        isActive ? 'bg-white/20' : isDone ? 'bg-primary/10' : 'bg-slate-100'
                      }`}>{isDone ? '✓' : s.n}</span>
                      {s.label}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`mx-1 h-px w-8 transition-colors ${step > s.n ? 'bg-primary' : 'bg-slate-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
            {step < 3 && (
              <button onClick={() => setStep(s => s + 1)} disabled={!canGoNext}
                className="flex shrink-0 items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#4e7d6d] disabled:cursor-not-allowed disabled:opacity-40">
                Next <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Trigger ── */}
          {step === 1 && (
            <div className="mx-auto max-w-2xl px-6 py-12">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-900">{editing ? 'Edit automation' : 'New automation'}</h2>
                <p className="mt-2 text-sm text-slate-500">Choose what triggers this automation and give it a name.</p>
              </div>
              <div className="space-y-5">

                {/* Name */}
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Automation name *</span>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Welcome new patient"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  </label>
                </div>

                {/* Trigger cards */}
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Trigger</p>
                  <div className="grid grid-cols-2 gap-3">
                    {TRIGGERS.map(t => {
                      const active = form.trigger === t.key
                      return (
                        <button key={t.key} type="button"
                          onClick={() => setForm(f => ({ ...f, trigger: t.key, delay: t.delayOptions[0].value }))}
                          className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                            active
                              ? `border-primary bg-primary/5 ring-1 ring-primary/20`
                              : 'border-slate-200 hover:border-primary/30 hover:bg-slate-50'
                          }`}>
                          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.color}`}>
                            <t.Icon size={18} />
                          </span>
                          <div className="min-w-0">
                            <p className={`text-sm font-bold ${active ? 'text-primary' : 'text-slate-700'}`}>{t.label}</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{t.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Delay */}
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Send timing</p>
                  <div className="flex flex-wrap gap-2">
                    {triggerMeta(form.trigger).delayOptions.map(o => (
                      <button key={o.value} type="button"
                        onClick={() => setForm(f => ({ ...f, delay: o.value }))}
                        className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                          form.delay === o.value
                            ? 'border-primary bg-primary/10 text-primary font-bold'
                            : 'border-slate-200 text-slate-600 hover:border-primary/30 hover:bg-slate-50'
                        }`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
              {step1Ready && (
                <div className="mt-6 flex justify-end">
                  <button onClick={() => setStep(2)}
                    className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#4e7d6d]">
                    Write Message <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Message ── */}
          {step === 2 && (
            <div className="mx-auto max-w-2xl px-6 py-12">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-900">Write your message</h2>
                <p className="mt-2 text-sm text-slate-500">Choose a channel and write the message that will be sent automatically.</p>
              </div>
              <div className="space-y-5">

                {/* Channel */}
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Channel</p>
                  <div className="grid grid-cols-3 gap-3">
                    {CHANNELS.map(c => {
                      const active = form.channel === c.key
                      return (
                        <button key={c.key} type="button"
                          onClick={() => setForm(f => ({ ...f, channel: c.key }))}
                          className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition ${
                            active
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-slate-200 hover:border-primary/30 hover:bg-slate-50'
                          }`}>
                          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} ${c.color}`}>
                            <c.Icon size={18} />
                          </span>
                          <span className={`text-sm font-bold ${active ? 'text-primary' : 'text-slate-700'}`}>{c.label}</span>
                          <span className="text-[10px] text-center text-slate-400 leading-tight">{c.description}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Email subject */}
                {form.channel === 'email' && (
                  <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Email subject *</span>
                      <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder="e.g. Welcome to our practice!"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                    </label>
                  </div>
                )}

                {/* Body */}
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Message *</p>
                    {form.channel === 'sms' && (
                      <span className={`text-[11px] font-semibold ${form.body.length > 160 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {form.body.length} chars · {Math.ceil(form.body.length / 160) || 1} SMS part{Math.ceil(form.body.length / 160) > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Merge tag chips */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-400 self-center mr-1">Personalise:</span>
                    {MERGE_TAGS.map(({ tag, label }) => (
                      <button key={tag} type="button" onClick={() => insertTag(tag)}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600 transition hover:border-primary hover:bg-primary/5 hover:text-primary">
                        {tag}
                      </button>
                    ))}
                  </div>

                  <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                    rows={6} placeholder={`Hi {name}, thank you for…`}
                    className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />

                  {/* Preview */}
                  {form.body.trim() && (
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Preview</p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {form.body.replace(/\{name\}/gi, 'Thabo').replace(/\{email\}/gi, 'thabo@example.com').replace(/\{phone\}/gi, '+27821234567').replace(/\{company\}/gi, 'Acme Ltd')}
                      </p>
                    </div>
                  )}
                </div>

              </div>
              <div className="mt-8 flex items-center justify-between">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:border-primary hover:text-primary">
                  <ArrowLeft size={15} /> Trigger
                </button>
                <button onClick={() => setStep(3)} disabled={!step2Ready}
                  className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#4e7d6d] disabled:cursor-not-allowed disabled:opacity-40">
                  Review <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <div className="mx-auto max-w-2xl px-6 py-12">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-900">Review & save</h2>
                <p className="mt-2 text-sm text-slate-500">Check everything looks right before activating.</p>
              </div>
              <div className="space-y-4">

                {/* Summary */}
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Summary</p>
                  <p className="text-lg font-bold text-slate-800">{form.name}</p>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Trigger */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
                      <span className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${triggerMeta(form.trigger).color}`}>
                        {(() => { const T = triggerMeta(form.trigger).Icon; return <T size={16} /> })()}
                      </span>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Trigger</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-700">{triggerMeta(form.trigger).label}</p>
                    </div>
                    {/* Timing */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
                      <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                        <Clock size={16} />
                      </span>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Timing</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-700">{delayLabel(form.trigger, form.delay)}</p>
                    </div>
                    {/* Channel */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center">
                      <span className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${channelMeta(form.channel).bg} ${channelMeta(form.channel).color}`}>
                        {(() => { const C = channelMeta(form.channel).Icon; return <C size={16} /> })()}
                      </span>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Channel</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-700">{channelMeta(form.channel).label}</p>
                    </div>
                  </div>
                </div>

                {/* Message preview */}
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Message preview</p>
                  {form.channel === 'email' && form.subject && (
                    <p className="text-sm font-semibold text-slate-700">Subject: {form.subject}</p>
                  )}
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {form.body.replace(/\{name\}/gi, 'Thabo').replace(/\{email\}/gi, 'thabo@example.com').replace(/\{phone\}/gi, '+27821234567').replace(/\{company\}/gi, 'Acme Ltd')}
                  </p>
                </div>

                {/* Activate toggle */}
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <label className="flex cursor-pointer items-center gap-4">
                    <div onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                      className={`relative h-6 w-11 rounded-full transition ${form.active ? 'bg-primary' : 'bg-slate-200'}`}>
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.active ? 'left-5' : 'left-0.5'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {form.active ? 'Active — automation will run immediately' : 'Paused — activate later from the list'}
                      </p>
                      <p className="text-xs text-slate-400">Processing runs every 60 minutes on the server</p>
                    </div>
                  </label>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">
                    <AlertTriangle size={15} /> {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setStep(2)}
                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-4 text-sm font-bold text-slate-700 hover:border-primary hover:text-primary">
                    <ArrowLeft size={15} /> Edit Message
                  </button>
                  <button onClick={save} disabled={saving}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-sm hover:bg-[#4e7d6d] hover:shadow-md disabled:opacity-40">
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
                    {saving ? 'Saving…' : editing ? 'Save changes' : 'Create automation'}
                  </button>
                </div>
              </div>
              <div className="mt-6">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-primary">
                  <ArrowLeft size={14} /> Edit trigger
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── LIST view ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Automations</h2>
          <p className="mt-1 text-sm font-medium text-slate-400">
            Messages that send themselves when a trigger fires
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> New Automation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: 'Total',      value: automations.length, Icon: Zap,       color: 'bg-slate-50 text-slate-600'    },
          { label: 'Active',     value: activeCount,        Icon: Play,      color: 'bg-green-50 text-green-600'   },
          { label: 'Total Runs', value: totalRuns,          Icon: BarChart2, color: 'bg-blue-50 text-blue-600'     },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40">
            <div className="mb-5 flex items-start justify-between">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-110 ${color}`}>
                <Icon size={22} />
              </span>
            </div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
            <p className="text-4xl font-black tracking-tight text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-3.5">
        <RefreshCw size={14} className="mt-0.5 shrink-0 text-blue-500" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Automations are processed every <strong>60 minutes</strong> server-side. Messages are personalised with merge tags like{' '}
          <code className="rounded bg-blue-100 px-1 font-mono">{'{name}'}</code>. Each send counts toward your plan's monthly message quota.
        </p>
      </div>

      {/* Empty state */}
      {automations.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-3xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10">
            <Sparkles size={28} className="text-primary" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-700">No automations yet</p>
            <p className="mt-1 text-sm text-slate-400 max-w-xs mx-auto">
              Create your first automation and start sending messages on autopilot.
            </p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#4e7d6d]">
            <PlusCircle size={15} /> Create first automation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map(a => {
            const tm = triggerMeta(a.trigger)
            const ch = channelMeta(a.channel)
            const lastRun = a.lastRunAt?.toDate?.()
            return (
              <div key={a.id}
                className={`flex flex-wrap items-center gap-4 rounded-3xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
                  a.active ? 'border-slate-200/60' : 'border-slate-200/60 opacity-60'
                }`}>

                {/* Trigger icon */}
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${a.active ? tm.color : 'bg-slate-100 text-slate-400'}`}>
                  <tm.Icon size={20} />
                </span>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-bold text-slate-800">{a.name}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      a.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${a.active ? 'bg-green-500' : 'bg-slate-400'}`} />
                      {a.active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <tm.Icon size={10} /> {tm.label}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> {delayLabel(a.trigger, a.delay)}
                    </span>
                    <span>·</span>
                    <span className={`flex items-center gap-1 ${ch.color}`}>
                      <ch.Icon size={10} /> {ch.label}
                    </span>
                    {(a.runCount ?? 0) > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-semibold text-primary">
                          <BarChart2 size={10} /> {a.runCount} run{a.runCount !== 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                    {lastRun && (
                      <>
                        <span>·</span>
                        <span>Last ran {lastRun.toLocaleDateString('en-ZA')}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => toggleActive(a)} title={a.active ? 'Pause' : 'Activate'}
                    className="flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold transition hover:border-primary hover:text-primary">
                    {a.active
                      ? <><Pause size={12} /> Pause</>
                      : <><Play  size={12} /> Activate</>}
                  </button>
                  <button onClick={() => openEdit(a)} title="Edit"
                    className="rounded-2xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-primary">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setDeleteId(a.id)} title="Delete"
                    className="rounded-2xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200/60 bg-white p-8 shadow-2xl space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">Delete automation?</p>
              <p className="mt-1 text-sm text-slate-500">This cannot be undone. The automation will stop running immediately.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={confirmDelete}
                className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-600">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
