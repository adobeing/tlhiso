import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'
import { doc, updateDoc } from 'firebase/firestore'
import { PartyPopper, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { functions, db } from '../../services/firebase'
import { useAuth } from '../../contexts/AuthContext'

function loadPayfastScript(sandbox) {
  return new Promise(resolve => {
    const src = sandbox
      ? 'https://sandbox.payfast.co.za/onsite/engine.js'
      : 'https://www.payfast.co.za/onsite/engine.js'
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    document.body.appendChild(s)
  })
}

const TIERS = [
  { key: '100',   guests: '100',    total: 'R345',   display: 'R345' },
  { key: '500',   guests: '500',    total: 'R690',   display: 'R690' },
  { key: '1000',  guests: '1,000',  total: 'R1,225', display: 'R1,225' },
  { key: '10000', guests: '10,000', total: 'R5,450', display: 'R5,450' },
]

export default function EventsActivatePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleActivate() {
    if (!selected) return
    setLoading(true)
    setError('')
    try {
      const fn = httpsCallable(functions, 'createEventsActivationCheckout')
      const result = await fn({ guestTier: selected.key })
      const { uuid, sandbox } = result.data
      await loadPayfastScript(sandbox)
      if (typeof window.payfast_do_onsite_payment !== 'function') {
        throw new Error('PayFast script did not load. Please refresh and try again.')
      }
      window.payfast_do_onsite_payment({ uuid }, async (success) => {
        if (success) {
          try {
            await updateDoc(doc(db, 'users', user.uid), { isActive: true, eventsActivated: true })
          } catch (e) {
            console.warn('Optimistic update failed:', e.message)
          }
          navigate('/events', { replace: true })
        } else {
          setError('Payment was cancelled or failed. Please try again.')
          setLoading(false)
        }
      })
    } catch (err) {
      console.error('EventsActivatePage error:', err)
      setError(err?.message || 'Payment setup failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <PartyPopper size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Activate your Events account</h1>
          <p className="mt-2 text-sm text-slate-500">
            Select your expected guest count · R6/guest · No monthly subscription
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-slate-200/60 bg-white shadow-xl overflow-hidden">

          {/* What you get */}
          <div className="px-6 pt-6 pb-5 border-b border-slate-100">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">What's included</p>
            <ul className="space-y-2.5">
              {[
                'Unlimited events — create as many as you need',
                'Guest invitations via email + SMS',
                'RSVP tracking, agenda builder, Google Maps',
                'QR check-in & printable name tag PDFs',
                'Corporate fields: table numbers, dress code',
                'Pay only when you launch (R6/guest + 15% VAT)',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle size={15} className="mt-0.5 flex-shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Tier selector */}
          <div className="px-6 py-5 border-b border-slate-100">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Select guest count</p>
            <div className="space-y-2">
              {TIERS.map(tier => {
                const isSelected = selected?.key === tier.key
                return (
                  <button
                    key={tier.key}
                    type="button"
                    onClick={() => setSelected(tier)}
                    className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-slate-200 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        isSelected ? 'border-primary' : 'border-slate-300'
                      }`}>
                        {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{tier.guests} guests</span>
                    </div>
                    <span className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-slate-700'}`}>
                      {tier.total}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-slate-400">Prices include 15% VAT · R6 per guest</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* CTA */}
          <div className="px-6 py-5">
            <button
              type="button"
              onClick={handleActivate}
              disabled={!selected || loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-[#4e7d6d] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Setting up payment…</>
                : selected
                  ? <><PartyPopper size={16} /> Pay {selected.display} with PayFast</>
                  : <><PartyPopper size={16} /> Select a guest count above</>}
            </button>
            <p className="mt-3 text-center text-xs text-slate-400">
              Secure payment via PayFast · One-time per event · No recurring fees
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
