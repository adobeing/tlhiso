import { useState } from 'react'
import { Loader2, Rocket, AlertCircle } from 'lucide-react'
import Modal from '../shared/Modal'
import { createEventCheckout, launchEvent, quoteForGuests } from '../../services/events'

const RATE_CARD = [
  { guests: 100,  total: 690 },
  { guests: 500,  total: 3450 },
  { guests: 1000, total: 6900 },
]

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

export default function EventLaunchModal({ open, onClose, event, guests, onLaunched }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const guestCount = guests?.length ?? event?.guestCount ?? 0
  const quote = quoteForGuests(guestCount)

  async function handlePay() {
    if (!event?.id) return
    setLoading(true)
    setError('')
    try {
      const result = await createEventCheckout(event.id)
      const { uuid, sandbox } = result.data
      await loadPayfastScript(sandbox)
      if (typeof window.payfast_do_onsite_payment !== 'function') {
        throw new Error('PayFast script did not load. Please refresh and try again.')
      }
      window.payfast_do_onsite_payment({ uuid }, async (success) => {
        if (success) {
          try {
            await launchEvent(event.id)
          } catch (e) {
            console.warn('launchEvent call failed (IPN may have already set status):', e.message)
          }
          onLaunched?.()
          onClose?.()
        } else {
          setError('Payment was cancelled or failed. Please try again.')
          setLoading(false)
        }
      })
    } catch (err) {
      console.error('EventLaunchModal error:', err)
      setError(err?.message || 'Payment setup failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Launch Event" size="md">
      <div className="space-y-5">
        {/* Event summary */}
        <div className="rounded-2xl bg-slate-50 px-4 py-4 space-y-1">
          <p className="font-bold text-slate-900">{event?.title}</p>
          <p className="text-sm text-slate-500">
            {guestCount} guest{guestCount !== 1 ? 's' : ''} will receive invitations immediately after payment
          </p>
        </div>

        {/* Price breakdown */}
        <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-600">{guestCount} guests × R6</span>
            <span className="text-sm font-semibold text-slate-800">
              R{quote.net.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-600">VAT (15%)</span>
            <span className="text-sm font-semibold text-slate-800">
              R{quote.vat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-primary/5 rounded-b-2xl">
            <span className="text-sm font-bold text-slate-800">Total</span>
            <span className="text-base font-black text-primary">
              R{quote.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Rate card */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Rate Card</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-2 text-xs font-bold text-slate-500">Guests</th>
                  <th className="px-4 py-2 text-xs font-bold text-slate-500">Total (incl. VAT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {RATE_CARD.map(row => (
                  <tr key={row.guests}>
                    <td className="px-4 py-2 text-slate-700">{row.guests.toLocaleString('en-ZA')}</td>
                    <td className="px-4 py-2 font-semibold text-slate-800">
                      R{row.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">R6 per guest + 15% VAT · one-time charge per event</p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={handlePay}
          disabled={loading || guestCount === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-white shadow-md shadow-primary/20 transition hover:bg-[#4e7d6d] disabled:opacity-60"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> Processing…</>
          ) : (
            <><Rocket size={16} /> Pay R{quote.total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} &amp; Launch</>
          )}
        </button>

        <p className="text-center text-xs text-slate-400">
          Secure payment via PayFast · Invitations sent instantly after payment
        </p>
      </div>
    </Modal>
  )
}
