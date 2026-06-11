// Public survey page — no auth required.
// Route: /survey/:userId/:surveyId
// Reads:  users/{userId}                            — business name + logo
//         users/{userId}/surveys/{surveyId}          — survey + questions
// Writes: users/{userId}/surveys/{surveyId}/responses/{auto}

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  doc, getDoc, collection, addDoc, serverTimestamp, updateDoc, increment,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { Star, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

export default function SurveyPage() {
  const { userId, surveyId } = useParams()

  const [survey,     setSurvey]     = useState(null)
  const [business,   setBusiness]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [answers,    setAnswers]    = useState({})
  const [errors,     setErrors]     = useState({})   // per-question validation
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)

  const formRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        const [surveySnap, userSnap] = await Promise.all([
          getDoc(doc(db, 'users', userId, 'surveys', surveyId)),
          getDoc(doc(db, 'users', userId)),
        ])

        if (!surveySnap.exists()) { setError('Survey not found.'); return }

        const s = { id: surveySnap.id, ...surveySnap.data() }
        if (s.status === 'Closed') {
          setError('This survey is closed and no longer accepting responses.')
          return
        }

        if (userSnap.exists()) {
          const u = userSnap.data()
          setBusiness({
            name:    u.businessName || u.name || 'Tlhiso Survey',
            logoUrl: u.businessLogoUrl || u.profilePhotoUrl || null,
          })
        }

        setSurvey(s)
      } catch {
        setError('Failed to load survey. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId, surveyId])

  function setAnswer(qid, value) {
    setAnswers(prev => ({ ...prev, [qid]: value }))
    // Clear error for this question as soon as they answer
    if (errors[qid]) setErrors(prev => { const e = { ...prev }; delete e[qid]; return e })
  }

  function toggleCheckbox(qid, option) {
    setAnswers(prev => {
      const current = Array.isArray(prev[qid]) ? prev[qid] : []
      const next = current.includes(option)
        ? current.filter(o => o !== option)
        : [...current, option]
      if (errors[qid] && next.length > 0) setErrors(e => { const n = { ...e }; delete n[qid]; return n })
      return { ...prev, [qid]: next }
    })
  }

  const answered = (survey?.questions || []).filter(q => {
    const a = answers[q.id]
    if (a === undefined || a === null || a === '') return false
    if (Array.isArray(a) && a.length === 0) return false
    return true
  }).length
  const total    = (survey?.questions || []).length
  const progress = total > 0 ? Math.round((answered / total) * 100) : 0

  async function submit(e) {
    e.preventDefault()
    const newErrors = {}
    ;(survey.questions || []).forEach(q => {
      if (!q.required) return
      const a = answers[q.id]
      if (a === undefined || a === null || a === '') newErrors[q.id] = true
      if (Array.isArray(a) && a.length === 0) newErrors[q.id] = true
    })

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      // Scroll to first invalid question
      const firstId = Object.keys(newErrors)[0]
      document.getElementById(`q-${firstId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSubmitting(true)
    try {
      await addDoc(
        collection(db, 'users', userId, 'surveys', surveyId, 'responses'),
        { answers, submittedAt: serverTimestamp() }
      )
      await updateDoc(doc(db, 'users', userId, 'surveys', surveyId), {
        responses: increment(1),
      })
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      alert('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm rounded-3xl border border-slate-200/60 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <AlertCircle size={26} className="text-slate-400" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Survey unavailable</h2>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  // ── Thank you ──────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="rounded-3xl border border-slate-200/60 bg-white p-10 shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-black text-slate-900">All done!</h2>
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              {survey.thankYouMessage || 'Thank you for your feedback!'}
            </p>
          </div>
          {business?.name && (
            <p className="text-[11px] text-slate-400">
              Survey by <span className="font-semibold text-slate-600">{business.name}</span>
            </p>
          )}
          <p className="text-[11px] text-slate-300">
            Powered by <span className="font-semibold text-primary">Tlhiso</span>
          </p>
        </div>
      </div>
    )
  }

  // ── Survey form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">

      {/* Sticky progress bar */}
      <div className="sticky top-0 z-10 h-1.5 bg-slate-200">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mx-auto max-w-xl px-4 py-8 pb-16">

        {/* Header */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-slate-200/60 bg-white shadow-sm">
          <div className="h-2 bg-gradient-to-r from-primary to-[#7BA897]" />
          <div className="px-7 py-6">
            {business && (
              <div className="mb-4 flex items-center gap-3">
                {business.logoUrl ? (
                  <img src={business.logoUrl} alt={business.name}
                    className="h-9 w-9 rounded-xl object-cover border border-slate-100" />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-black text-primary">
                    {business.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-semibold text-slate-500">{business.name}</span>
              </div>
            )}
            <h1 className="text-2xl font-black text-slate-900">{survey.title}</h1>
            {survey.description && (
              <p className="mt-2 text-sm text-slate-500 leading-relaxed">{survey.description}</p>
            )}
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <span>{total} question{total !== 1 ? 's' : ''}</span>
              <span>·</span>
              <span>{answered} answered</span>
            </div>
          </div>
        </div>

        {/* Questions */}
        <form ref={formRef} onSubmit={submit} className="space-y-4">
          {(survey.questions || []).map((q, idx) => {
            const hasError = !!errors[q.id]
            return (
              <div
                id={`q-${q.id}`}
                key={q.id}
                className={`rounded-3xl border bg-white p-6 shadow-sm transition-all ${
                  hasError ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200/60'
                }`}
              >
                <p className="mb-4 text-sm font-semibold text-slate-800 leading-snug">
                  <span className="mr-2 font-black text-primary">{idx + 1}.</span>
                  {q.label}
                  {q.required && <span className="ml-1 text-red-400">*</span>}
                </p>

                {/* Short answer */}
                {q.type === 'text' && (
                  <input
                    value={answers[q.id] || ''}
                    onChange={e => setAnswer(q.id, e.target.value)}
                    placeholder="Your answer"
                    className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 ${
                      hasError
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                        : 'border-slate-200 focus:border-primary focus:ring-primary/20'
                    }`}
                  />
                )}

                {/* Paragraph */}
                {q.type === 'textarea' && (
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={e => setAnswer(q.id, e.target.value)}
                    placeholder="Your answer"
                    rows={4}
                    className={`w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 ${
                      hasError
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                        : 'border-slate-200 focus:border-primary focus:ring-primary/20'
                    }`}
                  />
                )}

                {/* Multiple choice */}
                {q.type === 'multiple_choice' && (
                  <div className="space-y-2">
                    {(q.options || []).map(opt => {
                      const selected = answers[q.id] === opt
                      return (
                        <label key={opt}
                          className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                            selected
                              ? 'border-primary bg-primary/10 font-semibold'
                              : hasError
                              ? 'border-red-200 hover:border-primary/40'
                              : 'border-slate-200 hover:border-primary/40 hover:bg-slate-50'
                          }`}>
                          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                            selected ? 'border-primary bg-primary' : 'border-slate-300'
                          }`}>
                            {selected && <div className="h-2 w-2 rounded-full bg-white" />}
                          </div>
                          <span className="text-sm text-slate-700">{opt}</span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {/* Checkboxes */}
                {q.type === 'checkbox' && (
                  <div className="space-y-2">
                    {(q.options || []).map(opt => {
                      const checked = Array.isArray(answers[q.id]) && answers[q.id].includes(opt)
                      return (
                        <label key={opt}
                          className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                            checked
                              ? 'border-primary bg-primary/10 font-semibold'
                              : hasError
                              ? 'border-red-200 hover:border-primary/40'
                              : 'border-slate-200 hover:border-primary/40 hover:bg-slate-50'
                          }`}>
                          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                            checked ? 'border-primary bg-primary' : 'border-slate-300'
                          }`}>
                            {checked && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <span className="text-sm text-slate-700">{opt}</span>
                          <input type="checkbox" checked={checked}
                            onChange={() => toggleCheckbox(q.id, opt)} className="sr-only" />
                        </label>
                      )
                    })}
                  </div>
                )}

                {/* Star rating */}
                {q.type === 'rating' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} type="button"
                          onClick={() => setAnswer(q.id, n)}
                          className="transition-transform active:scale-95 hover:scale-110">
                          <Star size={36}
                            className={`transition ${
                              (answers[q.id] || 0) >= n
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-slate-100 text-slate-200 hover:fill-amber-200 hover:text-amber-200'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    {answers[q.id] && (
                      <p className="text-xs font-semibold text-slate-400">
                        {['', 'Very poor', 'Poor', 'Average', 'Good', 'Excellent'][answers[q.id]]} ({answers[q.id]}/5)
                      </p>
                    )}
                    {hasError && !answers[q.id] && (
                      <p className="text-xs text-red-500">Please select a rating</p>
                    )}
                  </div>
                )}

                {/* Yes / No */}
                {q.type === 'yesno' && (
                  <div className="flex gap-3">
                    {['Yes', 'No'].map((opt, i) => (
                      <button key={opt} type="button"
                        onClick={() => setAnswer(q.id, opt)}
                        className={`flex-1 rounded-2xl border py-3.5 text-sm font-bold transition ${
                          answers[q.id] === opt
                            ? i === 0
                              ? 'border-green-500 bg-green-500 text-white shadow-sm'
                              : 'border-red-400 bg-red-400 text-white shadow-sm'
                            : hasError
                            ? 'border-red-200 text-slate-600 hover:bg-slate-50'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                        }`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Per-question error hint */}
                {hasError && q.type !== 'rating' && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-red-500">
                    <AlertCircle size={11} /> This question is required
                  </p>
                )}
              </div>
            )
          })}

          <button type="submit" disabled={submitting}
            className="w-full rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-md transition hover:bg-[#4e7d6d] hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
            {submitting
              ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Submitting…</span>
              : 'Submit Survey'}
          </button>
        </form>

        <p className="mt-8 text-center text-[11px] text-slate-300">
          {business?.name && <><span className="text-slate-400">{business.name}</span> · </>}
          Powered by <span className="font-semibold text-primary">Tlhiso</span>
        </p>
      </div>
    </div>
  )
}
