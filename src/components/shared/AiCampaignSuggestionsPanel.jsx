// Standalone AI Campaign Suggestions panel for dashboard overview pages.
// Reads the weekly Firestore cache; calls suggestCampaign on first load of the week.
// "Use this suggestion →" stores the pick in sessionStorage and navigates to /campaigns
// where CampaignsModule auto-opens the pre-filled wizard.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Loader2, Clock, Users, Lightbulb } from 'lucide-react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'
import { useCollection } from '../../hooks/useCollection'

const CONTACT_COLS   = { medical: 'patients', b2b: 'customers', property: 'tenants', retail: 'customers' }
const CONTACT_LABELS = { medical: 'patient',  b2b: 'client',    property: 'tenant',  retail: 'customer' }

function currentWeekKey() {
  const d = new Date()
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const y = d.getUTCFullYear()
  const yearStart = new Date(Date.UTC(y, 0, 1))
  const w = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${y}-W${String(w).padStart(2, '0')}`
}

function nextMondayLabel() {
  const d = new Date()
  const daysUntil = (8 - d.getDay()) % 7 || 7
  d.setDate(d.getDate() + daysUntil)
  return d.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function AiCampaignSuggestionsPanel({ industry, campaignsPath }) {
  const { user } = useAuth()
  const uid          = user?.uid
  const navigate     = useNavigate()
  const contactLabel = CONTACT_LABELS[industry] ?? 'contact'
  const contacts     = useCollection(uid ? `users/${uid}/${CONTACT_COLS[industry] ?? 'customers'}` : null)

  const [aiLoading,     setAiLoading]     = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiTip,         setAiTip]         = useState('')
  const [aiError,       setAiError]       = useState(null)
  const [aiChecked,     setAiChecked]     = useState(false)
  const [aiThisWeek,    setAiThisWeek]    = useState(false)

  useEffect(() => {
    if (!uid) return
    const ref = doc(db, `users/${uid}/aiSuggestions/latest`)
    getDoc(ref).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        if (data.weekKey === currentWeekKey() && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setAiSuggestions(data.suggestions)
          if (data.businessTip) setAiTip(data.businessTip)
          setAiThisWeek(true)
        }
      }
      setAiChecked(true)
    }).catch(() => setAiChecked(true))
  }, [uid])

  async function fetchAiSuggestions() {
    if (aiThisWeek) return
    setAiLoading(true)
    setAiError(null)
    try {
      const fn     = httpsCallable(functions, 'suggestCampaign')
      const result = await fn({ industry, contactCount: contacts.length, tags: [], recentCampaigns: [] })
      if (!result.data.success) {
        setAiError(result.data.error || 'Failed to get suggestions.')
      } else {
        const suggestions = result.data.suggestions || []
        const tip         = result.data.businessTip || ''
        setAiSuggestions(suggestions)
        if (tip) setAiTip(tip)
        setAiThisWeek(true)
        if (suggestions.length > 0) {
          setDoc(doc(db, `users/${uid}/aiSuggestions/latest`), {
            suggestions,
            businessTip: tip,
            weekKey: currentWeekKey(),
            industry,
            generatedAt: serverTimestamp(),
          }).catch(() => {})
        }
      }
    } catch {
      setAiError('Could not reach AI. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  function useSuggestion(s) {
    try { sessionStorage.setItem('tlhiso_ai_suggestion', JSON.stringify(s)) } catch {}
    navigate(campaignsPath)
  }

  return (
    <div className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50/60 to-white shadow-sm">
      <div className="flex items-center justify-between border-b border-violet-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
            <Sparkles size={18} className="text-violet-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">AI Campaign Suggestions</h3>
            <p className="text-xs font-medium text-slate-400">
              Powered by Gemini AI · tailored to your {contacts.length} {contactLabel}{contacts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {aiThisWeek ? (
          <div className="flex items-center gap-2 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-2 text-xs font-semibold text-violet-600">
            <Sparkles size={13} />
            Next refresh: {nextMondayLabel()}
          </div>
        ) : (
          <button
            onClick={fetchAiSuggestions}
            disabled={aiLoading || !aiChecked}
            className="flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:bg-violet-700 disabled:opacity-60">
            {aiLoading
              ? <><Loader2 size={14} className="animate-spin" /> Thinking…</>
              : <><Sparkles size={14} /> Get ideas</>}
          </button>
        )}
      </div>

      {aiError && (
        <div className="px-6 py-4">
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{aiError}</p>
        </div>
      )}

      {!aiLoading && aiSuggestions.length === 0 && !aiError && aiChecked && (
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <Sparkles size={32} className="mb-3 text-violet-200" />
          <p className="text-sm text-slate-400">
            Your AI agent studies your {contactLabel}s and campaigns every Monday and prepares
            fresh strategies. Click{' '}
            <span className="font-semibold text-violet-600">Get ideas</span> to generate this
            week's suggestions now.
          </p>
        </div>
      )}

      {aiTip && (
        <div className="mx-6 mt-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-5 shadow-lg shadow-amber-500/25">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Lightbulb size={16} className="text-white" />
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/70">Your weekly insight</p>
              <p className="font-bold leading-snug text-white">{aiTip}</p>
            </div>
          </div>
        </div>
      )}

      {aiSuggestions.length > 0 && (
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          {aiSuggestions.map((s, i) => (
            <div
              key={i}
              className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:border-violet-200 hover:shadow-md">
              <div className="mb-3">
                <span className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wider ${
                  s.channel === 'email' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                }`}>
                  {s.channel || 'sms'}
                </span>
              </div>
              <p className="mb-1.5 font-bold leading-snug text-slate-800">{s.title}</p>
              <p className="mb-3 text-xs leading-relaxed text-slate-500">{s.description}</p>
              <div className="mb-3 space-y-1">
                <p className="flex items-start gap-1.5 text-xs text-slate-500">
                  <Clock size={11} className="mt-0.5 shrink-0 text-violet-400" />
                  <span>{s.timing}</span>
                </p>
                <p className="flex items-start gap-1.5 text-xs text-slate-500">
                  <Users size={11} className="mt-0.5 shrink-0 text-violet-400" />
                  <span>{s.segment}</span>
                </p>
              </div>
              <div className="mt-auto rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {s.channel === 'email' ? 'Email subject' : 'Sample SMS'}
                </p>
                <p className="text-xs leading-relaxed text-slate-700">
                  {s.channel === 'email' ? s.emailSubject : s.smsBody}
                </p>
              </div>
              <button
                onClick={() => useSuggestion(s)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white transition hover:bg-violet-700">
                Use this suggestion →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
