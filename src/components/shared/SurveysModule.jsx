// Shared Surveys Module — used by all 4 industry dashboards.
//
// Features:
//   Build  — 5 question types: Short Answer, Paragraph, Multiple Choice,
//             Checkboxes, Star Rating, Yes/No
//   Results — per-question response breakdown with bars / averages
//   Send   — copy public link · send via Email or SMS to selected contacts
//   Public — /survey/:userId/:surveyId (no login required)

import { useState, useMemo } from 'react'
import {
  addDoc, updateDoc, deleteDoc,
  collection, doc, serverTimestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import {
  PlusCircle, Trash2, X, BarChart2, Send, Copy, Check,
  Star, ChevronUp, ChevronDown, Loader2, AlignLeft,
  AlignJustify, List, CheckSquare, ToggleLeft, Mail, Phone,
  Eye, Pencil, Link as LinkIcon,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'
import { db, functions } from '../../services/firebase'
import Modal from './Modal'
import DataTable from './DataTable'
import StatCard from './StatCard'

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
  title:            '',
  description:      '',
  thankYouMessage:  'Thank you for your feedback!',
  questions:        [newQ()],
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Inp({ label, value, onChange, textarea, placeholder, className = '' }) {
  const cls = `w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none
    focus:border-primary focus:ring-2 focus:ring-primary/30 ${className}`
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-semibold text-ink-secondary">{label}</span>}
      {textarea
        ? <textarea value={value} onChange={onChange} placeholder={placeholder} rows={3}
            className={cls + ' resize-none'} />
        : <input value={value} onChange={onChange} placeholder={placeholder} className={cls} />}
    </label>
  )
}

function StatusBadge({ status }) {
  const cls = { Draft: 'bg-gray-100 text-gray-600', Active: 'bg-green-100 text-green-700', Closed: 'bg-amber-100 text-amber-700' }[status] ?? 'bg-gray-100 text-gray-600'
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{status || 'Draft'}</span>
}

// ── Question card in builder ──────────────────────────────────────────────────
function QuestionCard({ q, idx, total, onChange, onRemove, onMove }) {
  const isChoice = q.type === 'multiple_choice' || q.type === 'checkbox'

  function setOpt(oi, val) {
    const opts = [...q.options]; opts[oi] = val; onChange({ ...q, options: opts })
  }
  function addOpt() { onChange({ ...q, options: [...q.options, `Option ${q.options.length + 1}`] }) }
  function removeOpt(oi) { onChange({ ...q, options: q.options.filter((_, i) => i !== oi) }) }

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-[10px] font-bold text-primary">
          {idx + 1}
        </span>
        <input
          value={q.label}
          onChange={e => onChange({ ...q, label: e.target.value })}
          placeholder={`Question ${idx + 1}`}
          className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex items-center gap-1">
          {idx > 0         && <button onClick={() => onMove(idx, -1)} className="rounded p-1 text-ink-secondary hover:bg-surface-2"><ChevronUp size={14} /></button>}
          {idx < total - 1 && <button onClick={() => onMove(idx,  1)} className="rounded p-1 text-ink-secondary hover:bg-surface-2"><ChevronDown size={14} /></button>}
          <button onClick={onRemove} className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Type picker */}
      <div className="flex flex-wrap gap-1.5">
        {Q_TYPES.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => onChange({ ...q, type: key })}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
              q.type === key ? 'bg-primary text-white' : 'bg-surface-2 text-ink-secondary hover:bg-primary-light hover:text-primary'
            }`}>
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      {/* Preview / options editor */}
      {q.type === 'text' && (
        <div className="rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-xs text-ink-secondary italic">Short answer field</div>
      )}
      {q.type === 'textarea' && (
        <div className="h-14 rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-xs text-ink-secondary italic">Paragraph field</div>
      )}
      {q.type === 'rating' && (
        <div className="flex gap-1">
          {[1,2,3,4,5].map(n => <Star key={n} size={20} className="text-amber-300 fill-amber-300" />)}
        </div>
      )}
      {q.type === 'yesno' && (
        <div className="flex gap-2">
          {['Yes', 'No'].map(l => <div key={l} className="rounded-lg border border-border px-4 py-1.5 text-xs font-semibold text-ink-secondary">{l}</div>)}
        </div>
      )}
      {isChoice && (
        <div className="space-y-1.5">
          {q.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <div className={`h-4 w-4 shrink-0 border border-border ${q.type === 'checkbox' ? 'rounded' : 'rounded-full'}`} />
              <input value={opt} onChange={e => setOpt(oi, e.target.value)}
                className="flex-1 rounded-lg border border-border px-3 py-1 text-xs outline-none focus:border-primary" />
              {q.options.length > 1 &&
                <button onClick={() => removeOpt(oi)} className="text-red-400 hover:text-red-600"><X size={12} /></button>}
            </div>
          ))}
          <button onClick={addOpt} className="text-[11px] font-semibold text-primary hover:underline">+ Add option</button>
        </div>
      )}

      {/* Required toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-ink-secondary">
        <div onClick={() => onChange({ ...q, required: !q.required })}
          className={`relative h-5 w-9 rounded-full transition ${q.required ? 'bg-primary' : 'bg-gray-200'}`}>
          <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${q.required ? 'left-4' : 'left-0.5'}`} />
        </div>
        Required
      </label>
    </div>
  )
}

// ── Results viewer (sub-component so useCollection can be called inside) ──────
function SurveyResultsViewer({ uid, survey }) {
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

  if (responses.length === 0) {
    return (
      <div className="py-12 text-center">
        <BarChart2 size={32} className="mx-auto mb-3 text-ink-secondary/40" />
        <p className="text-sm font-semibold text-ink">No responses yet</p>
        <p className="mt-1 text-xs text-ink-secondary">Share the survey link to start collecting feedback.</p>
      </div>
    )
  }

  function OptionBar({ label, count, total, color = 'bg-primary' }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0
    return (
      <div className="mb-2">
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-medium text-ink">{label}</span>
          <span className="text-ink-secondary">{count} ({pct}%)</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-xl bg-primary-light px-4 py-3">
        <BarChart2 size={18} className="text-primary" />
        <span className="text-sm font-bold text-ink">{responses.length} response{responses.length !== 1 ? 's' : ''}</span>
      </div>

      {(survey.questions || []).map((q, qi) => {
        const answers = agg[q.id] || []
        const total   = answers.length

        return (
          <div key={q.id} className="rounded-2xl border border-border bg-white p-4">
            <p className="mb-3 text-sm font-bold text-ink">
              <span className="mr-2 text-primary">{qi + 1}.</span>{q.label}
            </p>
            <p className="mb-3 text-[11px] text-ink-secondary">{total} answer{total !== 1 ? 's' : ''}</p>

            {(q.type === 'text' || q.type === 'textarea') && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {answers.slice(0, 15).map((a, i) => (
                  <div key={i} className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink">{a || '—'}</div>
                ))}
                {answers.length > 15 && <p className="text-xs text-ink-secondary">+ {answers.length - 15} more</p>}
                {total === 0 && <p className="text-xs text-ink-secondary italic">No answers yet.</p>}
              </div>
            )}

            {q.type === 'multiple_choice' && (
              <div>
                {q.options.map(opt => {
                  const count = answers.filter(a => a === opt).length
                  return <OptionBar key={opt} label={opt} count={count} total={total} />
                })}
              </div>
            )}

            {q.type === 'checkbox' && (
              <div>
                {q.options.map(opt => {
                  const count = answers.filter(a => Array.isArray(a) && a.includes(opt)).length
                  return <OptionBar key={opt} label={opt} count={count} total={total} />
                })}
              </div>
            )}

            {q.type === 'rating' && (() => {
              const nums  = answers.map(Number).filter(n => n >= 1 && n <= 5)
              const avg   = nums.length ? (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1) : '—'
              return (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-2xl font-extrabold text-primary">{avg}</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} size={16}
                          className={parseFloat(avg) >= n ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'} />
                      ))}
                    </div>
                    <span className="text-xs text-ink-secondary">avg</span>
                  </div>
                  {[5,4,3,2,1].map(star => {
                    const count = nums.filter(n => n === star).length
                    return <OptionBar key={star} label={`${star} star${star > 1 ? 's' : ''}`} count={count} total={nums.length} color="bg-amber-400" />
                  })}
                </div>
              )
            })()}

            {q.type === 'yesno' && (
              <div>
                {['Yes', 'No'].map((opt, i) => {
                  const count = answers.filter(a => a === opt).length
                  return <OptionBar key={opt} label={opt} count={count} total={total}
                    color={i === 0 ? 'bg-green-500' : 'bg-red-400'} />
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SurveysModule({ industry }) {
  const { user, profile } = useAuth()
  const uid  = user?.uid
  const cfg  = INDUSTRY_CONFIG[industry]

  const surveys  = useCollection(uid ? `users/${uid}/surveys`              : null)
  const contacts = useCollection(uid && cfg ? `users/${uid}/${cfg.col}`    : null)

  // Builder modal
  const [open,    setOpen]    = useState(false)
  const [editing, setEditing] = useState(null)
  const [form,    setForm]    = useState(BLANK)
  const [saving,  setSaving]  = useState(false)

  // Results modal
  const [viewingResults, setViewingResults] = useState(null)

  // Send modal
  const [sendModal,    setSendModal]    = useState(null)
  const [sendChannel,  setSendChannel]  = useState('email')
  const [sendMsg,      setSendMsg]      = useState('')
  const [selectedCtx,  setSelectedCtx]  = useState([])
  const [sending,      setSending]      = useState(false)
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0 })
  const [sendDone,     setSendDone]     = useState(false)
  const [copied,       setCopied]       = useState(false)

  // ── Helpers ────────────────────────────────────────────────────────────────
  function surveyLink(s) {
    return `${window.location.origin}/survey/${uid}/${s.id}`
  }

  async function copyLink(s) {
    try { await navigator.clipboard.writeText(surveyLink(s)) } catch { }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function openNew() {
    setEditing(null)
    setForm(BLANK)
    setOpen(true)
  }

  function openEdit(s) {
    setEditing(s)
    setForm({
      title:           s.title           || '',
      description:     s.description     || '',
      thankYouMessage: s.thankYouMessage || 'Thank you for your feedback!',
      questions:       s.questions?.length ? s.questions : [newQ()],
    })
    setOpen(true)
  }

  function openSend(s) {
    const link = surveyLink(s)
    setSendModal(s)
    setSendChannel('email')
    setSendMsg(`Hi {name},\n\nWe'd love your feedback! Please take a moment to complete our survey:\n\n${link}\n\nThank you!`)
    setSelectedCtx([])
    setSendDone(false)
    setSendProgress({ sent: 0, failed: 0, total: 0 })
  }

  // ── Question builder helpers ───────────────────────────────────────────────
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

  // ── Save survey ────────────────────────────────────────────────────────────
  async function save() {
    if (!uid || !form.title.trim()) { alert('Survey title is required.'); return }
    const questions = form.questions.filter(q => q.label.trim())
    if (questions.length === 0) { alert('Add at least one question.'); return }
    setSaving(true)
    try {
      const payload = { ...form, questions }
      if (editing) {
        await updateDoc(doc(db, 'users', uid, 'surveys', editing.id), payload)
      } else {
        await addDoc(collection(db, 'users', uid, 'surveys'), {
          ...payload, status: 'Draft', responses: 0, createdAt: serverTimestamp(),
        })
      }
      setOpen(false); setEditing(null)
    } finally { setSaving(false) }
  }

  // ── Send survey link ───────────────────────────────────────────────────────
  async function sendSurvey() {
    if (!sendModal || selectedCtx.length === 0) { alert('Select at least one recipient.'); return }
    setSending(true)
    setSendProgress({ sent: 0, failed: 0, total: selectedCtx.length })
    let sent = 0, failed = 0
    const link = surveyLink(sendModal)

    for (const contact of selectedCtx) {
      const name = cfg.nameOf(contact)
      const msg  = sendMsg.replace(/\{name\}/gi, name || cfg.label)
      try {
        if (sendChannel === 'email') {
          if (!contact.email) { failed++; setSendProgress(p => ({ ...p, failed: p.failed + 1 })); continue }
          await httpsCallable(functions, 'sendEmail')({
            to:       contact.email,
            subject:  `${profile?.businessName || profile?.name || 'Tlhiso'} — Survey: ${sendModal.title}`,
            htmlBody: msg.replace(/\n/g, '<br/>') +
              `<p style="margin-top:16px"><a href="${link}" style="background:#5B8E7D;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;">Take Survey</a></p>`,
          })
        } else {
          const phone = contact.phone
          if (!phone) { failed++; setSendProgress(p => ({ ...p, failed: p.failed + 1 })); continue }
          await httpsCallable(functions, 'sendSMS')({ to: phone, message: msg })
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
  const cols = [
    { key: 'title',     label: 'Survey',    render: r => <span className="font-semibold text-ink">{r.title}</span> },
    { key: 'questions', label: 'Questions', render: r => `${(r.questions || []).length}` },
    { key: 'responses', label: 'Responses', render: r => <span className="font-semibold text-primary">{r.responses ?? 0}</span> },
    { key: 'status',    label: 'Status',    render: r => <StatusBadge status={r.status} /> },
    { key: 'actions',   label: '', sortable: false, render: r => (
      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <button onClick={() => setViewingResults(r)} title="Results"
          className="rounded p-1 text-ink-secondary hover:bg-surface-2"><BarChart2 size={14} /></button>
        <button onClick={() => openEdit(r)} title="Edit"
          className="rounded p-1 text-ink-secondary hover:bg-surface-2"><Pencil size={14} /></button>
        <button onClick={() => copyLink(r)} title="Copy link"
          className="rounded p-1 text-ink-secondary hover:bg-surface-2">
          {copied ? <Check size={14} className="text-green-500" /> : <LinkIcon size={14} />}
        </button>
        <button onClick={() => openSend(r)} title="Send to contacts"
          className="rounded p-1 text-primary hover:bg-primary-light"><Send size={14} /></button>
        {r.status !== 'Active' &&
          <button onClick={() => updateDoc(doc(db, 'users', uid, 'surveys', r.id), { status: 'Active' })}
            className="rounded px-2 py-1 text-[11px] font-semibold text-green-700 hover:bg-green-50">Activate</button>}
        {r.status === 'Active' &&
          <button onClick={() => updateDoc(doc(db, 'users', uid, 'surveys', r.id), { status: 'Closed' })}
            className="rounded px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50">Close</button>}
        <button onClick={() => { if (!window.confirm('Delete this survey?')) return; deleteDoc(doc(db, 'users', uid, 'surveys', r.id)) }}
          className="rounded p-1 text-red-400 hover:bg-red-50"><Trash2 size={14} /></button>
      </div>
    )},
  ]

  const totalResponses = surveys.reduce((s, sv) => s + (sv.responses ?? 0), 0)
  const active = surveys.filter(s => s.status === 'Active').length

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Surveys</h2>
          <p className="mt-0.5 text-sm text-ink-secondary">
            Collect feedback from your {cfg?.label || 'contacts'}
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
          <PlusCircle size={15} /> New Survey
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Surveys"    value={surveys.length}  icon="📋" />
        <StatCard label="Active"           value={active}          icon="🟢" color="primary" />
        <StatCard label="Total Responses"  value={totalResponses}  icon="💬" color="blue" />
      </div>

      <DataTable columns={cols} data={surveys} emptyMessage="No surveys yet. Click 'New Survey' to create your first." />

      {/* ── Create / Edit modal ── */}
      <Modal open={open} onClose={() => { setOpen(false); setEditing(null) }}
        title={editing ? 'Edit Survey' : 'New Survey'} size="xl">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Inp label="Survey Title *" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Customer Satisfaction Survey" />
            <Inp label="Thank-you message" value={form.thankYouMessage}
              onChange={e => setForm(f => ({ ...f, thankYouMessage: e.target.value }))} />
          </div>
          <Inp label="Description (shown at top of survey)" textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="A short intro for your respondents…" />

          {/* Questions */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-secondary">Questions ({form.questions.length})</p>
            </div>
            <div className="space-y-3">
              {form.questions.map((q, i) => (
                <QuestionCard key={q.id} q={q} idx={i} total={form.questions.length}
                  onChange={updated => setQ(i, updated)}
                  onRemove={() => removeQ(i)}
                  onMove={(idx, dir) => moveQ(idx, dir)} />
              ))}
            </div>
            <button onClick={addQ}
              className="mt-3 flex items-center gap-2 rounded-xl border-2 border-dashed border-primary/30 w-full py-2.5 text-xs font-semibold text-primary hover:bg-primary-light justify-center transition">
              <PlusCircle size={14} /> Add Question
            </button>
          </div>

          <div className="border-t border-border pt-4">
            <button onClick={save} disabled={saving}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d] disabled:opacity-60">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Survey'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Results modal ── */}
      <Modal open={!!viewingResults} onClose={() => setViewingResults(null)}
        title={viewingResults ? `Results — ${viewingResults.title}` : ''} size="xl">
        {viewingResults && uid && (
          <SurveyResultsViewer uid={uid} survey={viewingResults} />
        )}
      </Modal>

      {/* ── Send modal ── */}
      <Modal open={!!sendModal} onClose={() => { setSendModal(null); setSendDone(false) }}
        title={sendModal ? `Send — ${sendModal.title}` : ''} size="lg">
        {sendModal && (
          <div className="space-y-4">
            {sendDone ? (
              <div className="py-8 text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <Check size={28} className="text-green-600" />
                </div>
                <p className="font-bold text-ink">Survey sent!</p>
                <p className="text-sm text-ink-secondary">
                  {sendProgress.sent} sent · {sendProgress.failed} failed
                </p>
                <button onClick={() => { setSendModal(null); setSendDone(false) }}
                  className="rounded-xl bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-[#4e7d6d]">
                  Done
                </button>
              </div>
            ) : sending ? (
              <div className="py-8 text-center space-y-3">
                <Loader2 size={28} className="mx-auto animate-spin text-primary" />
                <p className="text-sm font-semibold text-ink">Sending…</p>
                <p className="text-xs text-ink-secondary">
                  {sendProgress.sent + sendProgress.failed} of {sendProgress.total} processed
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2 mx-8">
                  <div className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${sendProgress.total ? ((sendProgress.sent + sendProgress.failed) / sendProgress.total) * 100 : 0}%` }} />
                </div>
              </div>
            ) : (
              <>
                {/* Public link */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink-secondary">Public survey link</p>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
                    <span className="flex-1 truncate font-mono text-xs text-ink-secondary">
                      {surveyLink(sendModal)}
                    </span>
                    <button onClick={() => copyLink(sendModal)}
                      className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4e7d6d]">
                      {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                </div>

                {/* Channel */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink-secondary">Send via</p>
                  <div className="flex gap-2">
                    {[{ key: 'email', Icon: Mail, label: 'Email' }, { key: 'sms', Icon: Phone, label: 'SMS' }].map(({ key, Icon, label }) => (
                      <button key={key} onClick={() => setSendChannel(key)}
                        className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                          sendChannel === key ? 'border-primary bg-primary-light text-primary' : 'border-border text-ink-secondary hover:border-primary/40'
                        }`}>
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-ink-secondary">
                    Message <span className="font-normal opacity-60">(use {'{name}'} to personalise)</span>
                  </p>
                  <textarea value={sendMsg} onChange={e => setSendMsg(e.target.value)} rows={4}
                    className="w-full resize-none rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
                </div>

                {/* Contact picker */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink-secondary">
                      Recipients — {selectedCtx.length} selected
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedCtx(contacts.filter(c => sendChannel === 'email' ? !!c.email : !!c.phone))}
                        className="text-xs font-semibold text-primary hover:underline">All</button>
                      <button onClick={() => setSelectedCtx([])}
                        className="text-xs font-semibold text-ink-secondary hover:underline">None</button>
                    </div>
                  </div>
                  <div className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-border p-2">
                    {contacts.filter(c => sendChannel === 'email' ? !!c.email : !!c.phone).length === 0 && (
                      <p className="py-4 text-center text-xs text-ink-secondary">
                        No {cfg.label}s with {sendChannel === 'email' ? 'email addresses' : 'phone numbers'}.
                      </p>
                    )}
                    {contacts.filter(c => sendChannel === 'email' ? !!c.email : !!c.phone).map(contact => {
                      const name    = cfg.nameOf(contact)
                      const detail  = sendChannel === 'email' ? contact.email : contact.phone
                      const checked = selectedCtx.some(c => c.id === contact.id)
                      return (
                        <label key={contact.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-2">
                          <input type="checkbox" checked={checked}
                            onChange={e => setSelectedCtx(prev =>
                              e.target.checked ? [...prev, contact] : prev.filter(c => c.id !== contact.id)
                            )}
                            className="h-4 w-4 rounded border-border accent-primary" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-ink">{name || '—'}</p>
                            <p className="truncate text-[10px] text-ink-secondary">{detail}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <button onClick={sendSurvey} disabled={selectedCtx.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#4e7d6d] disabled:opacity-50">
                  <Send size={15} /> Send to {selectedCtx.length} {cfg?.label || 'contact'}{selectedCtx.length !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
