// Public survey page — no login required.
// Route: /survey/:userId/:surveyId
// Firestore: reads users/{userId}/surveys/{surveyId}
//            writes users/{userId}/surveys/{surveyId}/responses/{auto}

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  doc, getDoc, collection, addDoc,
  serverTimestamp, updateDoc, increment,
} from 'firebase/firestore'
import { db } from '../../services/firebase'
import { Star, CheckCircle2, Loader2 } from 'lucide-react'

export default function SurveyPage() {
  const { userId, surveyId } = useParams()

  const [survey,     setSurvey]     = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [answers,    setAnswers]    = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'users', userId, 'surveys', surveyId))
        if (!snap.exists()) { setError('Survey not found.'); return }
        const s = { id: snap.id, ...snap.data() }
        if (s.status === 'Closed') { setError('This survey is now closed and no longer accepting responses.'); return }
        // Auto-activate Draft surveys the first time someone visits the link
        if (s.status === 'Draft') {
          await updateDoc(doc(db, 'users', userId, 'surveys', surveyId), { status: 'Active' })
          s.status = 'Active'
        }
        setSurvey(s)
      } catch (e) {
        setError('Failed to load survey. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId, surveyId])

  function setAnswer(qid, value) {
    setAnswers(prev => ({ ...prev, [qid]: value }))
  }

  function toggleCheckbox(qid, option) {
    setAnswers(prev => {
      const current = Array.isArray(prev[qid]) ? prev[qid] : []
      return {
        ...prev,
        [qid]: current.includes(option)
          ? current.filter(o => o !== option)
          : [...current, option],
      }
    })
  }

  async function submit(e) {
    e.preventDefault()
    // Validate required questions
    const missing = (survey.questions || []).filter(q => {
      if (!q.required) return false
      const a = answers[q.id]
      if (a === undefined || a === null || a === '') return true
      if (Array.isArray(a) && a.length === 0) return true
      return false
    })
    if (missing.length > 0) {
      alert(`Please answer all required questions:\n${missing.map(q => `• ${q.label}`).join('\n')}`)
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
    } catch (e) {
      alert('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-2">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-2 p-6">
        <div className="max-w-md rounded-3xl border border-border bg-white p-8 text-center shadow-card">
          <p className="text-4xl mb-4">📋</p>
          <h2 className="text-lg font-bold text-ink mb-2">Survey unavailable</h2>
          <p className="text-sm text-ink-secondary">{error}</p>
        </div>
      </div>
    )
  }

  // ── Thank-you screen ───────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-2 p-6">
        <div className="max-w-md rounded-3xl border border-border bg-white p-10 text-center shadow-card space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-extrabold text-ink">All done!</h2>
          <p className="text-sm text-ink-secondary">
            {survey.thankYouMessage || 'Thank you for your feedback!'}
          </p>
        </div>
      </div>
    )
  }

  // ── Survey form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-2 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-5">

        {/* Header card */}
        <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-card">
          <div className="h-3 bg-gradient-to-r from-primary to-[#7BA897]" />
          <div className="px-8 py-6">
            <h1 className="text-2xl font-extrabold text-ink">{survey.title}</h1>
            {survey.description && (
              <p className="mt-2 text-sm text-ink-secondary">{survey.description}</p>
            )}
          </div>
        </div>

        {/* Questions */}
        <form onSubmit={submit} className="space-y-4">
          {(survey.questions || []).map((q, idx) => (
            <div key={q.id} className="rounded-3xl border border-border bg-white p-6 shadow-card space-y-3">
              <p className="text-sm font-semibold text-ink">
                {idx + 1}. {q.label}
                {q.required && <span className="ml-1 text-red-500">*</span>}
              </p>

              {/* Short answer */}
              {q.type === 'text' && (
                <input
                  value={answers[q.id] || ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  placeholder="Your answer"
                  className="w-full rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              )}

              {/* Paragraph */}
              {q.type === 'textarea' && (
                <textarea
                  value={answers[q.id] || ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  placeholder="Your answer"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-border px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
              )}

              {/* Multiple choice (radio) */}
              {q.type === 'multiple_choice' && (
                <div className="space-y-2">
                  {(q.options || []).map(opt => (
                    <label key={opt} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 transition hover:border-primary/40 hover:bg-primary-light/30">
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswer(q.id, opt)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-ink">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Checkboxes */}
              {q.type === 'checkbox' && (
                <div className="space-y-2">
                  {(q.options || []).map(opt => {
                    const checked = Array.isArray(answers[q.id]) && answers[q.id].includes(opt)
                    return (
                      <label key={opt} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                        checked ? 'border-primary bg-primary-light' : 'border-border hover:border-primary/40 hover:bg-primary-light/30'
                      }`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCheckbox(q.id, opt)}
                          className="accent-primary"
                        />
                        <span className="text-sm text-ink">{opt}</span>
                      </label>
                    )
                  })}
                </div>
              )}

              {/* Star rating */}
              {q.type === 'rating' && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setAnswer(q.id, n)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        size={32}
                        className={`transition ${
                          (answers[q.id] || 0) >= n
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-gray-200 text-gray-200 hover:fill-amber-200 hover:text-amber-200'
                        }`}
                      />
                    </button>
                  ))}
                  {answers[q.id] && (
                    <span className="ml-2 self-center text-sm font-semibold text-ink-secondary">
                      {answers[q.id]} / 5
                    </span>
                  )}
                </div>
              )}

              {/* Yes / No */}
              {q.type === 'yesno' && (
                <div className="flex gap-3">
                  {['Yes', 'No'].map((opt, i) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswer(q.id, opt)}
                      className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition ${
                        answers[q.id] === opt
                          ? i === 0
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-red-400 bg-red-50 text-red-600'
                          : 'border-border text-ink-secondary hover:border-primary/40'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#4e7d6d] disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : 'Submit Survey'}
          </button>
        </form>

        <p className="text-center text-[11px] text-ink-secondary pb-6">
          Powered by <span className="font-semibold text-primary">Tlhiso</span>
        </p>
      </div>
    </div>
  )
}
