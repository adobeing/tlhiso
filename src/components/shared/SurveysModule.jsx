// Shared Surveys Module — used by all 4 industry dashboards.
//
// Features:
//   Build  — 3-step wizard: Details → Questions → Share & Publish
//   Results — per-question response breakdown
//   Send   — full-page send flow (Email / SMS) with contact picker + progress

import { useState, useMemo } from 'react'
import {
  addDoc, updateDoc, deleteDoc,
  collection, doc, serverTimestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import {
  PlusCircle, Trash2, X, BarChart2, Send, Copy, Check,
  Star, ChevronUp, ChevronDown, Loader2, AlignLeft,
  AlignJustify, List, CheckSquare, ToggleLeft, Mail, Phone as PhoneIcon,
  Pencil, Link as LinkIcon, ArrowLeft, ChevronRight,
  FileQuestion, MessageSquare, TrendingUp, Users, Eye,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'
import { db, functions } from '../../services/firebase'
import DataTable from './DataTable'

// ── Config ────────────────────────────────────────────────────────────────────
const INDUSTRY_CONFIG = {
  b2b:      { col: 'customers', label: 'clients',   nameOf: r => r.name || '' },
  medical:  { col: 'patients',  label: 'patients',  nameOf: r => `${r.firstName || ''} ${r.lastName || ''}`.trim() },
  property: { col: 'tenants',   label: 'tenants',   nameOf: r => `${r.firstName || ''} ${r.lastName || ''}`.trim() },
  retail:   { col: 'customers', label: 'customers', nameOf: r => r.name || '' },
}

const Q_TYPES = [
  { key: 'text',            label: 'Short Answer',    Icon: AlignLeft    },
  { key: 'textarea',        label: 'Paragraph',       Icon: AlignJustify },
  { key: 'multiple_choice', label: 'Multiple Choice', Icon: List         },
  { key: 'checkbox',        label: 'Checkboxes',      Icon: CheckSquare  },
  { key: 'rating',          label: 'Star Rating',     Icon: Star         },
  { key: 'yesno',           label: 'Yes / No',        Icon: ToggleLeft   },
]

function newQ() {
  return {
    id:       `q_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    type:     'text',
    label:    '',
    required: false,
    options:  ['Option 1', 'Option 2'],
  }
}

const BLANK = {
  title:           '',
  description:     '',
  thankYouMessage: 'Thank you for your feedback!',
  questions:       [newQ()],
}

// ── Question card ─────────────────────────────────────────────────────────────
function QuestionCard({ q, idx, total, onChange, onRemove, onMove }) {
  const isChoice = q.type === 'multiple_choice' || q.type === 'checkbox'

  function setOpt(oi, val) {
    const opts = [...q.options]; opts[oi] = val; onChange({ ...q, options: opts })
  }
  function addOpt() { onChange({ ...q, options: [...q.options, `Option ${q.options.length + 1}`] }) }
  function removeOpt(oi) { onChange({ ...q, options: q.options.filter((_, i) => i !== oi) }) }

  return (
    <div className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[11px] font-black text-primary">
          {idx + 1}
        </span>
        <input
          value={q.label}
          onChange={e => onChange({ ...q, label: e.target.value })}
          placeholder={`Question ${idx + 1}`}
          className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex items-center gap-1">
          {idx > 0         && <button onClick={() => onMove(idx, -1)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"><ChevronUp size={14} /></button>}
          {idx < total - 1 && <button onClick={() => onMove(idx,  1)} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100"><ChevronDown size={14} /></button>}
          <button onClick={onRemove} className="rounded-xl p-1.5 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Type picker */}
      <div className="flex flex-wrap gap-1.5">
        {Q_TYPES.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => onChange({ ...q, type: key })}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition ${
              q.type === key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary'
            }`}>
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      {/* Preview */}
      {q.type === 'text' && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-400 italic">Short answer field</div>
      )}
      {q.type === 'textarea' && (
        <div className="h-14 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-400 italic">Paragraph field</div>
      )}
      {q.type === 'rating' && (
        <div className="flex gap-1">
          {[1,2,3,4,5].map(n => <Star key={n} size={22} className="fill-amber-300 text-amber-300" />)}
        </div>
      )}
      {q.type === 'yesno' && (
        <div className="flex gap-2">
          {['Yes', 'No'].map(l => <div key={l} className="rounded-xl border border-slate-200 px-5 py-2 text-xs font-semibold text-slate-600">{l}</div>)}
        </div>
      )}
      {isChoice && (
        <div className="space-y-2">
          {q.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <div className={`h-4 w-4 shrink-0 border border-slate-300 ${q.type === 'checkbox' ? 'rounded' : 'rounded-full'}`} />
              <input value={opt} onChange={e => setOpt(oi, e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-primary" />
              {q.options.length > 1 &&
                <button onClick={() => removeOpt(oi)} className="text-red-400 hover:text-red-600"><X size={12} /></button>}
            </div>
          ))}
          <button onClick={addOpt} className="text-[11px] font-semibold text-primary hover:underline">+ Add option</button>
        </div>
      )}

      {/* Required toggle */}
      <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-slate-500">
        <div onClick={() => onChange({ ...q, required: !q.required })}
          className={`relative h-5 w-9 rounded-full transition ${q.required ? 'bg-primary' : 'bg-slate-200'}`}>
          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${q.required ? 'left-4' : 'left-0.5'}`} />
        </div>
        Required
      </label>
    </div>
  )
}

// ── Results viewer ────────────────────────────────────────────────────────────
function SurveyResultsViewer({ uid, survey, onBack }) {
  const responses = useCollection(`users/${uid}/surveys/${survey.id}/responses`, 'submittedAt')

  const agg = useMemo(() => {
    const map = {}
    responses.forEach(r => {
      Object.entries(r.answers || {}).forEach(([qid, answer]) => {
        if (!map[qid]) map[qid] = []
        map[qid].push(answer)
      })
    })
    return map
  }, [responses])

  function OptionBar({ label, count, total, color = 'bg-primary' }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    return (
      <div className="mb-3">
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="font-medium text-slate-700">{label}</span>
          <span className="text-slate-500">{count} ({pct}%)</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-6 -mt-6 flex min-h-[calc(100vh-4rem)] flex-col bg-slate-50/50">
      {/* Top bar */}
      <div className="shrink-0 border-b border-slate-200/60 bg-white px-8 py-5">
        <div className="flex items-center gap-4">
          <button onClick={onBack}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary hover:text-primary">
            <ArrowLeft size={15} /> Back to Surveys
          </button>
          <div className="flex items-center gap-3">
            <div className="h-7 w-1 rounded-full bg-primary" />
            <span className="text-xl font-bold text-slate-800">{survey.title}</span>
            <span className="rounded-2xl bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
              {responses.length} response{responses.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-10 space-y-5">
          {responses.length === 0 ? (
            <div className="rounded-3xl border border-slate-200/60 bg-white p-16 shadow-sm text-center">
              <BarChart2 size={40} className="mx-auto mb-4 text-slate-200" />
              <p className="text-base font-bold text-slate-700">No responses yet</p>
              <p className="mt-1 text-sm text-slate-400">Share the survey link to start collecting feedback.</p>
            </div>
          ) : (
            (survey.questions || []).map((q, qi) => {
              const answers = agg[q.id] || []
              const total   = answers.length
              return (
                <div key={q.id} className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm">
                  <p className="mb-1 text-base font-bold text-slate-800">
                    <span className="mr-2 text-primary">{qi + 1}.</span>{q.label}
                  </p>
                  <p className="mb-4 text-xs text-slate-400">{total} answer{total !== 1 ? 's' : ''}</p>

                  {(q.type === 'text' || q.type === 'textarea') && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {answers.slice(0, 15).map((a, i) => (
                        <div key={i} className="rounded-2xl bg-slate-50 px-4 py-2.5 text-xs text-slate-700">{a || '—'}</div>
                      ))}
                      {answers.length > 15 && <p className="text-xs text-slate-400">+ {answers.length - 15} more</p>}
                      {total === 0 && <p className="text-xs text-slate-400 italic">No answers yet.</p>}
                    </div>
                  )}

                  {q.type === 'multiple_choice' && q.options.map(opt => (
                    <OptionBar key={opt} label={opt} count={answers.filter(a => a === opt).length} total={total} />
                  ))}

                  {q.type === 'checkbox' && q.options.map(opt => (
                    <OptionBar key={opt} label={opt} count={answers.filter(a => Array.isArray(a) && a.includes(opt)).length} total={total} />
                  ))}

                  {q.type === 'rating' && (() => {
                    const nums = answers.map(Number).filter(n => n >= 1 && n <= 5)
                    const avg  = nums.length ? (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1) : '—'
                    return (
                      <div>
                        <div className="mb-4 flex items-center gap-3">
                          <span className="text-3xl font-black text-primary">{avg}</span>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(n => (
                              <Star key={n} size={18} className={parseFloat(avg) >= n ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-100'} />
                            ))}
                          </div>
                          <span className="text-xs text-slate-400">avg rating</span>
                        </div>
                        {[5,4,3,2,1].map(star => (
                          <OptionBar key={star} label={`${star} star${star > 1 ? 's' : ''}`}
                            count={nums.filter(n => n === star).length} total={nums.length} color="bg-amber-400" />
                        ))}
                      </div>
                    )
                  })()}

                  {q.type === 'yesno' && ['Yes', 'No'].map((opt, i) => (
                    <OptionBar key={opt} label={opt} count={answers.filter(a => a === opt).length} total={total}
                      color={i === 0 ? 'bg-green-500' : 'bg-red-400'} />
                  ))}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SurveysModule({ industry }) {
  const { user, profile } = useAuth()
  const uid  = user?.uid
  const cfg  = INDUSTRY_CONFIG[industry]

  const surveys  = useCollection(uid ? `users/${uid}/surveys`           : null)
  const contacts = useCollection(uid && cfg ? `users/${uid}/${cfg.col}` : null)

  // View: 'list' | 'wizard' | 'results' | 'send'
  const [view,    setView]    = useState('list')
  const [step,    setStep]    = useState(1)
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState(BLANK)
  const [saving,  setSaving]  = useState(false)

  // Results
  const [viewingSurvey, setViewingSurvey] = useState(null)

  // Send flow
  const [sendSurvey,   setSendSurvey]   = useState(null)
  const [sendChannel,  setSendChannel]  = useState('email')
  const [sendMsg,      setSendMsg]      = useState('')
  const [selectedCtx,  setSelectedCtx]  = useState([])
  const [sending,      setSending]      = useState(false)
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0 })
  const [sendDone,     setSendDone]     = useState(false)
  const [copied,       setCopied]       = useState(false)

  function surveyLink(s) { return `${window.location.origin}/survey/${uid}/${s.id}` }

  async function copyLink(s) {
    try { await navigator.clipboard.writeText(surveyLink(s)) } catch { }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  // ── Open wizard ────────────────────────────────────────────────────────────
  function openNew() {
    setEditing(null)
    setForm(BLANK)
    setStep(1)
    setView('wizard')
  }

  function openEdit(s) {
    setEditing(s)
    setForm({
      title:           s.title           || '',
      description:     s.description     || '',
      thankYouMessage: s.thankYouMessage || 'Thank you for your feedback!',
      questions:       s.questions?.length ? s.questions : [newQ()],
    })
    setStep(1)
    setView('wizard')
  }

  function openResults(s) {
    setViewingSurvey(s)
    setView('results')
  }

  function openSend(s) {
    const link = surveyLink(s)
    setSendSurvey(s)
    setSendChannel('email')
    setSendMsg(`Hi {name},\n\nWe'd love your feedback! Please take a moment to complete our survey:\n\n${link}\n\nThank you!`)
    setSelectedCtx([])
    setSendDone(false)
    setSendProgress({ sent: 0, failed: 0, total: 0 })
    setView('send')
  }

  // ── Question helpers ───────────────────────────────────────────────────────
  function setQ(idx, updated) {
    setForm(f => { const qs = [...f.questions]; qs[idx] = updated; return { ...f, questions: qs } })
  }
  function addQ() { setForm(f => ({ ...f, questions: [...f.questions, newQ()] })) }
  function removeQ(idx) { setForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== idx) })) }
  function moveQ(idx, dir) {
    setForm(f => {
      const qs = [...f.questions]
      const to = idx + dir
      if (to < 0 || to >= qs.length) return f;
      [qs[idx], qs[to]] = [qs[to], qs[idx]]
      return { ...f, questions: qs }
    })
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function save(andPublish = false) {
    if (!uid || !form.title.trim()) { alert('Survey title is required.'); return }
    const questions = form.questions.filter(q => q.label.trim())
    if (questions.length === 0) { alert('Add at least one question.'); return }
    setSaving(true)
    try {
      const payload = { ...form, questions }
      if (editing) {
        await updateDoc(doc(db, 'users', uid, 'surveys', editing.id), {
          ...payload, ...(andPublish ? { status: 'Active' } : {}),
        })
        if (andPublish) {
          const saved = { ...editing, ...payload, status: 'Active' }
          openSend(saved)
          return
        }
      } else {
        const ref = await addDoc(collection(db, 'users', uid, 'surveys'), {
          ...payload,
          status: andPublish ? 'Active' : 'Draft',
          responses: 0,
          createdAt: serverTimestamp(),
        })
        if (andPublish) {
          const saved = { id: ref.id, ...payload, status: 'Active' }
          openSend(saved)
          return
        }
      }
      setView('list')
    } finally { setSaving(false) }
  }

  // ── Send survey ────────────────────────────────────────────────────────────
  async function doSend() {
    if (!sendSurvey || selectedCtx.length === 0) { alert('Select at least one recipient.'); return }
    setSending(true)
    setSendProgress({ sent: 0, failed: 0, total: selectedCtx.length })
    let sent = 0, failed = 0
    const link = surveyLink(sendSurvey)

    for (const contact of selectedCtx) {
      const name = cfg.nameOf(contact)
      const msg  = sendMsg.replace(/\{name\}/gi, name || cfg.label)
      try {
        if (sendChannel === 'email') {
          if (!contact.email) { failed++; setSendProgress(p => ({ ...p, failed: p.failed + 1 })); continue }
          await httpsCallable(functions, 'sendEmail')({
            to:       contact.email,
            subject:  `${profile?.businessName || profile?.name || 'Tlhiso'} — Survey: ${sendSurvey.title}`,
            htmlBody: msg.replace(/\n/g, '<br/>') +
              `<p style="margin-top:16px"><a href="${link}" style="background:#5B8E7D;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;display:inline-block;font-weight:600">Take Survey →</a></p>`,
          })
        } else {
          if (!contact.phone) { failed++; setSendProgress(p => ({ ...p, failed: p.failed + 1 })); continue }
          await httpsCallable(functions, 'sendSMS')({ to: contact.phone, message: msg })
        }
        sent++
        setSendProgress(p => ({ ...p, sent: p.sent + 1 }))
      } catch {
        failed++
        setSendProgress(p => ({ ...p, failed: p.failed + 1 }))
      }
    }
    setSending(false)
    setSendDone(true)
  }

  // ── Table columns ──────────────────────────────────────────────────────────
  const STATUS_CLS = {
    Draft:  'bg-slate-100 text-slate-600',
    Active: 'bg-green-100 text-green-700',
    Closed: 'bg-amber-100 text-amber-700',
  }

  const cols = [
    {
      key: 'title', label: 'Survey',
      render: r => (
        <div>
          <p className="font-semibold text-slate-800">{r.title}</p>
          <p className="text-xs text-slate-400">{(r.questions || []).length} question{(r.questions || []).length !== 1 ? 's' : ''}</p>
        </div>
      ),
    },
    {
      key: 'responses', label: 'Responses',
      render: r => <span className="text-sm font-bold text-primary">{r.responses ?? 0}</span>,
    },
    {
      key: 'status', label: 'Status',
      render: r => (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLS[r.status] ?? STATUS_CLS.Draft}`}>
          {r.status || 'Draft'}
        </span>
      ),
    },
    {
      key: 'actions', label: '', sortable: false,
      render: r => (
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => openResults(r)} title="View results"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"><BarChart2 size={14} /></button>
          <button onClick={() => openEdit(r)} title="Edit"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"><Pencil size={14} /></button>
          <button onClick={() => copyLink(r)} title="Copy link"
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary">
            {copied ? <Check size={14} className="text-green-500" /> : <LinkIcon size={14} />}
          </button>
          <button onClick={() => openSend(r)} title="Send to contacts"
            className="rounded-xl p-1.5 text-primary hover:bg-primary/10"><Send size={14} /></button>
          {r.status !== 'Active' && (
            <button onClick={() => updateDoc(doc(db, 'users', uid, 'surveys', r.id), { status: 'Active' })}
              className="rounded-xl px-2.5 py-1 text-[11px] font-semibold text-green-700 hover:bg-green-50">Activate</button>
          )}
          {r.status === 'Active' && (
            <button onClick={() => updateDoc(doc(db, 'users', uid, 'surveys', r.id), { status: 'Closed' })}
              className="rounded-xl px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50">Close</button>
          )}
          <button onClick={() => { if (!window.confirm('Delete this survey?')) return; deleteDoc(doc(db, 'users', uid, 'surveys', r.id)) }}
            className="rounded-xl p-1.5 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ]

  const totalResponses = surveys.reduce((s, sv) => s + (sv.responses ?? 0), 0)
  const activeCount    = surveys.filter(s => s.status === 'Active').length

  // ── RESULTS view ───────────────────────────────────────────────────────────
  if (view === 'results' && viewingSurvey) {
    return <SurveyResultsViewer uid={uid} survey={viewingSurvey} onBack={() => setView('list')} />
  }

  // ── SEND view ──────────────────────────────────────────────────────────────
  if (view === 'send' && sendSurvey) {
    const eligible = contacts.filter(c => sendChannel === 'email' ? !!c.email : !!c.phone)
    return (
      <div className="-mx-6 -mt-6 flex min-h-[calc(100vh-4rem)] flex-col bg-slate-50/50">
        <div className="shrink-0 border-b border-slate-200/60 bg-white px-8 py-5">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary hover:text-primary">
              <ArrowLeft size={15} /> Back to Surveys
            </button>
            <div className="flex items-center gap-3">
              <div className="h-7 w-1 rounded-full bg-primary" />
              <span className="text-xl font-bold text-slate-800">Send Survey</span>
              <span className="text-sm text-slate-400">— {sendSurvey.title}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-6 py-10">

            {sendDone ? (
              <div className="mx-auto max-w-md space-y-6 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-green-50">
                  <Check size={40} className="text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Survey Sent!</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    <strong className="text-green-700">{sendProgress.sent}</strong> sent ·{' '}
                    {sendProgress.failed > 0 && <><strong className="text-red-600">{sendProgress.failed}</strong> failed</>}
                  </p>
                </div>
                <button onClick={() => setView('list')}
                  className="mx-auto flex items-center gap-2 rounded-2xl bg-primary px-10 py-4 text-sm font-bold text-white shadow-sm hover:bg-[#4e7d6d]">
                  Back to Surveys
                </button>
              </div>
            ) : sending ? (
              <div className="mx-auto max-w-md">
                <div className="rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm space-y-5 text-center">
                  <Loader2 size={36} className="mx-auto animate-spin text-primary" />
                  <div>
                    <p className="text-lg font-bold text-slate-800">Sending survey…</p>
                    <p className="text-sm text-slate-500">{sendProgress.sent + sendProgress.failed} of {sendProgress.total} processed</p>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${sendProgress.total ? ((sendProgress.sent + sendProgress.failed) / sendProgress.total) * 100 : 0}%` }} />
                  </div>
                  <div className="flex justify-center gap-6 text-sm font-semibold">
                    <span className="text-green-600">✓ {sendProgress.sent} sent</span>
                    {sendProgress.failed > 0 && <span className="text-red-500">✗ {sendProgress.failed} failed</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[1fr_22rem] gap-6 items-start">

                {/* Left */}
                <div className="space-y-5">
                  {/* Public link */}
                  <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Public survey link</p>
                    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span className="flex-1 truncate font-mono text-xs text-slate-500">{surveyLink(sendSurvey)}</span>
                      <button onClick={() => copyLink(sendSurvey)}
                        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4e7d6d]">
                        {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                      </button>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                      Message <span className="font-normal normal-case text-slate-400 opacity-70">— use {'{name}'} to personalise</span>
                    </p>
                    <textarea value={sendMsg} onChange={e => setSendMsg(e.target.value)} rows={5}
                      className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  </div>

                  {/* Contact picker */}
                  <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        Recipients <span className="font-normal normal-case text-slate-500">— {selectedCtx.length} selected</span>
                      </p>
                      <div className="flex gap-3">
                        <button onClick={() => setSelectedCtx(eligible)}
                          className="text-xs font-semibold text-primary hover:underline">Select all</button>
                        <button onClick={() => setSelectedCtx([])}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-600 hover:underline">Clear</button>
                      </div>
                    </div>
                    {eligible.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-400">
                        No {cfg.label}s with {sendChannel === 'email' ? 'email addresses' : 'phone numbers'}.
                      </p>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-1 rounded-2xl border border-slate-200 p-2">
                        {eligible.map(contact => {
                          const name    = cfg.nameOf(contact)
                          const detail  = sendChannel === 'email' ? contact.email : contact.phone
                          const checked = selectedCtx.some(c => c.id === contact.id)
                          return (
                            <label key={contact.id}
                              className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-50">
                              <input type="checkbox" checked={checked}
                                onChange={e => setSelectedCtx(prev =>
                                  e.target.checked ? [...prev, contact] : prev.filter(c => c.id !== contact.id)
                                )}
                                className="h-4 w-4 rounded accent-primary" />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-slate-700">{name || '—'}</p>
                                <p className="truncate text-[10px] text-slate-400">{detail}</p>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right */}
                <div className="space-y-4">
                  <div className="rounded-3xl border border-slate-200/60 bg-white p-5 shadow-sm space-y-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Send via</p>
                    <div className="flex overflow-hidden rounded-2xl border border-slate-200">
                      {[{ key: 'email', Icon: Mail, label: 'Email' }, { key: 'sms', Icon: PhoneIcon, label: 'SMS' }].map(({ key, Icon, label }) => {
                        const active = sendChannel === key
                        return (
                          <button key={key} onClick={() => { setSendChannel(key); setSelectedCtx([]) }}
                            className={`flex flex-1 items-center justify-center gap-2 border-r border-slate-200 py-3 text-sm font-semibold transition last:border-0 ${
                              active ? 'bg-primary/10 text-primary font-bold' : 'bg-white text-slate-700 hover:bg-slate-50'
                            }`}>
                            <Icon size={14} /> {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {selectedCtx.length > 0 && (
                    <div className="rounded-3xl border border-primary/30 bg-primary/10 p-4">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-primary" />
                        <span className="text-sm font-bold text-primary">{selectedCtx.length} recipient{selectedCtx.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  )}

                  <button onClick={doSend} disabled={selectedCtx.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#4e7d6d] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40">
                    <Send size={15} />
                    Send to {selectedCtx.length} {cfg?.label || 'contact'}{selectedCtx.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── WIZARD view ────────────────────────────────────────────────────────────
  if (view === 'wizard') {
    const STEPS = [
      { n: 1, label: 'Details'   },
      { n: 2, label: 'Questions' },
      { n: 3, label: 'Publish'   },
    ]
    const step1Ready = !!form.title.trim()
    const step2Ready = form.questions.filter(q => q.label.trim()).length > 0
    const canGoNext  = step === 1 ? step1Ready : step === 2 ? step2Ready : false

    function goBack() { if (step === 1) setView('list'); else setStep(s => s - 1) }
    function goNext() { setStep(s => Math.min(s + 1, 3)) }

    return (
      <div className="-mx-6 -mt-6 flex min-h-[calc(100vh-4rem)] flex-col bg-slate-50/50">

        {/* Step progress bar */}
        <div className="shrink-0 border-b border-slate-200/60 bg-white px-8 py-4">
          <div className="flex items-center gap-6">
            <button onClick={goBack}
              className="flex shrink-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-primary hover:text-primary">
              <ArrowLeft size={15} /> {step === 1 ? 'Surveys' : 'Back'}
            </button>
            <div className="flex flex-1 items-center justify-center gap-1">
              {STEPS.map((s, i) => {
                const isDone   = step > s.n
                const isActive = step === s.n
                return (
                  <div key={s.n} className="flex items-center">
                    <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                      isActive ? 'bg-primary text-white shadow-md shadow-primary/25'
                      : isDone ? 'text-primary' : 'text-slate-400'
                    }`}>
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${
                        isActive ? 'bg-white/20' : isDone ? 'bg-primary/10' : 'bg-slate-100'
                      }`}>
                        {isDone ? '✓' : s.n}
                      </span>
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
              <button onClick={goNext} disabled={!canGoNext}
                className="flex shrink-0 items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#4e7d6d] disabled:cursor-not-allowed disabled:opacity-40">
                Next <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Details ── */}
          {step === 1 && (
            <div className="mx-auto max-w-xl px-6 py-12">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-900">{editing ? 'Edit survey' : 'New survey'}</h2>
                <p className="mt-2 text-sm text-slate-500">Give your survey a clear title so respondents know what it's about.</p>
              </div>
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Survey details</p>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">Title *</span>
                    <input value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Customer Satisfaction Survey"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                      Description <span className="font-normal normal-case opacity-60">— shown at top of survey</span>
                    </span>
                    <textarea value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="A short intro for your respondents…" rows={3}
                      className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">Thank-you message</span>
                    <input value={form.thankYouMessage}
                      onChange={e => setForm(f => ({ ...f, thankYouMessage: e.target.value }))}
                      placeholder="Thank you for your feedback!"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  </label>
                </div>
              </div>
              {step1Ready && (
                <div className="mt-6 flex justify-end">
                  <button onClick={goNext}
                    className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#4e7d6d]">
                    Build Questions <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Questions ── */}
          {step === 2 && (
            <div className="mx-auto max-w-2xl px-6 py-12">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-black text-slate-900">Build your questions</h2>
                  <p className="mt-2 text-sm text-slate-500">{form.questions.filter(q => q.label.trim()).length} question{form.questions.filter(q => q.label.trim()).length !== 1 ? 's' : ''} added</p>
                </div>
              </div>
              <div className="space-y-4">
                {form.questions.map((q, i) => (
                  <QuestionCard key={q.id} q={q} idx={i} total={form.questions.length}
                    onChange={updated => setQ(i, updated)}
                    onRemove={() => removeQ(i)}
                    onMove={(idx, dir) => moveQ(idx, dir)} />
                ))}
                <button onClick={addQ}
                  className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-primary/30 py-4 text-sm font-semibold text-primary hover:bg-primary/5 transition">
                  <PlusCircle size={16} /> Add Question
                </button>
              </div>
              <div className="mt-8 flex items-center justify-between">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:border-primary hover:text-primary">
                  <ArrowLeft size={15} /> Details
                </button>
                <button onClick={goNext} disabled={!step2Ready}
                  className="flex items-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-[#4e7d6d] disabled:cursor-not-allowed disabled:opacity-40">
                  Review & Publish <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Publish ── */}
          {step === 3 && (
            <div className="mx-auto max-w-2xl px-6 py-12">
              <div className="mb-8">
                <h2 className="text-3xl font-black text-slate-900">Ready to publish?</h2>
                <p className="mt-2 text-sm text-slate-500">Review your survey before saving.</p>
              </div>
              <div className="space-y-5">
                {/* Summary */}
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Summary</p>
                  <p className="text-lg font-bold text-slate-800">{form.title}</p>
                  {form.description && <p className="text-sm text-slate-500">{form.description}</p>}
                  <div className="flex items-center gap-3 pt-1">
                    <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      {form.questions.filter(q => q.label.trim()).length} questions
                    </span>
                    <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                      {form.questions.filter(q => q.required).length} required
                    </span>
                  </div>
                </div>

                {/* Questions preview */}
                <div className="rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm space-y-2">
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Questions</p>
                  {form.questions.filter(q => q.label.trim()).map((q, i) => {
                    const TypeIcon = Q_TYPES.find(t => t.key === q.type)?.Icon ?? AlignLeft
                    return (
                      <div key={q.id} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-black text-primary">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">{q.label}</p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <TypeIcon size={10} className="text-slate-400" />
                            <span className="text-[10px] text-slate-400">{Q_TYPES.find(t => t.key === q.type)?.label}</span>
                            {q.required && <span className="text-[10px] font-semibold text-primary">Required</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => save(false)} disabled={saving}
                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-primary hover:text-primary disabled:opacity-40">
                    {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                    Save as Draft
                  </button>
                  <button onClick={() => save(true)} disabled={saving}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#4e7d6d] hover:shadow-md disabled:opacity-40">
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                    Publish & Send
                  </button>
                </div>
                <p className="text-center text-xs text-slate-400">"Publish & Send" activates the survey and opens the send flow.</p>
              </div>
              <div className="mt-6">
                <button onClick={() => setStep(2)}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-400 transition hover:text-primary">
                  <ArrowLeft size={14} /> Edit questions
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── LIST view ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Surveys</h2>
          <p className="mt-1 text-sm font-medium text-slate-400">
            Collect feedback from your {cfg?.label || 'contacts'}
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> New Survey
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6">
        <div className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40 cursor-default">
          <div className="mb-6 flex items-start justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm">
              <FileQuestion size={22} />
            </span>
          </div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Total Surveys</p>
          <p className="text-4xl font-black tracking-tight text-slate-900">{surveys.length}</p>
        </div>
        <div className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40 cursor-default">
          <div className="mb-6 flex items-start justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm">
              <TrendingUp size={22} />
            </span>
          </div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Active</p>
          <p className="text-4xl font-black tracking-tight text-primary">{activeCount}</p>
        </div>
        <div className="group rounded-3xl border border-slate-200/60 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/40 cursor-default">
          <div className="mb-6 flex items-start justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm">
              <MessageSquare size={22} />
            </span>
          </div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">Total Responses</p>
          <p className="text-4xl font-black tracking-tight text-blue-600">{totalResponses}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">All Surveys</h3>
            <p className="text-xs font-medium text-slate-400">{surveys.length} survey{surveys.length !== 1 ? 's' : ''} total</p>
          </div>
          <button onClick={openNew}
            className="rounded-xl bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition hover:bg-primary/20">
            + New
          </button>
        </div>
        <DataTable
          columns={cols}
          data={surveys}
          onRowClick={s => openResults(s)}
          emptyMessage="No surveys yet. Click 'New Survey' to create your first."
        />
      </div>
    </div>
  )
}
